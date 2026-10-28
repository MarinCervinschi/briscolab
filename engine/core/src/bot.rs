//! The bot interface and the loop that plays a game between bots.

use crate::card::Card;
use crate::game::{Game, PlayError};
use crate::observation::Observation;
use crate::player::PLAYERS;
use crate::rng::Rng;

/// A player that chooses a card from what it knows.
pub trait Bot {
    /// The card to play. Called only on the bot's turn; the card must come from `obs.legal_moves()`.
    fn act(&mut self, obs: &Observation) -> Card;
}

/// Plays a uniformly random legal card.
#[derive(Clone, Debug)]
pub struct RandomBot {
    rng: Rng,
}

impl RandomBot {
    pub fn new(seed: u64) -> RandomBot {
        RandomBot {
            rng: Rng::new(seed),
        }
    }
}

impl Bot for RandomBot {
    fn act(&mut self, obs: &Observation) -> Card {
        let moves = obs.legal_moves();
        let i = self.rng.below(moves.len() as u64) as usize;
        moves.nth(i).expect("a legal move")
    }
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
