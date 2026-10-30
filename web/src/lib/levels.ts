import { m } from "@/paraglide/messages";

// The four levels of SPEC.md, each one bot of the arena.
export const LEVELS = [
	{ id: "facile", name: m.level_easy, bot: "Greedy" },
	{ id: "medio", name: m.level_medium, bot: "Hard" },
	{ id: "difficile", name: m.level_hard, bot: "Endgame" },
	{ id: "esperto", name: m.level_expert, bot: "ISMCTS" },
] as const;

export type LevelId = (typeof LEVELS)[number]["id"];

export function parseLevel(value: unknown): LevelId {
	return LEVELS.find(level => level.id === value)?.id ?? "facile";
}
