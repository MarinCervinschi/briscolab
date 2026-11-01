import { Link, createFileRoute } from "@tanstack/react-router";

import { m } from "@/paraglide/messages";

import credits from "../../public/cards/credits.json";

export const Route = createFileRoute("/credits")({ component: Credits });

function Credits() {
	return (
		<main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-12 px-4 py-6 sm:px-8">
			<header className="flex items-center justify-between">
				<Link to="/" className="text-xl font-bold tracking-tight">
					Briscolab
				</Link>
			</header>
			<h1 className="text-5xl font-bold tracking-[-0.045em] sm:text-6xl">
				{m.credits_title()}
			</h1>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">{m.privacy_title()}</h2>
				<p className="leading-relaxed">{m.privacy_body()}</p>
				<p className="text-text-soft leading-relaxed">{m.privacy_event()}</p>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">{m.credits_bots_title()}</h2>
				<p className="leading-relaxed">
					{m.credits_bots_body()}{" "}
					<a href="https://bottts.com/" className="underline underline-offset-4">
						Bottts
					</a>
					, Pablo Stanley ·{" "}
					<a href="https://www.dicebear.com/" className="underline underline-offset-4">
						DiceBear
					</a>
					.
				</p>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">{m.credits_code_title()}</h2>
				<p className="leading-relaxed">
					{m.credits_code_body()}{" "}
					<a
						href="https://github.com/MarinCervinschi/briscolab"
						className="underline underline-offset-4"
					>
						github.com/MarinCervinschi/briscolab
					</a>
				</p>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">{m.credits_cards_title()}</h2>
				<p className="leading-relaxed">{m.credits_cards_body()}</p>
				<ul className="text-text-soft grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
					{credits.map(card => (
						<li key={card.file}>
							<a
								href={card.source}
								className="hover:text-text underline-offset-4 hover:underline"
							>
								{card.title.replace(/^File:/, "")}
							</a>{" "}
							· {card.author} · {card.licence}
						</li>
					))}
				</ul>
			</section>
		</main>
	);
}
