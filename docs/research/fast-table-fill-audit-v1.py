"""Recompute fixed-cell scores and send accounting from retained evidence without credentials or SDK access."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "apps/api/data"
PRIVATE = DATA / "private/fast-table-fill-v1"


def load(path):
    return json.loads(path.read_text())


def digest(value):
    return hashlib.sha256(value).hexdigest()


def main():
    result_bytes = (PRIVATE / "result.json").read_bytes()
    result = json.loads(result_bytes)
    manifest = load(PRIVATE / "manifest.json")
    summary = load(DATA / "quality/fast-table-fill-v1.json")
    assert manifest["priorInferenceRequests"] == 8160
    assert manifest["newAuthorizedMaximum"] == 351
    assert manifest["cumulativeMaximum"] == 8511
    assert result["inferenceRequests"] <= 351
    assert result["cumulativeConservativeRequests"] == 8160 + result["inferenceRequests"]
    assert result["screeningConcurrency"] == 4 and 1 <= result["concurrency"] <= 24
    assert len(result["rows"]) == len(summary["rows"]) == 351
    assert sum(row["dispatched"] for row in result["rows"]) == result["inferenceRequests"]
    receipts = [load(path) for path in PRIVATE.glob("dispatch-*.json")]
    identity = lambda row: (row["cell"], row["modelId"], row["caseId"], row["trialIndex"])
    assert len({identity(row) for row in result["rows"]}) == 351
    assert len(receipts) == len({identity(row) for row in receipts}) == result["inferenceRequests"]
    assert {identity(row) for row in receipts} == {identity(row) for row in result["rows"] if row["dispatched"]}
    assert all(len(row["requestBodySha256"]) == 64 for row in receipts)
    cells = {"depth60": load(DATA / "suites/depth60-v1.json"),
             "depth100": load(DATA / "research/depth100-population-v1.json"),
             "depth216": load(DATA / "research/depth216-population-v1.json")}
    archive_source = next(row["path"] for row in manifest["sources"] if row["path"].startswith("apps/api/data/experiments/"))
    cells["screening-standard"] = load(ROOT / archive_source)["record"]["suite"]
    references = {(cell, row["id"]): row for cell, value in cells.items() for row in value["cases"]}
    for row in result["rows"]:
        if row["result"]:
            budget = row["result"]["budget"]
            assert budget["maxInferenceRequests"] == 1 and budget["maxOutputTokens"] == 4096
            assert budget["retries"] == 0 and budget["inferenceTimeoutMs"] == 180000
            assert row["result"]["requested"]["modelId"] == row["modelId"]
            assert row["result"]["requested"]["profileId"] == "one-shot-json-v1"
    labels = ("convex", "concave", "neither")
    audits = []
    for report in result["reports"]:
        rows = [row for row in result["rows"] if row["cell"] == report["cell"] and row["modelId"] == report["modelId"]]
        assert len(rows) == 27
        for depth in [None] + [row["depth"] for row in report["byDepth"]]:
            selected = [row for row in rows if depth is None or references[(row["cell"], row["caseId"])]["depth"] == depth]
            counts = {label: {prediction: 0 for prediction in labels + ("unusable",)} for label in labels}
            included = correct = 0
            for row in selected:
                assert row["trialIndex"] in (0, 1, 2)
                outcome = row["result"]["evidence"]["outcome"] if row["result"] else None
                if not outcome or outcome["kind"] not in ("answer", "invalid", "refused", "truncated"):
                    continue
                reference = references[(row["cell"], row["caseId"])]["label"]
                predicted = outcome["label"] if outcome["kind"] == "answer" else "unusable"
                counts[reference][predicted] += 1
                included += 1
                correct += predicted == reference
            f1s = []
            for label in labels:
                tp = counts[label][label]
                fp = sum(counts[other][label] for other in labels if other != label)
                fn = sum(count for prediction, count in counts[label].items() if prediction != label)
                f1s.append(2 * tp / (2 * tp + fp + fn) if 2 * tp + fp + fn else 0)
            macro = sum(f1s) / 3 if included else None
            classification = report["classification"] if depth is None else next(row["classification"] for row in report["byDepth"] if row["depth"] == depth)
            assert classification["population"]["plannedTrials"] == len(selected)
            assert classification["population"]["includedTrials"] == included
            assert classification["population"]["correctTrials"] == correct
            assert classification["population"]["status"] == ("complete" if included == len(selected) else "provisional" if included else "unavailable")
            assert (macro is None and classification["macroF1"] is None) or abs(macro - classification["macroF1"]) < 1e-12
            assert {label: classification["confusion"]["rows"][label]["counts"] for label in labels} == counts
            if depth is None:
                audits.append({"cell": report["cell"], "modelId": report["modelId"], "planned": len(selected), "included": included,
                               "correct": correct, "macroF1": macro, "confusion": counts})
    assert len(audits) == 13
    native = load(PRIVATE / "screening-native-report.json")
    standard = next(row for row in result["reports"] if row["cell"] == "screening-standard")
    assert native["overall"]["classification"] == standard["classification"]
    output = {"version": "1", "verdict": "pass", "sourceFileSha256": digest(result_bytes),
              "inferenceRequests": result["inferenceRequests"], "cumulativeConservativeRequests": result["cumulativeConservativeRequests"],
              "cells": audits, "interpretation": "Arithmetic and dispatch audit only; valid wrong labels do not by themselves establish a repeated mathematical limitation."}
    path = DATA / "quality/fast-table-fill-audit-v1.json"
    with path.open("x") as handle:
        json.dump(output, handle, indent=2)
        handle.write("\n")
    print(json.dumps({"verdict": "pass", "requests": result["inferenceRequests"], "cells": len(audits)}))


if __name__ == "__main__":
    main()
