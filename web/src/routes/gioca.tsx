import { createFileRoute } from "@tanstack/react-router";

import { LEVELS, parseLevel } from "@/lib/levels";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/gioca")({
	validateSearch: (search: Record<string, unknown>) => ({
		livello: parseLevel(search.livello),
	}),
	// The game runs in the browser only: the shell is prerendered, the table is not.
	ssr: false,
	component: Game,
});

function Game() {
	const { livello } = Route.useSearch();
	const level = LEVELS.find(l => l.id === livello)!;
	return (
		<main className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-4 px-4 py-6 sm:px-8">
			<h1 className="text-3xl font-bold tracking-tight">
				{m.play_title()} · {level.name()}
			</h1>
			<p className="text-text-soft">{m.play_soon()}</p>
			<a href="/" className="underline underline-offset-4">
				{m.back_home()}
			</a>
		</main>
	);
}
