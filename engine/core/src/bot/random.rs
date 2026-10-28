use crate::bot::Bot;
use crate::card::Card;
use crate::observation::Observation;
use crate::rng::Rng;

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
