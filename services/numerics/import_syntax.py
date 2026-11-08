"""Parse bounded scalar mathematical text into a flat, exact postorder expression graph."""

import hashlib
import json
import re
from dataclasses import dataclass
from fractions import Fraction

MAX_CHARS = 131_072
MAX_NODES = 16_384
MAX_DEPTH = 4096
MAX_LITERAL_BITS = 4096
NUMBER = re.compile(r"(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?", re.ASCII)


class ImportFailure(Exception):
    def __init__(self, reason: str, status: str = "unverified"):
        self.reason = reason
        self.status = status
        super().__init__(reason)


def exact_number(text: str) -> Fraction:
    if len(text) > 96:
        raise ImportFailure("literal-limit")
    scientific = re.search(r"[eE]([+-]?\d+)$", text)
    if scientific and abs(int(scientific.group(1))) > 1024:
        raise ImportFailure("literal-limit")
    try:
        value = Fraction(text)
    except (ValueError, ZeroDivisionError):
        raise ImportFailure("invalid-number", "rejected") from None
    if max(value.numerator.bit_length(), value.denominator.bit_length()) > MAX_LITERAL_BITS:
        raise ImportFailure("literal-limit")
    return value


@dataclass(frozen=True)
class Node:
    op: str
    children: tuple[int, ...] = ()
    value: Fraction | None = None


@dataclass(frozen=True)
class ParsedExpression:
    nodes: tuple[Node, ...]
    root: int
    ast_depth: int
    nonlinear_path: int
    core_hashes: tuple[str, ...]
    shape_hash: str
    operations: dict[str, int]


def _tokens(expression: str):
    text = expression.strip()
    if text.startswith("$") and text.endswith("$"):
        text = text[1:-1].strip()
    if text.startswith("f(x)"):
        match = re.match(r"f\(x\)\s*=\s*", text)
        if match is None:
            raise ImportFailure("invalid-function-prefix", "rejected")
        text = text[match.end():]
    index = 0
    while index < len(text):
        char = text[index]
        if char.isspace():
            index += 1
            continue
        match = NUMBER.match(text, index)
        if match:
            yield "number", match.group()
            index = match.end()
            continue
        if text.startswith(r"\|", index):
            index += 2
            suffix = re.match(r"_(?:[12]|\{[12]\}|\\infty|\{\\infty\})", text[index:])
            if suffix:
                index += suffix.end()
                yield ")", ")"
            else:
                yield "function", "abs"
                yield "(", "("
            continue
        if char == "\\":
            if text.startswith(r"\{", index) or text.startswith(r"\}", index):
                yield ("(" if text[index + 1] == "{" else ")"), text[index:index + 2]
                index += 2
                continue
            command = re.match(r"\\([A-Za-z]+|[,;! ])", text[index:])
            if command is None:
                raise ImportFailure("unsupported-syntax", "rejected")
            name = command.group(1)
            index += command.end()
            if name in {"exp", "log", "sqrt", "max"}:
                yield "function", name
            elif name in {"cdot", "times"}:
                yield "*", "*"
            elif name in {",", ";", "!", " "}:
                continue
            elif name in {"left", "right"} and index < len(text) and text[index] in "(){}\\":
                continue
            else:
                raise ImportFailure("unsupported-syntax", "rejected")
            continue
        if char == "x":
            yield "variable", char
        elif char in "({":
            yield "(", char
        elif char in ")}":
            yield ")", char
        elif char in "+-*/^,":
            yield char, char
        elif char.isalpha():
            name = re.match(r"[A-Za-z]+", text[index:]).group()
            if name not in {"exp", "log", "sqrt", "max", "abs"}:
                raise ImportFailure("unsupported-syntax", "rejected")
            yield "function", name
            index += len(name)
            continue
        else:
            raise ImportFailure("unsupported-syntax", "rejected")
        index += 1


def parse_expression(expression: str) -> ParsedExpression:
    if type(expression) is not str or not expression or len(expression) > MAX_CHARS:
        raise ImportFailure("expression-size-limit", "rejected")
    nodes: list[Node] = []
    values: list[int] = []
    operators: list[str] = []
    arguments: list[int] = []
    brackets: list[str] = []
    expect_operand = True
    nesting = 0
    previous_kind = None
    precedence = {"+": 1, "-": 1, "*": 2, "/": 2, "neg": 3, "^": 4}

    def append(node: Node):
        if len(nodes) >= MAX_NODES:
            raise ImportFailure("node-limit")
        nodes.append(node)
        values.append(len(nodes) - 1)

    def emit(op: str, arity: int = 0):
        count = arity or (1 if op == "neg" else 2)
        if len(values) < count:
            raise ImportFailure("malformed-expression", "rejected")
        children = tuple(values[-count:])
        del values[-count:]
        names = {"+": "add", "-": "subtract", "*": "multiply", "/": "divide",
                 "^": "power", "neg": "negate"}
        append(Node(names.get(op, op.removeprefix("fn:")), children))

    def binary(op: str):
        while operators and operators[-1] in precedence and (
            precedence[operators[-1]] > precedence[op]
            or precedence[operators[-1]] == precedence[op] and op != "^"
        ):
            emit(operators.pop())
        operators.append(op)

    for kind, value in _tokens(expression):
        if kind == "number" and previous_kind == "number":
            raise ImportFailure("ambiguous-number-juxtaposition", "rejected")
        if kind in {"number", "variable", "function", "("} and not expect_operand:
            binary("*")
            expect_operand = True
        if kind == "number":
            append(Node("constant", value=exact_number(value)))
            expect_operand = False
        elif kind == "variable":
            append(Node("variable"))
            expect_operand = False
        elif kind == "function":
            operators.append(f"fn:{value}")
        elif kind == "(":
            operators.append("(")
            arguments.append(1)
            brackets.append("}" if value.endswith("{") else ")")
            nesting += 1
            if nesting > MAX_DEPTH:
                raise ImportFailure("depth-limit")
        elif kind == ",":
            if expect_operand or "(" not in operators:
                raise ImportFailure("malformed-arguments", "rejected")
            while operators[-1] != "(":
                emit(operators.pop())
            arguments[-1] += 1
            if arguments[-1] > 16:
                raise ImportFailure("arity-limit")
            expect_operand = True
        elif kind == ")":
            if expect_operand or "(" not in operators:
                raise ImportFailure("unbalanced-expression", "rejected")
            if value[-1] != brackets.pop():
                raise ImportFailure("mismatched-brackets", "rejected")
            while operators[-1] != "(":
                emit(operators.pop())
            operators.pop()
            arity = arguments.pop()
            nesting -= 1
            if operators and operators[-1].startswith("fn:"):
                fn = operators.pop()
                if (fn == "fn:max" and arity < 2) or (fn != "fn:max" and arity != 1):
                    raise ImportFailure("invalid-arity", "rejected")
                emit(fn, arity)
            elif arity != 1:
                raise ImportFailure("ungrouped-comma", "rejected")
            expect_operand = False
        elif kind in {"+", "-"} and expect_operand:
            if kind == "-":
                operators.append("neg")
        else:
            if expect_operand or kind not in precedence:
                raise ImportFailure("malformed-expression", "rejected")
            binary(kind)
            expect_operand = True
        previous_kind = kind
    if expect_operand or nesting:
        raise ImportFailure("unbalanced-expression", "rejected")
    while operators:
        op = operators.pop()
        if op not in precedence:
            raise ImportFailure("malformed-function", "rejected")
        emit(op)
    if len(values) != 1:
        raise ImportFailure("malformed-expression", "rejected")

    depths: list[int] = []
    nonlinear: list[int] = []
    variable: list[bool] = []
    sizes: list[int] = []
    hashes: list[str] = []
    shapes: list[str] = []
    operations: dict[str, int] = {}
    for node in nodes:
        depth = 0 if not node.children else 1 + max(depths[c] for c in node.children)
        if depth > MAX_DEPTH:
            raise ImportFailure("depth-limit")
        depends = node.op == "variable" or any(variable[c] for c in node.children)
        nonlinear_operation = node.op in {"exp", "log", "sqrt", "power", "abs", "max"} \
            or node.op == "multiply" and all(variable[c] for c in node.children) \
            or node.op == "divide" and variable[node.children[1]]
        increment = int(depends and nonlinear_operation)
        nonlinear.append(increment + max((nonlinear[c] for c in node.children), default=0))
        depths.append(depth)
        variable.append(depends)
        sizes.append(1 + sum(sizes[c] for c in node.children))
        exact = [node.op, str(node.value) if node.value is not None else None,
                 [hashes[c] for c in node.children]]
        shape = [node.op, [shapes[c] for c in node.children]]
        hashes.append(hashlib.sha256(json.dumps(exact, separators=(",", ":")).encode()).hexdigest())
        shapes.append(hashlib.sha256(json.dumps(shape, separators=(",", ":")).encode()).hexdigest())
        operations[node.op] = operations.get(node.op, 0) + 1
    root = values[0]
    cores = tuple(sorted({hashes[i] for i in range(len(nodes))
                          if variable[i] and sizes[i] >= 16 and depths[i] >= 4}))
    return ParsedExpression(tuple(nodes), root, depths[root], nonlinear[root], cores,
                            shapes[root], operations)
