import type { CSSProperties } from "react";

import type { Card } from "@/engine/types";
import { cardImage, cardIndex } from "@/lib/cards";
import { cn } from "@/lib/cn";

/** A card face on paper: the Naples artwork, the index in two corners. */
export function CardFace({ card, className }: { card: Card; className?: string }) {
	return (
		<span
			className={cn(
				"bg-paper relative block overflow-hidden rounded-[12px]",
				className
			)}
		>
			<img
				src={cardImage(card)}
				alt=""
				draggable={false}
				className="absolute inset-0 h-full w-full object-contain px-[12%] py-[14%] mix-blend-multiply"
			/>
			<span className="text-ink-card absolute top-1.5 left-2 font-mono text-sm leading-none">
				{cardIndex(card)}
			</span>
			<span className="text-ink-card absolute right-2 bottom-1.5 rotate-180 font-mono text-sm leading-none">
				{cardIndex(card)}
			</span>
		</span>
	);
}

// The search tree of the "Albero" back, drawn in the back's 150 by 246 frame (DESIGN.md, "Backs").
const ROOT: [number, number] = [75, 30];
const LEVEL1: [number, number][] = [
	[28, 88],
	[75, 88],
	[122, 88],
];
const LEVEL2: [number, number][] = [
	[14, 146],
	[36, 146],
	[58, 146],
	[92, 146],
	[114, 146],
	[136, 146],
];
const LEVEL3: [number, number][] = [
	[52, 204],
	[70, 204],
	[88, 204],
	[108, 204],
];
const KEPT = [ROOT, LEVEL1[1], LEVEL2[3], LEVEL3[2]];
const EDGES: [[number, number], [number, number]][] = [
	...LEVEL1.map(p => [ROOT, p] as [[number, number], [number, number]]),
	...LEVEL2.map(
		(p, i) =>
			[LEVEL1[i < 2 ? 0 : i < 4 ? 1 : 2], p] as [[number, number], [number, number]]
	),
	...LEVEL3.map(p => [LEVEL2[3], p] as [[number, number], [number, number]]),
];

/** The back of a card: the tree on the technical plate, the default back. `label` names the bot. */
export function CardBack({
	label,
	className,
	style,
}: {
	label?: string;
	className?: string;
	style?: CSSProperties;
}) {
	return (
		<span
			style={style}
			className={cn(
				"relative block overflow-hidden rounded-[12px] bg-[#04121c]",
				className
			)}
		>
			<svg
				viewBox="0 0 150 246"
				className="absolute inset-0 h-full w-full"
				aria-hidden="true"
			>
				<rect
					x="8"
					y="8"
					width="134"
					height="230"
					rx="8"
					fill="none"
					stroke="#0297de"
					strokeOpacity="0.35"
				/>
				{["M13 23V13H23", "M127 13H137V23", "M13 223V233H23", "M127 233H137V223"].map(
					d => (
						<path key={d} d={d} fill="none" stroke="#0297de" strokeWidth="1.5" />
					)
				)}
				<text
					x="18"
					y="29"
					fill="#f2f6f8"
					fontSize="13"
					fontWeight="700"
					fontFamily="Space Grotesk"
				>
					B
				</text>
				{label && (
					<text
						x="132"
						y="226"
						fill="#6fb7df"
						fontSize="7"
						textAnchor="end"
						fontFamily="JetBrains Mono"
					>
						{label}
					</text>
				)}
				<g transform="translate(18 26) scale(0.76)">
					{EDGES.map(([a, b], i) => {
						const kept = KEPT.includes(a) && KEPT.includes(b);
						return (
							<line
								key={i}
								x1={a[0]}
								y1={a[1]}
								x2={b[0]}
								y2={b[1]}
								stroke={kept ? "#fc734d" : LEVEL3.includes(b) ? "#1c4462" : "#0297de"}
								strokeWidth={kept ? 3 : 1.4}
								strokeLinecap="round"
							/>
						);
					})}
					{[ROOT, ...LEVEL1, ...LEVEL2, ...LEVEL3].map(([x, y]) => (
						<circle
							key={`${x},${y}`}
							cx={x}
							cy={y}
							r={
								KEPT.some(k => k[0] === x && k[1] === y)
									? 6
									: LEVEL3.some(k => k[0] === x && k[1] === y)
										? 3.5
										: 4.5
							}
							fill={
								KEPT.some(k => k[0] === x && k[1] === y)
									? "#fc734d"
									: LEVEL3.some(k => k[0] === x && k[1] === y)
										? "#1c4462"
										: "#0297de"
							}
						/>
					))}
				</g>
			</svg>
			<span className="pointer-events-none absolute inset-0 rounded-[12px] shadow-[inset_0_1px_0.5px_rgb(255_255_255/0.14),inset_0_0_0_1px_rgb(255_255_255/0.06)]" />
		</span>
	);
}
