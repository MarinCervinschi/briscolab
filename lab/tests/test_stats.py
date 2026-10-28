import math

import pytest

from briscolab_lab.stats import (
    Interval,
    bradley_terry,
    deal_margin,
    deal_score,
    game_score,
    mean_interval,
)


def test_mean_interval_matches_the_textbook_formula() -> None:
    interval = mean_interval([1.0, 2.0, 3.0, 4.0])
    half = 1.959963984540054 * math.sqrt(5 / 3) / 2
    assert interval.mean == 2.5
    assert interval.low == pytest.approx(2.5 - half)
    assert interval.high == pytest.approx(2.5 + half)


def test_mean_interval_needs_two_samples() -> None:
    with pytest.raises(ValueError):
        mean_interval([1.0])


def test_an_interval_excludes_values_outside_it() -> None:
    interval = Interval(0.55, 0.52, 0.58)
    assert interval.excludes(0.5)
    assert not interval.excludes(0.53)


def test_more_than_60_points_wins_and_60_is_a_draw() -> None:
    assert [game_score(p) for p in (61, 60, 59, 120, 0)] == [1.0, 0.5, 0.0, 1.0, 0.0]


def test_a_deal_counts_both_games() -> None:
    assert deal_score(70, 50) == 0.5
    assert deal_score(70, 60) == 0.75
    assert deal_margin(70, 50) == 0.0
    assert deal_margin(80, 70) == 30.0


def test_bradley_terry_gives_equal_players_equal_ratings() -> None:
    ratings = bradley_terry({("a", "b"): (50.0, 100)})
    assert ratings["a"] == pytest.approx(0.0, abs=1e-6)
    assert ratings["b"] == pytest.approx(0.0, abs=1e-6)


def test_bradley_terry_turns_3_to_1_odds_into_191_points() -> None:
    ratings = bradley_terry({("a", "b"): (75.0, 100)})
    assert ratings["a"] - ratings["b"] == pytest.approx(400 * math.log10(3), abs=1e-6)


def test_bradley_terry_recovers_the_strengths_behind_exact_scores() -> None:
    strength = {"a": 1.0, "b": 2.0, "c": 4.0}
    n = 1000
    results = {
        (x, y): (n * strength[x] / (strength[x] + strength[y]), n)
        for x, y in [("a", "b"), ("a", "c"), ("b", "c")]
    }
    ratings = bradley_terry(results)
    step = 400 * math.log10(2)
    assert ratings["b"] - ratings["a"] == pytest.approx(step, abs=1e-6)
    assert ratings["c"] - ratings["b"] == pytest.approx(step, abs=1e-6)
    assert sum(ratings.values()) == pytest.approx(0.0, abs=1e-6)


def test_bradley_terry_rejects_a_player_that_won_every_deal() -> None:
    with pytest.raises(ValueError):
        bradley_terry({("a", "b"): (100.0, 100)})
