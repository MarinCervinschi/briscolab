# torch has no type annotations for these calls; strict mode cannot follow them.
# pyright: reportUnknownMemberType=false, reportUnknownVariableType=false
# pyright: reportUnknownArgumentType=false

from pathlib import Path

import briscolab_engine
import numpy as np
import torch

from briscolab_lab.env import TrainingEnv
from briscolab_lab.ppo import (
    Agent,
    Batch,
    Config,
    Decision,
    Pool,
    config_from_args,
    finish,
    make_parser,
    train,
    weights_bytes,
)


def test_the_engine_scores_cards_as_pytorch_does() -> None:
    torch.manual_seed(0)
    agent = Agent(hidden=32, layers=2)
    obs = TrainingEnv(["self", "hard"] * 8, seed=0).reset().obs
    with torch.no_grad():
        expected = agent(torch.from_numpy(obs))[0].numpy()
    out = briscolab_engine.network_forward(weights_bytes(agent), obs.astype("<f4").tobytes())
    engine = np.frombuffer(out, dtype="<f4").reshape(expected.shape)
    np.testing.assert_allclose(engine, expected, rtol=1e-5, atol=1e-5)


def decision(value: float) -> Decision:
    return Decision(np.zeros(204, np.float32), np.ones(40, np.bool_), 0, 0.0, value)


def test_without_discount_every_decision_returns_the_games_result() -> None:
    batch = Batch()
    finish([decision(0.2), decision(-0.1), decision(0.5)], reward=1.0, lam=1.0, batch=batch)
    assert batch.returns == [1.0, 1.0, 1.0]
    np.testing.assert_allclose(batch.advantages, [0.8, 1.1, 0.5])


def test_the_pool_fills_its_shares_of_the_games(tmp_path: Path) -> None:
    pool = Pool(Config(games=12), tmp_path)
    assert pool.opponents() == ["self"] * 10 + ["greedy", "hard"]
    pool.add(Agent(hidden=8, layers=1), update=1)
    opponents = pool.opponents()
    assert opponents.count("self") == 6
    assert sum(o.startswith("ppo:") for o in opponents) == 4
    assert opponents[-2:] == ["greedy", "hard"]


def test_the_pool_keeps_only_its_last_snapshots_on_disk(tmp_path: Path) -> None:
    pool = Pool(Config(snapshots=3), tmp_path)
    agent = Agent(hidden=8, layers=1)
    for update in range(1, 6):
        pool.add(agent, update)
    assert sorted(p.name for p in (tmp_path / "snapshots").iterdir()) == [
        "update-3.brnn",
        "update-4.brnn",
        "update-5.brnn",
    ]


def test_a_short_run_leaves_weights_the_engine_plays(tmp_path: Path) -> None:
    config = Config(
        games=16,
        samples=256,
        minibatch=128,
        hidden=16,
        snapshot_every=1,
        eval_every=2,
        pimc_every=2,
        eval_deals=10,
        minutes=0.05,
        threads=1,
        anneal=True,
        encoding="by-seat",
    )
    best = train(config, tmp_path)
    assert (tmp_path / "snapshots").is_dir()
    results = briscolab_engine.play_duplicates(list(range(10)), f"ppo:{best}", "hard")
    assert all(a + b <= 240 for a, b in results)


def test_every_config_field_has_a_flag() -> None:
    args = make_parser().parse_args(
        [
            "--run-name",
            "x",
            "--hidden",
            "512",
            "--anneal",
            "--rule-bots",
            "ppo",
            "hard",
            "--encoding",
            "by-seat",
        ]
    )
    config = config_from_args(args)
    assert config == Config(hidden=512, anneal=True, rule_bots=("ppo", "hard"), encoding="by-seat")
    assert config_from_args(make_parser().parse_args(["--run-name", "x"])) == Config()
