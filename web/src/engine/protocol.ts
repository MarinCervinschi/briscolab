import type { BotName, Reasoning, View } from "./types";

/** What the page asks the worker. Every request gets exactly one final answer. */
export type Request =
	/** A new game from `seed`, with the player in seat 0 and `bot` in seat 1. */
	| { type: "new"; seed: number; bot: BotName; botSeed: number }
	| { type: "play"; card: number }
	/** The bot in seat 1 chooses and plays its card. */
	| { type: "think" };

/** What the worker answers: `thinking` comes zero or more times before a `move`. */
export type Response =
	| { type: "view"; view: View }
	| { type: "thinking"; reasoning: Reasoning; elapsedMs: number }
	| {
			type: "move";
			card: number;
			reasoning: Reasoning;
			elapsedMs: number;
			stoppedEarly: boolean;
			view: View;
	  }
	| { type: "error"; message: string };

/** The longest a bot may think about one card before it plays its best so far (SPEC.md, decision 12). */
export const THINK_CAP_MS = 1000;
