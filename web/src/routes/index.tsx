import { Link, createFileRoute } from "@tanstack/react-router";

import { LanguageLink } from "@/components/language-link";
import { LEVELS } from "@/lib/levels";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
	return (
		<main className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-12 px-4 py-6 sm:px-8">
			<header className="flex items-center justify-between">
				<span className="text-xl font-bold tracking-tight">Briscolab</span>
				<LanguageLink />
			</header>
			<section className="flex flex-col gap-5 pt-12">
				<h1 className="text-6xl font-bold tracking-[-0.045em] sm:text-8xl">
					{m.home_title()}
				</h1>
				<p className="max-w-2xl text-lg leading-relaxed">{m.home_lead()}</p>
			</section>
			<ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
				{LEVELS.map(level => (
					<li key={level.id}>
						<Link
							to="/gioca"
							search={{ livello: level.id }}
							className="bg-surface hover:bg-raised flex h-28 flex-col justify-between rounded-[20px] p-5 transition-colors"
						>
							<span className="text-lg font-semibold">{level.name()}</span>
							<span className="text-text-soft font-mono text-sm">{level.bot}</span>
						</Link>
					</li>
				))}
			</ul>
		</main>
	);
}
