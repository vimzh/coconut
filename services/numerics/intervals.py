"""Outward Arb endpoint arithmetic with bounded exact rational serialization."""

from dataclasses import dataclass

from flint import arb, fmpq

MAX_ENDPOINT_BITS = 4096


class CertificationFailure(Exception):
    def __init__(self, status: str, reason: str):
        self.status = status
        self.reason = reason
        super().__init__(reason)


class NeedsSubdivision(Exception):
    def __init__(self, reason: str = "inconclusive-domain"):
        self.reason = reason
        super().__init__(reason)


def checked_endpoint(value: arb) -> arb:
    if not value.is_finite() or not value.is_exact():
        raise CertificationFailure("unverified", "resource-limit")
    mantissa, exponent = value.man_exp()
    exponent = int(exponent)
    if (
        abs(int(mantissa)).bit_length() + max(exponent, 0) > MAX_ENDPOINT_BITS
        or -exponent > MAX_ENDPOINT_BITS
    ):
        raise CertificationFailure("unverified", "resource-limit")
    return value


@dataclass(frozen=True)
class Interval:
    lo: arb
    hi: arb

    def __post_init__(self):
        checked_endpoint(self.lo)
        checked_endpoint(self.hi)
        if self.lo > self.hi:
            raise RuntimeError("Reversed internal interval")

    @classmethod
    def point(cls, value: fmpq | int) -> "Interval":
        enclosed = arb(value)
        return cls(enclosed.lower(), enclosed.upper())

    @classmethod
    def rational_range(cls, lower: fmpq, upper: fmpq) -> "Interval":
        return cls(arb(lower).lower(), arb(upper).upper())

    def bounds(self) -> dict[str, str]:
        return {"min": str(self.lo.fmpq()), "max": str(self.hi.fmpq())}

    def __neg__(self) -> "Interval":
        return Interval(-self.hi, -self.lo)

    def __add__(self, other: "Interval") -> "Interval":
        return Interval((self.lo + other.lo).lower(), (self.hi + other.hi).upper())

    def __sub__(self, other: "Interval") -> "Interval":
        return self + -other

    def __mul__(self, other: "Interval") -> "Interval":
        products = [a * b for a in (self.lo, self.hi) for b in (other.lo, other.hi)]
        return Interval(min(p.lower() for p in products), max(p.upper() for p in products))

    def square(self) -> "Interval":
        ends = (self.lo * self.lo, self.hi * self.hi)
        lower = arb(0) if self.lo <= 0 <= self.hi else min(p.lower() for p in ends)
        return Interval(lower, max(p.upper() for p in ends))

    def reciprocal(self) -> "Interval":
        if self.lo == 0 == self.hi:
            raise CertificationFailure("rejected", "invalid-domain")
        if self.lo <= 0 <= self.hi:
            raise NeedsSubdivision()
        return Interval((1 / self.hi).lower(), (1 / self.lo).upper())

    def __truediv__(self, other: "Interval") -> "Interval":
        return self * other.reciprocal()

    def exp(self) -> "Interval":
        if self.lo < -256 or self.hi > 256:
            raise CertificationFailure("unverified", "resource-limit")
        return Interval(self.lo.exp().lower(), self.hi.exp().upper())

    def log(self) -> "Interval":
        if self.hi <= 0:
            raise CertificationFailure("rejected", "invalid-domain")
        if self.lo <= 0:
            raise NeedsSubdivision()
        return Interval(self.lo.log().lower(), self.hi.log().upper())

    def sqrt(self) -> "Interval":
        if self.hi < 0:
            raise CertificationFailure("rejected", "invalid-domain")
        if self.lo <= 0:
            reason = "non-smooth-boundary" if self.lo == 0 == self.hi else "inconclusive-domain"
            raise NeedsSubdivision(reason)
        return Interval(self.lo.sqrt().lower(), self.hi.sqrt().upper())
