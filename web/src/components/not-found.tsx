import { m } from "@/paraglide/messages";

export function NotFoundPage() {
	return (
		<main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-24">
			<h1 className="text-4xl font-bold tracking-tight">{m.not_found_title()}</h1>
			<p className="text-text-soft">{m.not_found_lead()}</p>
			<a href="/" className="text-text underline underline-offset-4">
				{m.back_home()}
			</a>
		</main>
	);
}
