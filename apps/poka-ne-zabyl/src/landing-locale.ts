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

export const landingAppPath = (locale: LandingLocale, query = "") => {
	const params = new URLSearchParams(query);
	if (locale !== "ru") params.set("lang", locale);
	const suffix = params.toString();
	return `/app${suffix ? `?${suffix}` : ""}`;
};
