
// Emotion mapping to emojis
const getEmotionEmoji = (emotion: string): string => {
	const emotions: Record<string, string> = {
		like: "👍",
		dislike: "👎",
		happy: "😊",
		sad: "😢",
		regret: "😤",
		joy: "😄",
		neutral: "😐",
		// Additional common emotions
		angry: "😠",
		surprised: "😲",
		worried: "😟",
		excited: "🤩",
		satisfied: "😌",
		disappointed: "😞",
	};
	return emotions[emotion?.toLowerCase()] || emotions.neutral;
};


// Helper functions to format display names
const getCountryName = (code: string): string => {
	const countries: Record<string, string> = {
		"United States": "United States",
		"United Kingdom": "United Kingdom",
		Canada: "Canada",
		Russia: "Russia",
		Germany: "Germany",
		France: "France",
		Spain: "Spain",
		Italy: "Italy",
		Netherlands: "Netherlands",
		ru: "Russia",
		us: "United States",
		uk: "United Kingdom",
		ca: "Canada",
		de: "Germany",
		fr: "France",
		es: "Spain",
		it: "Italy",
		nl: "Netherlands",
	};
	return countries[code] || code || "N/A";
};

const getLanguageName = (code: string): string => {
	const languages: Record<string, string> = {
		en: "English (United States)",
		ru: "Русский (Россия)",
		es: "Español (España)",
		fr: "Français (France)",
		de: "Deutsch (Deutschland)",
		it: "Italiano (Italia)",
		pt: "Português (Brasil)",
		zh: "中文 (简体)",
		ja: "日本語 (日本)",
	};
	return languages[code] || code || "N/A";
};

const getTimezoneName = (timezone: string): string => {
	const timezones: Record<string, string> = {
		"America/Los_Angeles": "(GMT-08:00) Pacific Time",
		"America/New_York": "(GMT-05:00) Eastern Time",
		"Europe/London": "(GMT+00:00) Greenwich Mean Time",
		"Europe/Berlin": "(GMT+01:00) Central European Time",
		"Europe/Moscow": "(GMT+03:00) Moscow Time",
		"Asia/Dubai": "(GMT+04:00) Dubai Time",
		"Asia/Kolkata": "(GMT+05:30) India Standard Time",
		"Asia/Shanghai": "(GMT+08:00) China Standard Time",
		"Asia/Tokyo": "(GMT+09:00) Japan Standard Time",
		"Australia/Sydney": "(GMT+10:00) Australian Eastern Time",
	};
	return timezones[timezone] || timezone || "N/A";
};

const getCurrencyName = (code: string): string => {
	const currencies: Record<string, string> = {
		USD: "USD ($)",
		EUR: "EUR (€)",
		GBP: "GBP (£)",
		RUB: "RUB (₽)",
		CAD: "CAD ($)",
		JPY: "JPY (¥)",
		CNY: "CNY (¥)",
		INR: "INR (₹)",
	};
	return currencies[code] || code || "N/A";
};


export { getEmotionEmoji, getCountryName, getLanguageName, getTimezoneName, getCurrencyName };
