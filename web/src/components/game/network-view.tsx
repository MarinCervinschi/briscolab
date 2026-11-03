import { motion, useReducedMotion } from "motion/react";

import type { Reasoning } from "@/engine/types";
import { m } from "@/paraglide/messages";

type Network = Extract<Reasoning, { kind: "network" }>;

const INPUTS = [
	m.network_input_hand,
	m.network_input_table,
	m.network_input_played,
	m.network_input_known,
	m.network_input_briscola,
	m.network_input_points,
	m.network_input_opponent_points,
	m.network_input_deck,
	m.network_input_leads,
];

const WIDTH = 360;
const HEIGHT = 214;
// The nodes start below the row of layer names.
const TOP = 34;
const BOTTOM = 10;
const COLUMNS = [92, 178, 258, 318];
// The gap between one layer lighting up and the next.
const STEP_S = 0.22;

/** Where the `count` nodes of a column sit, spread down the picture. */
function rows(count: number): number[] {
	const span = HEIGHT - TOP - BOTTOM;
	const middle = TOP + span / 2;
	if (count === 1) return [middle];
	const gap = Math.min(span / (count - 1), 60);
	const start = middle - (gap * (count - 1)) / 2;
	return Array.from({ length: count }, (_, i) => start + i * gap);
}

/**
 * The network at work on one move: what goes in, a few of its neurons, and the probability of each card, lit layer
 * after layer. The cards are not named, so it gives nothing of the bot's hand away.
 */
export function NetworkView({ reasoning }: { reasoning: Network }) {
	const still = useReducedMotion() ?? false;
	const pick = reasoning.cards.reduce(
		(best, c, i) => (c.probability > reasoning.cards[best].probability ? i : best),
		0
	);
	const layers = [
		reasoning.inputs,
		...reasoning.hidden,
		reasoning.cards.map(c => c.probability),
	];
	const ys = layers.map(layer => rows(layer.length));
	const key = reasoning.cards.map(c => `${c.card.index}:${c.probability}`).join(",");

	return (
		<figure className="flex flex-col gap-2">
			<svg
				key={key}
				viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
				className="w-full"
				role="img"
				aria-label={m.reasoning_network_cards()}
			>
				{layers
					.slice(1)
					.map((layer, l) =>
						layers[l].flatMap((from, i) =>
							layer.map((to, j) => (
								<motion.line
									key={`${l}-${i}-${j}`}
									x1={COLUMNS[l]}
									y1={ys[l][i]}
									x2={COLUMNS[l + 1]}
									y2={ys[l + 1][j]}
									stroke="var(--color-data)"
									strokeWidth={0.75}
									initial={still ? false : { pathLength: 0, opacity: 0 }}
									animate={{ pathLength: 1, opacity: 0.04 + 0.5 * from * to }}
									transition={{ duration: 0.3, delay: l * STEP_S + 0.1 }}
								/>
							))
						)
					)}
				{layers.map((layer, l) =>
					layer.map((value, i) => {
						const output = l === layers.length - 1;
						return (
							<motion.circle
								key={`${l}-${i}`}
								cx={COLUMNS[l]}
								cy={ys[l][i]}
								r={output ? 7 : 5}
								fill={
									output && i === pick ? "var(--color-signal)" : "var(--color-data)"
								}
								stroke="var(--color-raised)"
								strokeWidth={1.5}
								initial={still ? false : { fillOpacity: 0 }}
								animate={{ fillOpacity: Math.max(0.08, value) }}
								transition={{ duration: 0.25, delay: l * STEP_S }}
							/>
						);
					})
				)}
				{(
					[
						{ x: COLUMNS[0] + 5, anchor: "end", text: m.network_inputs() },
						{
							x: (COLUMNS[1] + COLUMNS[2]) / 2,
							anchor: "middle",
							text: m.network_neurons(),
						},
						{ x: COLUMNS[3] - 7, anchor: "start", text: m.network_cards() },
					] as const
				).map(({ x, anchor, text }) => (
					<text
						key={text}
						x={x}
						y={12}
						textAnchor={anchor}
						dominantBaseline="central"
						fontSize={11}
						fontWeight={600}
						fill="var(--color-text)"
					>
						{text}
					</text>
				))}
				{INPUTS.map((label, i) => (
					<text
						key={i}
						x={COLUMNS[0] - 10}
						y={ys[0][i]}
						textAnchor="end"
						dominantBaseline="central"
						fontSize={10}
						fill="var(--color-text-soft)"
					>
						{label()}
					</text>
				))}
				{reasoning.cards.map((c, i) => (
					<motion.text
						key={c.card.index}
						x={COLUMNS[3] + 12}
						y={ys[3][i]}
						dominantBaseline="central"
						fontSize={11}
						fontFamily="var(--font-mono)"
						fill={i === pick ? "var(--color-signal)" : "var(--color-text-soft)"}
						initial={still ? false : { opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ duration: 0.25, delay: 3 * STEP_S }}
					>
						{m.reasoning_probability({ percent: Math.round(c.probability * 100) })}
					</motion.text>
				))}
			</svg>
			<figcaption className="text-text-soft text-sm leading-relaxed">
				{m.network_caption({
					shown: reasoning.hidden[0]?.length ?? 0,
					width: reasoning.width,
				})}
			</figcaption>
		</figure>
	);
}
