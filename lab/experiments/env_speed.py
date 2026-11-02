"""Choices and games per second of the batched environment, numpy picking a random legal card."""

import sys
import time

import numpy as np

from briscolab_lab.env import TrainingEnv


def measure(opponents: list[str], seconds: float = 5.0) -> None:
    env = TrainingEnv(opponents, seed=0)
    rng = np.random.default_rng(0)
    step = env.reset()
    steps, games = 0, 0
    start = time.perf_counter()
    while time.perf_counter() - start < seconds:
        scores = np.where(step.masks, rng.random(step.masks.shape), -1.0)
        step = env.step(np.argmax(scores, axis=1))
        steps += 1
        games += int(step.done.sum())
    elapsed = time.perf_counter() - start
    print(
        f"{len(opponents)} games ({', '.join(sorted(set(opponents)))}): "
        f"{steps * len(opponents) / elapsed:,.0f} choices/s, {games / elapsed:,.0f} games/s"
    )


if __name__ == "__main__":
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 512
    measure(["self"] * n)
    measure(["hard"] * n)
    measure(["self"] * (n // 2) + ["hard"] * (n // 4) + ["greedy"] * (n // 4))
