"""Independent algebraic, domain, resource, and subprocess checks for certification."""

import copy
import json
import subprocess
import sys
import unittest
from fractions import Fraction
from itertools import combinations
from pathlib import Path
from unittest.mock import patch

from flint import ctx, fmpq

from certification import BACKEND, PRECISION, certify
from expressions import parse_reference, rational
from intervals import Interval
from jets import Evaluator

WORKER = Path(__file__).with_name("worker.py")
X = {"op": "variable"}


def constant(value):
    return {"op": "constant", "value": str(value)}


def unary(op, arg):
    return {"op": op, "arg": arg}


def binary(op, left, right):
    return {"op": op, "left": left, "right": right}


def reference(expression, label="convex", minimum="-1", maximum="1"):
    return {
        "expression": expression,
        "domain": {"min": minimum, "max": maximum},
        "claimedLabel": label,
    }


def fractions(bounds):
    return Fraction(bounds["min"]), Fraction(bounds["max"])


class IntervalTests(unittest.TestCase):
    def setUp(self):
        self.precision = ctx.prec
        ctx.prec = PRECISION

    def tearDown(self):
        ctx.prec = self.precision

    def assertContains(self, enclosed, value):
        lower, upper = fractions(enclosed.bounds())
        self.assertLessEqual(lower, value)
        self.assertGreaterEqual(upper, value)

    def test_non_dyadic_values_are_enclosed_without_decimal_conversion(self):
        value = Interval.point(fmpq(1, 3))
        self.assertContains(value, Fraction(1, 3))
        self.assertNotEqual(value.lo, value.hi)
        self.assertTrue(all("." not in item for item in value.bounds().values()))

    def test_signed_arithmetic_encloses_independent_corner_values(self):
        left = Interval.rational_range(fmpq(-3, 2), fmpq(2, 3))
        right = Interval.rational_range(fmpq(1, 4), fmpq(7, 5))
        for a in (Fraction(-3, 2), Fraction(2, 3)):
            for b in (Fraction(1, 4), Fraction(7, 5)):
                self.assertContains(left + right, a + b)
                self.assertContains(left - right, a - b)
                self.assertContains(left * right, a * b)
                self.assertContains(left / right, a / b)

    def test_square_preserves_zero_and_handles_negative_ranges(self):
        for lower, upper, expected in [(-2, 1, (0, 4)), (-3, -2, (4, 9)), (2, 3, (4, 9))]:
            actual = Interval.rational_range(fmpq(lower), fmpq(upper)).square()
            self.assertEqual(fractions(actual.bounds()), expected)

    def test_elementary_exact_values(self):
        self.assertEqual(Interval.point(0).exp().bounds(), {"min": "1", "max": "1"})
        self.assertEqual(Interval.point(1).log().bounds(), {"min": "0", "max": "0"})
        self.assertEqual(Interval.point(4).sqrt().bounds(), {"min": "2", "max": "2"})

    def test_exponential_enclosure_agrees_with_independent_rational_series(self):
        # For exp(1), the remaining factorial series is bounded by a geometric tail.
        factorial = 1
        total = Fraction(1)
        for k in range(1, 80):
            factorial *= k
            total += Fraction(1, factorial)
        tail = Fraction(1, factorial * 80) / (1 - Fraction(1, 81))
        lower, upper = fractions(Interval.point(1).exp().bounds())
        self.assertLessEqual(lower, total)
        self.assertGreaterEqual(upper, total + tail)

    def test_quotient_second_derivative_matches_exact_reference(self):
        expression = binary("divide", constant(1), binary("add", constant(1), X))
        jet = Evaluator().evaluate(expression, Interval.point(fmpq(1, 2)))
        self.assertContains(jet.value, Fraction(2, 3))
        self.assertContains(jet.first, Fraction(-4, 9))
        self.assertContains(jet.second, Fraction(16, 27))


class CertificationTests(unittest.TestCase):
    def assertVerified(self, source, label=None):
        result = certify(source)
        expected = label or source["claimedLabel"]
        self.assertEqual(result["status"], "verified", result)
        self.assertEqual(result["label"], expected)
        certificate = result["certificate"]
        self.assertEqual(certificate["backend"], BACKEND)
        self.assertEqual(certificate["precision"], 192)
        self.assertEqual(len(certificate["probes"]), 9)
        cover = certificate["cover"]
        self.assertEqual(cover[0]["min"], certificate["input"]["domain"]["min"])
        self.assertEqual(cover[-1]["max"], certificate["input"]["domain"]["max"])
        for previous, following in zip(cover, cover[1:]):
            self.assertEqual(previous["max"], following["min"])
        for cell in cover:
            lower, upper = fractions(cell["second"])
            self.assertLess(Fraction(cell["min"]), Fraction(cell["max"]))
            self.assertLessEqual(lower, upper)
            if expected == "convex":
                self.assertGreaterEqual(lower, 0)
            elif expected == "concave":
                self.assertLessEqual(upper, 0)
        for kind in (
            {"positive"}
            if expected == "convex"
            else {"negative"}
            if expected == "concave"
            else {"positive", "negative"}
        ):
            witness = certificate["witnesses"][kind]
            self.assertLess(Fraction(source["domain"]["min"]), Fraction(witness["x"]))
            self.assertLess(Fraction(witness["x"]), Fraction(source["domain"]["max"]))
            lower, upper = fractions(witness["second"])
            self.assertTrue(lower > 0 if kind == "positive" else upper < 0)
        return certificate

    def test_product_and_curvature_cancellation(self):
        self.assertVerified(reference(binary("multiply", X, X)))
        fourth = unary("square", unary("square", X))
        expression = binary("add", fourth, unary("negate", unary("square", X)))
        self.assertVerified(reference(expression, minimum="1", maximum="2"))

    def test_adaptive_cover_has_hand_derived_quarter_cell_bounds(self):
        inner = binary("add", unary("square", X), unary("negate", X))
        expression = binary("add", unary("square", inner), unary("square", X))
        certificate = self.assertVerified(reference(expression, minimum="0", maximum="1"))
        self.assertGreater(len(certificate["cover"]), 1)
        with ctx.workprec(PRECISION):
            evaluator = Evaluator()
            lower_bounds = [
                evaluator.evaluate(
                    expression, Interval.rational_range(fmpq(k, 4), fmpq(k + 1, 4))
                ).second.bounds()["min"]
                for k in range(4)
            ]
        self.assertEqual(lower_bounds, ["3/2", "1/4", "0", "3/4"])

    def test_elementary_families(self):
        exp_difference = binary("add", unary("exp", X), unary("negate", unary("square", X)))
        square_plus_one = binary("add", constant(1), unary("square", X))
        cases = [
            reference(exp_difference, minimum="1", maximum="2"),
            reference(exp_difference, label="neither"),
            reference(unary("log", square_plus_one), minimum="-1/2", maximum="1/2"),
            reference(unary("sqrt", square_plus_one)),
            reference(unary("sqrt", X), "concave", "1", "4"),
            reference(unary("log", X), "concave", "1", "2"),
            reference(unary("negate", unary("exp", X)), label="concave"),
        ]
        for source in cases:
            with self.subTest(expression=source["expression"], label=source["claimedLabel"]):
                self.assertVerified(source)

    def test_neither_derivative_witnesses_include_complete_domain_cover(self):
        self.assertVerified(reference(binary("multiply", X, unary("square", X)), "neither"))

    def test_narrow_reversal_missed_by_all_existing_grid_pairs(self):
        a, epsilon = Fraction(1, 8), Fraction(1, 10000)

        def function(x):
            return (x - a) ** 4 - epsilon * (x - a) ** 2

        grid = [Fraction(-1) + Fraction(k, 4) for k in range(9)]
        self.assertTrue(
            all(
                function((x + y) / 2) < (function(x) + function(y)) / 2
                for x, y in combinations(grid, 2)
            )
        )
        h = Fraction(1, 1000)
        self.assertEqual(
            function(a) - (function(a - h) + function(a + h)) / 2, Fraction(99, 10**12)
        )
        centered = binary("add", X, constant("-1/8"))
        square = unary("square", centered)
        expression = binary(
            "add", unary("square", square), binary("multiply", constant("-1/10000"), square)
        )
        certificate = self.assertVerified(reference(expression, "neither"))
        self.assertEqual(certificate["witnesses"]["negative"]["x"], "1/8")

    def test_nonsmooth_downward_kink_is_not_given_a_smooth_proof(self):
        a, epsilon = Fraction(1, 8), Fraction(1, 10000)

        def function(x):
            return x * x - epsilon * abs(x - a)

        h = epsilon / 2
        self.assertEqual(
            function(a) - (function(a - h) + function(a + h)) / 2, Fraction(1, 400000000)
        )
        expression = binary(
            "add",
            unary("square", X),
            unary("negate", unary("abs", binary("add", X, constant("-1/8")))),
        )
        self.assertEqual(
            certify(reference(expression)),
            {"status": "rejected", "reason": "unsupported-operation"},
        )

    def test_hidden_log_singularity_is_rejected(self):
        centered = binary("add", X, constant("-1/16"))
        result = certify(reference(unary("log", unary("square", centered))))
        self.assertEqual(result, {"status": "rejected", "reason": "invalid-domain"})

    def test_square_root_boundary_is_explicitly_unverified(self):
        self.assertEqual(
            certify(reference(unary("sqrt", X), "concave", "0", "1")),
            {"status": "unverified", "reason": "non-smooth-boundary"},
        )

    def test_division_signs_and_nonzero_domain(self):
        denominator = binary("add", constant(2), X)
        self.assertVerified(reference(binary("divide", constant(1), denominator)))
        self.assertVerified(reference(binary("divide", constant(-1), denominator), "concave"))
        self.assertEqual(
            certify(reference(binary("divide", constant(1), X))),
            {"status": "rejected", "reason": "invalid-domain"},
        )
        hidden = binary("add", X, constant("-1/16"))
        self.assertEqual(
            certify(reference(binary("divide", constant(1), hidden))),
            {"status": "rejected", "reason": "invalid-domain"},
        )

    def test_invalid_elementary_domains(self):
        for expression in [unary("sqrt", constant(-1)), unary("log", constant(0))]:
            self.assertEqual(
                certify(reference(expression)), {"status": "rejected", "reason": "invalid-domain"}
            )

    def test_domain_enclosure_uncertainty_refines_instead_of_rejecting(self):
        # x²-x+1 is positive, although its first natural enclosure on [0,1] reaches zero.
        argument = binary("add", binary("add", unary("square", X), unary("negate", X)), constant(1))
        self.assertVerified(reference(unary("log", argument), minimum="0", maximum="1"))

    def test_affine_overlap_and_exact_cancellation(self):
        for expression in [
            X,
            constant("1/3"),
            binary("add", unary("square", X), unary("negate", unary("square", X))),
        ]:
            self.assertEqual(
                certify(reference(expression)),
                {"status": "excluded", "reason": "overlapping-labels"},
            )

    def test_claimed_label_does_not_control_classification(self):
        self.assertEqual(
            certify(reference(unary("square", X), "concave")),
            {"status": "rejected", "reason": "label-mismatch"},
        )

    def test_recomputation_is_identical_and_rejects_modified_evidence_by_comparison(self):
        source = reference(unary("exp", X))
        expected = certify(source)
        self.assertEqual(expected, certify(json.loads(json.dumps(source))))
        modified = copy.deepcopy(expected)
        modified["certificate"]["cover"][0]["second"]["min"] = "0"
        self.assertNotEqual(certify(source), modified)

    def test_precision_context_is_restored(self):
        original = ctx.prec
        certify(reference(unary("exp", X)))
        self.assertEqual(ctx.prec, original)

    def test_cell_and_node_budgets_never_yield_a_label(self):
        inner = binary("add", unary("square", X), unary("negate", X))
        expression = binary("add", unary("square", inner), unary("square", X))
        with patch("certification.MAX_CELLS", 1):
            self.assertEqual(
                certify(reference(expression, minimum="0", maximum="1")),
                {"status": "unverified", "reason": "resource-limit"},
            )
        with patch("jets.MAX_NODE_EVALUATIONS", 1):
            self.assertEqual(
                certify(reference(unary("square", X))),
                {"status": "unverified", "reason": "resource-limit"},
            )

    def test_huge_values_are_limited_before_rational_serialization(self):
        expression = constant(10)
        for _ in range(20):
            expression = unary("square", expression)
        self.assertEqual(
            certify(reference(expression)), {"status": "unverified", "reason": "resource-limit"}
        )
        self.assertEqual(
            certify(reference(unary("exp", constant(257)))),
            {"status": "unverified", "reason": "resource-limit"},
        )


class InputTests(unittest.TestCase):
    def test_canonical_signed_literals(self):
        for raw, expected in [("-0.125", "-1/8"), ("+2/-4", "-1/2"), ("0002", "2")]:
            self.assertEqual(str(rational(raw)), expected)
        parsed = parse_reference(reference(constant("0.25"), minimum="-1.0", maximum="1.0"))
        self.assertEqual(parsed.canonical["expression"]["value"], "1/4")
        self.assertEqual(parsed.depth, 0)
        self.assertEqual(parsed.nodes, 1)

    def test_bad_literals_and_domains(self):
        for value in [1, True, " 1", "1e2", "1/0", ".5", "0.", "∞", "1" * 97]:
            with self.subTest(value=value):
                self.assertEqual(
                    certify(reference({"op": "constant", "value": value})),
                    {"status": "rejected", "reason": "invalid-input"},
                )
        for minimum, maximum in [("1", "1"), ("2", "1")]:
            self.assertEqual(
                certify(reference(X, minimum=minimum, maximum=maximum)),
                {"status": "rejected", "reason": "invalid-domain"},
            )

    def test_unknown_fields_operators_cycles_and_structural_limits(self):
        source = reference(X)
        source["evidence"] = {}
        self.assertEqual(certify(source), {"status": "rejected", "reason": "invalid-input"})
        self.assertEqual(
            certify(reference({"op": "max", "left": X, "right": constant(0)})),
            {"status": "rejected", "reason": "unsupported-operation"},
        )
        cycle = {"op": "square"}
        cycle["arg"] = cycle
        self.assertEqual(
            certify(reference(cycle)), {"status": "rejected", "reason": "invalid-input"}
        )
        expression = X
        for _ in range(33):
            expression = unary("negate", expression)
        self.assertEqual(
            certify(reference(expression)), {"status": "unverified", "reason": "resource-limit"}
        )
        expression = X
        for _ in range(8):
            expression = binary("add", expression, expression)
        self.assertEqual(
            certify(reference(expression)), {"status": "unverified", "reason": "resource-limit"}
        )


class WorkerTests(unittest.TestCase):
    def run_worker(self, text):
        return subprocess.run(
            [sys.executable, "-I", str(WORKER)],
            input=text,
            text=True,
            capture_output=True,
            check=False,
            timeout=10,
            cwd="/",
        )

    def test_isolated_process_batch_and_backend_identity(self):
        request = {
            "action": "certify",
            "references": [reference(unary("exp", X)), reference(unary("sqrt", constant(-1)))],
        }
        result = self.run_worker(json.dumps(request))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stderr, "")
        output = json.loads(result.stdout)
        self.assertEqual(output["backend"], BACKEND)
        self.assertEqual([item["status"] for item in output["results"]], ["verified", "rejected"])

    def test_invalid_batch_input_exits_without_success_output(self):
        cases = [
            "",
            "{}",
            '{"action":"certify","references":[],"extra":1}',
            '{"action":"certify","references":[]}',
            '{"action":"certify","references":[],"action":"certify"}',
            '{"action":"certify","references":[NaN]}',
            json.dumps({"action": "certify", "references": [None] * 65}),
            " " * (2 * 1024 * 1024 + 1),
        ]
        for raw in cases:
            with self.subTest(length=len(raw)):
                result = self.run_worker(raw)
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual(result.stdout, "")
                self.assertIn("Invalid numerical worker request", result.stderr)

    def test_full_batch_boundary(self):
        request = {"action": "certify", "references": [reference(unary("square", X))] * 64}
        result = self.run_worker(json.dumps(request))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(len(json.loads(result.stdout)["results"]), 64)


if __name__ == "__main__":
    unittest.main()
