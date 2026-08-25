import type { UILanguage } from "./mini-i18n";

export const CATEGORY_ICON_OPTIONS = [
	{
		key: "groceries",
		tone: "leaf",
		labels: { ru: "Продукты", en: "Groceries", es: "Comestibles" },
	},
	{
		key: "dining",
		tone: "coral",
		labels: { ru: "Кафе и еда", en: "Dining", es: "Restaurantes" },
	},
	{
		key: "coffee",
		tone: "amber",
		labels: { ru: "Кофе", en: "Coffee", es: "Café" },
	},
	{
		key: "alcohol",
		tone: "berry",
		labels: { ru: "Напитки", en: "Drinks", es: "Bebidas" },
	},
	{
		key: "transport",
		tone: "blue",
		labels: { ru: "Транспорт", en: "Transport", es: "Transporte" },
	},
	{
		key: "taxi",
		tone: "amber",
		labels: { ru: "Такси", en: "Taxi", es: "Taxi" },
	},
	{
		key: "fuel",
		tone: "coral",
		labels: { ru: "Топливо", en: "Fuel", es: "Combustible" },
	},
	{
		key: "parking",
		tone: "blue",
		labels: { ru: "Парковка", en: "Parking", es: "Aparcamiento" },
	},
	{
		key: "delivery",
		tone: "cyan",
		labels: { ru: "Доставка", en: "Delivery", es: "Entrega" },
	},
	{
		key: "travel",
		tone: "blue",
		labels: { ru: "Путешествия", en: "Travel", es: "Viajes" },
	},
	{
		key: "hotel",
		tone: "violet",
		labels: { ru: "Проживание", en: "Accommodation", es: "Alojamiento" },
	},
	{
		key: "tickets",
		tone: "coral",
		labels: { ru: "Билеты", en: "Tickets", es: "Entradas" },
	},
	{ key: "home", tone: "leaf", labels: { ru: "Дом", en: "Home", es: "Hogar" } },
	{
		key: "housing",
		tone: "blue",
		labels: { ru: "Жильё и счета", en: "Housing", es: "Vivienda" },
	},
	{
		key: "repair",
		tone: "amber",
		labels: { ru: "Ремонт", en: "Repair", es: "Reparación" },
	},
	{
		key: "construction",
		tone: "amber",
		labels: { ru: "Строительство", en: "Construction", es: "Construcción" },
	},
	{
		key: "materials",
		tone: "slate",
		labels: { ru: "Материалы", en: "Materials", es: "Materiales" },
	},
	{
		key: "tools",
		tone: "slate",
		labels: { ru: "Инструменты", en: "Tools", es: "Herramientas" },
	},
	{
		key: "electricity",
		tone: "amber",
		labels: { ru: "Электрика", en: "Electrical", es: "Electricidad" },
	},
	{
		key: "plumbing",
		tone: "cyan",
		labels: { ru: "Сантехника", en: "Plumbing", es: "Fontanería" },
	},
	{
		key: "paint",
		tone: "violet",
		labels: { ru: "Краски и отделка", en: "Paint", es: "Pintura" },
	},
	{
		key: "flooring",
		tone: "slate",
		labels: { ru: "Полы", en: "Flooring", es: "Suelos" },
	},
	{
		key: "furniture",
		tone: "coral",
		labels: { ru: "Мебель", en: "Furniture", es: "Muebles" },
	},
	{
		key: "appliances",
		tone: "blue",
		labels: {
			ru: "Бытовая техника",
			en: "Appliances",
			es: "Electrodomésticos",
		},
	},
	{
		key: "electronics",
		tone: "blue",
		labels: { ru: "Электроника", en: "Electronics", es: "Electrónica" },
	},
	{
		key: "computer",
		tone: "violet",
		labels: { ru: "Компьютеры", en: "Computers", es: "Ordenadores" },
	},
	{
		key: "internet",
		tone: "cyan",
		labels: { ru: "Связь и интернет", en: "Internet", es: "Internet" },
	},
	{
		key: "health",
		tone: "leaf",
		labels: { ru: "Здоровье", en: "Health", es: "Salud" },
	},
	{
		key: "pharmacy",
		tone: "cyan",
		labels: { ru: "Аптека", en: "Pharmacy", es: "Farmacia" },
	},
	{
		key: "beauty",
		tone: "berry",
		labels: { ru: "Красота", en: "Beauty", es: "Belleza" },
	},
	{
		key: "clothing",
		tone: "violet",
		labels: { ru: "Одежда", en: "Clothing", es: "Ropa" },
	},
	{
		key: "sports",
		tone: "leaf",
		labels: { ru: "Спорт", en: "Sports", es: "Deporte" },
	},
	{
		key: "children",
		tone: "coral",
		labels: { ru: "Дети", en: "Children", es: "Niños" },
	},
	{
		key: "pets",
		tone: "amber",
		labels: { ru: "Питомцы", en: "Pets", es: "Mascotas" },
	},
	{
		key: "education",
		tone: "blue",
		labels: { ru: "Обучение", en: "Education", es: "Educación" },
	},
	{
		key: "hobbies",
		tone: "violet",
		labels: { ru: "Хобби", en: "Hobbies", es: "Aficiones" },
	},
	{
		key: "leisure",
		tone: "berry",
		labels: { ru: "Досуг", en: "Leisure", es: "Ocio" },
	},
	{
		key: "gifts",
		tone: "coral",
		labels: { ru: "Подарки", en: "Gifts", es: "Regalos" },
	},
	{
		key: "garden",
		tone: "leaf",
		labels: { ru: "Сад и растения", en: "Garden", es: "Jardín" },
	},
	{
		key: "cleaning",
		tone: "cyan",
		labels: { ru: "Уборка", en: "Cleaning", es: "Limpieza" },
	},
	{
		key: "subscriptions",
		tone: "violet",
		labels: { ru: "Подписки", en: "Subscriptions", es: "Suscripciones" },
	},
	{
		key: "finance",
		tone: "leaf",
		labels: { ru: "Финансы", en: "Finance", es: "Finanzas" },
	},
	{
		key: "insurance",
		tone: "blue",
		labels: { ru: "Страхование", en: "Insurance", es: "Seguros" },
	},
	{
		key: "business",
		tone: "slate",
		labels: { ru: "Бизнес", en: "Business", es: "Negocio" },
	},
	{
		key: "office",
		tone: "blue",
		labels: { ru: "Офис", en: "Office", es: "Oficina" },
	},
	{
		key: "team",
		tone: "violet",
		labels: { ru: "Команда", en: "Team", es: "Equipo" },
	},
	{
		key: "marketing",
		tone: "coral",
		labels: { ru: "Реклама", en: "Marketing", es: "Marketing" },
	},
	{
		key: "packaging",
		tone: "amber",
		labels: { ru: "Упаковка", en: "Packaging", es: "Embalaje" },
	},
	{
		key: "warehouse",
		tone: "slate",
		labels: { ru: "Склад", en: "Warehouse", es: "Almacén" },
	},
	{
		key: "photo",
		tone: "berry",
		labels: { ru: "Фото и видео", en: "Photo and video", es: "Foto y vídeo" },
	},
	{
		key: "tag",
		tone: "slate",
		labels: { ru: "Другое", en: "Other", es: "Otros" },
	},
] as const;

export type CategoryIconKey = (typeof CATEGORY_ICON_OPTIONS)[number]["key"];
export type CategoryIconTone = (typeof CATEGORY_ICON_OPTIONS)[number]["tone"];

const iconKeys = new Set<string>(CATEGORY_ICON_OPTIONS.map(({ key }) => key));

const iconRules: Array<[CategoryIconKey, string[]]> = [
	["subscriptions", ["подпис", "subscription", "suscrip"]],
	["electricity", ["электр", "кабел", "провод", "electric"]],
	["plumbing", ["сантех", "водоснаб", "канализац", "plumb"]],
	["flooring", ["полы", "наполь", "ламинат", "паркет", "floor"]],
	["paint", ["краск", "маляр", "обои", "paint"]],
	["construction", ["строит", "стройк", "construction"]],
	["materials", ["материал", "сырь", "поставщик", "material"]],
	["tools", ["инструмент", "оборудован", "tool"]],
	["repair", ["ремонт", "обслуживан", "repair"]],
	["furniture", ["мебел", "интерьер", "furniture"]],
	["appliances", ["техник", "бытов", "appliance"]],
	["electronics", ["электроник", "телефон", "гаджет", "electronics"]],
	["computer", ["компьют", "ноутбук", "software", "computer"]],
	["internet", ["интернет", "связь", "internet"]],
	["pharmacy", ["аптек", "лекар", "pharmacy"]],
	["health", ["здоров", "врач", "медицин", "health"]],
	["beauty", ["красот", "космет", "салон", "beauty"]],
	["groceries", ["продукт", "супермаркет", "grocer"]],
	["dining", ["кафе", "ресторан", "кейтер", "dining"]],
	["coffee", ["кофе", "coffee"]],
	["alcohol", ["алкогол", "вино", "бар", "wine"]],
	["fuel", ["топлив", "бензин", "заправ", "fuel"]],
	["parking", ["парков", "parking"]],
	["taxi", ["такси", "taxi"]],
	["delivery", ["достав", "курьер", "логист", "delivery"]],
	["transport", ["транспорт", "автомоб", "машин", "transport"]],
	["hotel", ["отел", "проживан", "гостиниц", "hotel"]],
	["tickets", ["билет", "экскурс", "ticket"]],
	["travel", ["путеше", "туризм", "поездк", "travel"]],
	["housing", ["жиль", "аренд", "коммун", "жкх", "housing"]],
	["clothing", ["одеж", "обув", "clothing"]],
	["pets", ["животн", "питом", "ветерин", "pets"]],
	["children", ["дет", "ребен", "baby", "children"]],
	["education", ["образован", "обучен", "курс", "education"]],
	["sports", ["спорт", "фитнес", "трениров", "sports"]],
	["hobbies", ["хобби", "творче", "hobby"]],
	["leisure", ["досуг", "кино", "развлеч", "leisure"]],
	["gifts", ["подар", "gift"]],
	["garden", ["сад", "растен", "garden"]],
	["cleaning", ["уборк", "клининг", "clean"]],
	["packaging", ["упаков", "расходник", "packaging"]],
	["warehouse", ["склад", "хранен", "warehouse"]],
	["marketing", ["реклам", "маркетинг", "продвиж", "marketing"]],
	["team", ["команд", "персонал", "сотрудник", "подрядчик", "team"]],
	["office", ["офис", "канцеляр", "office"]],
	["insurance", ["страхован", "страховк", "insurance"]],
	["finance", ["финанс", "налог", "кредит", "банк", "комисси", "finance"]],
	["business", ["бизнес", "проект", "business"]],
	["photo", ["фото", "видео", "camera"]],
	["home", ["дом", "квартир", "home"]],
];

export const normalizeCategoryIconKey = (
	value?: string | null,
): CategoryIconKey =>
	value && iconKeys.has(value) ? (value as CategoryIconKey) : "tag";

export const suggestCategoryIconKey = (
	name: string,
	categoryKey = "",
): CategoryIconKey => {
	if (iconKeys.has(categoryKey) && categoryKey !== "tag") {
		return categoryKey as CategoryIconKey;
	}
	const search = `${categoryKey} ${name}`.trim().toLocaleLowerCase("ru");
	for (const [key, keywords] of iconRules) {
		if (keywords.some((keyword) => search.includes(keyword))) return key;
	}
	return "tag";
};

export const categoryIconOption = (key?: string | null) =>
	CATEGORY_ICON_OPTIONS.find(
		(option) => option.key === normalizeCategoryIconKey(key),
	) ?? CATEGORY_ICON_OPTIONS[CATEGORY_ICON_OPTIONS.length - 1];

export const categoryIconLabel = (
	key: string | null | undefined,
	language: UILanguage,
) => categoryIconOption(key).labels[language];
