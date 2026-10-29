//! The bot interface, the bots, and the loop that plays a game between them.

mod endgame;
mod greedy;
mod hard;
mod ismcts;
mod pimc;
mod random;

pub use endgame::EndgameBot;
pub use greedy::GreedyBot;
pub use hard::HardBot;
pub use ismcts::IsmctsBot;
pub use pimc::PimcBot;
pub use random::RandomBot;

use crate::card::{Card, TOTAL_POINTS};
use crate::game::{Game, PlayError};
use crate::observation::Observation;
use crate::player::{Player, PLAYERS};
use crate::solver::solve;

/// A player that chooses a card from what it knows.
pub trait Bot {
    /// The card to play. Called only on the bot's turn; the card must come from `obs.legal_moves()`.
    fn act(&mut self, obs: &Observation) -> Card;
}

/// Plays `game` to the end, asking each seat's bot for its card. `bots[i]` sits in seat `i`.
///
/// Stops at the first illegal card and returns the error; the game is left as it was before that card.
pub fn play_out(game: &mut Game, bots: &mut [&mut dyn Bot; PLAYERS]) -> Result<(), PlayError> {
    while let Some(player) = game.to_play() {
        let card = bots[player.index()].act(&game.observation(player));
        game.play(card)?;
    }
    Ok(())
}

/// The points `me` ends `game` with when Hard plays both sides while the deck lasts and the rest is played exactly.
/// The rollout of the search bots.
fn playout(mut game: Game, me: Player) -> u8 {
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
