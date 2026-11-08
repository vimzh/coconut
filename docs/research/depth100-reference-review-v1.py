#!/usr/bin/env python3
"""Stdlib exact-rational review of the frozen research-only depth-100 population."""
import hashlib
import json
from fractions import Fraction
from pathlib import Path
import sys


SOURCE = Path(sys.argv[1]) if len(sys.argv) == 2 else Path("apps/api/data/research/depth100-population-v1.json")


def fraction_text(value):
    return str(value.numerator) if value.denominator == 1 else f"{value.numerator}/{value.denominator}"


def shape(expression):
    operation = expression["op"]
    if operation in ("variable", "constant"):
        return 0, 1
    if operation in ("negate", "square", "abs"):
        depth, nodes = shape(expression["arg"])
        return depth + 1, nodes + 1
    left_depth, left_nodes = shape(expression["left"])
    right_depth, right_nodes = shape(expression["right"])
    return max(left_depth, right_depth) + 1, left_nodes + right_nodes + 1


def evaluate(expression, x):
    operation = expression["op"]
    if operation == "variable":
        return x
    if operation == "constant":
        return Fraction(expression["value"])
    if operation == "add":
        return evaluate(expression["left"], x) + evaluate(expression["right"], x)
    if operation == "multiply":
        return evaluate(expression["left"], x) * evaluate(expression["right"], x)
    if operation == "negate":
        return -evaluate(expression["arg"], x)
    if operation == "abs":
        return abs(evaluate(expression["arg"], x))
    raise ValueError(f"unsupported operation {operation!r}")


def extract_term(expression):
    assert expression["op"] == "abs"
    inner = expression["arg"]
    assert inner["op"] == "add"
    assert inner["left"] == {"op": "variable"}
    assert inner["right"]["op"] == "constant"
    return -Fraction(inner["right"]["value"])


def extract_left_sum(expression):
    terms = []
    while expression["op"] == "add":
        terms.append(extract_term(expression["right"]))
        expression = expression["left"]
    terms.append(extract_term(expression))
    return tuple(reversed(terms))


def canonical_centers(values):
    return tuple(fraction_text(value) for value in values)


def extract_population(expression, label):
    if label == "convex":
        form, centers = "sum-abs", extract_left_sum(expression)
    elif label == "concave":
        assert expression["op"] == "negate"
        form, centers = "negated-sum-abs", extract_left_sum(expression["arg"])
    else:
        assert expression["op"] == "multiply" and expression["left"] == {"op": "variable"}
        form, centers = "x-times-sum-abs", extract_left_sum(expression["right"])
    return form, centers


def review_case(case):
    reference = case["reference"]
    assert reference["claimedLabel"] == case["label"]
    assert reference["domain"] == {"min": "-1", "max": "1"}
    expression = reference["expression"]
    depth, node_count = shape(expression)
    assert depth == case["depth"] == 100
    form, centers = extract_population(expression, case["label"])
    supplied = tuple(Fraction(value) for value in case["centers"])
    assert centers == supplied
    assert len(centers) == len(set(centers))
    assert all(Fraction(-1) < center < Fraction(1) for center in centers)
    if case["label"] == "convex":
        assert len(centers) == 99 and node_count == 494
    else:
        assert len(centers) == 98 and node_count == (490 if case["label"] == "concave" else 491)

    gaps = []
    for pair in reference["witnessPairs"]:
        x, y = Fraction(pair["x"]), Fraction(pair["y"])
        assert Fraction(-1) <= x <= Fraction(1) and Fraction(-1) <= y <= Fraction(1) and x != y
        midpoint = (x + y) / 2
        gaps.append(evaluate(expression, midpoint) - (evaluate(expression, x) + evaluate(expression, y)) / 2)
    if case["label"] == "convex":
        # A negative midpoint gap disproves concavity; sums of |x-c| are convex.
        assert len(gaps) == 1 and gaps[0] < 0
    elif case["label"] == "concave":
        # Negating the preceding construction reverses the strict midpoint gap.
        assert len(gaps) == 1 and gaps[0] > 0
    else:
        assert len(gaps) == 2 and any(gap > 0 for gap in gaps) and any(gap < 0 for gap in gaps)
        assert all(center != 0 for center in centers)
        assert tuple(sorted(centers)) == centers and all(-center in centers for center in centers)
    canonical = canonical_centers(centers)
    return {
        "id": case["id"],
        "label": case["label"],
        "domain": reference["domain"],
        "depth": depth,
        "nodeCount": node_count,
        "form": form,
        "centerCount": len(centers),
        "canonicalCentersSha256": hashlib.sha256(json.dumps(canonical, separators=(",", ":")).encode()).hexdigest(),
        "jensenGaps": [fraction_text(gap) for gap in gaps],
    }, (form, canonical)


raw = SOURCE.read_bytes()
population = json.loads(raw)
assert len(population["cases"]) == 9
reviewed = [review_case(case) for case in population["cases"]]
cases, signatures = zip(*reviewed)
assert len(set(signatures)) == len(signatures)
print(json.dumps({
    "suiteFileSha256": hashlib.sha256(raw).hexdigest(),
    "verdict": "pass",
    "cases": cases,
    "functionSignaturesUnique": True,
    "reviewer": "AI-assisted independent mathematical check",
    "limitations": [
        "The checker proves this fixed sum-of-absolute-affine construction with exact rational arithmetic; it is not a proof-assistant derivation or a general curvature prover.",
        "The population is research-only and highly templated: depth is coupled to kink count and expression length, so it cannot identify a causal depth effect or be pooled with existing suites.",
        "Reference validity does not establish model behavior, provider support, or a broader benchmark claim."
    ]
}, indent=2))
