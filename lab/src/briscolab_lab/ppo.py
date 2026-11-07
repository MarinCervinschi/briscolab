"""PPO in self-play for the network bot, CleanRL-style: one file, to be read from top to bottom.

The network chooses the card while the deck lasts and the engine's solver plays the last three
tricks (decisions 18 to 25 in SPEC.md). Training uses whole games only: a game's decisions are kept
until it ends, then its reward flows back to every decision of each seat. The reward is the result,
+1, 0 or -1, mixed with the point difference when `points_weight` is above 0.
"""

# torch.distributions has no type annotations, so strict mode cannot follow the losses built on it.
# pyright: reportUnknownMemberType=false, reportUnknownVariableType=false
# pyright: reportUnknownArgumentType=false

import argparse
import dataclasses
import json
import os
import struct
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from itertools import pairwise
from pathlib import Path
from typing import Any

import briscolab_engine
import numpy as np
import numpy.typing as npt
import torch
from torch import nn

from briscolab_lab.__main__ import git_commit
from briscolab_lab.env import CARDS, ENCODING_LEN, HIDDEN_LEN, TrainingEnv
from briscolab_lab.stats import Interval, deal_score, mean_interval

# Far from the arena's seeds, which start at 0: the final verdict plays deals no checkpoint was
# chosen on.
EVAL_FIRST_SEED = 1_000_000


@dataclass(frozen=True)
class Config:
    seed: int = 0
    games: int = 512
    """Games stepped together, one per slot of the opponent pool."""
    self_share: float = 0.5
    snapshot_share: float = 1 / 3
    rule_bots: tuple[str, ...] = ("greedy", "hard")
    """They share the slots left after self-play and the snapshots."""
    snapshots: int = 10
    snapshot_every: int = 20
    """Updates between two snapshots; the pool's games are dealt afresh then."""
    encoding: str = "pooled"
    """`pooled` or `by-seat`, which splits the played cards by who played them."""
    hidden: int = 256
    layers: int = 2
    informed_critic: bool = False
    """The value comes from a network of its own that also reads what the seat cannot see."""
    points_weight: float = 0.0
    """The reward is `(1 - w)` times the result plus `w` times the point difference over 120."""
    learning_rate: float = 3e-4
    anneal: bool = False
    """The learning rate falls linearly from `learning_rate` to 0 at the end of `minutes`."""
    gae_lambda: float = 0.95
    clip: float = 0.2
    entropy: float = 0.01
    value_weight: float = 0.5
    max_grad_norm: float = 0.5
    samples: int = 32_768
    """Decisions collected for each update."""
    epochs: int = 4
    minibatch: int = 4096
    eval_every: int = 10
    """Updates between two evaluations against Hard; PIMC, at 30 s a time, every `pimc_every`."""
    pimc_every: int = 50
    eval_deals: int = 1000
    minutes: float = 480.0
    threads: int = field(default_factory=lambda: os.cpu_count() or 1)


def mlp(sizes: list[int]) -> nn.ModuleList:
    return nn.ModuleList(nn.Linear(a, b) for a, b in pairwise(sizes))


def relu_through(layers: nn.ModuleList, x: torch.Tensor) -> torch.Tensor:
    for layer in layers:
        x = torch.relu(layer(x))
    return x


class Agent(nn.Module):
    """A trunk of ReLU layers with two heads: a score per card, and the value of the position.

    With `informed` the value comes from a second trunk that also reads what the seat cannot see;
    the engine's weights file holds only the first trunk and the scores, so the bot never does.
    """

    def __init__(
        self, hidden: int, layers: int, inputs: int = ENCODING_LEN, informed: bool = False
    ) -> None:
        super().__init__()
        self.trunk = mlp([inputs] + [hidden] * layers)
        self.policy = nn.Linear(hidden, CARDS)
        self.critic = mlp([inputs + HIDDEN_LEN] + [hidden] * layers) if informed else None
        self.value = nn.Linear(hidden, 1)

    def forward(self, obs: torch.Tensor, unseen: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        x = relu_through(self.trunk, obs)
        v = x if self.critic is None else relu_through(self.critic, torch.cat([obs, unseen], -1))
        return self.policy(x), self.value(v).squeeze(-1)


def masked(logits: torch.Tensor, masks: torch.Tensor) -> torch.Tensor:
    return logits.masked_fill(~masks, -1e9)


def weights_bytes(agent: Agent) -> bytes:
    """The trunk and the policy head in the engine's weights file (engine/core/src/network.rs)."""
    layers: list[nn.Linear] = [*agent.trunk, agent.policy]  # pyright: ignore[reportAssignmentType]
    out = bytearray(b"BRNN" + struct.pack("<II", 1, len(layers)))
    for layer in layers:
        weight = layer.weight.detach().cpu().numpy().astype("<f4")
        bias = layer.bias.detach().cpu().numpy().astype("<f4")
        out += struct.pack("<II", weight.shape[1], weight.shape[0])
        out += weight.tobytes() + bias.tobytes()
    return bytes(out)


@dataclass
class Batch:
    obs: list[npt.NDArray[np.float32]] = field(default_factory=lambda: [])
    unseen: list[npt.NDArray[np.float32]] = field(default_factory=lambda: [])
    masks: list[npt.NDArray[np.bool_]] = field(default_factory=lambda: [])
    actions: list[int] = field(default_factory=lambda: [])
    logprobs: list[float] = field(default_factory=lambda: [])
    advantages: list[float] = field(default_factory=lambda: [])
    returns: list[float] = field(default_factory=lambda: [])

    def __len__(self) -> int:
        return len(self.actions)


@dataclass
class Decision:
    obs: npt.NDArray[np.float32]
    unseen: npt.NDArray[np.float32]
    mask: npt.NDArray[np.bool_]
    action: int
    logprob: float
    value: float


def finish(chain: list[Decision], reward: float, lam: float, batch: Batch) -> None:
    """Adds one seat's decisions in a finished game to the batch, with GAE and no discount."""
    advantage = 0.0
    next_value = 0.0
    out: list[tuple[float, float]] = []
    for i in reversed(range(len(chain))):
        r = reward if i == len(chain) - 1 else 0.0
        delta = r + next_value - chain[i].value
        advantage = delta + lam * advantage
        out.append((advantage, advantage + chain[i].value))
        next_value = chain[i].value
    for d, (adv, ret) in zip(chain, reversed(out), strict=True):
        batch.obs.append(d.obs)
        batch.unseen.append(d.unseen)
        batch.masks.append(d.mask)
        batch.actions.append(d.action)
        batch.logprobs.append(d.logprob)
        batch.advantages.append(adv)
        batch.returns.append(ret)


class Pool:
    """The opponents of the games: self-play, the latest snapshots, the rule bots."""

    def __init__(self, config: Config, run_dir: Path) -> None:
        self.config = config
        self.dir = run_dir / "snapshots"
        self.dir.mkdir(parents=True, exist_ok=True)
        self.files: list[Path] = []
        self.taken = 0

    def add(self, agent: Agent, update: int) -> None:
        path = self.dir / f"update-{update}.brnn"
        path.write_bytes(weights_bytes(agent))
        self.files = [*self.files, path]
        # Only the last few play in the pool; the older ones would fill the disk over a night.
        for old in self.files[: -self.config.snapshots]:
            old.unlink()
        self.files = self.files[-self.config.snapshots :]

    def opponents(self) -> list[str]:
        c = self.config
        n_self = round(c.games * c.self_share)
        n_snap = round(c.games * c.snapshot_share)
        rest = c.games - n_self - n_snap
        # Until the first snapshot exists, its slots play the current network.
        snaps = (
            [f"ppo:{self.files[i % len(self.files)]}" for i in range(n_snap)] if self.files else []
        )
        out = ["self"] * (n_self + n_snap - len(snaps)) + snaps
        out += [c.rule_bots[i % len(c.rule_bots)] for i in range(rest)]
        return out


class Collector:
    """Steps the pool's games with the current network and hands over finished games' decisions."""

    def __init__(self, config: Config, seed: int) -> None:
        self.config = config
        self.next_seed = seed
        self.env: TrainingEnv | None = None
        self.chains: list[list[list[Decision]]] = []

    def deal(self, opponents: list[str]) -> None:
        """New games against these opponents; games still in play are dropped."""
        if self.env:
            self.next_seed = self.env.next_seed
        self.env = TrainingEnv(opponents, self.next_seed, self.config.encoding)
        self.step = self.env.reset()
        self.chains = [[[], []] for _ in opponents]

    def collect(self, agent: Agent) -> tuple[Batch, int]:
        assert self.env
        batch, games = Batch(), 0
        while len(batch) < self.config.samples:
            step = self.step
            with torch.no_grad():
                logits, values = agent(torch.from_numpy(step.obs), torch.from_numpy(step.hidden))
                dist = torch.distributions.Categorical(
                    logits=masked(logits, torch.from_numpy(step.masks))
                )
                sampled = dist.sample()
                logprobs = dist.log_prob(sampled).numpy()
            actions = sampled.numpy()
            for i in range(len(actions)):
                self.chains[i][step.seats[i]].append(
                    Decision(
                        step.obs[i],
                        step.hidden[i],
                        step.masks[i],
                        int(actions[i]),
                        float(logprobs[i]),
                        float(values[i]),
                    )
                )
            self.step = self.env.step(actions)
            for i in np.flatnonzero(self.step.done):
                games += 1
                for seat in (0, 1):
                    if self.chains[i][seat]:
                        finish(
                            self.chains[i][seat],
                            self.reward(int(i), seat),
                            self.config.gae_lambda,
                            batch,
                        )
                self.chains[i] = [[], []]
        return batch, games

    def reward(self, slot: int, seat: int) -> float:
        w = self.config.points_weight
        points = self.step.points[slot].astype(np.float32)
        difference = float(points[seat] - points[1 - seat]) / 120
        return (1 - w) * float(self.step.rewards[slot, seat]) + w * difference


def update(
    agent: Agent, optimizer: torch.optim.Optimizer, batch: Batch, config: Config
) -> dict[str, float]:
    obs = torch.from_numpy(np.stack(batch.obs))
    unseen = torch.from_numpy(np.stack(batch.unseen))
    masks = torch.from_numpy(np.stack(batch.masks))
    actions = torch.tensor(batch.actions)
    old_logprobs = torch.tensor(batch.logprobs, dtype=torch.float32)
    advantages = torch.tensor(batch.advantages, dtype=torch.float32)
    advantages = (advantages - advantages.mean()) / (advantages.std() + 1e-8)
    returns = torch.tensor(batch.returns, dtype=torch.float32)
    stats: dict[str, float] = {}
    for _ in range(config.epochs):
        for idx in torch.randperm(len(batch)).split(config.minibatch):
            logits, values = agent(obs[idx], unseen[idx])
            dist = torch.distributions.Categorical(logits=masked(logits, masks[idx]))
            ratio = (dist.log_prob(actions[idx]) - old_logprobs[idx]).exp()
            adv = advantages[idx]
            policy_loss = -torch.min(
                ratio * adv, ratio.clamp(1 - config.clip, 1 + config.clip) * adv
            ).mean()
            value_loss = (values - returns[idx]).pow(2).mean()
            entropy = dist.entropy().mean()
            loss = policy_loss + config.value_weight * value_loss - config.entropy * entropy
            optimizer.zero_grad()
            loss.backward()  # pyright: ignore[reportUnknownMemberType]
            nn.utils.clip_grad_norm_(agent.parameters(), config.max_grad_norm)
            optimizer.step()  # pyright: ignore[reportUnknownMemberType]
            stats = {
                "loss/policy": policy_loss.item(),
                "loss/value": value_loss.item(),
                "entropy": entropy.item(),
            }
    return stats


def evaluate(weights: Path, bot: str, deals: int) -> Interval:
    """The network's score against `bot` over `deals` duplicate deals, with its 95% interval."""
    seeds = list(range(EVAL_FIRST_SEED, EVAL_FIRST_SEED + deals))
    results = briscolab_engine.play_duplicates(seeds, f"ppo:{weights}", bot)
    return mean_interval([deal_score(a, b) for a, b in results])


def train(
    config: Config,
    run_dir: Path,
    log: Callable[[dict[str, float], int], None] = lambda metrics, update: None,
) -> Path:
    """Trains until `config.minutes` have passed or the run is stopped; returns the best weights.

    The best is the one that scored highest against PIMC, or the last one if PIMC was never played.
    """
    torch.manual_seed(config.seed)
    torch.set_num_threads(config.threads)
    pool = Pool(config, run_dir)
    collector = Collector(config, seed=config.seed << 32)
    collector.deal(pool.opponents())
    assert collector.env
    agent = Agent(config.hidden, config.layers, collector.env.inputs, config.informed_critic)
    optimizer = torch.optim.Adam(agent.parameters(), lr=config.learning_rate, eps=1e-5)
    current, best = run_dir / "current.brnn", run_dir / "best.brnn"
    best_score = -1.0
    games = 0
    start = time.monotonic()
    n = 0
    try:
        while time.monotonic() - start < config.minutes * 60:
            n += 1
            if config.anneal:
                left = 1 - (time.monotonic() - start) / (config.minutes * 60)
                for group in optimizer.param_groups:
                    group["lr"] = config.learning_rate * max(left, 0.0)
            batch, played = collector.collect(agent)
            games += played
            stats = update(agent, optimizer, batch, config)
            if n % config.snapshot_every == 0:
                pool.add(agent, n)
                collector.deal(pool.opponents())
            if n % config.eval_every == 0:
                current.write_bytes(weights_bytes(agent))
                lr = float(optimizer.param_groups[0]["lr"])
                metrics = {**stats, "games": float(games), "learning_rate": lr}
                bots = ["hard", "pimc"] if n % config.pimc_every == 0 else ["hard"]
                for bot in bots:
                    score = evaluate(current, bot, config.eval_deals)
                    metrics |= {f"score/{bot}": score.mean, f"score_low/{bot}": score.low}
                    if bot == "pimc" and score.mean > best_score:
                        best_score = score.mean
                        best.write_bytes(current.read_bytes())
                minutes = (time.monotonic() - start) / 60
                print(
                    f"update {n} · {games:,} games · {minutes:.0f} min · "
                    + " · ".join(
                        f"{k} {v:.3f}" for k, v in metrics.items() if k.startswith("score/")
                    )
                )
                log(metrics, n)
    except KeyboardInterrupt:
        print("stopped")
    current.write_bytes(weights_bytes(agent))
    if not best.exists():
        best.write_bytes(current.read_bytes())
    return best


def make_parser() -> argparse.ArgumentParser:
    """The command's flags: the run's name, MLflow, and one flag per field of `Config`."""
    parser = argparse.ArgumentParser(prog="briscolab-ppo", description=__doc__)
    parser.add_argument(
        "--run-name", required=True, help="the run's folder under runs/ and its MLflow name"
    )
    parser.add_argument("--mlflow", action="store_true", help="log the run to MLFLOW_TRACKING_URI")
    defaults = Config()
    for f in dataclasses.fields(Config):
        flag = "--" + f.name.replace("_", "-")
        default = getattr(defaults, f.name)
        if f.type is bool:
            parser.add_argument(flag, action=argparse.BooleanOptionalAction, default=default)
        elif isinstance(default, tuple):
            parser.add_argument(flag, nargs="+", default=list(default))
        else:
            parser.add_argument(flag, type=type(default), default=default)
    return parser


def config_from_args(args: argparse.Namespace) -> Config:
    values: dict[str, Any] = {f.name: getattr(args, f.name) for f in dataclasses.fields(Config)}
    values["rule_bots"] = tuple(values["rule_bots"])
    return Config(**values)


def main() -> None:
    parser = make_parser()
    args = parser.parse_args()
    if args.mlflow and not os.environ.get("MLFLOW_TRACKING_URI"):
        parser.error("--mlflow needs MLFLOW_TRACKING_URI")
    config = config_from_args(args)
    run_dir = Path("runs") / args.run_name
    run_dir.mkdir(parents=True, exist_ok=True)
    params = dataclasses.asdict(config)
    commit = git_commit()
    record = {
        "config": params,
        "engine_version": briscolab_engine.__version__,
        "git_commit": commit,
        "eval_first_seed": EVAL_FIRST_SEED,
    }
    (run_dir / "config.json").write_text(json.dumps(record, indent=2) + "\n")
    if not args.mlflow:
        train(config, run_dir)
        return
    import mlflow

    mlflow.set_experiment("briscolab-ppo")  # pyright: ignore[reportUnknownMemberType]
    with mlflow.start_run(run_name=args.run_name):
        mlflow.log_params(params | {"engine_version": briscolab_engine.__version__})
        if commit:
            mlflow.set_tag("mlflow.source.git.commit", commit)

        def log(metrics: dict[str, float], update: int) -> None:
            mlflow.log_metrics(metrics, step=update)

        best = train(config, run_dir, log)
        mlflow.log_artifact(str(run_dir / "config.json"))
        mlflow.log_artifact(str(best))
        mlflow.log_artifact(str(run_dir / "current.brnn"))


if __name__ == "__main__":
    main()
