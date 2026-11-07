"""Classify only from complete smooth-domain covers and strict interior witnesses."""

from dataclasses import dataclass

import flint
from flint import ctx, fmpq

from expressions import parse_reference, render
from intervals import CertificationFailure, Interval, NeedsSubdivision
from jets import Evaluator

PRECISION = 192
MAX_CELLS = 512
MAX_SUBDIVISION_DEPTH = 20
BACKEND = {
    "id": "arb-jet-v1",
    "pythonFlint": flint.__version__,
    "flint": flint.__FLINT_VERSION__,
    "policyVersion": "1",
}


@dataclass(frozen=True)
class Cell:
    minimum: fmpq
    maximum: fmpq
    level: int
    second: Interval | None
    pending_reason: str = "inconclusive-domain"


def certify(raw: object) -> dict:
    try:
        with ctx.workprec(PRECISION):
            return _certify(raw)
    except CertificationFailure as error:
        return {"status": error.status, "reason": error.reason}


def _certify(raw: object) -> dict:
    reference = parse_reference(raw)
    expression = reference.canonical["expression"]
    evaluator = Evaluator()
    probes: list[dict] = []
    witnesses: dict[str, dict] = {}
    sampled: set[str] = set()

    def sample(x: fmpq) -> dict | None:
        key = str(x)
        if key in sampled:
            return None
        sampled.add(key)
        try:
            jet = evaluator.evaluate(expression, Interval.point(x))
        except NeedsSubdivision as error:
            if error.reason == "non-smooth-boundary":
                raise CertificationFailure("unverified", error.reason) from None
            return None
        point = {"x": key, "value": jet.value.bounds(), "second": jet.second.bounds()}
        if reference.minimum < x < reference.maximum:
            witness = {"x": key, "second": jet.second.bounds()}
            if jet.second.lo > 0:
                witnesses.setdefault("positive", witness)
            if jet.second.hi < 0:
                witnesses.setdefault("negative", witness)
        return point

    # These points support distinctness checks and strict witnesses, never a global proof.
    for index in range(9):
        x = reference.minimum + (reference.maximum - reference.minimum) * fmpq(index, 8)
        point = sample(x)
        if point is not None:
            probes.append(point)

    processed_cells = 0

    def cell(minimum: fmpq, maximum: fmpq, level: int) -> Cell:
        nonlocal processed_cells
        processed_cells += 1
        if processed_cells > MAX_CELLS:
            raise CertificationFailure("unverified", "resource-limit")
        sample((minimum + maximum) / 2)
        try:
            jet = evaluator.evaluate(expression, Interval.rational_range(minimum, maximum))
            return Cell(minimum, maximum, level, jet.second)
        except NeedsSubdivision as error:
            return Cell(minimum, maximum, level, None, error.reason)

    leaves = [cell(reference.minimum, reference.maximum, 0)]
    while True:
        complete_domain = all(item.second is not None for item in leaves)
        convex = complete_domain and all(item.second.lo >= 0 for item in leaves)
        concave = complete_domain and all(item.second.hi <= 0 for item in leaves)
        if (convex and "negative" in witnesses) or (concave and "positive" in witnesses):
            raise RuntimeError("A strict derivative witness contradicts the domain cover")
        if convex and concave:
            return {"status": "excluded", "reason": "overlapping-labels"}
        label = None
        if complete_domain and "positive" in witnesses and "negative" in witnesses:
            label = "neither"
        elif convex and "positive" in witnesses:
            label = "convex"
        elif concave and "negative" in witnesses:
            label = "concave"
        if label is not None:
            if label != reference.canonical["claimedLabel"]:
                return {"status": "rejected", "reason": "label-mismatch"}
            # Successful certificates always contain all nine fixed semantic probes.
            if len(probes) != 9:
                raise CertificationFailure("unverified", "inconclusive-domain")
            return {
                "status": "verified",
                "label": label,
                "certificate": {
                    "version": "1",
                    "backend": dict(BACKEND),
                    "input": reference.canonical,
                    "renderedExpression": render(expression),
                    "depth": reference.depth,
                    "nodeCount": reference.nodes,
                    "precision": PRECISION,
                    "cover": [
                        {
                            "min": str(item.minimum),
                            "max": str(item.maximum),
                            "second": item.second.bounds(),
                        }
                        for item in leaves
                    ],
                    "witnesses": witnesses,
                    "probes": probes,
                },
            }

        # Breadth first refinement avoids spending the entire budget near one difficult point.
        candidates = [i for i, item in enumerate(leaves) if item.second is None]
        if not candidates:
            candidates = [i for i, item in enumerate(leaves) if item.second.lo < 0 < item.second.hi]
        if not candidates:
            raise CertificationFailure("unverified", "no-strict-witness")
        index = min(candidates, key=lambda i: (leaves[i].level, leaves[i].minimum))
        selected = leaves[index]
        if selected.level >= MAX_SUBDIVISION_DEPTH:
            reason = "resource-limit" if selected.second is not None else selected.pending_reason
            raise CertificationFailure("unverified", reason)
        midpoint = (selected.minimum + selected.maximum) / 2
        leaves[index : index + 1] = [
            cell(selected.minimum, midpoint, selected.level + 1),
            cell(midpoint, selected.maximum, selected.level + 1),
        ]
