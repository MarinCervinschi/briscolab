import { createFileRoute, notFound } from "@tanstack/react-router";
import { useFumadocsLoader } from "fumadocs-core/source/client";
import {
	DocsBody,
	DocsDescription,
	DocsPage,
	DocsTitle,
} from "fumadocs-ui/layouts/docs/page";

import {
	PairMatrix,
	PairTable,
	Ratings,
	VersusChampion,
	botName,
	count,
} from "@/components/lab/charts";
import { LabLayout } from "@/components/lab/layout";
import { loadTree } from "@/lib/lab/loaders";
import { getRun } from "@/lib/lab/results";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

// One page per file in lab/results, from the JSON alone.
export const Route = createFileRoute("/lab/runs/$run")({
	loader: async ({ params }) => {
		if (!getRun(params.run)) throw notFound();
		return loadTree({ data: getLocale() });
	},
	component: RunPage,
});

function RunPage() {
	const { run: name } = Route.useParams();
	const { pageTree } = useFumadocsLoader(Route.useLoaderData());
	const run = getRun(name)!;
	return (
		<LabLayout lang={getLocale()} tree={pageTree}>
			<DocsPage toc={[]}>
				<DocsTitle>{m.lab_run_title({ name })}</DocsTitle>
				<DocsDescription>
					{m.lab_run_description({
						bots: run.config.bots.map(botName).join(", "),
						deals: count(run.config.deals),
					})}
				</DocsDescription>
				<DocsBody>
					<dl className="not-prose grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
						<dt className="text-fd-muted-foreground">{m.lab_run_seeds()}</dt>
						<dd className="font-mono">
							{run.config.first_seed}–{run.config.first_seed + run.config.deals - 1}
						</dd>
						<dt className="text-fd-muted-foreground">{m.lab_run_engine()}</dt>
						<dd className="font-mono">{run.engine_version}</dd>
						<dt className="text-fd-muted-foreground">{m.lab_run_commit()}</dt>
						<dd className="font-mono">
							<a
								href={`https://github.com/MarinCervinschi/briscolab/tree/${run.git_commit}`}
								className="underline underline-offset-4"
							>
								{run.git_commit.slice(0, 7)}
							</a>
						</dd>
					</dl>
					<h2>{m.lab_run_ratings()}</h2>
					<Ratings run={name} />
					<h2>{m.lab_run_versus()}</h2>
					<VersusChampion run={name} />
					<h2>{m.lab_run_matrix()}</h2>
					<PairMatrix run={name} />
					<h2>{m.lab_run_pairs()}</h2>
					<PairTable run={name} />
				</DocsBody>
			</DocsPage>
		</LabLayout>
	);
}
