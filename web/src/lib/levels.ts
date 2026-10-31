import type { BotName } from "@/engine/types";
import { m } from "@/paraglide/messages";

// The four levels of SPEC.md, each one bot of the arena.
export const LEVELS = [
	{ id: "easy", name: m.level_easy, bot: "Greedy", engine: "greedy" },
	{ id: "medium", name: m.level_medium, bot: "Hard", engine: "hard" },
	{ id: "hard", name: m.level_hard, bot: "Endgame", engine: "endgame" },
	{ id: "expert", name: m.level_expert, bot: "ISMCTS", engine: "ismcts" },
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
