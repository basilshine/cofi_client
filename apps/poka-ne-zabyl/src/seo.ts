import { landingSeo } from "./landing-i18n";

export const PUBLIC_PAGE_SEO = [
	{
		path: "/",
		...landingSeo.ru,
		language: "ru",
	},
	{
		path: "/en/",
		...landingSeo.en,
		language: "en",
	},
	{
		path: "/es/",
		...landingSeo.es,
		language: "es",
	},
	{
		path: "/offer",
		title: "Публичная оферта — Пока не забыл",
		description:
			"Публичная оферта сервиса «Пока не забыл»: условия использования, тарифы, оплата, ответственность и порядок возврата.",
		language: "ru",
	},
	{
		path: "/privacy",
		title: "Политика конфиденциальности — Пока не забыл",
		description:
			"Политика обработки персональных данных сервиса «Пока не забыл»: состав данных, цели, хранение и права пользователя.",
		language: "ru",
	},
	{
		path: "/consent",
		title: "Согласие на обработку данных — Пока не забыл",
		description:
			"Согласие пользователя на обработку персональных данных сервисом «Пока не забыл».",
		language: "ru",
	},
	{
		path: "/en/privacy",
		title: "Privacy Notice — Poka ne zabyl",
		description:
			"How Poka ne zabyl collects, uses, stores, and protects personal data, including international processing and user rights.",
		language: "en",
	},
	{
		path: "/en/consent",
		title: "Data Processing Consent — Poka ne zabyl",
		description:
			"Consent terms for personal data processing in Poka ne zabyl and instructions for withdrawing consent.",
		language: "en",
	},
	{
		path: "/es/privacy",
		title: "Aviso de privacidad — Poka ne zabyl",
		description:
			"Cómo Poka ne zabyl recopila, utiliza, conserva y protege los datos personales, incluido el tratamiento internacional y los derechos del usuario.",
		language: "es",
	},
	{
		path: "/es/consent",
		title: "Consentimiento de tratamiento — Poka ne zabyl",
		description:
			"Condiciones del consentimiento para el tratamiento de datos personales en Poka ne zabyl y cómo retirarlo.",
		language: "es",
	},
	{
		path: "/refunds",
		title: "Возвраты — Пока не забыл",
		description:
			"Порядок обращения по вопросам отказа от услуг и возврата оплаты в сервисе «Пока не забыл».",
		language: "ru",
	},
] as const;
