"""One bounded JSON batch per isolated worker process; stdout contains only the response."""

import json
import sys
from pathlib import Path

# Isolated Python omits sibling modules; trust only this fixed worker directory.
sys.path.insert(0, str(Path(__file__).resolve().parent))

from certification import BACKEND, certify  # noqa: E402

MAX_INPUT_BYTES = 2 * 1024 * 1024
MAX_REFERENCES = 64


def unique_object(pairs: list[tuple[str, object]]) -> dict:
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate JSON field")
        result[key] = value
    return result


def reject_nonfinite(_: str) -> None:
    raise ValueError("Non-finite JSON numbers are unsupported")


def main() -> None:
    try:
        raw = sys.stdin.buffer.read(MAX_INPUT_BYTES + 1)
        if len(raw) > MAX_INPUT_BYTES:
            raise ValueError("Input exceeds the worker limit")
        request = json.loads(
            raw,
            object_pairs_hook=unique_object,
            parse_constant=reject_nonfinite,
        )
        if type(request) is not dict or set(request) != {"action", "references"}:
            raise ValueError("Expected action and references")
        references = request["references"]
        if request["action"] != "certify" or type(references) is not list:
            raise ValueError("Expected a certification batch")
        if not 1 <= len(references) <= MAX_REFERENCES:
            raise ValueError("A batch requires 1 through 64 references")
        result = {"backend": BACKEND, "results": [certify(item) for item in references]}
        sys.stdout.write(json.dumps(result, separators=(",", ":"), allow_nan=False) + "\n")
    except (ValueError, UnicodeDecodeError, RecursionError) as error:
        sys.stderr.write(f"Invalid numerical worker request: {error}\n")
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
