//! What one player knows about a game.

use crate::card::{Card, Suit};
use crate::card_set::CardSet;
use crate::player::{Player, PLAYERS};
use crate::trick::Trick;

/// One player's view of the game: what they can see or remember, and nothing else.
///
/// The other players' hands and the order of the deck are not in it.
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct Observation {
    pub player: Player,
    pub hand: CardSet,
    /// Cards on the table in the trick being played, in play order.
    pub table: Vec<Card>,
    /// Cards in finished tricks.
    pub played: CardSet,
    /// The cards each player has taken. Public, since tricks are played face up.
    pub taken: [CardSet; PLAYERS],
    /// The face-up card whose suit is trump.
    pub briscola: Card,
    /// Who drew the face-up briscola, once it has been drawn.
    pub briscola_drawn_by: Option<Player>,
    /// Cards still to draw, the face-up briscola included.
    pub deck_len: usize,
    pub hand_lens: [usize; PLAYERS],
    pub leader: Player,
    /// Whose turn it is, or `None` once the game is over.
    pub to_play: Option<Player>,
    /// The finished tricks, in order. Public, since tricks are played face up.
    pub tricks: Vec<Trick>,
}

impl Observation {
    pub fn briscola_suit(&self) -> Suit {
        self.briscola.suit()
    }

    /// The cards this player may play: any card in hand, when it is their turn.
    pub fn legal_moves(&self) -> CardSet {
        if self.to_play == Some(self.player) {
            self.hand
        } else {
            CardSet::EMPTY
        }
    }

    /// Every card that has been seen face up on the table, in this trick or a finished one.
    pub fn seen(&self) -> CardSet {
        self.played.union(self.table.iter().copied().collect())
    }

    /// Cards the opponents are known to hold: the face-up briscola, if an opponent drew it and has not played it.
    pub fn known_opponent_cards(&self) -> CardSet {
        match self.briscola_drawn_by {
            Some(p) if p != self.player && !self.seen().contains(self.briscola) => {
                [self.briscola].into_iter().collect()
            }
            _ => CardSet::EMPTY,
        }
    }

    /// Cards whose place this player does not know: each is in an opponent's hand or still in the deck.
    ///
    /// Together with [`known_opponent_cards`](Self::known_opponent_cards) these are what a determinisation
    /// deals out. Once the deck is empty they are exactly the opponent's hand.
    pub fn unknown(&self) -> CardSet {
        let mut known = self.hand.union(self.seen());
        known.insert(self.briscola);
        known.complement()
    }
}
