use crate::bot::{Bot, HardBot, HardRule};
use crate::card::Card;
use crate::game::Game;
use crate::observation::Observation;
use crate::rng::Rng;
use crate::solver::solve_each;

/// Plays like [`HardBot`] while the deck lasts, then perfectly: once the deck is empty every card is known and the
/// last three tricks are solved exactly. Deterministic.
#[derive(Clone, Copy, Debug, Default)]
pub struct EndgameBot;

/// Why Endgame chose its card.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum EndgameReason {
    /// The deck still lasts: Hard's rule.
    Hard(HardRule),
    /// The deck is empty: each legal card, in index order, with the points the bot ends with after it.
    Exact(Vec<(Card, u8)>),
}

impl EndgameBot {
    /// The card Endgame plays and why. Exactly, the highest result wins and ties go to the lowest index.
    pub fn choose(obs: &Observation) -> (Card, EndgameReason) {
        if obs.deck_len > 0 {
            let (card, rule) = HardBot::choose(obs);
            return (card, EndgameReason::Hard(rule));
        }
        // With the deck empty the determinisation is the real game, so the seed changes nothing.
        let game = Game::determinise(obs, &mut Rng::new(0));
        let results = solve_each(&game);
        let mut best: Option<(Card, u8)> = None;
        for &(card, points) in &results {
            if best.is_none_or(|(_, b)| points > b) {
                best = Some((card, points));
            }
        }
        (
            best.expect("a card to play").0,
            EndgameReason::Exact(results),
        )
    }
}

impl Bot for EndgameBot {
    fn act(&mut self, obs: &Observation) -> Card {
        EndgameBot::choose(obs).0
    }
}
