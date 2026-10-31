import type { Card } from "@/engine/types";
import { m } from "@/paraglide/messages";

/** The image of a card in public/cards: the Naples deck, cleaned by scripts/clean-cards.mjs. */
export function cardImage(card: Card): string {
	return `/cards/${card.suit}-${String(card.rank).padStart(2, "0")}.jpg`;
}

/** The corner index: the number, or F, C and R for Fante, Cavallo and Re. */
export function cardIndex(card: Card): string {
	return card.rank <= 7 ? String(card.rank) : ["F", "C", "R"][card.rank - 8];
}

const RANKS = [
	m.rank_1,
	m.rank_2,
	m.rank_3,
	m.rank_4,
	m.rank_5,
	m.rank_6,
	m.rank_7,
	m.rank_8,
	m.rank_9,
	m.rank_10,
];

/** The card's name in the page's language; the suits keep their Italian names in both. */
export function cardName(card: Card): string {
	return m.card_name({ rank: RANKS[card.rank - 1](), suit: card.suit });
}
