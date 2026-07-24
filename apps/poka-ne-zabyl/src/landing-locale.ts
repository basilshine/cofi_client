export type LandingLocale = "ru" | "en" | "es";

export const preferredLandingLocale = (
	browserLanguage: string,
	savedLanguage?: string | null,
): LandingLocale => {
	if (
		savedLanguage === "ru" ||
		savedLanguage === "en" ||
		savedLanguage === "es"
	)
		return savedLanguage;
	const language = browserLanguage.toLowerCase().split(/[-_]/)[0];
	return language === "ru" || language === "es" ? language : "en";
};

const ATTRIBUTION_PARAMS = [
	"funnel",
	"yclid",
	"utm_source",
	"utm_medium",
	"utm_campaign",
	"utm_term",
	"utm_content",
] as const;

export const landingAppPath = (
	locale: LandingLocale,
	query = "",
	landingQuery = typeof window === "undefined" ? "" : window.location.search,
) => {
	const source = new URLSearchParams(landingQuery);
	const params = new URLSearchParams(query);
	for (const name of ATTRIBUTION_PARAMS) {
		const value = source.get(name);
		if (value && !params.has(name)) params.set(name, value);
	}
	if (locale !== "ru") params.set("lang", locale);
	const suffix = params.toString();
	return `/app${suffix ? `?${suffix}` : ""}`;
};

export const legalPagePath = (
	locale: LandingLocale,
	page: "privacy" | "consent",
) => (locale === "ru" ? `/${page}` : `/${locale}/${page}`);
