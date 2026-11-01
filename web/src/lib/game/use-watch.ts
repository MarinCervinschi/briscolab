import { useEffect, useState, useSyncExternalStore } from "react";

import { Engine } from "@/engine/client";
import type { BotName } from "@/engine/types";

import { WatchRunner } from "./watch";

const noRunner = { subscribe: () => () => {}, state: null };

/** A game between `bots` dealt from `seed`, for as long as the component lives; dealt, not yet played. */
export function useWatch(bots: [BotName, BotName], seed: number) {
	const [runner, setRunner] = useState<WatchRunner | null>(null);
	const [first, second] = bots;
	useEffect(() => {
		const next = new WatchRunner(new Engine());
		setRunner(next);
		// Each bot's seed is derived from the deal, so one seed names the whole game.
		void next.start(seed, [first, second], [seed ^ 0x5eed, seed ^ 0xb075]);
		return () => next.stop();
	}, [first, second, seed]);
	const source = runner ?? noRunner;
	const state = useSyncExternalStore(
		source.subscribe,
		() => source.state,
		() => source.state
	);
	return { state, runner };
}
