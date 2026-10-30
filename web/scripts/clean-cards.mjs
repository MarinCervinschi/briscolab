// `node scripts/clean-cards.mjs <source dir> <out dir>`: removes the printer's marks from the Commons scans of the
// Naples deck (Dal Negro, Treviso) and writes the 40 cards as PNGs; `sips` then makes the JPEGs in public/cards.
// The sources are the 960 px thumbnails of Category:Naples deck; every coordinate below is in that size.
import { Resvg } from "@resvg/resvg-js";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { crc32, deflateSync } from "node:zlib";

const [src, out] = process.argv.slice(2);
const W = 960;
const H = 1586;
const YELLOW = [252, 215, 5];

function decode(file) {
	const b64 = readFileSync(file).toString("base64");
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><image href="data:image/jpeg;base64,${b64}" width="${W}" height="${H}"/></svg>`;
	return Buffer.from(new Resvg(svg).render().pixels);
}

function encode(px) {
	const chunk = (type, data) => {
		const head = Buffer.alloc(8);
		head.writeUInt32BE(data.length, 0);
		head.write(type, 4, "ascii");
		const crc = Buffer.alloc(4);
		crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])) >>> 0, 0);
		return Buffer.concat([head, data, crc]);
	};
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(W, 0);
	ihdr.writeUInt32BE(H, 4);
	ihdr.set([8, 6, 0, 0, 0], 8);
	const raw = Buffer.alloc(H * (W * 4 + 1));
	for (let y = 0; y < H; y++)
		px.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4);
	return Buffer.concat([
		Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
		chunk("IHDR", ihdr),
		chunk("IDAT", deflateSync(raw)),
		chunk("IEND", Buffer.alloc(0)),
	]);
}

const at = (x, y) => (y * W + x) * 4;
const luma = (px, i) => 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
const paint = (px, i, [r, g, b]) => px.set([r, g, b, 255], i);

// Every pixel that is not white inside the box turns white.
function whiten(px, [x0, y0, x1, y1]) {
	for (let y = y0; y < y1; y++)
		for (let x = x0; x < x1; x++) paint(px, at(x, y), [255, 255, 255]);
}

// Only bluish or light pixels inside the box turn white, the printed text and its soft edge: black outlines stay.
function whitenBlue(px, [x0, y0, x1, y1]) {
	for (let y = y0; y < y1; y++)
		for (let x = x0; x < x1; x++) {
			const i = at(x, y);
			if (px[i + 2] > px[i] + 12 || luma(px, i) > 190) paint(px, i, [255, 255, 255]);
		}
}

// The ace of denari prints "T. DAL NEGRO TREVISO" in black on the yellow lower ring. Along rays from the ring's
// centre, the first dark run is the inner outline and the last dark run before the white ground is the outer
// one; the band between them, kept clear of both outlines, is painted plain yellow over the letters.
function clearRing(px) {
	const cx = 478;
	const cy = 1178;
	const edge = 11;
	const bands = new Map();
	for (let step = 50; step <= 1720; step++) {
		const a = ((step / 10) * Math.PI) / 180;
		const point = r => [
			Math.round(cx + r * Math.cos(a)),
			Math.round(cy + r * Math.sin(a)),
		];
		const dark = r => {
			const [x, y] = point(r);
			return x < 0 || y < 0 || x >= W || y >= H ? false : luma(px, at(x, y)) < 110;
		};
		const white = r => {
			const [x, y] = point(r);
			return x < 0 || y < 0 || x >= W || y >= H ? true : luma(px, at(x, y)) > 235;
		};
		let inner = -1;
		for (let r = 150; r < 420; r++)
			if (dark(r)) {
				inner = r;
				break;
			}
		if (inner < 0) continue;
		let outer = -1;
		for (let r = inner + 40; r < 470; r++) {
			let clear = true;
			for (let k = 0; k < 14; k++) if (!white(r + k)) clear = false;
			if (clear) {
				outer = r;
				break;
			}
		}
		if (outer > 0) bands.set(step, [inner + edge, outer - edge]);
	}
	// Pixel by pixel, so no gap is left between two rays.
	for (let y = cy; y < H; y++)
		for (let x = 0; x < W; x++) {
			const band = bands.get(Math.round((Math.atan2(y - cy, x - cx) * 1800) / Math.PI));
			if (!band) continue;
			const r = Math.hypot(x - cx, y - cy);
			if (r >= band[0] && r < band[1]) paint(px, at(x, y), YELLOW);
		}
}

const fixes = {
	"coppe-04.jpg": px => whiten(px, [340, 600, 640, 900]),
	"denari-04.jpg": px => whiten(px, [340, 600, 640, 900]),
	"denari-01.jpg": px => {
		whitenBlue(px, [330, 850, 650, 940]);
		whiten(px, [420, 1355, 545, 1415]);
		clearRing(px);
	},
};

for (const name of readdirSync(src).filter(f =>
	/^(bastoni|coppe|denari|spade)-\d\d\.jpg$/.test(f)
)) {
	const px = decode(`${src}/${name}`);
	fixes[name]?.(px);
	writeFileSync(`${out}/${name.replace(".jpg", ".png")}`, encode(px));
}
