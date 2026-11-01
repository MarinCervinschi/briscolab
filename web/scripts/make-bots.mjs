// `pnpm bots`: draws each bot's robot into public/bots/, with DiceBear's Bottts style (design by Pablo Stanley,
// free for personal and commercial use). The seed fixes the robot; the colour is the bot's in the site's palette.
import * as bottts from "@dicebear/bottts";
import { createAvatar } from "@dicebear/core";
import { mkdirSync, writeFileSync } from "node:fs";

const out = new URL("../public/bots", import.meta.url).pathname;
mkdirSync(out, { recursive: true });

const BOTS = {
	greedy: { seed: "greedy-1", colour: "fc734d" },
	hard: { seed: "hard-1", colour: "6fb7df" },
	endgame: { seed: "endgame-1", colour: "0297de" },
	ismcts: { seed: "ismcts-1", colour: "f2f6f8" },
};

for (const [bot, { seed, colour }] of Object.entries(BOTS))
	writeFileSync(
		`${out}/${bot}.svg`,
		`${createAvatar(bottts, { seed, baseColor: [colour] }).toString()}\n`
	);
