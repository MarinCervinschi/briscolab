import type { Reasoning } from "@/engine/types";
import { m } from "@/paraglide/messages";

/** The points the bot expects to end with, when its reasoning gives a figure: the search and the exact endgame. */
export function forecast(reasoning: Reasoning | null): number | null {
	if (reasoning?.kind === "search") {
		const best = mostVisited(reasoning);
		return best ? best.expectedPoints : null;
	}
	if (reasoning?.kind === "exact")
		return Math.max(...reasoning.results.map(r => r.points));
	return null;
}

/** The card the search is leaning to: the most visited, as the engine picks. */
export function mostVisited(reasoning: Extract<Reasoning, { kind: "search" }>) {
	return reasoning.cards.reduce<(typeof reasoning.cards)[number] | null>(
		(best, c) => (!best || c.visits > best.visits ? c : best),
		null
	);
}

/** The sentence for a rule-based choice. */
export function ruleSentence(reasoning: Extract<Reasoning, { kind: "rule" }>): string {
	const sentences = {
		greedy: {
			lead: m.rule_greedy_lead,
			take: m.rule_greedy_take,
			giveAway: m.rule_greedy_giveAway,
		},
		hard: {
			lead: m.rule_hard_lead,
			assoOnTreOfBriscola: m.rule_hard_assoOnTreOfBriscola,
			spareOnBriscola: m.rule_hard_spareOnBriscola,
			assoOnCarico: m.rule_hard_assoOnCarico,
			briscolaOnCarico: m.rule_hard_briscolaOnCarico,
			strongestOfSuit: m.rule_hard_strongestOfSuit,
			spare: m.rule_hard_spare,
		},
	};
	return reasoning.bot === "greedy"
		? sentences.greedy[reasoning.rule]()
		: sentences.hard[reasoning.rule]();
}
