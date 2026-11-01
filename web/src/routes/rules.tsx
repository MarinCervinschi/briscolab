import { useState } from "react";

import { Link, createFileRoute } from "@tanstack/react-router";
import { motion } from "motion/react";

import { CardBack, CardFace } from "@/components/game/card";
import { Felt } from "@/components/game/table";
import { SiteHeader } from "@/components/site-header";
import type { Card, Suit } from "@/engine/types";
import { cardName } from "@/lib/cards";
import { cn } from "@/lib/cn";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/rules")({ component: Rules });

const SUITS: Suit[] = ["coppe", "denari", "bastoni", "spade"];

// Only the face is drawn from these: what each card is worth is the page's text, as in docs/rules.md.
const card = (suit: Suit, rank: number): Card => ({
	index: SUITS.indexOf(suit) * 10 + rank - 1,
	name: "",
	suit,
	rank,
	points: 0,
});

const COUNTING: [number, number][] = [
	[1, 11],
	[3, 10],
	[10, 4],
	[9, 3],
	[8, 2],
];

/** The briscola in the examples is coppe, as under the deck in the briscola section. */
const EXAMPLES: {
	lead: Card;
	answer: Card;
	winner: "lead" | "answer";
	points: number;
	why: () => string;
}[] = [
	{
		lead: card("spade", 3),
		answer: card("spade", 10),
		winner: "lead",
		points: 14,
		why: m.rules_example_suit,
	},
	{
		lead: card("denari", 7),
		answer: card("bastoni", 1),
		winner: "lead",
		points: 11,
		why: m.rules_example_other,
	},
	{
		lead: card("spade", 1),
		answer: card("coppe", 2),
		winner: "answer",
		points: 11,
		why: m.rules_example_briscola,
	},
	{
		lead: card("coppe", 10),
		answer: card("coppe", 3),
		winner: "answer",
		points: 14,
		why: m.rules_example_both,
	},
];

function Rules() {
	return (
		<main className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-16 px-4 py-6 sm:gap-24 sm:px-8">
			<SiteHeader current="rules" />

			<section className="flex flex-col gap-5 pt-4 sm:pt-12">
				<h1 className="text-5xl font-bold tracking-[-0.045em] sm:text-7xl">
					{m.rules_title()}
				</h1>
				<p className="max-w-2xl text-lg leading-relaxed">{m.rules_lead()}</p>
			</section>

			<section className="flex flex-col gap-8">
				<Heading title={m.rules_deck_title()} body={m.rules_deck_body()} />
				<ul className="grid grid-cols-4 gap-3 sm:gap-6">
					{SUITS.map(suit => (
						<li key={suit} className="flex flex-col items-center gap-3">
							<CardFace
								card={card(suit, 1)}
								className="aspect-[150/246] w-full max-w-36"
							/>
							<span className="text-text-soft text-sm">{suit}</span>
						</li>
					))}
				</ul>
			</section>

			<section className="flex flex-col gap-8">
				<Heading title={m.rules_points_title()} body={m.rules_points_body()} />
				<ol className="grid grid-cols-5 gap-2 sm:gap-6">
					{COUNTING.map(([rank, points]) => (
						<li key={rank} className="flex flex-col items-center gap-3">
							<CardFace
								card={card("denari", rank)}
								className="aspect-[150/246] w-full max-w-32"
							/>
							<span className="text-center font-mono text-sm leading-tight">
								<span
									aria-hidden="true"
									className="text-signal block text-2xl font-semibold sm:text-3xl"
								>
									{points}
								</span>
								<span className="sr-only">{m.rules_points_n({ points })}</span>
							</span>
						</li>
					))}
				</ol>
				<div className="flex flex-col gap-3">
					<ol className="flex gap-2 opacity-70 sm:gap-3">
						{[7, 6, 5, 4, 2].map(rank => (
							<li key={rank}>
								<CardFace
									card={card("denari", rank)}
									className="aspect-[150/246] w-12 sm:w-16"
								/>
							</li>
						))}
					</ol>
					<p className="text-text-soft text-sm">{m.rules_lisci()}</p>
				</div>
				<p className="max-w-2xl leading-relaxed">{m.rules_points_order()}</p>
			</section>

			<section className="grid items-center gap-8 md:grid-cols-2">
				<Heading title={m.rules_briscola_title()} body={m.rules_briscola_body()} />
				<figure className="flex flex-col gap-3">
					<Felt className="flex h-64 items-center justify-center">
						<div className="relative h-44 w-44">
							<div className="absolute top-1/2 left-12 w-24 -translate-y-1/2 rotate-90">
								<CardFace card={card("coppe", 7)} className="aspect-[150/246] w-full" />
							</div>
							<div className="absolute top-1/2 left-0 w-24 -translate-y-1/2 shadow-lg">
								<CardBack className="aspect-[150/246] w-full" />
							</div>
						</div>
					</Felt>
					<figcaption className="text-text-soft text-sm">
						{m.rules_briscola_caption()}
					</figcaption>
				</figure>
			</section>

			<section className="flex flex-col gap-8">
				<Heading title={m.rules_trick_title()} body={m.rules_trick_body()} />
				<p className="text-text-soft text-sm">{m.rules_trick_hint()}</p>
				<ul className="grid gap-4 md:grid-cols-2">
					{EXAMPLES.map(example => (
						<li key={example.lead.index}>
							<Example {...example} />
						</li>
					))}
				</ul>
			</section>

			<section className="flex flex-col gap-8">
				<Heading title={m.rules_draw_title()} />
				<ol className="grid gap-4 sm:grid-cols-3">
					{[m.rules_draw_1, m.rules_draw_2, m.rules_draw_3, m.rules_draw_4].map(
						(step, i) => (
							<li
								key={i}
								className="bg-surface flex gap-4 rounded-[20px] p-5 sm:last:col-span-3"
							>
								<span className="text-data font-mono text-2xl font-semibold">
									{i + 1}
								</span>
								<p className="leading-relaxed">{step()}</p>
							</li>
						)
					)}
				</ol>
			</section>

			<section className="flex flex-col gap-8">
				<Heading title={m.rules_end_title()} body={m.rules_end_body()} />
				<dl className="grid grid-cols-3 gap-3">
					{[
						["120", m.rules_end_total()],
						["61", m.rules_end_win()],
						["60–60", m.rules_end_draw()],
					].map(([value, label]) => (
						<div
							key={value}
							className="bg-surface flex flex-col gap-1 rounded-[20px] p-4 sm:p-6"
						>
							<dt className="text-text-soft order-2 text-sm">{label}</dt>
							<dd className="font-mono text-2xl font-semibold sm:text-4xl">{value}</dd>
						</div>
					))}
				</dl>
				<p className="max-w-2xl leading-relaxed">{m.rules_end_settled()}</p>
			</section>

			<section className="flex flex-col gap-8">
				<Heading title={m.rules_tips_title()} />
				<ul className="flex flex-col gap-3">
					{[m.rules_tip_1, m.rules_tip_2, m.rules_tip_3].map((tip, i) => (
						<li
							key={i}
							className="border-signal max-w-2xl border-l-2 pl-4 leading-relaxed"
						>
							{tip()}
						</li>
					))}
				</ul>
			</section>

			<section className="flex flex-col gap-3 pb-10 sm:flex-row">
				<Link
					to="/play"
					search={{ level: "easy", seed: undefined }}
					className="bg-text text-ground flex h-11 items-center justify-center rounded-full px-6 font-semibold transition-transform active:scale-95"
				>
					{m.rules_play()}
				</Link>
				<Link
					to="/watch"
					search={{ bots: "hard,ismcts", seed: undefined }}
					className="bg-raised flex h-11 items-center justify-center rounded-full px-6 font-semibold"
				>
					{m.rules_watch()}
				</Link>
			</section>
		</main>
	);
}

function Heading({ title, body }: { title: string; body?: string }) {
	return (
		<div className="flex max-w-2xl flex-col gap-3">
			<h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
			{body && <p className="text-lg leading-relaxed">{body}</p>}
		</div>
	);
}

/** Two cards on the table and the answer, hidden until asked for. */
function Example({ lead, answer, winner, points, why }: (typeof EXAMPLES)[number]) {
	const [shown, setShown] = useState(false);
	const side = (which: "lead" | "answer", c: Card, label: string) => {
		const won = shown && winner === which;
		return (
			<div className="flex flex-col items-center gap-2">
				<motion.div
					animate={{ y: won ? -10 : 0, opacity: shown && !won ? 0.45 : 1 }}
					transition={{ type: "spring", duration: 0.4, bounce: 0.2 }}
					className={cn(
						"rounded-[14px]",
						won && "ring-signal ring-2 ring-offset-2 ring-offset-transparent"
					)}
				>
					<CardFace card={c} className="aspect-[150/246] w-20 sm:w-24" />
				</motion.div>
				<span className="text-text-soft text-sm">{label}</span>
			</div>
		);
	};
	return (
		<Felt className="flex flex-col gap-5 p-5 sm:p-6">
			<div className="flex justify-center gap-6 pt-2">
				{side("lead", lead, m.rules_lead_card())}
				{side("answer", answer, m.rules_answer_card())}
			</div>
			<div
				aria-live="polite"
				className="flex min-h-16 flex-col items-center justify-center gap-1 text-center"
			>
				{shown ? (
					<>
						<span className="text-signal font-semibold">
							{m.rules_takes({
								card: cardName(winner === "lead" ? lead : answer),
								points,
							})}
						</span>
						<p className="text-text-soft text-sm leading-relaxed">{why()}</p>
					</>
				) : (
					<button
						type="button"
						onClick={() => setShown(true)}
						className="bg-text text-ground h-11 rounded-full px-6 font-semibold transition-transform active:scale-95"
					>
						{m.rules_reveal()}
					</button>
				)}
			</div>
		</Felt>
	);
}
