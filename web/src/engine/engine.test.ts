import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";

import init, { Session } from "./pkg/briscolab_wasm";
import type { BotName, Reasoning, View } from "./types";

beforeAll(async () => {
	await init({
		module_or_path: readFileSync(
			new URL("./pkg/briscolab_wasm_bg.wasm", import.meta.url)
		),
	});
});

const view = (session: Session, seat = 0) => JSON.parse(session.view(seat)) as View;

/** Seats `bots` with `seeds` and plays `session` to the end, returning the reasoning behind every card. */
function playOut(session: Session, bots: [BotName, BotName], seeds: [number, number]) {
	session.seatBot(0, bots[0], seeds[0]);
	session.seatBot(1, bots[1], seeds[1]);
	const reasonings: Reasoning[] = [];
	while (view(session).toPlay !== null) {
		session.think();
		while (!session.done()) session.step(100);
		reasonings.push(JSON.parse(session.reasoning()) as Reasoning);
		session.playThought();
	}
	return reasonings;
}

describe("the engine in WebAssembly", () => {
	// The same game as `recorded_game_seed_2026` in engine/core/tests/properties.rs.
	it("plays the recorded game of seed 2026 card for card", () => {
		const session = new Session(2026);
		playOut(session, ["random", "random"], [1, 2]);
		const v = view(session);
		const tricks = v.tricks
			.map(t => `${t.cards[0].name} ${t.cards[1].name} P${t.winner}`)
			.join(", ");
		expect(v.briscola.name).toBe("6d");
		expect(tricks).toBe(
			"1b 2b P0, 1d 9s P0, 7c 3c P1, 8s 4d P0, 4b 6s P0, 1c 4c P0, 5d 2s P0, 8d 9c P0, " +
				"6b 7b P1, 10s 7d P0, 9d 10d P1, 6c 3d P0, 7s 5b P0, 3s 5s P0, 10c 8b P0, 10b 5c P0, " +
				"2c 4s P0, 9b 6d P1, 8c 3b P1, 2d 1s P1"
		);
		expect(v.points).toEqual([77, 43]);
		expect(v.outcome).toEqual({ winner: 0 });
	});

	// The same game as `recorded_ismcts_game_seed_11` in engine/core/tests/search.rs.
	it("plays the recorded ISMCTS game of seed 11 card for card", () => {
		const session = new Session(11);
		playOut(session, ["ismcts:200", "hard"], [3, 0]);
		const v = view(session);
		const tricks = v.tricks
			.map(t => `${t.cards[0].name} ${t.cards[1].name} P${t.winner}`)
			.join(", ");
		expect(tricks).toBe(
			"3d 4s P0, 8b 2d P1, 7c 6b P1, 5d 10d P0, 10s 1s P1, 2b 3b P0, 7s 5s P0, 6s 5b P0, 6c 7b P0, " +
				"5c 2s P0, 10b 6d P1, 4b 9b P0, 2c 3c P1, 8c 1c P0, 3s 9d P1, 9s 7d P0, 10c 4c P0, 9c 4d P1, " +
				"1d 8s P1, 1b 8d P0"
		);
		expect(v.points).toEqual([60, 60]);
	});

	it("shows a seat its own hand and only the size of the other", () => {
		const session = new Session(7);
		const mine = view(session, 0);
		const theirs = view(session, 1);
		expect(mine.hand).toHaveLength(3);
		expect(mine.handLens).toEqual([3, 3]);
		expect(mine.hand.map(c => c.index)).not.toEqual(theirs.hand.map(c => c.index));
	});

	it("lets every level's bot play a full game with its reasoning", () => {
		for (const bot of ["greedy", "hard", "endgame", "ismcts:200"] as const) {
			const session = new Session(11);
			const reasonings = playOut(session, [bot, "hard"], [3, 4]);
			expect(view(session).outcome).not.toBeNull();
			const kinds = new Set(reasonings.map(r => r.kind));
			if (bot === "ismcts:200")
				expect([...kinds].sort()).toEqual(["exact", "rule", "search"]);
			if (bot === "endgame") expect(kinds.has("exact")).toBe(true);
		}
	});

	it("reports ISMCTS visits that add up to its iterations", () => {
		const session = new Session(5);
		session.seatBot(0, "ismcts:300", 9);
		session.think();
		session.step(120);
		const partial = JSON.parse(session.reasoning()) as Extract<
			Reasoning,
			{ kind: "search" }
		>;
		expect(partial.iterations).toBe(120);
		expect(partial.cards.reduce((sum, c) => sum + c.visits, 0)).toBe(120);
		expect(partial.hypotheses.length).toBeGreaterThan(0);
		while (!session.done()) session.step(100);
		expect((JSON.parse(session.reasoning()) as { iterations: number }).iterations).toBe(
			300
		);
	});

	it("rejects a card the player does not hold", () => {
		const session = new Session(3);
		const notMine = view(session, 1).hand[0].index;
		expect(() => session.play(notMine)).toThrow(/does not hold/);
	});
});
