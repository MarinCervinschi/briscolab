use crate::bot::{playout, Bot, EndgameBot};
use crate::card::Card;
use crate::game::Game;
use crate::observation::Observation;
use crate::rng::Rng;

/// Perfect-information Monte Carlo: tries each card on many deals consistent with what the bot knows and keeps the
/// one that ends with the most points in total.
///
/// Every card is tried on the same `determinisations` deals. Each deal is played out by Hard for both sides while
/// the deck lasts, then exactly. With the deck empty it plays exactly, like [`EndgameBot`]. Reproducible from its
/// seed.
#[derive(Clone, Debug)]
pub struct PimcBot {
    determinisations: usize,
    rng: Rng,
}

impl PimcBot {
    /// Panics if `determinisations` is 0.
    pub fn new(determinisations: usize, seed: u64) -> PimcBot {
        assert!(
            determinisations > 0,
            "PIMC needs at least one determinisation"
        );
        PimcBot {
            determinisations,
            rng: Rng::new(seed),
        }
    }
}

impl Bot for PimcBot {
    fn act(&mut self, obs: &Observation) -> Card {
        if obs.deck_len == 0 {
            return EndgameBot.act(obs);
        }
        let deals: Vec<Game> = (0..self.determinisations)
            .map(|_| Game::determinise(obs, &mut self.rng))
            .collect();
        let mut best: Option<(Card, u32)> = None;
        for card in obs.legal_moves() {
            let total = deals
                .iter()
                .map(|deal| {
                    let mut game = deal.clone();
                    game.play(card).expect("a legal move");
                    u32::from(playout(game, obs.player))
                })
                .sum();
            if best.is_none_or(|(_, b)| total > b) {
                best = Some((card, total));
            }
        }
        best.expect("a legal move").0
    }
}
