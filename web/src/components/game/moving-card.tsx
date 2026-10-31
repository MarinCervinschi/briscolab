import { createContext, useContext, useLayoutEffect, useRef } from "react";

import { animate } from "motion";

import type { Card } from "@/engine/types";
import { cn } from "@/lib/cn";

import { CardBack, CardFace } from "./card";

const EASE = [0.22, 1, 0.36, 1] as const;
export const TRAVEL_S = 0.45;

/**
 * Where cards come from and go to on the table, read after each render so a card that just appeared can start
 * from where its source was one render earlier.
 */
export interface Places {
	deck: DOMRect | null;
	botHand: DOMRect[];
	hand: Map<number, DOMRect>;
	piles: [HTMLElement | null, HTMLElement | null];
}

export const PlacesContext = createContext<Places | null>(null);

export function newPlaces(): Places {
	return { deck: null, botHand: [], hand: new Map(), piles: [null, null] };
}

export function usePlaces(): Places {
	return useContext(PlacesContext)!;
}

export function reducedMotion(): boolean {
	return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function offset(from: DOMRect, el: HTMLElement) {
	const own = el.getBoundingClientRect();
	return {
		x: from.left + from.width / 2 - (own.left + own.width / 2),
		y: from.top + from.height / 2 - (own.top + own.height / 2),
		scale: from.height / own.height,
	};
}

/**
 * A card that travels into its place when it appears: from `from` (the deck, the bot's hand, the player's hand),
 * turning over on the way when `turn` is set. Without `card` it is a back.
 */
export function MovingCard({
	card,
	from,
	turn = false,
	delay = 0,
	label,
	className,
	faceClassName,
}: {
	card?: Card;
	from: () => DOMRect | null | undefined;
	turn?: boolean;
	delay?: number;
	label?: string;
	className?: string;
	/** For what must turn with the card, such as its frame and shadow. */
	faceClassName?: string;
}) {
	const outer = useRef<HTMLSpanElement>(null);
	const inner = useRef<HTMLSpanElement>(null);
	const arrived = useRef(false);
	useLayoutEffect(() => {
		// Strict mode runs the effect twice in development; the second run would measure the card already moved.
		if (arrived.current || reducedMotion()) return;
		arrived.current = true;
		const rect = from();
		const el = outer.current!;
		const options = { duration: TRAVEL_S, delay, ease: EASE };
		if (rect && rect.width > 0) {
			const { x, y, scale } = offset(rect, el);
			el.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
			void animate(el, { x: [x, 0], y: [y, 0], scale: [scale, 1] }, options);
		}
		if (turn && inner.current) {
			inner.current.style.transform = "rotateY(180deg)";
			void animate(inner.current, { rotateY: [180, 0] }, options);
		}
		// Only the arrival is animated: the source is read once, when the card appears.
	}, []);
	return (
		<span
			ref={outer}
			data-card
			className={cn("relative block [perspective:900px]", className)}
		>
			<span
				ref={inner}
				className="relative block h-full w-full [transform-style:preserve-3d]"
			>
				{card ? (
					<CardFace
						card={card}
						className={cn("h-full w-full [backface-visibility:hidden]", faceClassName)}
					/>
				) : (
					<CardBack label={label} className={cn("h-full w-full", faceClassName)} />
				)}
				{card && turn && (
					<CardBack
						className={cn(
							"h-full w-full [transform:rotateY(180deg)] [backface-visibility:hidden]",
							faceClassName
						)}
						style={{ position: "absolute", inset: 0 }}
					/>
				)}
			</span>
		</span>
	);
}

/** Sends a card on the table to the pile of the player who took it; off the edge when the pile is hidden. */
export function sendToPile(el: HTMLElement, pile: HTMLElement | null, up: boolean) {
	if (reducedMotion()) {
		void animate(el, { opacity: 0 }, { duration: 0.2 });
		return;
	}
	const rect = pile?.getBoundingClientRect();
	const target =
		rect && rect.width > 0
			? offset(rect, el)
			: { x: 0, y: up ? -window.innerHeight / 2 : window.innerHeight / 2, scale: 0.4 };
	void animate(
		el,
		{ x: target.x, y: target.y, scale: target.scale, opacity: [1, 1, 0] },
		{ duration: TRAVEL_S, ease: EASE }
	);
}
