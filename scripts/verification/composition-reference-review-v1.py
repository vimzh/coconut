"""Independently review the frozen composition suite with exact rational arithmetic."""

from __future__ import annotations

import copy
import hashlib
import json
import sys
from dataclasses import dataclass
from fractions import Fraction
from pathlib import Path


SOURCE = Path(sys.argv[1]) if len(sys.argv) == 2 else Path("apps/api/data/suites/composition-v1.json")
OUTPUT = Path("apps/api/data/quality/composition-reference-review-v1.json")
FAMILIES = {
    "quadratic-chain": lambda stages: ("Q",) * stages,
    "quadratic-reciprocal-chain": lambda stages: tuple("Q" if index % 2 == 0 else "R" for index in range(stages)),
    "reciprocal-quadratic-chain": lambda stages: tuple("R" if index % 2 == 0 else "Q" for index in range(stages)),
}
STAGES = (2, 4, 6)
LABELS = ("convex", "concave", "neither")
POINTS = (Fraction(-1), Fraction(-3, 4), Fraction(3, 4), Fraction(1))


@dataclass(frozen=True)
class Jet:
    value: Fraction
    first: Fraction
    second: Fraction
    third: Fraction


def fail(message: str) -> None:
    raise ValueError(message)


def fraction(value: object) -> Fraction:
    if not isinstance(value, str):
        fail("Expected an exact rational string.")
    try:
        return Fraction(value)
    except (ValueError, ZeroDivisionError) as error:
        raise ValueError("Invalid rational literal.") from error


def fields(node: object, expected: set[str]) -> dict[str, object]:
    if not isinstance(node, dict) or set(node) != expected:
        fail("Unexpected AST node shape.")
    return node


def is_constant(node: object, expected: Fraction) -> bool:
    return isinstance(node, dict) and set(node) == {"op", "value"} and node["op"] == "constant" and fraction(node["value"]) == expected


def is_variable(node: object) -> bool:
    return isinstance(node, dict) and node == {"op": "variable"}


def jet(node: object, x: Fraction) -> Jet:
    data = fields(node, set(node) if isinstance(node, dict) else set())
    op = data.get("op")
    if op == "variable":
        fields(data, {"op"})
        return Jet(x, Fraction(1), Fraction(0), Fraction(0))
    if op == "constant":
        fields(data, {"op", "value"})
        return Jet(fraction(data["value"]), Fraction(0), Fraction(0), Fraction(0))
    if op == "negate":
        fields(data, {"op", "arg"})
        child = jet(data["arg"], x)
        return Jet(-child.value, -child.first, -child.second, -child.third)
    if op == "square":
        fields(data, {"op", "arg"})
        child = jet(data["arg"], x)
        return multiply(child, child)
    if op not in ("add", "multiply", "divide"):
        fail("Unexpected operation in composition AST.")
    fields(data, {"op", "left", "right"})
    left, right = jet(data["left"], x), jet(data["right"], x)
    if op == "add":
        return Jet(left.value + right.value, left.first + right.first, left.second + right.second, left.third + right.third)
    if op == "multiply":
        return multiply(left, right)
    return multiply(left, inverse(right))


def multiply(left: Jet, right: Jet) -> Jet:
    return Jet(
        left.value * right.value,
        left.first * right.value + left.value * right.first,
        left.second * right.value + 2 * left.first * right.first + left.value * right.second,
        left.third * right.value + 3 * left.second * right.first + 3 * left.first * right.second + left.value * right.third,
    )


def inverse(value: Jet) -> Jet:
    if value.value == 0:
        fail("Composition AST divides by zero at an audited point.")
    return Jet(
        1 / value.value,
        -value.first / value.value**2,
        2 * value.first**2 / value.value**3 - value.second / value.value**2,
        -6 * value.first**3 / value.value**4 + 6 * value.first * value.second / value.value**3 - value.third / value.value**2,
    )


def measure(node: object) -> tuple[int, int]:
    data = fields(node, set(node) if isinstance(node, dict) else set())
    op = data.get("op")
    if op in ("variable", "constant"):
        fields(data, {"op"} if op == "variable" else {"op", "value"})
        return 0, 1
    if op in ("negate", "square"):
        fields(data, {"op", "arg"})
        depth, nodes = measure(data["arg"])
        return depth + 1, nodes + 1
    if op in ("add", "multiply", "divide"):
        fields(data, {"op", "left", "right"})
        left_depth, left_nodes = measure(data["left"])
        right_depth, right_nodes = measure(data["right"])
        return 1 + max(left_depth, right_depth), 1 + left_nodes + right_nodes
    fail("Unexpected operation in composition AST.")


def parse_chain(node: object) -> tuple[tuple[str, ...], object]:
    atoms: list[str] = []
    while not is_variable(node):
        if isinstance(node, dict) and node.get("op") == "divide" and set(node) == {"op", "left", "right"}:
            left, right = node["left"], node["right"]
            if isinstance(left, dict) and left.get("op") == "square" and set(left) == {"op", "arg"} and is_constant(right, Fraction(16)):
                add = left["arg"]
                if isinstance(add, dict) and add.get("op") == "add" and set(add) == {"op", "left", "right"} and is_constant(add["right"], Fraction(2)):
                    atoms.append("Q")
                    node = add["left"]
                    continue
            if is_constant(left, Fraction(1)) and isinstance(right, dict) and right.get("op") == "add" and set(right) == {"op", "left", "right"} and is_constant(right["left"], Fraction(4)):
                negative = right["right"]
                if isinstance(negative, dict) and negative.get("op") == "negate" and set(negative) == {"op", "arg"}:
                    atoms.append("R")
                    node = negative["arg"]
                    continue
        fail("The core is not a canonical Q/R chain.")
    return tuple(reversed(atoms)), node


def parse_case_expression(node: object) -> tuple[tuple[str, ...], Fraction]:
    root = fields(node, {"op", "left", "right"})
    if root["op"] != "add":
        fail("Composition function must have the shared additive outer form.")
    penalty = root["right"]
    if not isinstance(penalty, dict) or penalty.get("op") != "multiply" or set(penalty) != {"op", "left", "right"}:
        fail("Composition function has an unexpected curvature penalty.")
    coefficient = penalty["left"]
    square = penalty["right"]
    if not isinstance(coefficient, dict) or not is_constant(coefficient, fraction(coefficient.get("value"))) or not isinstance(square, dict) or square.get("op") != "square" or set(square) != {"op", "arg"} or not is_variable(square["arg"]):
        fail("Composition function must use -a*x^2 exactly.")
    a = -fraction(coefficient["value"])
    if a <= 0:
        fail("The curvature penalty must have positive a.")
    atoms, terminal = parse_chain(root["left"])
    if not is_variable(terminal):
        fail("Q/R chain must terminate in x.")
    return atoms, a


def chain_jet(atoms: tuple[str, ...], x: Fraction) -> Jet:
    result = Jet(x, Fraction(1), Fraction(0), Fraction(0))
    for atom in atoms:
        if atom == "Q":
            shift = result.value + 2
            outer = Jet(shift**2 / 16, shift / 8, Fraction(1, 8), Fraction(0))
        else:
            shift = 4 - result.value
            outer = Jet(1 / shift, 1 / shift**2, 2 / shift**3, 6 / shift**4)
        result = Jet(
            outer.value,
            outer.first * result.first,
            outer.second * result.first**2 + outer.first * result.second,
            outer.third * result.first**3 + 3 * outer.second * result.first * result.second + outer.first * result.third,
        )
    return result


def image_and_derivative_theorem(atoms: tuple[str, ...]) -> list[dict[str, str | int]]:
    minimum, maximum = Fraction(-1), Fraction(1)
    first_positive, second_positive, third_positive = True, False, False
    proof: list[dict[str, str | int]] = []
    for stage, atom in enumerate(atoms, 1):
        if not (-1 <= minimum <= maximum <= 1):
            fail("An intermediate image escapes the proved atom domain.")
        if atom == "Q":
            next_minimum, next_maximum = (minimum + 2) ** 2 / 16, (maximum + 2) ** 2 / 16
        else:
            next_minimum, next_maximum = 1 / (4 - minimum), 1 / (4 - maximum)
        # Q', Q'', R', R'', and R''' are strictly positive on [-1,1]; Q''' is zero.
        if not first_positive or not (atom in ("Q", "R")):
            fail("Positive derivative induction failed.")
        next_second_positive = True
        # In (g\u2218h)''' = g'''h'^3 + 3g''h'h'' + g'h''', every
        # summand is nonnegative, and 3g''h'h'' is positive from stage two.
        next_third_positive = second_positive
        if stage >= 2 and not next_third_positive:
            fail("The strict third-derivative induction failed.")
        proof.append({"stage": stage, "atom": atom, "imageMin": str(next_minimum), "imageMax": str(next_maximum), "firstPositive": "true", "secondPositive": "true", "thirdPositive": "true" if next_third_positive else "nonnegative"})
        minimum, maximum = next_minimum, next_maximum
        second_positive, third_positive = next_second_positive, next_third_positive
    if len(atoms) < 2 or not third_positive:
        fail("Every admitted chain must have at least two stages and H''' > 0.")
    return proof


def canonical(value: object) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"))


def review(suite: object, suite_file_sha256: str) -> dict[str, object]:
    if not isinstance(suite, dict):
        fail("Suite must be an object.")
    if suite.get("formatVersion") != "2" or suite.get("generatorVersion") != "composition-v1" or suite.get("depthPolicyVersion") != "nonlinear-chain-and-ast-v1" or suite.get("independentReferencePolicy") != "exact-atom-chain-v1":
        fail("Unexpected composition suite identity.")
    cases = suite.get("cases")
    if not isinstance(cases, list) or len(cases) != 27:
        fail("Composition suite must contain exactly 27 cases.")
    seen_expressions: set[str] = set()
    clusters: dict[str, list[dict[str, object]]] = {}
    records: list[dict[str, object]] = []
    coefficient_ranges: dict[str, list[Fraction]] = {label: [] for label in LABELS}
    for case in cases:
        if not isinstance(case, dict):
            fail("Case must be an object.")
        reference = case.get("reference")
        if not isinstance(reference, dict) or reference.get("domain") != {"min": "-1", "max": "1"}:
            fail("Composition domains must be exactly [-1,1].")
        label = reference.get("claimedLabel")
        if label not in LABELS or case.get("label") != label:
            fail("Case label does not match its reference.")
        family, stages = case.get("family"), case.get("stageCount")
        if family not in FAMILIES or stages not in STAGES:
            fail("Unexpected composition family or stage count.")
        atoms, a = parse_case_expression(reference.get("expression"))
        if atoms != FAMILIES[family](stages) or tuple(case.get("atoms", ())) != atoms:
            fail("The retained atom sequence does not match its family/stage declaration.")
        theorem = image_and_derivative_theorem(atoms)
        depth, nodes = measure(reference["expression"])
        if depth != 3 * stages + 1 or case.get("depth") != depth:
            fail("Composition depth does not match the canonical nonlinear chain shape.")
        certificate = case.get("certificate")
        if not isinstance(certificate, dict) or certificate.get("depth") != depth or certificate.get("nodeCount") != nodes:
            fail("Native certificate structure disagrees with the actual AST.")
        expression_key = canonical(reference["expression"])
        if expression_key in seen_expressions:
            fail("Two retained cases have exactly duplicate expressions.")
        seen_expressions.add(expression_key)
        values: dict[str, Jet] = {}
        for point in POINTS:
            ast = jet(reference["expression"], point)
            chain = chain_jet(atoms, point)
            if ast.value != chain.value - a * point**2 or ast.first != chain.first - 2 * a * point or ast.second != chain.second - 2 * a or ast.third != chain.third:
                fail("Independent AST differentiation disagrees with the reconstructed chain.")
            if chain.first <= 0 or chain.second <= 0 or chain.third <= 0:
                fail("Exact point cross-check contradicts the global derivative theorem.")
            values[str(point)] = ast
        lower, left, right, upper = (values[str(point)].second for point in POINTS)
        if not (lower < left < right < upper):
            fail("Exact audited second derivatives do not increase across the retained points.")
        if label == "convex":
            if lower <= 0 or left <= 0:
                fail("Convex case lacks the global lower bound or strict interior witness.")
        elif label == "concave":
            if upper >= 0 or right >= 0:
                fail("Concave case lacks the global upper bound or strict interior witness.")
        elif not (left < 0 < right):
            fail("Neither case lacks strict exact interior witnesses.")
        analytic = case.get("analyticCertificate")
        if not isinstance(analytic, dict) or analytic.get("policy") != "exact-atom-chain-v1" or fraction(analytic.get("coefficient")) != a:
            fail("Analytic certificate is inconsistent with the AST.")
        expected_global = {"min": str(lower), "max": str(upper)}
        if analytic.get("globalSecond") != expected_global or analytic.get("witnesses") != [{"x": "-3/4", "second": str(left)}, {"x": "3/4", "second": str(right)}]:
            fail("Analytic certificate does not retain independently recomputed bounds/witnesses.")
        cluster = case.get("clusterId")
        if not isinstance(cluster, str):
            fail("Cluster identity is missing.")
        clusters.setdefault(cluster, []).append(case)
        coefficient_ranges[label].append(a)
        records.append({"caseId": case.get("id"), "clusterId": cluster, "family": family, "stageCount": stages, "atoms": list(atoms), "depth": depth, "nodeCount": nodes, "label": label, "coefficient": str(a), "globalSecond": expected_global, "witnesses": [{"x": "-3/4", "second": str(left)}, {"x": "3/4", "second": str(right)}], "theorem": theorem})
    if len(clusters) != 9 or any(len(rows) != 3 or {row["label"] for row in rows} != set(LABELS) for rows in clusters.values()):
        fail("Each of nine composition clusters must contain one case of every label.")
    expected_strata = {(family, stages) for family in FAMILIES for stages in STAGES}
    if {(case["family"], case["stageCount"]) for case in cases} != expected_strata:
        fail("Composition family/stage coverage is incomplete.")
    ranges = {label: {"min": str(min(values)), "max": str(max(values))} for label, values in coefficient_ranges.items()}
    overlaps = {f"{left}/{right}": not (max(coefficient_ranges[left]) < min(coefficient_ranges[right]) or max(coefficient_ranges[right]) < min(coefficient_ranges[left])) for index, left in enumerate(LABELS) for right in LABELS[index + 1 :]}
    return {"version": "1", "review": "independent-exact-fraction", "suiteId": suite.get("id"), "suiteFileSha256": suite_file_sha256, "verdict": "pass", "theorem": "Each atom preserves [-1,1]; Q' and Q'' are positive with Q'''=0, while R', R'', and R''' are positive. Chain-rule induction gives H'>0 and H''>0 after one stage, and H'''>0 after the second; therefore H'' is strictly increasing globally. Endpoint bounds and the retained interior values classify H-a*x^2.", "caseCount": len(records), "clusterCount": len(clusters), "cases": records, "structuralChecks": {"canonicalAtomChains": True, "noAdjacentCancellationOrPadding": True, "exactExpressionDuplicates": False}, "coefficientCueAudit": {"ranges": ranges, "pairwiseRangeOverlap": overlaps, "interpretation": "Range overlap is a limited lexical-cue audit, not proof that no label shortcut exists."}}


def self_test(suite: object) -> None:
    altered = copy.deepcopy(suite)
    altered["cases"][0]["reference"]["expression"]["right"]["left"]["value"] = "0"
    try:
        review(altered, "0" * 64)
    except ValueError:
        return
    fail("Tamper self-test did not reject an altered coefficient.")


def main() -> None:
    source_text = SOURCE.read_text()
    suite = json.loads(source_text)
    self_test(suite)
    evidence = review(suite, hashlib.sha256(source_text.encode()).hexdigest())
    if OUTPUT.exists():
        if json.loads(OUTPUT.read_text()) != evidence:
            fail(f"Retained review differs from reproduction: {OUTPUT}.")
    else:
        OUTPUT.write_text(json.dumps(evidence, indent=2) + "\n")
    print(json.dumps({"verdict": evidence["verdict"], "caseCount": evidence["caseCount"], "output": str(OUTPUT)}))


if __name__ == "__main__":
    main()
