//! What one player knows about a game.

use crate::card::{Card, Suit, DECK_SIZE, TOTAL_POINTS};
use crate::card_set::CardSet;
use crate::player::{Player, PLAYERS};
use crate::trick::Trick;

/// How [`Observation::encode`] lays an observation out for a network. A network's number of inputs names its
/// encoding.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Encoding {
    /// Five sets of 40 cards (the hand, the table, the cards played in finished tricks, the opponent's known cards,
    /// the face-up briscola) and four numbers: 204 inputs.
    Pooled,
    /// As `Pooled`, with the cards played in finished tricks split by who played them, this player first: 244
    /// inputs.
    BySeat,
}

/// The most inputs any [`Encoding`] has.
pub const MAX_ENCODING_LEN: usize = Encoding::BySeat.inputs();

impl Encoding {
    pub const fn sets(self) -> usize {
        match self {
            Encoding::Pooled => 5,
            Encoding::BySeat => 6,
        }
    }

    pub const fn inputs(self) -> usize {
        self.sets() * DECK_SIZE + 4
    }

    /// The encoding a network with this many inputs reads.
    pub fn from_inputs(inputs: usize) -> Option<Encoding> {
        [Encoding::Pooled, Encoding::BySeat]
            .into_iter()
            .find(|e| e.inputs() == inputs)
    }
}

/// The cards left to draw just after the deal, the face-up briscola included.
const DECK_AFTER_DEAL: f32 = 34.0;

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

    /// The cards a player put down in finished tricks.
    pub fn played_by(&self, player: Player) -> CardSet {
        self.tricks.iter().map(|t| t.card_of(player)).collect()
    }

    /// Writes the observation as a network's input into `out`, from this player's side: the sets of cards
    /// [`Encoding`] lists, one number per card; then this player's points and the opponent's over 120, the cards
    /// left to draw over 34, and 1 if this player leads.
    ///
    /// # Panics
    ///
    /// If `out` does not hold exactly `encoding.inputs()` numbers.
    pub fn encode(&self, encoding: Encoding, out: &mut [f32]) {
        assert_eq!(out.len(), encoding.inputs(), "an input of the wrong size");
        out.fill(0.0);
        let opponent = self.player.next();
        let table: CardSet = self.table.iter().copied().collect();
        let briscola: CardSet = [self.briscola].into_iter().collect();
        let mut sets = [CardSet::EMPTY; 6];
        match encoding {
            Encoding::Pooled => sets[..5].copy_from_slice(&[
                self.hand,
                table,
                self.played,
                self.known_opponent_cards(),
                briscola,
            ]),
            Encoding::BySeat => sets.copy_from_slice(&[
                self.hand,
                table,
                self.played_by(self.player),
                self.played_by(opponent),
                self.known_opponent_cards(),
                briscola,
            ]),
        }
        for (i, set) in sets[..encoding.sets()].iter().enumerate() {
            for card in *set {
                out[i * DECK_SIZE + usize::from(card.index())] = 1.0;
            }
        }
        let points =
            |p: Player| f32::from(self.taken[p.index()].points()) / f32::from(TOTAL_POINTS);
        let numbers = encoding.sets() * DECK_SIZE;
        out[numbers] = points(self.player);
        out[numbers + 1] = points(opponent);
        out[numbers + 2] = self.deck_len as f32 / DECK_AFTER_DEAL;
        out[numbers + 3] = if self.leader == self.player { 1.0 } else { 0.0 };
    }
}
