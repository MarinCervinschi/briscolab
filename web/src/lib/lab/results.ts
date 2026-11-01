// The arena's published runs (lab/results/*.json, written by `briscolab-arena --out`). A new file is a new run page.

export interface Interval {
	mean: number;
	low: number;
	high: number;
}

export interface Pair {
	a: string;
	b: string;
	deals: number;
	/** `a`'s score per duplicate deal, a draw counting half. */
	score: Interval;
	/** `a`'s points minus `b`'s, per game. */
	margin: Interval;
	total_score: number;
}

export interface Run {
	name: string;
	config: { bots: string[]; deals: number; first_seed: number };
	engine_version: string;
	git_commit: string;
	pairs: Pair[];
	ratings: Record<string, number>;
}

const files = import.meta.glob<Omit<Run, "name">>("../../../../lab/results/*.json", {
	eager: true,
	import: "default",
});

export const runs: Run[] = Object.entries(files)
	.map(([path, run]) => ({
		...run,
		name: path
			.split("/")
			.at(-1)!
			.replace(/\.json$/, ""),
	}))
	.sort((a, b) => a.name.localeCompare(b.name));

export function getRun(name: string): Run | undefined {
	return runs.find(run => run.name === name);
}

/** The bots from the strongest, by Bradley-Terry rating. */
export function ranking(run: Run): string[] {
	return Object.keys(run.ratings).sort((a, b) => run.ratings[b] - run.ratings[a]);
}

/** `bot`'s score against `other`, read from whichever side the pair was recorded. */
export function scoreAgainst(
	run: Run,
	bot: string,
	other: string
): Interval | undefined {
	const pair = run.pairs.find(
		p => (p.a === bot && p.b === other) || (p.a === other && p.b === bot)
	);
	if (!pair) return undefined;
	if (pair.a === bot) return pair.score;
	return {
		mean: 1 - pair.score.mean,
		low: 1 - pair.score.high,
		high: 1 - pair.score.low,
	};
}

/** A pair is decisive when its interval excludes 50% (CLAUDE.md, "Lab"). */
export function decisive(score: Interval): boolean {
	return score.low > 0.5 || score.high < 0.5;
}
