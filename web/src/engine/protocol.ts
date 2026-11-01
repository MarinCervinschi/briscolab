import type { BotName, Reasoning, View } from "./types";

/** What the page asks the worker. Every request gets exactly one final answer. */
export type Request =
	/** A new game from `seed`, with a bot in each seat that has one: null is a person. */
	| {
			type: "new";
			seed: number;
			bots: [BotName | null, BotName | null];
			botSeeds: [number, number];
	  }
	| { type: "play"; card: number }
	/** The bot of the seat to move chooses and plays its card. */
	| { type: "think" };

/** What the worker answers: `thinking` comes zero or more times before a `move`. */
export type Response =
	/** What each seat sees: seat 0, then seat 1. */
	| { type: "view"; views: [View, View] }
	| { type: "thinking"; reasoning: Reasoning; elapsedMs: number }
	| {
			type: "move";
			/** The seat that played. */
			seat: number;
			card: number;
			reasoning: Reasoning;
			elapsedMs: number;
			stoppedEarly: boolean;
			views: [View, View];
	  }
	| { type: "error"; message: string };

/** The longest a bot may think about one card before it plays its best so far (SPEC.md, decision 12). */
export const THINK_CAP_MS = 1000;
