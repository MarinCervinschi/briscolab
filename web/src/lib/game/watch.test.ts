import { describe, expect, it } from "vitest";

import type { Engine, Move } from "@/engine/client";
import type { Card, Reasoning, View } from "@/engine/types";

import { WatchRunner } from "./watch";

const card = (index: number): Card => ({
	index,
	name: `${index}`,
	suit: "coppe",
	rank: 1,
	points: 0,
});

function view(patch: Partial<View>): View {
	return {
		seat: 0,
		hand: [card(1), card(2), card(3)],
		table: [],
		briscola: card(9),
		briscolaDrawnBy: null,
		deckLen: 0,
		handLens: [3, 3],
		leader: 0,
		toPlay: 0,
		tricks: [],
		points: [0, 0],
		outcome: null,
		...patch,
	};
}

const reasoning: Reasoning = { kind: "rule", bot: "hard", rule: "spare" };

/** A scripted game of `cards` cards, seats taking turns from seat 0, over at the last one. */
function fakeEngine(cards: number): Engine & { played: number[]; terminated: boolean } {
	let played = 0;
	const at = (n: number): [View, View] => {
		const v = view({
			table: [card(n)],
			toPlay: n >= cards ? null : n % 2,
			outcome: n >= cards ? { winner: 0 } : null,
		});
		return [v, { ...v, seat: 1 }];
	};
	const engine = {
		played: [] as number[],
		watch: async () => at(0),
		think: async () => {
			const seat = played % 2;
			played += 1;
			engine.played.push(seat);
			return {
				type: "move",
				seat,
				card: played,
				reasoning,
				elapsedMs: 1,
				stoppedEarly: false,
				views: at(played),
			} as Move;
		},
		terminated: false,
		terminate: () => {
			engine.terminated = true;
		},
	};
	return engine as unknown as Engine & { played: number[]; terminated: boolean };
}

describe("WatchRunner", () => {
	it("lets the two bots play in turn to the end, recording each card's reasoning", async () => {
		const engine = fakeEngine(4);
		const runner = new WatchRunner(engine, async () => {});
		await runner.start(1, ["hard", "greedy"], [2, 3]);
		await runner.play();
		expect(runner.state.phase).toBe("over");
		expect(engine.played).toEqual([0, 1, 0, 1]);
		expect(runner.state.moves.map(m => m.seat)).toEqual([0, 1, 0, 1]);
		expect(runner.state.reasoning).toEqual([reasoning, reasoning]);
	});

	it("plays one card at a time while paused", async () => {
		const engine = fakeEngine(4);
		const runner = new WatchRunner(engine, async () => {});
		await runner.start(1, ["hard", "greedy"], [2, 3]);
		runner.pause();
		const playing = runner.play();
		await new Promise(r => setTimeout(r, 0));
		expect(engine.played).toEqual([]);
		runner.step();
		await new Promise(r => setTimeout(r, 0));
		expect(engine.played).toEqual([0]);
		runner.resume();
		await playing;
		expect(engine.played).toEqual([0, 1, 0, 1]);
	});

	it("stops the worker and plays no more cards once the page is left", async () => {
		const engine = fakeEngine(4);
		const runner = new WatchRunner(engine, async () => {});
		await runner.start(1, ["hard", "greedy"], [2, 3]);
		runner.pause();
		void runner.play();
		runner.step();
		await new Promise(r => setTimeout(r, 0));
		runner.stop();
		await new Promise(r => setTimeout(r, 0));
		expect(engine.terminated).toBe(true);
		expect(engine.played).toEqual([0]);
	});
});
