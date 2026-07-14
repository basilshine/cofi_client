import {
	Camera,
	ChartDonut,
	ChatCircleText,
	Check,
	GearSix,
	House,
	MagnifyingGlass,
	Microphone,
	NotePencil,
	PaperPlaneTilt,
	PencilSimple,
	Plus,
	Receipt,
	Storefront,
	Tag,
	Trash,
	UserCircle,
	UsersThree,
	X,
} from "@phosphor-icons/react";
import WebApp from "@twa-dev/sdk";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import "./mini-app.css";
import { captureSourceKind } from "./capture-source";
import { groupRowsByExpense } from "./expense-groups";
import {
	expenseAmountInCurrency,
	expenseDisplayMoney,
	formatMoney,
	itemAmountInCurrency,
	itemDisplayMoney,
} from "./money";
import {
	commonVendorName,
	findVendorByName,
	vendorFieldValue,
	vendorSuggestions,
} from "./vendor";

type View =
	| "overview"
	| "expenses"
	| "vendors"
	| "categories"
	| "spaces"
	| "profile"
	| "review";
type Period =
	| "today"
	| "three-days"
	| "week"
	| "month"
	| "three-months"
	| "six-months"
	| "year"
	| "all";

type Space = {
	id: number;
	tenant_id: number;
	owner_user_id: number;
	is_personal: boolean;
	name: string;
	description?: string;
	currency: string;
};

type SpaceMember = {
	user_id: number;
	name: string;
	email: string;
	role: string;
};

type Category = {
	id: number;
	key: string;
	name: string;
	count: number;
	total: number;
	last_used?: string | null;
	aliases?: string[];
	alias_text?: string;
	budget_period?: "week" | "month" | "";
	budget_amount?: number | null;
	budget_spent?: number;
	budget_remaining?: number | null;
	budget_percent?: number;
};

type BudgetWarning = {
	category_name: string;
	threshold: number;
	spent: number;
	limit: number;
	remaining: number;
	currency: string;
	period: "week" | "month";
};

type HomeScreenStatus =
	| "checking"
	| "unsupported"
	| "unknown"
	| "added"
	| "missed";
const telegramWebApp = WebApp as typeof WebApp & {
	addToHomeScreen?: () => void;
	checkHomeScreenStatus?: (
		callback: (status: Exclude<HomeScreenStatus, "checking">) => void,
	) => void;
	disableVerticalSwipes?: () => void;
	requestFullscreen?: () => void;
	isFullscreen?: boolean;
	onEvent: (eventType: "homeScreenAdded", handler: () => void) => void;
	offEvent: (eventType: "homeScreenAdded", handler: () => void) => void;
};

type VendorAlias = { id?: number; alias: string };
type Vendor = {
	id: number;
	name: string;
	aliases?: VendorAlias[];
};

type ExpenseItem = {
	id?: number;
	name: string;
	amount: number;
	source_amount?: number;
	source_currency?: string;
	space_amount?: number;
	space_currency?: string;
	reporting_amount?: number;
	category_id?: number;
	category_name?: string;
	category?: { id: number; name: string };
	vendor_id?: number;
	vendor_name?: string;
	vendor?: { id: number; name: string };
	notes?: string;
};

type Expense = {
	id: number;
	user_id: number;
	title: string;
	payee_text?: string;
	vendor_id?: number;
	vendor_name?: string;
	vendor?: { id: number; name: string };
	expense_date: string;
	amount?: number;
	total?: number;
	space_total?: number;
	reporting_total?: number;
	reporting_currency?: string;
	source_document_id?: number;
	currency: string;
	source_currency?: string;
	space_currency?: string;
	items: ExpenseItem[];
};

type ExpenseItemRow = {
	expense: Expense;
	item: ExpenseItem;
	itemIndex: number;
};

type User = {
	id: number;
	name: string;
	email: string;
	telegramUsername?: string;
	country: string;
	language: string;
	timezone: string;
	currency: string;
	dateFormat: string;
	emailNotifications: boolean;
	darkMode: boolean;
};

type Quota = {
	plan: string;
	limit: number;
	used: number;
	remaining: number;
};

type AuthResponse = { token: string; user: User };
type CaptureResponse = {
	candidates?: { id: number; candidate_type: string }[];
};

type ReviewCandidate = {
	id: number;
	source_document_id: number;
	candidate_type: string;
	title: string;
	status: string;
	structured_data?: Record<string, unknown>;
};

type ReviewDraftItem = {
	key: string;
	name: string;
	amount: number;
	category_key: string;
	vendor_name: string;
	notes: string;
};

type ReviewDraft = {
	candidateID: number;
	sourceDocumentID: number;
	title: string;
	payeeText: string;
	expenseDate: string;
	sourceCurrency: string;
	items: ReviewDraftItem[];
};

type ReviewTarget = { spaceID: number; candidateID: number };

const currencyOptions = [
	["RUB", "Российский рубль"],
	["USD", "Доллар США"],
	["EUR", "Евро"],
	["KZT", "Казахстанский тенге"],
	["THB", "Тайский бат"],
	["CNY", "Китайский юань"],
	["GEL", "Грузинский лари"],
	["TRY", "Турецкая лира"],
	["AED", "Дирхам ОАЭ"],
	["GBP", "Фунт стерлингов"],
] as const;
const countryOptions = [
	["RU", "Россия"],
	["KZ", "Казахстан"],
	["BY", "Беларусь"],
	["AM", "Армения"],
	["AZ", "Азербайджан"],
	["GE", "Грузия"],
	["KG", "Кыргызстан"],
	["UZ", "Узбекистан"],
	["TJ", "Таджикистан"],
	["MD", "Молдова"],
	["TR", "Турция"],
	["TH", "Таиланд"],
	["AE", "ОАЭ"],
	["CN", "Китай"],
	["DE", "Германия"],
	["FR", "Франция"],
	["IT", "Италия"],
	["ES", "Испания"],
	["GB", "Великобритания"],
	["US", "США"],
] as const;
const timezoneOptions = [
	["Europe/Kaliningrad", "Калининград (UTC+2)"],
	["Europe/Moscow", "Москва (UTC+3)"],
	["Europe/Samara", "Самара (UTC+4)"],
	["Asia/Yekaterinburg", "Екатеринбург (UTC+5)"],
	["Asia/Omsk", "Омск (UTC+6)"],
	["Asia/Novosibirsk", "Новосибирск (UTC+7)"],
	["Asia/Barnaul", "Барнаул (UTC+7)"],
	["Asia/Tomsk", "Томск (UTC+7)"],
	["Asia/Krasnoyarsk", "Красноярск (UTC+7)"],
	["Asia/Irkutsk", "Иркутск (UTC+8)"],
	["Asia/Chita", "Чита (UTC+9)"],
	["Asia/Yakutsk", "Якутск (UTC+9)"],
	["Asia/Vladivostok", "Владивосток (UTC+10)"],
	["Asia/Magadan", "Магадан (UTC+11)"],
	["Asia/Sakhalin", "Сахалин (UTC+11)"],
	["Asia/Kamchatka", "Камчатка (UTC+12)"],
	["Europe/Minsk", "Минск (UTC+3)"],
	["Asia/Almaty", "Алматы (UTC+5)"],
	["Asia/Bishkek", "Бишкек (UTC+6)"],
	["Asia/Tashkent", "Ташкент (UTC+5)"],
	["Asia/Tbilisi", "Тбилиси (UTC+4)"],
	["Asia/Yerevan", "Ереван (UTC+4)"],
	["Asia/Baku", "Баку (UTC+4)"],
	["Europe/Istanbul", "Стамбул (UTC+3)"],
	["Asia/Bangkok", "Бангкок (UTC+7)"],
	["Asia/Dubai", "Дубай (UTC+4)"],
	["Europe/Berlin", "Берлин"],
	["Europe/London", "Лондон"],
	["America/New_York", "Нью-Йорк"],
] as const;
type CapturePacket = {
	source_document_id: number;
	media_object_id?: number;
	input_kind?: string;
	source_type?: string;
	document_type?: string;
	source_text?: string;
	created_at?: string;
};

type SourceViewer = {
	capture: CapturePacket;
	mediaURL?: string;
	mediaType?: string;
};

const dismissKeyboard = (event: React.PointerEvent<HTMLElement>) => {
	if ((event.target as HTMLElement).closest("input, textarea, select")) return;
	if (document.activeElement instanceof HTMLElement)
		document.activeElement.blur();
};

const BOT_URL = "https://t.me/poka_ne_zabyl_bot";
const aliasesFromText = (value: string) =>
	Array.from(
		new Set(
			value
				.split(",")
				.map((alias) => alias.trim())
				.filter(Boolean),
		),
	);
const budgetWarningText = (warning: BudgetWarning) =>
	warning.threshold >= 100
		? `Лимит «${warning.category_name}» исчерпан`
		: `В «${warning.category_name}» осталось ${formatMoney(warning.remaining, warning.currency)}`;
const previewMode =
	["localhost", "127.0.0.1"].includes(window.location.hostname) &&
	new URLSearchParams(window.location.search).get("preview") === "1";
const previewCategories: Category[] = [
	{
		id: 1,
		key: "groceries",
		name: "Продукты",
		count: 8,
		total: 12460,
		last_used: new Date().toISOString(),
		aliases: ["Продукты", "Супермаркет"],
		budget_period: "month",
		budget_amount: 20000,
		budget_spent: 12460,
		budget_remaining: 7540,
		budget_percent: 62.3,
	},
	{
		id: 2,
		key: "pets",
		name: "Домашние животные",
		count: 3,
		total: 4820,
		last_used: new Date(Date.now() - 86400000).toISOString(),
	},
	{
		id: 3,
		key: "hobbies",
		name: "Хобби",
		count: 2,
		total: 3900,
		last_used: new Date(Date.now() - 172800000).toISOString(),
	},
	{
		id: 4,
		key: "transport",
		name: "Транспорт",
		count: 6,
		total: 2740,
		last_used: new Date(Date.now() - 259200000).toISOString(),
	},
	{
		id: 5,
		key: "other",
		name: "Другое",
		count: 0,
		total: 0,
		last_used: null,
	},
];
const previewExpenses: Expense[] = [
	{
		id: 1,
		source_document_id: 101,
		user_id: 1,
		title: "Покупки на неделю",
		payee_text: "Лента",
		expense_date: isoDay(0),
		total: 2840,
		space_total: 2840,
		currency: "RUB",
		items: [{ id: 1, name: "Продукты", amount: 2840, category_id: 1 }],
	},
	{
		id: 2,
		source_document_id: 102,
		user_id: 1,
		title: "Корм для кошек",
		payee_text: "Белый кролик",
		expense_date: isoDay(-1),
		total: 1360,
		space_total: 1360,
		currency: "RUB",
		items: [
			{ id: 2, name: "Корм и наполнитель", amount: 1360, category_id: 2 },
		],
	},
	{
		id: 3,
		source_document_id: 103,
		user_id: 1,
		title: "Танцы",
		payee_text: "Студия движения",
		expense_date: isoDay(-2),
		total: 2600,
		space_total: 2600,
		currency: "RUB",
		items: [{ id: 3, name: "Абонемент", amount: 2600, category_id: 3 }],
	},
	{
		id: 4,
		source_document_id: 104,
		user_id: 1,
		title: "Такси домой",
		payee_text: "Яндекс Go",
		expense_date: isoDay(-3),
		total: 680,
		space_total: 680,
		currency: "RUB",
		items: [{ id: 4, name: "Поездка", amount: 680, category_id: 4 }],
	},
];
const previewVendors: Vendor[] = [
	{ id: 1, name: "Лента", aliases: [] },
	{
		id: 2,
		name: "Белый кролик",
		aliases: [{ alias: "ИП Иванов Иван Иванович" }],
	},
	{ id: 3, name: "Студия движения", aliases: [] },
	{ id: 4, name: "Яндекс Go", aliases: [] },
];
const previewCaptures: CapturePacket[] = [
	{
		source_document_id: 101,
		input_kind: "image",
		source_type: "receipt",
		source_text: "Фото чека из Ленты",
	},
	{
		source_document_id: 102,
		input_kind: "text",
		source_text: "Корм и наполнитель 1360, Белый кролик",
	},
	{
		source_document_id: 103,
		input_kind: "voice",
		source_text: "Абонемент на танцы 2600 рублей",
	},
	{
		source_document_id: 104,
		input_kind: "text",
		source_text: "Такси домой 680 рублей",
	},
];

const captureForExpense = (expense: Expense, captures: CapturePacket[]) =>
	captures.find(
		(capture) => capture.source_document_id === expense.source_document_id,
	);

const apiRequest = async <T,>(
	path: string,
	token = "",
	init?: RequestInit,
): Promise<T> => {
	const response = await fetch(`/api/v1${path}`, {
		...init,
		headers: {
			"Content-Type": "application/json",
			...(token ? { Authorization: `Bearer ${token}` } : {}),
			...init?.headers,
		},
	});
	if (!response.ok) {
		const body = (await response.json().catch(() => ({}))) as {
			error?: string;
		};
		throw new Error(body.error || "Не удалось загрузить данные");
	}
	if (response.status === 204) return undefined as T;
	return response.json() as Promise<T>;
};

const reviewTarget = (): ReviewTarget | null => {
	const query = new URLSearchParams(window.location.search);
	const directSpace = Number(query.get("space_id"));
	const directCandidate = Number(query.get("candidate_id"));
	if (query.get("view") === "review" && directSpace > 0 && directCandidate > 0)
		return { spaceID: directSpace, candidateID: directCandidate };
	const startParam =
		query.get("tgWebAppStartParam") || WebApp.initDataUnsafe.start_param || "";
	const match = /^r_(\d+)_(\d+)$/.exec(startParam);
	if (!match) return null;
	return { spaceID: Number(match[1]), candidateID: Number(match[2]) };
};

const requestedReview = reviewTarget();

const initialView = (): View => {
	if (requestedReview) return "review";
	const requested = new URLSearchParams(window.location.search).get("view");
	return requested === "expenses" ||
		requested === "categories" ||
		requested === "vendors" ||
		requested === "spaces" ||
		requested === "profile"
		? requested
		: "overview";
};

export const MiniApp = () => {
	const started = useRef(false);
	const [view, setView] = useState<View>(initialView);
	const [token, setToken] = useState("");
	const [user, setUser] = useState<User | null>(null);
	const [spaces, setSpaces] = useState<Space[]>([]);
	const [spaceID, setSpaceID] = useState(0);
	const [members, setMembers] = useState<SpaceMember[]>([]);
	const [expenses, setExpenses] = useState<Expense[]>([]);
	const [captures, setCaptures] = useState<CapturePacket[]>([]);
	const [categories, setCategories] = useState<Category[]>([]);
	const [vendors, setVendors] = useState<Vendor[]>([]);
	const [quota, setQuota] = useState<Quota | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const [period, setPeriod] = useState<Period>("month");
	const [categoryID, setCategoryID] = useState(0);
	const [vendorID, setVendorID] = useState(0);
	const [expenseID, setExpenseID] = useState(0);
	const [groupByExpense, setGroupByExpense] = useState(false);
	const [query, setQuery] = useState("");
	const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
	const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
	const [editingCategory, setEditingCategory] = useState<Category | null>(null);
	const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
	const [editingProfile, setEditingProfile] = useState<User | null>(null);
	const [editingSpace, setEditingSpace] = useState<Space | null>(null);
	const [reviewDraft, setReviewDraft] = useState<ReviewDraft | null>(null);
	const [reviewMediaURL, setReviewMediaURL] = useState("");
	const [savedReviewExpense, setSavedReviewExpense] = useState<Expense | null>(
		null,
	);
	const [sourceViewer, setSourceViewer] = useState<SourceViewer | null>(null);
	const [sourceLoading, setSourceLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [homeScreenStatus, setHomeScreenStatus] =
		useState<HomeScreenStatus>("checking");
	const itemNameSuggestions = useMemo(() => {
		const seen = new Set<string>();
		return expenses
			.flatMap((expense) => expense.items.map((item) => item.name.trim()))
			.filter((name) => {
				const key = name.toLocaleLowerCase("ru");
				if (!name || seen.has(key)) return false;
				seen.add(key);
				return true;
			})
			.slice(0, 200);
	}, [expenses]);

	useEffect(() => {
		document.body.classList.add("mini-body");
		return () => document.body.classList.remove("mini-body");
	}, []);

	useEffect(() => {
		if (started.current) return;
		started.current = true;
		WebApp.ready();
		WebApp.expand();
		WebApp.setHeaderColor("#f4efe4");
		WebApp.setBackgroundColor("#f4efe4");
		if (
			telegramWebApp.isVersionAtLeast("7.7") &&
			telegramWebApp.disableVerticalSwipes
		) {
			telegramWebApp.disableVerticalSwipes();
		}
		if (
			telegramWebApp.isVersionAtLeast("8.0") &&
			telegramWebApp.requestFullscreen &&
			!telegramWebApp.isFullscreen
		) {
			telegramWebApp.requestFullscreen();
		}
		if (
			telegramWebApp.isVersionAtLeast("8.0") &&
			telegramWebApp.checkHomeScreenStatus
		) {
			telegramWebApp.checkHomeScreenStatus(setHomeScreenStatus);
		} else {
			setHomeScreenStatus("unsupported");
		}
		if (previewMode) {
			setToken("preview");
			setUser({
				id: 1,
				name: "Василий",
				email: "telegram_1@telegram.local",
				telegramUsername: "basil",
				country: "RU",
				language: "ru",
				timezone: "Asia/Tomsk",
				currency: "RUB",
				dateFormat: "DD.MM.YYYY",
				emailNotifications: false,
				darkMode: false,
			});
			setSpaces([
				{
					id: 1,
					tenant_id: 1,
					owner_user_id: 1,
					is_personal: true,
					name: "Личные расходы",
					currency: "RUB",
				},
			]);
			setMembers([
				{
					user_id: 1,
					name: "Василий",
					email: "telegram_1@telegram.local",
					role: "owner",
				},
			]);
			setSpaceID(1);
			setExpenses(previewExpenses);
			setCaptures(previewCaptures);
			setCategories(previewCategories);
			setVendors(previewVendors);
			setQuota({ plan: "basic", limit: 100, used: 37, remaining: 63 });
			if (requestedReview) {
				setReviewDraft({
					candidateID: requestedReview.candidateID,
					sourceDocumentID: 77,
					title: "Покупки в Ленте",
					payeeText: "Лента",
					expenseDate: localISODate(),
					sourceCurrency: "RUB",
					items: [
						{
							key: "preview-milk",
							name: "Молоко",
							amount: 200,
							category_key: "groceries",
							vendor_name: "Лента",
							notes: "",
						},
						{
							key: "preview-kefir",
							name: "Кефир",
							amount: 100,
							category_key: "groceries",
							vendor_name: "Лента",
							notes: "",
						},
					],
				});
			}
			setLoading(false);
			return;
		}

		if (!WebApp.initData) {
			setError("Откройте приложение из личного чата с ботом.");
			setLoading(false);
			return;
		}
		void login();
	}, []);

	useEffect(() => {
		const handleHomeScreenAdded = () => {
			setHomeScreenStatus("added");
			setNotice("Приложение добавлено на главный экран");
		};
		telegramWebApp.onEvent("homeScreenAdded", handleHomeScreenAdded);
		return () =>
			telegramWebApp.offEvent("homeScreenAdded", handleHomeScreenAdded);
	}, []);

	const login = async () => {
		try {
			const auth = await apiRequest<AuthResponse>("/auth/telegram", "", {
				method: "POST",
				body: JSON.stringify({ telegramInitData: WebApp.initData }),
			});
			const availableSpaces = await apiRequest<Space[]>("/spaces", auth.token);
			setToken(auth.token);
			setUser(auth.user);
			setSpaces(availableSpaces);
			setSpaceID(
				availableSpaces.some((space) => space.id === requestedReview?.spaceID)
					? requestedReview?.spaceID || 0
					: availableSpaces[0]?.id || 0,
			);
			if (availableSpaces.length === 0) {
				setView("spaces");
				setLoading(false);
			}
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Не удалось войти через Telegram",
			);
			setLoading(false);
		}
	};

	useEffect(() => {
		if (!token || !spaceID) return;
		void loadSpace();
	}, [token, spaceID, user?.currency]);

	const loadSpace = async () => {
		if (previewMode) return;
		setLoading(true);
		setError("");
		try {
			// ponytail: the latest 200 records cover launch usage; add server filters when this ceiling becomes visible.
			const [
				expenseData,
				categoryData,
				quotaData,
				memberData,
				vendorData,
				captureData,
			] = await Promise.all([
				apiRequest<{ expenses: Expense[] }>(
					`/spaces/${spaceID}/expenses?limit=200&currency=${encodeURIComponent(user?.currency || "RUB")}`,
					token,
				),
				apiRequest<{ categories: Category[] }>(
					`/spaces/${spaceID}/categories`,
					token,
				),
				apiRequest<Quota>(`/quota?space_id=${spaceID}`, token),
				apiRequest<{ members: SpaceMember[] }>(
					`/spaces/${spaceID}/members`,
					token,
				),
				apiRequest<Vendor[]>(`/spaces/${spaceID}/vendors`, token),
				apiRequest<{ captures: CapturePacket[] }>(
					`/spaces/${spaceID}/captures?limit=100`,
					token,
				),
			]);
			setExpenses(expenseData.expenses || []);
			setCaptures(captureData.captures || []);
			setCategories(categoryData.categories || []);
			setQuota(quotaData);
			setMembers(memberData.members || []);
			setVendors(vendorData || []);
			if (view === "review" && requestedReview) {
				await loadReview(token, spaceID, requestedReview.candidateID);
			}
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: "Не удалось загрузить пространство",
			);
		} finally {
			setLoading(false);
		}
	};

	const loadReview = async (
		authToken: string,
		reviewSpaceID: number,
		candidateID: number,
	) => {
		const response = await apiRequest<{ candidates: ReviewCandidate[] }>(
			`/spaces/${reviewSpaceID}/review/candidates?limit=100`,
			authToken,
		);
		const candidate = response.candidates.find(
			(item) => item.id === candidateID,
		);
		if (!candidate || candidate.candidate_type !== "expense_candidate")
			throw new Error("Этот расход уже сохранён или больше недоступен");
		setReviewDraft(reviewDraftFromCandidate(candidate, response.candidates));
		const packets = await apiRequest<{ captures: CapturePacket[] }>(
			`/spaces/${reviewSpaceID}/captures?limit=1&source_document_id=${candidate.source_document_id}`,
			authToken,
		);
		const mediaID = packets.captures[0]?.media_object_id;
		if (!mediaID) return;
		const media = await fetch(`/api/v1/media/${mediaID}`, {
			headers: { Authorization: `Bearer ${authToken}` },
		});
		if (!media.ok) return;
		const blob = await media.blob();
		if (blob.type.startsWith("image/"))
			setReviewMediaURL(URL.createObjectURL(blob));
	};

	const openExpenseSource = async (expense: Expense) => {
		if (sourceLoading) return;
		if (!expense.source_document_id) {
			setNotice("У этого расхода нет сохранённого исходника");
			return;
		}
		setSourceLoading(true);
		setError("");
		try {
			let capture = captureForExpense(expense, captures);
			if (!capture && !previewMode) {
				const response = await apiRequest<{ captures: CapturePacket[] }>(
					`/spaces/${spaceID}/captures?limit=1&source_document_id=${expense.source_document_id}`,
					token,
				);
				capture = response.captures.find(
					(item) => item.source_document_id === expense.source_document_id,
				);
				if (capture)
					setCaptures((current) => [...current, capture as CapturePacket]);
			}
			if (!capture) throw new Error("Исходный материал не найден");

			const viewer: SourceViewer = { capture };
			if (capture.media_object_id && !previewMode) {
				const response = await fetch(
					`/api/v1/media/${capture.media_object_id}`,
					{
						headers: { Authorization: `Bearer ${token}` },
					},
				);
				if (!response.ok) throw new Error("Не удалось загрузить исходный файл");
				const blob = await response.blob();
				viewer.mediaURL = URL.createObjectURL(blob);
				viewer.mediaType = blob.type;
			}
			setSourceViewer(viewer);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Не удалось открыть исходник",
			);
		} finally {
			setSourceLoading(false);
		}
	};

	useEffect(
		() => () => {
			if (reviewMediaURL) URL.revokeObjectURL(reviewMediaURL);
		},
		[reviewMediaURL],
	);

	useEffect(
		() => () => {
			if (sourceViewer?.mediaURL) URL.revokeObjectURL(sourceViewer.mediaURL);
		},
		[sourceViewer?.mediaURL],
	);

	const saveReview = async () => {
		if (!reviewDraft) return;
		setSaving(true);
		setError("");
		try {
			const payload = {
				review: {
					title: reviewDraft.title,
					payee_text: reviewDraft.payeeText,
					expense_date: reviewDraft.expenseDate,
					source_currency: reviewDraft.sourceCurrency,
					items: reviewDraft.items.map(({ key: _key, ...item }) => item),
				},
			};
			if (previewMode) {
				setSavedReviewExpense(reviewExpenseFromDraft(reviewDraft, currency));
				return;
			}
			const result = await apiRequest<{
				expense: Expense;
				budget_warnings?: BudgetWarning[];
			}>(
				`/spaces/${spaceID}/review/candidates/${reviewDraft.candidateID}/create-expense`,
				token,
				{ method: "POST", body: JSON.stringify(payload) },
			);
			setSavedReviewExpense(result.expense);
			if (result.budget_warnings?.[0]) {
				setNotice(budgetWarningText(result.budget_warnings[0]));
			}
			WebApp.HapticFeedback.notificationOccurred("success");
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Не удалось сохранить расход",
			);
		} finally {
			setSaving(false);
		}
	};

	const filteredItems = useMemo(() => {
		const normalizedQuery = query.trim().toLocaleLowerCase("ru");
		const start = periodStart(period);
		return expenseItemRows(expenses).filter(({ expense, item }) => {
			const date = new Date(`${expense.expense_date}T00:00:00`);
			const itemVendorID = item.vendor_id || expense.vendor_id;
			const text = [
				item.name,
				item.notes,
				item.vendor_name,
				item.vendor?.name,
				expense.title,
				expense.payee_text,
				expense.vendor_name,
				expense.vendor?.name,
				item.category_name,
				item.category?.name,
			]
				.filter(Boolean)
				.join(" ")
				.toLocaleLowerCase("ru");
			return (
				(!start || date >= start) &&
				(expenseID === 0 || expense.id === expenseID) &&
				(categoryID === 0 || item.category_id === categoryID) &&
				(vendorID === 0 || itemVendorID === vendorID) &&
				(!normalizedQuery || text.includes(normalizedQuery))
			);
		});
	}, [expenses, period, expenseID, categoryID, vendorID, query]);

	const activeSpace = spaces.find((space) => space.id === spaceID);
	const currency = user?.currency || activeSpace?.currency || "RUB";
	const overviewExpenses = expenses;
	const overviewTotal = overviewExpenses.reduce(
		(sum, expense) => sum + (expenseAmountInCurrency(expense, currency) ?? 0),
		0,
	);
	const categoryTotals = useMemo(() => {
		const totals = new Map<number, number>();
		for (const expense of overviewExpenses) {
			for (const item of expense.items) {
				if (item.category_id)
					totals.set(
						item.category_id,
						(totals.get(item.category_id) || 0) +
							(itemAmountInCurrency(item, expense, currency) ?? 0),
					);
			}
		}
		return categories
			.map((category) => ({
				...category,
				filteredTotal: totals.get(category.id) || 0,
			}))
			.filter((category) => category.filteredTotal > 0)
			.sort((a, b) => b.filteredTotal - a.filteredTotal);
	}, [categories, overviewExpenses, currency]);

	const openCategory = (id: number) => {
		setPeriod("all");
		setCategoryID(id);
		setVendorID(0);
		setExpenseID(0);
		setQuery("");
		setGroupByExpense(false);
		setView("expenses");
	};

	const openExpense = (id: number) => {
		setPeriod("all");
		setCategoryID(0);
		setVendorID(0);
		setExpenseID(id);
		setQuery("");
		setGroupByExpense(false);
		setView("expenses");
	};

	const openAllExpenses = () => {
		setPeriod("all");
		setCategoryID(0);
		setVendorID(0);
		setExpenseID(0);
		setQuery("");
		setView("expenses");
	};

	const installOnHomeScreen = () => {
		if (!telegramWebApp.addToHomeScreen) return;
		telegramWebApp.addToHomeScreen();
		setNotice("Подтвердите добавление приложения на главный экран");
	};

	const saveExpense = async () => {
		if (!editingExpense) return;
		const creating = editingExpense.id === 0;
		const editingSingleItem = editingItemIndex !== null;
		const successNotice = creating
			? "Расход добавлен"
			: editingSingleItem
				? "Покупка сохранена"
				: "Расход сохранён";
		if (previewMode) {
			const saved = creating
				? {
						...editingExpense,
						id: Date.now(),
						total: editingExpense.items.reduce(
							(sum, item) => sum + item.amount,
							0,
						),
						space_total: editingExpense.items.reduce(
							(sum, item) => sum + item.amount,
							0,
						),
					}
				: editingExpense;
			setExpenses((current) =>
				creating
					? [saved, ...current]
					: current.map((expense) =>
							expense.id === saved.id ? saved : expense,
						),
			);
			setEditingExpense(null);
			setEditingItemIndex(null);
			setNotice(successNotice);
			return;
		}
		setSaving(true);
		try {
			let saveNotice = successNotice;
			const sellerName = (
				editingExpense.payee_text ||
				vendors.find((vendor) => vendor.id === editingExpense.vendor_id)
					?.name ||
				""
			).trim();
			const vendorRequests = new Map<string, Promise<number | undefined>>();
			const ensureVendorID = (name: string, existingID?: number) => {
				const trimmed = name.trim();
				if (!trimmed) return Promise.resolve(undefined);
				const knownID = existingID || findVendorByName(vendors, trimmed)?.id;
				if (knownID) return Promise.resolve(knownID);
				const key = trimmed.toLocaleLowerCase("ru");
				const pending = vendorRequests.get(key);
				if (pending) return pending;
				const request = apiRequest<Vendor>(
					`/spaces/${spaceID}/vendors`,
					token,
					{
						method: "POST",
						body: JSON.stringify({ name: trimmed, aliases: [] }),
					},
				).then((vendor) => vendor.id);
				vendorRequests.set(key, request);
				return request;
			};
			const vendorID = await ensureVendorID(
				sellerName,
				editingExpense.vendor_id,
			);
			const itemVendorNames = editingExpense.items.map(
				(item) =>
					item.vendor_name?.trim() ||
					item.vendor?.name ||
					vendors.find((vendor) => vendor.id === item.vendor_id)?.name ||
					sellerName,
			);
			const itemVendorIDs = await Promise.all(
				editingExpense.items.map((item, index) =>
					ensureVendorID(itemVendorNames[index], item.vendor_id),
				),
			);
			if (creating) {
				const captured = await apiRequest<CaptureResponse>("/capture", token, {
					method: "POST",
					body: JSON.stringify({
						input_kind: "manual",
						space_id: spaceID,
						description: editingExpense.title,
						items: editingExpense.items.map((item, index) => ({
							name: item.name,
							amount: Number(item.amount),
							vendor_name: itemVendorNames[index],
							currency,
							category: categories.find(
								(category) => category.id === item.category_id,
							)?.key,
						})),
					}),
				});
				const candidate = captured.candidates?.find(
					(item) => item.candidate_type === "expense_candidate",
				);
				if (!candidate) throw new Error("Не удалось подготовить расход");
				const projected = await apiRequest<{
					budget_warnings?: BudgetWarning[];
				}>(
					`/spaces/${spaceID}/review/candidates/${candidate.id}/create-expense`,
					token,
					{ method: "POST", body: "{}" },
				);
				if (projected.budget_warnings?.[0]) {
					saveNotice = budgetWarningText(projected.budget_warnings[0]);
				}
			} else {
				await apiRequest(
					`/spaces/${spaceID}/expenses/${editingExpense.id}`,
					token,
					{
						method: "PUT",
						body: JSON.stringify({
							title: editingExpense.title,
							payee_text: sellerName,
							vendor_id: vendorID || undefined,
							vendor_id_clear: !vendorID,
							expense_date: editingExpense.expense_date,
							items: editingExpense.items.map((item, index) => ({
								name: item.name,
								amount: Number(item.amount),
								category_id: item.category_id,
								vendor_id: itemVendorIDs[index],
								notes: item.notes || "",
							})),
						}),
					},
				);
			}
			setEditingExpense(null);
			setEditingItemIndex(null);
			setNotice(saveNotice);
			await loadSpace();
		} catch (err) {
			setNotice(
				err instanceof Error
					? err.message
					: editingSingleItem
						? "Не удалось сохранить покупку"
						: "Не удалось сохранить расход",
			);
		} finally {
			setSaving(false);
		}
	};

	const deleteExpense = async () => {
		if (!editingExpense || editingExpense.id === 0) return;
		if (!window.confirm(`Удалить расход «${editingExpense.title}»?`)) return;
		if (previewMode) {
			setExpenses((current) =>
				current.filter((expense) => expense.id !== editingExpense.id),
			);
			setEditingExpense(null);
			setEditingItemIndex(null);
			setNotice("Расход удалён");
			return;
		}
		setSaving(true);
		try {
			await apiRequest(
				`/spaces/${spaceID}/expenses/${editingExpense.id}`,
				token,
				{ method: "DELETE" },
			);
			setEditingExpense(null);
			setEditingItemIndex(null);
			setNotice("Расход удалён");
			await loadSpace();
		} catch (err) {
			setNotice(
				err instanceof Error ? err.message : "Не удалось удалить расход",
			);
		} finally {
			setSaving(false);
		}
	};

	const deleteExpenseItem = async () => {
		if (!editingExpense || editingItemIndex === null || editingExpense.id === 0)
			return;
		const item = editingExpense.items[editingItemIndex];
		if (!item?.id) return;
		const deletesExpense = editingExpense.items.length === 1;
		const message = deletesExpense
			? `Это последняя покупка. Удалить её вместе с расходом «${editingExpense.title}»?`
			: `Удалить покупку «${item.name}»?`;
		if (!window.confirm(message)) return;
		if (previewMode) {
			if (deletesExpense) {
				setExpenses((current) =>
					current.filter((expense) => expense.id !== editingExpense.id),
				);
			} else {
				const items = editingExpense.items.filter(
					(_, index) => index !== editingItemIndex,
				);
				const total = items.reduce((sum, current) => sum + current.amount, 0);
				setExpenses((current) =>
					current.map((expense) =>
						expense.id === editingExpense.id
							? { ...editingExpense, items, total, space_total: total }
							: expense,
					),
				);
			}
			setEditingExpense(null);
			setEditingItemIndex(null);
			setNotice(deletesExpense ? "Расход удалён" : "Покупка удалена");
			return;
		}
		setSaving(true);
		try {
			const result = await apiRequest<{ expense_deleted: boolean }>(
				`/spaces/${spaceID}/expenses/${editingExpense.id}/items/${item.id}`,
				token,
				{ method: "DELETE" },
			);
			setEditingExpense(null);
			setEditingItemIndex(null);
			setNotice(result.expense_deleted ? "Расход удалён" : "Покупка удалена");
			await loadSpace();
		} catch (err) {
			setNotice(
				err instanceof Error ? err.message : "Не удалось удалить покупку",
			);
		} finally {
			setSaving(false);
		}
	};

	const saveVendor = async () => {
		if (!editingVendor) return;
		const creating = editingVendor.id === 0;
		if (previewMode) {
			const saved = creating
				? { ...editingVendor, id: Date.now() }
				: editingVendor;
			setVendors((current) =>
				creating
					? [...current, saved]
					: current.map((vendor) => (vendor.id === saved.id ? saved : vendor)),
			);
			setEditingVendor(null);
			setNotice(creating ? "Продавец добавлен" : "Продавец сохранён");
			return;
		}
		setSaving(true);
		try {
			await apiRequest(
				creating
					? `/spaces/${spaceID}/vendors`
					: `/spaces/${spaceID}/vendors/${editingVendor.id}`,
				token,
				{
					method: creating ? "POST" : "PUT",
					body: JSON.stringify({
						name: editingVendor.name,
						aliases: (editingVendor.aliases || []).map((alias) => alias.alias),
					}),
				},
			);
			setEditingVendor(null);
			setNotice(creating ? "Продавец добавлен" : "Продавец сохранён");
			await loadSpace();
		} catch (err) {
			setNotice(
				err instanceof Error ? err.message : "Не удалось сохранить продавца",
			);
		} finally {
			setSaving(false);
		}
	};

	const deleteVendor = async () => {
		if (!editingVendor || editingVendor.id === 0) return;
		if (
			!window.confirm(
				`Удалить продавца «${editingVendor.name}»? Расходы останутся на месте.`,
			)
		)
			return;
		if (previewMode) {
			setVendors((current) =>
				current.filter((vendor) => vendor.id !== editingVendor.id),
			);
			setEditingVendor(null);
			setNotice("Продавец удалён");
			return;
		}
		setSaving(true);
		try {
			await apiRequest(
				`/spaces/${spaceID}/vendors/${editingVendor.id}`,
				token,
				{ method: "DELETE" },
			);
			setEditingVendor(null);
			setNotice("Продавец удалён, расходы сохранены");
			await loadSpace();
		} catch (err) {
			setNotice(
				err instanceof Error ? err.message : "Не удалось удалить продавца",
			);
		} finally {
			setSaving(false);
		}
	};

	const mergeVendor = async (targetVendorID: number) => {
		if (!editingVendor || editingVendor.id === 0 || !targetVendorID) return;
		const target = vendors.find((vendor) => vendor.id === targetVendorID);
		if (!target) return;
		if (
			!window.confirm(
				`Объединить «${editingVendor.name}» с «${target.name}»? Все расходы будут привязаны к «${target.name}».`,
			)
		)
			return;
		if (previewMode) {
			setVendors((current) =>
				current
					.filter((vendor) => vendor.id !== editingVendor.id)
					.map((vendor) =>
						vendor.id === targetVendorID
							? {
									...vendor,
									aliases: [
										...(vendor.aliases || []),
										{ alias: editingVendor.name },
										...(editingVendor.aliases || []),
									],
								}
							: vendor,
					),
			);
			setEditingVendor(null);
			setNotice(`Теперь это «${target.name}»`);
			return;
		}
		setSaving(true);
		try {
			await apiRequest(
				`/spaces/${spaceID}/vendors/${editingVendor.id}/merge`,
				token,
				{
					method: "POST",
					body: JSON.stringify({ target_vendor_id: targetVendorID }),
				},
			);
			setEditingVendor(null);
			setNotice(`Продавцы объединены под названием «${target.name}»`);
			await loadSpace();
		} catch (err) {
			setNotice(
				err instanceof Error ? err.message : "Не удалось объединить продавцов",
			);
		} finally {
			setSaving(false);
		}
	};

	const saveCategory = async () => {
		if (!editingCategory) return;
		const creating = editingCategory.id === 0;
		if (previewMode) {
			setCategories((current) =>
				creating
					? [
							...current,
							{
								...editingCategory,
								id: Math.max(0, ...current.map((category) => category.id)) + 1,
								key: `custom_${Date.now()}`,
							},
						]
					: current.map((category) =>
							category.id === editingCategory.id ? editingCategory : category,
						),
			);
			setEditingCategory(null);
			setNotice(creating ? "Категория добавлена" : "Категория переименована");
			return;
		}
		setSaving(true);
		try {
			const aliases = aliasesFromText(
				editingCategory.alias_text ?? editingCategory.aliases?.join(", ") ?? "",
			);
			await apiRequest(
				creating
					? `/spaces/${spaceID}/categories`
					: `/spaces/${spaceID}/categories/${editingCategory.id}`,
				token,
				{
					method: creating ? "POST" : "PUT",
					body: JSON.stringify({
						name: editingCategory.name,
						aliases,
						budget_period: editingCategory.budget_period || undefined,
						budget_amount:
							(editingCategory.budget_amount || 0) > 0
								? editingCategory.budget_amount
								: undefined,
					}),
				},
			);
			setEditingCategory(null);
			setNotice(creating ? "Категория добавлена" : "Категория переименована");
			await loadSpace();
		} catch (err) {
			setNotice(
				err instanceof Error
					? err.message
					: creating
						? "Не удалось добавить категорию"
						: "Не удалось переименовать категорию",
			);
		} finally {
			setSaving(false);
		}
	};

	const deleteCategory = async () => {
		if (!editingCategory || editingCategory.key === "other") return;
		if (
			!window.confirm(
				`Удалить «${editingCategory.name}»? Все её расходы перейдут в «Другое».`,
			)
		)
			return;
		const other = categories.find((category) => category.key === "other");
		if (previewMode) {
			setCategories((current) =>
				current.filter((category) => category.id !== editingCategory.id),
			);
			if (other) {
				setExpenses((current) =>
					current.map((expense) => ({
						...expense,
						items: expense.items.map((item) =>
							item.category_id === editingCategory.id
								? { ...item, category_id: other.id }
								: item,
						),
					})),
				);
			}
			setEditingCategory(null);
			setNotice("Категория удалена, расходы перенесены в «Другое»");
			return;
		}
		setSaving(true);
		try {
			await apiRequest(
				`/spaces/${spaceID}/categories/${editingCategory.id}`,
				token,
				{ method: "DELETE" },
			);
			setEditingCategory(null);
			setNotice("Категория удалена, расходы перенесены в «Другое»");
			await loadSpace();
		} catch (err) {
			setNotice(
				err instanceof Error ? err.message : "Не удалось удалить категорию",
			);
		} finally {
			setSaving(false);
		}
	};

	const saveProfile = async () => {
		if (!editingProfile) return;
		if (previewMode) {
			setUser(editingProfile);
			setEditingProfile(null);
			setNotice("Профиль сохранён");
			return;
		}
		setSaving(true);
		try {
			const saved = await apiRequest<User>("/auth/profile", token, {
				method: "PUT",
				body: JSON.stringify(editingProfile),
			});
			setUser(saved);
			setEditingProfile(null);
			setNotice("Профиль сохранён");
		} catch (err) {
			setNotice(
				err instanceof Error ? err.message : "Не удалось сохранить профиль",
			);
		} finally {
			setSaving(false);
		}
	};

	const saveSpace = async () => {
		if (!editingSpace) return;
		const creating = editingSpace.id === 0;
		if (previewMode) {
			const saved = creating
				? {
						...editingSpace,
						id: Math.max(0, ...spaces.map(({ id }) => id)) + 1,
					}
				: editingSpace;
			setSpaces((current) =>
				creating
					? [...current, saved]
					: current.map((space) => (space.id === saved.id ? saved : space)),
			);
			setSpaceID(saved.id);
			setEditingSpace(null);
			setNotice(creating ? "Пространство создано" : "Пространство сохранено");
			return;
		}
		setSaving(true);
		try {
			const saved = await apiRequest<Space>(
				creating ? "/spaces" : `/spaces/${editingSpace.id}`,
				token,
				{
					method: creating ? "POST" : "PATCH",
					body: JSON.stringify({
						name: editingSpace.name,
						...(creating || editingSpace.owner_user_id === user?.id
							? { currency: editingSpace.currency }
							: {}),
					}),
				},
			);
			setSpaces((current) =>
				creating
					? [...current, saved]
					: current.map((space) => (space.id === saved.id ? saved : space)),
			);
			setSpaceID(saved.id);
			setEditingSpace(null);
			setNotice(creating ? "Пространство создано" : "Пространство сохранено");
			if (!creating) await loadSpace();
		} catch (err) {
			setNotice(
				err instanceof Error
					? err.message
					: creating
						? "Не удалось создать пространство"
						: "Не удалось сохранить пространство",
			);
		} finally {
			setSaving(false);
		}
	};

	const deleteSpace = async () => {
		if (!editingSpace?.id || editingSpace.is_personal) return;
		const owned = editingSpace.owner_user_id === user?.id;
		if (
			!window.confirm(
				owned
					? `Удалить «${editingSpace.name}»? Расходы и записи будут перенесены в «Личное».`
					: `Покинуть пространство «${editingSpace.name}»?`,
			)
		)
			return;
		const remaining = spaces.filter(({ id }) => id !== editingSpace.id);
		const nextSpaceID =
			spaceID === editingSpace.id
				? remaining.find(({ is_personal }) => is_personal)?.id ||
					remaining[0]?.id ||
					0
				: spaceID;
		if (!previewMode) {
			setSaving(true);
			try {
				await apiRequest(`/spaces/${editingSpace.id}`, token, {
					method: "DELETE",
				});
			} catch (err) {
				setNotice(
					err instanceof Error
						? err.message
						: "Не удалось удалить пространство",
				);
				setSaving(false);
				return;
			}
			setSaving(false);
		}
		setSpaces(remaining);
		setSpaceID(nextSpaceID);
		if (!nextSpaceID) {
			setExpenses([]);
			setCategories([]);
			setVendors([]);
			setMembers([]);
		}
		setEditingSpace(null);
		setNotice(owned ? "Пространство удалено" : "Вы покинули пространство");
	};

	const shareSpaceInvite = async (space: Space) => {
		if (!space.id) return;
		if (previewMode) {
			setNotice("В Telegram откроется выбор чата для приглашения");
			return;
		}
		setSaving(true);
		try {
			const invite = await apiRequest<{ token: string }>(
				`/spaces/${space.id}/invites`,
				token,
				{
					method: "POST",
					body: JSON.stringify({ channel: "telegram" }),
				},
			);
			const inviteURL = `${BOT_URL}?start=invite_${invite.token}`;
			const shareURL = `https://t.me/share/url?url=${encodeURIComponent(inviteURL)}&text=${encodeURIComponent(`Присоединяйся к пространству «${space.name}» в «Пока не забыл»`)}`;
			WebApp.openTelegramLink(shareURL);
			setNotice("Приглашение готово. Оно сработает для первого получателя");
		} catch (err) {
			setNotice(
				err instanceof Error ? err.message : "Не удалось создать приглашение",
			);
		} finally {
			setSaving(false);
		}
	};

	const addExpense = () => {
		const category =
			categories.find((item) => item.key === "other") || categories[0];
		setEditingItemIndex(null);
		setEditingExpense({
			id: 0,
			user_id: user?.id || 0,
			title: "",
			payee_text: "",
			vendor_id: undefined,
			expense_date: localISODate(),
			currency,
			space_currency: currency,
			items: [{ name: "", amount: 0, category_id: category?.id }],
		});
	};

	const editExpenseItem = ({ expense, itemIndex }: ExpenseItemRow) => {
		setEditingItemIndex(itemIndex);
		setEditingExpense({
			...expense,
			items: expense.items.map((item) => ({ ...item })),
		});
	};

	if (loading && !token) return <LoadingScreen />;
	if (error && !token) return <TelegramEntry error={error} />;
	if (view === "review") {
		return (
			<div className="mini-app mini-review-app" onPointerDown={dismissKeyboard}>
				{loading ? (
					<LoadingScreen />
				) : savedReviewExpense ? (
					<ReviewSaved
						expense={savedReviewExpense}
						onClose={() => WebApp.close()}
					/>
				) : reviewDraft ? (
					<ReviewEditor
						draft={reviewDraft}
						mediaURL={reviewMediaURL}
						categories={categories}
						vendors={vendors}
						saving={saving}
						error={error}
						onChange={setReviewDraft}
						onSave={saveReview}
						onClose={() => WebApp.close()}
					/>
				) : (
					<TelegramEntry error={error || "Кандидат не найден"} />
				)}
			</div>
		);
	}

	return (
		<div className="mini-app" onPointerDown={dismissKeyboard}>
			<header className="mini-header">
				<div className="mini-brand">
					<NotePencil size={19} weight="bold" />
					<span>Пока не забыл</span>
				</div>
				{spaces.length > 1 ? (
					<select
						aria-label="Пространство"
						value={spaceID}
						onChange={(event) => setSpaceID(Number(event.target.value))}
					>
						{spaces.map((space) => (
							<option key={space.id} value={space.id}>
								{space.name}
							</option>
						))}
					</select>
				) : (
					<span className="mini-space">{activeSpace?.name}</span>
				)}
			</header>

			<main className="mini-main">
				{error && <div className="mini-alert">{error}</div>}
				{notice && (
					<button
						className="mini-toast"
						type="button"
						onClick={() => setNotice("")}
					>
						{notice}
						<X size={16} />
					</button>
				)}
				{loading ? (
					<LoadingRows />
				) : (
					<>
						{view === "overview" && (
							<Overview
								user={user}
								total={overviewTotal}
								currency={currency}
								categories={categoryTotals}
								expenses={overviewExpenses}
								captures={captures}
								onCategory={openCategory}
								onExpense={openExpense}
								onExpenses={openAllExpenses}
							/>
						)}
						{view === "expenses" && (
							<ExpensesView
								items={filteredItems}
								categories={categories}
								vendors={vendors}
								captures={captures}
								currency={currency}
								period={period}
								expense={expenses.find((expense) => expense.id === expenseID)}
								categoryID={categoryID}
								vendorID={vendorID}
								groupByExpense={groupByExpense}
								query={query}
								onPeriod={setPeriod}
								onClearExpense={() => setExpenseID(0)}
								onCategory={setCategoryID}
								onVendor={setVendorID}
								onGrouping={setGroupByExpense}
								onQuery={setQuery}
								onSource={openExpenseSource}
								onEdit={editExpenseItem}
								onAdd={addExpense}
							/>
						)}
						{view === "vendors" && (
							<VendorsView
								vendors={vendors}
								onBack={() => setView("profile")}
								onEdit={(vendor) => setEditingVendor({ ...vendor })}
								onAdd={() => setEditingVendor({ id: 0, name: "", aliases: [] })}
							/>
						)}
						{view === "categories" && (
							<CategoriesView
								categories={categories}
								currency={activeSpace?.currency || currency}
								onOpen={openCategory}
								onEdit={(category) =>
									setEditingCategory({
										...category,
										alias_text: category.aliases?.join(", ") || "",
									})
								}
								onAdd={() =>
									setEditingCategory({
										id: 0,
										key: "",
										name: "",
										count: 0,
										total: 0,
										aliases: [],
										alias_text: "",
										budget_period: "",
										budget_amount: null,
									})
								}
							/>
						)}
						{view === "spaces" && (
							<SpacesView
								spaces={spaces}
								activeSpaceID={spaceID}
								members={members}
								onSelect={setSpaceID}
								onEdit={(space) => setEditingSpace({ ...space })}
								onInvite={
									activeSpace &&
									!activeSpace.is_personal &&
									activeSpace.owner_user_id === user?.id
										? shareSpaceInvite
										: undefined
								}
								inviting={saving}
								onAdd={() =>
									setEditingSpace({
										id: 0,
										tenant_id: activeSpace?.tenant_id || 0,
										owner_user_id: user?.id || 0,
										is_personal: false,
										name: "",
										currency: user?.currency || "RUB",
									})
								}
							/>
						)}
						{view === "profile" && (
							<ProfileView
								user={user}
								quota={quota}
								vendorsCount={vendors.length}
								homeScreenStatus={homeScreenStatus}
								onInstall={installOnHomeScreen}
								onManageVendors={() => setView("vendors")}
								onEdit={() =>
									user &&
									setEditingProfile({
										...user,
										name:
											user.name || WebApp.initDataUnsafe.user?.first_name || "",
										country: user.country || "RU",
										language: user.language || "ru",
										timezone:
											user.timezone ||
											Intl.DateTimeFormat().resolvedOptions().timeZone ||
											"Europe/Moscow",
										currency: user.currency || "RUB",
										dateFormat: user.dateFormat || "DD.MM.YYYY",
									})
								}
								onUnavailable={() =>
									setNotice("Оплата подключается и пока недоступна")
								}
							/>
						)}
					</>
				)}
			</main>

			<nav className="mini-nav" aria-label="Разделы приложения">
				<NavButton
					active={view === "overview"}
					label="Главная"
					icon={<House />}
					onClick={() => setView("overview")}
				/>
				<NavButton
					active={view === "spaces"}
					label="Пространства"
					icon={<UsersThree />}
					onClick={() => setView("spaces")}
				/>
				<NavButton
					active={view === "expenses"}
					label="Расходы"
					icon={<Receipt />}
					onClick={openAllExpenses}
				/>
				<NavButton
					active={view === "categories"}
					label="Категории"
					icon={<Tag />}
					onClick={() => setView("categories")}
				/>
				<NavButton
					active={view === "profile" || view === "vendors"}
					label="Профиль"
					icon={<UserCircle />}
					onClick={() => setView("profile")}
				/>
			</nav>

			{editingExpense && editingItemIndex === null && (
				<ExpenseEditor
					expense={editingExpense}
					categories={categories}
					vendors={vendors}
					itemNameSuggestions={itemNameSuggestions}
					creating={editingExpense.id === 0}
					saving={saving}
					capture={captureForExpense(editingExpense, captures)}
					sourceLoading={sourceLoading}
					onChange={setEditingExpense}
					onClose={() => setEditingExpense(null)}
					onSave={saveExpense}
					onSource={() => openExpenseSource(editingExpense)}
					onDelete={editingExpense.id > 0 ? deleteExpense : undefined}
				/>
			)}
			{editingExpense && editingItemIndex !== null && (
				<ExpenseItemEditor
					expense={editingExpense}
					item={editingExpense.items[editingItemIndex]}
					categories={categories}
					vendors={vendors}
					saving={saving}
					capture={captureForExpense(editingExpense, captures)}
					sourceLoading={sourceLoading}
					onChange={(item) =>
						setEditingExpense({
							...editingExpense,
							items: editingExpense.items.map((current, index) =>
								index === editingItemIndex ? item : current,
							),
						})
					}
					onClose={() => {
						setEditingExpense(null);
						setEditingItemIndex(null);
					}}
					onSave={saveExpense}
					onSource={() => openExpenseSource(editingExpense)}
					onDelete={
						editingExpense.id > 0 && editingExpense.items[editingItemIndex]?.id
							? deleteExpenseItem
							: undefined
					}
				/>
			)}
			{sourceViewer && (
				<CaptureSourceViewer
					viewer={sourceViewer}
					onClose={() => setSourceViewer(null)}
				/>
			)}
			{editingVendor && (
				<VendorEditor
					vendor={editingVendor}
					saving={saving}
					onChange={setEditingVendor}
					onClose={() => setEditingVendor(null)}
					onSave={saveVendor}
					onMerge={mergeVendor}
					onDelete={deleteVendor}
					vendors={vendors}
				/>
			)}
			{editingCategory && (
				<CategoryEditor
					category={editingCategory}
					saving={saving}
					onChange={setEditingCategory}
					onClose={() => setEditingCategory(null)}
					onSave={saveCategory}
					onDelete={
						editingCategory.id > 0 && editingCategory.key !== "other"
							? deleteCategory
							: undefined
					}
				/>
			)}
			{editingProfile && (
				<ProfileEditor
					user={editingProfile}
					saving={saving}
					onChange={setEditingProfile}
					onClose={() => setEditingProfile(null)}
					onSave={saveProfile}
				/>
			)}
			{editingSpace && (
				<SpaceEditor
					space={editingSpace}
					canEditCurrency={editingSpace.owner_user_id === user?.id}
					saving={saving}
					onChange={setEditingSpace}
					onClose={() => setEditingSpace(null)}
					onSave={saveSpace}
					onInvite={
						editingSpace.id &&
						!editingSpace.is_personal &&
						editingSpace.owner_user_id === user?.id
							? () => shareSpaceInvite(editingSpace)
							: undefined
					}
					onDelete={
						editingSpace.id && !editingSpace.is_personal
							? deleteSpace
							: undefined
					}
				/>
			)}
		</div>
	);
};

const reviewDraftFromCandidate = (
	candidate: ReviewCandidate,
	candidates: ReviewCandidate[],
): ReviewDraft => {
	const data = candidate.structured_data || {};
	const rawItems = Array.isArray(data.items)
		? data.items
		: candidates
				.filter(
					(item) =>
						item.source_document_id === candidate.source_document_id &&
						item.candidate_type === "expense_item_candidate",
				)
				.map((item) => ({ ...item.structured_data, name: item.title }));
	const sourceCurrency =
		readString(data, "source_currency", "currency") || "RUB";
	const itemExpenseDate = rawItems
		.map((raw) => readString(objectValue(raw), "expense_date", "date"))
		.find(Boolean);
	return {
		candidateID: candidate.id,
		sourceDocumentID: candidate.source_document_id,
		title:
			candidate.title ||
			readString(data, "title", "description", "merchant_name") ||
			"Расход",
		payeeText: readString(
			data,
			"payee_text",
			"merchant_name",
			"merchant",
			"vendor_name",
		),
		expenseDate:
			readString(data, "expense_date", "date", "document_date").slice(0, 10) ||
			itemExpenseDate?.slice(0, 10) ||
			localISODate(),
		sourceCurrency,
		items: rawItems.map((raw, index) => {
			const item = objectValue(raw);
			return {
				key: `${candidate.id}-${index}`,
				name: readString(item, "name", "title", "description") || "Позиция",
				amount: readNumber(item, "source_amount", "amount", "price"),
				category_key: readString(item, "category_key", "category") || "other",
				vendor_name:
					readString(item, "vendor_name", "merchant_name", "merchant") ||
					readString(data, "payee_text", "merchant_name", "merchant"),
				notes: readString(item, "notes"),
			};
		}),
	};
};

const objectValue = (value: unknown): Record<string, unknown> =>
	value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const readString = (value: Record<string, unknown>, ...keys: string[]) => {
	for (const key of keys) {
		if (typeof value[key] === "string" && value[key].trim())
			return value[key].trim();
	}
	return "";
};

const readNumber = (value: Record<string, unknown>, ...keys: string[]) => {
	for (const key of keys) {
		const parsed = Number(value[key]);
		if (Number.isFinite(parsed) && parsed > 0) return parsed;
	}
	return 0;
};

const AmountInput = ({
	amount,
	ariaLabel,
	id,
	onChange,
}: {
	amount: number;
	ariaLabel: string;
	id?: string;
	onChange: (amount: number) => void;
}) => {
	const [value, setValue] = useState(() => (amount > 0 ? String(amount) : ""));
	return (
		<input
			aria-label={ariaLabel}
			id={id}
			inputMode="decimal"
			value={value}
			onChange={(event) => {
				const next = event.target.value.replace(",", ".");
				if (!/^\d*(?:\.\d{0,2})?$/.test(next)) return;
				setValue(next);
				onChange(next === "" || next === "." ? 0 : Number(next));
			}}
		/>
	);
};

const reviewExpenseFromDraft = (
	draft: ReviewDraft,
	currency: string,
): Expense => ({
	id: Date.now(),
	user_id: 1,
	title: draft.title,
	payee_text: draft.payeeText,
	expense_date: draft.expenseDate,
	currency,
	items: draft.items.map((item, index) => ({
		id: index + 1,
		name: item.name,
		amount: item.amount,
		vendor_name: item.vendor_name,
	})),
});

const VendorAutocomplete = ({
	vendors,
	value,
	onChange,
	placeholder,
	ariaLabel,
	className,
}: {
	vendors: Vendor[];
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	ariaLabel?: string;
	className?: string;
}) => {
	const listID = useId();
	const [open, setOpen] = useState(false);
	const [activeIndex, setActiveIndex] = useState(-1);
	const suggestions = vendorSuggestions(vendors, value);
	const selectVendor = (vendor: Vendor) => {
		onChange(vendor.name);
		setOpen(false);
		setActiveIndex(-1);
	};

	return (
		<div className={`vendor-autocomplete${className ? ` ${className}` : ""}`}>
			<input
				role="combobox"
				aria-label={ariaLabel}
				aria-autocomplete="list"
				aria-expanded={open && suggestions.length > 0}
				aria-controls={listID}
				aria-activedescendant={
					activeIndex >= 0 ? `${listID}-option-${activeIndex}` : undefined
				}
				placeholder={placeholder}
				value={value}
				onFocus={() => setOpen(true)}
				onBlur={() => window.setTimeout(() => setOpen(false), 100)}
				onChange={(event) => {
					onChange(event.target.value);
					setOpen(true);
					setActiveIndex(-1);
				}}
				onKeyDown={(event) => {
					if (event.key === "Escape") {
						setOpen(false);
						return;
					}
					if (
						suggestions.length > 0 &&
						(event.key === "ArrowDown" || event.key === "ArrowUp")
					) {
						event.preventDefault();
						setOpen(true);
						setActiveIndex((current) => {
							const direction = event.key === "ArrowDown" ? 1 : -1;
							return (
								(current + direction + suggestions.length) % suggestions.length
							);
						});
					}
					if (event.key === "Enter" && activeIndex >= 0) {
						event.preventDefault();
						selectVendor(suggestions[activeIndex]);
					}
				}}
			/>
			{open && suggestions.length > 0 && (
				<div
					id={listID}
					className="vendor-autocomplete-list"
					role="listbox"
					tabIndex={-1}
				>
					{suggestions.map((vendor, index) => (
						<div
							id={`${listID}-option-${index}`}
							key={vendor.id}
							className={index === activeIndex ? "active" : undefined}
							role="option"
							aria-selected={index === activeIndex}
							tabIndex={-1}
							onPointerDown={(event) => event.preventDefault()}
							onClick={() => selectVendor(vendor)}
							onKeyDown={(event) => {
								if (event.key === "Enter" || event.key === " ")
									selectVendor(vendor);
							}}
						>
							<b>{vendor.name}</b>
							{vendor.aliases?.length ? (
								<small>
									{vendor.aliases.map((alias) => alias.alias).join(", ")}
								</small>
							) : null}
						</div>
					))}
				</div>
			)}
		</div>
	);
};

const ReviewEditor = ({
	draft,
	mediaURL,
	categories,
	vendors,
	saving,
	error,
	onChange,
	onSave,
	onClose,
}: {
	draft: ReviewDraft;
	mediaURL: string;
	categories: Category[];
	vendors: Vendor[];
	saving: boolean;
	error: string;
	onChange: (draft: ReviewDraft) => void;
	onSave: () => void;
	onClose: () => void;
}) => {
	const total = draft.items.reduce((sum, item) => sum + Number(item.amount), 0);
	const sharedVendorName = commonVendorName(
		draft.items.map((item) => item.vendor_name),
	);
	const applyItems = (items: ReviewDraftItem[]) => {
		const commonName = commonVendorName(items.map((item) => item.vendor_name));
		onChange({ ...draft, payeeText: commonName ?? "", items });
	};
	const invalid =
		!draft.title.trim() ||
		draft.items.length === 0 ||
		draft.items.some((item) => !item.name.trim() || item.amount <= 0);
	return (
		<main className="review-shell">
			<header className="review-topbar">
				<button type="button" aria-label="Закрыть" onClick={onClose}>
					<X size={22} />
				</button>
				<div>
					<span>Пока не забыл</span>
					<b>Проверьте расход</b>
				</div>
				<span className="review-currency">{draft.sourceCurrency}</span>
			</header>

			{mediaURL && (
				<figure className="review-source">
					<img src={mediaURL} alt="Исходный чек" />
					<figcaption>Исходный чек</figcaption>
				</figure>
			)}

			<section className="review-paper">
				<label className="review-field review-field--title">
					<span>Название</span>
					<input
						value={draft.title}
						onChange={(event) =>
							onChange({ ...draft, title: event.target.value })
						}
					/>
				</label>
				<div className="review-meta">
					<div className="review-field">
						<span>Где покупали</span>
						<VendorAutocomplete
							vendors={vendors}
							ariaLabel="Где покупали"
							placeholder={
								sharedVendorName === null ? "Разные продавцы" : "Не определён"
							}
							value={sharedVendorName ?? ""}
							onChange={(vendorName) => {
								onChange({
									...draft,
									payeeText: vendorName,
									items: draft.items.map((item) => ({
										...item,
										vendor_name: vendorName,
									})),
								});
							}}
						/>
						<small className="review-field-hint">
							Изменение применится ко всем позициям
						</small>
					</div>
					<label className="review-field">
						<span>Дата</span>
						<input
							type="date"
							value={draft.expenseDate}
							onChange={(event) =>
								onChange({ ...draft, expenseDate: event.target.value })
							}
						/>
					</label>
				</div>

				<div className="review-lines-head">
					<h2>Позиции</h2>
					<span>{draft.items.length}</span>
				</div>
				<div className="review-lines">
					{draft.items.map((item, index) => (
						<article key={item.key} className="review-line">
							<div className="review-line-number">{index + 1}</div>
							<input
								aria-label={`Название позиции ${index + 1}`}
								value={item.name}
								onChange={(event) =>
									onChange({
										...draft,
										items: draft.items.map((current, itemIndex) =>
											itemIndex === index
												? { ...current, name: event.target.value }
												: current,
										),
									})
								}
							/>
							<div className="review-line-controls">
								<AmountInput
									ariaLabel={`Цена позиции ${index + 1}`}
									amount={item.amount}
									onChange={(amount) =>
										onChange({
											...draft,
											items: draft.items.map((current, itemIndex) =>
												itemIndex === index ? { ...current, amount } : current,
											),
										})
									}
								/>
								<span>{draft.sourceCurrency}</span>
							</div>
							<select
								aria-label={`Категория позиции ${index + 1}`}
								value={item.category_key || "other"}
								onChange={(event) =>
									onChange({
										...draft,
										items: draft.items.map((current, itemIndex) =>
											itemIndex === index
												? { ...current, category_key: event.target.value }
												: current,
										),
									})
								}
							>
								{categories.map((category) => (
									<option key={category.id} value={category.key}>
										{category.name}
									</option>
								))}
							</select>
							<VendorAutocomplete
								className="review-line-vendor"
								vendors={vendors}
								ariaLabel={`Где купили позицию ${index + 1}`}
								placeholder="Где купили"
								value={item.vendor_name}
								onChange={(vendorName) => {
									applyItems(
										draft.items.map((current, itemIndex) =>
											itemIndex === index
												? {
														...current,
														vendor_name: vendorName,
													}
												: current,
										),
									);
								}}
							/>
							<button
								type="button"
								aria-label={`Удалить позицию ${index + 1}`}
								onClick={() =>
									applyItems(
										draft.items.filter((_, itemIndex) => itemIndex !== index),
									)
								}
							>
								<Trash size={17} />
							</button>
						</article>
					))}
				</div>
				<button
					className="review-add-line"
					type="button"
					onClick={() =>
						onChange({
							...draft,
							items: [
								...draft.items,
								{
									key: crypto.randomUUID(),
									name: "",
									amount: 0,
									category_key: "other",
									vendor_name: sharedVendorName ?? "",
									notes: "",
								},
							],
						})
					}
				>
					<Plus size={17} weight="bold" /> Добавить позицию
				</button>
				<div className="review-total-row">
					<span>Итого</span>
					<strong>{formatMoney(total, draft.sourceCurrency)}</strong>
				</div>
				{error && <div className="mini-alert">{error}</div>}
			</section>
			<footer className="review-actions">
				<button type="button" disabled={saving || invalid} onClick={onSave}>
					{saving ? "Сохраняем…" : "Сохранить расход"}
				</button>
			</footer>
		</main>
	);
};

const ReviewSaved = ({
	expense,
	onClose,
}: { expense: Expense; onClose: () => void }) => (
	<main className="review-saved">
		<div className="review-saved-mark">
			<Check size={34} weight="bold" />
		</div>
		<p>Готово</p>
		<h1>Расход сохранён</h1>
		<article>
			<header>
				<span>{expenseSellerName(expense)}</span>
				<small>{formatDate(expense.expense_date)}</small>
			</header>
			{expense.items.map((item) => (
				<div key={item.id || item.name}>
					<span>{item.name}</span>
					<b>{formatMoney(item.amount, expense.currency)}</b>
				</div>
			))}
			<footer>
				<span>Итого</span>
				<strong>
					{formatMoney(
						expense.items.reduce((sum, item) => sum + item.amount, 0),
						expense.currency,
					)}
				</strong>
			</footer>
		</article>
		<button type="button" onClick={onClose}>
			Закрыть
		</button>
	</main>
);

const Overview = ({
	user,
	total,
	currency,
	categories,
	expenses,
	captures,
	onCategory,
	onExpense,
	onExpenses,
}: {
	user: User | null;
	total: number;
	currency: string;
	categories: Array<Category & { filteredTotal: number }>;
	expenses: Expense[];
	captures: CapturePacket[];
	onCategory: (id: number) => void;
	onExpense: (id: number) => void;
	onExpenses: () => void;
}) => {
	const max = categories[0]?.filteredTotal || 1;
	return (
		<section className="mini-view">
			<div className="mini-title">
				<p>Привет{user?.name ? `, ${user.name.split(" ")[0]}` : ""}</p>
				<h1>Все расходы</h1>
			</div>
			<div className="mini-total">
				<span>Всего</span>
				<strong>{formatMoney(total, currency)}</strong>
				<small>
					{expenses.length} {expenseWord(expenses.length)}
				</small>
			</div>
			<div className="mini-section-head">
				<h2>По категориям</h2>
				<ChartDonut size={20} />
			</div>
			<div className="mini-category-bars">
				{categories.slice(0, 5).map((category) => (
					<button
						key={category.id}
						type="button"
						onClick={() => onCategory(category.id)}
					>
						<span>
							<b>{category.name}</b>
							<em>{formatMoney(category.filteredTotal, currency)}</em>
						</span>
						<i
							style={{
								width: `${Math.max(8, (category.filteredTotal / max) * 100)}%`,
							}}
						/>
					</button>
				))}
				{categories.length === 0 && (
					<Empty text="В этом пространстве пока нет расходов" />
				)}
			</div>
			<div className="mini-section-head">
				<h2>Последние</h2>
				<button type="button" onClick={onExpenses}>
					Все
				</button>
			</div>
			<ExpenseList
				expenses={expenses.slice(0, 4)}
				captures={captures}
				currency={currency}
				onEdit={(expense) => onExpense(expense.id)}
			/>
		</section>
	);
};

const ExpensesView = ({
	items,
	categories,
	vendors,
	captures,
	currency,
	period,
	expense,
	categoryID,
	vendorID,
	groupByExpense,
	query,
	onPeriod,
	onClearExpense,
	onCategory,
	onVendor,
	onGrouping,
	onQuery,
	onSource,
	onEdit,
	onAdd,
}: {
	items: ExpenseItemRow[];
	categories: Category[];
	vendors: Vendor[];
	captures: CapturePacket[];
	currency: string;
	period: Period;
	expense?: Expense;
	categoryID: number;
	vendorID: number;
	groupByExpense: boolean;
	query: string;
	onPeriod: (period: Period) => void;
	onClearExpense: () => void;
	onCategory: (id: number) => void;
	onVendor: (id: number) => void;
	onGrouping: (group: boolean) => void;
	onQuery: (value: string) => void;
	onSource: (expense: Expense) => void;
	onEdit: (item: ExpenseItemRow) => void;
	onAdd: () => void;
}) => (
	<section className="mini-view">
		<div className="mini-title-row">
			<div className="mini-title">
				<p>История</p>
				<h1>Расходы</h1>
			</div>
			<button className="mini-add-button" type="button" onClick={onAdd}>
				<Plus size={18} weight="bold" />
				Добавить
			</button>
		</div>
		<label className="mini-search">
			<MagnifyingGlass size={19} />
			<input
				value={query}
				onChange={(event) => onQuery(event.target.value)}
				placeholder="Магазин или покупка"
			/>
		</label>
		{expense && (
			<div className="mini-expense-scope">
				<span>
					<small>Выбран расход</small>
					<b>{expense.title || expense.items[0]?.name || "Расход"}</b>
				</span>
				<div className="mini-expense-scope-actions">
					<button type="button" onClick={() => onSource(expense)}>
						<SourceIcon
							capture={captureForExpense(expense, captures)}
							size={15}
						/>
						Исходник
					</button>
					<button type="button" onClick={onClearExpense}>
						<X size={15} />
						Все
					</button>
				</div>
			</div>
		)}
		<div className="mini-result">
			<div>
				<small>Найдено</small>
				<span>
					{items.length} {itemWord(items.length)}
				</span>
			</div>
			<div>
				<small>Итого</small>
				<strong>
					{formatMoney(
						items.reduce(
							(sum, row) =>
								sum +
								(itemAmountInCurrency(row.item, row.expense, currency) ?? 0),
							0,
						),
						currency,
					)}
				</strong>
			</div>
		</div>
		<div className="mini-filters mini-filters--three">
			<select
				aria-label="Период"
				value={period}
				onChange={(event) => onPeriod(event.target.value as Period)}
			>
				<option value="today">Сегодня</option>
				<option value="three-days">3 дня</option>
				<option value="week">Неделя</option>
				<option value="month">Этот месяц</option>
				<option value="three-months">3 месяца</option>
				<option value="six-months">6 месяцев</option>
				<option value="year">Этот год</option>
				<option value="all">Всё время</option>
			</select>
			<select
				aria-label="Категория"
				value={categoryID}
				onChange={(event) => onCategory(Number(event.target.value))}
			>
				<option value={0}>Все категории</option>
				{categories.map((category) => (
					<option key={category.id} value={category.id}>
						{category.name}
					</option>
				))}
			</select>
			<select
				aria-label="Где купили"
				value={vendorID}
				onChange={(event) => onVendor(Number(event.target.value))}
			>
				<option value={0}>Все продавцы</option>
				{vendors.map((vendor) => (
					<option key={vendor.id} value={vendor.id}>
						{vendor.name}
					</option>
				))}
			</select>
		</div>
		<div className="mini-expense-mode" role="group" aria-label="Вид расходов">
			<button
				className={!groupByExpense ? "active" : ""}
				type="button"
				aria-pressed={!groupByExpense}
				onClick={() => onGrouping(false)}
			>
				Позиции
			</button>
			<button
				className={groupByExpense ? "active" : ""}
				type="button"
				aria-pressed={groupByExpense}
				onClick={() => onGrouping(true)}
			>
				По расходам
			</button>
		</div>
		{groupByExpense ? (
			<GroupedExpenseItemList
				items={items}
				categories={categories}
				captures={captures}
				currency={currency}
				onSource={onSource}
				onEdit={onEdit}
			/>
		) : (
			<ExpenseItemList
				items={items}
				categories={categories}
				captures={captures}
				currency={currency}
				onEdit={onEdit}
			/>
		)}
	</section>
);

const ExpenseItemList = ({
	items,
	categories,
	captures,
	currency,
	onEdit,
}: {
	items: ExpenseItemRow[];
	categories: Category[];
	captures: CapturePacket[];
	currency: string;
	onEdit: (item: ExpenseItemRow) => void;
}) => (
	<div className="mini-expenses">
		{items.map((row) => {
			const money = itemDisplayMoney(row.item, row.expense, currency);
			const seller = expenseItemSellerName(row.item, row.expense);
			const category =
				row.item.category_name ||
				row.item.category?.name ||
				categories.find((current) => current.id === row.item.category_id)
					?.name ||
				"Другое";
			const capture = captureForExpense(row.expense, captures);
			return (
				<button
					key={`${row.expense.id}-${row.item.id || row.itemIndex}`}
					type="button"
					onClick={() => onEdit(row)}
				>
					<span className="mini-expense-icon">
						<SourceIcon capture={capture} size={19} />
					</span>
					<span className="mini-expense-copy">
						<b>{row.item.name || "Покупка"}</b>
						<small>
							<span className="mini-vendor-chip">{seller}</span>
							{category}
						</small>
					</span>
					<span className="mini-expense-amount">
						<b>{formatMoney(money.amount, money.currency)}</b>
						<small>{formatDate(row.expense.expense_date)}</small>
					</span>
				</button>
			);
		})}
		{items.length === 0 && <Empty text="Ничего не найдено" />}
	</div>
);

const GroupedExpenseItemList = ({
	items,
	categories,
	captures,
	currency,
	onSource,
	onEdit,
}: {
	items: ExpenseItemRow[];
	categories: Category[];
	captures: CapturePacket[];
	currency: string;
	onSource: (expense: Expense) => void;
	onEdit: (item: ExpenseItemRow) => void;
}) => {
	const groups = groupRowsByExpense(items);
	return (
		<div className="mini-expense-groups">
			{groups.map((rows) => {
				const expense = rows[0].expense;
				const total = rows.reduce(
					(sum, row) =>
						sum + (itemAmountInCurrency(row.item, row.expense, currency) ?? 0),
					0,
				);
				return (
					<section key={expense.id}>
						<header>
							<span>
								<b>{expense.title || rows[0].item.name || "Расход"}</b>
								<small>
									{formatDate(expense.expense_date)} · {rows.length}{" "}
									{itemWord(rows.length)}
								</small>
							</span>
							<div className="mini-expense-group-actions">
								<button
									type="button"
									aria-label="Открыть исходный материал"
									onClick={() => onSource(expense)}
								>
									<SourceIcon
										capture={captureForExpense(expense, captures)}
										size={17}
									/>
								</button>
								<strong>{formatMoney(total, currency)}</strong>
							</div>
						</header>
						<ExpenseItemList
							items={rows}
							categories={categories}
							captures={captures}
							currency={currency}
							onEdit={onEdit}
						/>
					</section>
				);
			})}
			{groups.length === 0 && <Empty text="Ничего не найдено" />}
		</div>
	);
};

const ExpenseList = ({
	expenses,
	captures,
	currency,
	onEdit,
}: {
	expenses: Expense[];
	captures: CapturePacket[];
	currency: string;
	onEdit: (expense: Expense) => void;
}) => (
	<div className="mini-expenses">
		{expenses.map((expense) => {
			const money = expenseDisplayMoney(expense, currency);
			const seller = expenseSellerName(expense);
			const capture = captureForExpense(expense, captures);
			return (
				<button key={expense.id} type="button" onClick={() => onEdit(expense)}>
					<span className="mini-expense-icon">
						<SourceIcon capture={capture} size={19} />
					</span>
					<span className="mini-expense-copy">
						<b>{expense.title || expense.items[0]?.name || "Расход"}</b>
						<small>
							<span className="mini-vendor-chip">{seller}</span>
							{expense.items
								.map((item) => item.name)
								.slice(0, 2)
								.join(", ") || formatDate(expense.expense_date)}
						</small>
					</span>
					<span className="mini-expense-amount">
						<b>{formatMoney(money.amount, money.currency)}</b>
						<small>{formatDate(expense.expense_date)}</small>
					</span>
				</button>
			);
		})}
		{expenses.length === 0 && <Empty text="Ничего не найдено" />}
	</div>
);

const SourceIcon = ({
	capture,
	size,
}: {
	capture?: CapturePacket;
	size: number;
}) => {
	const kind = captureSourceKind(capture);
	const label =
		kind === "image"
			? "Источник: фото"
			: kind === "voice"
				? "Источник: голосовое сообщение"
				: kind === "text"
					? "Источник: текст"
					: "Источник не указан";
	switch (kind) {
		case "image":
			return <Camera size={size} aria-label={label} />;
		case "voice":
			return <Microphone size={size} aria-label={label} />;
		case "text":
			return <ChatCircleText size={size} aria-label={label} />;
		default:
			return <Receipt size={size} aria-label={label} />;
	}
};

const captureSourceLabel = (capture: CapturePacket) => {
	switch (captureSourceKind(capture)) {
		case "image":
			return "Фото";
		case "voice":
			return "Голосовое сообщение";
		default:
			return "Текстовое сообщение";
	}
};

const CaptureSourceViewer = ({
	viewer,
	onClose,
}: {
	viewer: SourceViewer;
	onClose: () => void;
}) => {
	const kind = captureSourceKind(viewer.capture);
	return (
		<Modal title="Исходный материал" onClose={onClose}>
			<div className="mini-source-summary">
				<span>
					<SourceIcon capture={viewer.capture} size={22} />
				</span>
				<div>
					<b>{captureSourceLabel(viewer.capture)}</b>
					{viewer.capture.created_at && (
						<small>{formatDate(viewer.capture.created_at)}</small>
					)}
				</div>
			</div>
			{kind === "image" && viewer.mediaURL && (
				<img
					className="mini-source-image"
					src={viewer.mediaURL}
					alt="Исходное изображение расхода"
				/>
			)}
			{kind === "voice" && viewer.mediaURL && (
				<>
					{/* biome-ignore lint/a11y/useMediaCaption: transcript is rendered below when the provider returned one. */}
					<audio className="mini-source-audio" controls src={viewer.mediaURL} />
				</>
			)}
			{viewer.capture.source_text && (
				<div className="mini-source-text">
					<small>
						{kind === "text" ? "Исходный текст" : "Распознанный текст"}
					</small>
					<p>{viewer.capture.source_text}</p>
				</div>
			)}
			{!viewer.mediaURL && !viewer.capture.source_text && (
				<Empty text="Исходный материал недоступен" />
			)}
		</Modal>
	);
};

const expenseSellerName = (expense: Expense) =>
	expense.vendor_name ||
	expense.vendor?.name ||
	expense.items.find((item) => item.vendor_name || item.vendor?.name)
		?.vendor_name ||
	expense.items.find((item) => item.vendor?.name)?.vendor?.name ||
	expense.payee_text ||
	"Место покупки не указано";

const expenseItemSellerName = (item: ExpenseItem, expense: Expense) =>
	item.vendor_name ||
	item.vendor?.name ||
	expense.vendor_name ||
	expense.vendor?.name ||
	expense.payee_text ||
	"Место покупки не указано";

const expenseItemRows = (expenses: Expense[]): ExpenseItemRow[] =>
	expenses.flatMap((expense) =>
		expense.items.map((item, itemIndex) => ({ expense, item, itemIndex })),
	);

const CategoriesView = ({
	categories,
	currency,
	onOpen,
	onEdit,
	onAdd,
}: {
	categories: Category[];
	currency: string;
	onOpen: (id: number) => void;
	onEdit: (category: Category) => void;
	onAdd: () => void;
}) => (
	<section className="mini-view">
		<div className="mini-title-row">
			<div className="mini-title">
				<p>Порядок в расходах</p>
				<h1>Категории</h1>
			</div>
			<button className="mini-add-button" type="button" onClick={onAdd}>
				<Plus size={18} weight="bold" />
				Добавить
			</button>
		</div>
		<p className="mini-intro">Нажмите категорию, чтобы открыть её расходы.</p>
		<div className="mini-categories">
			{categories.map((category) => (
				<article key={category.id}>
					<button
						className="mini-category-open"
						type="button"
						onClick={() => onOpen(category.id)}
					>
						<span className="mini-category-dot" />
						<span>
							<b>{category.name}</b>
							<small>
								{category.budget_amount
									? `Осталось ${formatMoney(category.budget_remaining || 0, currency)} · ${category.budget_period === "week" ? "на неделю" : "на месяц"}`
									: category.last_used
										? `Последний расход ${formatDate(category.last_used)}`
										: "Пока не использовалась"}
							</small>
							{category.budget_amount && (
								<span className="mini-category-budget">
									<i
										style={{
											width: `${Math.min(100, category.budget_percent || 0)}%`,
										}}
									/>
								</span>
							)}
						</span>
					</button>
					<button
						className="mini-icon-button"
						type="button"
						aria-label={`Переименовать ${category.name}`}
						onClick={() => onEdit(category)}
					>
						<PencilSimple size={18} />
					</button>
				</article>
			))}
		</div>
	</section>
);

const VendorsView = ({
	vendors,
	onBack,
	onEdit,
	onAdd,
}: {
	vendors: Vendor[];
	onBack: () => void;
	onEdit: (vendor: Vendor) => void;
	onAdd: () => void;
}) => (
	<section className="mini-view">
		<div className="mini-title-row">
			<div className="mini-title">
				<button className="mini-back-link" type="button" onClick={onBack}>
					Профиль
				</button>
				<h1>Продавцы</h1>
			</div>
			<button className="mini-add-button" type="button" onClick={onAdd}>
				<Plus size={18} weight="bold" />
				Добавить
			</button>
		</div>
		<p className="mini-intro">
			Объединяйте название магазина и юридическое имя из чека.
		</p>
		<div className="mini-vendors">
			{vendors.map((vendor) => (
				<button key={vendor.id} type="button" onClick={() => onEdit(vendor)}>
					<span className="mini-expense-icon">
						<Storefront size={19} />
					</span>
					<span>
						<b>{vendor.name}</b>
						<small>
							{vendor.aliases?.map((alias) => alias.alias).join(", ") ||
								"Псевдонимов пока нет"}
						</small>
					</span>
					<PencilSimple size={18} />
				</button>
			))}
			{vendors.length === 0 && <Empty text="Продавцов пока нет" />}
		</div>
	</section>
);

const SpacesView = ({
	spaces,
	activeSpaceID,
	members,
	onSelect,
	onEdit,
	onInvite,
	inviting,
	onAdd,
}: {
	spaces: Space[];
	activeSpaceID: number;
	members: SpaceMember[];
	onSelect: (id: number) => void;
	onEdit: (space: Space) => void;
	onInvite?: (space: Space) => void;
	inviting: boolean;
	onAdd: () => void;
}) => {
	const activeSpace = spaces.find((space) => space.id === activeSpaceID);
	return (
		<section className="mini-view">
			<div className="mini-title-row">
				<div className="mini-title">
					<p>Личные и общие</p>
					<h1>Пространства</h1>
				</div>
				<button className="mini-add-button" type="button" onClick={onAdd}>
					<Plus size={18} weight="bold" />
					Добавить
				</button>
			</div>
			<div className="mini-spaces">
				{spaces.map((space) => (
					<article
						className={space.id === activeSpaceID ? "active" : ""}
						key={space.id}
					>
						<button type="button" onClick={() => onSelect(space.id)}>
							<span>
								<b>{space.name}</b>
								<small>{space.currency}</small>
							</span>
							{space.id === activeSpaceID && <Check size={18} weight="bold" />}
						</button>
						<button
							className="mini-icon-button"
							type="button"
							aria-label={`Настроить ${space.name}`}
							onClick={() => onEdit(space)}
						>
							<GearSix size={19} />
						</button>
					</article>
				))}
			</div>
			{spaces.length === 0 && <Empty text="Создайте первое пространство" />}
			<div className="mini-section-head">
				<h2>Участники · {members.length}</h2>
				{onInvite && activeSpace && (
					<button
						type="button"
						disabled={inviting}
						onClick={() => onInvite(activeSpace)}
					>
						<PaperPlaneTilt size={17} weight="bold" />
						Пригласить
					</button>
				)}
			</div>
			<div className="mini-members">
				{members.map((member) => (
					<div key={member.user_id}>
						<span>{(member.name || "У").slice(0, 1).toUpperCase()}</span>
						<p>
							<b>{member.name || "Пользователь"}</b>
							<small>{memberRole(member.role)}</small>
						</p>
					</div>
				))}
			</div>
		</section>
	);
};

const ProfileView = ({
	user,
	quota,
	vendorsCount,
	homeScreenStatus,
	onEdit,
	onManageVendors,
	onInstall,
	onUnavailable,
}: {
	user: User | null;
	quota: Quota | null;
	vendorsCount: number;
	homeScreenStatus: HomeScreenStatus;
	onEdit: () => void;
	onManageVendors: () => void;
	onInstall: () => void;
	onUnavailable: () => void;
}) => {
	const used = quota?.used || 0;
	const limit = quota?.limit || 0;
	const progress = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
	const plus = ["medium", "plus"].includes(quota?.plan || "");
	const installDisabled = ["checking", "unsupported", "added"].includes(
		homeScreenStatus,
	);
	const installStatus =
		homeScreenStatus === "checking"
			? "Проверяем"
			: homeScreenStatus === "unsupported"
				? "Недоступно"
				: homeScreenStatus === "added"
					? "Добавлено"
					: "Добавить";
	return (
		<section className="mini-view">
			<div className="mini-profile-head">
				<span>{(user?.name || "П").slice(0, 1).toUpperCase()}</span>
				<div>
					<h1>{user?.name || "Пользователь"}</h1>
					<p>
						{user?.telegramUsername ? `@${user.telegramUsername}` : "Telegram"}
					</p>
				</div>
				<button type="button" aria-label="Изменить профиль" onClick={onEdit}>
					<PencilSimple size={19} />
				</button>
			</div>
			<div className="mini-plan">
				<div>
					<span>Ваш тариф</span>
					<strong>{plus ? "Плюс" : "Базовый"}</strong>
				</div>
				<b>{plus ? "249 ₽ / 30 дней" : "0 ₽"}</b>
				<div className="mini-progress">
					<i style={{ width: `${progress}%` }} />
				</div>
				<p>
					<span>
						Использовано {used} из {limit}
					</span>
					<span>Осталось {quota?.remaining ?? limit}</span>
				</p>
			</div>
			<div className="mini-profile-actions">
				<button type="button" onClick={onUnavailable}>
					{plus ? "Продлить подписку" : "Подключить Плюс"}
				</button>
				<button className="secondary" type="button" onClick={onUnavailable}>
					Докупить пакет
				</button>
			</div>
			<div className="mini-profile-list">
				<div>
					<span>Валюта</span>
					<b>{user?.currency || "RUB"}</b>
				</div>
				<div>
					<span>Страна</span>
					<b>{countryName(user?.country || "RU")}</b>
				</div>
				<div>
					<span>Часовой пояс</span>
					<b>{timezoneName(user?.timezone || "Europe/Moscow")}</b>
				</div>
				<button type="button" onClick={onManageVendors}>
					<span>
						<Storefront size={18} />
						Продавцы и названия
					</span>
					<b>{vendorsCount}</b>
				</button>
				<button type="button" onClick={onInstall} disabled={installDisabled}>
					<span>
						<House size={18} />
						Ярлык на экран телефона
					</span>
					<b>{installStatus}</b>
				</button>
			</div>
		</section>
	);
};

const ExpenseEditor = ({
	expense,
	categories,
	vendors,
	itemNameSuggestions,
	creating,
	saving,
	capture,
	sourceLoading,
	onChange,
	onClose,
	onSave,
	onSource,
	onDelete,
}: {
	expense: Expense;
	categories: Category[];
	vendors: Vendor[];
	itemNameSuggestions: string[];
	creating: boolean;
	saving: boolean;
	capture?: CapturePacket;
	sourceLoading: boolean;
	onChange: (expense: Expense) => void;
	onClose: () => void;
	onSave: () => void;
	onSource: () => void;
	onDelete?: () => void;
}) => {
	const itemNameListID = useId();
	const fallbackVendorName = vendorFieldValue(
		expense.vendor_name,
		expense.payee_text,
		expense.vendor?.name,
		vendors.find((vendor) => vendor.id === expense.vendor_id)?.name,
	);
	const itemVendorName = (item: ExpenseItem) =>
		vendorFieldValue(
			item.vendor_name,
			item.vendor?.name,
			vendors.find((vendor) => vendor.id === item.vendor_id)?.name,
			fallbackVendorName,
		);
	const sharedVendorName = commonVendorName(expense.items.map(itemVendorName));
	const updateItemVendor = (index: number, vendorName: string) => {
		const items = expense.items.map((item, itemIndex) =>
			itemIndex === index
				? {
						...item,
						vendor_id: undefined,
						vendor_name: vendorName,
						vendor: undefined,
					}
				: item,
		);
		const commonName = commonVendorName(items.map(itemVendorName));
		const commonVendor = commonName
			? findVendorByName(vendors, commonName)
			: undefined;
		onChange({
			...expense,
			payee_text: commonName ?? "",
			vendor_name: commonName ?? "",
			vendor_id: commonVendor?.id,
			vendor: commonVendor,
			items,
		});
	};

	return (
		<Modal
			title={creating ? "Новый расход" : "Редактировать расход"}
			onClose={onClose}
		>
			{expense.source_document_id && (
				<button
					className="mini-source-open"
					type="button"
					disabled={sourceLoading}
					onClick={onSource}
				>
					<SourceIcon capture={capture} size={18} />
					{sourceLoading ? "Загружаем…" : "Посмотреть исходник"}
				</button>
			)}
			<label>
				{creating ? "На что потратили" : "Название"}
				<input
					list={itemNameListID}
					value={expense.title}
					onChange={(event) =>
						onChange({
							...expense,
							title: event.target.value,
							items: creating
								? expense.items.map((item, index) =>
										index === 0 ? { ...item, name: event.target.value } : item,
									)
								: expense.items,
						})
					}
				/>
				<datalist id={itemNameListID}>
					{itemNameSuggestions.map((name) => (
						<option key={name} value={name} />
					))}
				</datalist>
			</label>
			<div className="mini-field">
				<span>Где покупали</span>
				<VendorAutocomplete
					vendors={vendors}
					ariaLabel="Где покупали"
					placeholder={
						sharedVendorName === null ? "Разные продавцы" : "Не определён"
					}
					value={sharedVendorName ?? ""}
					onChange={(vendorName) => {
						onChange({
							...expense,
							payee_text: vendorName,
							vendor_name: vendorName,
							vendor_id: undefined,
							vendor: undefined,
							items: expense.items.map((item) => ({
								...item,
								vendor_id: undefined,
								vendor_name: vendorName,
								vendor: undefined,
							})),
						});
					}}
				/>
				{!creating && expense.items.length > 1 && (
					<small className="mini-field-hint">
						Изменение применится ко всем позициям
					</small>
				)}
			</div>
			{!creating && (
				<label>
					Дата
					<input
						type="date"
						value={expense.expense_date.slice(0, 10)}
						onChange={(event) =>
							onChange({ ...expense, expense_date: event.target.value })
						}
					/>
				</label>
			)}
			<div className="mini-editor-items">
				{!creating && <span>Позиции</span>}
				{expense.items.map((item, index) => (
					<div
						key={item.id || index}
						className={`mini-editor-item${creating ? " mini-editor-item--new" : ""}`}
					>
						{!creating && (
							<input
								aria-label="Название позиции"
								value={item.name}
								onChange={(event) =>
									onChange({
										...expense,
										items: expense.items.map((current, itemIndex) =>
											itemIndex === index
												? { ...current, name: event.target.value }
												: current,
										),
									})
								}
							/>
						)}
						{creating && <span className="mini-editor-label">Сумма</span>}
						<AmountInput
							ariaLabel="Сумма позиции"
							amount={item.amount}
							onChange={(amount) =>
								onChange({
									...expense,
									items: expense.items.map((current, itemIndex) =>
										itemIndex === index ? { ...current, amount } : current,
									),
								})
							}
						/>
						{creating && <span className="mini-editor-label">Категория</span>}
						<select
							aria-label="Категория позиции"
							value={item.category_id || 0}
							onChange={(event) =>
								onChange({
									...expense,
									items: expense.items.map((current, itemIndex) =>
										itemIndex === index
											? { ...current, category_id: Number(event.target.value) }
											: current,
									),
								})
							}
						>
							{categories.map((category) => (
								<option key={category.id} value={category.id}>
									{category.name}
								</option>
							))}
						</select>
						{!creating && (
							<VendorAutocomplete
								className="mini-editor-vendor"
								vendors={vendors}
								ariaLabel="Где купили позицию"
								placeholder="Где купили"
								value={itemVendorName(item)}
								onChange={(vendorName) => updateItemVendor(index, vendorName)}
							/>
						)}
					</div>
				))}
			</div>
			<div className="mini-modal-actions">
				<button
					className="mini-save"
					type="button"
					disabled={
						saving ||
						!expense.title.trim() ||
						expense.items.some((item) => !item.name.trim() || item.amount <= 0)
					}
					onClick={onSave}
				>
					{saving ? "Сохраняем…" : "Сохранить"}
				</button>
				{onDelete && (
					<button
						className="mini-delete"
						type="button"
						disabled={saving}
						onClick={onDelete}
					>
						<Trash size={18} />
						Удалить расход
					</button>
				)}
			</div>
		</Modal>
	);
};

const ExpenseItemEditor = ({
	expense,
	item,
	categories,
	vendors,
	saving,
	capture,
	sourceLoading,
	onChange,
	onClose,
	onSave,
	onSource,
	onDelete,
}: {
	expense: Expense;
	item: ExpenseItem;
	categories: Category[];
	vendors: Vendor[];
	saving: boolean;
	capture?: CapturePacket;
	sourceLoading: boolean;
	onChange: (item: ExpenseItem) => void;
	onClose: () => void;
	onSave: () => void;
	onSource: () => void;
	onDelete?: () => void;
}) => {
	const vendorName = vendorFieldValue(
		item.vendor_name,
		item.vendor?.name,
		vendors.find((vendor) => vendor.id === item.vendor_id)?.name,
		expenseItemSellerName(item, expense),
	);

	return (
		<Modal title="Редактировать покупку" onClose={onClose}>
			<p className="mini-field-note">
				{expense.title || "Расход"} · {formatDate(expense.expense_date)}
			</p>
			{expense.source_document_id && (
				<button
					className="mini-source-open"
					type="button"
					disabled={sourceLoading}
					onClick={onSource}
				>
					<SourceIcon capture={capture} size={18} />
					{sourceLoading ? "Загружаем…" : "Посмотреть исходник"}
				</button>
			)}
			<label>
				Название
				<input
					value={item.name}
					onChange={(event) => onChange({ ...item, name: event.target.value })}
				/>
			</label>
			<label htmlFor="expense-item-amount">
				Сумма
				<AmountInput
					ariaLabel="Сумма"
					amount={item.amount}
					id="expense-item-amount"
					onChange={(amount) => onChange({ ...item, amount })}
				/>
			</label>
			<label>
				Категория
				<select
					value={item.category_id || 0}
					onChange={(event) => {
						const category = categories.find(
							(current) => current.id === Number(event.target.value),
						);
						onChange({
							...item,
							category_id: category?.id,
							category_name: category?.name,
							category: category
								? { id: category.id, name: category.name }
								: undefined,
						});
					}}
				>
					{categories.map((category) => (
						<option key={category.id} value={category.id}>
							{category.name}
						</option>
					))}
				</select>
			</label>
			<div className="mini-field">
				<span>Где купили</span>
				<VendorAutocomplete
					vendors={vendors}
					ariaLabel="Где купили"
					placeholder="Не определён"
					value={vendorName}
					onChange={(value) => {
						onChange({
							...item,
							vendor_id: undefined,
							vendor_name: value,
							vendor: undefined,
						});
					}}
				/>
			</div>
			<label>
				Заметка
				<textarea
					rows={3}
					value={item.notes || ""}
					onChange={(event) => onChange({ ...item, notes: event.target.value })}
				/>
			</label>
			<div className="mini-modal-actions">
				<button
					className="mini-save"
					type="button"
					disabled={saving || !item.name.trim() || item.amount <= 0}
					onClick={onSave}
				>
					{saving ? "Сохраняем…" : "Сохранить"}
				</button>
				{onDelete && (
					<button
						className="mini-delete"
						type="button"
						disabled={saving}
						onClick={onDelete}
					>
						<Trash size={18} />
						Удалить покупку
					</button>
				)}
			</div>
		</Modal>
	);
};

const VendorEditor = ({
	vendor,
	vendors,
	saving,
	onChange,
	onClose,
	onSave,
	onMerge,
	onDelete,
}: {
	vendor: Vendor;
	vendors: Vendor[];
	saving: boolean;
	onChange: (vendor: Vendor) => void;
	onClose: () => void;
	onSave: () => void;
	onMerge: (targetVendorID: number) => void;
	onDelete: () => void;
}) => {
	const [targetVendorID, setTargetVendorID] = useState(0);
	const mergeTargets = vendors.filter((item) => item.id !== vendor.id);
	return (
		<Modal
			title={vendor.id === 0 ? "Новый продавец" : "Настроить продавца"}
			onClose={onClose}
		>
			<label>
				Название для списка
				<input
					maxLength={120}
					value={vendor.name}
					onChange={(event) =>
						onChange({ ...vendor, name: event.target.value })
					}
				/>
			</label>
			<label>
				Другие названия из чеков
				<textarea
					rows={4}
					placeholder={"ИП Иванов Иван Иванович\nООО «С Блеском»"}
					value={(vendor.aliases || []).map((alias) => alias.alias).join("\n")}
					onChange={(event) =>
						onChange({
							...vendor,
							aliases: event.target.value
								.split("\n")
								.map((alias) => ({ alias })),
						})
					}
				/>
			</label>
			<p className="mini-field-note">
				В следующий раз эти названия автоматически станут «
				{vendor.name || "Название"}».
			</p>
			<div className="mini-modal-actions">
				<button
					className="mini-save"
					type="button"
					disabled={saving || !vendor.name.trim()}
					onClick={onSave}
				>
					{saving ? "Сохраняем…" : "Сохранить"}
				</button>
				{vendor.id > 0 && mergeTargets.length > 0 && (
					<div className="mini-vendor-merge">
						<label>
							Объединить с
							<select
								value={targetVendorID}
								onChange={(event) =>
									setTargetVendorID(Number(event.target.value))
								}
							>
								<option value={0}>Выберите основное название</option>
								{mergeTargets.map((target) => (
									<option key={target.id} value={target.id}>
										{target.name}
									</option>
								))}
							</select>
						</label>
						<button
							type="button"
							disabled={saving || !targetVendorID}
							onClick={() => onMerge(targetVendorID)}
						>
							Объединить
						</button>
					</div>
				)}
				{vendor.id > 0 && (
					<button
						className="mini-delete"
						type="button"
						disabled={saving}
						onClick={onDelete}
					>
						<Trash size={18} />
						Удалить продавца
					</button>
				)}
			</div>
		</Modal>
	);
};

const CategoryEditor = ({
	category,
	saving,
	onChange,
	onClose,
	onSave,
	onDelete,
}: {
	category: Category;
	saving: boolean;
	onChange: (category: Category) => void;
	onClose: () => void;
	onSave: () => void;
	onDelete?: () => void;
}) => (
	<Modal
		title={category.id === 0 ? "Новая категория" : "Название категории"}
		onClose={onClose}
	>
		<label>
			Название
			<input
				maxLength={80}
				value={category.name}
				onChange={(event) =>
					onChange({ ...category, name: event.target.value })
				}
			/>
		</label>
		<label>
			Синонимы
			<input
				maxLength={500}
				placeholder="Например: маникюр, косметика, салон"
				value={category.alias_text ?? category.aliases?.join(", ") ?? ""}
				onChange={(event) =>
					onChange({ ...category, alias_text: event.target.value })
				}
			/>
			<small className="mini-field-hint">
				Через запятую. Один синоним может принадлежать только одной категории.
			</small>
		</label>
		<label>
			Лимит
			<select
				value={category.budget_period || ""}
				onChange={(event) =>
					onChange({
						...category,
						budget_period: event.target.value as "" | "week" | "month",
						budget_amount: event.target.value ? category.budget_amount : null,
					})
				}
			>
				<option value="">Без лимита</option>
				<option value="week">На неделю</option>
				<option value="month">На месяц</option>
			</select>
		</label>
		{category.budget_period && (
			<label>
				Сумма лимита
				<input
					type="number"
					min="1"
					step="1"
					placeholder="Например, 15000"
					value={category.budget_amount || ""}
					onChange={(event) =>
						onChange({
							...category,
							budget_amount: Number(event.target.value) || null,
						})
					}
				/>
			</label>
		)}
		<div className="mini-modal-actions">
			<button
				className="mini-save"
				type="button"
				disabled={
					saving ||
					!category.name.trim() ||
					(Boolean(category.budget_period) && !category.budget_amount)
				}
				onClick={onSave}
			>
				{saving ? "Сохраняем…" : "Сохранить"}
			</button>
			{onDelete && (
				<button
					className="mini-delete"
					type="button"
					disabled={saving}
					onClick={onDelete}
				>
					<Trash size={18} />
					Удалить категорию
				</button>
			)}
		</div>
	</Modal>
);

const ProfileEditor = ({
	user,
	saving,
	onChange,
	onClose,
	onSave,
}: {
	user: User;
	saving: boolean;
	onChange: (user: User) => void;
	onClose: () => void;
	onSave: () => void;
}) => (
	<Modal title="Настройки профиля" onClose={onClose}>
		<label>
			Имя
			<input
				maxLength={120}
				value={user.name}
				onChange={(event) => onChange({ ...user, name: event.target.value })}
			/>
		</label>
		<label>
			Валюта
			<select
				value={user.currency}
				onChange={(event) =>
					onChange({ ...user, currency: event.target.value })
				}
			>
				{!currencyOptions.some(([code]) => code === user.currency) && (
					<option value={user.currency}>{user.currency}</option>
				)}
				{currencyOptions.map(([code, name]) => (
					<option key={code} value={code}>
						{code} — {name}
					</option>
				))}
			</select>
		</label>
		<label>
			Страна
			<select
				value={user.country}
				onChange={(event) => onChange({ ...user, country: event.target.value })}
			>
				{!countryOptions.some(([code]) => code === user.country) && (
					<option value={user.country}>{user.country}</option>
				)}
				{countryOptions.map(([code, name]) => (
					<option key={code} value={code}>
						{name}
					</option>
				))}
			</select>
		</label>
		<label>
			Часовой пояс
			<select
				value={user.timezone}
				onChange={(event) =>
					onChange({ ...user, timezone: event.target.value })
				}
			>
				{!timezoneOptions.some(([zone]) => zone === user.timezone) && (
					<option value={user.timezone}>{user.timezone}</option>
				)}
				{timezoneOptions.map(([zone, name]) => (
					<option key={zone} value={zone}>
						{name}
					</option>
				))}
			</select>
		</label>
		<button
			className="mini-save"
			type="button"
			disabled={
				saving ||
				!user.name.trim() ||
				user.currency.length !== 3 ||
				!user.country.trim() ||
				!user.timezone.trim()
			}
			onClick={onSave}
		>
			{saving ? "Сохраняем…" : "Сохранить"}
		</button>
	</Modal>
);

const SpaceEditor = ({
	space,
	canEditCurrency,
	saving,
	onChange,
	onClose,
	onSave,
	onInvite,
	onDelete,
}: {
	space: Space;
	canEditCurrency: boolean;
	saving: boolean;
	onChange: (space: Space) => void;
	onClose: () => void;
	onSave: () => void;
	onInvite?: () => void;
	onDelete?: () => void;
}) => (
	<Modal
		title={space.id ? "Настройки пространства" : "Новое пространство"}
		onClose={onClose}
	>
		<label>
			Название
			<input
				disabled={space.is_personal}
				maxLength={120}
				value={space.name}
				onChange={(event) => onChange({ ...space, name: event.target.value })}
			/>
		</label>
		<label>
			Валюта пространства
			<select
				disabled={!canEditCurrency}
				value={space.currency}
				onChange={(event) =>
					onChange({ ...space, currency: event.target.value })
				}
			>
				{!currencyOptions.some(([code]) => code === space.currency) && (
					<option value={space.currency}>{space.currency}</option>
				)}
				{currencyOptions.map(([code, name]) => (
					<option key={code} value={code}>
						{code} — {name}
					</option>
				))}
			</select>
		</label>
		<p className="mini-field-note">
			{canEditCurrency
				? "После первого расхода валюта пространства фиксируется."
				: "Валюту может менять только владелец пространства."}
		</p>
		{onInvite && (
			<div className="mini-invite-block">
				<div>
					<b>Участники</b>
					<small>Telegram откроет выбор контакта или чата.</small>
				</div>
				<button type="button" disabled={saving} onClick={onInvite}>
					<PaperPlaneTilt size={18} weight="bold" />
					Пригласить
				</button>
			</div>
		)}
		<div className="mini-modal-actions">
			<button
				className="mini-save"
				type="button"
				disabled={
					saving || !space.name.trim() || space.currency.trim().length !== 3
				}
				onClick={onSave}
			>
				{saving ? "Сохраняем…" : space.id ? "Сохранить" : "Создать"}
			</button>
			{onDelete && (
				<button
					className="mini-delete"
					type="button"
					disabled={saving}
					onClick={onDelete}
				>
					<Trash size={18} />
					{canEditCurrency ? "Удалить пространство" : "Покинуть пространство"}
				</button>
			)}
		</div>
	</Modal>
);

const Modal = ({
	title,
	children,
	onClose,
}: { title: string; children: React.ReactNode; onClose: () => void }) => {
	useEffect(() => {
		document.body.classList.add("mini-modal-open");
		return () => document.body.classList.remove("mini-modal-open");
	}, []);

	return (
		<div
			className="mini-modal-backdrop"
			role="presentation"
			onMouseDown={(event) => {
				if (event.target === event.currentTarget) onClose();
			}}
		>
			<section
				className="mini-modal"
				role="dialog"
				aria-modal="true"
				aria-label={title}
			>
				<header>
					<h2>{title}</h2>
					<button type="button" aria-label="Закрыть" onClick={onClose}>
						<X size={21} />
					</button>
				</header>
				{children}
			</section>
		</div>
	);
};

const NavButton = ({
	active,
	label,
	icon,
	onClick,
}: {
	active: boolean;
	label: string;
	icon: React.ReactNode;
	onClick: () => void;
}) => (
	<button className={active ? "active" : ""} type="button" onClick={onClick}>
		{icon}
		<span>{label}</span>
	</button>
);
const Empty = ({ text }: { text: string }) => (
	<div className="mini-empty">
		<Check size={20} />
		<span>{text}</span>
	</div>
);
const LoadingRows = () => (
	<div className="mini-loading-rows">
		<i />
		<i />
		<i />
		<i />
	</div>
);
const LoadingScreen = () => (
	<div className="mini-loading">
		<NotePencil size={28} />
		<span>Загружаем расходы…</span>
	</div>
);
const TelegramEntry = ({ error }: { error: string }) => (
	<main className="mini-entry">
		<div className="mini-brand">
			<NotePencil size={22} weight="bold" />
			<span>Пока не забыл</span>
		</div>
		<h1>Всё под рукой</h1>
		<p>{error}</p>
		<a href={BOT_URL}>Открыть бота</a>
	</main>
);

const periodStart = (period: Period) => {
	if (period === "all") return null;
	const now = new Date();
	if (period === "today")
		return new Date(now.getFullYear(), now.getMonth(), now.getDate());
	if (period === "three-days")
		return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2);
	if (period === "week")
		return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
	if (period === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
	if (period === "three-months")
		return new Date(now.getFullYear(), now.getMonth() - 2, 1);
	if (period === "six-months")
		return new Date(now.getFullYear(), now.getMonth() - 5, 1);
	return new Date(now.getFullYear(), 0, 1);
};

const formatDate = (value: string) =>
	new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(
		new Date(value),
	);
const countryName = (code: string) =>
	countryOptions.find(([value]) => value === code)?.[1] || code;
const timezoneName = (timezone: string) =>
	timezoneOptions.find(([value]) => value === timezone)?.[1] || timezone;
const expenseWord = (count: number) =>
	count % 10 === 1 && count % 100 !== 11
		? "расход"
		: count % 10 >= 2 &&
				count % 10 <= 4 &&
				(count % 100 < 10 || count % 100 >= 20)
			? "расхода"
			: "расходов";
const itemWord = (count: number) =>
	count % 10 === 1 && count % 100 !== 11
		? "покупка"
		: count % 10 >= 2 &&
				count % 10 <= 4 &&
				(count % 100 < 10 || count % 100 >= 20)
			? "покупки"
			: "покупок";
const memberRole = (role: string) =>
	({ owner: "Владелец", admin: "Администратор", editor: "Редактор" })[role] ||
	"Участник";
function isoDay(offset: number) {
	const date = new Date();
	date.setDate(date.getDate() + offset);
	return localISODate(date);
}

function localISODate(date = new Date()) {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}
