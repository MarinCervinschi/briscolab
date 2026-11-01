import type { Engine } from "@/engine/client";
import type { BotName, Card, Reasoning, Trick, View } from "@/engine/types";

import { MIN_THINK_MS, TRICK_MS, beforeDrawing } from "./runner";

export const SPEEDS = [1, 2, 4] as const;
export type Speed = (typeof SPEEDS)[number];

export type WatchPhase = "loading" | "thinking" | "trick" | "over" | "error";

/** A card one of the bots played, the trick it was in, and why. */
export interface WatchMove {
	seat: number;
	trick: number;
	card: Card;
	reasoning: Reasoning;
}

export interface WatchState {
	phase: WatchPhase;
	/** What each seat sees: seat 0, then seat 1. */
	views: [View, View] | null;
	/** The trick just won, shown on the table until the next card. */
	lastTrick: Trick | null;
	/** Each bot's live thoughts while it thinks, else the reasoning behind its last card. */
	reasoning: [Reasoning | null, Reasoning | null];
	/** The seat whose bot is thinking. */
	thinking: number | null;
	moves: WatchMove[];
	/** Paused between two cards: the bot thinking finishes its card first. */
	paused: boolean;
	speed: Speed;
	error: string | null;
}

/**
 * A game between two bots for someone to watch: the engine in its worker holds the game, this plays one card after
 * the other at a pace a person can follow, and stops between two cards when asked.
 */
export class WatchRunner {
	state: WatchState = {
		phase: "loading",
		views: null,
		lastTrick: null,
		reasoning: [null, null],
		thinking: null,
		moves: [],
		paused: false,
		speed: 1,
		error: null,
	};
	private listeners = new Set<() => void>();
	private release: (() => void) | null = null;
	private stepAsked = false;
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

	/** Deals the game; `play` then sets the bots going. */
	async start(seed: number, bots: [BotName, BotName], botSeeds: [number, number]) {
		await this.guard(async () => {
			const views = await this.engine.watch(seed, bots, botSeeds);
			this.set({ views, phase: "thinking" });
		});
	}

	/** Plays the game to its end, card after card. */
	async play() {
		await this.guard(async () => {
			while (!this.stopped && !this.state.views!.at(0)!.outcome) {
				await this.gate();
				if (this.stopped) return;
				await this.turn();
			}
			this.set({ phase: "over", thinking: null });
		});
	}

	pause() {
		this.set({ paused: true });
	}

	resume() {
		this.set({ paused: false });
		this.open();
	}

	/** While paused, plays one card and stops again. */
	step() {
		if (!this.state.paused) return;
		this.stepAsked = true;
		this.open();
	}

	setSpeed(speed: Speed) {
		this.set({ speed });
	}

	stop() {
		this.stopped = true;
		this.open();
		this.engine.terminate();
	}

	private open() {
		this.release?.();
		this.release = null;
	}

	/** Waits while paused, unless one card was asked for. */
	private async gate() {
		if (this.state.paused && !this.stepAsked)
			await new Promise<void>(r => (this.release = r));
		this.stepAsked = false;
	}

	private async turn() {
		const before = this.state.views!;
		const seat = before[0].toPlay!;
		this.set({ phase: "thinking", thinking: seat });
		const start = performance.now();
		const move = await this.engine.think(reasoning =>
			this.setReasoning(seat, reasoning)
		);
		const left = MIN_THINK_MS / this.state.speed - (performance.now() - start);
		if (left > 0) await this.wait(left);
		const after = move.views;
		const seen = [...after[0].table, ...after[0].tricks.flatMap(t => t.cards)];
		this.setReasoning(seat, move.reasoning);
		this.set({
			thinking: null,
			moves: [
				...this.state.moves,
				{
					seat,
					trick: before[0].tricks.length,
					card: seen.find(c => c.index === move.card)!,
					reasoning: move.reasoning,
				},
			],
		});
		if (after[0].tricks.length > before[0].tricks.length) {
			this.set({
				phase: "trick",
				views: [beforeDrawing(before[0], after[0]), beforeDrawing(before[1], after[1])],
				lastTrick: after[0].tricks.at(-1)!,
			});
			await this.wait(TRICK_MS / this.state.speed);
		}
		this.set({ views: after, lastTrick: null });
	}

	private setReasoning(seat: number, reasoning: Reasoning) {
		const next: [Reasoning | null, Reasoning | null] = [...this.state.reasoning];
		next[seat] = reasoning;
		this.set({ reasoning: next });
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

	private set(next: Partial<WatchState>) {
		if (this.stopped) return;
		this.state = { ...this.state, ...next };
		for (const listener of this.listeners) listener();
	}
}
