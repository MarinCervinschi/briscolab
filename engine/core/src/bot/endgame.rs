use crate::bot::{Bot, HardBot};
use crate::card::Card;
use crate::game::Game;
use crate::observation::Observation;
use crate::rng::Rng;
use crate::solver::solve;

/// Plays like [`HardBot`] while the deck lasts, then perfectly: once the deck is empty every card is known and the
/// last three tricks are solved exactly. Deterministic.
#[derive(Clone, Copy, Debug, Default)]
pub struct EndgameBot;

impl Bot for EndgameBot {
    fn act(&mut self, obs: &Observation) -> Card {
        if obs.deck_len > 0 {
            return HardBot.act(obs);
        }
        // With the deck empty the determinisation is the real game, so the seed changes nothing.
        let game = Game::determinise(obs, &mut Rng::new(0));
        solve(&game).expect("a card to play").0
    }
}
