import { getSettings } from "./settings";

// The table's sounds: Kenney's Casino Audio (CC0), converted to WAV so every browser plays them. They play only
// when the settings leave sound on, and only after the page has had a tap or a click, as browsers require.

const VARIANTS = {
	shuffle: ["shuffle"],
	deal: ["deal-1", "deal-2", "deal-3"],
	play: ["play-1", "play-2", "play-3"],
	take: ["take-1", "take-2"],
	end: ["end"],
} as const;

export type Sound = keyof typeof VARIANTS;

let context: AudioContext | null = null;
const buffers = new Map<string, Promise<AudioBuffer | null>>();

function load(ctx: AudioContext, name: string) {
	if (!buffers.has(name))
		buffers.set(
			name,
			fetch(`/sounds/${name}.wav`)
				.then(r => r.arrayBuffer())
				.then(data => ctx.decodeAudioData(data))
				.catch(() => null)
		);
	return buffers.get(name)!;
}

/** Plays `sound` after `delay` seconds; a variant at random, so repeated cards do not sound the same. */
export function playSound(sound: Sound, delay = 0) {
	if (!getSettings().sound || typeof AudioContext === "undefined") return;
	context ??= new AudioContext();
	const ctx = context;
	if (ctx.state === "suspended") void ctx.resume();
	const names = VARIANTS[sound];
	const name = names[Math.floor(Math.random() * names.length)];
	void load(ctx, name).then(buffer => {
		if (!buffer || ctx.state !== "running") return;
		const source = ctx.createBufferSource();
		const gain = ctx.createGain();
		gain.gain.value = 0.6;
		source.buffer = buffer;
		source.connect(gain).connect(ctx.destination);
		source.start(ctx.currentTime + delay);
	});
}

// Safari starts audio only inside a tap or a click: the first one on the page opens the sound for the visit.
if (typeof document !== "undefined")
	document.addEventListener(
		"pointerdown",
		() => {
			if (!getSettings().sound || typeof AudioContext === "undefined") return;
			context ??= new AudioContext();
			void context.resume();
		},
		{ once: true, capture: true }
	);
