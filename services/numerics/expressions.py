"""Validate bounded smooth expression trees and preserve exact rational inputs."""

import re
from dataclasses import dataclass

from flint import fmpq

from intervals import CertificationFailure

MAX_DEPTH = 32
MAX_NODES = 256
MAX_LITERAL = 96
UNARY = {"negate", "square", "exp", "log", "sqrt"}
BINARY = {"add", "multiply", "divide"}
LITERAL = re.compile(r"[+-]?\d+(?:\.\d+)?|[+-]?\d+/[+-]?\d+", re.ASCII)


def fields(value: object, expected: set[str]) -> dict:
    if type(value) is not dict or set(value) != expected:
        raise CertificationFailure("rejected", "invalid-input")
    return value


def rational(value: object) -> fmpq:
    if type(value) is not str or len(value) > MAX_LITERAL:
        raise CertificationFailure("rejected", "invalid-input")
    if not LITERAL.fullmatch(value):
        raise CertificationFailure("rejected", "invalid-input")
    try:
        if "." in value:
            whole, fractional = value.split(".")
            result = fmpq(int(whole + fractional), 10 ** len(fractional))
        else:
            parts = value.split("/")
            result = fmpq(int(parts[0]), int(parts[1]) if len(parts) == 2 else 1)
    except (ValueError, ZeroDivisionError):
        raise CertificationFailure("rejected", "invalid-input") from None
    if len(str(result)) > MAX_LITERAL:
        raise CertificationFailure("unverified", "resource-limit")
    return result


@dataclass(frozen=True)
class ParsedReference:
    canonical: dict
    minimum: fmpq
    maximum: fmpq
    depth: int
    nodes: int


def parse_reference(raw: object) -> ParsedReference:
    source = fields(raw, {"expression", "domain", "claimedLabel"})
    if source["claimedLabel"] not in ("convex", "concave", "neither"):
        raise CertificationFailure("rejected", "invalid-input")
    domain = fields(source["domain"], {"min", "max"})
    minimum, maximum = rational(domain["min"]), rational(domain["max"])
    if minimum >= maximum:
        raise CertificationFailure("rejected", "invalid-domain")
    nodes = 0
    ancestors: set[int] = set()

    def visit(raw_node: object, level: int) -> tuple[dict, int]:
        nonlocal nodes
        nodes += 1
        if nodes > MAX_NODES or level > MAX_DEPTH:
            raise CertificationFailure("unverified", "resource-limit")
        if type(raw_node) is not dict or id(raw_node) in ancestors:
            raise CertificationFailure("rejected", "invalid-input")
        ancestors.add(id(raw_node))
        op = raw_node.get("op")
        if type(op) is not str:
            raise CertificationFailure("rejected", "invalid-input")
        if op == "variable":
            fields(raw_node, {"op"})
            result, depth = {"op": op}, 0
        elif op == "constant":
            fields(raw_node, {"op", "value"})
            result, depth = {"op": op, "value": str(rational(raw_node["value"]))}, 0
        elif op in UNARY:
            fields(raw_node, {"op", "arg"})
            child, depth = visit(raw_node["arg"], level + 1)
            result, depth = {"op": op, "arg": child}, depth + 1
        elif op in BINARY:
            fields(raw_node, {"op", "left", "right"})
            left, left_depth = visit(raw_node["left"], level + 1)
            right, right_depth = visit(raw_node["right"], level + 1)
            result = {"op": op, "left": left, "right": right}
            depth = max(left_depth, right_depth) + 1
        else:
            raise CertificationFailure("rejected", "unsupported-operation")
        ancestors.remove(id(raw_node))
        return result, depth

    expression, depth = visit(source["expression"], 0)
    return ParsedReference(
        {
            "expression": expression,
            "domain": {"min": str(minimum), "max": str(maximum)},
            "claimedLabel": source["claimedLabel"],
        },
        minimum,
        maximum,
        depth,
        nodes,
    )


def render(node: dict) -> str:
    op = node["op"]
    if op == "variable":
        return "x"
    if op == "constant":
        return f"({node['value']})"
    if op in UNARY:
        child = render(node["arg"])
        if op == "negate":
            return f"(-{child})"
        if op == "square":
            return f"({child}^2)"
        return f"{op}({child})"
    operator = {"add": "+", "multiply": "*", "divide": "/"}[op]
    return f"({render(node['left'])}{operator}{render(node['right'])})"
