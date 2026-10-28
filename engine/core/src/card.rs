//! Cards, suits and ranks.

use std::fmt;
use std::str::FromStr;

pub const DECK_SIZE: usize = 40;

pub const TOTAL_POINTS: u8 = 120;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub enum Suit {
    Coppe = 0,
    Denari = 1,
    Bastoni = 2,
    Spade = 3,
}

impl Suit {
    pub const ALL: [Suit; 4] = [Suit::Coppe, Suit::Denari, Suit::Bastoni, Suit::Spade];

    /// One-letter code: `c`, `d`, `b`, `s`.
    pub fn letter(self) -> char {
        ['c', 'd', 'b', 's'][self as usize]
    }

    fn from_letter(c: char) -> Option<Suit> {
        match c.to_ascii_lowercase() {
            'c' => Some(Suit::Coppe),
            'd' => Some(Suit::Denari),
            'b' => Some(Suit::Bastoni),
            's' => Some(Suit::Spade),
            _ => None,
        }
    }
}

/// The ten ranks, named by their face value: Fante is 8, Cavallo 9, Re 10.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub enum Rank {
    Asso = 0,
    Due = 1,
    Tre = 2,
    Quattro = 3,
    Cinque = 4,
    Sei = 5,
    Sette = 6,
    Fante = 7,
    Cavallo = 8,
    Re = 9,
}

impl Rank {
    pub const ALL: [Rank; 10] = [
        Rank::Asso,
        Rank::Due,
        Rank::Tre,
        Rank::Quattro,
        Rank::Cinque,
        Rank::Sei,
        Rank::Sette,
        Rank::Fante,
        Rank::Cavallo,
        Rank::Re,
    ];

    /// Face value, 1 to 10.
    pub fn value(self) -> u8 {
        self as u8 + 1
    }

    pub fn from_value(value: u8) -> Option<Rank> {
        Rank::ALL.get(usize::from(value).checked_sub(1)?).copied()
    }

    pub fn points(self) -> u8 {
        [11, 0, 10, 0, 0, 0, 0, 2, 3, 4][self as usize]
    }

    /// Strength within a suit: Asso 9, Tre 8, Re 7, … , Due 0.
    pub fn strength(self) -> u8 {
        [9, 0, 8, 1, 2, 3, 4, 5, 6, 7][self as usize]
    }
}

/// One card, stored as `suit * 10 + rank`, an index from 0 to 39.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct Card(u8);

impl Card {
    pub fn new(suit: Suit, rank: Rank) -> Card {
        Card(suit as u8 * 10 + rank as u8)
    }

    pub fn from_index(index: u8) -> Option<Card> {
        (usize::from(index) < DECK_SIZE).then_some(Card(index))
    }

    pub fn index(self) -> u8 {
        self.0
    }

    pub fn suit(self) -> Suit {
        Suit::ALL[usize::from(self.0 / 10)]
    }

    pub fn rank(self) -> Rank {
        Rank::ALL[usize::from(self.0 % 10)]
    }

    pub fn points(self) -> u8 {
        self.rank().points()
    }

    pub fn strength(self) -> u8 {
        self.rank().strength()
    }

    /// All 40 cards, in index order.
    pub fn all() -> [Card; DECK_SIZE] {
        std::array::from_fn(|i| Card(i as u8))
    }
}

/// Face value then suit letter: `1c` is the Asso di coppe, `10s` the Re di spade.
impl fmt::Display for Card {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}{}", self.rank().value(), self.suit().letter())
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ParseCardError;

impl fmt::Display for ParseCardError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("expected a card like `1c`, `7d` or `10s`")
    }
}

impl std::error::Error for ParseCardError {}

impl FromStr for Card {
    type Err = ParseCardError;

    fn from_str(s: &str) -> Result<Card, ParseCardError> {
        let s = s.trim();
        let suit = s
            .chars()
            .last()
            .and_then(Suit::from_letter)
            .ok_or(ParseCardError)?;
        let value = s[..s.len() - 1].parse::<u8>().map_err(|_| ParseCardError)?;
        let rank = Rank::from_value(value).ok_or(ParseCardError)?;
        Ok(Card::new(suit, rank))
    }
}
