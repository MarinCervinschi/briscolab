use std::sync::Arc;

use crate::bot::{Bot, EndgameBot};
use crate::card::{Card, DECK_SIZE};
use crate::network::Network;
use crate::observation::{Observation, ENCODING_LEN};

/// Plays the legal card its network scores highest while the deck lasts, then exactly, as [`EndgameBot`] does.
/// Deterministic: ties go to the lowest index.
#[derive(Clone, Debug)]
pub struct PpoBot {
    network: Arc<Network>,
    a: Vec<f32>,
    b: Vec<f32>,
}

/// The network does not take an encoded observation in and give one score per card out.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ShapeError;

impl std::fmt::Display for ShapeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "the network needs {ENCODING_LEN} inputs and {DECK_SIZE} outputs"
        )
    }
}

impl std::error::Error for ShapeError {}

impl PpoBot {
    pub fn new(network: Arc<Network>) -> Result<PpoBot, ShapeError> {
        if network.inputs() != ENCODING_LEN || network.outputs() != DECK_SIZE {
            return Err(ShapeError);
        }
        let width = network.width();
        Ok(PpoBot {
            network,
            a: vec![0.0; width],
            b: vec![0.0; width],
        })
    }

    /// The network's score for every card, in index order.
    pub fn scores(&mut self, obs: &Observation) -> &[f32] {
        self.network
            .forward(&obs.encode(), &mut self.a, &mut self.b)
    }
}

impl Bot for PpoBot {
    fn act(&mut self, obs: &Observation) -> Card {
        if obs.deck_len == 0 {
            return EndgameBot::choose(obs).0;
        }
        let moves = obs.legal_moves();
        let scores = self.scores(obs);
        let mut best: Option<(Card, f32)> = None;
        for card in moves {
            let score = scores[usize::from(card.index())];
            if best.is_none_or(|(_, b)| score > b) {
                best = Some((card, score));
            }
        }
        best.expect("a legal move").0
    }
}
