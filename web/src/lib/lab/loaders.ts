import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { staticFunctionMiddleware } from "@tanstack/start-static-server-functions";
import type * as PageTree from "fumadocs-core/page-tree";

import { m } from "@/paraglide/messages";

import { runs } from "./results";
import { labSource } from "./source";

// Server functions run only at prerender; the middleware saves their results as static files for the browser.

function tree(lang: string): PageTree.Root {
	const root = labSource.getPageTree(lang);
	const prefix = lang === "it" ? "" : `/${lang}`;
	const folder: PageTree.Folder = {
		type: "folder",
		name: m.lab_runs({}, { locale: lang as "it" | "en" }),
		defaultOpen: true,
		children: runs.map(run => ({
			type: "page",
			name: run.name,
			url: `${prefix}/lab/runs/${run.name}`,
		})),
	};
	return { ...root, children: [...root.children, folder] };
}

export const loadArticle = createServerFn({ method: "GET" })
	.validator((input: { slugs: string[]; lang: string }) => input)
	.middleware([staticFunctionMiddleware])
	.handler(async ({ data: { slugs, lang } }) => {
		const page = labSource.getPage(slugs, lang);
		if (!page) throw notFound();
		return { path: page.path, pageTree: await labSource.serializePageTree(tree(lang)) };
	});

export const loadTree = createServerFn({ method: "GET" })
	.validator((lang: string) => lang)
	.middleware([staticFunctionMiddleware])
	.handler(async ({ data: lang }) => ({
		pageTree: await labSource.serializePageTree(tree(lang)),
	}));
