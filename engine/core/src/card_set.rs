//! Sets of cards as bitsets over a `u64`.

use std::fmt;

use crate::card::{Card, Suit, DECK_SIZE};

/// A set of cards as a bitset: bit `i` is the card with index `i`.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Hash)]
pub struct CardSet(u64);

impl CardSet {
    pub const EMPTY: CardSet = CardSet(0);
    pub const FULL: CardSet = CardSet((1 << DECK_SIZE) - 1);

    pub fn suit(suit: Suit) -> CardSet {
        CardSet(0x3ff << (suit as u8 * 10))
    }

    pub fn contains(self, card: Card) -> bool {
        self.0 & (1 << card.index()) != 0
    }

    /// Adds a card; returns whether it was not already there.
    pub fn insert(&mut self, card: Card) -> bool {
        let absent = !self.contains(card);
        self.0 |= 1 << card.index();
        absent
    }

    /// Removes a card; returns whether it was there.
    pub fn remove(&mut self, card: Card) -> bool {
        let present = self.contains(card);
        self.0 &= !(1 << card.index());
        present
    }

    pub fn len(self) -> usize {
        self.0.count_ones() as usize
    }

    pub fn is_empty(self) -> bool {
        self.0 == 0
    }

    pub fn union(self, other: CardSet) -> CardSet {
        CardSet(self.0 | other.0)
    }

    pub fn difference(self, other: CardSet) -> CardSet {
        CardSet(self.0 & !other.0)
    }

    pub fn complement(self) -> CardSet {
        CardSet::FULL.difference(self)
    }

    pub fn is_disjoint(self, other: CardSet) -> bool {
        self.0 & other.0 == 0
    }

    pub fn points(self) -> u8 {
        self.iter().map(Card::points).sum()
    }

    /// The `n`-th card in index order, if the set has that many.
    pub fn nth(self, n: usize) -> Option<Card> {
        self.iter().nth(n)
    }

    /// Cards in index order.
    pub fn iter(self) -> CardSetIter {
        CardSetIter(self.0)
    }
}

impl FromIterator<Card> for CardSet {
    fn from_iter<I: IntoIterator<Item = Card>>(iter: I) -> CardSet {
        let mut set = CardSet::EMPTY;
        for card in iter {
            set.insert(card);
        }
        set
    }
}

impl IntoIterator for CardSet {
    type Item = Card;
    type IntoIter = CardSetIter;

    fn into_iter(self) -> CardSetIter {
        self.iter()
    }
}

impl fmt::Display for CardSet {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("[")?;
        for (i, card) in self.iter().enumerate() {
            if i > 0 {
                f.write_str(" ")?;
            }
            write!(f, "{card}")?;
        }
        f.write_str("]")
    }
}

pub struct CardSetIter(u64);

impl Iterator for CardSetIter {
    type Item = Card;

    fn next(&mut self) -> Option<Card> {
        if self.0 == 0 {
            return None;
        }
        let index = self.0.trailing_zeros() as u8;
        self.0 &= self.0 - 1;
        Card::from_index(index)
    }

    fn size_hint(&self) -> (usize, Option<usize>) {
        let n = self.0.count_ones() as usize;
        (n, Some(n))
    }
}

impl ExactSizeIterator for CardSetIter {}
