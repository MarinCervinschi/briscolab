import { defineI18n } from "fumadocs-core/i18n";

// As in the rest of the site: Italian at /lab, English at /en/lab.
export const labI18n = defineI18n({
	defaultLanguage: "it",
	languages: ["it", "en"],
	hideLocale: "default-locale",
});
