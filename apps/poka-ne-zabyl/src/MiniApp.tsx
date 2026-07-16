import {
	ArrowLeft,
	CalendarBlank,
	Camera,
	ChartDonut,
	ChatCircleText,
	Check,
	FunnelSimple,
	GearSix,
	House,
	MagnifyingGlass,
	Microphone,
	NotePencil,
	PaperPlaneTilt,
	PencilSimple,
	Plus,
	Receipt,
	ShoppingBagOpen,
	SignOut,
	Storefront,
	Tag,
	Trash,
	UserCircle,
	UsersThree,
	WarningCircle,
	X,
} from "@phosphor-icons/react";
import WebApp from "@twa-dev/sdk";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import "./mini-app.css";
import { captureSourceKind } from "./capture-source";
import { groupRowsByExpense } from "./expense-groups";
import { type Period, periodBounds } from "./expense-period";
import {
	type UILanguage,
	languageOptions,
	localizedCategoryName,
	localizedCurrencyName,
	localizedRegionName,
	normalizeUILanguage,
	uiText,
} from "./mini-i18n";
import {
	expenseAmountInCurrency,
	expenseDisplayMoney,
	formatMoney,
	itemAmountInCurrency,
	itemDisplayMoney,
	moneyAmountsMatch,
} from "./money";
import { expensesForMonth } from "./overview";
import {
	ApiError,
	REQUEST_TIMEOUT_MS,
	isQuotaExhaustedError,
	requestError,
} from "./request";
import { shouldUseFullscreen } from "./telegram-platform";
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

type TelegramWidgetUser = {
	id: number;
	first_name?: string;
	last_name?: string;
	username?: string;
	photo_url?: string;
	auth_date: number;
	hash: string;
};

type BeforeInstallPromptEvent = Event & {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
	interface Window {
		onTelegramAuth?: (user: TelegramWidgetUser) => void;
	}
}
type CaptureMode = "choose" | "text" | "voice" | "photo";
type ExpenseSection = "history" | "plans";
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
	exitFullscreen?: () => void;
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

type PurchasePlan = {
	id: number;
	tenant_id: number;
	space_id: number;
	created_by_user_id: number;
	title: string;
	expected_amount?: number | null;
	currency: string;
	category_id?: number | null;
	due_date?: string | null;
	status: "planned" | "completed";
	expense_id?: number | null;
	reminder_sent_at?: string | null;
};

type User = {
	id: number;
	name: string;
	email: string;
	emailVerified?: boolean;
	telegramId?: number;
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
	plan_expires_at?: string | null;
	recurring_limit?: number;
	additional_limit?: number;
	dev_tools_enabled?: boolean;
};
type QuotaLevel = "low" | "exhausted";

type DeveloperQuotaPatch = {
	plan?: "free" | "plus";
	plan_expires_at?: string;
	recurring_limit?: number;
	additional_limit?: number;
	additional_units?: number;
	notification?:
		| "subscription_expiring"
		| "subscription_expired"
		| "quota_low"
		| "quota_exhausted";
};

type CheckoutResponse = {
	action: string;
	method: "POST";
	fields: Record<string, string>;
	order_id: number;
};

type AuthResponse = { token: string; user: User };
type CaptureResponse = {
	source_document_id?: number;
	processing_status?: "pending" | "processing" | "succeeded" | "failed";
	candidates?: { id: number; candidate_type: string }[];
};
type CaptureSubmission =
	| { kind: "text"; text: string }
	| { kind: "image" | "voice"; file: File };
type CapturePurpose = "expense" | "purchase_plan";
type PendingCapture = {
	sourceDocumentID: number;
	spaceID: number;
	purpose: CapturePurpose;
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
	receiptTotal: number | null;
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
	space_id?: number;
	media_object_id?: number;
	input_kind?: string;
	source_type?: string;
	document_type?: string;
	processing_status?: "pending" | "processing" | "succeeded" | "failed";
	pending_count?: number;
	source_text?: string;
	created_at?: string;
	source_context?: Record<string, unknown>;
};

type SpaceActivityItem = {
	id: number;
	action: string;
	read_state: "read" | "pending";
	actor: { id: number; display_name: string };
	metadata: Record<string, unknown>;
};

type SourceViewer = {
	capture: CapturePacket;
	mediaURL?: string;
	mediaType?: string;
};

const dismissKeyboard = (event: React.PointerEvent<HTMLElement>) => {
	if (
		(event.target as HTMLElement).closest(
			"input, textarea, select, [role=listbox]",
		)
	)
		return;
	if (document.activeElement instanceof HTMLElement)
		document.activeElement.blur();
};

const keepFocusedControlVisible = (event: React.FocusEvent<HTMLElement>) => {
	const target = event.target;
	if (!(target instanceof HTMLElement)) return;
	if (!target.matches("input, textarea, select, [contenteditable=true]"))
		return;
	window.requestAnimationFrame(() =>
		target.scrollIntoView({ block: "nearest", inline: "nearest" }),
	);
};

const BOT_URL = "https://t.me/poka_ne_zabyl_bot";
const BRAND_LOGO_URL = "/assets/poka-ne-zabyl-logo.jpg";
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
const previewPlans: PurchasePlan[] = [
	{
		id: 1,
		tenant_id: 1,
		space_id: 1,
		created_by_user_id: 1,
		title: "Кроссовки для танцев",
		expected_amount: 8200,
		currency: "RUB",
		category_id: 3,
		due_date: isoDay(5),
		status: "planned",
	},
	{
		id: 2,
		tenant_id: 1,
		space_id: 1,
		created_by_user_id: 1,
		title: "Фильтры для воды",
		expected_amount: 1400,
		currency: "RUB",
		category_id: 5,
		status: "planned",
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
const previewReviewCandidates: ReviewCandidate[] = [
	{
		id: 77,
		source_document_id: 105,
		candidate_type: "expense_candidate",
		title: "Покупки в Ленте",
		status: "pending_review",
		structured_data: {
			payee_text: "Лента",
			total: 7173.33,
			source_currency: "RUB",
			expense_date: localISODate(),
			items: [{ name: "Продукты", amount: 7173.33, category_key: "groceries" }],
		},
	},
	{
		id: 78,
		source_document_id: 106,
		candidate_type: "purchase_plan_candidate",
		title: "Кроссовки для танцев",
		status: "pending_review",
		structured_data: {
			title: "Кроссовки для танцев",
			expected_amount: 8200,
			category_key: "hobbies",
			due_date: isoDay(5),
		},
	},
];

const captureForExpense = (expense: Expense, captures: CapturePacket[]) =>
	captures.find(
		(capture) => capture.source_document_id === expense.source_document_id,
	);

const isStandaloneApp = () =>
	window.matchMedia("(display-mode: standalone)").matches ||
	Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

const apiRequest = async <T,>(
	path: string,
	token = "",
	init?: RequestInit,
): Promise<T> => {
	let response: Response;
	try {
		response = await fetch(`/api/v1${path}`, {
			...init,
			signal: init?.signal || AbortSignal.timeout(REQUEST_TIMEOUT_MS),
			headers: {
				...(init?.body instanceof FormData
					? {}
					: { "Content-Type": "application/json" }),
				...(token ? { Authorization: `Bearer ${token}` } : {}),
				...init?.headers,
			},
		});
	} catch (error) {
		throw requestError(error);
	}
	if (!response.ok) {
		const body = (await response.json().catch(() => ({}))) as {
			error?: string;
			code?: string;
		};
		throw new ApiError(
			body.error || "Не удалось загрузить данные",
			response.status,
			body.code,
		);
	}
	if (response.status === 204) return undefined as T;
	return response.json() as Promise<T>;
};

const submitCheckout = (checkout: CheckoutResponse) => {
	const form = document.createElement("form");
	form.method = checkout.method;
	form.action = checkout.action;
	for (const [name, value] of Object.entries(checkout.fields)) {
		const input = document.createElement("input");
		input.type = "hidden";
		input.name = name;
		input.value = value;
		form.append(input);
	}
	document.body.append(form);
	form.submit();
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

type PlanTarget = { spaceID: number; planID: number };

const planTarget = (): PlanTarget | null => {
	const query = new URLSearchParams(window.location.search);
	const directSpace = Number(query.get("space_id"));
	const directPlan = Number(query.get("plan_id"));
	if (directSpace > 0 && directPlan > 0)
		return { spaceID: directSpace, planID: directPlan };
	const startParam =
		query.get("tgWebAppStartParam") || WebApp.initDataUnsafe.start_param || "";
	const match = /^p_(\d+)_(\d+)$/.exec(startParam);
	if (!match) return null;
	return { spaceID: Number(match[1]), planID: Number(match[2]) };
};

const requestedPlan = planTarget();

const initialView = (): View => {
	if (requestedReview) return "review";
	if (requestedPlan) return "expenses";
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
	const openedRequestedPlan = useRef(false);
	const loadSequence = useRef(0);
	const [view, setView] = useState<View>(initialView);
	const [token, setToken] = useState("");
	const [user, setUser] = useState<User | null>(null);
	const [spaces, setSpaces] = useState<Space[]>([]);
	const [spaceID, setSpaceID] = useState(0);
	const [members, setMembers] = useState<SpaceMember[]>([]);
	const [expenses, setExpenses] = useState<Expense[]>([]);
	const [plans, setPlans] = useState<PurchasePlan[]>([]);
	const [captures, setCaptures] = useState<CapturePacket[]>([]);
	const [reviewCandidates, setReviewCandidates] = useState<ReviewCandidate[]>(
		[],
	);
	const [categories, setCategories] = useState<Category[]>([]);
	const [vendors, setVendors] = useState<Vendor[]>([]);
	const [quota, setQuota] = useState<Quota | null>(null);
	const [forcedQuotaLevel, setForcedQuotaLevel] = useState<QuotaLevel | null>(
		null,
	);
	const [dismissedQuotaLevel, setDismissedQuotaLevel] =
		useState<QuotaLevel | null>(null);
	const [loading, setLoading] = useState(true);
	const [loadFailed, setLoadFailed] = useState(false);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const [period, setPeriod] = useState<Period>("month");
	const [dateFrom, setDateFrom] = useState("");
	const [dateTo, setDateTo] = useState("");
	const [categoryID, setCategoryID] = useState(0);
	const [vendorID, setVendorID] = useState(0);
	const [expenseID, setExpenseID] = useState(0);
	const [groupByExpense, setGroupByExpense] = useState(false);
	const [query, setQuery] = useState("");
	const [expenseSection, setExpenseSection] = useState<ExpenseSection>(
		requestedPlan ? "plans" : "history",
	);
	const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
	const [editingPlan, setEditingPlan] = useState<PurchasePlan | null>(null);
	const [editingPlanCandidate, setEditingPlanCandidate] =
		useState<ReviewCandidate | null>(null);
	const [completingPlanID, setCompletingPlanID] = useState(0);
	const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
	const [editingCategory, setEditingCategory] = useState<Category | null>(null);
	const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
	const [editingProfile, setEditingProfile] = useState<User | null>(null);
	const [emailLinkOpen, setEmailLinkOpen] = useState(false);
	const [telegramLinkOpen, setTelegramLinkOpen] = useState(false);
	const [packPickerOpen, setPackPickerOpen] = useState(false);
	const [billingLoading, setBillingLoading] = useState(false);
	const [editingSpace, setEditingSpace] = useState<Space | null>(null);
	const [captureOpen, setCaptureOpen] = useState(false);
	const [captureMode, setCaptureMode] = useState<CaptureMode>("choose");
	const [capturePurpose, setCapturePurpose] =
		useState<CapturePurpose>("expense");
	const [captureError, setCaptureError] = useState("");
	const [captureSubmitting, setCaptureSubmitting] = useState(false);
	const [pendingCapture, setPendingCapture] = useState<PendingCapture | null>(
		null,
	);
	const [dismissedCaptureSourceID, setDismissedCaptureSourceID] = useState(0);
	const [captureFailure, setCaptureFailure] = useState("");
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
	const [browserInstallPrompt, setBrowserInstallPrompt] =
		useState<BeforeInstallPromptEvent | null>(null);
	const language = normalizeUILanguage(
		user?.language || WebApp.initDataUnsafe.user?.language_code,
	);
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
	const pendingReviewCandidates = useMemo(
		() =>
			reviewCandidates.filter(
				(candidate) =>
					(candidate.candidate_type === "expense_candidate" ||
						candidate.candidate_type === "purchase_plan_candidate") &&
					candidate.status === "pending_review",
			),
		[reviewCandidates],
	);
	const readyCandidate = pendingReviewCandidates[0] || null;
	const showReadyCandidate =
		readyCandidate &&
		view !== "review" &&
		readyCandidate.source_document_id !== dismissedCaptureSourceID;
	const quotaLevel: QuotaLevel | null = forcedQuotaLevel
		? forcedQuotaLevel
		: quota && quota.limit > 0 && quota.remaining <= 0
			? "exhausted"
			: quota && quota.limit > 0 && quota.used * 100 >= quota.limit * 80
				? "low"
				: null;
	const showCaptureStatus = Boolean(
		captureSubmitting ||
			pendingCapture ||
			captureFailure ||
			(showReadyCandidate && view !== "overview"),
	);
	const showQuotaStatus =
		!showCaptureStatus &&
		quotaLevel !== null &&
		quotaLevel !== dismissedQuotaLevel;
	const quotaStatusCopy =
		quotaLevel === "low"
			? uiText(language, "quotaLowBody").replace(
					"{remaining}",
					String(quota?.remaining ?? 0),
				)
			: uiText(language, "quotaExhaustedBody");

	useEffect(() => {
		setForcedQuotaLevel(null);
		setDismissedQuotaLevel(null);
	}, [spaceID]);

	useEffect(() => {
		if (quota && quota.remaining > 0) setForcedQuotaLevel(null);
	}, [quota?.remaining]);

	useEffect(() => {
		document.body.classList.add("mini-body");
		return () => document.body.classList.remove("mini-body");
	}, []);

	useEffect(() => {
		if (started.current) return;
		started.current = true;
		if (WebApp.initData) {
			const useFullscreen = shouldUseFullscreen(telegramWebApp.platform);
			WebApp.ready();
			if (useFullscreen) WebApp.expand();
			WebApp.setHeaderColor("#f4efe4");
			WebApp.setBackgroundColor("#f4efe4");
			if (
				useFullscreen &&
				telegramWebApp.isVersionAtLeast("7.7") &&
				telegramWebApp.disableVerticalSwipes
			) {
				telegramWebApp.disableVerticalSwipes();
			}
			if (
				useFullscreen &&
				telegramWebApp.isVersionAtLeast("8.0") &&
				telegramWebApp.requestFullscreen &&
				!telegramWebApp.isFullscreen
			) {
				telegramWebApp.requestFullscreen();
			}
			if (
				!useFullscreen &&
				telegramWebApp.isVersionAtLeast("8.0") &&
				telegramWebApp.exitFullscreen &&
				telegramWebApp.isFullscreen
			) {
				telegramWebApp.exitFullscreen();
			}
			if (
				telegramWebApp.isVersionAtLeast("8.0") &&
				telegramWebApp.checkHomeScreenStatus
			) {
				telegramWebApp.checkHomeScreenStatus(setHomeScreenStatus);
			} else {
				setHomeScreenStatus("unsupported");
			}
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
			setPlans(previewPlans);
			setCaptures(previewCaptures);
			setReviewCandidates(previewReviewCandidates);
			setCategories(previewCategories);
			setVendors(previewVendors);
			setQuota({
				plan: "basic",
				limit: 100,
				used: 37,
				remaining: 63,
				recurring_limit: 100,
				additional_limit: 0,
				dev_tools_enabled: true,
			});
			if (requestedReview) {
				setReviewDraft({
					candidateID: requestedReview.candidateID,
					sourceDocumentID: 77,
					title: "Покупки в Ленте",
					payeeText: "Лента",
					expenseDate: localISODate(),
					sourceCurrency: "RUB",
					receiptTotal: 300,
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
			setHomeScreenStatus(isStandaloneApp() ? "added" : "unknown");
			void restoreBrowserSession();
			return;
		}
		void login();
	}, []);

	useEffect(() => {
		if (WebApp.initData) return;
		const onInstallPrompt = (event: Event) => {
			event.preventDefault();
			setBrowserInstallPrompt(event as BeforeInstallPromptEvent);
			setHomeScreenStatus("unknown");
		};
		const onInstalled = () => {
			setBrowserInstallPrompt(null);
			setHomeScreenStatus("added");
			setNotice("Приложение добавлено на главный экран");
		};
		window.addEventListener("beforeinstallprompt", onInstallPrompt);
		window.addEventListener("appinstalled", onInstalled);
		return () => {
			window.removeEventListener("beforeinstallprompt", onInstallPrompt);
			window.removeEventListener("appinstalled", onInstalled);
		};
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
			await acceptAuth(auth);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Не удалось войти через Telegram",
			);
			setLoading(false);
		}
	};

	const acceptAuth = async (auth: AuthResponse) => {
		const availableSpaces = await apiRequest<Space[]>("/spaces", auth.token);
		setToken(auth.token);
		setUser(auth.user);
		setSpaces(availableSpaces);
		setSpaceID(
			availableSpaces.some(
				(space) =>
					space.id === (requestedReview?.spaceID || requestedPlan?.spaceID),
			)
				? requestedReview?.spaceID || requestedPlan?.spaceID || 0
				: availableSpaces[0]?.id || 0,
		);
		if (availableSpaces.length === 0) {
			setView("spaces");
			setLoading(false);
		}
	};

	const restoreBrowserSession = async () => {
		try {
			const auth = await apiRequest<AuthResponse>("/auth/refresh", "", {
				method: "POST",
				body: "{}",
			});
			await acceptAuth(auth);
		} catch {
			setError("");
			setLoading(false);
		}
	};

	const startCheckout = async (productCode: string) => {
		if (!token || !spaceID || billingLoading) return;
		setBillingLoading(true);
		setError("");
		try {
			const checkout = await apiRequest<CheckoutResponse>(
				`/billing/checkout?space_id=${spaceID}`,
				token,
				{ method: "POST", body: JSON.stringify({ product_code: productCode }) },
			);
			submitCheckout(checkout);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Не удалось открыть оплату",
			);
			setBillingLoading(false);
		}
	};

	const updateDeveloperQuota = async (patch: DeveloperQuotaPatch) => {
		if (!token || !spaceID || billingLoading) return;
		setBillingLoading(true);
		setError("");
		if (previewMode) {
			setQuota((current) => {
				if (!current) return current;
				const recurring = patch.recurring_limit ?? current.recurring_limit ?? 0;
				const additional =
					patch.additional_limit ??
					(current.additional_limit ?? 0) + (patch.additional_units ?? 0);
				const limit = recurring + additional;
				return {
					...current,
					plan: patch.plan === "free" ? "basic" : (patch.plan ?? current.plan),
					plan_expires_at:
						patch.plan_expires_at === ""
							? null
							: (patch.plan_expires_at ?? current.plan_expires_at),
					recurring_limit: recurring,
					additional_limit: additional,
					limit,
					remaining: Math.max(0, limit - current.used),
				};
			});
			setNotice(
				patch.notification
					? "Тестовое уведомление отправлено"
					: "Тестовая подписка обновлена",
			);
			setBillingLoading(false);
			return;
		}
		try {
			const updated = await apiRequest<Quota>(
				`/quota/test-plan?space_id=${spaceID}`,
				token,
				{ method: "PATCH", body: JSON.stringify(patch) },
			);
			setQuota(updated);
			setNotice(
				patch.notification
					? "Тестовое уведомление отправлено"
					: "Тестовая подписка обновлена",
			);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Не удалось обновить подписку",
			);
		} finally {
			setBillingLoading(false);
		}
	};

	const loginFromBrowser = async (telegramUser: TelegramWidgetUser) => {
		setLoading(true);
		setError("");
		try {
			const auth = await apiRequest<AuthResponse>("/auth/telegram/login", "", {
				method: "POST",
				body: JSON.stringify({
					telegram_id: telegramUser.id,
					username: telegramUser.username || "",
					first_name: telegramUser.first_name || "",
					last_name: telegramUser.last_name || "",
					photo_url: telegramUser.photo_url || "",
					auth_date: telegramUser.auth_date,
					hash: telegramUser.hash,
				}),
			});
			await acceptAuth(auth);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Не удалось войти");
			setLoading(false);
		}
	};

	useEffect(() => {
		if (!token || !spaceID) return;
		void loadSpace();
	}, [token, spaceID, user?.currency]);

	const loadSpace = async () => {
		if (previewMode) return;
		const requestID = ++loadSequence.current;
		setLoading(true);
		setLoadFailed(false);
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
				planData,
				reviewData,
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
				apiRequest<{ plans: PurchasePlan[] }>(
					`/spaces/${spaceID}/plans`,
					token,
				),
				apiRequest<{ candidates: ReviewCandidate[] }>(
					`/spaces/${spaceID}/review/candidates?limit=100`,
					token,
				),
			]);
			if (requestID !== loadSequence.current) return;
			setExpenses(expenseData.expenses || []);
			setCaptures(captureData.captures || []);
			setCategories(categoryData.categories || []);
			setQuota(quotaData);
			setMembers(memberData.members || []);
			setVendors(vendorData || []);
			setPlans(planData.plans || []);
			setReviewCandidates(reviewData.candidates || []);
			if (view === "review" && requestedReview) {
				await loadReview(token, spaceID, requestedReview.candidateID);
			}
		} catch (err) {
			if (requestID !== loadSequence.current) return;
			setLoadFailed(true);
			setError(
				err instanceof Error
					? err.message
					: "Не удалось загрузить пространство",
			);
		} finally {
			if (requestID === loadSequence.current) setLoading(false);
		}
	};

	const loadReview = async (
		authToken: string,
		reviewSpaceID: number,
		candidateID: number,
		sourceDocumentID?: number,
	) => {
		const sourceFilter = sourceDocumentID
			? `&source_document_id=${sourceDocumentID}`
			: "";
		const response = await apiRequest<{ candidates: ReviewCandidate[] }>(
			`/spaces/${reviewSpaceID}/review/candidates?limit=100${sourceFilter}`,
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

	const openReviewCandidate = async (
		candidate: ReviewCandidate,
		reviewSpaceID = spaceID,
	) => {
		if (!token) return;
		if (candidate.candidate_type === "purchase_plan_candidate") {
			const data = candidate.structured_data || {};
			const reviewSpace =
				spaces.find((item) => item.id === reviewSpaceID) || activeSpace;
			const categoryKey = readString(data, "category_key", "category");
			const category = categories.find((item) => item.key === categoryKey);
			setDismissedCaptureSourceID(candidate.source_document_id);
			setEditingPlanCandidate(candidate);
			setEditingPlan({
				id: 0,
				tenant_id: reviewSpace?.tenant_id || 0,
				space_id: reviewSpaceID,
				created_by_user_id: user?.id || 0,
				title: readString(data, "title", "name") || candidate.title,
				expected_amount:
					readNumber(data, "expected_amount", "total", "amount") || null,
				currency:
					readString(data, "currency") || reviewSpace?.currency || currency,
				category_id: category?.id || null,
				due_date:
					readString(data, "due_date", "planned_date", "expense_date") || null,
				status: "planned",
			});
			return;
		}
		setDismissedCaptureSourceID(candidate.source_document_id);
		setSaving(true);
		setCaptureFailure("");
		try {
			setSavedReviewExpense(null);
			setReviewDraft(null);
			setReviewMediaURL("");
			if (previewMode) {
				setReviewDraft(reviewDraftFromCandidate(candidate, reviewCandidates));
			} else {
				await loadReview(
					token,
					reviewSpaceID,
					candidate.id,
					candidate.source_document_id,
				);
			}
			setView("review");
		} catch (err) {
			setDismissedCaptureSourceID(0);
			setCaptureFailure(
				err instanceof Error ? err.message : "Не удалось открыть результат",
			);
		} finally {
			setSaving(false);
		}
	};

	const openReadyCandidate = () => {
		if (readyCandidate) void openReviewCandidate(readyCandidate);
	};

	const deleteReadyCandidate = async () => {
		if (!token || !readyCandidate || saving) return;
		const isPlan = readyCandidate.candidate_type === "purchase_plan_candidate";
		if (
			!window.confirm(
				isPlan
					? "Удалить этот распознанный план?"
					: "Удалить этот распознанный расход?",
			)
		)
			return;
		const sourceDocumentID = readyCandidate.source_document_id;
		setSaving(true);
		setCaptureFailure("");
		try {
			await apiRequest(
				`/spaces/${spaceID}/review/captures/${sourceDocumentID}`,
				token,
				{ method: "DELETE" },
			);
			setReviewCandidates((current) =>
				current.filter(
					(candidate) => candidate.source_document_id !== sourceDocumentID,
				),
			);
			setCaptures((current) =>
				current.filter(
					(capture) => capture.source_document_id !== sourceDocumentID,
				),
			);
			setDismissedCaptureSourceID(sourceDocumentID);
			setNotice(
				isPlan ? "Распознанный план удалён" : "Распознанный расход удалён",
			);
		} catch (err) {
			setCaptureFailure(
				err instanceof Error
					? err.message
					: isPlan
						? "Не удалось удалить план"
						: "Не удалось удалить расход",
			);
		} finally {
			setSaving(false);
		}
	};

	const submitCapture = async (submission: CaptureSubmission) => {
		const purpose = capturePurpose;
		setCaptureSubmitting(true);
		setCaptureError("");
		setCaptureFailure("");
		try {
			if (previewMode) {
				setCaptureOpen(false);
				setNotice(
					purpose === "purchase_plan"
						? "План отправлен на разбор"
						: "Расход отправлен на разбор",
				);
				return;
			}
			const captureID = crypto.randomUUID();
			const sourceContext = {
				source: "mini_app",
				telegram_chat_id: user?.id || 0,
				telegram_message_id: captureID,
				capture_target: purpose,
			};
			let captured: CaptureResponse;
			if (submission.kind === "text") {
				captured = await apiRequest<CaptureResponse>("/capture", token, {
					method: "POST",
					body: JSON.stringify({
						input_kind: "text",
						space_id: spaceID,
						text: submission.text.trim(),
						channel: "mini_app",
						source_context: sourceContext,
						wait_for_result: false,
					}),
				});
			} else {
				const body = new FormData();
				body.append("input_kind", submission.kind);
				body.append("space_id", String(spaceID));
				body.append("channel", "mini_app");
				body.append("source_context", JSON.stringify(sourceContext));
				body.append("wait_for_result", "false");
				body.append("file", submission.file, submission.file.name);
				captured = await apiRequest<CaptureResponse>("/capture", token, {
					method: "POST",
					body,
				});
			}
			if (!captured.source_document_id)
				throw new Error("Сервер не подтвердил загрузку расхода");
			setPendingCapture({
				sourceDocumentID: captured.source_document_id,
				spaceID,
				purpose,
			});
			setCaptureOpen(false);
		} catch (err) {
			if (isQuotaExhaustedError(err)) {
				setQuota((current) =>
					current
						? {
								...current,
								used: Math.max(current.used, current.limit),
								remaining: 0,
							}
						: current,
				);
				setForcedQuotaLevel("exhausted");
				setDismissedQuotaLevel(null);
				setCaptureOpen(false);
				setCaptureError("");
				setCaptureFailure("");
				return;
			}
			const message =
				err instanceof Error
					? err.message
					: purpose === "purchase_plan"
						? "Не удалось обработать план"
						: "Не удалось обработать расход";
			setCaptureError(message);
			setCaptureFailure(message);
		} finally {
			setCaptureSubmitting(false);
		}
	};

	useEffect(() => {
		if (!token || !pendingCapture || previewMode) return;
		let cancelled = false;
		let timer = 0;
		const poll = async () => {
			try {
				const packets = await apiRequest<{ captures: CapturePacket[] }>(
					`/spaces/${pendingCapture.spaceID}/captures?limit=1&source_document_id=${pendingCapture.sourceDocumentID}`,
					token,
				);
				if (cancelled) return;
				const packet = packets.captures[0];
				if (packet?.processing_status === "failed") {
					setPendingCapture(null);
					setCaptureFailure(
						pendingCapture.purpose === "purchase_plan"
							? "Не удалось разобрать план. Попробуйте ещё раз"
							: "Не удалось разобрать расход. Попробуйте ещё раз",
					);
					return;
				}
				if (packet?.processing_status === "succeeded") {
					const candidates = await apiRequest<{
						candidates: ReviewCandidate[];
					}>(
						`/spaces/${pendingCapture.spaceID}/review/candidates?limit=100&source_document_id=${pendingCapture.sourceDocumentID}`,
						token,
					);
					if (cancelled) return;
					const candidateType =
						pendingCapture.purpose === "purchase_plan"
							? "purchase_plan_candidate"
							: "expense_candidate";
					const candidate = candidates.candidates.find(
						(item) => item.candidate_type === candidateType,
					);
					if (!candidate) {
						setPendingCapture(null);
						setCaptureFailure(
							pendingCapture.purpose === "purchase_plan"
								? "Не удалось распознать план"
								: "Не удалось распознать расход",
						);
						return;
					}
					setReviewCandidates((current) => [
						...current.filter(
							(item) =>
								item.source_document_id !== pendingCapture.sourceDocumentID,
						),
						...candidates.candidates,
					]);
					setSavedReviewExpense(null);
					setReviewDraft(null);
					setReviewMediaURL("");
					setEditingExpense(null);
					setEditingItemIndex(null);
					setSpaceID(pendingCapture.spaceID);
					setPendingCapture(null);
					void apiRequest<Quota>(
						`/quota?space_id=${pendingCapture.spaceID}`,
						token,
					)
						.then((updatedQuota) => {
							if (!cancelled) setQuota(updatedQuota);
						})
						.catch(() => {
							// The finished capture remains usable if the quota refresh fails.
						});
					if (pendingCapture.purpose === "purchase_plan") {
						await openReviewCandidate(candidate, pendingCapture.spaceID);
					} else {
						await loadReview(
							token,
							pendingCapture.spaceID,
							candidate.id,
							pendingCapture.sourceDocumentID,
						);
						if (cancelled) return;
						setView("review");
					}
					return;
				}
			} catch {
				// A temporary network failure should not lose a persisted capture.
			}
			if (!cancelled) timer = window.setTimeout(poll, 2_000);
		};
		void poll();
		return () => {
			cancelled = true;
			window.clearTimeout(timer);
		};
	}, [
		token,
		pendingCapture?.sourceDocumentID,
		pendingCapture?.spaceID,
		pendingCapture?.purpose,
	]);

	useEffect(() => {
		if (!token || !user || !spaceID || previewMode) return;
		let cancelled = false;
		let timer = 0;
		const poll = async () => {
			try {
				const activity = await apiRequest<{ items: SpaceActivityItem[] }>(
					`/spaces/${spaceID}/activity?limit=5`,
					token,
				);
				if (cancelled) return;
				const pending = activity.items.filter(
					(item) => item.read_state === "pending",
				);
				const added = pending.find(
					(item) =>
						item.action === "expense_confirmed" && item.actor.id !== user.id,
				);
				if (added) {
					const expenseID = Number(added.metadata.expense_id);
					if (expenseID > 0) {
						const expense = await apiRequest<Expense>(
							`/spaces/${spaceID}/expenses/${expenseID}`,
							token,
						);
						if (cancelled) return;
						const money = expenseDisplayMoney(
							expense,
							expense.space_currency || expense.currency,
						);
						const items = expense.items
							.slice(0, 2)
							.map((item) => item.name)
							.join(", ");
						setNotice(
							`${added.actor.display_name} добавил: ${expense.title}${items ? ` · ${items}` : ""} · ${formatMoney(money.amount, money.currency)}`,
						);
						await loadSpace();
					}
				}
				if (pending.length > 0) {
					await apiRequest(`/spaces/${spaceID}/activity/read`, token, {
						method: "PUT",
						body: JSON.stringify({
							up_to_audit_event_id: Math.max(...pending.map((item) => item.id)),
						}),
					});
				}
			} catch {
				// A notification must never interrupt expense work.
			}
			// ponytail: polling is enough for the MVP; switch to the existing WS client when active concurrency matters.
			if (!cancelled) timer = window.setTimeout(poll, 15_000);
		};
		const start = async () => {
			try {
				const response = await apiRequest<{
					channels: { channel: string; enabled: boolean }[];
				}>("/me/notification-channels", token);
				if (
					cancelled ||
					!response.channels.some(
						(channel) => channel.channel === "in_app" && channel.enabled,
					)
				)
					return;
				await poll();
			} catch {
				// Preferences are optional; keep the app usable when unavailable.
			}
		};
		void start();
		return () => {
			cancelled = true;
			window.clearTimeout(timer);
		};
	}, [token, user?.id, spaceID]);

	useEffect(() => {
		if (!token || pendingCapture || captureSubmitting || previewMode) return;
		const queued = captures.find(
			(capture) =>
				capture.processing_status === "pending" ||
				capture.processing_status === "processing",
		);
		if (!queued) return;
		setPendingCapture({
			sourceDocumentID: queued.source_document_id,
			spaceID: queued.space_id || spaceID,
			purpose:
				queued.source_context?.capture_target === "purchase_plan"
					? "purchase_plan"
					: "expense",
		});
	}, [token, captures, pendingCapture, captureSubmitting, spaceID]);

	const closeReview = () => {
		if (requestedReview) {
			WebApp.close();
			return;
		}
		setReviewDraft(null);
		setSavedReviewExpense(null);
		setReviewMediaURL("");
		setView("expenses");
		void loadSpace();
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
				setReviewCandidates((current) =>
					current.filter(
						(candidate) => candidate.id !== reviewDraft.candidateID,
					),
				);
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
		const bounds = periodBounds(period, dateFrom, dateTo);
		return expenseItemRows(expenses).filter(({ expense, item }) => {
			const date = expense.expense_date.slice(0, 10);
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
				(!bounds.from || date >= bounds.from) &&
				(!bounds.to || date <= bounds.to) &&
				(expenseID === 0 || expense.id === expenseID) &&
				(categoryID === 0 || item.category_id === categoryID) &&
				(vendorID === 0 || itemVendorID === vendorID) &&
				(!normalizedQuery || text.includes(normalizedQuery))
			);
		});
	}, [
		expenses,
		period,
		dateFrom,
		dateTo,
		expenseID,
		categoryID,
		vendorID,
		query,
	]);

	const changePeriod = (nextPeriod: Period) => {
		if (nextPeriod === "custom" && !dateFrom && !dateTo) {
			const currentMonth = periodBounds("month");
			setDateFrom(currentMonth.from);
			setDateTo(currentMonth.to);
		}
		setPeriod(nextPeriod);
	};
	const changeDateFrom = (value: string) => {
		setDateFrom(value);
		if (value && dateTo && value > dateTo) setDateTo(value);
	};
	const changeDateTo = (value: string) => {
		setDateTo(value);
		if (value && dateFrom && value < dateFrom) setDateFrom(value);
	};

	const activeSpace = spaces.find((space) => space.id === spaceID);
	const currency = user?.currency || activeSpace?.currency || "RUB";
	const overviewExpenses = expensesForMonth(expenses);
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
	const overviewBudgets = useMemo(
		() =>
			categories
				.filter((category) => (category.budget_amount || 0) > 0)
				.sort((a, b) => (b.budget_percent || 0) - (a.budget_percent || 0))
				.slice(0, 3),
		[categories],
	);

	const openCategory = (id: number, nextPeriod: Period = "all") => {
		setExpenseSection("history");
		setPeriod(nextPeriod);
		setCategoryID(id);
		setVendorID(0);
		setExpenseID(0);
		setQuery("");
		setGroupByExpense(false);
		setView("expenses");
	};

	const openExpense = (id: number) => {
		setExpenseSection("history");
		setPeriod("all");
		setCategoryID(0);
		setVendorID(0);
		setExpenseID(id);
		setQuery("");
		setGroupByExpense(false);
		setView("expenses");
	};

	const openAllExpenses = () => {
		setExpenseSection("history");
		setPeriod("all");
		setCategoryID(0);
		setVendorID(0);
		setExpenseID(0);
		setQuery("");
		setView("expenses");
	};

	const installOnHomeScreen = async () => {
		if (WebApp.initData && telegramWebApp.addToHomeScreen) {
			telegramWebApp.addToHomeScreen();
			setNotice("Подтвердите добавление приложения на главный экран");
			return;
		}
		if (browserInstallPrompt) {
			await browserInstallPrompt.prompt();
			const choice = await browserInstallPrompt.userChoice;
			setBrowserInstallPrompt(null);
			if (choice.outcome === "accepted") setHomeScreenStatus("added");
			return;
		}
		const isiOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
		setNotice(
			isiOS
				? "В Safari нажмите «Поделиться», затем «На экран Домой»"
				: "Откройте меню браузера и выберите «Установить приложение»",
		);
	};

	const logoutBrowser = async () => {
		try {
			await apiRequest("/auth/logout", token, {
				method: "POST",
				body: "{}",
			});
			window.location.reload();
		} catch {
			setNotice("Не удалось выйти. Попробуйте ещё раз");
		}
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
			if (completingPlanID) {
				setPlans((current) =>
					current.filter((plan) => plan.id !== completingPlanID),
				);
				setCompletingPlanID(0);
				setExpenseSection("history");
			}
			setNotice(successNotice);
			return;
		}
		setSaving(true);
		try {
			let saveNotice = successNotice;
			let savedExpenseID = editingExpense.id;
			let planCompletionFailed = false;
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
							currency: editingExpense.currency || currency,
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
					expense: Expense;
					budget_warnings?: BudgetWarning[];
				}>(
					`/spaces/${spaceID}/review/candidates/${candidate.id}/create-expense`,
					token,
					{ method: "POST", body: "{}" },
				);
				if (projected.budget_warnings?.[0]) {
					saveNotice = budgetWarningText(projected.budget_warnings[0]);
				}
				savedExpenseID = projected.expense.id;
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
			if (creating && completingPlanID && savedExpenseID > 0) {
				try {
					await apiRequest(
						`/spaces/${spaceID}/plans/${completingPlanID}/complete`,
						token,
						{
							method: "POST",
							body: JSON.stringify({ expense_id: savedExpenseID }),
						},
					);
				} catch {
					planCompletionFailed = true;
				}
			}
			setEditingExpense(null);
			setEditingItemIndex(null);
			setCompletingPlanID(0);
			if (creating) setExpenseSection("history");
			setNotice(
				planCompletionFailed
					? "Расход сохранён, но план пока остался в списке"
					: saveNotice,
			);
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
			setNotice(uiText(language, creating ? "categoryAdded" : "categorySaved"));
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
			setNotice(uiText(language, creating ? "categoryAdded" : "categorySaved"));
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

	const mergeCategory = async (targetCategoryID: number) => {
		if (!editingCategory || editingCategory.key === "other") return;
		const target = categories.find(
			(category) => category.id === targetCategoryID,
		);
		if (!target) return;
		if (
			!window.confirm(
				`${uiText(language, "mergeConfirm")} «${localizedCategoryName(editingCategory, language)}» → «${localizedCategoryName(target, language)}»?`,
			)
		)
			return;
		if (previewMode) {
			const source = editingCategory;
			setCategories((current) =>
				current
					.filter((category) => category.id !== source.id)
					.map((category) =>
						category.id === target.id
							? {
									...category,
									count: category.count + source.count,
									total: category.total + source.total,
									aliases: Array.from(
										new Set([
											...(category.aliases || []),
											source.name,
											...(source.aliases || []),
										]),
									),
									...(!category.budget_amount && source.budget_amount
										? {
												budget_period: source.budget_period,
												budget_amount: source.budget_amount,
											}
										: {}),
								}
							: category,
					),
			);
			setExpenses((current) =>
				current.map((expense) => ({
					...expense,
					items: expense.items.map((item) =>
						item.category_id === source.id
							? { ...item, category_id: target.id }
							: item,
					),
				})),
			);
			setEditingCategory(null);
			setNotice(uiText(language, "mergeSuccess"));
			return;
		}
		setSaving(true);
		try {
			await apiRequest(
				`/spaces/${spaceID}/categories/${editingCategory.id}/merge`,
				token,
				{
					method: "POST",
					body: JSON.stringify({ target_category_id: targetCategoryID }),
				},
			);
			setEditingCategory(null);
			setNotice(uiText(language, "mergeSuccess"));
			await loadSpace();
		} catch (err) {
			setNotice(
				err instanceof Error ? err.message : uiText(language, "mergeFailed"),
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
			setNotice(uiText(language, "profileSaved"));
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
			setNotice(uiText(language, "profileSaved"));
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
		const previousSpace = spaces.find(({ id }) => id === editingSpace.id);
		if (
			!creating &&
			previousSpace?.currency !== editingSpace.currency &&
			!window.confirm(
				"Пересчитать расходы и лимиты в новой валюте? Исходные суммы покупок сохранятся.",
			)
		)
			return;
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
			const message = err instanceof Error ? err.message : "";
			setNotice(
				message.includes("participant splits")
					? "Сначала удалите разделение расходов между участниками"
					: message.includes("currency exchange rate unavailable")
						? "Не удалось получить курс валют. Попробуйте позже"
						: message ||
							(creating
								? "Не удалось создать пространство"
								: "Не удалось сохранить пространство"),
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
			setPlans([]);
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

	const addPlan = () => {
		setEditingPlanCandidate(null);
		setEditingPlan({
			id: 0,
			tenant_id: activeSpace?.tenant_id || 0,
			space_id: spaceID,
			created_by_user_id: user?.id || 0,
			title: "",
			expected_amount: null,
			currency: activeSpace?.currency || currency,
			category_id: null,
			due_date: null,
			status: "planned",
		});
	};

	const savePlan = async () => {
		if (!editingPlan) return;
		const planSpaceID = editingPlan.space_id || spaceID;
		const payload = {
			title: editingPlan.title.trim(),
			expected_amount: editingPlan.expected_amount || null,
			category_id: editingPlan.category_id || null,
			due_date: editingPlan.due_date?.slice(0, 10) || "",
		};
		if (previewMode) {
			const saved = editingPlan.id
				? editingPlan
				: { ...editingPlan, id: Date.now() };
			setPlans((current) =>
				editingPlan.id
					? current.map((plan) => (plan.id === saved.id ? saved : plan))
					: [...current, saved],
			);
			setEditingPlan(null);
			setEditingPlanCandidate(null);
			setNotice(
				editingPlan.id
					? uiText(language, "planSaved")
					: uiText(language, "planAdded"),
			);
			return;
		}
		setSaving(true);
		try {
			const response = editingPlanCandidate
				? await apiRequest<{ plan: PurchasePlan }>(
						`/spaces/${planSpaceID}/review/candidates/${editingPlanCandidate.id}/create-plan`,
						token,
						{
							method: "POST",
							body: JSON.stringify({ review: payload }),
						},
					)
				: await apiRequest<PurchasePlan>(
						`/spaces/${planSpaceID}/plans${editingPlan.id ? `/${editingPlan.id}` : ""}`,
						token,
						{
							method: editingPlan.id ? "PUT" : "POST",
							body: JSON.stringify(payload),
						},
					);
			const saved = "plan" in response ? response.plan : response;
			setPlans((current) =>
				editingPlan.id
					? current.map((plan) => (plan.id === saved.id ? saved : plan))
					: [...current, saved],
			);
			setEditingPlan(null);
			if (editingPlanCandidate) {
				const sourceDocumentID = editingPlanCandidate.source_document_id;
				setReviewCandidates((current) =>
					current.filter(
						(candidate) => candidate.source_document_id !== sourceDocumentID,
					),
				);
				setEditingPlanCandidate(null);
			}
			setNotice(
				editingPlan.id
					? uiText(language, "planSaved")
					: uiText(language, "planAdded"),
			);
		} catch (err) {
			setNotice(
				err instanceof Error ? err.message : uiText(language, "planSaveFailed"),
			);
		} finally {
			setSaving(false);
		}
	};

	const deletePlan = async () => {
		if (!editingPlan?.id) return;
		if (!window.confirm(uiText(language, "deletePlanConfirm"))) return;
		if (previewMode) {
			setPlans((current) =>
				current.filter((plan) => plan.id !== editingPlan.id),
			);
			setEditingPlan(null);
			setNotice(uiText(language, "planDeleted"));
			return;
		}
		setSaving(true);
		try {
			await apiRequest(`/spaces/${spaceID}/plans/${editingPlan.id}`, token, {
				method: "DELETE",
			});
			setPlans((current) =>
				current.filter((plan) => plan.id !== editingPlan.id),
			);
			setEditingPlan(null);
			setNotice(uiText(language, "planDeleted"));
		} catch (err) {
			setNotice(
				err instanceof Error
					? err.message
					: uiText(language, "planDeleteFailed"),
			);
		} finally {
			setSaving(false);
		}
	};

	const deletePlanCandidate = async () => {
		if (!editingPlanCandidate || !editingPlan || saving) return;
		if (!window.confirm("Удалить этот распознанный план?")) return;
		const sourceDocumentID = editingPlanCandidate.source_document_id;
		if (!previewMode) {
			setSaving(true);
			try {
				await apiRequest(
					`/spaces/${editingPlan.space_id || spaceID}/review/captures/${sourceDocumentID}`,
					token,
					{ method: "DELETE" },
				);
			} catch (err) {
				setNotice(
					err instanceof Error ? err.message : "Не удалось удалить план",
				);
				setSaving(false);
				return;
			}
			setSaving(false);
		}
		setReviewCandidates((current) =>
			current.filter(
				(candidate) => candidate.source_document_id !== sourceDocumentID,
			),
		);
		setCaptures((current) =>
			current.filter(
				(capture) => capture.source_document_id !== sourceDocumentID,
			),
		);
		setEditingPlan(null);
		setEditingPlanCandidate(null);
		setNotice("Распознанный план удалён");
	};

	const buyPlan = (plan: PurchasePlan) => {
		const category =
			categories.find((item) => item.id === plan.category_id) ||
			categories.find((item) => item.key === "other") ||
			categories[0];
		setCompletingPlanID(plan.id);
		setEditingItemIndex(null);
		setEditingExpense({
			id: 0,
			user_id: user?.id || 0,
			title: plan.title,
			payee_text: "",
			expense_date: localISODate(),
			currency: plan.currency,
			space_currency: plan.currency,
			items: [
				{
					name: plan.title,
					amount: plan.expected_amount || 0,
					category_id: category?.id,
				},
			],
		});
	};

	useEffect(() => {
		if (
			!requestedPlan ||
			openedRequestedPlan.current ||
			requestedPlan.spaceID !== spaceID ||
			plans.length === 0 ||
			categories.length === 0
		)
			return;
		const plan = plans.find((item) => item.id === requestedPlan.planID);
		if (!plan) return;
		openedRequestedPlan.current = true;
		setExpenseSection("plans");
		setView("expenses");
		buyPlan(plan);
	}, [spaceID, plans, categories]);

	const planAgain = () => {
		if (!editingExpense || editingItemIndex === null) return;
		const item = editingExpense.items[editingItemIndex];
		setEditingExpense(null);
		setEditingItemIndex(null);
		setEditingPlan({
			id: 0,
			tenant_id: activeSpace?.tenant_id || 0,
			space_id: spaceID,
			created_by_user_id: user?.id || 0,
			title: item.name,
			expected_amount: item.space_amount ?? item.amount,
			currency: activeSpace?.currency || currency,
			category_id: item.category_id || null,
			due_date: null,
			status: "planned",
		});
	};

	const addExpense = () => {
		setCompletingPlanID(0);
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

	const openCapture = (
		mode: CaptureMode = "choose",
		purpose: CapturePurpose = "expense",
	) => {
		if (captureSubmitting || pendingCapture) {
			setNotice("Текущий запрос ещё разбирается");
			return;
		}
		setCaptureError("");
		setCaptureFailure("");
		setCaptureMode(mode);
		setCapturePurpose(purpose);
		setCaptureOpen(true);
	};

	const editExpenseItem = ({ expense, itemIndex }: ExpenseItemRow) => {
		setEditingItemIndex(itemIndex);
		setEditingExpense({
			...expense,
			items: expense.items.map((item) => ({ ...item })),
		});
	};

	if (loading && !token) return <LoadingScreen />;
	if (!token && !WebApp.initData)
		return (
			<BrowserEntry
				error={error}
				onTelegramAuth={loginFromBrowser}
				onEmailAuth={acceptAuth}
			/>
		);
	if (error && !token) return <TelegramEntry error={error} />;
	if (view === "review") {
		return (
			<div
				className="mini-app mini-review-app"
				onFocusCapture={keepFocusedControlVisible}
				onPointerDown={dismissKeyboard}
			>
				{loading ? (
					<LoadingScreen />
				) : savedReviewExpense ? (
					<ReviewSaved expense={savedReviewExpense} onClose={closeReview} />
				) : reviewDraft ? (
					<ReviewEditor
						draft={reviewDraft}
						language={language}
						mediaURL={reviewMediaURL}
						categories={categories}
						vendors={vendors}
						saving={saving}
						error={error}
						onChange={setReviewDraft}
						onSave={saveReview}
						onClose={closeReview}
					/>
				) : (
					<TelegramEntry error={error || "Кандидат не найден"} />
				)}
			</div>
		);
	}

	return (
		<div
			className="mini-app"
			onFocusCapture={keepFocusedControlVisible}
			onPointerDown={dismissKeyboard}
		>
			<header className="mini-header">
				<div className="mini-brand">
					<img className="mini-brand-mark" src={BRAND_LOGO_URL} alt="" />
					<span>{uiText(language, "brand")}</span>
				</div>
				{spaces.length > 1 ? (
					<select
						aria-label={uiText(language, "space")}
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
				{error && (
					<div
						className={`mini-alert${loadFailed ? " mini-alert--retry" : ""}`}
					>
						<span>{error}</span>
						{loadFailed && (
							<button type="button" onClick={() => void loadSpace()}>
								Повторить
							</button>
						)}
					</div>
				)}
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
								language={language}
								total={overviewTotal}
								currency={currency}
								categories={categoryTotals}
								budgets={overviewBudgets}
								expenses={overviewExpenses}
								latestExpenses={expenses}
								plans={plans}
								captures={captures}
								hasAnyExpenses={expenses.length > 0}
								pendingCandidates={pendingReviewCandidates}
								onCategory={openCategory}
								onExpense={openExpense}
								onExpenses={openAllExpenses}
								onPlans={() => {
									setExpenseSection("plans");
									setView("expenses");
								}}
								onEditPlan={(plan) => setEditingPlan({ ...plan })}
								onBuyPlan={buyPlan}
								onReviewCandidate={(candidate) =>
									void openReviewCandidate(candidate)
								}
								onCapture={openCapture}
								onManual={addExpense}
							/>
						)}
						{view === "expenses" && (
							<ExpensesView
								items={filteredItems}
								section={expenseSection}
								plans={plans}
								language={language}
								categories={categories}
								vendors={vendors}
								captures={captures}
								currency={currency}
								period={period}
								dateFrom={dateFrom}
								dateTo={dateTo}
								expense={expenses.find((expense) => expense.id === expenseID)}
								categoryID={categoryID}
								vendorID={vendorID}
								groupByExpense={groupByExpense}
								query={query}
								onPeriod={changePeriod}
								onDateFrom={changeDateFrom}
								onDateTo={changeDateTo}
								onClearExpense={() => setExpenseID(0)}
								onCategory={setCategoryID}
								onVendor={setVendorID}
								onGrouping={setGroupByExpense}
								onQuery={setQuery}
								onSource={openExpenseSource}
								onEdit={editExpenseItem}
								onAdd={openCapture}
								onSection={setExpenseSection}
								onAddPlan={() => openCapture("choose", "purchase_plan")}
								onEditPlan={(plan) => setEditingPlan({ ...plan })}
								onBuyPlan={buyPlan}
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
								language={language}
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
								onBack={() => setView("profile")}
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
								language={language}
								quota={quota}
								vendorsCount={vendors.length}
								spacesCount={spaces.length}
								homeScreenStatus={homeScreenStatus}
								onInstall={installOnHomeScreen}
								onManageVendors={() => setView("vendors")}
								onManageSpaces={() => setView("spaces")}
								onLinkEmail={() => setEmailLinkOpen(true)}
								onLinkTelegram={() => setTelegramLinkOpen(true)}
								onLogout={
									!WebApp.initData && !previewMode ? logoutBrowser : undefined
								}
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
								onStartPlus={() => void startCheckout("plus_30d")}
								onBuyPack={() => setPackPickerOpen(true)}
								onDevUpdate={(patch) => void updateDeveloperQuota(patch)}
								billingLoading={billingLoading}
							/>
						)}
					</>
				)}
			</main>

			{showCaptureStatus && (
				<div
					className={`capture-status${captureFailure ? " is-error" : ""}`}
					role="status"
					aria-live="polite"
				>
					{captureFailure ? (
						<X size={20} />
					) : showReadyCandidate && !captureSubmitting && !pendingCapture ? (
						<Check size={20} weight="bold" />
					) : (
						<KnotLoader compact />
					)}
					<div>
						<strong>
							{captureFailure
								? pendingCapture?.purpose === "purchase_plan" ||
									readyCandidate?.candidate_type === "purchase_plan_candidate"
									? "План не разобран"
									: "Расход не разобран"
								: showReadyCandidate && !captureSubmitting && !pendingCapture
									? readyCandidate?.candidate_type === "purchase_plan_candidate"
										? "План готов"
										: "Расход готов"
									: captureSubmitting
										? capturePurpose === "purchase_plan"
											? "Отправляем план…"
											: "Отправляем расход…"
										: pendingCapture?.purpose === "purchase_plan"
											? "Разбираем план…"
											: "Разбираем расход…"}
						</strong>
						<small>
							{captureFailure ||
								(showReadyCandidate && !captureSubmitting && !pendingCapture
									? "Проверьте распознанные данные"
									: "Можно продолжать пользоваться приложением")}
						</small>
					</div>
					{showReadyCandidate &&
					!captureSubmitting &&
					!pendingCapture &&
					!captureFailure ? (
						<>
							<button
								className="capture-status-action"
								type="button"
								disabled={saving}
								onClick={openReadyCandidate}
							>
								Проверить
							</button>
							<button
								type="button"
								disabled={saving}
								aria-label={
									readyCandidate.candidate_type === "purchase_plan_candidate"
										? "Удалить распознанный план"
										: "Удалить распознанный расход"
								}
								title="Удалить"
								onClick={() => void deleteReadyCandidate()}
							>
								<Trash size={17} />
							</button>
						</>
					) : captureFailure ? (
						<button
							type="button"
							aria-label="Скрыть сообщение"
							onClick={() => setCaptureFailure("")}
						>
							<X size={17} />
						</button>
					) : null}
				</div>
			)}
			{showQuotaStatus && quotaLevel && (
				<div
					className={`capture-status is-quota is-${quotaLevel}`}
					role="alert"
					aria-live="polite"
				>
					<WarningCircle size={22} weight="fill" />
					<div>
						<strong>
							{uiText(
								language,
								quotaLevel === "exhausted"
									? "quotaExhaustedTitle"
									: "quotaLowTitle",
							)}
						</strong>
						<small>{quotaStatusCopy}</small>
					</div>
					<button
						className="capture-status-dismiss"
						type="button"
						aria-label={uiText(language, "close")}
						onClick={() => setDismissedQuotaLevel(quotaLevel)}
					>
						<X size={17} />
					</button>
					<button
						className="capture-status-action"
						type="button"
						onClick={() => {
							setDismissedQuotaLevel(quotaLevel);
							setView("profile");
						}}
					>
						{uiText(language, "manageSubscription")}
					</button>
				</div>
			)}

			<nav className="mini-nav" aria-label={uiText(language, "navLabel")}>
				<NavButton
					active={view === "overview"}
					label={uiText(language, "navOverview")}
					icon={<House />}
					onClick={() => setView("overview")}
				/>
				<NavButton
					active={view === "expenses"}
					label={uiText(language, "navExpenses")}
					icon={<Receipt />}
					onClick={openAllExpenses}
				/>
				<NavButton
					active={false}
					primary
					label={uiText(language, "navAdd")}
					icon={<Plus weight="bold" />}
					onClick={() => openCapture()}
				/>
				<NavButton
					active={view === "categories"}
					label={uiText(language, "navCategories")}
					icon={<Tag />}
					onClick={() => setView("categories")}
				/>
				<NavButton
					active={view === "profile" || view === "vendors" || view === "spaces"}
					label={uiText(language, "navProfile")}
					icon={<UserCircle />}
					onClick={() => setView("profile")}
				/>
			</nav>

			{captureOpen && (
				<CaptureComposer
					purpose={capturePurpose}
					initialMode={captureMode}
					saving={captureSubmitting}
					error={captureError}
					onClose={() => setCaptureOpen(false)}
					onManual={() => {
						setCaptureOpen(false);
						if (capturePurpose === "purchase_plan") addPlan();
						else addExpense();
					}}
					onSubmit={submitCapture}
				/>
			)}
			{packPickerOpen && (
				<BillingPackPicker
					language={language}
					loading={billingLoading}
					onClose={() => setPackPickerOpen(false)}
					onSelect={(code) => void startCheckout(code)}
				/>
			)}

			{editingExpense && editingItemIndex === null && (
				<ExpenseEditor
					expense={editingExpense}
					language={language}
					categories={categories}
					vendors={vendors}
					itemNameSuggestions={itemNameSuggestions}
					creating={editingExpense.id === 0}
					saving={saving}
					capture={captureForExpense(editingExpense, captures)}
					sourceLoading={sourceLoading}
					onChange={setEditingExpense}
					onClose={() => {
						setEditingExpense(null);
						setCompletingPlanID(0);
					}}
					onSave={saveExpense}
					onSource={() => openExpenseSource(editingExpense)}
					onDelete={editingExpense.id > 0 ? deleteExpense : undefined}
				/>
			)}
			{editingPlan && (
				<PlanEditor
					plan={editingPlan}
					language={language}
					categories={categories}
					saving={saving}
					fromCandidate={Boolean(editingPlanCandidate)}
					onChange={setEditingPlan}
					onClose={() => {
						setEditingPlan(null);
						setEditingPlanCandidate(null);
					}}
					onSave={savePlan}
					onDelete={
						editingPlanCandidate
							? deletePlanCandidate
							: editingPlan.id
								? deletePlan
								: undefined
					}
				/>
			)}
			{editingExpense && editingItemIndex !== null && (
				<ExpenseItemEditor
					expense={editingExpense}
					language={language}
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
					onPlanAgain={planAgain}
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
					categories={categories}
					language={language}
					saving={saving}
					onChange={setEditingCategory}
					onClose={() => setEditingCategory(null)}
					onSave={saveCategory}
					onMerge={mergeCategory}
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
			{emailLinkOpen && (
				<EmailLinkDialog
					token={token}
					initialEmail={
						user?.email && !user.email.endsWith("@telegram.local")
							? user.email
							: ""
					}
					onClose={() => setEmailLinkOpen(false)}
					onLinked={(nextUser) => {
						setUser(nextUser);
						setEmailLinkOpen(false);
						setNotice("Почта привязана. Теперь по ней можно входить");
					}}
				/>
			)}
			{telegramLinkOpen && (
				<TelegramLinkDialog
					token={token}
					onClose={() => setTelegramLinkOpen(false)}
					onLinked={(nextUser) => {
						setUser(nextUser);
						setTelegramLinkOpen(false);
						setNotice("Telegram привязан. Теперь через него можно входить");
					}}
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
	const receiptTotal = readNumber(data, "total", "total_amount", "amount");
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
		receiptTotal: receiptTotal > 0 ? receiptTotal : null,
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
							onPointerDown={(event) => {
								event.preventDefault();
								selectVendor(vendor);
							}}
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
	language,
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
	language: UILanguage;
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
	const [showItemVendors, setShowItemVendors] = useState(
		() => sharedVendorName === null,
	);
	const incompleteItems = draft.items.filter(
		(item) => !item.name.trim() || item.amount <= 0,
	).length;
	const totalMatches =
		draft.receiptTotal === null
			? null
			: moneyAmountsMatch(total, draft.receiptTotal);
	const checkState =
		incompleteItems > 0 || totalMatches === false ? "warning" : "ok";
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
					<span>{uiText(language, "brand")}</span>
					<b>{mediaURL ? "Проверьте чек" : "Проверьте расход"}</b>
				</div>
				<span className="review-currency">{draft.sourceCurrency}</span>
			</header>

			{mediaURL && (
				<details className="review-source-details">
					<summary>
						<span>
							<Receipt size={19} />
							Оригинал чека
						</span>
						<em>Сверить</em>
					</summary>
					<figure className="review-source">
						<img src={mediaURL} alt="Исходный чек" />
					</figure>
				</details>
			)}

			<section className="review-paper">
				<div className={`review-check is-${checkState}`} role="status">
					<span className="review-check-mark">
						{checkState === "ok" ? <Check size={20} weight="bold" /> : "!"}
					</span>
					<div>
						<b>
							{incompleteItems > 0
								? `Заполните позиции: ${incompleteItems}`
								: totalMatches === false
									? "Сумма не сходится"
									: totalMatches
										? "Сумма сошлась"
										: "Проверьте позиции"}
						</b>
						<small>
							{draft.receiptTotal !== null && totalMatches === false
								? `В чеке ${formatMoney(draft.receiptTotal, draft.sourceCurrency)}, в позициях ${formatMoney(total, draft.sourceCurrency)}`
								: `Позиции: ${draft.items.length} · ${formatMoney(total, draft.sourceCurrency)}`}
						</small>
					</div>
				</div>
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
						<button
							className="review-item-vendor-toggle"
							type="button"
							onClick={() => setShowItemVendors((shown) => !shown)}
						>
							{showItemVendors ? "Скрыть продавцов позиций" : "Разные продавцы"}
						</button>
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
						<article
							key={item.key}
							className={`review-line${showItemVendors ? "" : " review-line--compact"}`}
						>
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
										{localizedCategoryName(category, language)}
									</option>
								))}
							</select>
							{showItemVendors && (
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
							)}
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
	language,
	total,
	currency,
	categories,
	budgets,
	expenses,
	latestExpenses,
	plans,
	captures,
	hasAnyExpenses,
	pendingCandidates,
	onCategory,
	onExpense,
	onExpenses,
	onPlans,
	onEditPlan,
	onBuyPlan,
	onReviewCandidate,
	onCapture,
	onManual,
}: {
	user: User | null;
	language: UILanguage;
	total: number;
	currency: string;
	categories: Array<Category & { filteredTotal: number }>;
	budgets: Category[];
	expenses: Expense[];
	latestExpenses: Expense[];
	plans: PurchasePlan[];
	captures: CapturePacket[];
	hasAnyExpenses: boolean;
	pendingCandidates: ReviewCandidate[];
	onCategory: (id: number, period?: Period) => void;
	onExpense: (id: number) => void;
	onExpenses: () => void;
	onPlans: () => void;
	onEditPlan: (plan: PurchasePlan) => void;
	onBuyPlan: (plan: PurchasePlan) => void;
	onReviewCandidate: (candidate: ReviewCandidate) => void;
	onCapture: (mode?: CaptureMode) => void;
	onManual: () => void;
}) => {
	if (!hasAnyExpenses && plans.length === 0 && pendingCandidates.length === 0) {
		return <FirstExpenseEmpty onCapture={onCapture} onManual={onManual} />;
	}

	const max = categories[0]?.filteredTotal || 1;
	const month = new Intl.DateTimeFormat(language, { month: "long" }).format(
		new Date(),
	);
	const monthName = month.slice(0, 1).toUpperCase() + month.slice(1);
	const upcomingPlans = [...plans]
		.sort((left, right) => {
			if (!left.due_date) return 1;
			if (!right.due_date) return -1;
			return left.due_date.localeCompare(right.due_date);
		})
		.slice(0, 3);
	const plannedTotal = plans.reduce(
		(sum, plan) => sum + (plan.expected_amount || 0),
		0,
	);
	return (
		<section className="mini-view mini-overview">
			<div className="mini-title">
				<p>Привет{user?.name ? `, ${user.name.split(" ")[0]}` : ""}</p>
				<h1>{monthName}</h1>
			</div>
			<div className="mini-overview-grid">
				<div className="mini-overview-summary">
					<div className="mini-total">
						<span>В этом месяце</span>
						<strong>{formatMoney(total, currency)}</strong>
						<small>
							{expenses.length} {expenseWord(expenses.length)}
						</small>
					</div>
					{pendingCandidates.length > 0 && (
						<section className="mini-pending-reviews">
							<div className="mini-section-head">
								<h2>{uiText(language, "pendingReviews")}</h2>
								<small>{pendingCandidates.length}</small>
							</div>
							<div className="mini-pending-review-list">
								{pendingCandidates.map((candidate) => {
									const data = candidate.structured_data || {};
									const isPlan =
										candidate.candidate_type === "purchase_plan_candidate";
									const amount = readNumber(
										data,
										"expected_amount",
										"total",
										"total_amount",
										"amount",
									);
									const candidateCurrency =
										readString(data, "source_currency", "currency") || currency;
									return (
										<button
											key={candidate.id}
											type="button"
											onClick={() => onReviewCandidate(candidate)}
										>
											<span className="mini-pending-review-icon">
												{isPlan ? (
													<ShoppingBagOpen size={18} />
												) : (
													<Receipt size={18} />
												)}
											</span>
											<span className="mini-pending-review-copy">
												<b>
													{candidate.title ||
														uiText(
															language,
															isPlan ? "recognizedPlan" : "recognizedExpense",
														)}
												</b>
												<small>
													{uiText(
														language,
														isPlan ? "pendingPlan" : "notSaved",
													)}
												</small>
											</span>
											{amount > 0 && (
												<strong>
													{formatMoney(amount, candidateCurrency)}
												</strong>
											)}
										</button>
									);
								})}
							</div>
						</section>
					)}
					{upcomingPlans.length > 0 && (
						<section className="mini-home-plans">
							<div className="mini-section-head">
								<span>
									<h2>{uiText(language, "upcomingPlans")}</h2>
									{plannedTotal > 0 && (
										<small>
											{uiText(language, "plannedTotal")}{" "}
											{formatMoney(plannedTotal, currency)}
										</small>
									)}
								</span>
								<button type="button" onClick={onPlans}>
									{uiText(language, "all")}
								</button>
							</div>
							<div className="mini-home-plan-list">
								{upcomingPlans.map((plan) => (
									<div key={plan.id}>
										<button type="button" onClick={() => onEditPlan(plan)}>
											<b>{plan.title}</b>
											<small>
												{plan.due_date
													? formatPlanDate(plan.due_date, language)
													: uiText(language, "someday")}
											</small>
										</button>
										<button
											className="mini-home-plan-buy"
											type="button"
											onClick={() => onBuyPlan(plan)}
											aria-label={uiText(language, "bought")}
										>
											<Check size={17} weight="bold" />
										</button>
									</div>
								))}
							</div>
						</section>
					)}
					<div className="mini-section-head">
						<h2>По категориям</h2>
						<ChartDonut size={20} />
					</div>
					<div className="mini-category-bars">
						{categories.slice(0, 5).map((category) => (
							<button
								key={category.id}
								type="button"
								onClick={() => onCategory(category.id, "month")}
							>
								<span>
									<b>{localizedCategoryName(category, language)}</b>
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
							<Empty text="В этом месяце расходов пока нет" />
						)}
					</div>
					{budgets.length > 0 && (
						<>
							<div className="mini-section-head">
								<h2>Лимиты</h2>
							</div>
							<div className="mini-budget-list">
								{budgets.map((category) => {
									const limit = category.budget_amount || 0;
									const spent = category.budget_spent || 0;
									const percent = Math.min(
										100,
										category.budget_percent ||
											(limit > 0 ? (spent / limit) * 100 : 0),
									);
									return (
										<button
											key={category.id}
											type="button"
											onClick={() =>
												onCategory(
													category.id,
													category.budget_period === "week" ? "week" : "month",
												)
											}
										>
											<span>
												<b>{localizedCategoryName(category, language)}</b>
												<em>
													{formatMoney(spent, currency)} из{" "}
													{formatMoney(limit, currency)}
												</em>
											</span>
											<i>
												<b style={{ width: `${percent}%` }} />
											</i>
										</button>
									);
								})}
							</div>
						</>
					)}
				</div>
				<div className="mini-overview-recent">
					<div className="mini-section-head">
						<h2>Последние</h2>
						<button type="button" onClick={onExpenses}>
							Все
						</button>
					</div>
					<ExpenseList
						expenses={latestExpenses.slice(0, 4)}
						captures={captures}
						currency={currency}
						onEdit={(expense) => onExpense(expense.id)}
					/>
				</div>
			</div>
		</section>
	);
};

const FirstExpenseEmpty = ({
	onCapture,
	onManual,
}: {
	onCapture: (mode?: CaptureMode) => void;
	onManual: () => void;
}) => (
	<section className="mini-first-expense">
		<div className="mini-first-expense-mark">
			<img className="mini-brand-mark" src={BRAND_LOGO_URL} alt="" />
		</div>
		<div className="mini-first-expense-copy">
			<p>Личное пространство готово</p>
			<h1>Добавьте первый расход</h1>
			<span>Напишите сумму, скажите её голосом или сфотографируйте чек.</span>
		</div>
		<button
			className="mini-first-expense-primary"
			type="button"
			onClick={() => onCapture()}
		>
			<Plus size={20} weight="bold" />
			Добавить расход
		</button>
		<div className="mini-first-expense-label">Или сразу</div>
		<div className="mini-first-expense-actions">
			<button type="button" onClick={() => onCapture("text")}>
				<ChatCircleText size={22} />
				Текст
			</button>
			<button type="button" onClick={() => onCapture("voice")}>
				<Microphone size={22} />
				Голос
			</button>
			<button type="button" onClick={() => onCapture("photo")}>
				<Camera size={22} />
				Фото
			</button>
			<button type="button" onClick={onManual}>
				<NotePencil size={22} />
				Вручную
			</button>
		</div>
	</section>
);

const ExpensesView = ({
	items,
	section,
	plans,
	language,
	categories,
	vendors,
	captures,
	currency,
	period,
	dateFrom,
	dateTo,
	expense,
	categoryID,
	vendorID,
	groupByExpense,
	query,
	onPeriod,
	onDateFrom,
	onDateTo,
	onClearExpense,
	onCategory,
	onVendor,
	onGrouping,
	onQuery,
	onSource,
	onEdit,
	onAdd,
	onSection,
	onAddPlan,
	onEditPlan,
	onBuyPlan,
}: {
	items: ExpenseItemRow[];
	section: ExpenseSection;
	plans: PurchasePlan[];
	language: UILanguage;
	categories: Category[];
	vendors: Vendor[];
	captures: CapturePacket[];
	currency: string;
	period: Period;
	dateFrom: string;
	dateTo: string;
	expense?: Expense;
	categoryID: number;
	vendorID: number;
	groupByExpense: boolean;
	query: string;
	onPeriod: (period: Period) => void;
	onDateFrom: (value: string) => void;
	onDateTo: (value: string) => void;
	onClearExpense: () => void;
	onCategory: (id: number) => void;
	onVendor: (id: number) => void;
	onGrouping: (group: boolean) => void;
	onQuery: (value: string) => void;
	onSource: (expense: Expense) => void;
	onEdit: (item: ExpenseItemRow) => void;
	onAdd: () => void;
	onSection: (section: ExpenseSection) => void;
	onAddPlan: () => void;
	onEditPlan: (plan: PurchasePlan) => void;
	onBuyPlan: (plan: PurchasePlan) => void;
}) => {
	const [filtersOpen, setFiltersOpen] = useState(false);
	const activeCategory = categories.find(({ id }) => id === categoryID);
	const activeVendor = vendors.find(({ id }) => id === vendorID);
	const activeFilterCount =
		Number(Boolean(activeCategory)) + Number(Boolean(activeVendor));

	return (
		<section className="mini-view mini-expenses-view">
			<div className="mini-title-row">
				<div className="mini-title">
					<p>
						{section === "history"
							? uiText(language, "expenseHistoryEyebrow")
							: uiText(language, "plansEyebrow")}
					</p>
					<h1>{uiText(language, "navExpenses")}</h1>
				</div>
				<button
					className="mini-add-button"
					type="button"
					onClick={() => (section === "history" ? onAdd() : onAddPlan())}
				>
					<Plus size={18} weight="bold" />
					{uiText(language, "add")}
				</button>
			</div>
			<div className="mini-expense-sections" role="tablist">
				<button
					className={section === "history" ? "active" : ""}
					type="button"
					role="tab"
					aria-selected={section === "history"}
					onClick={() => onSection("history")}
				>
					{uiText(language, "history")}
				</button>
				<button
					className={section === "plans" ? "active" : ""}
					type="button"
					role="tab"
					aria-selected={section === "plans"}
					onClick={() => onSection("plans")}
				>
					{uiText(language, "plans")}
					{plans.length > 0 && <b>{plans.length}</b>}
				</button>
			</div>
			{section === "plans" ? (
				<PlansView
					plans={plans}
					categories={categories}
					language={language}
					onAdd={onAddPlan}
					onEdit={onEditPlan}
					onBuy={onBuyPlan}
				/>
			) : (
				<>
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
											(itemAmountInCurrency(row.item, row.expense, currency) ??
												0),
										0,
									),
									currency,
								)}
							</strong>
						</div>
					</div>
					<div className="mini-filter-bar">
						<select
							aria-label={uiText(language, "periodLabel")}
							value={period}
							onChange={(event) => onPeriod(event.target.value as Period)}
						>
							<option value="today">{uiText(language, "periodToday")}</option>
							<option value="three-days">
								{uiText(language, "periodThreeDays")}
							</option>
							<option value="week">{uiText(language, "periodWeek")}</option>
							<option value="month">{uiText(language, "periodMonth")}</option>
							<option value="three-months">
								{uiText(language, "periodThreeMonths")}
							</option>
							<option value="six-months">
								{uiText(language, "periodSixMonths")}
							</option>
							<option value="year">{uiText(language, "periodYear")}</option>
							<option value="all">{uiText(language, "periodAll")}</option>
							<option value="custom">{uiText(language, "periodCustom")}</option>
						</select>
						<button
							type="button"
							aria-expanded={filtersOpen}
							aria-controls="expense-filters"
							onClick={() => setFiltersOpen((open) => !open)}
						>
							<FunnelSimple size={17} />
							Фильтры
							{activeFilterCount > 0 && <b>{activeFilterCount}</b>}
						</button>
					</div>
					{period === "custom" && (
						<div className="mini-date-range">
							<label>
								<span>{uiText(language, "dateFrom")}</span>
								<input
									type="date"
									max={dateTo || undefined}
									value={dateFrom}
									onChange={(event) => onDateFrom(event.target.value)}
								/>
							</label>
							<label>
								<span>{uiText(language, "dateTo")}</span>
								<input
									type="date"
									min={dateFrom || undefined}
									value={dateTo}
									onChange={(event) => onDateTo(event.target.value)}
								/>
							</label>
						</div>
					)}
					{(activeCategory || activeVendor) && (
						<div className="mini-filter-chips" aria-label="Активные фильтры">
							{activeCategory && (
								<button type="button" onClick={() => onCategory(0)}>
									{localizedCategoryName(activeCategory, language)}
									<X size={13} />
								</button>
							)}
							{activeVendor && (
								<button type="button" onClick={() => onVendor(0)}>
									{activeVendor.name}
									<X size={13} />
								</button>
							)}
						</div>
					)}
					{filtersOpen && (
						<div className="mini-filter-panel" id="expense-filters">
							<div className="mini-filters">
								<select
									aria-label="Категория"
									value={categoryID}
									onChange={(event) => onCategory(Number(event.target.value))}
								>
									<option value={0}>Все категории</option>
									{categories.map((category) => (
										<option key={category.id} value={category.id}>
											{localizedCategoryName(category, language)}
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
							<div
								className="mini-expense-mode"
								role="group"
								aria-label="Вид расходов"
							>
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
						</div>
					)}
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
				</>
			)}
		</section>
	);
};

const PlansView = ({
	plans,
	categories,
	language,
	onAdd,
	onEdit,
	onBuy,
}: {
	plans: PurchasePlan[];
	categories: Category[];
	language: UILanguage;
	onAdd: () => void;
	onEdit: (plan: PurchasePlan) => void;
	onBuy: (plan: PurchasePlan) => void;
}) => {
	const dated = plans.filter((plan) => plan.due_date);
	const withoutDate = plans.filter((plan) => !plan.due_date);
	const renderPlan = (plan: PurchasePlan) => {
		const category = categories.find((item) => item.id === plan.category_id);
		return (
			<div className="mini-plan-row" key={plan.id}>
				<span className="mini-plan-icon">
					<ShoppingBagOpen size={20} />
				</span>
				<button
					className="mini-plan-copy"
					type="button"
					onClick={() => onEdit(plan)}
				>
					<b>{plan.title}</b>
					<small>
						{category
							? localizedCategoryName(category, language)
							: uiText(language, "categoryNotSet")}
						{plan.due_date
							? ` · ${formatPlanDate(plan.due_date, language)}`
							: ""}
					</small>
				</button>
				<div className="mini-plan-actions">
					{plan.expected_amount ? (
						<strong>{formatMoney(plan.expected_amount, plan.currency)}</strong>
					) : (
						<small>{uiText(language, "amountNotSet")}</small>
					)}
					<button type="button" onClick={() => onBuy(plan)}>
						<Check size={15} weight="bold" />
						{uiText(language, "bought")}
					</button>
				</div>
			</div>
		);
	};

	if (plans.length === 0) {
		return (
			<div className="mini-plans-empty">
				<span>
					<CalendarBlank size={26} />
				</span>
				<h2>{uiText(language, "noPlans")}</h2>
				<p>{uiText(language, "noPlansHint")}</p>
				<button type="button" onClick={onAdd}>
					<Plus size={17} weight="bold" />
					{uiText(language, "addPlan")}
				</button>
			</div>
		);
	}

	return (
		<div className="mini-plan-groups">
			{dated.length > 0 && (
				<section>
					<h2>{uiText(language, "withDate")}</h2>
					<div className="mini-plan-list">{dated.map(renderPlan)}</div>
				</section>
			)}
			{withoutDate.length > 0 && (
				<section>
					<h2>{uiText(language, "someday")}</h2>
					<div className="mini-plan-list">{withoutDate.map(renderPlan)}</div>
				</section>
			)}
		</div>
	);
};

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
	language,
	onOpen,
	onEdit,
	onAdd,
}: {
	categories: Category[];
	currency: string;
	language: UILanguage;
	onOpen: (id: number) => void;
	onEdit: (category: Category) => void;
	onAdd: () => void;
}) => (
	<section className="mini-view mini-categories-view">
		<div className="mini-title-row">
			<div className="mini-title">
				<p>{uiText(language, "categoriesEyebrow")}</p>
				<h1>{uiText(language, "categoriesTitle")}</h1>
			</div>
			<button className="mini-add-button" type="button" onClick={onAdd}>
				<Plus size={18} weight="bold" />
				{uiText(language, "add")}
			</button>
		</div>
		<p className="mini-intro">{uiText(language, "categoriesIntro")}</p>
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
							<b>{localizedCategoryName(category, language)}</b>
							<small>
								{category.budget_amount
									? `${uiText(language, "remaining")} ${formatMoney(category.budget_remaining || 0, currency)} · ${uiText(language, category.budget_period === "week" ? "forWeek" : "forMonth")}`
									: uiText(language, "limitNotSet")}
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
						aria-label={
							category.budget_amount
								? `${uiText(language, "configure")} ${localizedCategoryName(category, language)}`
								: `${uiText(language, "setLimitFor")} ${localizedCategoryName(category, language)}`
						}
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
	<section className="mini-view mini-vendors-view">
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
	onBack,
	onEdit,
	onInvite,
	inviting,
	onAdd,
}: {
	spaces: Space[];
	activeSpaceID: number;
	members: SpaceMember[];
	onSelect: (id: number) => void;
	onBack: () => void;
	onEdit: (space: Space) => void;
	onInvite?: (space: Space) => void;
	inviting: boolean;
	onAdd: () => void;
}) => {
	const activeSpace = spaces.find((space) => space.id === activeSpaceID);
	return (
		<section className="mini-view mini-spaces-view">
			<button className="mini-back-link" type="button" onClick={onBack}>
				<ArrowLeft size={18} />
				Профиль
			</button>
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
	language,
	quota,
	vendorsCount,
	spacesCount,
	homeScreenStatus,
	onEdit,
	onManageVendors,
	onManageSpaces,
	onLinkEmail,
	onLinkTelegram,
	onLogout,
	onInstall,
	onStartPlus,
	onBuyPack,
	onDevUpdate,
	billingLoading,
}: {
	user: User | null;
	language: UILanguage;
	quota: Quota | null;
	vendorsCount: number;
	spacesCount: number;
	homeScreenStatus: HomeScreenStatus;
	onEdit: () => void;
	onManageVendors: () => void;
	onManageSpaces: () => void;
	onLinkEmail: () => void;
	onLinkTelegram: () => void;
	onLogout?: () => void;
	onInstall: () => void;
	onStartPlus: () => void;
	onBuyPack: () => void;
	onDevUpdate: (patch: DeveloperQuotaPatch) => void;
	billingLoading: boolean;
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
			? uiText(language, "checking")
			: homeScreenStatus === "unsupported"
				? uiText(language, "unavailable")
				: homeScreenStatus === "added"
					? uiText(language, "added")
					: uiText(language, "add");
	const linkedEmail =
		user?.emailVerified && !user.email.endsWith("@telegram.local")
			? user.email
			: "";
	return (
		<section className="mini-view mini-profile-view">
			<div className="mini-profile-head">
				<span>
					{(user?.name || uiText(language, "user")).slice(0, 1).toUpperCase()}
				</span>
				<div>
					<h1>{user?.name || uiText(language, "user")}</h1>
					<p>
						{user?.telegramUsername ? `@${user.telegramUsername}` : "Telegram"}
					</p>
				</div>
				<button
					type="button"
					aria-label={uiText(language, "editProfile")}
					onClick={onEdit}
				>
					<PencilSimple size={19} />
				</button>
			</div>
			<div className="mini-plan">
				<div>
					<span>{uiText(language, "plan")}</span>
					<strong>{uiText(language, plus ? "plus" : "basic")}</strong>
				</div>
				<b>{plus ? "249 ₽ / 30 дней" : "0 ₽"}</b>
				{quota?.plan_expires_at && (
					<small className="mini-plan-expiry">
						Закончится {formatDateTime(quota.plan_expires_at, language)}
					</small>
				)}
				<div className="mini-progress">
					<i style={{ width: `${progress}%` }} />
				</div>
				<p>
					<span>
						{uiText(language, "used")} {used} / {limit}
					</span>
					<span>
						{uiText(language, "left")} {quota?.remaining ?? limit}
					</span>
				</p>
			</div>
			<div className="mini-profile-actions">
				<button type="button" disabled={billingLoading} onClick={onStartPlus}>
					{billingLoading
						? uiText(language, "checking")
						: uiText(language, plus ? "extend" : "connectPlus")}
				</button>
				<button className="secondary" type="button" onClick={onBuyPack}>
					{uiText(language, "buyPack")}
				</button>
			</div>
			{quota?.dev_tools_enabled && (
				<BillingDeveloperTools
					quota={quota}
					loading={billingLoading}
					onApply={onDevUpdate}
				/>
			)}
			<div className="mini-profile-list">
				<button
					type="button"
					onClick={onLinkTelegram}
					disabled={Boolean(user?.telegramId)}
				>
					<span>
						<PaperPlaneTilt size={18} />
						Telegram
					</span>
					<b>
						{user?.telegramId
							? user.telegramUsername
								? `@${user.telegramUsername}`
								: "Привязан"
							: "Привязать"}
					</b>
				</button>
				<button type="button" onClick={onLinkEmail}>
					<span>
						<PaperPlaneTilt size={18} />
						Почта для входа
					</span>
					<b>{linkedEmail || "Привязать"}</b>
				</button>
				<div>
					<span>{uiText(language, "currency")}</span>
					<b>{user?.currency || "RUB"}</b>
				</div>
				<div>
					<span>{uiText(language, "country")}</span>
					<b>{localizedRegionName(user?.country || "RU", language)}</b>
				</div>
				<div>
					<span>{uiText(language, "language")}</span>
					<b>{languageOptions.find(([code]) => code === language)?.[1]}</b>
				</div>
				<div>
					<span>{uiText(language, "timezone")}</span>
					<b>
						{localizedTimezoneName(user?.timezone || "Europe/Moscow", language)}
					</b>
				</div>
				<button type="button" onClick={onManageSpaces}>
					<span>
						<UsersThree size={18} />
						{uiText(language, "spaces")}
					</span>
					<b>{spacesCount}</b>
				</button>
				<button type="button" onClick={onManageVendors}>
					<span>
						<Storefront size={18} />
						{uiText(language, "vendors")}
					</span>
					<b>{vendorsCount}</b>
				</button>
				<button type="button" onClick={onInstall} disabled={installDisabled}>
					<span>
						<House size={18} />
						{uiText(language, "homeShortcut")}
					</span>
					<b>{installStatus}</b>
				</button>
				{onLogout && (
					<button type="button" onClick={onLogout}>
						<span>
							<SignOut size={18} />
							Выйти
						</span>
					</button>
				)}
			</div>
		</section>
	);
};

const BillingDeveloperTools = ({
	quota,
	loading,
	onApply,
}: {
	quota: Quota;
	loading: boolean;
	onApply: (patch: DeveloperQuotaPatch) => void;
}) => (
	<details className="mini-dev-tools">
		<summary>Инструменты разработчика</summary>
		<fieldset disabled={loading}>
			<form
				key={`${quota.plan}-${quota.plan_expires_at}-${quota.recurring_limit}-${quota.additional_limit}`}
				onSubmit={(event) => {
					event.preventDefault();
					const data = new FormData(event.currentTarget);
					const expiresAt = String(data.get("expires_at") || "");
					onApply({
						plan: String(data.get("plan")) === "plus" ? "plus" : "free",
						plan_expires_at: expiresAt ? new Date(expiresAt).toISOString() : "",
						recurring_limit: Number(data.get("recurring_limit")),
						additional_limit: Number(data.get("additional_limit")),
					});
				}}
			>
				<label>
					Тариф
					<select
						name="plan"
						defaultValue={quota.plan === "plus" ? "plus" : "free"}
					>
						<option value="free">Базовый</option>
						<option value="plus">Плюс</option>
					</select>
				</label>
				<label>
					Дата и время окончания
					<input
						type="datetime-local"
						name="expires_at"
						defaultValue={dateTimeInputValue(quota.plan_expires_at)}
					/>
				</label>
				<label>
					Лимит тарифа
					<input
						type="number"
						name="recurring_limit"
						min="0"
						defaultValue={quota.recurring_limit || 0}
					/>
				</label>
				<label>
					Дополнительный лимит
					<input
						type="number"
						name="additional_limit"
						min="0"
						defaultValue={quota.additional_limit || 0}
					/>
				</label>
				<button type="submit">Применить</button>
			</form>
			<div className="mini-dev-actions">
				<button
					type="button"
					onClick={() =>
						onApply({
							plan: "plus",
							plan_expires_at: new Date(Date.now() + 2 * 60_000).toISOString(),
							recurring_limit: 500,
						})
					}
				>
					Плюс на 2 минуты
				</button>
				<button
					type="button"
					onClick={() =>
						onApply({ plan: "free", plan_expires_at: "", recurring_limit: 100 })
					}
				>
					Отменить Плюс
				</button>
			</div>
			<form
				className="mini-dev-inline"
				onSubmit={(event) => {
					event.preventDefault();
					const units = Number(new FormData(event.currentTarget).get("units"));
					onApply({ additional_units: units });
				}}
			>
				<select
					name="units"
					aria-label="Размер тестового пакета"
					defaultValue="100"
				>
					<option value="100">Пакет 100</option>
					<option value="220">Пакет 220</option>
					<option value="600">Пакет 600</option>
					<option value="1300">Пакет 1300</option>
				</select>
				<button type="submit">Добавить</button>
				<button type="button" onClick={() => onApply({ additional_limit: 0 })}>
					Сбросить
				</button>
			</form>
			<form
				className="mini-dev-inline"
				onSubmit={(event) => {
					event.preventDefault();
					onApply({
						notification: new FormData(event.currentTarget).get(
							"notification",
						) as DeveloperQuotaPatch["notification"],
					});
				}}
			>
				<select name="notification" aria-label="Тип тестового уведомления">
					<option value="subscription_expiring">Подписка заканчивается</option>
					<option value="subscription_expired">Подписка закончилась</option>
					<option value="quota_low">Лимит скоро закончится</option>
					<option value="quota_exhausted">Лимит закончился</option>
				</select>
				<button type="submit">Отправить</button>
			</form>
		</fieldset>
	</details>
);

const billingPacks = [
	{ code: "pack_100", price: 100, units: 100 },
	{ code: "pack_220", price: 200, units: 220 },
	{ code: "pack_600", price: 500, units: 600 },
	{ code: "pack_1300", price: 1000, units: 1300 },
];

const BillingPackPicker = ({
	language,
	loading,
	onClose,
	onSelect,
}: {
	language: UILanguage;
	loading: boolean;
	onClose: () => void;
	onSelect: (code: string) => void;
}) => {
	const unitsLabel =
		language === "en"
			? "extra uses"
			: language === "es"
				? "usos extra"
				: "дополнительных обработок";
	return (
		<Modal title={uiText(language, "buyPack")} onClose={onClose}>
			<div className="mini-billing-packs">
				{billingPacks.map((pack) => (
					<button
						type="button"
						key={pack.code}
						disabled={loading}
						onClick={() => onSelect(pack.code)}
					>
						<span>
							+{pack.units} {unitsLabel}
						</span>
						<strong>{pack.price} ₽</strong>
					</button>
				))}
			</div>
			<p className="mini-modal-note">
				{language === "ru"
					? "Пакет увеличивает доступный лимит и не продлевает Плюс."
					: language === "es"
						? "El paquete aumenta el límite y no renueva Plus."
						: "The pack increases your allowance and does not renew Plus."}
			</p>
		</Modal>
	);
};

const CaptureComposer = ({
	purpose,
	initialMode,
	saving,
	error,
	onClose,
	onManual,
	onSubmit,
}: {
	purpose: CapturePurpose;
	initialMode: CaptureMode;
	saving: boolean;
	error: string;
	onClose: () => void;
	onManual: () => void;
	onSubmit: (submission: CaptureSubmission) => Promise<void>;
}) => {
	const isPlan = purpose === "purchase_plan";
	const [mode, setMode] = useState<CaptureMode>(initialMode);
	const [text, setText] = useState("");
	const [recording, setRecording] = useState(false);
	const [seconds, setSeconds] = useState(0);
	const [voiceFile, setVoiceFile] = useState<File | null>(null);
	const [voiceURL, setVoiceURL] = useState("");
	const [localError, setLocalError] = useState("");
	const photoInput = useRef<HTMLInputElement>(null);
	const recorder = useRef<MediaRecorder | null>(null);
	const stream = useRef<MediaStream | null>(null);
	const chunks = useRef<Blob[]>([]);
	const timer = useRef(0);
	const timeout = useRef(0);

	const clearRecordingTimers = () => {
		window.clearInterval(timer.current);
		window.clearTimeout(timeout.current);
	};
	const stopTracks = () => {
		for (const track of stream.current?.getTracks() || []) track.stop();
		stream.current = null;
	};
	const stopRecording = () => {
		if (recorder.current?.state === "recording") recorder.current.stop();
	};

	useEffect(
		() => () => {
			clearRecordingTimers();
			if (recorder.current?.state === "recording") {
				recorder.current.onstop = null;
				recorder.current.stop();
			}
			stopTracks();
		},
		[],
	);

	useEffect(
		() => () => {
			if (voiceURL) URL.revokeObjectURL(voiceURL);
		},
		[voiceURL],
	);

	const startRecording = async () => {
		setLocalError("");
		if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
			setLocalError("Запись голоса не поддерживается на этом устройстве");
			return;
		}
		try {
			const audioStream = await navigator.mediaDevices.getUserMedia({
				audio: true,
			});
			stream.current = audioStream;
			const mimeType = [
				"audio/webm;codecs=opus",
				"audio/mp4",
				"audio/webm",
			].find((type) => MediaRecorder.isTypeSupported(type));
			const nextRecorder = new MediaRecorder(
				audioStream,
				mimeType ? { mimeType } : undefined,
			);
			chunks.current = [];
			nextRecorder.ondataavailable = (event) => {
				if (event.data.size > 0) chunks.current.push(event.data);
			};
			nextRecorder.onstop = () => {
				clearRecordingTimers();
				stopTracks();
				setRecording(false);
				const type = nextRecorder.mimeType || mimeType || "audio/webm";
				const blob = new Blob(chunks.current, { type });
				if (blob.size === 0) {
					setLocalError("Не удалось записать голос");
					return;
				}
				const extension = type.includes("mp4") ? "m4a" : "webm";
				const file = new File([blob], `voice.${extension}`, { type });
				setVoiceFile(file);
				setVoiceURL(URL.createObjectURL(file));
			};
			recorder.current = nextRecorder;
			setVoiceFile(null);
			setVoiceURL("");
			setSeconds(0);
			setRecording(true);
			const startedAt = Date.now();
			timer.current = window.setInterval(
				() =>
					setSeconds(Math.min(60, Math.floor((Date.now() - startedAt) / 1000))),
				250,
			);
			timeout.current = window.setTimeout(() => nextRecorder.stop(), 60_000);
			nextRecorder.start();
		} catch {
			clearRecordingTimers();
			stopTracks();
			setRecording(false);
			setLocalError("Разрешите доступ к микрофону и попробуйте ещё раз");
		}
	};

	const selectPhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		event.target.value = "";
		if (!file) return;
		if (!file.type.startsWith("image/")) {
			setLocalError("Выберите фотографию");
			return;
		}
		if (file.size > 15 * 1024 * 1024) {
			setLocalError("Фотография должна быть меньше 15 МБ");
			return;
		}
		setLocalError("");
		await onSubmit({ kind: "image", file });
	};

	const title =
		mode === "text"
			? isPlan
				? "Описать план"
				: "Написать расход"
			: mode === "voice"
				? "Записать голосом"
				: mode === "photo"
					? isPlan
						? "Фото покупки"
						: "Фото чека"
					: isPlan
						? "Добавить план"
						: "Добавить расход";
	return (
		<Modal title={title} onClose={onClose}>
			{mode === "choose" && (
				<div className="capture-choice">
					<button
						type="button"
						disabled={saving}
						onClick={() => setMode("text")}
					>
						<ChatCircleText size={25} />
						<span>Текст</span>
					</button>
					<button
						type="button"
						disabled={saving}
						onClick={() => setMode("voice")}
					>
						<Microphone size={25} />
						<span>Голос</span>
					</button>
					<button
						type="button"
						disabled={saving}
						onClick={() => photoInput.current?.click()}
					>
						<Camera size={25} />
						<span>Фото</span>
					</button>
					<button type="button" disabled={saving} onClick={onManual}>
						<NotePencil size={25} />
						<span>Вручную</span>
					</button>
				</div>
			)}

			{mode === "text" && (
				<div className="capture-composer">
					<textarea
						maxLength={2000}
						placeholder={
							isPlan
								? "Купить кроссовки за 8 000 ₽ к августу"
								: "Кофе 350, такси 620"
						}
						value={text}
						onChange={(event) => setText(event.target.value)}
					/>
					<div className="capture-actions">
						<button
							type="button"
							disabled={saving}
							onClick={() => setMode("choose")}
						>
							Назад
						</button>
						<button
							className="capture-submit"
							type="button"
							disabled={saving || !text.trim()}
							onClick={() => void onSubmit({ kind: "text", text })}
						>
							<PaperPlaneTilt size={18} />
							{saving ? "Разбираем…" : "Отправить"}
						</button>
					</div>
				</div>
			)}

			{mode === "voice" && (
				<div className="capture-composer capture-voice">
					<div className={`capture-mic${recording ? " recording" : ""}`}>
						<Microphone size={34} weight="fill" />
					</div>
					<strong aria-live="polite">
						{recording
							? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} / 1:00`
							: "До 1 минуты"}
					</strong>
					{voiceURL && (
						// biome-ignore lint/a11y/useMediaCaption: no transcript exists before upload
						<audio controls src={voiceURL} />
					)}
					{!recording && !voiceFile && (
						<button
							className="capture-record"
							type="button"
							onClick={() => void startRecording()}
						>
							Начать запись
						</button>
					)}
					{recording && (
						<button
							className="capture-record recording"
							type="button"
							onClick={stopRecording}
						>
							Остановить
						</button>
					)}
					<div className="capture-actions">
						<button
							type="button"
							disabled={saving || recording}
							onClick={() => {
								setVoiceFile(null);
								setVoiceURL("");
								setMode("choose");
							}}
						>
							Назад
						</button>
						{voiceFile && (
							<button
								className="capture-submit"
								type="button"
								disabled={saving}
								onClick={() =>
									void onSubmit({ kind: "voice", file: voiceFile })
								}
							>
								<PaperPlaneTilt size={18} />
								{saving ? "Разбираем…" : "Отправить"}
							</button>
						)}
					</div>
				</div>
			)}

			{mode === "photo" && (
				<div className="capture-composer capture-photo">
					<div className="capture-photo-mark">
						<Camera size={34} weight="bold" />
					</div>
					<strong>
						{isPlan ? "Сфотографируйте будущую покупку" : "Сфотографируйте чек"}
					</strong>
					<small>
						{isPlan
							? "Мы распознаем, что это и сколько может стоить"
							: "Убедитесь, что видны все позиции и итог"}
					</small>
					<button
						className="capture-record"
						type="button"
						disabled={saving}
						onClick={() => photoInput.current?.click()}
					>
						Выбрать фото
					</button>
					<div className="capture-actions capture-photo-actions">
						<button
							type="button"
							disabled={saving}
							onClick={() => setMode("choose")}
						>
							Назад
						</button>
					</div>
				</div>
			)}

			<input
				ref={photoInput}
				className="capture-file-input"
				type="file"
				accept="image/*"
				capture="environment"
				onChange={(event) => void selectPhoto(event)}
			/>
			{saving && mode === "choose" && (
				<div className="capture-processing">
					{isPlan ? "Разбираем план…" : "Разбираем расход…"}
				</div>
			)}
			{(localError || error) && (
				<div className="mini-alert">{localError || error}</div>
			)}
		</Modal>
	);
};

const PlanEditor = ({
	plan,
	language,
	categories,
	saving,
	fromCandidate,
	onChange,
	onClose,
	onSave,
	onDelete,
}: {
	plan: PurchasePlan;
	language: UILanguage;
	categories: Category[];
	saving: boolean;
	fromCandidate?: boolean;
	onChange: (plan: PurchasePlan) => void;
	onClose: () => void;
	onSave: () => void;
	onDelete?: () => void;
}) => (
	<Modal
		title={
			fromCandidate
				? "Проверить план"
				: plan.id
					? uiText(language, "editPlan")
					: uiText(language, "newPlan")
		}
		onClose={onClose}
	>
		{fromCandidate && (
			<div className="mini-review-kind">
				<ShoppingBagOpen size={18} />
				<span>План покупки · проверьте перед сохранением</span>
			</div>
		)}
		<p className="mini-field-note">{uiText(language, "planEditorHint")}</p>
		<label>
			{uiText(language, "planWhat")}
			<input
				value={plan.title}
				placeholder={uiText(language, "planWhatPlaceholder")}
				onChange={(event) => onChange({ ...plan, title: event.target.value })}
			/>
		</label>
		<div className="mini-field">
			<span>{uiText(language, "expectedAmount")}</span>
			<AmountInput
				ariaLabel={uiText(language, "expectedAmount")}
				amount={plan.expected_amount || 0}
				onChange={(amount) =>
					onChange({ ...plan, expected_amount: amount || null })
				}
			/>
			<small className="mini-field-hint">
				{uiText(language, "expectedAmountHint")}
			</small>
		</div>
		<label>
			{uiText(language, "category")}
			<select
				value={plan.category_id || 0}
				onChange={(event) =>
					onChange({
						...plan,
						category_id: Number(event.target.value) || null,
					})
				}
			>
				<option value={0}>{uiText(language, "categoryNotSet")}</option>
				{categories.map((category) => (
					<option key={category.id} value={category.id}>
						{localizedCategoryName(category, language)}
					</option>
				))}
			</select>
		</label>
		<label>
			{uiText(language, "plannedDate")}
			<input
				type="date"
				value={plan.due_date?.slice(0, 10) || ""}
				onChange={(event) =>
					onChange({ ...plan, due_date: event.target.value || null })
				}
			/>
			<small className="mini-field-hint">
				{uiText(language, "plannedDateHint")}
			</small>
		</label>
		<div className="mini-modal-actions">
			<button
				className="mini-save"
				type="button"
				disabled={saving || !plan.title.trim()}
				onClick={onSave}
			>
				{saving ? uiText(language, "saving") : uiText(language, "save")}
			</button>
			{onDelete && (
				<button
					className="mini-delete"
					type="button"
					disabled={saving}
					onClick={onDelete}
				>
					<Trash size={18} />
					{uiText(language, "deletePlan")}
				</button>
			)}
		</div>
	</Modal>
);

const ExpenseEditor = ({
	expense,
	language,
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
	language: UILanguage;
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
			{creating && (
				<label htmlFor="new-expense-amount">
					Сумма
					<AmountInput
						ariaLabel="Сумма"
						amount={expense.items[0]?.amount || 0}
						id="new-expense-amount"
						onChange={(amount) =>
							onChange({
								...expense,
								items: expense.items.map((item, index) =>
									index === 0 ? { ...item, amount } : item,
								),
							})
						}
					/>
				</label>
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
						{!creating && (
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
						)}
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
									{localizedCategoryName(category, language)}
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
	language,
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
	onPlanAgain,
	onDelete,
}: {
	expense: Expense;
	language: UILanguage;
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
	onPlanAgain: () => void;
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
							{localizedCategoryName(category, language)}
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
				<button
					className="mini-secondary-action"
					type="button"
					disabled={saving}
					onClick={onPlanAgain}
				>
					<CalendarBlank size={18} />
					{uiText(language, "planAgain")}
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
	categories,
	language,
	saving,
	onChange,
	onClose,
	onSave,
	onMerge,
	onDelete,
}: {
	category: Category;
	categories: Category[];
	language: UILanguage;
	saving: boolean;
	onChange: (category: Category) => void;
	onClose: () => void;
	onSave: () => void;
	onMerge: (targetCategoryID: number) => void;
	onDelete?: () => void;
}) => {
	const [targetCategoryID, setTargetCategoryID] = useState(0);
	const mergeTargets = categories.filter((item) => item.id !== category.id);
	return (
		<Modal
			title={uiText(
				language,
				category.id === 0 ? "newCategory" : "editCategory",
			)}
			closeLabel={uiText(language, "close")}
			onClose={onClose}
		>
			<label>
				{uiText(language, "name")}
				<input
					maxLength={80}
					value={category.name}
					onChange={(event) =>
						onChange({ ...category, name: event.target.value })
					}
				/>
			</label>
			<label>
				{uiText(language, "synonyms")}
				<input
					maxLength={500}
					placeholder={uiText(language, "synonymsPlaceholder")}
					value={category.alias_text ?? category.aliases?.join(", ") ?? ""}
					onChange={(event) =>
						onChange({ ...category, alias_text: event.target.value })
					}
				/>
				<small className="mini-field-hint">
					{uiText(language, "synonymsHint")}
				</small>
			</label>
			<label>
				{uiText(language, "budget")}
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
					<option value="">{uiText(language, "noBudget")}</option>
					<option value="week">{uiText(language, "weekly")}</option>
					<option value="month">{uiText(language, "monthly")}</option>
				</select>
			</label>
			{category.budget_period && (
				<label>
					{uiText(language, "budgetAmount")}
					<input
						type="number"
						min="1"
						step="1"
						placeholder={uiText(language, "budgetPlaceholder")}
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
					{uiText(language, saving ? "saving" : "save")}
				</button>
				{category.id > 0 &&
					category.key !== "other" &&
					mergeTargets.length > 0 && (
						<div className="mini-vendor-merge">
							<strong>{uiText(language, "mergeCategories")}</strong>
							<label>
								{uiText(language, "mergeWith")}
								<select
									value={targetCategoryID}
									onChange={(event) =>
										setTargetCategoryID(Number(event.target.value))
									}
								>
									<option value={0}>{uiText(language, "mergeSelect")}</option>
									{mergeTargets.map((target) => (
										<option key={target.id} value={target.id}>
											{localizedCategoryName(target, language)}
										</option>
									))}
								</select>
							</label>
							<small>{uiText(language, "mergeHint")}</small>
							<button
								type="button"
								disabled={saving || !targetCategoryID}
								onClick={() => onMerge(targetCategoryID)}
							>
								{uiText(language, "merge")}
							</button>
						</div>
					)}
				{onDelete && (
					<button
						className="mini-delete"
						type="button"
						disabled={saving}
						onClick={onDelete}
					>
						<Trash size={18} />
						{uiText(language, "deleteCategory")}
					</button>
				)}
			</div>
		</Modal>
	);
};

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
}) => {
	const language = normalizeUILanguage(user.language);
	return (
		<Modal
			title={uiText(language, "profileSettings")}
			closeLabel={uiText(language, "close")}
			onClose={onClose}
		>
			<label>
				{uiText(language, "name")}
				<input
					maxLength={120}
					value={user.name}
					onChange={(event) => onChange({ ...user, name: event.target.value })}
				/>
			</label>
			<label>
				{uiText(language, "currency")}
				<select
					value={user.currency}
					onChange={(event) =>
						onChange({ ...user, currency: event.target.value })
					}
				>
					{!currencyOptions.some(([code]) => code === user.currency) && (
						<option value={user.currency}>{user.currency}</option>
					)}
					{currencyOptions.map(([code]) => (
						<option key={code} value={code}>
							{code} — {localizedCurrencyName(code, language)}
						</option>
					))}
				</select>
			</label>
			<label>
				{uiText(language, "country")}
				<select
					value={user.country}
					onChange={(event) =>
						onChange({ ...user, country: event.target.value })
					}
				>
					{!countryOptions.some(([code]) => code === user.country) && (
						<option value={user.country}>{user.country}</option>
					)}
					{countryOptions.map(([code]) => (
						<option key={code} value={code}>
							{localizedRegionName(code, language)}
						</option>
					))}
				</select>
			</label>
			<label>
				{uiText(language, "language")}
				<select
					value={language}
					onChange={(event) =>
						onChange({ ...user, language: event.target.value })
					}
				>
					{languageOptions.map(([code, name]) => (
						<option key={code} value={code}>
							{name}
						</option>
					))}
				</select>
			</label>
			<label>
				{uiText(language, "timezone")}
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
							{language === "ru" ? name : zone}
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
					!user.language.trim() ||
					!user.timezone.trim()
				}
				onClick={onSave}
			>
				{uiText(language, saving ? "saving" : "save")}
			</button>
		</Modal>
	);
};

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
				? "При смене валюты расходы и лимиты пересчитаются. Исходные суммы сохранятся."
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
	closeLabel = "Закрыть",
	children,
	onClose,
}: {
	title: string;
	closeLabel?: string;
	children: React.ReactNode;
	onClose: () => void;
}) => {
	useEffect(() => {
		document.body.classList.add("mini-modal-open");
		const keepActiveControlVisible = () => {
			const active = document.activeElement;
			if (!(active instanceof HTMLElement) || !active.closest(".mini-modal"))
				return;
			window.requestAnimationFrame(() =>
				active.scrollIntoView({ block: "nearest", inline: "nearest" }),
			);
		};
		window.visualViewport?.addEventListener("resize", keepActiveControlVisible);
		return () => {
			document.body.classList.remove("mini-modal-open");
			window.visualViewport?.removeEventListener(
				"resize",
				keepActiveControlVisible,
			);
		};
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
					<button type="button" aria-label={closeLabel} onClick={onClose}>
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
	primary = false,
	label,
	icon,
	onClick,
}: {
	active: boolean;
	primary?: boolean;
	label: string;
	icon: React.ReactNode;
	onClick: () => void;
}) => (
	<button
		className={`${active ? "active " : ""}${primary ? "mini-nav-add" : ""}`.trim()}
		type="button"
		onClick={onClick}
	>
		<span className="mini-nav-icon">{icon}</span>
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
const KnotLoader = ({ compact = false }: { compact?: boolean }) => (
	<span
		className={`knot-loader${compact ? " knot-loader--compact" : ""}`}
		aria-hidden="true"
	>
		<svg viewBox="0 0 64 64" focusable="false">
			<title>Загрузка</title>
			<path
				className="knot-loader-line"
				pathLength="1"
				d="M30 32 C22 25 17 18 21 12 C24 7 31 10 32 17 C33 22 31 28 30 32 C24 27 15 25 11 30 C7 35 13 40 19 38 C24 37 28 34 30 32 C28 38 25 48 29 52 C33 55 35 43 30 32 C34 38 38 49 43 50 C48 50 43 38 30 32 C38 30 47 25 55 16"
			/>
			<circle className="knot-loader-dot" cx="30" cy="32" r="3" />
		</svg>
	</span>
);
const LoadingScreen = () => {
	const language = normalizeUILanguage(
		WebApp.initDataUnsafe.user?.language_code,
	);
	return (
		<div className="mini-loading">
			<KnotLoader />
			<span>{uiText(language, "loadingExpenses")}</span>
		</div>
	);
};
const TelegramEntry = ({ error }: { error: string }) => {
	const language = normalizeUILanguage(
		WebApp.initDataUnsafe.user?.language_code,
	);
	return (
		<main className="mini-entry">
			<div className="mini-brand">
				<img className="mini-brand-mark" src={BRAND_LOGO_URL} alt="" />
				<span>{uiText(language, "brand")}</span>
			</div>
			<h1>{uiText(language, "entryTitle")}</h1>
			<p>{error}</p>
			<a href={BOT_URL}>{uiText(language, "openBot")}</a>
		</main>
	);
};

const OTP_POSITIONS = [0, 1, 2, 3, 4, 5] as const;

const BrowserEntry = ({
	error,
	onTelegramAuth,
	onEmailAuth,
}: {
	error: string;
	onTelegramAuth: (user: TelegramWidgetUser) => Promise<void>;
	onEmailAuth: (auth: AuthResponse) => Promise<void>;
}) => {
	const [method, setMethod] = useState<"telegram" | "email">("telegram");
	const [emailMode, setEmailMode] = useState<"login" | "register">("login");
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [code, setCode] = useState("");
	const [codeSent, setCodeSent] = useState(false);
	const [resendSeconds, setResendSeconds] = useState(0);
	const [loading, setLoading] = useState(false);
	const [localError, setLocalError] = useState("");

	useEffect(() => {
		if (!codeSent || resendSeconds <= 0) return;
		const timer = window.setTimeout(
			() => setResendSeconds((seconds) => Math.max(0, seconds - 1)),
			1000,
		);
		return () => window.clearTimeout(timer);
	}, [codeSent, resendSeconds]);

	const requestCode = async () => {
		setLoading(true);
		setLocalError("");
		try {
			await apiRequest(`/auth/email/${emailMode}/request`, "", {
				method: "POST",
				body: JSON.stringify({ name: name.trim(), email: email.trim() }),
			});
			setCodeSent(true);
			setResendSeconds(60);
		} catch (requestError) {
			const message =
				requestError instanceof Error
					? requestError.message
					: "Не удалось отправить код";
			setLocalError(
				message.includes("email already registered")
					? "Эта почта уже зарегистрирована. Выберите «Войти»."
					: message,
			);
		} finally {
			setLoading(false);
		}
	};

	const confirmCode = async () => {
		setLoading(true);
		setLocalError("");
		try {
			const auth = await apiRequest<AuthResponse>(
				`/auth/email/${emailMode}/confirm`,
				"",
				{
					method: "POST",
					body: JSON.stringify({
						name: name.trim(),
						email: email.trim(),
						code: code.trim(),
						country: "RU",
						language: navigator.language.split("-")[0] || "ru",
						timezone:
							Intl.DateTimeFormat().resolvedOptions().timeZone ||
							"Europe/Moscow",
						currency: "RUB",
					}),
				},
			);
			await onEmailAuth(auth);
		} catch (requestError) {
			setLocalError(
				requestError instanceof Error ? requestError.message : "Неверный код",
			);
		} finally {
			setLoading(false);
		}
	};

	return (
		<main className="mini-entry mini-browser-entry">
			<section className="browser-entry-brand">
				<div className="mini-brand">
					<img className="mini-brand-mark" src={BRAND_LOGO_URL} alt="" />
					<span>Пока не забыл</span>
				</div>
				<div>
					<h1>Ваши расходы рядом</h1>
					<p>Откройте те же пространства, покупки и планы.</p>
				</div>
			</section>
			<section className="browser-auth-panel">
				<div
					className="browser-auth-tabs"
					role="tablist"
					aria-label="Способ входа"
				>
					<button
						type="button"
						className={method === "telegram" ? "active" : ""}
						onClick={() => setMethod("telegram")}
					>
						Telegram
					</button>
					<button
						type="button"
						className={method === "email" ? "active" : ""}
						onClick={() => setMethod("email")}
					>
						Почта
					</button>
				</div>
				{method === "telegram" ? (
					<div className="browser-telegram-auth">
						<TelegramLoginButton onAuth={onTelegramAuth} />
						<small>Первый вход и создание аккаунта</small>
					</div>
				) : (
					<div className="browser-email-auth">
						<div className="browser-email-modes" aria-label="Действие с почтой">
							<button
								type="button"
								className={emailMode === "login" ? "active" : ""}
								onClick={() => {
									setEmailMode("login");
									setCodeSent(false);
									setResendSeconds(0);
									setCode("");
									setLocalError("");
								}}
							>
								Войти
							</button>
							<button
								type="button"
								className={emailMode === "register" ? "active" : ""}
								onClick={() => {
									setEmailMode("register");
									setCodeSent(false);
									setResendSeconds(0);
									setCode("");
									setLocalError("");
								}}
							>
								Регистрация
							</button>
						</div>
						{emailMode === "register" && (
							<label>
								Имя
								<input
									type="text"
									autoComplete="name"
									value={name}
									disabled={codeSent}
									onChange={(event) => setName(event.target.value)}
									placeholder="Как к вам обращаться"
								/>
							</label>
						)}
						<label>
							Почта
							<input
								type="email"
								autoComplete="email"
								inputMode="email"
								value={email}
								disabled={codeSent}
								onChange={(event) => setEmail(event.target.value)}
								placeholder="name@example.com"
							/>
						</label>
						{codeSent ? (
							<>
								<label className="browser-code-field">
									<span>Код из письма</span>
									<div className="browser-otp-field">
										<input
											className="browser-code-input"
											type="text"
											inputMode="numeric"
											autoComplete="one-time-code"
											maxLength={6}
											value={code}
											onChange={(event) =>
												setCode(event.target.value.replace(/\D/g, ""))
											}
										/>
										<div className="browser-otp-cells" aria-hidden="true">
											{OTP_POSITIONS.map((index) => (
												<span
													key={`otp-${index}`}
													className={`browser-otp-cell${code[index] ? " filled" : ""}${index === code.length && code.length < 6 ? " active" : ""}`}
												>
													{code[index] || ""}
												</span>
											))}
										</div>
									</div>
								</label>
								<button
									type="button"
									disabled={loading || code.length !== 6}
									onClick={confirmCode}
								>
									{loading
										? "Проверяем…"
										: emailMode === "register"
											? "Создать аккаунт"
											: "Войти"}
								</button>
								<button
									className="browser-auth-link"
									type="button"
									onClick={() => {
										setCodeSent(false);
										setResendSeconds(0);
										setCode("");
									}}
								>
									Изменить почту
								</button>
								<button
									className="browser-auth-link browser-resend-code"
									type="button"
									disabled={loading || resendSeconds > 0}
									onClick={requestCode}
								>
									{resendSeconds > 0
										? `Отправить снова через 0:${String(resendSeconds).padStart(2, "0")}`
										: "Отправить код ещё раз"}
								</button>
							</>
						) : (
							<button
								type="button"
								disabled={
									loading ||
									!email.includes("@") ||
									(emailMode === "register" && !name.trim())
								}
								onClick={requestCode}
							>
								{loading ? "Отправляем…" : "Получить код"}
							</button>
						)}
						<small>
							{codeSent
								? "Код действует 10 минут. Проверьте также папку «Спам»."
								: emailMode === "register"
									? "Пароль не нужен — вход всегда подтверждается кодом из письма."
									: "Введите почту, которую указывали при регистрации или привязали в профиле."}
						</small>
					</div>
				)}
				{localError || error ? (
					<p className="mini-entry-error">{localError || error}</p>
				) : null}
			</section>
		</main>
	);
};

const EmailLinkDialog = ({
	token,
	initialEmail,
	onClose,
	onLinked,
}: {
	token: string;
	initialEmail: string;
	onClose: () => void;
	onLinked: (user: User) => void;
}) => {
	const [email, setEmail] = useState(initialEmail);
	const [code, setCode] = useState("");
	const [codeSent, setCodeSent] = useState(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	const requestCode = async () => {
		setSaving(true);
		setError("");
		try {
			await apiRequest("/auth/email/link/request", token, {
				method: "POST",
				body: JSON.stringify({ email: email.trim() }),
			});
			setCodeSent(true);
		} catch (requestError) {
			setError(
				requestError instanceof Error
					? requestError.message
					: "Не удалось отправить код",
			);
		} finally {
			setSaving(false);
		}
	};
	const confirmCode = async () => {
		setSaving(true);
		setError("");
		try {
			const nextUser = await apiRequest<User>(
				"/auth/email/link/confirm",
				token,
				{
					method: "POST",
					body: JSON.stringify({ email: email.trim(), code: code.trim() }),
				},
			);
			onLinked(nextUser);
		} catch (requestError) {
			setError(
				requestError instanceof Error ? requestError.message : "Неверный код",
			);
		} finally {
			setSaving(false);
		}
	};
	return (
		<Modal title="Почта для входа" onClose={onClose}>
			<p className="mini-modal-note">
				После подтверждения по этой почте можно входить в браузере без Telegram.
			</p>
			<label>
				Почта
				<input
					type="email"
					autoComplete="email"
					inputMode="email"
					value={email}
					disabled={codeSent}
					onChange={(event) => setEmail(event.target.value)}
					placeholder="name@example.com"
				/>
			</label>
			{codeSent && (
				<label>
					Код из письма
					<input
						type="text"
						inputMode="numeric"
						autoComplete="one-time-code"
						maxLength={6}
						value={code}
						onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
					/>
				</label>
			)}
			{error && <p className="mini-form-error">{error}</p>}
			<button
				className="mini-save"
				type="button"
				disabled={
					saving || !email.includes("@") || (codeSent && code.length !== 6)
				}
				onClick={codeSent ? confirmCode : requestCode}
			>
				{saving ? "Подождите…" : codeSent ? "Подтвердить" : "Отправить код"}
			</button>
		</Modal>
	);
};

const TelegramLinkDialog = ({
	token,
	onClose,
	onLinked,
}: {
	token: string;
	onClose: () => void;
	onLinked: (user: User) => void;
}) => {
	const [error, setError] = useState("");
	const link = async (telegramUser: TelegramWidgetUser) => {
		setError("");
		try {
			const nextUser = await apiRequest<User>("/auth/telegram/link", token, {
				method: "POST",
				body: JSON.stringify({
					telegram_id: telegramUser.id,
					username: telegramUser.username || "",
					first_name: telegramUser.first_name || "",
					last_name: telegramUser.last_name || "",
					photo_url: telegramUser.photo_url || "",
					auth_date: telegramUser.auth_date,
					hash: telegramUser.hash,
				}),
			});
			onLinked(nextUser);
		} catch (linkError) {
			const message =
				linkError instanceof Error
					? linkError.message
					: "Не удалось привязать Telegram";
			setError(
				message.includes("telegram already linked")
					? "Этот Telegram уже привязан к другому аккаунту."
					: message,
			);
		}
	};
	return (
		<Modal title="Привязать Telegram" onClose={onClose}>
			<p className="mini-modal-note">
				После привязки можно будет входить через Telegram и пользоваться ботом с
				этими же расходами.
			</p>
			<TelegramLoginButton onAuth={link} />
			{error && <p className="mini-form-error">{error}</p>}
		</Modal>
	);
};

const TelegramLoginButton = ({
	onAuth,
}: {
	onAuth: (user: TelegramWidgetUser) => Promise<void>;
}) => {
	const container = useRef<HTMLDivElement>(null);
	useEffect(() => {
		window.onTelegramAuth = (user) => void onAuth(user);
		const script = document.createElement("script");
		script.src = "https://telegram.org/js/telegram-widget.js?22";
		script.async = true;
		script.setAttribute("data-telegram-login", "poka_ne_zabyl_bot");
		script.setAttribute("data-size", "large");
		script.setAttribute("data-radius", "8");
		script.setAttribute("data-userpic", "false");
		script.setAttribute("data-request-access", "write");
		script.setAttribute("data-onauth", "window.onTelegramAuth(user)");
		container.current?.replaceChildren(script);
		return () => {
			window.onTelegramAuth = undefined;
			container.current?.replaceChildren();
		};
	}, [onAuth]);
	return <div className="telegram-login" ref={container} />;
};

const formatPlanDate = (value: string, language: UILanguage) =>
	new Intl.DateTimeFormat(language, { day: "numeric", month: "short" }).format(
		new Date(`${value.slice(0, 10)}T12:00:00`),
	);
const formatDateTime = (value: string, language: UILanguage) =>
	new Intl.DateTimeFormat(language, {
		dateStyle: "medium",
		timeStyle: "medium",
	}).format(new Date(value));
const dateTimeInputValue = (value?: string | null) => {
	if (!value) return "";
	const date = new Date(value);
	const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
	return local.toISOString().slice(0, 16);
};
const formatDate = (value: string) =>
	new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(
		new Date(value),
	);
const localizedTimezoneName = (timezone: string, language: UILanguage) =>
	language === "ru"
		? timezoneOptions.find(([value]) => value === timezone)?.[1] || timezone
		: timezone;
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
