"""Regression checks for exact scalar parsing, domain proofs and strict reference evidence."""

import unittest
from fractions import Fraction

from import_reference import certify_import
from import_syntax import ImportFailure, exact_number, parse_expression


def certify(expression, label, minimum="-1", maximum="1"):
    return certify_import({"expression": expression, "label": label,
                           "domain": {"min": minimum, "max": maximum}})


class ImportedReferenceTests(unittest.TestCase):
    def test_exact_literals_and_no_executable_syntax(self):
        parsed = parse_expression("1.25e-2*x+0.125")
        self.assertEqual(parsed.nodes[0].value, Fraction(1, 80))
        self.assertEqual(exact_number("-0.125"), Fraction(-1, 8))
        for expression in ["__import__('os')", "x;exit()", r"\input{secret}", "x[0]"]:
            with self.assertRaises(ImportFailure):
                parse_expression(expression)
        with self.assertRaises(ImportFailure):
            exact_number("1e999999999")

    def test_ambiguous_latex_literals_and_brackets_are_rejected(self):
        for expression in ["(x^2-1 2)^2", "1.2.3*x^2", r"\exp{x)", "(x+1}"]:
            with self.subTest(expression=expression):
                result = certify(expression, "neither")
                self.assertEqual(result["status"], "rejected", result)

    def test_precedence_scalar_norms_and_power(self):
        self.assertEqual(certify("-x^2", "concave")["status"], "verified")
        self.assertEqual(certify("(-x)^2", "convex")["status"], "verified")
        for norm in [r"\|x\|_1", r"\|x\|_2", r"\|x\|_\infty"]:
            result = certify(norm, "convex")
            self.assertEqual(result["status"], "verified", result)
            self.assertEqual(result["proof"]["strictExclusion"], "strict-Jensen-gap")
        self.assertEqual(certify("(x+2)^{0.625}", "concave")["status"], "verified")
        self.assertEqual(certify("x^3", "neither")["status"], "rejected")

    def test_strictness_and_affine_overlap(self):
        for expression, label in [("x^2", "convex"), (r"-\exp(x)", "concave"),
                                  (r"\log(1+\exp(x))", "convex"),
                                  (r"\sqrt{x+2}", "concave")]:
            result = certify(expression, label)
            self.assertEqual(result["status"], "verified", result)
            self.assertEqual(result["proof"]["strictExclusion"], "strict-composition")
        for expression in ["0*x+1", r"\max(0,x-2)", r"\log(\exp(x))"]:
            result = certify(expression, "convex")
            self.assertEqual(result["status"], "rejected", result)
            self.assertEqual(result["reason"], "affine-overlap")

    def test_closed_interval_domain_and_opposite_label(self):
        self.assertNotEqual(certify(r"\log(x)", "concave")["status"], "verified")
        self.assertNotEqual(certify(r"\sqrt{x}", "concave")["status"], "verified")
        self.assertEqual(certify(r"\log(x)", "concave", "1", "2")["status"], "verified")
        self.assertNotEqual(certify("x^2", "concave")["status"], "verified")
        self.assertNotEqual(certify("x^2", "neither")["status"], "verified")

    def test_constant_scaling_preserves_every_original_operand_domain(self):
        undefined_constants = ["0*log(-1)+1", "0*sqrt(-1)+1", "0*(1/0)+1"]
        for constant in undefined_constants:
            for expression in [f"({constant})*x^2", f"x^2*({constant})",
                               f"x^2/({constant})"]:
                with self.subTest(expression=expression):
                    result = certify(expression, "convex")
                    self.assertNotEqual(result["status"], "verified", result)
                    self.assertEqual(result["reason"], "unresolved-domain")

    def test_log_exp_shortcuts_preserve_original_domains(self):
        expressions = ["exp(log(0*log(-1)+1))*x^2",
                       "log(exp(0*sqrt(-1)+1))*x^2",
                       "log(exp(x^2)+exp(0*log(-1)))",
                       "exp(log(x^2/(0*(1/0)+1)))"]
        for expression in expressions:
            with self.subTest(expression=expression):
                result = certify(expression, "convex")
                self.assertNotEqual(result["status"], "verified", result)
                self.assertEqual(result["reason"], "unresolved-domain")

    def test_neither_requires_two_strict_rational_witnesses(self):
        result = certify("x*x^2", "neither")
        self.assertEqual(result["status"], "verified", result)
        self.assertEqual({w["direction"] for w in result["proof"]["witnesses"]},
                         {"not-convex", "not-concave"})
        self.assertTrue(all(w["t"] == "1/2" for w in result["proof"]["witnesses"]))
        self.assertEqual(certify("x*x^2", "neither", "0", "1")["status"], "unverified")

    def test_rounded_literals_define_the_proved_task(self):
        result = certify("0.001*x^2-0.001*x^2+x", "convex")
        self.assertNotEqual(result["status"], "verified")
        exact = certify("0.001*x^2", "convex")
        self.assertEqual(exact["status"], "verified")
        self.assertNotEqual(exact["expressionSha256"],
                            certify("0.002*x^2", "convex")["expressionSha256"])

    def test_deep_postorder_policy_preserves_native_limits(self):
        expression = "x^2"
        for _ in range(216):
            expression = f"1.01*({expression})+0.01"
        result = certify(expression, "convex")
        self.assertEqual(result["status"], "verified", result)
        self.assertGreater(result["astDepth"], 32)
        self.assertGreater(result["nodeCount"], 256)
        self.assertTrue(result["coreHashes"])
        with self.assertRaises(ImportFailure):
            parse_expression("(" * 4097 + "x" + ")" * 4097)
        with self.assertRaises(ImportFailure):
            parse_expression("x" * 131073)

    def test_exact_affine_growth_has_an_explicit_work_boundary(self):
        expression = "x"
        factor = "1" + "0" * 90
        for _ in range(20):
            expression = f"{factor}*({expression})+1"
        result = certify(expression, "convex")
        self.assertEqual(result["status"], "unverified", result)
        self.assertEqual(result["reason"], "exact-arithmetic-limit")
        self.assertGreater(result["nodeCount"], 20)


if __name__ == "__main__":
    unittest.main()
