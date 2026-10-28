import json

import briscolab_engine
import pytest

from briscolab_lab.arena import Config, run, to_json


def test_the_engine_knows_the_bots() -> None:
    assert briscolab_engine.bot_names() == ["random", "greedy", "hard", "endgame", "pimc"]
    for bad in ("nobody", "pimc:0", "pimc:x"):
        with pytest.raises(ValueError):
            briscolab_engine.play_duplicates([0], "random", bad)


def test_a_bot_against_itself_splits_a_duplicate_deal() -> None:
    for first, second in briscolab_engine.play_duplicates(list(range(20)), "greedy", "greedy"):
        assert first + second == 120


def test_parallel_deals_come_back_in_the_order_of_the_seeds() -> None:
    seeds = list(range(40))
    together = briscolab_engine.play_duplicates(seeds, "pimc:3", "hard")
    one_by_one = [briscolab_engine.play_duplicates([s], "pimc:3", "hard")[0] for s in seeds]
    assert together == one_by_one


def test_a_round_robin_is_reproducible() -> None:
    config = Config(bots=("random", "greedy", "hard"), deals=200)
    assert run(config) == run(config)


def test_a_round_robin_plays_every_pair_once() -> None:
    results = run(Config(bots=("random", "greedy", "hard"), deals=200))
    assert [(p.a, p.b) for p in results.pairs] == [
        ("random", "greedy"),
        ("random", "hard"),
        ("greedy", "hard"),
    ]
    assert set(results.ratings) == {"random", "greedy", "hard"}


def test_the_json_carries_what_reproduces_the_run() -> None:
    results = run(Config(bots=("random", "hard"), deals=50, first_seed=7))
    data = json.loads(to_json(results))
    assert data["config"] == {"bots": ["random", "hard"], "deals": 50, "first_seed": 7}
    assert data["engine_version"] == briscolab_engine.__version__


def test_a_round_robin_needs_two_distinct_bots() -> None:
    with pytest.raises(ValueError):
        run(Config(bots=("hard", "hard"), deals=10))
