"""A round robin of duplicate deals between bots, and its results."""

import json
from dataclasses import asdict, dataclass, field
from itertools import combinations

import briscolab_engine

from briscolab_lab.stats import Interval, bradley_terry, deal_margin, deal_score, mean_interval


@dataclass(frozen=True)
class Config:
    """Every pair of `bots` plays the same `deals` duplicate deals, seeded from `first_seed` up."""

    bots: tuple[str, ...]
    deals: int
    first_seed: int = 0

    def seeds(self) -> range:
        return range(self.first_seed, self.first_seed + self.deals)


@dataclass(frozen=True)
class PairResult:
    """How `a` did against `b`: the score per deal (0 to 1) and the point difference per game."""

    a: str
    b: str
    deals: int
    score: Interval
    margin: Interval
    total_score: float

    def decisive(self) -> bool:
        """Whether the score's interval excludes 50%, the bar for one bot to replace another."""
        return self.score.excludes(0.5)


@dataclass(frozen=True)
class Results:
    config: Config
    engine_version: str
    pairs: tuple[PairResult, ...]
    ratings: dict[str, float]
    git_commit: str | None = field(default=None)


def play_pair(a: str, b: str, seeds: range) -> PairResult:
    games = briscolab_engine.play_duplicates(list(seeds), a, b)
    scores = [deal_score(first, second) for first, second in games]
    margins = [deal_margin(first, second) for first, second in games]
    return PairResult(
        a=a,
        b=b,
        deals=len(seeds),
        score=mean_interval(scores),
        margin=mean_interval(margins),
        total_score=sum(scores),
    )


def run(config: Config) -> Results:
    """Plays the round robin. The same config gives the same results."""
    if len(set(config.bots)) != len(config.bots) or len(config.bots) < 2:
        raise ValueError("a round robin needs at least two distinct bots")
    pairs = tuple(play_pair(a, b, config.seeds()) for a, b in combinations(config.bots, 2))
    ratings = bradley_terry({(p.a, p.b): (p.total_score, p.deals) for p in pairs})
    return Results(
        config=config,
        engine_version=briscolab_engine.__version__,
        pairs=pairs,
        ratings=ratings,
    )


def to_json(results: Results) -> str:
    return json.dumps(asdict(results), indent=2, sort_keys=True) + "\n"


def report(results: Results) -> str:
    """The results as a plain-text table, ratings first."""
    lines = [
        f"{results.config.deals} duplicate deals per pair, seeds from {results.config.first_seed}, "
        f"engine {results.engine_version}",
        "",
        "rating (Elo scale, centred on 0)",
    ]
    for name, rating in sorted(results.ratings.items(), key=lambda r: -r[1]):
        lines.append(f"  {name:<10} {rating:+7.1f}")
    lines += ["", "pair                   score [95% interval]     points per game [95% interval]"]
    for p in results.pairs:
        mark = "" if p.decisive() else "   not decisive"
        lines.append(
            f"  {p.a + ' vs ' + p.b:<20} "
            f"{100 * p.score.mean:5.1f}% [{100 * p.score.low:5.1f}, {100 * p.score.high:5.1f}]   "
            f"{p.margin.mean:+6.1f} [{p.margin.low:+6.1f}, {p.margin.high:+6.1f}]{mark}"
        )
    return "\n".join(lines) + "\n"
