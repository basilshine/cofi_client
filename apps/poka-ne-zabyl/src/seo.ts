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
		path: "/refunds",
		title: "Возвраты — Пока не забыл",
		description:
			"Порядок обращения по вопросам отказа от услуг и возврата оплаты в сервисе «Пока не забыл».",
		language: "ru",
	},
] as const;
