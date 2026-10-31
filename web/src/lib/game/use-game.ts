import { useEffect, useState, useSyncExternalStore } from "react";

import { Engine } from "@/engine/client";
import type { BotName } from "@/engine/types";

import { GameRunner } from "./runner";

const noRunner = { subscribe: () => () => {}, state: null };

/** A game against `bot` dealt from `seed`, for as long as the component lives; a new seed starts a new game. */
export function useGame(bot: BotName, seed: number) {
	const [runner, setRunner] = useState<GameRunner | null>(null);
	useEffect(() => {
		const next = new GameRunner(new Engine());
		setRunner(next);
		// The bot's own seed is derived from the deal, so one seed names the whole game.
		void next.start(seed, bot, seed ^ 0x5eed);
		return () => next.stop();
	}, [bot, seed]);
	const source = runner ?? noRunner;
	const state = useSyncExternalStore(
		source.subscribe,
		() => source.state,
		() => source.state
	);
	return { state, runner };
}
