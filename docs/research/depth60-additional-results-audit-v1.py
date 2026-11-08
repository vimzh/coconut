#!/usr/bin/env python3
"""Independently audit the fixed additional study; Bun supplies JSON.stringify hashes only."""
import argparse
from collections import Counter
from datetime import datetime
from fractions import Fraction
import hashlib
import json
import math
import os
from pathlib import Path
import re
import stat
import subprocess

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / "apps/api/data"
PRIVATE = BASE / "private/depth60-additional-v1"
MODELS = ("gpt-5.4-nano", "gpt-5.4-mini", "gpt-5.6-luna", "gpt-6-luna")
LABELS = ("convex", "concave", "neither")
INCLUDED = {"answer", "invalid", "refused", "truncated"}
CATEGORIES = (*INCLUDED, "empty", "conflicting", "provider-error", "cancelled", "interrupted", "unattempted")
MAX_BYTES = 32 * 1024 * 1024
SUITE_SHA = "88b20bd12bb54fbe1f33c9c36a752f9ed7e9d2663e19b29fb411ddfeb6c93707"
OLD_RESULT_SHA = "0b38bc17e616b765f44ccb7bac0f527d65b3ffbc201d4716b9631f001cff3ab8"
DEPTH100_PROGRESS_SHA = "1a7fae6dde2c7f7328169e84cced636feaf6fb692664e887194e01196f72f4fd"
JS_WHITESPACE = "\u0009\u000a\u000b\u000c\u000d\u0020\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff"


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def read(path):
    info = path.lstat()
    assert stat.S_ISREG(info.st_mode) and not path.is_symlink(), "Evidence must be a regular file"
    assert info.st_size <= MAX_BYTES, "Evidence exceeds the bounded audit input size"
    raw = path.read_bytes()
    assert len(raw) <= MAX_BYTES
    return json.loads(raw.decode("utf-8")), digest(raw)


def near(actual, expected):
    if expected is None:
        assert actual is None, "A missing metric was represented as a number"
    else:
        assert isinstance(actual, (float, int)) and not isinstance(actual, bool)
        assert math.isfinite(actual) and abs(actual - float(expected)) <= 1e-12, "Independent metric differs"


class Pairs(list):
    pass


def extract_completed(text):
    identity = {"protocolVersion": "1", "profileId": "one-shot-json-v1", "rawText": text}
    def invalid(reason):
        return dict(identity, kind="invalid", reason=reason)
    if len(text.encode("utf-16-le", "surrogatepass")) // 2 > 65536:
        return invalid("response-too-large")
    if all(c in " \t\r\n" for c in text):
        return invalid("empty")
    try:
        value = json.loads(text, object_pairs_hook=Pairs, parse_constant=lambda _: (_ for _ in ()).throw(ValueError()))
    except (ValueError, TypeError):
        return invalid("malformed-json")
    if not isinstance(value, Pairs):
        return invalid("invalid-shape")
    keys = [key for key, _ in value]
    if len(keys) != len(set(keys)):
        return invalid("duplicate-field")
    fields = dict(value)
    if len(keys) != 2 or set(keys) != {"label", "explanation"} or not all(isinstance(v, str) for v in fields.values()):
        return invalid("invalid-shape")
    if fields["label"] not in LABELS:
        return invalid("invalid-label")
    explanation = fields["explanation"]
    if not explanation.strip(JS_WHITESPACE) or len(explanation) > 4096 or any(0xD800 <= ord(c) <= 0xDFFF for c in explanation):
        return invalid("invalid-explanation")
    return dict(identity, kind="answer", **fields)


def category(outcome):
    if outcome is None:
        return "unattempted"
    if outcome["kind"] == "invalid":
        return {"empty": "empty", "duplicate-field": "conflicting"}.get(outcome["reason"], "invalid")
    return outcome["kind"]


def population(rows, labels):
    matrix = {label: Counter({key: 0 for key in (*LABELS, "unusable")}) for label in LABELS}
    outcomes = Counter({key: 0 for key in sorted(CATEGORIES)})
    included = correct = 0
    for row in rows:
        outcome = row["result"]["evidence"]["outcome"] if row["result"] else None
        outcomes[category(outcome)] += 1
        if outcome is None or outcome["kind"] not in INCLUDED:
            continue
        included += 1
        label = labels[row["caseId"]]
        prediction = outcome["label"] if outcome["kind"] == "answer" else "unusable"
        matrix[label][prediction] += 1
        correct += prediction == label
    classes = {}
    for label in LABELS:
        tp = matrix[label][label]
        support = sum(matrix[label].values())
        fp = sum(matrix[other][label] for other in LABELS if other != label)
        fn = support - tp
        classes[label] = dict(tp=tp, fp=fp, fn=fn, support=support,
            precision=Fraction(tp, tp + fp) if tp + fp else None,
            recall=Fraction(tp, support) if support else None,
            f1=None if not included else Fraction(2 * tp, 2 * tp + fp + fn) if 2 * tp + fp + fn else Fraction(0))
    macro = sum((classes[label]["f1"] for label in LABELS), Fraction()) / 3 if included else None
    return dict(planned=len(rows), included=included, correct=correct, matrix=matrix, classes=classes, outcomes=outcomes,
        macro=macro, accuracy=Fraction(correct, included) if included else None,
        status="unavailable" if not included else "complete" if included == len(rows) else "provisional")


def check_rate(actual, numerator, denominator):
    assert actual["numerator"] == numerator and actual["denominator"] == denominator
    near(actual["value"], Fraction(numerator, denominator) if denominator else None)


def check_population(report, rows, labels):
    own = population(rows, labels)
    assert report["population"] == dict(plannedTrials=own["planned"], includedTrials=own["included"],
        excludedTrials=own["planned"] - own["included"], correctTrials=own["correct"], status=own["status"])
    near(report["macroF1"], own["macro"])
    check_rate(report["accuracy"], own["correct"], own["included"])
    assert report["confusion"]["columns"] == [*LABELS, "unusable"]
    assert report["absentReferenceClasses"] == [label for label in LABELS if not own["classes"][label]["support"]]
    for label in LABELS:
        assert report["confusion"]["rows"][label]["counts"] == dict(own["matrix"][label])
        for field, expected in own["classes"][label].items():
            near(report["classes"][label][field], expected)
        rates = report["confusion"]["rows"][label]["rowRates"]
        support = own["classes"][label]["support"]
        if not support:
            assert rates is None
        else:
            for key, count in own["matrix"][label].items():
                near(rates[key], Fraction(count, support))
    for label, key in (("convex", "convexToNeither"), ("concave", "concaveToNeither")):
        check_rate(report["directionalErrors"][key], own["matrix"][label]["neither"], own["classes"][label]["support"])
    for key, count in own["outcomes"].items():
        check_rate(report["outcomes"][key], count, own["included"] if key in {"answer", "invalid", "empty", "conflicting", "refused", "truncated"} else own["planned"])
    return own


def check_spread(report, values):
    assert report["count"] == len(values)
    average = sum(values) / len(values) if values else None
    near(report["mean"], average)
    near(report["min"], min(values) if values else None)
    near(report["max"], max(values) if values else None)
    deviation = math.sqrt(sum((float(v) - float(average)) ** 2 for v in values) / (len(values) - 1)) if len(values) > 1 else None
    near(report["sampleStandardDeviation"], deviation)


def check_classification(report, rows, labels):
    own = check_population(report, rows, labels)
    eligible = []
    assert len(report["trials"]) == 3
    for trial, observed in enumerate(report["trials"]):
        assert observed["trialIndex"] == trial
        selected = [row for row in rows if row["trialIndex"] == trial]
        computed = check_population(observed["metrics"], selected, labels)
        complete = computed["status"] == "complete" and len(selected) == 9
        assert observed["eligibleForSpread"] == complete
        if complete:
            eligible.append(computed)
    assert report["spread"]["plannedReplicates"] == 3 and report["spread"]["eligibleReplicates"] == len(eligible)
    check_spread(report["spread"]["macroF1"], [r["macro"] for r in eligible])
    for label in LABELS:
        check_spread(report["spread"]["recall"][label], [r["classes"][label]["recall"] for r in eligible if r["classes"][label]["recall"] is not None])
    instances = agreeing = 0
    for case_id in labels:
        outcomes = [row["result"]["evidence"]["outcome"] if row["result"] else None for row in rows if row["caseId"] == case_id]
        if len(outcomes) == 3 and all(outcome and outcome["kind"] == "answer" for outcome in outcomes):
            instances += 1
            agreeing += sum(outcomes[a]["label"] == outcomes[b]["label"] for a in range(3) for b in range(a + 1, 3))
    expected = dict(eligibleInstances=instances, totalInstances=9, agreeingPairs=agreeing, totalPairs=instances * 3,
        value=agreeing / (instances * 3) if instances else None)
    assert report["agreement"] == expected
    return own


def check_diagnostics(report, rows):
    results = [row["result"] for row in rows if row["result"]]
    usage = report["usage"]
    assert usage["attempts"]["total"] == len(results) and usage["logicalTrials"]["total"] == len(rows)
    for field in ("input", "output", "reasoning"):
        values = [r["evidence"]["usage"][field] for r in results if r["evidence"]["usage"][field] is not None]
        groups = []
        for semantics in sorted({v["semantics"] for v in values}):
            counts = [v["count"] for v in values if v["semantics"] == semantics]
            groups.append(dict(semantics=semantics, reporting=len(counts), total=sum(counts), mean=sum(counts) / len(counts)))
        assert usage["attempts"]["fields"][field] == dict(reporting=len(values), missing=len(results) - len(values), groups=groups)
        assert usage["logicalTrials"]["fields"][field] == dict(complete=len(values), missing=len(rows) - len(values), groups=groups)
    model = [r for r in results if r["evidence"]["outcome"]["kind"] in INCLUDED]
    times = sorted(r["evidence"]["elapsedMs"] for r in model if r["evidence"]["elapsedMs"] is not None)
    infrastructure = sum(r["evidence"]["outcome"]["kind"] not in INCLUDED for r in results)
    timeout = sum(r["evidence"]["errorKind"] == "timeout" for r in results)
    assert report["latency"] == dict(eligible=len(model), reporting=len(times), missing=len(model) - len(times),
        p50Ms=times[math.ceil(len(times) / 2) - 1] if times else None,
        p95Ms=times[math.ceil(len(times) * .95) - 1] if times else None,
        infrastructureTrials=infrastructure, infrastructureAttempts=infrastructure, timeoutTrials=timeout, timeoutAttempts=timeout,
        unattemptedTrials=len(rows) - len(results))
    assert report["cost"]["attempts"] == report["cost"]["missing"] == len(results)
    assert report["cost"]["reporting"] == 0 and report["cost"]["total"] is None and report["cost"]["groups"] == []
    assert report["intermediateSteps"]["status"] == "not-applicable"


def stringify_hashes(paths):
    # Arithmetic never imports the application scorer. The runtime only implements its retained insertion-order hash format.
    program = r'''
      import {createHash} from 'node:crypto';
      const p=JSON.parse(await Bun.stdin.text()), sha=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
      const stable=v=>Array.isArray(v)?'['+v.map(stable).join(',')+']':v!==null&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}':JSON.stringify(v);
      const canonicalSha=v=>createHash('sha256').update(stable(v)).digest('hex');
      const read=async path=>{const f=Bun.file(path);if(f.size>33554432)throw Error('Oversized hash input');return f.json()};
      const source=await read(p.source), manifest=await read(p.manifest), old=await read(p.old), suite=await read(p.suite);
      const prompts=suite.cases.map(c=>old.rows.find(r=>r.caseId===c.id&&r.result).result.prompt);
      const rows=source.rows.map(row=>({modelId:row.modelId,caseId:row.caseId,trialIndex:row.trialIndex,
        resultSha256:row.result?sha(row.result):null,
        resultCanonicalSha256:row.result?canonicalSha(row.result):null,
        referenceSha256:canonicalSha(suite.cases.find(c=>c.id===row.caseId).reference),
        outcomeSha256:row.result?sha(row.result.evidence.outcome):null,
        rawTextSha256:row.result?createHash('sha256').update(row.result.evidence.outcome.rawText).digest('hex'):null,
        requestBodySha256:sha({model:row.modelId,input:prompts[suite.cases.findIndex(c=>c.id===row.caseId)].messages.map(({role,content})=>({role,content})),max_output_tokens:4096,store:false,truncation:'disabled'})}));
      console.log(JSON.stringify({manifestSha256:sha(manifest),promptsSha256:sha(prompts),rows,
        reportIds:source.reports.map(({modelId,report})=>{const{id,...content}=report;return{modelId,id,expectedId:'report-v1-'+sha(content)}})}));
    '''
    run = subprocess.run(["bun", "--no-env-file", "-e", program], input=json.dumps(paths), text=True,
        capture_output=True, check=True, cwd="/tmp", timeout=30)
    return json.loads(run.stdout)


def audit():
    relative = lambda path: str(path.relative_to(ROOT))
    source_path = PRIVATE / "result.json"
    manifest_path = BASE / "experiments/depth60-additional-matrix-v1.json"
    source, source_sha = read(source_path)
    manifest, manifest_sha = read(manifest_path)
    progress, progress_sha = read(BASE / "experiments/depth60-additional-progress-v1.json")
    suite, suite_sha = read(BASE / "suites/depth60-v1.json")
    assert suite_sha == SUITE_SHA and manifest["suiteFileSha256"] == SUITE_SHA
    assert manifest["models"] == list(MODELS) and manifest["methodId"] == source["methodId"] == "depth60-additional-v1"
    for key, expected in dict(priorInferenceRequests=7962, maxInferenceRequests=108, cumulativeInferenceCeiling=8070,
        sharedCeiling=8192, maxConcurrency=12, initialConcurrency=4, retries=0, inferenceDeadlineMs=180000, maxOutputTokens=4096,
        cases=9, trialsPerCase=3, profileId="one-shot-json-v1").items():
        assert manifest[key] == expected, "Frozen method or budget differs"
    assert progress["state"] in {"settled", "interrupted"}, "Only terminal evidence may be audited"
    assert len(suite["cases"]) == 9 and all(c["depth"] == 60 for c in suite["cases"])
    labels = {case["id"]: case["label"] for case in suite["cases"]}
    assert Counter(labels.values()) == dict(convex=3, concave=3, neither=3)
    lineage = []
    for field, path in (
        ("reviewFileSha256", BASE / "quality/depth60-reference-review-v1.json"),
        ("priorProgressFileSha256", BASE / "experiments/long-reserve-progress-v1.json"),
        ("originalPilotManifestFileSha256", BASE / "experiments/depth60-matrix-v1.json"),
        ("originalPilotProgressFileSha256", BASE / "experiments/depth60-progress-v1.json"),
        ("originalPilotResultFileSha256", BASE / "private/depth60-v1/result.json"),
        ("originalPilotAuditFileSha256", BASE / "quality/depth60-results-audit-v1.json"),
        ("depth100ManifestFileSha256", BASE / "experiments/depth100-matrix-v1.json"),
        ("depth100ProgressFileSha256", BASE / "experiments/depth100-progress-v1.json"),
        ("depth100ResultFileSha256", BASE / "private/depth100-v1/result.json"),
    ):
        value, file_sha = read(path)
        assert manifest[field] == file_sha, "Frozen prior source changed"
        lineage.append(dict(path=relative(path), fileSha256=file_sha))
        if field == "originalPilotResultFileSha256":
            assert file_sha == OLD_RESULT_SHA and value["inferenceRequests"] == 54 and value["cumulativeConservativeRequests"] == 7908
            old = value
        if field in {"depth100ProgressFileSha256", "depth100ResultFileSha256"}:
            assert value["inferenceRequests"] == 54 and value["cumulativeConservativeRequests"] == 7962
            assert len(value["rows"]) == 54
            if field == "depth100ProgressFileSha256":
                assert file_sha == DEPTH100_PROGRESS_SHA
    old_reviews, old_review_sha = read(BASE / "quality/depth60-transcript-review-v1.json")
    assert old_reviews["sourceFileSha256"] == OLD_RESULT_SHA and len(old_reviews["reviews"]) == 32
    old_wrong = [row for row in old["rows"] if row["result"]["evidence"]["outcome"]["kind"] != "answer" or row["result"]["evidence"]["outcome"]["label"] != labels[row["caseId"]]]
    assert len(old_wrong) == 32
    for row in old_wrong:
        inspected = [r for r in old_reviews["reviews"] if (r["modelId"], r["caseId"], r["trialIndex"]) == (row["modelId"], row["caseId"], row["trialIndex"])]
        assert len(inspected) == 1
        outcome = row["result"]["evidence"]["outcome"]
        assert inspected[0]["rawTextSha256"] == digest(outcome["rawText"].encode()) and inspected[0]["officialKind"] == outcome["kind"]
        assert inspected[0]["referenceLabel"] == labels[row["caseId"]]
    hashes = stringify_hashes(dict(source=str(source_path), manifest=str(manifest_path), old=str(BASE / "private/depth60-v1/result.json"), suite=str(BASE / "suites/depth60-v1.json")))
    assert source["manifestSha256"] == progress["manifestSha256"] == hashes["manifestSha256"]
    assert manifest["promptsSha256"] == hashes["promptsSha256"]
    assert all(report["id"] == report["expectedId"] for report in hashes["reportIds"])
    assert progress["reports"] == source["reports"]
    expected = {(model, case_id, trial) for model in MODELS for case_id in labels for trial in range(3)}
    identity = lambda row: (row["modelId"], row["caseId"], row["trialIndex"])
    assert len(source["rows"]) == len(progress["rows"]) == len(expected) == 108
    assert {identity(row) for row in source["rows"]} == {identity(row) for row in progress["rows"]} == expected
    by_hash = {identity(row): row for row in hashes["rows"]}
    public = {identity(row): row for row in progress["rows"]}
    old_prompts = {case_id: next(row["result"]["prompt"] for row in old["rows"] if row["caseId"] == case_id) for case_id in labels}
    dispatches = {}
    dispatch_records = []
    for path in sorted(PRIVATE.glob("dispatch-*.json")):
        receipt, file_sha = read(path)
        assert path.name == f"dispatch-{receipt['ordinal']}.json" and identity(receipt) in expected
        assert identity(receipt) not in dispatches, "A planned trial has multiple dispatch authorizations"
        assert receipt["requestBodySha256"] == by_hash[identity(receipt)]["requestBodySha256"]
        assert receipt["remoteOutcomeUntilRetained"] == "unknown"
        assert datetime.fromisoformat(receipt["authorizedAt"].replace("Z", "+00:00")) >= datetime.fromisoformat(manifest["frozenAt"].replace("Z", "+00:00"))
        dispatches[identity(receipt)] = receipt
        dispatch_records.append(dict(**receipt, fileSha256=file_sha, path=relative(path)))
    assert sorted(row["ordinal"] for row in dispatch_records) == list(range(1, len(dispatch_records) + 1))
    assert len(dispatches) == source["inferenceRequests"] == progress["inferenceRequests"] <= 108
    assert source["cumulativeConservativeRequests"] == progress["cumulativeConservativeRequests"] == 7962 + len(dispatches)
    seen_attempts = set()
    records = []
    for row in source["rows"]:
        key, retained = identity(row), row["result"]
        advertised = public[key]
        assert row["dispatched"] == (key in dispatches) == advertised["dispatched"]
        assert advertised["resultSha256"] == by_hash[key]["resultSha256"]
        assert advertised["outcome"] == (retained["evidence"]["outcome"]["kind"] if retained else "unavailable" if row["dispatched"] else "unattempted")
        assert advertised["failure"] == (retained["failure"] if retained else None)
        record = dict(by_hash[key], dispatched=row["dispatched"], retained=retained is not None,
            referenceLabel=labels[row["caseId"]], officialKind=retained["evidence"]["outcome"]["kind"] if retained else None)
        if retained is not None:
            individual, individual_sha = read(PRIVATE / f"{row['modelId']}-{list(labels).index(row['caseId'])}-{row['trialIndex']}.json")
            assert individual == row, "An individual result differs from final retained evidence"
            record["individualFileSha256"] = individual_sha
            assert retained["attemptId"] not in seen_attempts
            seen_attempts.add(retained["attemptId"])
            assert retained["requested"] == dict(provider="openai", modelId=row["modelId"], servingProvider=None, profileId="one-shot-json-v1")
            assert retained["prompt"] == old_prompts[row["caseId"]]
            assert retained["budget"] == dict(maxInferenceRequests=1, maxOutputTokens=4096, metadataTimeoutMs=20000, inferenceTimeoutMs=180000, retries=0)
            assert retained["inferenceRequests"] in (0, 1) and (not retained["inferenceRequests"] or row["dispatched"])
            assert isinstance(retained["httpAttempts"], int) and 0 <= retained["httpAttempts"] <= 2
            outcome = retained["evidence"]["outcome"]
            assert outcome["protocolVersion"] == "1" and outcome["profileId"] == "one-shot-json-v1"
            if retained["failure"] is None:
                assert retained["inferenceRequests"] == 1
                assert retained["effective"]["maxOutputTokens"] in (4096, None) and retained["effective"]["truncation"] in ("disabled", None)
                if retained["finishReason"] == "completed":
                    assert extract_completed(outcome["rawText"]) == outcome, "Strict independent visible-text extraction differs"
                else:
                    finish = retained["finishReason"]
                    kind = "refused" if finish in ("refusal", "content_filter") else "truncated" if finish == "max_output_tokens" else "cancelled" if finish == "cancelled" else "interrupted" if finish in ("incomplete", "in_progress", "queued") else None
                    assert kind is not None and outcome["kind"] == kind
            else:
                assert outcome["kind"] == ("cancelled" if retained["failure"]["code"] == "cancelled" else "provider-error")
            usage = retained["evidence"]["usage"]
            for field, value in usage.items():
                if value is not None:
                    assert isinstance(value["count"], int) and not isinstance(value["count"], bool) and 0 <= value["count"] <= 9007199254740991
                    assert value["semantics"] == {"input": "openai.input_tokens", "output": "openai.output_tokens (includes reported reasoning tokens)", "reasoning": "openai.output_tokens_details.reasoning_tokens (subset of output)"}[field]
            if usage["output"] is not None:
                assert usage["output"]["count"] <= 4096
                if usage["reasoning"] is not None:
                    assert usage["reasoning"]["count"] <= usage["output"]["count"]
            assert retained["evidence"]["cost"] is None
            record.update(predictedLabel=outcome.get("label"), correct=outcome["kind"] == "answer" and outcome["label"] == labels[row["caseId"]],
                visibleCodeUnits=len(outcome["rawText"].encode("utf-16-le", "surrogatepass")) // 2,
                reportedModelId=retained["reportedModelId"], effective=retained["effective"], failure=retained["failure"],
                inferenceRequests=retained["inferenceRequests"], httpAttempts=retained["httpAttempts"])
        records.append(record)
    unknown = sum(bool(row["dispatched"] and (not row["result"] or row["result"]["failure"] and row["result"]["failure"]["remoteOutcome"] == "unknown")) for row in source["rows"])
    assert progress["unknownRemoteInferenceRequests"] == unknown
    assert len(source["reports"]) == 4 and {r["modelId"] for r in source["reports"]} == set(MODELS)
    summaries = []
    for model in MODELS:
        rows = [row for row in source["rows"] if row["modelId"] == model]
        report = next(item["report"] for item in source["reports"] if item["modelId"] == model)
        own = check_classification(report["overall"]["classification"], rows, labels)
        check_diagnostics(report["overall"]["diagnostics"], rows)
        assert report["reportVersion"] == report["scorerVersion"] == "1" and report["policyId"] == "pooled-macro-f1-v1"
        assert report["identity"]["runId"] == f"depth60-additional-v1-{model}" and report["identity"]["suiteId"] == suite["id"]
        assert report["identity"]["profileId"] == "one-shot-json-v1" and report["identity"]["method"] == "one-shot"
        assert report["identity"]["model"] == dict(provider="openai", modelId=model, endpointId="responses", settingsId="provider-default-4096")
        assert len(report["byDepth"]) == 1 and report["byDepth"][0]["depth"] == report["baselineDepth"] == 60
        assert report["byDepth"][0]["classification"] == report["overall"]["classification"]
        assert report["byDepth"][0]["diagnostics"] == report["overall"]["diagnostics"]
        near(report["byDepth"][0]["macroF1Difference"], 0 if own["included"] else None)
        results = [row["result"] for row in rows if row["result"]]
        totals = {field: sum(r["evidence"]["usage"][field]["count"] for r in results if r["evidence"]["usage"][field] is not None) for field in ("input", "output", "reasoning")}
        coverage = {field: sum(r["evidence"]["usage"][field] is not None for r in results) for field in totals}
        summaries.append(dict(modelId=model, reportedModelIds=sorted({r["reportedModelId"] for r in results if r["reportedModelId"] is not None}),
            planned=27, included=own["included"], populationStatus=own["status"], correct=own["correct"], wrongValid=own["outcomes"]["answer"] - own["correct"],
            invalid=sum(r["evidence"]["outcome"]["kind"] == "invalid" for r in results), refused=own["outcomes"]["refused"], truncated=own["outcomes"]["truncated"],
            infrastructure=sum(r["evidence"]["outcome"]["kind"] not in INCLUDED for r in results), unattempted=sum(not row["dispatched"] and row["result"] is None for row in rows),
            unavailable=sum(row["dispatched"] and row["result"] is None for row in rows),
            macroF1=float(own["macro"]) if own["macro"] is not None else None, macroF1Exact=str(own["macro"]) if own["macro"] is not None else None,
            officialMacroF1=report["overall"]["classification"]["macroF1"], accuracy=float(own["accuracy"]) if own["accuracy"] is not None else None,
            confusion={label: dict(own["matrix"][label]) for label in LABELS}, outcomes=dict(own["outcomes"]), usage=totals, usageCoverage=coverage,
            reasoningIsSubsetOfOutput=True, observedCost=None, reportId=report["id"]))
    complete = all(row["populationStatus"] == "complete" for row in summaries)
    if progress["state"] == "settled":
        assert complete and unknown == 0
    times = [row["result"] for row in source["rows"] if row["result"]]
    span = (datetime.fromisoformat(max(r["finishedAt"] for r in times).replace("Z", "+00:00")) - datetime.fromisoformat(min(r["startedAt"] for r in times).replace("Z", "+00:00"))).total_seconds() if times else None
    headers = source["rateLimitEvidence"]
    first = headers[:4]
    headroom = len(first) == 4 and {r["modelId"] for r in first} == set(MODELS) and all(float(r["values"].get("x-ratelimit-remaining-requests", 0)) >= 108 and float(r["values"].get("x-ratelimit-remaining-tokens", 0)) >= 100000 for r in first)
    assert source["concurrency"] == (12 if headroom else 4)
    events = []
    for row in source["rows"]:
        if row["dispatched"]:
            start = datetime.fromisoformat(dispatches[identity(row)]["authorizedAt"].replace("Z", "+00:00"))
            end = datetime.fromisoformat((row["result"]["finishedAt"] if row["result"] else source["finishedAt"]).replace("Z", "+00:00"))
            assert start <= end
            events.extend(((start, 1), (end, -1)))
    active = overlap = 0
    for _, delta in sorted(events):
        active += delta
        assert active >= 0
        overlap = max(overlap, active)
    assert active == 0 and overlap <= source["concurrency"] <= 12
    required = [r for r in records if r["officialKind"] in INCLUDED and not r.get("correct", False)]
    transcript_path = BASE / "quality/depth60-additional-transcript-review-v1.json"
    transcript = dict(status="pending", required=len(required))
    if transcript_path.exists():
        review, review_sha = read(transcript_path)
        assert review["sourceFileSha256"] == source_sha and review["suiteFileSha256"] == SUITE_SHA
        assert len(review["reviews"]) == len(required) and len({identity(r) for r in review["reviews"]}) == len(required)
        for record in required:
            inspected = next(r for r in review["reviews"] if identity(r) == identity(record))
            assert inspected["rawTextSha256"] == record["rawTextSha256"] and inspected["referenceSha256"] == record["referenceSha256"]
            assert inspected["resultSha256"] == record["resultSha256"] and inspected["predictedLabel"] == record["predictedLabel"] and inspected["referenceLabel"] == record["referenceLabel"]
            assert inspected["officialKind"] == record["officialKind"] and inspected["fullVisibleTextInspected"] is True and inspected["officialOutcomeChanged"] is False
        transcript = dict(status="complete", required=len(required), reviewed=len(required), path=relative(transcript_path), fileSha256=review_sha)
    assert read(source_path)[1] == source_sha and read(manifest_path)[1] == manifest_sha, "Terminal evidence changed during audit"
    return dict(version="1", kind="independent-depth60-additional-results-audit", methodId="depth60-additional-v1", verdict="pass", state=progress["state"],
        sourceFileSha256=source_sha, sourceManifestFileSha256=manifest_sha, sourceProgressFileSha256=progress_sha, suiteFileSha256=SUITE_SHA, lineage=lineage,
        hashAlgorithms=dict(sourceFiles="SHA-256 of exact retained file bytes", resultSha256="SHA-256 of insertion-order compact JSON.stringify, matching retained progress", referenceSha256="SHA-256 of recursively key-sorted compact JSON, with array order preserved", resultCanonicalSha256="SHA-256 of recursively key-sorted compact JSON", rawTextSha256="SHA-256 of complete retained visible UTF-8 text"),
        priorInferenceRequests=7962, inferenceRequests=len(dispatches), cumulativeConservativeRequests=7962 + len(dispatches), sharedCeiling=8192,
        earlierUnknownRemoteInferenceRequestsAlreadyIncluded=120, newUnknownRemoteInferenceRequests=unknown,
        plannedTrials=108, uniqueTrialIdentities=108, retainedTrials=len(times), dispatchIdentityBindings=len(dispatches), concurrency=source["concurrency"], trialSpanSeconds=span,
        maximumObservedLocalAuthorizationOverlap=overlap, originalTranscriptReview=dict(path="apps/api/data/quality/depth60-transcript-review-v1.json", fileSha256=old_review_sha, sourceFileSha256=OLD_RESULT_SHA, reusedReviewedWrongUnusable=32),
        models=summaries, records=records, dispatches=dispatch_records, qualitativeReview=transcript,
        limitations=["Normalized retained fields and visible-text extraction only; raw provider envelopes, wire bytes and raw total_tokens were not retained.",
            "Insertion-order JSON.stringify hashes are computed by a hash-only Bun subprocess; classification arithmetic and strict parsing use independent Python standard-library code.",
            "All wrong/unusable texts require separate hash-bound qualitative inspection. Correct-label explanations are outside that qualitative scope.",
            "Provider-default reasoning may differ by model. No equal-compute, rank, interval, causal depth or general failure-threshold claim follows.",
            "Reasoning tokens are a subset of output. No monetary estimate or billing claim is supplied. Earlier unknown sends remain included once."])


def self_test():
    good = '{"label":"convex","explanation":"Valid explanation."}'
    assert extract_completed(good)["kind"] == "answer"
    for text, reason in (("", "empty"), ("[]", "invalid-shape"), ("{", "malformed-json"),
        ('{"label":"convex","label":"concave","explanation":"x"}', "duplicate-field"),
        ('{"label":"convex","explanation":""}', "invalid-explanation"),
        ('{"label":"bad","explanation":"x"}', "invalid-label"),
        ('{"label":"convex","explanation":"\\ud800"}', "invalid-explanation")):
        assert extract_completed(text)["reason"] == reason
    rows = [dict(caseId=str(i), result=dict(evidence=dict(outcome=dict(kind="answer", label=prediction)))) for i, prediction in enumerate(("convex", "convex", "neither"))]
    own = population(rows, dict(zip(("0", "1", "2"), LABELS)))
    assert own["macro"] == Fraction(5, 9) and own["accuracy"] == Fraction(2, 3)
    rows[1]["result"]["evidence"]["outcome"] = dict(kind="truncated")
    assert population(rows, dict(zip(("0", "1", "2"), LABELS)))["included"] == 3
    rows[1]["result"]["evidence"]["outcome"] = dict(kind="provider-error")
    assert population(rows, dict(zip(("0", "1", "2"), LABELS)))["status"] == "provisional"
    print("Independent parser/arithmetic boundary checks passed (11).")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--write", action="store_true", help="Exclusively create the final audit after terminal evidence and full transcript review exist")
    args = parser.parse_args()
    if args.self_test:
        assert not args.write
        self_test()
    else:
        audited = audit()
        encoded = json.dumps(audited, ensure_ascii=False, indent=2, allow_nan=False) + "\n"
        if args.write:
            assert audited["qualitativeReview"]["status"] == "complete", "Complete the hash-bound qualitative review before finalizing"
            target = BASE / "quality/depth60-additional-results-audit-v1.json"
            descriptor = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(descriptor, "w", encoding="utf-8") as output:
                output.write(encoded)
            print(json.dumps(dict(path=str(target.relative_to(ROOT)), fileSha256=digest(encoded.encode()), verdict="pass")))
        else:
            print(encoded, end="")
