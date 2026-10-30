import type { Request, Response } from "./protocol";
import type { BotName, Reasoning, View } from "./types";

export type Move = Extract<Response, { type: "move" }>;

/** The engine in its Web Worker. One request at a time: the game is played turn by turn. */
export class Engine {
	private worker = new Worker(new URL("./worker.ts", import.meta.url), {
		type: "module",
	});

	/** A new game: the player in seat 0, `bot` in seat 1. */
	newGame(seed: number, bot: BotName, botSeed: number): Promise<View> {
		return this.ask({ type: "new", seed, bot, botSeed }).then(
			r => (r as { view: View }).view
		);
	}

	play(card: number): Promise<View> {
		return this.ask({ type: "play", card }).then(r => (r as { view: View }).view);
	}

	/** The bot's card, played; `onThinking` gets its reasoning while ISMCTS searches. */
	think(onThinking?: (reasoning: Reasoning) => void): Promise<Move> {
		return this.ask({ type: "think" }, onThinking) as Promise<Move>;
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
