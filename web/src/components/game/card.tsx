import type { CSSProperties } from "react";

import type { Card } from "@/engine/types";
import { cardImage, cardIndex, cardName } from "@/lib/cards";
import { cn } from "@/lib/cn";
import { type Settings, useSettings } from "@/lib/settings";

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
				alt={cardName(card)}
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

type Point = [number, number];
interface Line {
	a: Point;
	b: Point;
	colour: string;
	width: number;
}
interface Dot {
	at: Point;
	r: number;
	colour: string;
}

const BLUE = "#0297de";
const ORANGE = "#fc734d";
const FAINT = "#1c4462";

/** The three lab drawings of DESIGN.md ("Backs"), in the back's 150 by 246 frame; each is the same on every render. */
function drawing(kind: Settings["drawing"]): { lines: Line[]; dots: Dot[] } {
	const lines: Line[] = [];
	const dots: Dot[] = [];
	if (kind === "tree") {
		// A search tree, and in orange the line the bot keeps.
		const root: Point = [75, 30];
		const l1: Point[] = [
			[28, 88],
			[75, 88],
			[122, 88],
		];
		const l2: Point[] = [14, 36, 58, 92, 114, 136].map(x => [x, 146]);
		const l3: Point[] = [52, 70, 88, 108].map(x => [x, 204]);
		const kept = (yes: boolean) => ({
			colour: yes ? ORANGE : BLUE,
			width: yes ? 3 : 1.4,
		});
		l1.forEach((p, i) => lines.push({ a: root, b: p, ...kept(i === 1) }));
		l2.forEach((p, i) =>
			lines.push({ a: l1[i < 2 ? 0 : i < 4 ? 1 : 2], b: p, ...kept(i === 3) })
		);
		l3.forEach((p, i) =>
			lines.push({
				a: l2[3],
				b: p,
				colour: i === 2 ? ORANGE : FAINT,
				width: i === 2 ? 3 : 1.4,
			})
		);
		[root, ...l1, ...l2].forEach(p => dots.push({ at: p, r: 4.5, colour: BLUE }));
		l3.forEach(p => dots.push({ at: p, r: 3.5, colour: FAINT }));
		[root, l1[1], l2[3], l3[2]].forEach(p =>
			dots.push({ at: p, r: 6, colour: ORANGE })
		);
	}
	if (kind === "montecarlo") {
		// Random points from a fixed seed: orange inside a quarter circle, blue outside; the arc is never drawn.
		let seed = 2026;
		const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
		for (let i = 0; i < 300; i++) {
			const at: Point = [6 + next() * 138, 6 + next() * 234];
			const inside = Math.hypot(at[0] - 6, at[1] - 240) < 150;
			dots.push({ at, r: 1.8, colour: inside ? ORANGE : BLUE });
		}
	}
	if (kind === "net") {
		// A small network of four layers, and in orange the strongest path to the output.
		const layers: Point[][] = [
			[56, 88, 120, 152, 184].map(y => [22, y]),
			[40, 80, 120, 160, 200].map(y => [60, y]),
			[64, 120, 176].map(y => [98, y]),
			[[130, 120]],
		];
		for (let k = 0; k < layers.length - 1; k++)
			for (const a of layers[k])
				for (const b of layers[k + 1]) lines.push({ a, b, colour: FAINT, width: 1 });
		const path = [layers[0][2], layers[1][1], layers[2][1], layers[3][0]];
		for (let k = 0; k < 3; k++)
			lines.push({ a: path[k], b: path[k + 1], colour: ORANGE, width: 3 });
		layers.flat().forEach(p => dots.push({ at: p, r: 5, colour: BLUE }));
		path.forEach(p => dots.push({ at: p, r: 6, colour: ORANGE }));
	}
	return { lines, dots };
}

const DRAWINGS_CACHE = new Map<Settings["drawing"], ReturnType<typeof drawing>>();
const cachedDrawing = (kind: Settings["drawing"]) => {
	if (!DRAWINGS_CACHE.has(kind)) DRAWINGS_CACHE.set(kind, drawing(kind));
	return DRAWINGS_CACHE.get(kind)!;
};

const CAPTIONS: Record<Settings["drawing"], string> = {
	tree: "ISMCTS · 1000",
	montecarlo: "PIMC · 100",
	net: "PPO · v1.1",
};

// Where the drawing sits inside each style, in the back's frame.
const MOTIF: Record<
	Settings["backStyle"],
	{ x: number; y: number; w: number; h: number }
> = {
	tavola: { x: 18, y: 26, w: 114, h: 188 },
	quaderno: { x: 17, y: 32, w: 116, h: 196 },
	vetrino: { x: 16, y: 14, w: 118, h: 184 },
};

const GROUND: Record<Settings["backStyle"], string> = {
	tavola: "#04121c",
	quaderno: "#0c1418",
	vetrino: "#0e2233",
};

/**
 * The back of a card: one of the lab drawings on one of the card styles, as the settings choose; `drawing` and
 * `backStyle` override them, for the previews in the settings. `label` names the bot.
 */
export function CardBack({
	label,
	className,
	style,
	drawing: drawingKind,
	backStyle,
}: {
	label?: string;
	className?: string;
	style?: CSSProperties;
	drawing?: Settings["drawing"];
	backStyle?: Settings["backStyle"];
}) {
	const settings = useSettings();
	const kind = drawingKind ?? settings.drawing;
	const look = backStyle ?? settings.backStyle;
	const { lines, dots } = cachedDrawing(kind);
	const motif = MOTIF[look];
	const caption = label ?? CAPTIONS[kind];
	return (
		<span
			style={{ ...style, background: GROUND[look] }}
			className={cn("relative block overflow-hidden rounded-[12px]", className)}
		>
			<svg
				viewBox="0 0 150 246"
				className="absolute inset-0 h-full w-full"
				aria-hidden="true"
			>
				{look === "tavola" && (
					<>
						<rect
							x="8"
							y="8"
							width="134"
							height="230"
							rx="8"
							fill="none"
							stroke={BLUE}
							strokeOpacity="0.35"
						/>
						{[
							"M13 23V13H23",
							"M127 13H137V23",
							"M13 223V233H23",
							"M127 233H137V223",
						].map(d => (
							<path key={d} d={d} fill="none" stroke={BLUE} strokeWidth="1.5" />
						))}
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
						<text
							x="132"
							y="226"
							fill="#6fb7df"
							fontSize="7"
							textAnchor="end"
							fontFamily="JetBrains Mono"
						>
							{caption}
						</text>
					</>
				)}
				{look === "quaderno" && (
					<>
						<rect x="9" y="22" width="132" height="215" rx="8" fill="#071521" />
						{QUADERNO_DOTS.map(([x, y]) => (
							<circle key={`${x},${y}`} cx={x} cy={y} r="0.8" fill="#16334a" />
						))}
						<path d="M52 0H98V6A7 7 0 0 1 91 13H59A7 7 0 0 1 52 6Z" fill={ORANGE} />
					</>
				)}
				{look === "vetrino" && (
					<rect
						x="8"
						y="8"
						width="134"
						height="194"
						rx="8"
						fill="#061827"
						stroke={BLUE}
						strokeOpacity="0.28"
					/>
				)}
				<svg
					x={motif.x}
					y={motif.y}
					width={motif.w}
					height={motif.h}
					viewBox="0 0 150 246"
				>
					{lines.map((l, i) => (
						<line
							key={i}
							x1={l.a[0]}
							y1={l.a[1]}
							x2={l.b[0]}
							y2={l.b[1]}
							stroke={l.colour}
							strokeWidth={l.width}
							strokeLinecap="round"
						/>
					))}
					{dots.map((d, i) => (
						<circle key={i} cx={d.at[0]} cy={d.at[1]} r={d.r} fill={d.colour} />
					))}
				</svg>
				{look === "vetrino" && (
					<>
						<rect x="8" y="208" width="134" height="30" rx="6" fill="#fbf8f1" />
						<rect x="17" y="214" width="4" height="18" rx="2" fill={ORANGE} />
						<text
							x="28"
							y="222"
							fill="#02070a"
							fontSize="9"
							fontWeight="700"
							fontFamily="Space Grotesk"
						>
							Briscolab
						</text>
						<text
							x="28"
							y="231"
							fill="#02070a"
							fontSize="6.5"
							fontFamily="JetBrains Mono"
						>
							{caption}
						</text>
						{/* The glass's reflection, a diagonal band (DESIGN.md allows it on this back only). */}
						<path d="M0 0H62L0 118Z" fill="#fff" fillOpacity="0.08" />
						<path d="M78 0H90L0 171V148Z" fill="#fff" fillOpacity="0.05" />
					</>
				)}
			</svg>
			<span className="pointer-events-none absolute inset-0 rounded-[12px] shadow-[inset_0_1px_0.5px_rgb(255_255_255/0.14),inset_0_0_0_1px_rgb(255_255_255/0.06)]" />
		</span>
	);
}

// The lab notebook's dot grid, inside the Quaderno's frame.
const QUADERNO_DOTS: Point[] = [];
for (let y = 26; y < 237; y += 7)
	for (let x = 12; x < 140; x += 7) QUADERNO_DOTS.push([x, y]);
