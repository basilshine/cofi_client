type MobileDateLanguage = "ru" | "en" | "es";

const dateCopy: Record<
	MobileDateLanguage,
	{ choose: string; noDate: string; today: string; tomorrow: string }
> = {
	ru: {
		choose: "Нажмите, чтобы выбрать",
		noDate: "Без даты",
		today: "Сегодня",
		tomorrow: "Завтра",
	},
	en: {
		choose: "Tap to choose",
		noDate: "No date",
		today: "Today",
		tomorrow: "Tomorrow",
	},
	es: {
		choose: "Toca para elegir",
		noDate: "Sin fecha",
		today: "Hoy",
		tomorrow: "Mañana",
	},
};

export type MobileDatePresentation = {
	primary: string;
	secondary: string;
};

const nextDate = (value: string) => {
	const date = new Date(`${value}T12:00:00`);
	date.setDate(date.getDate() + 1);
	return [
		date.getFullYear(),
		String(date.getMonth() + 1).padStart(2, "0"),
		String(date.getDate()).padStart(2, "0"),
	].join("-");
};

const localDateValue = (date: Date) =>
	[
		date.getFullYear(),
		String(date.getMonth() + 1).padStart(2, "0"),
		String(date.getDate()).padStart(2, "0"),
	].join("-");

export const mobileDatePresentation = (
	value: string,
	language: MobileDateLanguage,
	today = localDateValue(new Date()),
): MobileDatePresentation => {
	const dateValue = value.slice(0, 10);
	if (!dateValue) {
		return {
			primary: dateCopy[language].noDate,
			secondary: dateCopy[language].choose,
		};
	}

	const date = new Date(`${dateValue}T12:00:00`);
	if (Number.isNaN(date.getTime())) {
		return {
			primary: dateValue,
			secondary: dateCopy[language].choose,
		};
	}

	let secondary = new Intl.DateTimeFormat(language, {
		weekday: "long",
	}).format(date);
	if (dateValue === today) secondary = dateCopy[language].today;
	if (dateValue === nextDate(today)) secondary = dateCopy[language].tomorrow;

	return {
		primary: new Intl.DateTimeFormat(language, {
			day: "numeric",
			month: "long",
			year: "numeric",
		}).format(date),
		secondary,
	};
};
