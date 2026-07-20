export const browserRegistrationCountry = (locale: string) => {
	if (!locale.trim()) return "";
	try {
		return new Intl.Locale(locale).maximize().region?.toUpperCase() || "";
	} catch {
		return "";
	}
};
