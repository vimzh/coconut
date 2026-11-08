"""Bounded exact simplification and structural coverage of unchanged displayed tasks."""

import hashlib
import json
import sys
from collections import Counter
from fractions import Fraction
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "services" / "numerics"))
from import_reference import PointEvaluator, _enclosure, analyze  # noqa: E402
from import_syntax import MAX_LITERAL_BITS, ImportFailure, parse_expression  # noqa: E402


def digest(value):
    return hashlib.sha256(json.dumps(value, separators=(",", ":")).encode()).hexdigest()


def bounded(value):
    if max(value.numerator.bit_length(), value.denominator.bit_length()) > MAX_LITERAL_BITS:
        raise ImportFailure("diagnostic-exact-arithmetic-limit")
    return value


def diagnose(raw):
    expression = raw["expression"]
    minimum, maximum = (Fraction(raw["domain"][key]) for key in ("min", "max"))
    parsed = parse_expression(expression)
    tags, _ = analyze(parsed, minimum, maximum)
    if not tags[parsed.root].valid:
        raise ImportFailure("diagnostics-require-valid-original-domain")
    graph = []
    interned = {}
    rules = Counter()

    def intern(op, children=(), value=None):
        children = tuple(children)
        key = (op, children, value)
        if key not in interned:
            interned[key] = len(graph)
            graph.append(key)
        return interned[key]

    def constant(value):
        return intern("constant", value=bounded(value))

    def multiply(children):
        factor, terms = Fraction(1), []
        pending = list(children)
        while pending:
            child = pending.pop()
            op, nested, value = graph[child]
            if op == "constant":
                factor = bounded(factor * value)
            elif op == "multiply":
                pending.extend(nested)
            else:
                terms.append(child)
        if factor == 0:
            return constant(Fraction(0))
        if factor != 1 or not terms:
            terms.append(constant(factor))
        terms.sort(key=node_hash)
        return terms[0] if len(terms) == 1 else intern("multiply", terms)

    def add(children):
        scalar, terms = Fraction(0), Counter()
        pending = list(children)
        while pending:
            child = pending.pop()
            op, nested, value = graph[child]
            if op == "add":
                pending.extend(nested)
            elif op == "constant":
                scalar = bounded(scalar + value)
            else:
                coefficient = Fraction(1)
                if op == "multiply":
                    variable = []
                    for item in nested:
                        if graph[item][0] == "constant":
                            coefficient = bounded(coefficient * graph[item][2])
                        else:
                            variable.append(item)
                    child = multiply(variable)
                terms[child] = bounded(terms[child] + coefficient)
        normalized = [multiply((constant(value), child)) for child, value in terms.items()
                      if value != 0]
        if scalar != 0 or not normalized:
            normalized.append(constant(scalar))
        normalized.sort(key=lambda child: node_hash(child))
        return normalized[0] if len(normalized) == 1 else intern("add", normalized)

    fingerprints = []

    def node_hash(index):
        # All graph nodes are postorder, including nodes introduced by normalization.
        while len(fingerprints) <= index:
            op, children, value = graph[len(fingerprints)]
            fingerprints.append(digest([op, str(value) if value is not None else None,
                                        [fingerprints[c] for c in children]]))
        return fingerprints[index]

    normalized = []
    for index, node in enumerate(parsed.nodes):
        children = [normalized[c] for c in node.children]
        op = node.op
        if tags[index].affine is not None:
            a, b = tags[index].affine
            result = add((multiply((constant(a), intern("variable"))), constant(b)))
            if node.children:
                rules["exact-affine"] += 1
        elif op == "negate":
            result = multiply((constant(Fraction(-1)), children[0]))
        elif op == "add":
            result = add(children)
        elif op == "subtract":
            result = add((children[0], multiply((constant(Fraction(-1)), children[1]))))
        elif op == "multiply":
            result = multiply(children)
        elif op == "divide" and graph[children[1]][0] == "constant":
            result = multiply((children[0], constant(1 / graph[children[1]][2])))
        elif op == "log" and graph[children[0]][0] == "exp":
            result = graph[children[0]][1][0]
            rules["log-exp"] += 1
        elif op == "exp" and graph[children[0]][0] == "log":
            result = graph[children[0]][1][0]
            rules["exp-log-valid-domain"] += 1
        elif op == "power" and graph[children[1]][0] == "constant" \
                and graph[children[1]][2] == 2 and graph[children[0]][0] == "sqrt":
            result = graph[children[0]][1][0]
            rules["square-sqrt-valid-domain"] += 1
        elif op == "abs" and tags[node.children[0]].nonnegative:
            result = children[0]
            rules["sign-resolved-abs"] += 1
        elif op == "abs" and tags[node.children[0]].nonpositive:
            result = multiply((constant(Fraction(-1)), children[0]))
            rules["sign-resolved-abs"] += 1
        elif op == "max":
            dominant = next((c for c in node.children if tags[c].low is not None
                             and all(other == c or tags[other].high is not None
                                     and tags[c].low >= tags[other].high
                                     for other in node.children)), None)
            if dominant is not None:
                result = normalized[dominant]
                rules["range-dominated-max"] += len(children) - 1
            else:
                items = sorted(set(children), key=node_hash)
                result = items[0] if len(items) == 1 else intern("max", items)
                rules["duplicate-max-branches"] += len(children) - len(items)
        else:
            result = intern(op, children, node.value)
        normalized.append(result)
        node_hash(result)

    root = normalized[parsed.root]
    needed, pending = set(), [root]
    while pending:
        current = pending.pop()
        if current not in needed:
            needed.add(current)
            pending.extend(graph[current][1])
    depths, nonlinear, depends, shapes, occurrences = [], [], [], [], []
    operations = Counter()
    branches = 0
    for index, (op, children, _) in enumerate(graph):
        variable = op == "variable" or any(depends[c] for c in children)
        depends.append(variable)
        depths.append(1 + max((depths[c] for c in children), default=-1))
        nonlinear_op = op in {"exp", "log", "sqrt", "power", "abs", "max"} \
            or op == "multiply" and sum(depends[c] for c in children) > 1 \
            or op == "divide" and depends[children[1]]
        nonlinear.append(int(variable and nonlinear_op)
                         + max((nonlinear[c] for c in children), default=0))
        occurrences.append(1 + sum(occurrences[c] for c in children))
        shapes.append(digest([op, sorted(shapes[c] for c in children)
                              if op in {"add", "multiply", "max"}
                              else [shapes[c] for c in children]]))
        if index in needed:
            operations[op] += 1
            branches += int(sum(depends[c] for c in children) > 1)

    # Strip only output affine wrappers for related-group accounting, never admission equality.
    group_root = root
    while True:
        op, children, _ = graph[group_root]
        nonconstant = [c for c in children if graph[c][0] != "constant"]
        if op in {"add", "multiply"} and len(nonconstant) == 1:
            group_root = nonconstant[0]
        else:
            break
    points = []
    evaluator = PointEvaluator(parsed)
    for point in (minimum, (minimum + maximum) / 2, maximum):
        try:
            points.append({"x": str(point), "status": "enclosed",
                           "value": _enclosure(evaluator.at(point))})
        except ImportFailure as error:
            points.append({"x": str(point), "status": "unknown", "reason": error.reason})
    raw_hashes = []
    for node in parsed.nodes:
        raw_hashes.append(digest([node.op, str(node.value), [raw_hashes[c] for c in node.children]]))
    return {"version": "1", "policy": "bounded-exact-diagnostics-v1",
            "expressionSha256": hashlib.sha256(expression.encode()).hexdigest(),
            "expressionCharacters": len(expression),
            "domain": raw["domain"], "simplifiedExactHash": node_hash(root),
            "relatedShapeHash": shapes[group_root], "rawShapeHash": parsed.shape_hash,
            "raw": {"astDepth": parsed.ast_depth, "nodeCount": len(parsed.nodes),
                    "nonlinearPath": parsed.nonlinear_path, "uniqueSubtrees": len(set(raw_hashes)),
                    "branchNodes": sum(len(n.children) > 1 for n in parsed.nodes),
                    "operations": parsed.operations},
            "simplified": {"astDepth": depths[root], "nodeCount": occurrences[root],
                           "uniqueSubtrees": len(needed), "nonlinearPath": nonlinear[root],
                           "branchNodes": branches, "operations": dict(operations)},
            "simplificationRules": dict(rules), "pointValues": points,
            "mechanismClassification": "not-individually-established",
            "derivativeScales": "not-assessed", "rangeScales": "not-assessed",
            "equivalenceStatus": "bounded-no-known-equivalence",
            "pairwiseSemanticInequivalence": "unknown"}


if __name__ == "__main__":
    try:
        print(json.dumps(diagnose(json.load(sys.stdin)), separators=(",", ":")))
    except (ImportFailure, ValueError, ZeroDivisionError) as error:
        print(json.dumps({"status": "unavailable", "reason": str(error)}))
