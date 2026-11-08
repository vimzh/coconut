"""Reconstruct classification scores from frozen references and private original outcomes."""
import hashlib
import json
import math
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "apps/api/data"
PRIVATE = DATA / "private/composition-v1"
LABELS = ("convex", "concave", "neither")


def load(path):
    return json.loads(path.read_text())


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def metric(rows):
    confusion = {label: {column: 0 for column in (*LABELS, "unusable")} for label in LABELS}
    for expected, predicted in rows:
        confusion[expected][predicted] += 1
    scores = []
    for label in LABELS:
        tp = confusion[label][label]
        fp = sum(confusion[other][label] for other in LABELS if other != label)
        fn = sum(confusion[label][other] for other in (*LABELS, "unusable") if other != label)
        scores.append(2 * tp / (2 * tp + fp + fn))
    return {"planned": len(rows), "correct": sum(a == b for a, b in rows),
            "macroF1": sum(scores) / 3, "confusion": confusion}


def main():
    suite_path = DATA / "suites/composition-v1.json"
    suite = load(suite_path)
    manifest_path = DATA / "experiments/composition-matrix-v1.json"
    manifest = load(manifest_path)
    progress_path = DATA / "experiments/composition-progress-v1.json"
    progress = load(progress_path)
    assert progress["state"] == "complete" and progress["inferenceRequests"] == 162
    assert progress["manifestFileSha256"] == sha(manifest_path)
    assert manifest["suiteId"] == suite["id"] == progress["suiteId"]
    cases = {row["id"]: row for row in suite["cases"]}
    assert len(cases) == 27
    models = []
    for model_id in manifest["models"]:
        path = PRIVATE / f"{model_id}.json"
        record = load(path)
        summary = next(row for row in progress["models"] if row["modelId"] == model_id)
        assert summary["recordSha256"] == sha(path)
        assert record["state"] == "completed" and record["suite"] == suite
        assert record["request"]["modelId"] == model_id
        expected = {(case_id, trial) for case_id in cases for trial in range(3)}
        actual = {(row["caseId"], row["trialIndex"]) for row in record["results"]}
        assert expected == actual and len(record["results"]) == 81
        rows, by_stage, kinds, reported = [], {}, Counter(), set()
        for row in record["results"]:
            result = row["result"]
            outcome = result["evidence"]["outcome"]
            assert result["inferenceRequests"] == 1 and result["failure"] is None
            kinds[outcome["kind"]] += 1
            assert outcome["kind"] in ("answer", "invalid", "refused", "truncated")
            predicted = outcome["label"] if outcome["kind"] == "answer" else "unusable"
            if predicted != "unusable":
                parsed = json.loads(outcome["rawText"])
                assert set(parsed) == {"label", "explanation"} and parsed["label"] == predicted
                assert isinstance(parsed["explanation"], str) and parsed["explanation"].strip()
            case = cases[row["caseId"]]
            pair = (case["label"], predicted)
            rows.append(pair)
            by_stage.setdefault(case["stageCount"], []).append(pair)
            reported.add(result["reportedModelId"])
        overall = metric(rows)
        native = record["report"]["overall"]["classification"]
        assert native["population"]["status"] == "complete"
        assert native["population"]["correctTrials"] == overall["correct"]
        assert math.isclose(native["macroF1"], overall["macroF1"], abs_tol=1e-12)
        for label in LABELS:
            assert native["confusion"]["rows"][label]["counts"] == overall["confusion"][label]
        stages = []
        for stage in (2, 4, 6):
            result = metric(by_stage[stage])
            assert result["planned"] == 27
            depth = next(case["depth"] for case in cases.values() if case["stageCount"] == stage)
            native_slice = next(row for row in record["report"]["byDepth"] if row["depth"] == depth)["classification"]
            assert math.isclose(native_slice["macroF1"], result["macroF1"], abs_tol=1e-12)
            stages.append({"stages": stage, "astDepth": depth, **result})
        models.append({"modelId": model_id, "reportedModelIds": sorted(reported), **overall,
                       "outcomes": dict(kinds), "byStage": stages, "recordSha256": sha(path)})
    receipts = [load(path) for path in PRIVATE.glob("dispatch-*.json")]
    assert len(receipts) == 162 and {row["ordinal"] for row in receipts} == set(range(1, 163))
    assert Counter(row["modelId"] for row in receipts) == Counter({model: 81 for model in manifest["models"]})
    audit = {"version": "1", "verdict": "pass", "suiteId": suite["id"], "suiteFileSha256": sha(suite_path),
             "progressFileSha256": sha(progress_path), "inferenceRequests": 162, "cumulativeConservativeRequests": 8673,
             "models": models, "interpretation": "Classification arithmetic and complete dispatch audit; explanations are not certified."}
    target = DATA / "quality/composition-results-audit-v1.json"
    target.write_text(json.dumps(audit, indent=2) + "\n")
    public = {"version": "1", "auditVerdict": "pass", "auditFileSha256": sha(target), "suiteId": suite["id"],
              "tasks": 27, "clusters": 9, "trialsPerTask": 3, "models": models}
    (ROOT / "apps/web/public/composition-scores.json").write_text(json.dumps(public, indent=2) + "\n")
    print(json.dumps({"verdict": "pass", "models": [{"modelId": row["modelId"], "correct": row["correct"], "planned": row["planned"], "macroF1": row["macroF1"]} for row in models]}))


if __name__ == "__main__":
    main()
