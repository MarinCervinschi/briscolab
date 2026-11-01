import type { ReactNode } from "react";

import type * as PageTree from "fumadocs-core/page-tree";
import { i18nProvider, uiTranslations } from "fumadocs-ui/i18n";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { RootProvider } from "fumadocs-ui/provider/tanstack";

import { labI18n } from "@/lib/lab/i18n";
import { localizeHref } from "@/paraglide/runtime";

import { LabSearch } from "./search";

const translations = labI18n
	.translations()
	.extend(uiTranslations())
	.add({
		it: {
			displayName: "Italiano",
			"Search(search trigger)": "Cerca",
			"Search(search dialog)": "Cerca nel Lab",
			"Open Search(search trigger)(aria-label)": "Apri la ricerca",
			"Close Search(search dialog)(aria-label)": "Chiudi la ricerca",
			"No results found(search dialog)": "Nessun risultato",
			"Search failed(search dialog)": "La ricerca non ha funzionato",
			"On this page(table of contents)": "In questa pagina",
			"No Headings(table of contents)": "Nessun titolo",
			"Table of Contents(inline table of contents)": "Indice",
			"Next Page(pagination)": "Pagina successiva",
			"Previous Page(pagination)": "Pagina precedente",
			"Open Sidebar(sidebar)(aria-label)": "Apri il menu",
			"Close Sidebar(sidebar)(aria-label)": "Chiudi il menu",
			"Collapse Sidebar(sidebar)(aria-label)": "Comprimi il menu",
			"Toggle Menu(mobile menu)(aria-label)": "Apri o chiudi il menu",
			"Choose a language(language switcher)": "Scegli la lingua",
			"Page Not Found(404 page)": "Pagina non trovata",
			"Back to Home(404 page)": "Torna all'inizio",
		},
		en: { displayName: "English" },
	});

/** The Lab's frame: Fumadocs' docs layout with the site's colours, its search and its translations. */
export function LabLayout({
	lang,
	tree,
	children,
}: {
	lang: string;
	tree: PageTree.Root;
	children: ReactNode;
}) {
	return (
		<RootProvider
			i18n={{
				...i18nProvider(translations, lang),
				// As the site's language link does: the same page in the other language, loaded afresh.
				onLocaleChange: locale => {
					window.location.href = localizeHref(window.location.pathname, {
						locale: locale as "it" | "en",
					});
				},
			}}
			search={{ SearchDialog: LabSearch }}
			theme={{ enabled: false }}
		>
			<DocsLayout
				tree={tree}
				nav={{ title: "Briscolab · Lab", url: lang === "it" ? "/" : "/en" }}
				themeSwitch={{ enabled: false }}
			>
				{children}
			</DocsLayout>
		</RootProvider>
	);
}
