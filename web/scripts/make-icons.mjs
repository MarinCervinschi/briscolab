// `pnpm icons`: renders Briscolab's icons into public/. A hand of three cards fanned out: two backs in the blue of
// the "Tavola tecnica" back, and the card being played in cantaloupe, with the line the bot keeps drawn on it.
import { Resvg } from "@resvg/resvg-js";
import { mkdirSync, writeFileSync } from "node:fs";

const out = new URL("../public", import.meta.url).pathname;
mkdirSync(out, { recursive: true });

const GROUND = "#02070A";
const PLATE = "#04121C";
const DATA = "#0297DE";
const SIGNAL = "#FC734D";

// In a 512 square. The backs are outlined only; the stroke thickens at small sizes so they still read.
function hand({ stroke, tree }) {
	const card = (x, y, angle, extra) =>
		`<rect x="${x}" y="${y}" width="170" height="248" rx="20" transform="rotate(${angle} ${x + 85} ${y + 124})" ${extra}/>`;
	const branch = tree
		? `<g transform="rotate(14 323 228)" stroke="${GROUND}" stroke-width="10" stroke-linecap="round" fill="${GROUND}">` +
			`<line x1="323" y1="172" x2="292" y2="232"/><line x1="323" y1="172" x2="354" y2="232"/>` +
			`<line x1="354" y1="232" x2="340" y2="290"/><circle cx="323" cy="172" r="12"/>` +
			`<circle cx="354" cy="232" r="11"/><circle cx="340" cy="290" r="11"/><circle cx="292" cy="232" r="9"/></g>`
		: "";
	return (
		(tree
			? card(
					104,
					168,
					-16,
					`fill="${PLATE}" stroke="${DATA}" stroke-width="${stroke}" stroke-opacity="0.55"`
				)
			: "") +
		card(171, 136, 0, `fill="${PLATE}" stroke="${DATA}" stroke-width="${stroke}"`) +
		card(238, 104, 14, `fill="${SIGNAL}"`) +
		branch
	);
}

// `scale` shrinks the drawing around the centre; `radius` rounds the ground, for the favicon only (the systems round
// the app icons themselves).
function icon({ scale, radius, small = false }) {
	const offset = 256 - 256 * scale;
	const drawing = hand(small ? { stroke: 20, tree: false } : { stroke: 9, tree: true });
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="${radius}" fill="${GROUND}"/><g transform="translate(${offset} ${offset + 4}) scale(${scale})">${drawing}</g></svg>`;
}

const png = (svg, size) =>
	new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng();

// The favicon is seen at 16 to 32 px: two cards, no tree, thicker outlines.
writeFileSync(
	`${out}/favicon.svg`,
	`${icon({ scale: 1.08, radius: 112, small: true })}\n`
);
writeFileSync(
	`${out}/apple-touch-icon.png`,
	png(icon({ scale: 0.96, radius: 0 }), 180)
);
writeFileSync(`${out}/icon-192.png`, png(icon({ scale: 0.96, radius: 0 }), 192));
writeFileSync(`${out}/icon-512.png`, png(icon({ scale: 0.96, radius: 0 }), 512));
// Android crops a maskable icon to a circle of 80% of its width: the drawing stays inside it.
writeFileSync(
	`${out}/icon-maskable-512.png`,
	png(icon({ scale: 0.76, radius: 0 }), 512)
);
