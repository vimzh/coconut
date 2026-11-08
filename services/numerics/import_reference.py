"""Independently certify exact displayed scalar tasks under a bounded deep-import policy."""

import hashlib
import json
import math
import sys
from dataclasses import dataclass, replace
from fractions import Fraction
from pathlib import Path

# Isolated invocation trusts this script's sibling parser, never the caller's working directory.
sys.path.insert(0, str(Path(__file__).resolve().parent))

from flint import arb, ctx, fmpq  # noqa: E402

from import_syntax import (  # noqa: E402
    MAX_LITERAL_BITS,
    ImportFailure,
    ParsedExpression,
    exact_number,
    parse_expression,
)

POLICY = "deep-import-reference-v1"
MAX_NODE_EVALUATIONS = 200_000
MAX_EXP_ARGUMENT = 4096
MAX_POINT_EXPONENT = 16_384
PRECISIONS = (128, 512, 2048)


@dataclass(frozen=True)
class Tag:
    valid: bool
    convex: bool = False
    concave: bool = False
    strict_convex: bool = False
    strict_concave: bool = False
    low: Fraction | None = None
    high: Fraction | None = None
    positive: bool = False
    negative: bool = False
    affine: tuple[Fraction, Fraction] | None = None
    constant: bool = False

    @property
    def nonnegative(self):
        return self.positive or self.low is not None and self.low >= 0

    @property
    def nonpositive(self):
        return self.negative or self.high is not None and self.high <= 0


def _bounded(value: Fraction | None) -> Fraction | None:
    bits = max(value.numerator.bit_length(), value.denominator.bit_length()) \
        if value is not None else 0
    if bits > MAX_LITERAL_BITS:
        raise ImportFailure("exact-arithmetic-limit")
    return value


def _tag_affine(a: Fraction, b: Fraction, minimum: Fraction, maximum: Fraction) -> Tag:
    _bounded(a)
    _bounded(b)
    bounds = sorted((a * minimum + b, a * maximum + b))
    for bound in bounds:
        _bounded(bound)
    return Tag(True, True, True, low=bounds[0], high=bounds[1],
               positive=bounds[0] > 0, negative=bounds[1] < 0,
               affine=(a, b), constant=a == 0)


def _negate(tag: Tag) -> Tag:
    return Tag(tag.valid, tag.concave, tag.convex, tag.strict_concave, tag.strict_convex,
               -tag.high if tag.high is not None else None,
               -tag.low if tag.low is not None else None, tag.negative, tag.positive,
               tuple(-v for v in tag.affine) if tag.affine else None, tag.constant)


def _add(a: Tag, b: Tag) -> Tag:
    low = _bounded(a.low + b.low) if a.low is not None and b.low is not None else None
    high = _bounded(a.high + b.high) if a.high is not None and b.high is not None else None
    convex, concave = a.convex and b.convex, a.concave and b.concave
    affine = tuple(_bounded(x + y) for x, y in zip(a.affine, b.affine)) \
        if a.affine is not None and b.affine is not None else None
    return Tag(a.valid and b.valid, convex, concave,
               convex and (a.strict_convex or b.strict_convex),
               concave and (a.strict_concave or b.strict_concave), low, high,
               a.nonnegative and b.nonnegative and (a.positive or b.positive),
               a.nonpositive and b.nonpositive and (a.negative or b.negative),
               affine,
               a.constant and b.constant)


def _scale(a: Tag, factor: Fraction) -> Tag:
    _bounded(factor)
    if factor < 0:
        return _scale(_negate(a), -factor)
    if factor == 0:
        return Tag(a.valid, True, True, low=Fraction(0), high=Fraction(0),
                   affine=(Fraction(0), Fraction(0)), constant=True)
    return replace(a, low=_bounded(a.low * factor) if a.low is not None else None,
                   high=_bounded(a.high * factor) if a.high is not None else None,
                   affine=tuple(_bounded(v * factor) for v in a.affine) if a.affine else None)


def _exact_constant(tag: Tag) -> Fraction | None:
    return tag.affine[1] if tag.affine is not None and tag.affine[0] == 0 else None


def _exp_terms(parsed: ParsedExpression, index: int) -> list[int | Fraction] | None:
    pending = [index]
    terms: list[int | Fraction] = []
    while pending:
        node = parsed.nodes[pending.pop()]
        if node.op == "add":
            pending.extend(reversed(node.children))
        elif node.op == "exp":
            terms.append(node.children[0])
        elif node.op == "constant" and node.value == 1:
            terms.append(Fraction(0))
        elif node.op == "constant" and node.value == 0:
            continue
        else:
            return None
    return terms if terms else None


def analyze(parsed: ParsedExpression, minimum: Fraction, maximum: Fraction):
    tags: list[Tag] = []
    trace = hashlib.sha256()
    for index, node in enumerate(parsed.nodes):
        children = [tags[c] for c in node.children]
        a = children[0] if children else None
        b = children[1] if len(children) > 1 else None
        valid = all(child.valid for child in children)
        if node.op == "variable":
            tag = _tag_affine(Fraction(1), Fraction(0), minimum, maximum)
        elif node.op == "constant":
            tag = _tag_affine(Fraction(0), node.value, minimum, maximum)
        elif node.op == "negate":
            tag = _negate(a)
        elif node.op in {"add", "subtract"}:
            tag = _add(a, _negate(b) if node.op == "subtract" else b)
        elif node.op in {"multiply", "divide"}:
            left_constant, right_constant = _exact_constant(a), _exact_constant(b)
            if node.op == "divide":
                if right_constant is None or right_constant == 0:
                    tag = Tag(False)
                else:
                    tag = _scale(a, 1 / right_constant)
            elif left_constant is not None:
                tag = _scale(b, left_constant)
            elif right_constant is not None:
                tag = _scale(a, right_constant)
            else:
                products = [x * y for x in (a.low, a.high) for y in (b.low, b.high)
                            if x is not None and y is not None]
                bounds = len(products) == 4
                tag = Tag(valid, low=_bounded(min(products)) if bounds else None,
                          high=_bounded(max(products)) if bounds else None)
        elif node.op == "exp":
            low = Fraction(1) if a.low is not None and a.low >= 0 else Fraction(0)
            high = Fraction(1) if a.high is not None and a.high <= 0 else None
            if a.high is not None and 0 < a.high <= 64:
                high = Fraction(3 ** math.ceil(a.high))
            tag = Tag(valid, a.convex or a.constant, a.constant,
                      a.convex and (a.strict_convex or a.affine is not None and a.affine[0] != 0),
                      low=low, high=high, positive=True, constant=a.constant)
        elif node.op == "log":
            terms = _exp_terms(parsed, node.children[0])
            if terms is not None:
                arguments = [tags[t] if type(t) is int else
                             _tag_affine(Fraction(0), t, minimum, maximum) for t in terms]
                convex = all(t.convex for t in arguments)
                slopes = {t.affine[0] for t in arguments if t.affine is not None}
                strict = convex and (any(t.strict_convex for t in arguments)
                                     or all(t.affine is not None for t in arguments)
                                     and len(slopes) > 1)
                tag = Tag(all(t.valid for t in arguments), convex,
                          all(t.constant for t in arguments), strict_convex=strict,
                          constant=all(t.constant for t in arguments))
                lower_bounds = [t.low for t in arguments if t.low is not None]
                low = max(lower_bounds) if lower_bounds else None
                high = max(t.high for t in arguments) + len(arguments) \
                    if all(t.high is not None for t in arguments) else None
                tag = replace(tag, low=low, high=_bounded(high),
                              positive=any(t.positive for t in arguments)
                              or len(arguments) > 1 and low is not None and low >= 0)
                if len(terms) == 1 and type(terms[0]) is int:
                    tag = tags[terms[0]]
            else:
                domain_ok = a.positive or a.low is not None and a.low > 0
                tag = Tag(valid and domain_ok, a.constant,
                          a.concave or a.constant, strict_concave=a.concave and
                          (a.strict_concave or a.affine is not None and a.affine[0] != 0),
                          low=_bounded(1 - 1 / a.low) if a.low is not None and a.low > 0
                          else None, high=_bounded(a.high - 1) if a.high is not None else None,
                          constant=a.constant)
        elif node.op in {"sqrt", "power"}:
            exponent = Fraction(1, 2) if node.op == "sqrt" else _exact_constant(b)
            if exponent is None or exponent != 2 and not 0 < exponent < 1:
                raise ImportFailure("unsupported-exponent", "rejected")
            if exponent == 2:
                convex = a.convex and a.nonnegative or a.concave and a.nonpositive
                affine_nonconstant = a.affine is not None and a.affine[0] != 0
                convex = convex or a.affine is not None
                strict = affine_nonconstant or a.strict_convex and a.nonnegative \
                    or a.strict_concave and a.nonpositive
                bound = max(abs(a.low), abs(a.high)) ** 2 \
                    if a.low is not None and a.high is not None else None
                tag = Tag(valid, convex, a.constant, strict_convex=strict,
                          low=Fraction(0), high=_bounded(bound), constant=a.constant)
            else:
                domain_ok = a.nonnegative
                strict = a.concave and (a.strict_concave or a.affine is not None
                                       and a.affine[0] != 0)
                tag = Tag(valid and domain_ok, a.constant, a.concave or a.constant,
                          strict_concave=strict, low=Fraction(0),
                          high=max(Fraction(1), a.high) if a.high is not None else None,
                          positive=a.positive, constant=a.constant)
        elif node.op == "abs":
            if a.nonnegative:
                tag = a
            elif a.nonpositive:
                tag = _negate(a)
            else:
                tag = Tag(valid, a.affine is not None, a.constant, low=Fraction(0),
                          high=max(abs(a.low), abs(a.high))
                          if a.low is not None and a.high is not None else None,
                          constant=a.constant)
        elif node.op == "max":
            dominating = next((child for child in children if child.low is not None
                               and all(other is child or other.high is not None
                                       and child.low >= other.high for other in children)), None)
            if dominating is not None:
                tag = replace(dominating, valid=valid)
            else:
                known_lows = [child.low for child in children if child.low is not None]
                low = max(known_lows) if known_lows else None
                high = max(child.high for child in children) \
                    if all(child.high is not None for child in children) else None
                tag = Tag(valid, all(child.convex for child in children),
                          all(child.constant for child in children),
                          strict_convex=all(child.strict_convex for child in children),
                          low=low, high=high, positive=any(child.positive for child in children),
                          negative=all(child.negative for child in children),
                          constant=all(child.constant for child in children))
        else:
            raise ImportFailure("unsupported-operation", "rejected")
        operation_valid = tag.valid and valid
        if tag.affine is not None:
            tag = _tag_affine(*tag.affine, minimum, maximum)
        # Algebraic simplification cannot erase an undefined operand of the original task.
        tag = replace(tag, valid=operation_valid)
        tags.append(tag)
        trace.update(json.dumps([index, node.op, tag.valid, tag.convex, tag.concave,
                                 tag.strict_convex, tag.strict_concave,
                                 str(tag.low), str(tag.high), tag.positive, tag.negative],
                                separators=(",", ":")).encode())
    return tags, trace.hexdigest()


def _rational_arb(value: Fraction):
    return arb(fmpq(value.numerator, value.denominator))


class PointEvaluator:
    def __init__(self, parsed: ParsedExpression):
        self.parsed = parsed
        self.work = 0
        self.representatives = []
        self.lse = {}
        for index, node in enumerate(parsed.nodes):
            if node.op == "log":
                child = parsed.nodes[node.children[0]]
                if child.op == "exp":
                    self.representatives.append(self.representatives[child.children[0]])
                    continue
                terms = _exp_terms(parsed, node.children[0])
                if terms is not None:
                    self.lse[index] = terms
            self.representatives.append(index)
        needed = set()
        pending = [self.representatives[parsed.root]]
        while pending:
            index = self.representatives[pending.pop()]
            if index in needed:
                continue
            needed.add(index)
            if index in self.lse:
                pending.extend(t for t in self.lse[index] if type(t) is int)
            else:
                pending.extend(parsed.nodes[index].children)
        self.needed = sorted(needed)

    def at(self, point: Fraction):
        values = {}
        for index in self.needed:
            self.work += 1
            if self.work > MAX_NODE_EVALUATIONS:
                raise ImportFailure("proof-work-limit")
            node = self.parsed.nodes[index]
            children = [values[self.representatives[c]] for c in node.children
                        if self.representatives[c] in values]
            a = children[0] if children else None
            b = children[1] if len(children) > 1 else None
            if index in self.lse:
                terms = [values[self.representatives[t]] if type(t) is int else
                         _rational_arb(t) for t in self.lse[index]]
                shift = max(t.upper() for t in terms)
                if any((t - shift).lower() < -MAX_EXP_ARGUMENT for t in terms):
                    raise ImportFailure("point-magnitude-limit")
                result = sum((t - shift).exp() for t in terms).log() + shift
            elif node.op == "constant":
                result = _rational_arb(node.value)
            elif node.op == "variable":
                result = _rational_arb(point)
            elif node.op == "negate":
                result = -a
            elif node.op == "add":
                result = a + b
            elif node.op == "subtract":
                result = a - b
            elif node.op == "multiply":
                result = a * b
            elif node.op == "divide":
                if b.contains(0):
                    raise ImportFailure("unresolved-point-domain")
                result = a / b
            elif node.op == "exp":
                if a.lower() < -MAX_EXP_ARGUMENT or a.upper() > MAX_EXP_ARGUMENT:
                    raise ImportFailure("point-magnitude-limit")
                result = a.exp()
            elif node.op == "log":
                if not a > 0:
                    raise ImportFailure("unresolved-point-domain")
                result = a.log()
            elif node.op == "sqrt":
                if not a >= 0:
                    raise ImportFailure("unresolved-point-domain")
                result = a.sqrt()
            elif node.op == "power":
                exponent = self.parsed.nodes[node.children[1]]
                if exponent.op != "constant":
                    raise ImportFailure("unsupported-point-exponent")
                if exponent.value == 2:
                    result = a * a
                elif a == 0:
                    result = arb(0)
                elif a > 0:
                    result = (a.log() * _rational_arb(exponent.value)).exp()
                else:
                    raise ImportFailure("unresolved-point-domain")
            elif node.op == "abs":
                result = abs(a)
            elif node.op == "max":
                result = children[0]
                for child in children[1:]:
                    result = result.max(child)
            else:
                raise ImportFailure("unsupported-operation")
            if not result.is_finite():
                raise ImportFailure("nonfinite-point-enclosure")
            if any(abs(int(endpoint.man_exp()[1])) > MAX_POINT_EXPONENT
                   for endpoint in (result.lower(), result.upper())):
                raise ImportFailure("point-magnitude-limit")
            values[index] = result
        return values[self.representatives[self.parsed.root]]


def _enclosure(value):
    bounds = [value.lower().fmpq(), value.upper().fmpq()]
    if any(max(abs(int(q.p)).bit_length(), int(q.q).bit_length()) > MAX_LITERAL_BITS
           for q in bounds):
        raise ImportFailure("witness-size-limit")
    return {"min": str(bounds[0]), "max": str(bounds[1])}


def find_witnesses(parsed: ParsedExpression, minimum: Fraction, maximum: Fraction,
                   needed_signs: set[int]):
    evaluator = PointEvaluator(parsed)
    found = {}
    old_precision = ctx.prec
    try:
        for precision in PRECISIONS:
            ctx.prec = precision
            grid = [minimum + (maximum - minimum) * Fraction(i, 32) for i in range(33)]
            values = {}
            for index, point in enumerate(grid):
                try:
                    values[index] = evaluator.at(point)
                except ImportFailure as error:
                    if error.reason == "proof-work-limit":
                        raise
            for left in range(31):
                right, middle = left + 2, left + 1
                if any(index not in values for index in (left, right, middle)):
                    continue
                gap = values[middle] - (values[left] + values[right]) / 2
                sign = 1 if gap > 0 else -1 if gap < 0 else 0
                if sign in needed_signs and sign not in found:
                    found[sign] = {"x": str(grid[left]), "y": str(grid[right]),
                                   "t": "1/2", "gap": _enclosure(gap), "precision": precision}
            if needed_signs <= found.keys():
                break
    finally:
        ctx.prec = old_precision
    return found, evaluator.work


def certify_import(raw):
    base = {"policy": POLICY}
    try:
        if type(raw) is not dict or set(raw) != {"expression", "label", "domain"}:
            raise ImportFailure("invalid-input", "rejected")
        expression, label, domain = raw["expression"], raw["label"], raw["domain"]
        if label not in {"convex", "concave", "neither"} or type(domain) is not dict \
                or set(domain) != {"min", "max"} \
                or any(type(domain[k]) is not str for k in ("min", "max")):
            raise ImportFailure("invalid-input", "rejected")
        parsed = parse_expression(expression)
        minimum, maximum = exact_number(domain["min"]), exact_number(domain["max"])
        if minimum >= maximum:
            raise ImportFailure("invalid-domain", "rejected")
        base.update(expressionSha256=hashlib.sha256(expression.encode()).hexdigest(), label=label,
                    domain={"min": str(minimum), "max": str(maximum)},
                    astDepth=parsed.ast_depth, nonlinearPath=parsed.nonlinear_path,
                    nodeCount=len(parsed.nodes), coreHashes=list(parsed.core_hashes),
                    shapeHash=parsed.shape_hash, operations=parsed.operations)
        tags, trace = analyze(parsed, minimum, maximum)
        tag = tags[parsed.root]
        if not tag.valid:
            raise ImportFailure("unresolved-domain")
        if tag.constant or tag.affine is not None:
            raise ImportFailure("affine-overlap", "rejected")
        if label == "convex" and not tag.convex or label == "concave" and not tag.concave:
            raise ImportFailure("unresolved-curvature")
        structural = label == "convex" and tag.strict_convex \
            or label == "concave" and tag.strict_concave
        needed = {1, -1} if label == "neither" else {-1} if label == "convex" else {1}
        witnesses, work = ({}, 0) if structural else find_witnesses(
            parsed, minimum, maximum, needed)
        if not structural and not needed <= witnesses.keys():
            raise ImportFailure("strict-witness-unresolved")
        base.update(status="verified", proof={"domain": "whole-interval-sign-and-range-rules",
                    "curvature": "strict-opposite-Jensen-witnesses" if label == "neither"
                    else "sufficient-composition-rules", "traceSha256": trace,
                    "strictExclusion": "strict-composition" if structural else "strict-Jensen-gap",
                    "witnesses": [{"direction": "not-convex" if sign == 1 else "not-concave",
                                   **witness} for sign, witness in sorted(witnesses.items())],
                    "pointNodeEvaluations": work})
        return base
    except ImportFailure as error:
        return {**base, "status": error.status, "reason": error.reason}


def main():
    source = sys.stdin.buffer.read(1_048_577)
    if len(source) > 1_048_576:
        raise ImportFailure("request-size-limit", "rejected")
    raw = json.loads(source)
    print(json.dumps(certify_import(raw), separators=(",", ":")))


if __name__ == "__main__":
    try:
        main()
    except (ImportFailure, ValueError, TypeError, OverflowError) as error:
        reason = error.reason if isinstance(error, ImportFailure) else "invalid-input"
        print(json.dumps({"status": "rejected", "policy": POLICY, "reason": reason}))
