import type { Request, Response } from "./protocol";
import type { BotName, Reasoning, View } from "./types";

export type Move = Extract<Response, { type: "move" }>;
type Views = Extract<Response, { type: "view" }>;

/** The engine in its Web Worker. One request at a time: the game is played turn by turn. */
export class Engine {
	private worker = new Worker(new URL("./worker.ts", import.meta.url), {
		type: "module",
	});

	/** A new game: the player in seat 0, `bot` in seat 1. Returns what the player sees. */
	newGame(seed: number, bot: BotName, botSeed: number): Promise<View> {
		return this.start(seed, [null, bot], [0, botSeed]).then(views => views[0]);
	}

	/** A new game between two bots, `bots[i]` in seat i. Returns what each seat sees. */
	watch(seed: number, bots: [BotName, BotName], botSeeds: [number, number]) {
		return this.start(seed, bots, botSeeds);
	}

	play(card: number): Promise<View> {
		return this.ask({ type: "play", card }).then(r => (r as Views).views[0]);
	}

	/** The bot's card, played; `onThinking` gets its reasoning while ISMCTS searches. */
	think(onThinking?: (reasoning: Reasoning) => void): Promise<Move> {
		return this.ask({ type: "think" }, onThinking) as Promise<Move>;
	}

	private start(
		seed: number,
		bots: [BotName | null, BotName | null],
		botSeeds: [number, number]
	): Promise<[View, View]> {
		return this.ask({ type: "new", seed, bots, botSeeds }).then(
			r => (r as Views).views
		);
	}

	terminate() {
		this.worker.terminate();
	}

	private ask(
		request: Request,
		onThinking?: (reasoning: Reasoning) => void
	): Promise<Response> {
		return new Promise((resolve, reject) => {
			this.worker.onmessage = (event: MessageEvent<Response>) => {
				const response = event.data;
				if (response.type === "thinking") onThinking?.(response.reasoning);
				else if (response.type === "error") reject(new Error(response.message));
				else resolve(response);
			};
			this.worker.postMessage(request);
		});
	}
}
