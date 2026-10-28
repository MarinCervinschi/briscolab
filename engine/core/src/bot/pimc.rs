use crate::bot::{Bot, EndgameBot, HardBot};
use crate::card::{Card, TOTAL_POINTS};
use crate::game::Game;
use crate::observation::Observation;
use crate::player::Player;
use crate::rng::Rng;
use crate::solver::solve;

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
                .map(|deal| u32::from(play_out_deal(deal, card, obs.player)))
                .sum();
            if best.is_none_or(|(_, b)| total > b) {
                best = Some((card, total));
            }
        }
        best.expect("a legal move").0
    }
}

/// The points `me` ends with when `card` is played on `deal`, then Hard plays both sides and the solver the end.
fn play_out_deal(deal: &Game, card: Card, me: Player) -> u8 {
    let mut game = deal.clone();
    game.play(card).expect("a legal move");
    while game.deck_len() > 0 {
        let player = game
            .to_play()
            .expect("the game goes on while the deck lasts");
        let card = HardBot.act(&game.observation(player));
        game.play(card).expect("a legal move");
    }
    match solve(&game) {
        None => game.points()[me.index()],
        Some((_, points)) if game.to_play() == Some(me) => points,
        Some((_, points)) => TOTAL_POINTS - points,
    }
}
