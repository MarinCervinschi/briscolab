import { describe, expect, it } from "vitest";

import type { Engine, Move } from "@/engine/client";
import type { Card, Reasoning, View } from "@/engine/types";

import { GameRunner, TRICK_MS } from "./runner";

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
		deckLen: 34,
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
const trick = {
	leader: 0,
	cards: [card(1), card(5)] as [Card, Card],
	winner: 1,
	points: 11,
};

/** A scripted engine: the player leads card 1, the bot answers with card 5 and wins, then it is the player's turn. */
function fakeEngine(): Engine {
	const afterBot = view({
		hand: [card(2), card(3), card(4)],
		toPlay: 0,
		leader: 0,
		tricks: [trick],
		points: [0, 11],
	});
	return {
		newGame: async () => view({}),
		play: async () => view({ hand: [card(2), card(3)], table: [card(1)], toPlay: 1 }),
		think: async () =>
			({
				type: "move",
				card: 5,
				reasoning,
				elapsedMs: 3,
				stoppedEarly: false,
				view: afterBot,
			}) as Move,
		terminate: () => {},
	} as unknown as Engine;
}

describe("GameRunner", () => {
	it("hands the turn to the bot, shows the trick it wins and records why it played its card", async () => {
		const waits: number[] = [];
		const runner = new GameRunner(fakeEngine(), async ms => {
			waits.push(ms);
		});
		await runner.start(1, "hard", 2);
		expect(runner.state.phase).toBe("player");

		await runner.play(card(1));
		// The bot is seen thinking for its minimum time, then the trick it won stays on the table.
		expect(waits[0]).toBeGreaterThan(1000);
		expect(waits[1]).toBe(TRICK_MS);
		expect(runner.state.moves).toEqual([{ trick: 0, card: card(5), reasoning }]);
		expect(runner.state.reasoning).toEqual(reasoning);
		expect(runner.state.lastTrick).toBeNull();
		expect(runner.state.view?.tricks).toHaveLength(1);
	});

	it("ignores a card played out of turn", async () => {
		const runner = new GameRunner(fakeEngine(), async () => {});
		await runner.start(1, "hard", 2);
		const playing = runner.play(card(1));
		await runner.play(card(2));
		await playing;
		expect(runner.state.moves).toHaveLength(1);
	});

	it("skips the bot's visible thinking", async () => {
		let release: () => void = () => {};
		const runner = new GameRunner(fakeEngine(), ms =>
			ms > 1000 && ms !== TRICK_MS
				? new Promise<void>(r => (release = r))
				: Promise.resolve()
		);
		await runner.start(1, "hard", 2);
		const playing = runner.play(card(1));
		await new Promise(r => setTimeout(r, 0));
		expect(runner.state.phase).toBe("bot");
		runner.skipThinking();
		await playing;
		expect(runner.state.moves).toHaveLength(1);
		release();
	});
});
