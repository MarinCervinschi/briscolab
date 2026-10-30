// What the engine sends as JSON (engine/wasm/src/lib.rs). The engine owns the rules: points, legality and the
// winner of a trick all come from it, never from here.

export type Suit = "coppe" | "denari" | "bastoni" | "spade";

export interface Card {
	/** 0 to 39, the engine's index. */
	index: number;
	/** The engine's short name, such as `1c` or `10s`. */
	name: string;
	suit: Suit;
	/** 1 to 10: Fante is 8, Cavallo 9, Re 10. */
	rank: number;
	points: number;
}

export interface Trick {
	leader: number;
	cards: [Card, Card];
	winner: number;
	points: number;
}

/** What one seat knows of the game. */
export interface View {
	seat: number;
	hand: Card[];
	table: Card[];
	briscola: Card;
	briscolaDrawnBy: number | null;
	deckLen: number;
	handLens: [number, number];
	leader: number;
	toPlay: number | null;
	tricks: Trick[];
	points: [number, number];
	outcome: { winner: number | null } | null;
}

export type GreedyRule = "lead" | "take" | "giveAway";
export type HardRule =
	| "lead"
	| "assoOnTreOfBriscola"
	| "spareOnBriscola"
	| "assoOnCarico"
	| "briscolaOnCarico"
	| "strongestOfSuit"
	| "spare";

export type Reasoning =
	| { kind: "random" }
	| { kind: "rule"; bot: "greedy"; rule: GreedyRule }
	| { kind: "rule"; bot: "hard"; rule: HardRule }
	| { kind: "exact"; results: { card: Card; points: number }[] }
	| {
			kind: "search";
			iterations: number;
			budget: number;
			cards: { card: Card; visits: number; expectedPoints: number }[];
			hypotheses: { iteration: number; hand: Card[]; points: number }[];
	  };

/** The bots the engine knows by name; `ismcts:<n>` sets the iterations. */
export type BotName =
	"random" | "greedy" | "hard" | "endgame" | "ismcts" | `ismcts:${number}`;
