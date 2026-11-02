//! A game for training a network: some seats wait for a card from outside, the others are bots.

use crate::bot::{Bot, EndgameBot};
use crate::card::Card;
use crate::game::{Game, Outcome, PlayError};
use crate::observation::Observation;
use crate::player::{Player, PLAYERS};

/// A game in which each seat is either a bot, which plays at once, or waits for its card from outside.
///
/// A waiting seat chooses only while the deck lasts: once it is empty the exact solver plays for it, as the network
/// bot does (`PpoBot`).
pub struct TrainingGame {
    game: Game,
    bots: [Option<Box<dyn Bot + Send>>; PLAYERS],
}

impl TrainingGame {
    /// The game dealt from `seed`, played on until a waiting seat has to choose or the game is over.
    pub fn new(seed: u64, bots: [Option<Box<dyn Bot + Send>>; PLAYERS]) -> TrainingGame {
        let mut training = TrainingGame {
            game: Game::new(seed),
            bots,
        };
        training.advance();
        training
    }

    /// The waiting seat whose card is due, or `None` once the game is over.
    pub fn to_act(&self) -> Option<Player> {
        self.game.to_play()
    }

    pub fn observation(&self) -> Option<Observation> {
        self.to_act().map(|p| self.game.observation(p))
    }

    /// Plays `card` for the waiting seat, then plays on until a waiting seat has to choose again or the game ends.
    pub fn play(&mut self, card: Card) -> Result<(), PlayError> {
        self.game.play(card)?;
        self.advance();
        Ok(())
    }

    pub fn outcome(&self) -> Option<Outcome> {
        self.game.outcome()
    }

    pub fn game(&self) -> &Game {
        &self.game
    }

    fn advance(&mut self) {
        while let Some(player) = self.game.to_play() {
            let obs = self.game.observation(player);
            let card = match &mut self.bots[player.index()] {
                Some(bot) => bot.act(&obs),
                None if obs.deck_len == 0 => EndgameBot::choose(&obs).0,
                None => return,
            };
            self.game.play(card).expect("a bot plays a legal card");
        }
    }
}
