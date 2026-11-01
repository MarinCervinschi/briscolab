import { loader } from "fumadocs-core/source";
import { defineDocs } from "fumadocs-mdx/macro";

import { labI18n } from "./i18n";

// The articles: content/lab, `name.mdx` in Italian and `name.en.mdx` in English.
export const labDocs = defineDocs({
	dir: "content/lab",
	docs: { async: true },
});

export const labSource = loader({
	source: labDocs.toFumadocsSource(),
	baseUrl: "/lab",
	i18n: labI18n,
});
