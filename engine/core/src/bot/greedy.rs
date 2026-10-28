use std::cmp::Reverse;

use crate::bot::Bot;
use crate::card::{Card, Suit};
use crate::observation::Observation;
use crate::trick::trick_winner;

/// Looks one card ahead and plays for the points of the current trick.
///
/// Answering, it plays the card with the best result for this trick: the trick's points if the card wins it, minus
/// them if it loses. Leading, it plays its cheapest card. Ties go to the cheapest card. Deterministic.
#[derive(Clone, Copy, Debug, Default)]
pub struct GreedyBot;

impl Bot for GreedyBot {
    fn act(&mut self, obs: &Observation) -> Card {
        let briscola = obs.briscola_suit();
        let moves = obs.legal_moves().iter();
        let card = match obs.table.first() {
            None => moves.min_by_key(|&c| cost(c, briscola)),
            Some(&led) => {
                moves.max_by_key(|&c| (trick_result(led, c, briscola), Reverse(cost(c, briscola))))
            }
        };
        card.expect("a legal move")
    }
}

/// What giving up a card costs: a briscola before anything else, then its points, then its strength. The index
/// makes every key distinct, so the choice never depends on iteration order.
fn cost(card: Card, briscola: Suit) -> (bool, u8, u8, u8) {
    (
        card.suit() == briscola,
        card.points(),
        card.strength(),
        card.index(),
    )
}

fn trick_result(led: Card, answer: Card, briscola: Suit) -> i16 {
    let points = i16::from(led.points() + answer.points());
    if trick_winner(&[led, answer], briscola) == 1 {
        points
    } else {
        -points
    }
}
