//! Tricks and who wins them.

use crate::card::{Card, Suit};
use crate::player::{Player, PLAYERS};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub struct Trick {
    pub leader: Player,
    /// The cards in play order: `cards[0]` is the leader's.
    pub cards: [Card; PLAYERS],
    pub winner: Player,
}

impl Trick {
    pub fn points(&self) -> u8 {
        self.cards.iter().map(|c| c.points()).sum()
    }

    /// The card a player put down in this trick.
    pub fn card_of(&self, player: Player) -> Card {
        let offset = (player.index() + PLAYERS - self.leader.index()) % PLAYERS;
        self.cards[offset]
    }
}

/// Index of the card that wins a trick, given the cards in play order.
///
/// The highest briscola wins if any was played; otherwise the highest card of the suit led.
/// A card of another suit never wins.
pub fn trick_winner(cards: &[Card], briscola: Suit) -> usize {
    assert!(!cards.is_empty(), "a trick needs at least one card");
    let led = cards[0].suit();
    let key = |card: Card| {
        let tier = if card.suit() == briscola {
            2
        } else if card.suit() == led {
            1
        } else {
            0
        };
        (tier, card.strength())
    };
    let mut best = 0;
    for (i, &card) in cards.iter().enumerate().skip(1) {
        if key(card) > key(cards[best]) {
            best = i;
        }
    }
    best
}
