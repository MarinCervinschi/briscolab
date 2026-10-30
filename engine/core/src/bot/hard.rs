use crate::bot::Bot;
use crate::card::{Card, Rank, Suit};
use crate::card_set::CardSet;
use crate::observation::Observation;

/// The rules of the Hard bot of the JavaFX project (MarinCervinschi/Briscola), without its probability estimate.
///
/// Answering a briscola, it takes a Tre di briscola with the Asso and otherwise spares its cheapest card. Answering
/// an Asso or a Tre of another suit, it takes a Tre with the Asso of that suit, else plays its lowest briscola.
/// Answering any other card, it plays its strongest card of the suit led, else spares its cheapest card. Leading,
/// it spares its cheapest card. Deterministic.
#[derive(Clone, Copy, Debug, Default)]
pub struct HardBot;

/// The rule that chose Hard's card, in the order the rules are tried.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum HardRule {
    /// Leading: its cheapest card.
    Lead,
    /// Answering the Tre di briscola with the Asso di briscola.
    AssoOnTreOfBriscola,
    /// Answering any other briscola: its cheapest card.
    SpareOnBriscola,
    /// Answering an Asso or a Tre of another suit with the Asso of that suit.
    AssoOnCarico,
    /// Answering an Asso or a Tre of another suit with its lowest briscola, or its cheapest card if it has none.
    BriscolaOnCarico,
    /// Answering any other card with its strongest card of the suit led.
    StrongestOfSuit,
    /// Answering a suit it does not hold: its cheapest card.
    Spare,
}

impl HardBot {
    /// The card Hard plays and the rule that chose it.
    pub fn choose(obs: &Observation) -> (Card, HardRule) {
        let hand = Hand {
            cards: obs.legal_moves(),
            briscola: obs.briscola_suit(),
        };
        // The Java bot led by estimating the odds that the opponent could beat each card, but early in a game the
        // odds of a briscola alone pass its 50% threshold, so it fell back to this nearly every time.
        match obs.table.first() {
            None => (hand.spare(), HardRule::Lead),
            Some(&led) => answer(led, &hand),
        }
    }
}

impl Bot for HardBot {
    fn act(&mut self, obs: &Observation) -> Card {
        HardBot::choose(obs).0
    }
}

fn answer(led: Card, hand: &Hand) -> (Card, HardRule) {
    if led.suit() == hand.briscola {
        if led.rank() == Rank::Tre {
            if let Some(asso) = hand.asso_of(hand.briscola) {
                return (asso, HardRule::AssoOnTreOfBriscola);
            }
        }
        return (hand.spare(), HardRule::SpareOnBriscola);
    }
    if is_carico(led) {
        return match hand.asso_of(led.suit()) {
            Some(asso) => (asso, HardRule::AssoOnCarico),
            None => (hand.weakest_briscola_first(), HardRule::BriscolaOnCarico),
        };
    }
    match hand.strongest_of(led.suit()) {
        Some(card) => (card, HardRule::StrongestOfSuit),
        None => (hand.spare(), HardRule::Spare),
    }
}

/// An Asso or a Tre: the two cards worth 10 points or more.
fn is_carico(card: Card) -> bool {
    card.points() >= 10
}

struct Hand {
    cards: CardSet,
    briscola: Suit,
}

impl Hand {
    /// The weakest card that is a briscola, or that is not, as asked. Ties go to the lowest index.
    fn weakest(&self, briscola: bool) -> Option<Card> {
        let suit = CardSet::suit(self.briscola);
        let cards = if briscola {
            self.cards.intersection(suit)
        } else {
            self.cards.difference(suit)
        };
        cards.iter().min_by_key(|c| c.strength())
    }

    fn strongest_of(&self, suit: Suit) -> Option<Card> {
        self.cards
            .intersection(CardSet::suit(suit))
            .iter()
            .max_by_key(|c| c.strength())
    }

    fn asso_of(&self, suit: Suit) -> Option<Card> {
        let asso = Card::new(suit, Rank::Asso);
        self.cards.contains(asso).then_some(asso)
    }

    fn weakest_briscola_first(&self) -> Card {
        self.weakest(true)
            .or_else(|| self.weakest(false))
            .expect("a card in hand")
    }

    /// The weakest card that is not a briscola; if that is a carico, the weakest briscola instead.
    fn spare(&self) -> Card {
        let card = self
            .weakest(false)
            .or_else(|| self.weakest(true))
            .expect("a card in hand");
        if is_carico(card) {
            self.weakest_briscola_first()
        } else {
            card
        }
    }
}
