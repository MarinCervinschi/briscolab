//! The bot interface, the bots, and the loop that plays a game between them.

mod greedy;
mod hard;
mod random;

pub use greedy::GreedyBot;
pub use hard::HardBot;
pub use random::RandomBot;

use crate::card::Card;
use crate::game::{Game, PlayError};
use crate::observation::Observation;
use crate::player::PLAYERS;

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
