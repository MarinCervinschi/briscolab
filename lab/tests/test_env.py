import numpy as np
import pytest

from briscolab_lab.env import TrainingEnv


def first_legal(masks: np.ndarray) -> np.ndarray:
    return np.argmax(masks, axis=1)


def test_every_game_shows_a_legal_choice_from_the_seat_to_play() -> None:
    env = TrainingEnv(["self", "hard", "greedy"], seed=0)
    step = env.reset()
    for _ in range(200):
        assert step.obs.shape == (3, 204)
        assert step.masks.any(axis=1).all()
        # The hand is the first set of 40 in the encoding, and the legal cards are the hand.
        assert (step.obs[:, :40].astype(bool) == step.masks).all()
        step = env.step(first_legal(step.masks))


def test_the_by_seat_encoding_splits_the_played_cards_of_the_pooled_one() -> None:
    pooled = TrainingEnv(["hard"], seed=3)
    by_seat = TrainingEnv(["hard"], seed=3, encoding="by-seat")
    a, b = pooled.reset(), by_seat.reset()
    for _ in range(30):
        assert b.obs.shape == (1, 244)
        # Pooled: hand, table, played...; by seat: hand, table, played by me, by the opponent...
        np.testing.assert_array_equal(a.obs[:, 80:120], b.obs[:, 80:120] + b.obs[:, 120:160])
        np.testing.assert_array_equal(a.obs[:, 120:], b.obs[:, 160:])
        a, b = pooled.step(first_legal(a.masks)), by_seat.step(first_legal(b.masks))


def test_a_finished_game_pays_its_seats_and_makes_room_for_the_next_deal() -> None:
    env = TrainingEnv(["self"] * 4 + ["hard"] * 4, seed=10)
    step = env.reset()
    finished = 0
    for _ in range(400):
        step = env.step(first_legal(step.masks))
        for i in np.flatnonzero(step.done):
            finished += 1
            assert step.rewards[i].sum() == 0
            assert set(step.rewards[i]) <= {-1.0, 0.0, 1.0}
        assert (step.rewards[~step.done] == 0).all()
    assert finished > 0
    assert env.next_seed == 10 + 8 + finished


def test_against_a_bot_the_waiting_seat_alternates_between_games() -> None:
    env = TrainingEnv(["hard"], seed=0)
    step = env.reset()
    seats = [int(step.seats[0])]
    while len(seats) < 4:
        step = env.step(first_legal(step.masks))
        if step.done[0]:
            seats.append(int(step.seats[0]))
    assert seats == [0, 1, 0, 1]


def test_the_same_seed_and_cards_give_the_same_games() -> None:
    def play(seed: int) -> list[float]:
        env = TrainingEnv(["self", "hard"], seed)
        step = env.reset()
        totals: list[float] = []
        for _ in range(300):
            step = env.step(first_legal(step.masks))
            totals.extend(step.rewards[:, 0].tolist())
        return totals

    assert play(4) == play(4)


def test_an_illegal_card_or_a_bad_opponent_is_refused() -> None:
    env = TrainingEnv(["hard"], seed=0)
    step = env.reset()
    illegal = np.argmin(step.masks, axis=1)
    with pytest.raises(ValueError):
        env.step(illegal)
    with pytest.raises(ValueError):
        TrainingEnv(["nobody"], seed=0)
    with pytest.raises(ValueError):
        TrainingEnv(["hard"], seed=0, encoding="nobody")
