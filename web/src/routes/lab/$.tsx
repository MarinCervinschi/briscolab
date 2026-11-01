import { Suspense, use } from "react";

import { createFileRoute } from "@tanstack/react-router";
import { useFumadocsLoader } from "fumadocs-core/source/client";
import {
	DocsBody,
	DocsDescription,
	DocsPage,
	DocsTitle,
} from "fumadocs-ui/layouts/docs/page";

import { LabLayout } from "@/components/lab/layout";
import { labComponents } from "@/components/lab/mdx";
import { loadArticle } from "@/lib/lab/loaders";
import { labDocs } from "@/lib/lab/source";
import { getLocale } from "@/paraglide/runtime";

export const Route = createFileRoute("/lab/$")({
	loader: async ({ params }) => {
		const data = await loadArticle({
			data: {
				slugs: params._splat?.split("/").filter(Boolean) ?? [],
				lang: getLocale(),
			},
		});
		await labDocs.getPage(data.path)?.preload();
		return data;
	},
	component: Article,
});

function Body({ path }: { path: string }) {
	const page = labDocs.getPage(path)!;
	const { toc } = use(page.load());
	const MDX = page.body;
	return (
		<DocsPage toc={toc}>
			<DocsTitle>{page.title}</DocsTitle>
			<DocsDescription>{page.description}</DocsDescription>
			<DocsBody>
				<MDX components={labComponents} />
			</DocsBody>
		</DocsPage>
	);
}

function Article() {
	const { path, pageTree } = useFumadocsLoader(Route.useLoaderData());
	return (
		<LabLayout lang={getLocale()} tree={pageTree}>
			<Suspense>
				<Body path={path} />
			</Suspense>
		</LabLayout>
	);
}
