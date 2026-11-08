#!/usr/bin/env python3
"""Independent exact-rational review of the frozen depth-60 reference suite."""
import hashlib
import json
from fractions import Fraction as Fraction
from pathlib import Path
import sys


SUITE_PATH = Path(sys.argv[1]) if len(sys.argv) == 2 else Path("apps/api/data/suites/depth60-v1.json")


def rational(value):
    return Fraction(value)


def evaluate(expression, x):
    operation = expression["op"]
    if operation == "variable":
        return x
    if operation == "constant":
        return rational(expression["value"])
    if operation == "add":
        return evaluate(expression["left"], x) + evaluate(expression["right"], x)
    if operation == "multiply":
        return evaluate(expression["left"], x) * evaluate(expression["right"], x)
    if operation == "max":
        return max(evaluate(expression["left"], x), evaluate(expression["right"], x))
    if operation == "min":
        return min(evaluate(expression["left"], x), evaluate(expression["right"], x))
    if operation == "negate":
        return -evaluate(expression["arg"], x)
    if operation == "square":
        return evaluate(expression["arg"], x) ** 2
    if operation == "abs":
        return abs(evaluate(expression["arg"], x))
    raise ValueError(f"Unsupported operation {operation!r}")


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


def leaves(expression, operation):
    if expression["op"] != operation:
        return [expression]
    return leaves(expression["left"], operation) + leaves(expression["right"], operation)


def affine(expression):
    operation = expression["op"]
    if operation == "constant":
        return Fraction(0), rational(expression["value"])
    if operation == "variable":
        return Fraction(1), Fraction(0)
    if operation == "add":
        left_slope, left_offset = affine(expression["left"])
        right_slope, right_offset = affine(expression["right"])
        return left_slope + right_slope, left_offset + right_offset
    if operation == "multiply":
        left, right = expression["left"], expression["right"]
        if left["op"] == "constant" and right["op"] == "variable":
            return rational(left["value"]), Fraction(0)
        if right["op"] == "constant" and left["op"] == "variable":
            return rational(right["value"]), Fraction(0)
    raise ValueError("Expected an affine expression")


def unwrap(expression):
    # Expected form: a * core + (b * x + c).
    assert expression["op"] == "add"
    scaled, affine_term = expression["left"], expression["right"]
    assert scaled["op"] == "multiply" and scaled["left"]["op"] == "constant"
    scale = rational(scaled["left"]["value"])
    slope, offset = affine(affine_term)
    return scale, scaled["right"], slope, offset


def fraction_text(value):
    return str(value.numerator) if value.denominator == 1 else f"{value.numerator}/{value.denominator}"


def check_envelope(envelope, scale, affine_slope, direction=None):
    operation = envelope["op"]
    assert operation in ("max", "min")
    lines = [affine(line) for line in leaves(envelope, operation)]
    boundaries = []
    for (slope, offset), (next_slope, next_offset) in zip(lines, lines[1:]):
        assert slope != next_slope
        boundaries.append((next_offset - offset) / (slope - next_slope))
    assert all(Fraction(-1) < point < Fraction(1) for point in boundaries)
    assert all(left < right for left, right in zip(boundaries, boundaries[1:]))
    intervals = zip([Fraction(-1)] + boundaries, boundaries + [Fraction(1)])
    for index, (left, right) in enumerate(intervals):
        point = (left + right) / 2
        values = [slope * point + offset for slope, offset in lines]
        selected = max(values) if operation == "max" else min(values)
        assert values[index] == selected and values.count(selected) == 1
    slopes = [scale * slope + affine_slope for slope, _ in lines]
    if direction == "increasing":
        assert all(left < right for left, right in zip(slopes, slopes[1:]))
    if direction == "decreasing":
        assert all(left > right for left, right in zip(slopes, slopes[1:]))
    return operation, len(lines), slopes


def review_case(case):
    expression = case["reference"]["expression"]
    depth, node_count = shape(expression)
    assert depth == case["depth"] == 60
    scale, core, affine_slope, _ = unwrap(expression)
    review = {
        "id": case["id"],
        "depth": depth,
        "nodeCount": node_count,
        "label": case["label"],
    }
    if case["label"] == "convex":
        operation, count, slopes = check_envelope(core, scale, affine_slope, "increasing")
        review.update({"envelope": operation, "activePieces": count,
                       "piecewiseSlopes": [fraction_text(slopes[0]), fraction_text(slopes[-1])]})
    elif case["label"] == "concave":
        operation, count, slopes = check_envelope(core, scale, affine_slope, "decreasing")
        review.update({"envelope": operation, "activePieces": count,
                       "piecewiseSlopes": [fraction_text(slopes[0]), fraction_text(slopes[-1])]})
    else:
        assert core["op"] == "multiply" and core["left"]["op"] == "variable"
        operation, count, _ = check_envelope(core["right"], Fraction(1), Fraction(0))
        gaps = []
        for pair in case["reference"]["witnessPairs"]:
            x, y = rational(pair["x"]), rational(pair["y"])
            midpoint = (x + y) / 2
            gap = evaluate(expression, midpoint) - (evaluate(expression, x) + evaluate(expression, y)) / 2
            gaps.append(fraction_text(gap))
        assert any(rational(gap) > 0 for gap in gaps) and any(rational(gap) < 0 for gap in gaps)
        review.update({"envelope": operation, "activePieces": count, "jensenGaps": gaps})
    return review


raw = SUITE_PATH.read_bytes()
suite = json.loads(raw)
cases = [review_case(case) for case in suite["cases"]]
assert len(cases) == 9
print(json.dumps({
    "suiteFileSha256": hashlib.sha256(raw).hexdigest(),
    "verdict": "pass",
    "cases": cases,
    "reviewer": "AI-assisted independent mathematical check",
    "limitations": [
        "This independently recomputes exact rational structure, envelope activity, slope monotonicity, and retained Jensen witnesses; it is not a formal proof-assistant derivation.",
        "It is tailored to the retained exact-envelope construction and is not a general symbolic equivalence or curvature prover.",
        "It establishes reference-label and structural evidence only; it does not establish model behavior, population-level difficulty, or a causal depth effect."
    ],
}, indent=2))
