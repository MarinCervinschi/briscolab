import type { Engine } from "@/engine/client";
import type { BotName, Card, Reasoning, Trick, View } from "@/engine/types";

/** The bot is in seat 1, the player in seat 0. */
export const BOT = 1;
/** How long a finished trick stays on the table before the next card. */
export const TRICK_MS = 1200;
/** The least time the bot is seen thinking (SPEC.md, decision 12); a tap skips it. */
export const MIN_THINK_MS = 1200;

export type Phase = "loading" | "player" | "bot" | "trick" | "over" | "error";

/** A card the bot played, the trick it was in, and why it chose it. */
export interface BotMove {
	trick: number;
	card: Card;
	reasoning: Reasoning;
}

export interface GameState {
	phase: Phase;
	view: View | null;
	/** The trick just won, shown on the table until the next card. */
	lastTrick: Trick | null;
	/** The bot's live thoughts while it thinks, else the reasoning behind its last card. */
	reasoning: Reasoning | null;
	moves: BotMove[];
	error: string | null;
}

/**
 * One game against a bot, turn by turn: the engine in its worker holds the game, this keeps what the page shows
 * and when. The page reads the game only from here (CLAUDE.md, "Web").
 */
export class GameRunner {
	state: GameState = {
		phase: "loading",
		view: null,
		lastTrick: null,
		reasoning: null,
		moves: [],
		error: null,
	};
	private listeners = new Set<() => void>();
	private skipWait: (() => void) | null = null;
	private skipAsked = false;
	private stopped = false;

	constructor(
		private engine: Engine,
		private wait: (ms: number) => Promise<void> = ms =>
			new Promise(r => setTimeout(r, ms))
	) {}

	subscribe = (listener: () => void) => {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	};

	async start(seed: number, bot: BotName, botSeed: number) {
		await this.guard(async () => {
			const view = await this.engine.newGame(seed, bot, botSeed);
			this.set({ view });
			await this.handOn(view);
		});
	}

	/** Plays the player's card; ignored unless it is the player's turn. */
	async play(card: Card) {
		const before = this.state.view;
		if (this.state.phase !== "player" || !before) return;
		this.set({ phase: "trick" });
		await this.guard(async () =>
			this.after(before, await this.engine.play(card.index))
		);
	}

	/** Ends the bot's visible thinking as soon as its card is chosen. */
	skipThinking() {
		this.skipAsked = true;
		this.skipWait?.();
	}

	stop() {
		this.stopped = true;
		this.engine.terminate();
	}

	private async after(before: View, after: View) {
		if (after.tricks.length > before.tricks.length) {
			this.set({
				phase: "trick",
				view: beforeDrawing(before, after),
				lastTrick: after.tricks.at(-1)!,
			});
			await this.wait(TRICK_MS);
		}
		this.set({ view: after, lastTrick: null });
		await this.handOn(after);
	}

	private async handOn(view: View) {
		if (view.outcome) this.set({ phase: "over" });
		else if (view.toPlay === BOT) await this.botTurn(view);
		else this.set({ phase: "player" });
	}

	private async botTurn(before: View) {
		// The last reasoning stays on screen until the search sends its first thoughts or the card is chosen.
		this.set({ phase: "bot" });
		this.skipAsked = false;
		const start = performance.now();
		const move = await this.engine.think(reasoning => this.set({ reasoning }));
		const left = MIN_THINK_MS - (performance.now() - start);
		if (left > 0 && !this.skipAsked)
			await Promise.race([
				this.wait(left),
				new Promise<void>(r => (this.skipWait = r)),
			]);
		this.skipWait = null;
		const seen = [
			...move.views[0].table,
			...move.views[0].tricks.flatMap(t => t.cards),
		];
		const card = seen.find(c => c.index === move.card)!;
		this.set({
			reasoning: move.reasoning,
			moves: [
				...this.state.moves,
				{ trick: before.tricks.length, card, reasoning: move.reasoning },
			],
		});
		await this.after(before, move.views[0]);
	}

	private async guard(work: () => Promise<void>) {
		try {
			await work();
		} catch (error) {
			if (!this.stopped)
				this.set({
					phase: "error",
					error: error instanceof Error ? error.message : String(error),
				});
		}
	}

	private set(next: Partial<GameState>) {
		if (this.stopped) return;
		this.state = { ...this.state, ...next };
		for (const listener of this.listeners) listener();
	}
}

/**
 * `after` as it looked before the two players drew: while the trick is shown, the drawn cards are still on the
 * deck. Only what is on screen changes; the engine has already dealt them.
 */
export function beforeDrawing(before: View, after: View): View {
	const hand = after.hand.filter(c => before.hand.some(h => h.index === c.index));
	const drawn = after.hand.length - hand.length;
	return {
		...after,
		hand,
		handLens: [after.handLens[0] - drawn, after.handLens[1] - drawn],
		deckLen: after.deckLen + 2 * drawn,
		briscolaDrawnBy: before.briscolaDrawnBy,
	};
}
