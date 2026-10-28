//! The state of a game and the rules that move it forward.

use std::fmt;

use crate::card::{Card, Suit, DECK_SIZE, TOTAL_POINTS};
use crate::card_set::CardSet;
use crate::observation::Observation;
use crate::player::{Player, PLAYERS};
use crate::rng::Rng;
use crate::trick::{trick_winner, Trick};

/// Cards in each hand while the deck lasts.
pub const HAND_SIZE: usize = 3;

/// Tricks in a game.
pub const TRICKS: usize = DECK_SIZE / PLAYERS;

/// Cards to draw after the deal: the deck plus the face-up briscola, which is drawn last.
pub const STOCK_SIZE: usize = DECK_SIZE - PLAYERS * HAND_SIZE;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Outcome {
    Win(Player),
    Draw,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PlayError {
    GameOver,
    NotInHand { player: Player, card: Card },
}

impl fmt::Display for PlayError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            PlayError::GameOver => f.write_str("the game is over"),
            PlayError::NotInHand { player, card } => write!(f, "{player} does not hold {card}"),
        }
    }
}

impl std::error::Error for PlayError {}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct DeckError;

impl fmt::Display for DeckError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("a deck must hold each of the 40 cards exactly once")
    }
}

impl std::error::Error for DeckError {}

/// The full state of a game, hidden information included. Bots get an [`Observation`] instead.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Game {
    dealer: Player,
    briscola: Card,
    /// Cards to draw, in order; the last one is the face-up briscola.
    stock: [Card; STOCK_SIZE],
    drawn: usize,
    briscola_drawn_by: Option<Player>,
    hands: [CardSet; PLAYERS],
    taken: [CardSet; PLAYERS],
    leader: Player,
    /// Cards on the table in the trick being played, in play order.
    table: Vec<Card>,
    tricks: Vec<Trick>,
}

impl Game {
    /// A new game: the deck is shuffled from `seed` and `P1` deals, so `P0` leads first.
    pub fn new(seed: u64) -> Game {
        Game::with_dealer(seed, Player::P1)
    }

    pub fn with_dealer(seed: u64, dealer: Player) -> Game {
        let mut deck = Card::all();
        Rng::new(seed).shuffle(&mut deck);
        Game::from_deck(deck, dealer).expect("a shuffled deck is a deck")
    }

    /// Deals from a deck in the given order, `deck[0]` being the top card.
    ///
    /// The dealer gives three cards to each player, one at a time, starting with the next player; the next card is
    /// the briscola, which goes under the rest of the deck. The player after the dealer leads.
    pub fn from_deck(deck: [Card; DECK_SIZE], dealer: Player) -> Result<Game, DeckError> {
        if deck.iter().copied().collect::<CardSet>() != CardSet::FULL {
            return Err(DeckError);
        }
        let first = dealer.next();
        let mut hands = [CardSet::EMPTY; PLAYERS];
        let dealt = PLAYERS * HAND_SIZE;
        for (i, &card) in deck[..dealt].iter().enumerate() {
            let player = first.after(i);
            hands[player.index()].insert(card);
        }
        let briscola = deck[dealt];
        let mut stock = [briscola; STOCK_SIZE];
        stock[..STOCK_SIZE - 1].copy_from_slice(&deck[dealt + 1..]);
        Ok(Game {
            dealer,
            briscola,
            stock,
            drawn: 0,
            briscola_drawn_by: None,
            hands,
            taken: [CardSet::EMPTY; PLAYERS],
            leader: first,
            table: Vec::with_capacity(PLAYERS),
            tricks: Vec::with_capacity(TRICKS),
        })
    }

    pub fn dealer(&self) -> Player {
        self.dealer
    }

    /// The face-up card whose suit is trump.
    pub fn briscola(&self) -> Card {
        self.briscola
    }

    pub fn briscola_suit(&self) -> Suit {
        self.briscola.suit()
    }

    /// Who drew the face-up briscola, once it has been drawn.
    pub fn briscola_drawn_by(&self) -> Option<Player> {
        self.briscola_drawn_by
    }

    /// Cards still to draw, the face-up briscola included.
    pub fn deck_len(&self) -> usize {
        STOCK_SIZE - self.drawn
    }

    pub fn leader(&self) -> Player {
        self.leader
    }

    /// Whose turn it is, or `None` once the game is over.
    pub fn to_play(&self) -> Option<Player> {
        if self.is_over() {
            return None;
        }
        Some(self.leader.after(self.table.len()))
    }

    /// The cards the player to move may play: any card in their hand.
    pub fn legal_moves(&self) -> CardSet {
        self.to_play()
            .map_or(CardSet::EMPTY, |p| self.hands[p.index()])
    }

    /// Cards on the table in the trick being played, in play order.
    pub fn table(&self) -> &[Card] {
        &self.table
    }

    pub fn tricks(&self) -> &[Trick] {
        &self.tricks
    }

    pub fn taken(&self, player: Player) -> CardSet {
        self.taken[player.index()]
    }

    pub fn points(&self) -> [u8; PLAYERS] {
        self.taken.map(CardSet::points)
    }

    pub fn is_over(&self) -> bool {
        self.tricks.len() == TRICKS
    }

    /// The result, once the game is over: more than half the points wins.
    pub fn outcome(&self) -> Option<Outcome> {
        if !self.is_over() {
            return None;
        }
        let half = TOTAL_POINTS / 2;
        Some(
            Player::ALL
                .into_iter()
                .find(|p| self.taken[p.index()].points() > half)
                .map_or(Outcome::Draw, Outcome::Win),
        )
    }

    /// What `player` knows: the only view of the game a bot gets.
    pub fn observation(&self, player: Player) -> Observation {
        let mut played = CardSet::EMPTY;
        for trick in &self.tricks {
            played = played.union(trick.cards.into_iter().collect());
        }
        Observation {
            player,
            hand: self.hands[player.index()],
            table: self.table.clone(),
            played,
            taken: self.taken,
            briscola: self.briscola,
            briscola_drawn_by: self.briscola_drawn_by,
            deck_len: self.deck_len(),
            hand_lens: self.hands.map(CardSet::len),
            leader: self.leader,
            to_play: self.to_play(),
            trick: self.tricks.len(),
        }
    }

    /// Plays a card for the player to move. Returns the trick if this card completed one.
    ///
    /// An illegal move leaves the game unchanged.
    pub fn play(&mut self, card: Card) -> Result<Option<Trick>, PlayError> {
        let player = self.to_play().ok_or(PlayError::GameOver)?;
        if !self.hands[player.index()].remove(card) {
            return Err(PlayError::NotInHand { player, card });
        }
        self.table.push(card);
        if self.table.len() < PLAYERS {
            return Ok(None);
        }

        let cards: [Card; PLAYERS] = self.table[..].try_into().expect("a full table");
        self.table.clear();
        let offset = trick_winner(&cards, self.briscola_suit());
        let winner = self.leader.after(offset);
        let trick = Trick {
            leader: self.leader,
            cards,
            winner,
        };
        self.taken[winner.index()] = self.taken[winner.index()].union(cards.into_iter().collect());
        self.tricks.push(trick);
        self.leader = winner;

        // The winner draws first, then the others in turn order; the briscola is the last card drawn.
        if self.drawn < STOCK_SIZE {
            let mut drawer = winner;
            for _ in 0..PLAYERS {
                self.hands[drawer.index()].insert(self.stock[self.drawn]);
                self.drawn += 1;
                if self.drawn == STOCK_SIZE {
                    self.briscola_drawn_by = Some(drawer);
                }
                drawer = drawer.next();
            }
        }
        Ok(Some(trick))
    }

    /// The cards a player holds. Hidden information, for the site and the lab's harness; bots get
    /// [`Game::observation`].
    pub fn hand(&self, player: Player) -> CardSet {
        self.hands[player.index()]
    }

    /// The cards still to draw, in order, the face-up briscola last. Hidden information.
    pub fn stock(&self) -> &[Card] {
        &self.stock[self.drawn..]
    }
}
