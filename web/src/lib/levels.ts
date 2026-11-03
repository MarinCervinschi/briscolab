import type { BotName } from "@/engine/types";
import { m } from "@/paraglide/messages";

// The five levels of SPEC.md, each one bot of the arena.
export const LEVELS = [
	{ id: "easy", name: m.level_easy, bot: "Greedy", engine: "greedy" },
	{ id: "medium", name: m.level_medium, bot: "Hard", engine: "hard" },
	{ id: "hard", name: m.level_hard, bot: "Endgame", engine: "endgame" },
	{ id: "expert", name: m.level_expert, bot: "ISMCTS", engine: "ismcts" },
	{ id: "champion", name: m.level_champion, bot: "PPO", engine: "ppo" },
] as const satisfies readonly {
	id: string;
	name: () => string;
	bot: string;
	engine: BotName;
}[];

export type LevelId = (typeof LEVELS)[number]["id"];

export function parseLevel(value: unknown): LevelId {
	return LEVELS.find(level => level.id === value)?.id ?? "easy";
}

/** The bots that can be watched against each other: the five levels' bots. */
export const WATCH_BOTS = LEVELS.map(level => ({
	engine: level.engine,
	name: level.bot,
}));

export type WatchBot = (typeof LEVELS)[number]["engine"];

/** Two bots from the URL, `first,second`; unknown names fall back to Endgame against ISMCTS. */
export function parseBots(value: unknown): [WatchBot, WatchBot] {
	const names = typeof value === "string" ? value.split(",") : [];
	const known = (name: string | undefined) =>
		WATCH_BOTS.find(bot => bot.engine === name)?.engine;
	const first = known(names[0]);
	const second = known(names[1]);
	return first && second ? [first, second] : ["endgame", "ismcts"];
}

export function botLabel(engine: string): string {
	return WATCH_BOTS.find(bot => bot.engine === engine)?.name ?? engine;
}
