"""The engine's batched training games as numpy arrays."""

from dataclasses import dataclass

import briscolab_engine
import numpy as np
import numpy.typing as npt

ENCODING_LEN = 204
"""The inputs of the `pooled` encoding, the champion's."""
CARDS = 40
HIDDEN_LEN = 80
"""The numbers of `Step.hidden`."""


@dataclass(frozen=True)
class Step:
    """What every game shows after a batch of cards.

    `done` and `rewards` describe a game that ended with this step.
    """

    obs: npt.NDArray[np.float32]
    """`[n, inputs]`: each game's encoded observation, from the side of the seat to play."""
    masks: npt.NDArray[np.bool_]
    """`[n, 40]`: the cards that seat may play."""
    seats: npt.NDArray[np.uint8]
    """`[n]`: the seat to play, 0 or 1."""
    hidden: npt.NDArray[np.float32]
    """`[n, 80]`: what that seat cannot see, the opponent's hand and the stock's order. For a critic
    in training only, never for the network that plays."""
    done: npt.NDArray[np.bool_]
    """`[n]`: whether the game in that slot ended with this step and a new deal took its place."""
    rewards: npt.NDArray[np.float32]
    """`[n, 2]`: +1, 0 or -1 per seat for the game that ended, 0 elsewhere."""
    points: npt.NDArray[np.uint8]
    """`[n, 2]`: each seat's points in the game that ended, 0 elsewhere."""


class TrainingEnv:
    """One slot per opponent: `self` for self-play, or a bot name such as `hard` or `ppo:<file>`.

    `encoding` is `pooled` (204 inputs) or `by-seat` (244, the played cards split by who played
    them).
    """

    def __init__(self, opponents: list[str], seed: int, encoding: str = "pooled") -> None:
        self._env = briscolab_engine.VecEnv(opponents, seed, encoding)
        self.n = len(opponents)
        self.inputs: int = self._env.inputs
        self.first_seed = seed

    @property
    def next_seed(self) -> int:
        return self._env.next_seed

    def reset(self) -> Step:
        return self._step(*self._env.observe(), bytes(self.n), bytes(self.n * 8), bytes(self.n * 2))

    def step(self, cards: npt.NDArray[np.integer]) -> Step:
        return self._step(*self._env.step(cards.astype(np.uint8).tobytes()))

    def _step(
        self,
        obs: bytes,
        masks: bytes,
        seats: bytes,
        hidden: bytes,
        done: bytes,
        rewards: bytes,
        points: bytes,
    ) -> Step:
        return Step(
            # Copied, since an array over bytes is read-only and PyTorch wants to own what it reads.
            obs=np.frombuffer(obs, dtype="<f4").reshape(self.n, self.inputs).copy(),
            masks=np.frombuffer(masks, dtype=np.uint8).reshape(self.n, CARDS).astype(np.bool_),
            seats=np.frombuffer(seats, dtype=np.uint8),
            hidden=np.frombuffer(hidden, dtype="<f4").reshape(self.n, HIDDEN_LEN).copy(),
            done=np.frombuffer(done, dtype=np.uint8).astype(np.bool_),
            rewards=np.frombuffer(rewards, dtype="<f4").reshape(self.n, 2),
            points=np.frombuffer(points, dtype=np.uint8).reshape(self.n, 2),
        )
