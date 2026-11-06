use std::sync::Arc;

use crate::bot::{Bot, EndgameBot};
use crate::card::{Card, DECK_SIZE};
use crate::network::Network;
use crate::observation::{Encoding, Observation};

/// Plays the legal card its network scores highest while the deck lasts, then exactly, as [`EndgameBot`] does.
/// Deterministic: ties go to the lowest index.
#[derive(Clone, Debug)]
pub struct PpoBot {
    network: Arc<Network>,
    encoding: Encoding,
    input: Vec<f32>,
    a: Vec<f32>,
    b: Vec<f32>,
}

/// The network's inputs are no [`Encoding`], or it does not give one score per card out.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ShapeError;

impl std::fmt::Display for ShapeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "the network needs {} or {} inputs and {DECK_SIZE} outputs",
            Encoding::Pooled.inputs(),
            Encoding::BySeat.inputs()
        )
    }
}

impl std::error::Error for ShapeError {}

impl PpoBot {
    pub fn new(network: Arc<Network>) -> Result<PpoBot, ShapeError> {
        let encoding = Encoding::from_inputs(network.inputs()).ok_or(ShapeError)?;
        if network.outputs() != DECK_SIZE {
            return Err(ShapeError);
        }
        let width = network.width();
        Ok(PpoBot {
            network,
            encoding,
            input: vec![0.0; encoding.inputs()],
            a: vec![0.0; width],
            b: vec![0.0; width],
        })
    }

    pub fn encoding(&self) -> Encoding {
        self.encoding
    }

    /// The network's score for every card, in index order.
    pub fn scores(&mut self, obs: &Observation) -> &[f32] {
        obs.encode(self.encoding, &mut self.input);
        self.network.forward(&self.input, &mut self.a, &mut self.b)
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
