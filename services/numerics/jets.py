"""Second-order interval automatic differentiation under explicit domain checks."""

from dataclasses import dataclass

from intervals import CertificationFailure, Interval

MAX_NODE_EVALUATIONS = 200_000


@dataclass(frozen=True)
class Jet:
    value: Interval
    first: Interval
    second: Interval


class Evaluator:
    def __init__(self):
        self.evaluations = 0
        self.zero = Interval.point(0)
        self.one = Interval.point(1)
        self.two = Interval.point(2)
        self.four = Interval.point(4)

    def evaluate(self, node: dict, variable: Interval) -> Jet:
        self.evaluations += 1
        if self.evaluations > MAX_NODE_EVALUATIONS:
            raise CertificationFailure("unverified", "resource-limit")
        op = node["op"]
        if op == "variable":
            return Jet(variable, self.one, self.zero)
        if op == "constant":
            from flint import fmpq

            return Jet(Interval.point(fmpq(node["value"])), self.zero, self.zero)
        if op in ("negate", "square", "exp", "log", "sqrt"):
            child = self.evaluate(node["arg"], variable)
            value, first, second = child.value, child.first, child.second
            if op == "negate":
                return Jet(-value, -first, -second)
            if op == "square":
                return Jet(
                    value.square(),
                    self.two * value * first,
                    self.two * (first.square() + value * second),
                )
            if op == "exp":
                exponential = value.exp()
                return Jet(
                    exponential, exponential * first, exponential * (first.square() + second)
                )
            if op == "log":
                logarithm = value.log()
                return Jet(
                    logarithm, first / value, (second * value - first.square()) / value.square()
                )
            root = value.sqrt()
            return Jet(
                root,
                first / (self.two * root),
                (self.two * value * second - first.square()) / (self.four * value * root),
            )
        left = self.evaluate(node["left"], variable)
        right = self.evaluate(node["right"], variable)
        if op == "add":
            return Jet(
                left.value + right.value, left.first + right.first, left.second + right.second
            )
        if op == "divide":
            inverse = right.value.reciprocal()
            right = Jet(
                inverse,
                -right.first * inverse.square(),
                self.two * right.first.square() * inverse.square() * inverse
                - right.second * inverse.square(),
            )
        return Jet(
            left.value * right.value,
            left.first * right.value + left.value * right.first,
            left.second * right.value
            + self.two * left.first * right.first
            + left.value * right.second,
        )
