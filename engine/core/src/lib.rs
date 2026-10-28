//! The rules engine for two-player Briscola, as written in `docs/rules.md`.
//!
//! A [`Game`] holds the full state; bots see only an [`Observation`]. A game is reproducible from its seed, and
//! the crate uses no threads, clock or OS randomness, so it builds for WebAssembly and Python unchanged.

pub mod bot;
pub mod card;
pub mod card_set;
pub mod duplicate;
pub mod game;
pub mod observation;
pub mod player;
pub mod rng;
pub mod trick;

pub use bot::{play_out, Bot, GreedyBot, HardBot, RandomBot};
pub use card::{Card, Rank, Suit, DECK_SIZE, TOTAL_POINTS};
pub use card_set::CardSet;
pub use duplicate::play_duplicate;
pub use game::{DeckError, Game, Outcome, PlayError, HAND_SIZE, STOCK_SIZE, TRICKS};
pub use observation::Observation;
pub use player::{Player, PLAYERS};
pub use rng::Rng;
pub use trick::{trick_winner, Trick};
