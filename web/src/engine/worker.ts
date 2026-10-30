/// <reference lib="webworker" />
import init, { Session } from "./pkg/briscolab_wasm";
import wasmUrl from "./pkg/briscolab_wasm_bg.wasm?url";
import { type Request, type Response, THINK_CAP_MS } from "./protocol";
import type { Reasoning, View } from "./types";

// Iterations between two looks at the clock; small enough that the cap is overshot by a few milliseconds.
const STEP = 25;
// How often the page gets the reasoning so far while ISMCTS searches.
const PROGRESS_MS = 100;

const ready = init({ module_or_path: wasmUrl });
let session: Session | undefined;

const send = (message: Response) => self.postMessage(message);
const view = () => JSON.parse(session!.view(0)) as View;
const reasoning = () => JSON.parse(session!.reasoning()) as Reasoning;

function think() {
	const start = performance.now();
	let lastProgress = start;
	session!.think();
	while (!session!.done() && performance.now() - start < THINK_CAP_MS) {
		session!.step(STEP);
		const now = performance.now();
		if (now - lastProgress >= PROGRESS_MS) {
			lastProgress = now;
			send({ type: "thinking", reasoning: reasoning(), elapsedMs: now - start });
		}
	}
	const stoppedEarly = !session!.done();
	const final = reasoning();
	const card = session!.playThought();
	send({
		type: "move",
		card,
		reasoning: final,
		elapsedMs: performance.now() - start,
		stoppedEarly,
		view: view(),
	});
}

self.onmessage = async (event: MessageEvent<Request>) => {
	await ready;
	const request = event.data;
	try {
		switch (request.type) {
			case "new":
				session?.free();
				session = new Session(request.seed);
				session.seatBot(1, request.bot, request.botSeed);
				send({ type: "view", view: view() });
				break;
			case "play":
				session!.play(request.card);
				send({ type: "view", view: view() });
				break;
			case "think":
				think();
				break;
		}
	} catch (error) {
		send({
			type: "error",
			message: error instanceof Error ? error.message : String(error),
		});
	}
};
