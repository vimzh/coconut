#!/usr/bin/env python3
"""Independent exact-rational review of the fixed depth-216 research population."""
import hashlib
import json
from fractions import Fraction
from pathlib import Path
import sys


SOURCE = Path(sys.argv[1]) if len(sys.argv) == 2 else Path("apps/api/data/research/depth216-population-v1.json")
POLICY = "absolute-sum-exact-216-v1"


def text(value):
    return str(value.numerator) if value.denominator == 1 else f"{value.numerator}/{value.denominator}"


def shape(node):
    operation = node["op"]
    if operation in ("variable", "constant"):
        return 0, 1
    if operation in ("negate", "abs", "square"):
        depth, count = shape(node["arg"])
        return depth + 1, count + 1
    left_depth, left_count = shape(node["left"])
    right_depth, right_count = shape(node["right"])
    return max(left_depth, right_depth) + 1, left_count + right_count + 1


def evaluate(node, x):
    operation = node["op"]
    if operation == "variable": return x
    if operation == "constant": return Fraction(node["value"])
    if operation == "add": return evaluate(node["left"], x) + evaluate(node["right"], x)
    if operation == "multiply": return evaluate(node["left"], x) * evaluate(node["right"], x)
    if operation == "negate": return -evaluate(node["arg"], x)
    if operation == "abs": return abs(evaluate(node["arg"], x))
    raise ValueError(f"Unsupported operation {operation!r}")


def extract_term(node):
    assert node["op"] == "abs"
    inner = node["arg"]
    assert inner["op"] == "add" and inner["left"] == {"op": "variable"}
    assert inner["right"]["op"] == "constant"
    return -Fraction(inner["right"]["value"])


def extract_sum(node):
    values = []
    while node["op"] == "add":
        values.append(extract_term(node["right"]))
        node = node["left"]
    values.append(extract_term(node))
    return tuple(reversed(values))


def form_and_centers(expression, label):
    if label == "convex":
        return "sum-abs", extract_sum(expression)
    if label == "concave":
        assert expression["op"] == "negate"
        return "negated-sum-abs", extract_sum(expression["arg"])
    assert expression["op"] == "multiply" and expression["left"] == {"op": "variable"}
    return "x-times-sum-abs", extract_sum(expression["right"])


def witnesses(expression, pairs):
    values = []
    for pair in pairs:
        x, y = Fraction(pair["x"]), Fraction(pair["y"])
        assert Fraction(-1) <= x <= Fraction(1) and Fraction(-1) <= y <= Fraction(1) and x != y
        midpoint = (x + y) / 2
        fx, fy, fm = evaluate(expression, x), evaluate(expression, y), evaluate(expression, midpoint)
        values.append({**pair, "midpoint": text(midpoint), "fX": text(fx), "fY": text(fy), "fMidpoint": text(fm), "gap": text(fm - (fx + fy) / 2)})
    return values


def review(case):
    reference, certificate = case["reference"], case["certificate"]
    assert case["depth"] == 216 and reference["claimedLabel"] == case["label"]
    assert reference["domain"] == {"min": "-1", "max": "1"}
    assert certificate["policy"] == POLICY and certificate["depth"] == 216
    depth, nodes = shape(reference["expression"])
    assert depth == 216 and nodes == certificate["nodeCount"]
    expected_nodes = {"convex": 1074, "concave": 1070, "neither": 1071}[case["label"]]
    assert nodes == expected_nodes and nodes <= 1200
    form, centers = form_and_centers(reference["expression"], case["label"])
    supplied = tuple(Fraction(value) for value in case["centers"])
    assert centers == supplied and len(centers) == certificate["centerCount"]
    assert len(centers) == len(set(centers)) and all(Fraction(-1) < value < Fraction(1) for value in centers)
    assert len(centers) == (215 if case["label"] == "convex" else 214)
    if case["label"] == "convex":
        assert centers.count(Fraction(0)) == 1
    else:
        assert Fraction(0) not in centers and all(-value in centers for value in centers)
    computed_witnesses = witnesses(reference["expression"], reference["witnessPairs"])
    assert computed_witnesses == certificate["witnesses"]
    gaps = [Fraction(item["gap"]) for item in computed_witnesses]
    if case["label"] == "convex": assert len(gaps) == 1 and gaps[0] < 0
    elif case["label"] == "concave": assert len(gaps) == 1 and gaps[0] > 0
    else: assert len(gaps) == 2 and gaps[0] > 0 and gaps[1] < 0
    standard = case["standardVerifierOutcome"]
    assert standard["status"] == "unverified" and standard["reason"] == "resource-limit"
    # Node's JSON.stringify emits compact, insertion-ordered JSON for this plain reference object.
    identity = "case-depth216-v1-" + hashlib.sha256(json.dumps(reference, separators=(",", ":")).encode()).hexdigest()
    assert case["id"] == identity
    canonical = tuple(text(value) for value in centers)
    assert certificate["arithmeticOperations"] == {"convex": 2908, "concave": 2898, "neither": 5153}[case["label"]]
    return {
        "id": case["id"], "label": case["label"], "domain": reference["domain"],
        "depth": depth, "nodeCount": nodes, "form": form, "centerCount": len(centers),
        "canonicalCentersSha256": hashlib.sha256(json.dumps(canonical, separators=(",", ":")).encode()).hexdigest(),
        "witnesses": computed_witnesses, "arithmeticOperations": certificate["arithmeticOperations"],
        "standardVerifierOutcome": {"status": standard["status"], "reason": standard["reason"]},
    }, (form, canonical)


raw = SOURCE.read_bytes()
population = json.loads(raw)
assert population["researchPolicy"] == POLICY and len(population["cases"]) == 9
checked = [review(case) for case in population["cases"]]
cases, signatures = zip(*checked)
assert len(set(signatures)) == len(signatures) and len({case["id"] for case in population["cases"]}) == 9
print(json.dumps({
    "suiteFileSha256": hashlib.sha256(raw).hexdigest(),
    "verdict": "pass",
    "researchPolicy": POLICY,
    "newPolicyBoundExplicit": {"maximumDepth": 216, "maximumNodeCount": 1200, "standardVerifier": "unverified/resource-limit retained"},
    "cases": cases,
    "functionSignaturesUnique": True,
    "reviewer": "AI-assisted independent mathematical check",
    "limitations": [
        "This checker proves the fixed absolute-sum construction with exact rational arithmetic; it is not a proof-assistant derivation or a general curvature verifier.",
        "The standard verifier is intentionally not an admission path here and remains unverified/resource-limit for every retained reference.",
        "This research-only population is highly templated; associative nesting, expression length, and kink count are confounded with depth, so it cannot support general deep-reasoning, causal-depth, ranking, or frontier claims."
    ]
}, indent=2))
