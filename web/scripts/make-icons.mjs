// `pnpm icons`: renders Briscolab's icons into public/. Two cards after "Card" by wenwu zhang (CC BY,
// behance.net/suiyuerugeca71), recoloured: cantaloupe behind, electric blue in front, and on the front card the
// search tree of the "Albero" back in place of the heart, with the line the bot keeps in orange.
import { Resvg } from "@resvg/resvg-js";
import { mkdirSync, writeFileSync } from "node:fs";

const out = new URL("../public", import.meta.url).pathname;
mkdirSync(out, { recursive: true });

const GROUND = "#02070A";
const DATA = "#0297DE";
const SIGNAL = "#FC734D";
const PAPER = "#FBF8F1";

const BACK = `<path d="M171.5 871.7l91.6-871.8 614.5 64.6-91.6 871.8-614.5-64.6Z" fill="${SIGNAL}"/>`;
const FRONT = `<path d="M184.4 102h557.9a43.9 43.9 0 0 1 46 41.1v836.9a43.9 43.9 0 0 1-43.2 43.9H184.4A43.2 43.2 0 0 1 141.2 980V143.2A43.2 43.2 0 0 1 184.4 102z" fill="${DATA}"/>`;

// A binary search tree three levels deep, wider than tall at the bottom, so it reads as a tree and not a figure.
const root = [465, 250];
const level1 = [
	[310, 470],
	[620, 470],
];
const level2 = [
	[225, 700],
	[395, 700],
	[535, 700],
	[705, 700],
];
const level3 = [
	[470, 910],
	[600, 910],
];
const edges = [
	[root, level1[0]],
	[root, level1[1]],
	[level1[0], level2[0]],
	[level1[0], level2[1]],
	[level1[1], level2[2]],
	[level1[1], level2[3]],
	[level2[2], level3[0]],
	[level2[2], level3[1]],
];
const kept = [root, level1[1], level2[2], level3[1]];
const line = ([x1, y1], [x2, y2], colour, width) =>
	`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${colour}" stroke-width="${width}" stroke-linecap="round"/>`;
const node = ([x, y], colour, r) =>
	`<circle cx="${x}" cy="${y}" r="${r}" fill="${colour}"/>`;
const TREE = [
	...edges.map(([a, b]) => line(a, b, GROUND, 24)),
	...kept.slice(1).map((p, i) => line(kept[i], p, SIGNAL, 32)),
	...[root, ...level1, ...level2, ...level3].map(p => node(p, PAPER, 36)),
	...kept.map(p => node(p, SIGNAL, 42)),
].join("");

// The drawing spans 141-878 by 0-1024; `scale` shrinks it around the centre of the square.
function icon({ scale, ground }) {
	const offset = 512 - 512 * scale;
	const field = ground ? `<rect width="1024" height="1024" fill="${GROUND}"/>` : "";
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${field}<g transform="translate(${offset} ${offset}) scale(${scale})">${BACK}${FRONT}${TREE}</g></svg>`;
}

const png = (svg, size) =>
	new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng();

writeFileSync(
	`${out}/favicon.svg`,
	`<!-- After "Card" by wenwu zhang, CC BY: https://www.behance.net/suiyuerugeca71 -->\n${icon({ scale: 0.96, ground: false })}\n`
);
writeFileSync(
	`${out}/apple-touch-icon.png`,
	png(icon({ scale: 0.78, ground: true }), 180)
);
writeFileSync(`${out}/icon-192.png`, png(icon({ scale: 0.78, ground: true }), 192));
writeFileSync(`${out}/icon-512.png`, png(icon({ scale: 0.78, ground: true }), 512));
writeFileSync(
	`${out}/icon-maskable-512.png`,
	png(icon({ scale: 0.6, ground: true }), 512)
);
