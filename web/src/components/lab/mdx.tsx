import defaultMdxComponents from "fumadocs-ui/mdx";

import { PairMatrix, PairTable, Ratings, VersusChampion } from "./charts";

/** What an article can use: Fumadocs' components and the charts, each given a run's name. */
export const labComponents = {
	...defaultMdxComponents,
	Ratings,
	VersusChampion,
	PairMatrix,
	PairTable,
};
