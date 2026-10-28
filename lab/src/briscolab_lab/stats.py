"""Statistics of duplicate deals: scores, means with 95% intervals, Bradley-Terry ratings."""

import math
from collections.abc import Mapping, Sequence
from dataclasses import dataclass

TOTAL_POINTS = 120
Z_95 = 1.959963984540054


@dataclass(frozen=True)
class Interval:
    mean: float
    low: float
    high: float

    def excludes(self, value: float) -> bool:
        return value < self.low or value > self.high


def mean_interval(samples: Sequence[float]) -> Interval:
    """The mean of the samples with its 95% interval, by the normal approximation.

    Needs at least two samples; the approximation is sound from a few hundred.
    """
    n = len(samples)
    if n < 2:
        raise ValueError("an interval needs at least two samples")
    mean = math.fsum(samples) / n
    variance = math.fsum((x - mean) ** 2 for x in samples) / (n - 1)
    half = Z_95 * math.sqrt(variance / n)
    return Interval(mean, mean - half, mean + half)


def game_score(points: int) -> float:
    """1 for a win (more than 60 points), 0.5 for 60-60, 0 for a loss."""
    half = TOTAL_POINTS // 2
    if points > half:
        return 1.0
    return 0.5 if points == half else 0.0


def deal_score(first: int, second: int) -> float:
    """A bot's score from 0 to 1 over the two games of a duplicate deal, from its points in each."""
    return (game_score(first) + game_score(second)) / 2


def deal_margin(first: int, second: int) -> float:
    """A bot's average point difference per game over the two games of a duplicate deal."""
    return float(first + second - TOTAL_POINTS)


def bradley_terry(
    results: Mapping[tuple[str, str], tuple[float, int]],
    iterations: int = 10_000,
    tolerance: float = 1e-12,
) -> dict[str, float]:
    """Ratings on the Elo scale from pairwise results, by Hunter's MM algorithm (2004).

    `results[(a, b)]` is a's total score against b and the number of deals they played.
    The ratings are centred on 0; a gap of 400 means 10 to 1 odds.
    Raises ValueError for a player that won or lost every deal, whose rating would be infinite.
    """
    players = sorted({p for pair in results for p in pair})
    wins = dict.fromkeys(players, 0.0)
    games: dict[tuple[str, str], int] = {}
    for (a, b), (score, deals) in results.items():
        wins[a] += score
        wins[b] += deals - score
        games[(a, b)] = games.get((a, b), 0) + deals
        games[(b, a)] = games.get((b, a), 0) + deals
    for p in players:
        total = sum(n for (x, _), n in games.items() if x == p)
        if not 0 < wins[p] < total:
            raise ValueError(f"{p} won or lost every deal: no finite rating")

    strength = dict.fromkeys(players, 1.0)
    for _ in range(iterations):
        updated = {
            p: wins[p]
            / sum(n / (strength[p] + strength[q]) for (x, q), n in games.items() if x == p)
            for p in players
        }
        # The model fixes only ratios; the geometric mean is pinned to 1 so the iteration converges.
        scale = math.exp(math.fsum(math.log(s) for s in updated.values()) / len(players))
        updated = {p: s / scale for p, s in updated.items()}
        converged = max(abs(updated[p] - strength[p]) for p in players) < tolerance
        strength = updated
        if converged:
            break
    return {p: 400 * math.log10(s) for p, s in strength.items()}
