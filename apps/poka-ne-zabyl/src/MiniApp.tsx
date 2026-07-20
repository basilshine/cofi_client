import {
	ArrowClockwise,
	ArrowLeft,
	ArrowRight,
	BellRinging,
	BellSlash,
	CalendarBlank,
	Camera,
	CaretDown,
	ChatCircleText,
	Check,
	Copy,
	EnvelopeSimple,
	FunnelSimple,
	GearSix,
	House,
	ImageSquare,
	MagnifyingGlass,
	Microphone,
	NotePencil,
	PaperPlaneTilt,
	PencilSimple,
	Plus,
	PushPin,
	Receipt,
	ShareNetwork,
	ShoppingBagOpen,
	SignOut,
	Star,
	Storefront,
	Tag,
	Trash,
	UsersThree,
	WarningCircle,
	X,
} from "@phosphor-icons/react";
import WebApp from "@twa-dev/sdk";
import {
	type TouchEvent,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";
import "./mini-app.css";
import { captureSourceKind } from "./capture-source";
import { groupRowsByExpense } from "./expense-groups";
import { type Period, periodBounds } from "./expense-period";
import {
	hashtagAtCursor,
	hashtagSuggestions,
	hashtagsFromText,
	replaceHashtagAtCursor,
	tagsAfterNotesEdit,
} from "./hashtags";
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
import {
	type HomeCategoryRow,
	expensesForMonth,
	homeCategoryRows,
} from "./overview";
import { PULL_REFRESH_THRESHOLD, pullRefreshDistance } from "./pull-refresh";
import { filterPurchasePlans, planPeriodBounds } from "./purchase-plan-filter";
import {
	ApiError,
	REQUEST_TIMEOUT_MS,
	isQuotaExhaustedError,
	isServiceUnavailableError,
	requestError,
} from "./request";
import {
	type PendingSpaceInvite,
	type SpaceInviteSuggestion,
	availableInviteSuggestions,
} from "./space-invite";
import { spaceScopedItems } from "./space-scoped-data";
import { isSubscriptionExpired } from "./subscription";
import { homeScreenPlatform, shouldUseFullscreen } from "./telegram-platform";
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
	| "subscription"
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
type TransferOperation = "move" | "clone";
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

type SpaceInviteSuggestions = {
	suggestions: SpaceInviteSuggestion[];
	pending_invites_for_space: PendingSpaceInvite[];
};

type Category = {
	id: number;
	key: string;
	name: string;
	count: number;
	total: number;
	month_spent?: number;
	last_used?: string | null;
	aliases?: string[];
	alias_text?: string;
	budget_period?: "week" | "month" | "";
	budget_amount?: number | null;
	budget_spent?: number;
	budget_remaining?: number | null;
	budget_percent?: number;
	pinned?: boolean;
	is_system?: boolean;
	created_by_user_id?: number | null;
	created_by_name?: string;
	can_edit?: boolean;
	can_delete?: boolean;
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
	tags?: string[];
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

type RecordDetail =
	| { kind: "expense"; expense: Expense }
	| { kind: "expense-item"; expense: Expense; itemIndex: number }
	| { kind: "plan"; plan: PurchasePlan }
	| { kind: "plan-item"; plan: PurchasePlan; itemIndex: number };

type PurchasePlan = {
	id: number;
	tenant_id: number;
	space_id: number;
	created_by_user_id: number;
	title: string;
	expected_amount?: number | null;
	currency: string;
	category_id?: number | null;
	vendor_id?: number | null;
	vendor_name?: string;
	due_date?: string | null;
	status: "planned" | "completed";
	expense_id?: number | null;
	source_document_id?: number;
	reminder_sent_at?: string | null;
	items?: PurchasePlanItem[];
};

type PurchasePlanItem = {
	id?: number;
	purchase_plan_id?: number;
	name: string;
	expected_amount?: number | null;
	category_id?: number | null;
	position?: number;
};

const sharedRecordAuthor = (members: SpaceMember[], userID?: number | null) => {
	if (members.length < 2 || !userID) return "";
	const member = members.find((current) => current.user_id === userID);
	return member?.name || member?.email || "";
};

const purchasePlanItems = (plan: PurchasePlan): PurchasePlanItem[] =>
	plan.items?.length
		? plan.items
		: [
				{
					name: plan.title,
					expected_amount: plan.expected_amount,
					category_id: plan.category_id,
				},
			];

const withPurchasePlanItems = (
	plan: PurchasePlan,
	items: PurchasePlanItem[],
): PurchasePlan => {
	const amounts = items
		.map((item) => item.expected_amount)
		.filter(
			(amount): amount is number => typeof amount === "number" && amount > 0,
		);
	const firstCategory = items[0]?.category_id || null;
	return {
		...plan,
		items,
		expected_amount:
			amounts.length > 0
				? amounts.reduce((sum, amount) => sum + amount, 0)
				: null,
		category_id: items.every(
			(item) => (item.category_id || null) === firstCategory,
		)
			? firstCategory
			: null,
	};
};

type User = {
	id: number;
	name: string;
	email: string;
	phone?: string;
	emailVerified?: boolean;
	telegramId?: number;
	telegramUsername?: string;
	telegramPhotoUrl?: string;
	avatarMediaId?: number;
	country: string;
	language: string;
	timezone: string;
	notificationTime: string;
	currency: string;
	dateFormat: string;
	emailNotifications: boolean;
	darkMode: boolean;
	authType?: string;
};

type NotificationChannel = "email" | "telegram";
type NotificationChannelSettings = {
	preferred: NotificationChannel | "";
	available: Record<NotificationChannel, boolean>;
};

type Quota = {
	plan: string;
	limit: number;
	used: number;
	remaining: number;
	plan_expires_at?: string | null;
	recurring_limit?: number;
	recurring_used?: number;
	recurring_remaining?: number;
	welcome_remaining?: number;
	additional_limit?: number;
	dev_tools_enabled?: boolean;
	feedback_admin_enabled?: boolean;
};

type AppNotification = {
	id: number;
	space_id?: number;
	space_name?: string;
	message: string;
	type: string;
	action_url?: string;
	read_at?: string;
	created_at: string;
};

type DeveloperDashboard = {
	user_id: number;
	period_days: number;
	processing: {
		processing_jobs: number;
		pending_jobs: number;
		running_jobs: number;
		succeeded_jobs: number;
		failed_jobs: number;
		quota_units: number;
		average_latency_ms: number;
	};
	quality: {
		resolved_results: number;
		confirmed_results: number;
		edited_results: number;
		deleted_results: number;
		confirm_rate: number;
		edit_rate: number;
		delete_rate: number;
		average_confirmation_ms: number;
		cost_per_confirmed_usd: number;
		p95_cost_per_action_usd: number;
	};
	models: {
		model_calls: number;
		fallback_calls: number;
		failed_calls: number;
		fallback_rate: number;
		total_cost_usd: number;
		average_latency_ms: number;
	};
	data: {
		active_sessions: number;
		stored_files: number;
		stored_bytes: number;
		expiring_files: number;
		earliest_media_expiry?: string | null;
		email_verified: boolean;
		personal_data_consent: boolean;
	};
	product: {
		total_users: number;
		new_users_7_days: number;
		new_users_30_days: number;
		active_users_7_days: number;
		active_users_30_days: number;
		inputs_30_days: number;
		quota_units_30_days: number;
		average_inputs_per_active_user: number;
		recent_users: {
			id: number;
			name: string;
			auth_type: string;
			created_at: string;
			last_input_at?: string | null;
			inputs_30_days: number;
			quota_units_30_days: number;
		}[];
	};
	breakdown: {
		module: string;
		input_kind: string;
		processing_jobs: number;
		confirmed_results: number;
		total_cost_usd: number;
	}[];
	recent_failures: {
		source_document_id: number;
		module: string;
		input_kind: string;
		attempts: number;
		error: string;
		created_at: string;
	}[];
};

type FeedbackCategory = "problem" | "idea" | "thanks" | "other";

type FeedbackAttachment = {
	media_id?: number;
	content_type?: string;
	byte_size?: number;
	expires_at?: string | null;
	available: boolean;
};

type DeveloperFeedback = {
	id: number;
	user_id: number;
	space_id?: number;
	category: FeedbackCategory;
	source: string;
	message: string;
	related_input?: string;
	created_at: string;
	user: {
		id: number;
		name: string;
		email: string;
		email_verified: boolean;
		telegram_id?: number;
		telegram_username?: string;
	};
	photo?: FeedbackAttachment;
	audio?: FeedbackAttachment;
};

type FeedbackSubmission = {
	category: FeedbackCategory;
	message: string;
	photo?: File;
	audio?: File;
};

type FeedbackDailyStatus = {
	feedback_daily_limit: number;
	feedback_daily_remaining: number;
	feedback_daily_resets_at: string;
};

type FeedbackCreateResponse = FeedbackDailyStatus;

type FeedbackMediaViewer = {
	url: string;
	kind: "photo" | "audio";
	title: string;
};
type QuotaLevel = "low" | "exhausted";

type DeveloperQuotaPatch = {
	plan?: "free" | "plus";
	plan_expires_at?: string;
	additional_limit?: number;
	additional_units?: number;
	reset_usage?: boolean;
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
	| { kind: "image"; files: File[] }
	| { kind: "voice"; file: File; durationSeconds: number };
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
	tags: string[];
};

type ReviewDraft = {
	candidateID: number;
	sourceDocumentID: number;
	imageType: string;
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
	media_expires_at?: string;
	media?: CapturePacketMedia[];
	input_kind?: string;
	source_type?: string;
	document_type?: string;
	processing_status?: "pending" | "processing" | "succeeded" | "failed";
	failure_code?: string;
	pending_count?: number;
	source_text?: string;
	created_at?: string;
	source_context?: Record<string, unknown>;
};

type CapturePacketMedia = {
	media_object_id: number;
	content_type?: string;
	expires_at?: string;
	position: number;
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
	media: { id: number; url: string; type: string }[];
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
const BRAND_LOGO_URL = "/assets/poka-ne-zabyl-logo.svg?v=20260717";
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
		total: 32460,
		month_spent: 12460,
		last_used: new Date().toISOString(),
		aliases: ["Продукты", "Супермаркет"],
		budget_period: "month",
		budget_amount: 20000,
		budget_spent: 12460,
		budget_remaining: 7540,
		budget_percent: 62.3,
		is_system: true,
		can_edit: true,
		can_delete: false,
	},
	{
		id: 2,
		key: "pets",
		name: "Домашние животные",
		count: 3,
		total: 15320,
		month_spent: 4820,
		last_used: new Date(Date.now() - 86400000).toISOString(),
		is_system: true,
		can_edit: true,
		can_delete: false,
	},
	{
		id: 3,
		key: "custom_dancing",
		name: "Танцы",
		count: 2,
		total: 9700,
		month_spent: 3900,
		last_used: new Date(Date.now() - 172800000).toISOString(),
		is_system: false,
		created_by_user_id: 2,
		created_by_name: "Наталья",
		can_edit: true,
		can_delete: true,
	},
	{
		id: 4,
		key: "transport",
		name: "Транспорт",
		count: 6,
		total: 11240,
		month_spent: 2740,
		last_used: new Date(Date.now() - 259200000).toISOString(),
		is_system: true,
		can_edit: true,
		can_delete: false,
	},
	{
		id: 5,
		key: "other",
		name: "Другое",
		count: 0,
		total: 0,
		month_spent: 0,
		last_used: null,
		is_system: true,
		can_edit: true,
		can_delete: false,
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
		vendor_id: 1,
		items: [
			{
				id: 1,
				name: "Молоко",
				amount: 189.99,
				category_id: 1,
				tags: ["кредитка", "семья"],
			},
			{ id: 5, name: "Кофе", amount: 579.98, category_id: 1 },
			{ id: 6, name: "Продукты", amount: 2070.03, category_id: 1 },
		],
	},
	{
		id: 2,
		source_document_id: 102,
		user_id: 2,
		title: "Корм для кошек",
		payee_text: "Белый кролик",
		expense_date: isoDay(-1),
		total: 1360,
		space_total: 1360,
		currency: "RUB",
		vendor_id: 2,
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
		vendor_id: 3,
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
		vendor_id: 4,
		items: [{ id: 4, name: "Поездка", amount: 680, category_id: 4 }],
	},
];
const previewPlans: PurchasePlan[] = [
	{
		id: 1,
		tenant_id: 1,
		space_id: 1,
		created_by_user_id: 1,
		title: "Для танцев",
		expected_amount: 8200,
		currency: "RUB",
		category_id: 3,
		vendor_id: 5,
		vendor_name: "Спортмастер",
		due_date: isoDay(5),
		status: "planned",
		source_document_id: 103,
		items: [
			{
				id: 1,
				name: "Кроссовки для танцев",
				expected_amount: 7000,
				category_id: 3,
			},
			{ id: 2, name: "Чехол для обуви", expected_amount: 1200, category_id: 3 },
		],
	},
	{
		id: 2,
		tenant_id: 1,
		space_id: 1,
		created_by_user_id: 2,
		title: "Фильтры для воды",
		expected_amount: 1400,
		currency: "RUB",
		category_id: 5,
		status: "planned",
		source_document_id: 101,
		items: [
			{
				id: 3,
				name: "Фильтры для воды",
				expected_amount: 1400,
				category_id: 5,
			},
		],
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
	{ id: 5, name: "Спортмастер", aliases: [] },
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
const previewDeveloperFeedback: DeveloperFeedback[] = [
	{
		id: 12,
		user_id: 2,
		space_id: 1,
		category: "idea",
		source: "mini_app",
		message:
			"Было бы удобно видеть общий семейный отчёт за месяц и быстро делиться им.",
		related_input: "view=overview",
		created_at: new Date(Date.now() - 35 * 60_000).toISOString(),
		user: {
			id: 2,
			name: "Анна",
			email: "anna@example.com",
			email_verified: true,
			telegram_id: 123456,
			telegram_username: "anna",
		},
		photo: {
			media_id: 44,
			content_type: "image/png",
			byte_size: 240000,
			expires_at: isoDay(29),
			available: true,
		},
	},
];

const previewNotifications: AppNotification[] = [
	{
		id: 1,
		space_id: 1,
		space_name: "Личные расходы",
		type: "purchase_plan_due",
		message: "Запланировано на сегодня\n\nКроссовки для танцев\n8 200 ₽",
		action_url: "/app?preview=1&view=expenses&space_id=1&plan_id=2",
		created_at: new Date(Date.now() - 25 * 60_000).toISOString(),
	},
	{
		id: 2,
		space_id: 2,
		space_name: "Семейный бюджет",
		type: "shared_expense_created",
		message: "Анна добавила расход\n\nПродукты на неделю\n2 840 RUB",
		action_url: "/app?preview=1&view=expenses&space_id=2&expense_id=1",
		created_at: new Date(Date.now() - 55 * 60_000).toISOString(),
	},
	{
		id: 4,
		space_id: 1,
		space_name: "Личные расходы",
		type: "capture_review_ready",
		message: "Готово к проверке: расход\n\nПокупки в Ленте",
		action_url: "/app?preview=1&view=review&space_id=1&candidate_id=77",
		created_at: new Date(Date.now() - 90 * 60_000).toISOString(),
	},
	{
		id: 3,
		type: "quota_low",
		message: "Осталось 13 быстрых разборов из приветственного набора.",
		action_url: "/app?preview=1&view=subscription",
		read_at: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
		created_at: new Date(Date.now() - 3 * 60 * 60_000).toISOString(),
	},
];

const captureForSourceDocument = (
	sourceDocumentID: number | undefined,
	captures: CapturePacket[],
) =>
	captures.find((capture) => capture.source_document_id === sourceDocumentID);

const captureForExpense = (expense: Expense, captures: CapturePacket[]) =>
	captureForSourceDocument(expense.source_document_id, captures);

const captureForPlan = (plan: PurchasePlan, captures: CapturePacket[]) =>
	captureForSourceDocument(plan.source_document_id, captures);

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
const requestedQuery = new URLSearchParams(window.location.search);
const requestedSpaceID = Number(requestedQuery.get("space_id"));
const requestedExpenseID = Number(requestedQuery.get("expense_id"));
const requestedFeedbackID = Number(requestedQuery.get("feedback"));
const requestedInviteToken = (
	requestedQuery.get("token") ||
	requestedQuery.get("invite") ||
	""
).trim();

const initialView = (): View => {
	if (requestedReview) return "review";
	if (requestedPlan) return "expenses";
	if (requestedExpenseID > 0) return "expenses";
	if (requestedFeedbackID > 0) return "profile";
	const requested = new URLSearchParams(window.location.search).get("view");
	return requested === "expenses" ||
		requested === "categories" ||
		requested === "vendors" ||
		requested === "spaces" ||
		requested === "subscription" ||
		requested === "profile"
		? requested
		: "overview";
};

export const MiniApp = () => {
	const started = useRef(false);
	const openedRequestedPlan = useRef(false);
	const loadSequence = useRef(0);
	const pullStart = useRef<{ x: number; y: number } | null>(null);
	const currentPullDistance = useRef(0);
	const blockingRequest = useRef<AbortController | null>(null);
	const reviewReturnView = useRef<View>("overview");
	const spaceMenuRef = useRef<HTMLDivElement | null>(null);
	const accountMenuRef = useRef<HTMLDivElement | null>(null);
	const [view, setView] = useState<View>(initialView);
	const [token, setToken] = useState("");
	const [user, setUser] = useState<User | null>(null);
	const [profileAvatarURL, setProfileAvatarURL] = useState("");
	const [profileAvatarSaving, setProfileAvatarSaving] = useState(false);
	const [spaces, setSpaces] = useState<Space[]>([]);
	const [spaceID, setSpaceID] = useState(0);
	const [members, setMembers] = useState<SpaceMember[]>([]);
	const [expenses, setExpenses] = useState<Expense[]>([]);
	const [plans, setPlans] = useState<PurchasePlan[]>([]);
	const [captures, setCaptures] = useState<CapturePacket[]>([]);
	const [reviewCandidates, setReviewCandidates] = useState<ReviewCandidate[]>(
		[],
	);
	const [loadedCategories, setCategories] = useState<Category[]>([]);
	const [categorySpaceID, setCategorySpaceID] = useState(0);
	const categories = spaceScopedItems(
		loadedCategories,
		categorySpaceID,
		spaceID,
		previewMode,
	);
	const [vendors, setVendors] = useState<Vendor[]>([]);
	const [quota, setQuota] = useState<Quota | null>(null);
	const [accountQuota, setAccountQuota] = useState<Quota | null>(null);
	const [feedbackStatus, setFeedbackStatus] =
		useState<FeedbackDailyStatus | null>(null);
	const [notifications, setNotifications] = useState<AppNotification[]>([]);
	const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
	const [notificationsOpen, setNotificationsOpen] = useState(false);
	const [spaceMenuOpen, setSpaceMenuOpen] = useState(false);
	const [accountMenuOpen, setAccountMenuOpen] = useState(false);
	const [selectedNotification, setSelectedNotification] =
		useState<AppNotification | null>(null);
	const [notificationsLoading, setNotificationsLoading] = useState(false);
	const [developerDashboard, setDeveloperDashboard] =
		useState<DeveloperDashboard | null>(null);
	const [developerDashboardLoading, setDeveloperDashboardLoading] =
		useState(false);
	const [developerFeedback, setDeveloperFeedback] = useState<
		DeveloperFeedback[]
	>([]);
	const [developerFeedbackLoading, setDeveloperFeedbackLoading] =
		useState(false);
	const [feedbackOpen, setFeedbackOpen] = useState(false);
	const [feedbackSaving, setFeedbackSaving] = useState(false);
	const [feedbackError, setFeedbackError] = useState("");
	const [feedbackMedia, setFeedbackMedia] =
		useState<FeedbackMediaViewer | null>(null);
	const [feedbackMediaLoading, setFeedbackMediaLoading] = useState(false);
	const [forcedQuotaLevel, setForcedQuotaLevel] = useState<QuotaLevel | null>(
		null,
	);
	const [dismissedQuotaLevel, setDismissedQuotaLevel] =
		useState<QuotaLevel | null>(null);
	const [dismissedExpiredSubscription, setDismissedExpiredSubscription] =
		useState(false);
	const [loading, setLoading] = useState(true);
	const [loadFailed, setLoadFailed] = useState(false);
	const [serviceUnavailable, setServiceUnavailable] = useState(false);
	const [pullDistance, setPullDistance] = useState(0);
	const [refreshing, setRefreshing] = useState(false);
	const updatePullDistance = (distance: number) => {
		currentPullDistance.current = distance;
		setPullDistance(distance);
	};
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	useEffect(() => {
		if (!notice) return;
		const timer = window.setTimeout(() => setNotice(""), 5_000);
		return () => window.clearTimeout(timer);
	}, [notice]);
	const [period, setPeriod] = useState<Period>("month");
	const [dateFrom, setDateFrom] = useState("");
	const [dateTo, setDateTo] = useState("");
	const [categoryID, setCategoryID] = useState(0);
	const [vendorID, setVendorID] = useState(0);
	const [expenseID, setExpenseID] = useState(
		requestedExpenseID > 0 ? requestedExpenseID : 0,
	);
	const [groupByExpense, setGroupByExpense] = useState(false);
	const [query, setQuery] = useState("");
	const [expenseSection, setExpenseSection] = useState<ExpenseSection>(
		requestedPlan ? "plans" : "history",
	);
	const [planInitialPeriod, setPlanInitialPeriod] = useState<Period>("all");
	const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
	const [editingPlan, setEditingPlan] = useState<PurchasePlan | null>(null);
	const [recordDetail, setRecordDetail] = useState<RecordDetail | null>(null);
	const [editingPlanCandidate, setEditingPlanCandidate] =
		useState<ReviewCandidate | null>(null);
	const [completingPlanID, setCompletingPlanID] = useState(0);
	const [completingPlanItemID, setCompletingPlanItemID] = useState(0);
	const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
	const [editingCategory, setEditingCategory] = useState<Category | null>(null);
	const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
	const [editingProfile, setEditingProfile] = useState<User | null>(null);
	const [profileEditorMode, setProfileEditorMode] = useState<
		"profile" | "notifications"
	>("profile");
	const [notificationChannelSettings, setNotificationChannelSettings] =
		useState<NotificationChannelSettings>({
			preferred: "",
			available: { email: false, telegram: false },
		});
	const [emailLinkOpen, setEmailLinkOpen] = useState(false);
	const [telegramLinkOpen, setTelegramLinkOpen] = useState(false);
	const [packPickerOpen, setPackPickerOpen] = useState(false);
	const [billingLoading, setBillingLoading] = useState(false);
	const [editingSpace, setEditingSpace] = useState<Space | null>(null);
	const [invitingSpace, setInvitingSpace] = useState<Space | null>(null);
	const [addChoiceOpen, setAddChoiceOpen] = useState(false);
	const [captureOpen, setCaptureOpen] = useState(false);
	const [captureMode, setCaptureMode] = useState<CaptureMode>("choose");
	const [capturePurpose, setCapturePurpose] =
		useState<CapturePurpose>("expense");
	const [captureError, setCaptureError] = useState("");
	const [captureSubmitting, setCaptureSubmitting] = useState(false);
	const [pendingCaptures, setPendingCaptures] = useState<PendingCapture[]>([]);
	const pendingCapture = pendingCaptures[0] || null;
	const [dismissedCaptureSourceID, setDismissedCaptureSourceID] = useState(0);
	const [captureFailure, setCaptureFailure] = useState("");
	const [captureFailurePurpose, setCaptureFailurePurpose] =
		useState<CapturePurpose>("expense");
	const [reviewDraft, setReviewDraft] = useState<ReviewDraft | null>(null);
	const [openingReview, setOpeningReview] = useState(false);
	const [reviewMediaURL, setReviewMediaURL] = useState("");
	const [savedReviewExpense, setSavedReviewExpense] = useState<Expense | null>(
		null,
	);
	const [deletingReview, setDeletingReview] = useState(false);
	const [sourceViewer, setSourceViewer] = useState<SourceViewer | null>(null);
	const [sourceLoading, setSourceLoading] = useState(false);
	const [openingLabel, setOpeningLabel] = useState("");
	const [saving, setSaving] = useState(false);
	const [homeScreenStatus, setHomeScreenStatus] =
		useState<HomeScreenStatus>("checking");
	const [browserInstallPrompt, setBrowserInstallPrompt] =
		useState<BeforeInstallPromptEvent | null>(null);
	const [installGuideOpen, setInstallGuideOpen] = useState(false);
	const [dismissedInstallPrompt, setDismissedInstallPrompt] = useState(false);
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
	const hasCaptureStatus = Boolean(
		captureSubmitting ||
			pendingCapture ||
			captureFailure ||
			(showReadyCandidate && view !== "overview"),
	);
	const subscriptionExpired = isSubscriptionExpired(
		accountQuota?.plan_expires_at,
	);
	const showExpiredSubscriptionStatus =
		subscriptionExpired && !dismissedExpiredSubscription;
	const showCaptureStatus = hasCaptureStatus && !showExpiredSubscriptionStatus;
	const showQuotaStatus =
		!showCaptureStatus &&
		!showExpiredSubscriptionStatus &&
		quotaLevel !== null &&
		quotaLevel !== dismissedQuotaLevel;
	const showInstallStatus =
		!WebApp.initData &&
		homeScreenStatus === "unknown" &&
		!dismissedInstallPrompt &&
		!showCaptureStatus &&
		!showExpiredSubscriptionStatus &&
		!showQuotaStatus;
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
		setDismissedExpiredSubscription(false);
	}, [spaceID]);

	useEffect(() => {
		if (quota && quota.remaining > 0) setForcedQuotaLevel(null);
	}, [quota?.remaining]);

	useEffect(() => {
		document.body.classList.add("mini-body");
		return () => document.body.classList.remove("mini-body");
	}, []);

	useEffect(() => {
		let active = true;
		let objectURL = "";
		const fallback =
			user?.telegramPhotoUrl || WebApp.initDataUnsafe.user?.photo_url || "";
		setProfileAvatarURL(fallback);
		if (!token || !user?.avatarMediaId) return () => undefined;

		void fetch(`/api/v1/media/${user.avatarMediaId}`, {
			headers: { Authorization: `Bearer ${token}` },
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		})
			.then((response) => {
				if (!response.ok) throw new Error("avatar unavailable");
				return response.blob();
			})
			.then((blob) => {
				if (!active) return;
				objectURL = URL.createObjectURL(blob);
				setProfileAvatarURL(objectURL);
			})
			.catch(() => undefined);

		return () => {
			active = false;
			if (objectURL) URL.revokeObjectURL(objectURL);
		};
	}, [token, user?.avatarMediaId, user?.telegramPhotoUrl]);

	useEffect(() => {
		if (!spaceMenuOpen) return;
		const closeOnOutsidePress = (event: PointerEvent) => {
			if (!spaceMenuRef.current?.contains(event.target as Node))
				setSpaceMenuOpen(false);
		};
		const closeOnEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape") setSpaceMenuOpen(false);
		};
		document.addEventListener("pointerdown", closeOnOutsidePress);
		document.addEventListener("keydown", closeOnEscape);
		return () => {
			document.removeEventListener("pointerdown", closeOnOutsidePress);
			document.removeEventListener("keydown", closeOnEscape);
		};
	}, [spaceMenuOpen]);

	useEffect(() => {
		if (!accountMenuOpen) return;
		const closeOnOutsidePress = (event: PointerEvent) => {
			if (!accountMenuRef.current?.contains(event.target as Node))
				setAccountMenuOpen(false);
		};
		const closeOnEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape") setAccountMenuOpen(false);
		};
		document.addEventListener("pointerdown", closeOnOutsidePress);
		document.addEventListener("keydown", closeOnEscape);
		return () => {
			document.removeEventListener("pointerdown", closeOnOutsidePress);
			document.removeEventListener("keydown", closeOnEscape);
		};
	}, [accountMenuOpen]);

	useEffect(() => {
		if (requestedFeedbackID <= 0 || developerFeedback.length === 0) return;
		window.requestAnimationFrame(() =>
			document
				.getElementById(`feedback-${requestedFeedbackID}`)
				?.scrollIntoView({ block: "center" }),
		);
	}, [developerFeedback]);

	useEffect(
		() => () => {
			if (feedbackMedia?.url) URL.revokeObjectURL(feedbackMedia.url);
		},
		[feedbackMedia?.url],
	);

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
				telegramId: 1,
				telegramUsername: "basil",
				country: "RU",
				language: "ru",
				timezone: "Asia/Tomsk",
				notificationTime: "09:00",
				currency: "RUB",
				dateFormat: "DD.MM.YYYY",
				emailNotifications: false,
				darkMode: false,
				authType: "telegram",
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
				{
					id: 2,
					tenant_id: 1,
					owner_user_id: 1,
					is_personal: false,
					name: "Семейный бюджет",
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
				...(([1, 2].includes(requestedSpaceID) ? requestedSpaceID : 1) === 2
					? [
							{
								user_id: 2,
								name: "Наталья",
								email: "natalya@example.com",
								role: "member",
							},
						]
					: []),
			]);
			setSpaceID([1, 2].includes(requestedSpaceID) ? requestedSpaceID : 1);
			setCategorySpaceID(
				[1, 2].includes(requestedSpaceID) ? requestedSpaceID : 1,
			);
			setExpenses(previewExpenses);
			setPlans(previewPlans);
			setCaptures(previewCaptures);
			setReviewCandidates(previewReviewCandidates);
			setCategories(previewCategories);
			setVendors(previewVendors);
			const previewQuota: Quota = {
				plan: "basic",
				limit: 20,
				used: 7,
				remaining: 13,
				recurring_limit: 0,
				welcome_remaining: 13,
				additional_limit: 0,
				dev_tools_enabled: true,
				feedback_admin_enabled: true,
			};
			setQuota(previewQuota);
			setAccountQuota(previewQuota);
			setFeedbackStatus({
				feedback_daily_limit: 3,
				feedback_daily_remaining: 2,
				feedback_daily_resets_at: new Date(
					new Date().setHours(24, 0, 0, 0),
				).toISOString(),
			});
			setNotifications(previewNotifications);
			setUnreadNotificationCount(
				previewNotifications.filter(({ read_at }) => !read_at).length,
			);
			setDeveloperFeedback(previewDeveloperFeedback);
			setDeveloperDashboard({
				user_id: 1,
				period_days: 30,
				processing: {
					processing_jobs: 42,
					pending_jobs: 1,
					running_jobs: 0,
					succeeded_jobs: 38,
					failed_jobs: 4,
					quota_units: 73,
					average_latency_ms: 8400,
				},
				quality: {
					resolved_results: 35,
					confirmed_results: 31,
					edited_results: 8,
					deleted_results: 4,
					confirm_rate: 0.886,
					edit_rate: 0.258,
					delete_rate: 0.114,
					average_confirmation_ms: 25000,
					cost_per_confirmed_usd: 0.0018,
					p95_cost_per_action_usd: 0.0064,
				},
				models: {
					model_calls: 58,
					fallback_calls: 5,
					failed_calls: 4,
					fallback_rate: 0.086,
					total_cost_usd: 0.0558,
					average_latency_ms: 3200,
				},
				data: {
					active_sessions: 2,
					stored_files: 16,
					stored_bytes: 24_300_000,
					expiring_files: 16,
					earliest_media_expiry: isoDay(2),
					email_verified: true,
					personal_data_consent: true,
				},
				product: {
					total_users: 18,
					new_users_7_days: 4,
					new_users_30_days: 13,
					active_users_7_days: 9,
					active_users_30_days: 15,
					inputs_30_days: 127,
					quota_units_30_days: 214,
					average_inputs_per_active_user: 8.5,
					recent_users: [
						{
							id: 18,
							name: "Анна",
							auth_type: "telegram",
							created_at: isoDay(-1),
							last_input_at: isoDay(0),
							inputs_30_days: 6,
							quota_units_30_days: 11,
						},
						{
							id: 17,
							name: "Михаил",
							auth_type: "email",
							created_at: isoDay(-3),
							last_input_at: isoDay(-2),
							inputs_30_days: 2,
							quota_units_30_days: 2,
						},
					],
				},
				breakdown: [
					{
						module: "expense",
						input_kind: "text",
						processing_jobs: 18,
						confirmed_results: 16,
						total_cost_usd: 0.008,
					},
					{
						module: "expense",
						input_kind: "image",
						processing_jobs: 15,
						confirmed_results: 12,
						total_cost_usd: 0.041,
					},
					{
						module: "plan",
						input_kind: "voice",
						processing_jobs: 9,
						confirmed_results: 3,
						total_cost_usd: 0.0068,
					},
				],
				recent_failures: [
					{
						source_document_id: 104,
						module: "expense",
						input_kind: "image",
						attempts: 2,
						error: "Не удалось уверенно распознать содержимое фотографии",
						created_at: new Date().toISOString(),
					},
				],
			});
			if (requestedReview) {
				setReviewDraft({
					candidateID: requestedReview.candidateID,
					sourceDocumentID: 77,
					imageType: "receipt",
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
							tags: [],
						},
						{
							key: "preview-kefir",
							name: "Кефир",
							amount: 100,
							category_key: "groceries",
							vendor_name: "Лента",
							notes: "",
							tags: [],
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
			setServiceUnavailable(isServiceUnavailableError(err));
			setError(
				err instanceof Error ? err.message : "Не удалось войти через Telegram",
			);
			setLoading(false);
		}
	};

	const acceptAuth = async (auth: AuthResponse) => {
		let joinedSpaceID = 0;
		let inviteNotice = "";
		if (requestedInviteToken) {
			try {
				const outcome = await apiRequest<{ space?: Space }>(
					`/invites/${encodeURIComponent(requestedInviteToken)}/accept`,
					auth.token,
					{ method: "POST" },
				);
				joinedSpaceID = outcome.space?.id || 0;
				inviteNotice = outcome.space
					? `Вы присоединились к пространству «${outcome.space.name}»`
					: "Приглашение принято";
				window.history.replaceState(null, "", "/app");
			} catch (err) {
				inviteNotice =
					err instanceof Error ? err.message : "Не удалось принять приглашение";
			}
		}
		const availableSpaces = await apiRequest<Space[]>("/spaces", auth.token);
		const targetSpaceID =
			joinedSpaceID ||
			requestedReview?.spaceID ||
			requestedPlan?.spaceID ||
			requestedSpaceID;
		setToken(auth.token);
		setUser(auth.user);
		setSpaces(availableSpaces);
		setSpaceID(
			availableSpaces.some((space) => space.id === targetSpaceID)
				? targetSpaceID
				: availableSpaces[0]?.id || 0,
		);
		if (availableSpaces.length === 0) {
			setView("spaces");
			setLoading(false);
		}
		if (joinedSpaceID) setView("spaces");
		if (inviteNotice) setNotice(inviteNotice);
	};

	const restoreBrowserSession = async () => {
		try {
			const auth = await apiRequest<AuthResponse>("/auth/refresh", "", {
				method: "POST",
				body: "{}",
			});
			await acceptAuth(auth);
		} catch (err) {
			const unavailable = isServiceUnavailableError(err);
			setServiceUnavailable(unavailable);
			setError(unavailable && err instanceof Error ? err.message : "");
			setLoading(false);
		}
	};

	const startCheckout = async (productCode: string) => {
		if (!token || !spaceID || billingLoading) return;
		const controller = new AbortController();
		blockingRequest.current?.abort();
		blockingRequest.current = controller;
		setBillingLoading(true);
		setOpeningLabel(uiText(language, "openingPayment"));
		setError("");
		try {
			const checkout = await apiRequest<CheckoutResponse>(
				"/billing/checkout",
				token,
				{
					method: "POST",
					body: JSON.stringify({ product_code: productCode }),
					signal: controller.signal,
				},
			);
			submitCheckout(checkout);
		} catch (err) {
			if (!controller.signal.aborted)
				setError(
					err instanceof Error ? err.message : "Не удалось открыть оплату",
				);
		} finally {
			if (blockingRequest.current === controller) {
				blockingRequest.current = null;
				setOpeningLabel("");
				setBillingLoading(false);
			}
		}
	};

	const refreshDeveloperDashboard = async () => {
		if (!token || previewMode) return;
		setDeveloperDashboardLoading(true);
		try {
			setDeveloperDashboard(
				await apiRequest<DeveloperDashboard>(
					"/quota/developer-dashboard",
					token,
				),
			);
		} catch {
			setDeveloperDashboard(null);
		} finally {
			setDeveloperDashboardLoading(false);
		}
	};

	const refreshDeveloperFeedback = async () => {
		if (!token || previewMode) return;
		setDeveloperFeedbackLoading(true);
		try {
			const response = await apiRequest<{ feedback: DeveloperFeedback[] }>(
				"/feedback?limit=50",
				token,
			);
			setDeveloperFeedback(response.feedback || []);
		} catch {
			setDeveloperFeedback([]);
		} finally {
			setDeveloperFeedbackLoading(false);
		}
	};

	const refreshNotifications = async () => {
		if (!token || previewMode) return;
		setNotificationsLoading(true);
		try {
			const response = await apiRequest<{
				notifications: AppNotification[];
				unread_count: number;
			}>("/me/notifications?limit=50", token);
			setNotifications(response.notifications || []);
			setUnreadNotificationCount(response.unread_count || 0);
		} catch {
			// The inbox is supporting UI; regular expense work must remain available.
		} finally {
			setNotificationsLoading(false);
		}
	};

	useEffect(() => {
		if (!token || previewMode) return;
		void refreshNotifications();
		const refreshWhenVisible = () => {
			if (document.visibilityState === "visible") void refreshNotifications();
		};
		const timer = window.setInterval(
			() => void refreshNotifications(),
			pendingCaptures.length ? 3_000 : 60_000,
		);
		document.addEventListener("visibilitychange", refreshWhenVisible);
		return () => {
			window.clearInterval(timer);
			document.removeEventListener("visibilitychange", refreshWhenVisible);
		};
	}, [token, pendingCaptures.length]);

	const openNotifications = () => {
		setSpaceMenuOpen(false);
		setAccountMenuOpen(false);
		setSelectedNotification(null);
		setNotificationsOpen(true);
		void refreshNotifications();
	};

	const openNotification = (notification: AppNotification) => {
		setSelectedNotification(notification);
		if (notification.read_at) return;
		const readAt = new Date().toISOString();
		setNotifications((current) =>
			current.map((item) =>
				item.id === notification.id ? { ...item, read_at: readAt } : item,
			),
		);
		setSelectedNotification({ ...notification, read_at: readAt });
		setUnreadNotificationCount((current) => Math.max(0, current - 1));
		if (!previewMode)
			void apiRequest(`/me/notifications/${notification.id}/read`, token, {
				method: "PATCH",
			}).catch(() => void refreshNotifications());
	};

	const readAllNotifications = () => {
		const readAt = new Date().toISOString();
		setNotifications((current) =>
			current.map((notification) => ({ ...notification, read_at: readAt })),
		);
		setUnreadNotificationCount(0);
		if (!previewMode)
			void apiRequest("/me/notifications/read-all", token, {
				method: "PATCH",
			}).catch(() => void refreshNotifications());
	};

	const deleteNotification = (notification: AppNotification) => {
		setNotifications((current) =>
			current.filter(({ id }) => id !== notification.id),
		);
		if (!notification.read_at)
			setUnreadNotificationCount((current) => Math.max(0, current - 1));
		if (selectedNotification?.id === notification.id)
			setSelectedNotification(null);
		if (!previewMode)
			void apiRequest(`/me/notifications/${notification.id}`, token, {
				method: "DELETE",
			}).catch(() => void refreshNotifications());
	};

	const followNotification = (notification: AppNotification) => {
		if (notification.action_url) {
			window.location.assign(notification.action_url);
			return;
		}
		if (
			!notification.space_id ||
			!spaces.some(({ id }) => id === notification.space_id)
		)
			return;
		setNotificationsOpen(false);
		setSelectedNotification(null);
		setSpaceID(notification.space_id);
		setExpenseSection("history");
		setPeriod("all");
		setCategoryID(0);
		setVendorID(0);
		setExpenseID(0);
		setQuery("");
		setGroupByExpense(false);
		setView("expenses");
	};

	const submitFeedback = async (submission: FeedbackSubmission) => {
		if (!token || feedbackSaving) return;
		setFeedbackSaving(true);
		setFeedbackError("");
		if (previewMode) {
			const remaining = Math.max(
				0,
				(feedbackStatus?.feedback_daily_remaining ?? 1) - 1,
			);
			setFeedbackStatus((current) =>
				current
					? {
							...current,
							feedback_daily_remaining: remaining,
						}
					: current,
			);
			setFeedbackOpen(false);
			setNotice(
				remaining === 0
					? "Спасибо. Лимит на сегодня исчерпан, новое обращение можно отправить завтра"
					: `Спасибо. Обращение сохранено. Сегодня осталось: ${remaining}`,
			);
			setFeedbackSaving(false);
			return;
		}
		const data = new FormData();
		data.set("category", submission.category);
		data.set("message", submission.message);
		data.set("source", WebApp.initData ? "telegram_mini_app" : "browser_app");
		data.set("related_input", `view=${view}`);
		if (spaceID > 0) data.set("space_id", String(spaceID));
		if (submission.photo) data.set("photo", submission.photo);
		if (submission.audio) data.set("audio", submission.audio);
		try {
			const result = await apiRequest<FeedbackCreateResponse>(
				"/feedback",
				token,
				{ method: "POST", body: data },
			);
			setFeedbackStatus(result);
			setFeedbackOpen(false);
			setNotice(
				result.feedback_daily_remaining === 0
					? "Спасибо. Лимит на сегодня исчерпан, новое обращение можно отправить завтра"
					: `Спасибо. Обращение отправлено. Сегодня осталось: ${result.feedback_daily_remaining}`,
			);
			if (quota?.feedback_admin_enabled) void refreshDeveloperFeedback();
		} catch (err) {
			if (
				err instanceof ApiError &&
				err.code === "feedback_daily_limit_reached"
			) {
				setFeedbackStatus((current) =>
					current ? { ...current, feedback_daily_remaining: 0 } : current,
				);
				setFeedbackOpen(false);
				setNotice(
					"Лимит на сегодня исчерпан, новое обращение можно отправить завтра",
				);
				return;
			}
			setFeedbackError(
				err instanceof Error ? err.message : "Не удалось отправить обращение",
			);
		} finally {
			setFeedbackSaving(false);
		}
	};

	const closeFeedbackMedia = () => {
		if (feedbackMedia?.url) URL.revokeObjectURL(feedbackMedia.url);
		setFeedbackMedia(null);
	};

	const openFeedbackMedia = async (
		feedback: DeveloperFeedback,
		kind: "photo" | "audio",
	) => {
		if (!token || feedbackMediaLoading) return;
		setFeedbackMediaLoading(true);
		setError("");
		try {
			const response = await fetch(
				`/api/v1/feedback/${feedback.id}/media/${kind}`,
				{
					headers: { Authorization: `Bearer ${token}` },
					signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
				},
			);
			if (!response.ok) throw new Error("Вложение уже удалено или недоступно");
			const blob = await response.blob();
			closeFeedbackMedia();
			setFeedbackMedia({
				url: URL.createObjectURL(blob),
				kind,
				title: `${feedbackCategoryLabel(feedback.category)} · #${feedback.id}`,
			});
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Не удалось открыть вложение",
			);
		} finally {
			setFeedbackMediaLoading(false);
		}
	};

	const updateDeveloperQuota = async (patch: DeveloperQuotaPatch) => {
		if (!token || !spaceID || billingLoading) return;
		setBillingLoading(true);
		setError("");
		if (previewMode) {
			setAccountQuota((current) => {
				if (!current) return current;
				if (patch.reset_usage) {
					return { ...current, used: 0, remaining: current.limit };
				}
				const recurring =
					patch.plan === "plus"
						? 400
						: patch.plan === "free"
							? 0
							: (current.recurring_limit ?? 0);
				const additional =
					patch.additional_limit ??
					(current.additional_limit ?? 0) + (patch.additional_units ?? 0);
				const welcome = current.welcome_remaining ?? 0;
				const remaining =
					Math.max(0, recurring - current.used) + welcome + additional;
				return {
					...current,
					plan: patch.plan === "free" ? "basic" : (patch.plan ?? current.plan),
					plan_expires_at:
						patch.plan_expires_at === ""
							? null
							: (patch.plan_expires_at ?? current.plan_expires_at),
					recurring_limit: recurring,
					welcome_remaining: welcome,
					additional_limit: additional,
					limit: current.used + remaining,
					remaining,
				};
			});
			setNotice(
				patch.reset_usage
					? "Использование обнулено"
					: patch.notification
						? "Тестовое уведомление отправлено"
						: "Тестовая подписка обновлена",
			);
			if (patch.reset_usage) {
				setDeveloperDashboard((current) =>
					current
						? {
								...current,
								processing: { ...current.processing, quota_units: 0 },
							}
						: current,
				);
			}
			setBillingLoading(false);
			return;
		}
		try {
			const updated = await apiRequest<Quota>("/quota/test-plan", token, {
				method: "PATCH",
				body: JSON.stringify(patch),
			});
			setAccountQuota(updated);
			if (activeSpace?.is_personal) setQuota(updated);
			setNotice(
				patch.reset_usage
					? "Использование обнулено"
					: patch.notification
						? "Тестовое уведомление отправлено"
						: "Тестовая подписка обновлена",
			);
			void refreshDeveloperDashboard();
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
					outside_russia: true,
				}),
			});
			await acceptAuth(auth);
		} catch (err) {
			setServiceUnavailable(isServiceUnavailableError(err));
			setError(err instanceof Error ? err.message : "Не удалось войти");
			setLoading(false);
		}
	};

	useEffect(() => {
		if (!token || !spaceID) return;
		void loadSpace();
	}, [token, spaceID, user?.currency]);

	const loadSpace = async (background = false) => {
		if (previewMode) return;
		const requestID = ++loadSequence.current;
		if (!background) setLoading(true);
		setLoadFailed(false);
		setServiceUnavailable(false);
		setError("");
		try {
			// ponytail: the latest 200 records cover launch usage; add server filters when this ceiling becomes visible.
			const [
				expenseData,
				categoryData,
				quotaData,
				accountQuotaData,
				memberData,
				vendorData,
				captureData,
				planData,
				reviewData,
				feedbackStatusData,
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
				apiRequest<Quota>("/quota", token),
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
				apiRequest<FeedbackDailyStatus>("/feedback/status", token).catch(
					() => null,
				),
			]);
			if (requestID !== loadSequence.current) return;
			setExpenses(expenseData.expenses || []);
			setCaptures(captureData.captures || []);
			setCategories(categoryData.categories || []);
			setCategorySpaceID(spaceID);
			setQuota(quotaData);
			setAccountQuota(accountQuotaData);
			if (feedbackStatusData) setFeedbackStatus(feedbackStatusData);
			setMembers(memberData.members || []);
			setVendors(vendorData || []);
			setPlans(planData.plans || []);
			setReviewCandidates(reviewData.candidates || []);
			if (accountQuotaData.dev_tools_enabled) {
				void refreshDeveloperDashboard();
			} else {
				setDeveloperDashboard(null);
			}
			if (accountQuotaData.feedback_admin_enabled) {
				void refreshDeveloperFeedback();
			} else {
				setDeveloperFeedback([]);
			}
			if (view === "review" && requestedReview) {
				try {
					await loadReview(token, spaceID, requestedReview.candidateID);
				} catch (reviewError) {
					window.history.replaceState(null, "", "/app?view=expenses");
					setView("expenses");
					setNotice(
						reviewError instanceof Error
							? reviewError.message
							: "Этот расход уже сохранён",
					);
				}
			}
		} catch (err) {
			if (requestID !== loadSequence.current) return;
			setLoadFailed(true);
			setServiceUnavailable(isServiceUnavailableError(err));
			setError(
				err instanceof Error
					? err.message
					: "Не удалось загрузить пространство",
			);
		} finally {
			if (!background && requestID === loadSequence.current) setLoading(false);
		}
	};

	const refreshCurrentView = async () => {
		if (refreshing || loading || !token || !spaceID) return;
		setRefreshing(true);
		updatePullDistance(PULL_REFRESH_THRESHOLD);
		try {
			const minimumIndicator = new Promise((resolve) =>
				window.setTimeout(resolve, 450),
			);
			if (previewMode) {
				await minimumIndicator;
				return;
			}
			const [freshSpaces] = await Promise.all([
				apiRequest<Space[]>("/spaces", token),
				loadSpace(true),
				refreshNotifications(),
				minimumIndicator,
			]);
			setSpaces(freshSpaces);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Не удалось обновить данные",
			);
		} finally {
			setRefreshing(false);
			updatePullDistance(0);
		}
	};

	const beginPullRefresh = (event: TouchEvent<HTMLDivElement>) => {
		const scrollTop = document.scrollingElement?.scrollTop || window.scrollY;
		const target = event.target as HTMLElement;
		if (
			refreshing ||
			loading ||
			!token ||
			scrollTop > 0 ||
			document.body.classList.contains("mini-modal-open") ||
			target.closest("input, textarea, select, [role='listbox']")
		)
			return;
		const touch = event.touches[0];
		if (touch) pullStart.current = { x: touch.clientX, y: touch.clientY };
	};

	const movePullRefresh = (event: TouchEvent<HTMLDivElement>) => {
		const touch = event.touches[0];
		const start = pullStart.current;
		if (!touch || !start) return;
		if ((document.scrollingElement?.scrollTop || window.scrollY) > 0) {
			pullStart.current = null;
			updatePullDistance(0);
			return;
		}
		updatePullDistance(
			pullRefreshDistance(touch.clientX - start.x, touch.clientY - start.y),
		);
	};

	const endPullRefresh = () => {
		pullStart.current = null;
		if (currentPullDistance.current >= PULL_REFRESH_THRESHOLD) {
			void refreshCurrentView();
			return;
		}
		updatePullDistance(0);
	};

	const loadReview = async (
		authToken: string,
		reviewSpaceID: number,
		candidateID: number,
		sourceDocumentID?: number,
		signal?: AbortSignal,
	) => {
		const sourceFilter = sourceDocumentID
			? `&source_document_id=${sourceDocumentID}`
			: "";
		const response = await apiRequest<{ candidates: ReviewCandidate[] }>(
			`/spaces/${reviewSpaceID}/review/candidates?limit=100${sourceFilter}`,
			authToken,
			{ signal },
		);
		const candidate = response.candidates.find(
			(item) => item.id === candidateID,
		);
		if (
			!candidate ||
			candidate.candidate_type !== "expense_candidate" ||
			candidate.status !== "pending_review"
		)
			throw new Error("Этот расход уже сохранён или больше недоступен");
		setReviewDraft(reviewDraftFromCandidate(candidate, response.candidates));
		const packets = await apiRequest<{ captures: CapturePacket[] }>(
			`/spaces/${reviewSpaceID}/captures?limit=1&source_document_id=${candidate.source_document_id}`,
			authToken,
			{ signal },
		);
		const mediaID = packets.captures[0]?.media_object_id;
		if (!mediaID) return;
		const media = await fetch(`/api/v1/media/${mediaID}`, {
			signal,
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
		if (candidate.status !== "pending_review") {
			setNotice(
				candidate.candidate_type === "purchase_plan_candidate"
					? "Этот план уже сохранён"
					: "Этот расход уже сохранён",
			);
			return;
		}
		if (candidate.candidate_type === "purchase_plan_candidate") {
			const data = candidate.structured_data || {};
			const reviewSpace =
				spaces.find((item) => item.id === reviewSpaceID) || activeSpace;
			const categoryKey = readString(data, "category_key", "category");
			const category = categories.find((item) => item.key === categoryKey);
			const recognizedItems = Array.isArray(data.items)
				? data.items
						.map((raw) => {
							const item = objectValue(raw);
							const itemCategory =
								categories.find(
									(current) =>
										current.id === readNumber(item, "category_id") ||
										current.key ===
											readString(item, "category_key", "category"),
								) || category;
							return {
								name: readString(item, "name", "title", "description"),
								expected_amount:
									readNumber(
										item,
										"space_amount",
										"expected_amount",
										"line_total",
										"total",
										"amount",
										"price",
									) || null,
								category_id: itemCategory?.id || null,
							};
						})
						.filter((item) => item.name)
				: [];
			const fallbackTitle =
				readString(data, "title", "name") || candidate.title;
			setDismissedCaptureSourceID(candidate.source_document_id);
			setEditingPlanCandidate(candidate);
			setEditingPlan({
				id: 0,
				tenant_id: reviewSpace?.tenant_id || 0,
				space_id: reviewSpaceID,
				created_by_user_id: user?.id || 0,
				title: fallbackTitle,
				expected_amount:
					readNumber(data, "expected_amount", "total", "amount") || null,
				currency:
					readString(data, "currency") || reviewSpace?.currency || currency,
				category_id: category?.id || null,
				vendor_id: readNumber(data, "vendor_id") || null,
				vendor_name: readString(
					data,
					"vendor_name",
					"payee_text",
					"merchant_name",
				),
				due_date:
					readString(data, "due_date", "planned_date", "expense_date") || null,
				status: "planned",
				source_document_id: candidate.source_document_id,
				items:
					recognizedItems.length > 0
						? recognizedItems
						: [
								{
									name: fallbackTitle,
									expected_amount:
										readNumber(data, "expected_amount", "total", "amount") ||
										null,
									category_id: category?.id || null,
								},
							],
			});
			return;
		}
		const previousView = view === "review" ? "overview" : view;
		const controller = new AbortController();
		blockingRequest.current?.abort();
		blockingRequest.current = controller;
		reviewReturnView.current = previousView;
		setDismissedCaptureSourceID(candidate.source_document_id);
		setOpeningReview(true);
		setSaving(true);
		setCaptureFailure("");
		try {
			setSavedReviewExpense(null);
			setReviewDraft(null);
			setReviewMediaURL("");
			setView("review");
			if (previewMode) {
				setReviewDraft(reviewDraftFromCandidate(candidate, reviewCandidates));
			} else {
				await loadReview(
					token,
					reviewSpaceID,
					candidate.id,
					candidate.source_document_id,
					controller.signal,
				);
			}
		} catch (err) {
			if (controller.signal.aborted) return;
			setDismissedCaptureSourceID(0);
			setView(previousView);
			setCaptureFailure(
				err instanceof Error ? err.message : "Не удалось открыть результат",
			);
		} finally {
			if (blockingRequest.current === controller) {
				blockingRequest.current = null;
				setOpeningReview(false);
				setSaving(false);
			}
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
		setCaptureFailurePurpose(purpose);
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
				...(submission.kind === "voice"
					? { voice_duration_seconds: submission.durationSeconds }
					: {}),
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
				if (submission.kind === "image") {
					for (const file of submission.files)
						body.append("file", file, file.name);
				} else {
					body.append("file", submission.file, submission.file.name);
				}
				captured = await apiRequest<CaptureResponse>("/capture", token, {
					method: "POST",
					body,
				});
			}
			if (!captured.source_document_id)
				throw new Error("Сервер не подтвердил загрузку расхода");
			const sourceDocumentID = captured.source_document_id;
			setPendingCaptures((current) => [
				...current,
				{
					sourceDocumentID,
					spaceID,
					purpose,
				},
			]);
			setCaptureOpen(false);
		} catch (err) {
			if (
				err instanceof ApiError &&
				(err.status === 422 || err.code === "unrecognized_input")
			) {
				setCaptureFailurePurpose(purpose);
				setCaptureFailure(
					uiText(
						language,
						purpose === "purchase_plan"
							? "captureUnrecognizedPlan"
							: "captureUnrecognizedExpense",
					),
				);
				setCaptureOpen(false);
				setCaptureError("");
				return;
			}
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
		if (!token || !pendingCaptures.length || previewMode) return;
		let cancelled = false;
		const timers = new Set<number>();
		const poll = async (pending: PendingCapture) => {
			try {
				const packets = await apiRequest<{ captures: CapturePacket[] }>(
					`/spaces/${pending.spaceID}/captures?limit=1&source_document_id=${pending.sourceDocumentID}`,
					token,
				);
				if (cancelled) return;
				const packet = packets.captures[0];
				if (packet?.processing_status === "failed") {
					setCaptureFailurePurpose(pending.purpose);
					setPendingCaptures((current) =>
						current.filter(
							(item) => item.sourceDocumentID !== pending.sourceDocumentID,
						),
					);
					setCaptureFailure(
						packet.failure_code === "unrecognized_input"
							? uiText(
									language,
									pending.purpose === "purchase_plan"
										? "captureUnrecognizedPlan"
										: "captureUnrecognizedExpense",
								)
							: pending.purpose === "purchase_plan"
								? "Не удалось разобрать план. Попробуйте ещё раз"
								: "Не удалось разобрать расход. Попробуйте ещё раз",
					);
					setNotice(
						pending.purpose === "purchase_plan"
							? "Не удалось разобрать план"
							: "Не удалось разобрать расход",
					);
					void refreshNotifications();
					return;
				}
				if (packet?.processing_status === "succeeded") {
					const candidates = await apiRequest<{
						candidates: ReviewCandidate[];
					}>(
						`/spaces/${pending.spaceID}/review/candidates?limit=100&source_document_id=${pending.sourceDocumentID}`,
						token,
					);
					if (cancelled) return;
					const candidateType =
						pending.purpose === "purchase_plan"
							? "purchase_plan_candidate"
							: "expense_candidate";
					const candidate = candidates.candidates.find(
						(item) => item.candidate_type === candidateType,
					);
					if (!candidate) {
						setCaptureFailurePurpose(pending.purpose);
						setPendingCaptures((current) =>
							current.filter(
								(item) => item.sourceDocumentID !== pending.sourceDocumentID,
							),
						);
						setCaptureFailure(
							uiText(
								language,
								pending.purpose === "purchase_plan"
									? "captureUnrecognizedPlan"
									: "captureUnrecognizedExpense",
							),
						);
						return;
					}
					setReviewCandidates((current) => [
						...current.filter(
							(item) => item.source_document_id !== pending.sourceDocumentID,
						),
						...candidates.candidates,
					]);
					setSavedReviewExpense(null);
					setReviewDraft(null);
					setReviewMediaURL("");
					setEditingExpense(null);
					setEditingItemIndex(null);
					setNotice(
						pending.purpose === "purchase_plan"
							? "План готов. Проверьте распознанные данные"
							: "Расход готов. Проверьте распознанные данные",
					);
					setPendingCaptures((current) =>
						current.filter(
							(item) => item.sourceDocumentID !== pending.sourceDocumentID,
						),
					);
					void refreshNotifications();
					if (pending.spaceID === spaceID)
						void apiRequest<Quota>(`/quota?space_id=${pending.spaceID}`, token)
							.then((updatedQuota) => {
								if (!cancelled) setQuota(updatedQuota);
							})
							.catch(() => {
								// The finished capture remains usable if the quota refresh fails.
							});
					return;
				}
			} catch {
				// A temporary network failure should not lose a persisted capture.
			}
			if (!cancelled) {
				const timer = window.setTimeout(() => {
					timers.delete(timer);
					void poll(pending);
				}, 2_000);
				timers.add(timer);
			}
		};
		for (const pending of pendingCaptures) void poll(pending);
		return () => {
			cancelled = true;
			for (const timer of timers) window.clearTimeout(timer);
		};
	}, [
		token,
		pendingCaptures.map((pending) => pending.sourceDocumentID).join(","),
		spaceID,
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
						void refreshNotifications();
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
		if (!token || captureSubmitting || previewMode) return;
		const queued = captures.filter(
			(capture) =>
				capture.processing_status === "pending" ||
				capture.processing_status === "processing",
		);
		if (!queued.length) return;
		setPendingCaptures((current) => [
			...current,
			...queued
				.filter(
					(capture) =>
						!current.some(
							(pending) =>
								pending.sourceDocumentID === capture.source_document_id,
						),
				)
				.map(
					(capture): PendingCapture => ({
						sourceDocumentID: capture.source_document_id,
						spaceID: capture.space_id || spaceID,
						purpose:
							capture.source_context?.capture_target === "purchase_plan"
								? "purchase_plan"
								: "expense",
					}),
				),
		]);
	}, [token, captures, captureSubmitting, spaceID]);

	const closeReview = () => {
		setReviewDraft(null);
		setSavedReviewExpense(null);
		setReviewMediaURL("");
		if (requestedReview) {
			setView(reviewReturnView.current);
			WebApp.close();
			return;
		}
		setView(reviewReturnView.current);
		void loadSpace();
	};

	const openSourceDocument = async (
		sourceDocumentID: number | undefined,
		sourceSpaceID: number,
		missingMessage: string,
	) => {
		if (sourceLoading) return;
		if (!sourceDocumentID) {
			setNotice(missingMessage);
			return;
		}
		const controller = new AbortController();
		blockingRequest.current?.abort();
		blockingRequest.current = controller;
		setSourceLoading(true);
		setOpeningLabel(uiText(language, "openingSource"));
		setError("");
		try {
			let capture = captureForSourceDocument(sourceDocumentID, captures);
			if (!capture && !previewMode) {
				const response = await apiRequest<{ captures: CapturePacket[] }>(
					`/spaces/${sourceSpaceID}/captures?limit=1&source_document_id=${sourceDocumentID}`,
					token,
					{ signal: controller.signal },
				);
				capture = response.captures.find(
					(item) => item.source_document_id === sourceDocumentID,
				);
				if (capture)
					setCaptures((current) => [...current, capture as CapturePacket]);
			}
			if (!capture) throw new Error("Исходный материал не найден");

			const viewer: SourceViewer = { capture, media: [] };
			const media = capture.media?.length
				? [...capture.media].sort(
						(left, right) => left.position - right.position,
					)
				: capture.media_object_id
					? [
							{
								media_object_id: capture.media_object_id,
								position: 0,
							},
						]
					: [];
			if (media.length && !previewMode) {
				try {
					for (const item of media) {
						const response = await fetch(
							`/api/v1/media/${item.media_object_id}`,
							{
								signal: controller.signal,
								headers: { Authorization: `Bearer ${token}` },
							},
						);
						if (!response.ok)
							throw new Error("Не удалось загрузить исходный файл");
						const blob = await response.blob();
						viewer.media.push({
							id: item.media_object_id,
							url: URL.createObjectURL(blob),
							type: blob.type || item.content_type || "",
						});
					}
				} catch (error) {
					for (const item of viewer.media) URL.revokeObjectURL(item.url);
					throw error;
				}
			}
			setSourceViewer(viewer);
		} catch (err) {
			if (!controller.signal.aborted)
				setError(
					err instanceof Error ? err.message : "Не удалось открыть исходник",
				);
		} finally {
			if (blockingRequest.current === controller) {
				blockingRequest.current = null;
				setSourceLoading(false);
				setOpeningLabel("");
			}
		}
	};
	const openExpenseSource = (expense: Expense) =>
		openSourceDocument(
			expense.source_document_id,
			spaceID,
			"У этого расхода нет сохранённого исходника",
		);
	const openPlanSource = (plan: PurchasePlan) =>
		openSourceDocument(
			plan.source_document_id || editingPlanCandidate?.source_document_id,
			plan.space_id || spaceID,
			"У этого плана нет сохранённого исходника",
		);

	useEffect(
		() => () => {
			if (reviewMediaURL) URL.revokeObjectURL(reviewMediaURL);
		},
		[reviewMediaURL],
	);

	useEffect(
		() => () => {
			for (const media of sourceViewer?.media || [])
				URL.revokeObjectURL(media.url);
		},
		[sourceViewer],
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
				const saved = reviewExpenseFromDraft(reviewDraft, currency);
				setSavedReviewExpense(saved);
				setExpenses((current) => [
					saved,
					...current.filter((expense) => expense.id !== saved.id),
				]);
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
			setExpenses((current) => [
				result.expense,
				...current.filter((expense) => expense.id !== result.expense.id),
			]);
			setReviewCandidates((current) =>
				current.filter((candidate) => candidate.id !== reviewDraft.candidateID),
			);
			void apiRequest<{ categories: Category[] }>(
				`/spaces/${spaceID}/categories`,
				token,
			)
				.then((data) => {
					setCategories(data.categories || []);
					setCategorySpaceID(spaceID);
				})
				.catch(() => undefined);
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

	const deleteReview = async () => {
		if (!reviewDraft || saving) return;
		if (!window.confirm("Удалить этот распознанный расход?")) return;
		const sourceDocumentID = reviewDraft.sourceDocumentID;
		setDeletingReview(true);
		setSaving(true);
		setError("");
		try {
			if (!previewMode) {
				await apiRequest(
					`/spaces/${spaceID}/review/captures/${sourceDocumentID}`,
					token,
					{ method: "DELETE" },
				);
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
			setDismissedCaptureSourceID(sourceDocumentID);
			setNotice("Распознанный расход удалён");
			closeReview();
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Не удалось удалить расход",
			);
		} finally {
			setDeletingReview(false);
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
				...(item.tags || []),
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

	const knownTags = useMemo(
		() =>
			Array.from(
				new Set(
					expenses.flatMap((expense) =>
						expense.items.flatMap((item) => [
							...(item.tags || []),
							...hashtagsFromText(item.notes || ""),
						]),
					),
				),
			).sort((left, right) => left.localeCompare(right, "ru")),
		[expenses],
	);

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
	const spaceSubtitle = (space: Space) =>
		`${uiText(
			language,
			space.is_personal
				? "personalSpace"
				: space.owner_user_id === user?.id
					? "spaceOwner"
					: "spaceMember",
		)} · ${space.currency}`;
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
		return homeCategoryRows(
			categories.map((category) => ({
				...category,
				filteredTotal: totals.get(category.id) || 0,
			})),
		);
	}, [categories, overviewExpenses, currency]);
	const hasAnyBudgets = categories.some(
		(category) => (category.budget_amount || 0) > 0,
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

	const editCategory = (category: Category) =>
		setEditingCategory({
			...category,
			alias_text: category.aliases?.join(", ") || "",
		});

	const toggleCategoryPin = async (category: Category) => {
		const pinned = !category.pinned;
		setCategories((current) =>
			current.map((item) =>
				item.id === category.id ? { ...item, pinned } : item,
			),
		);
		if (previewMode) {
			setNotice(
				uiText(language, pinned ? "categoryPinned" : "categoryUnpinned"),
			);
			return;
		}
		try {
			await apiRequest(
				`/spaces/${spaceID}/categories/${category.id}/pin`,
				token,
				{ method: "PUT", body: JSON.stringify({ pinned }) },
			);
		} catch (err) {
			setCategories((current) =>
				current.map((item) =>
					item.id === category.id ? { ...item, pinned: category.pinned } : item,
				),
			);
			setNotice(
				err instanceof Error
					? err.message
					: uiText(language, "categoryPinFailed"),
			);
		}
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
		setInstallGuideOpen(true);
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
					current.flatMap((plan) => {
						if (plan.id !== completingPlanID) return [plan];
						const remaining = purchasePlanItems(plan).filter(
							(item) => item.id !== completingPlanItemID,
						);
						return completingPlanItemID && remaining.length > 0
							? [withPurchasePlanItems(plan, remaining)]
							: [];
					}),
				);
				setCompletingPlanID(0);
				setCompletingPlanItemID(0);
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
							notes: item.notes || "",
							tags: item.tags || hashtagsFromText(item.notes || ""),
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
								tags: (item.tags || hashtagsFromText(item.notes || "")).map(
									(name) => ({ name }),
								),
							})),
						}),
					},
				);
			}
			if (creating && completingPlanID && savedExpenseID > 0) {
				try {
					await apiRequest(
						`/spaces/${spaceID}/plans/${completingPlanID}${completingPlanItemID ? `/items/${completingPlanItemID}` : ""}/complete`,
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
			setCompletingPlanItemID(0);
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

	const deleteExpense = async (expense: Expense | null = editingExpense) => {
		if (!expense || expense.id === 0) return;
		if (!window.confirm(`Удалить расход «${expense.title}»?`)) return;
		if (previewMode) {
			setExpenses((current) =>
				current.filter((currentExpense) => currentExpense.id !== expense.id),
			);
			setEditingExpense(null);
			setEditingItemIndex(null);
			setRecordDetail(null);
			setNotice("Расход удалён");
			return;
		}
		setSaving(true);
		try {
			await apiRequest(`/spaces/${spaceID}/expenses/${expense.id}`, token, {
				method: "DELETE",
			});
			setEditingExpense(null);
			setEditingItemIndex(null);
			setRecordDetail(null);
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

	const moveExpense = async (
		targetSpaceID: number,
		expense: Expense | null = editingExpense,
		itemIndex: number | null = editingItemIndex,
		operation: TransferOperation = "move",
	) => {
		if (!expense?.id || saving) return;
		const item = itemIndex === null ? null : expense.items[itemIndex];
		const path = item?.id ? `/items/${item.id}` : "";
		if (previewMode) {
			setExpenses((current) => {
				if (operation === "move") {
					return current.filter(
						(currentExpense) => currentExpense.id !== expense.id,
					);
				}
				const clonedItems = item
					? [{ ...item, id: Date.now() }]
					: expense.items.map((current, index) => ({
							...current,
							id: Date.now() + index,
						}));
				return [
					...current,
					{
						...expense,
						id: Math.max(0, ...current.map(({ id }) => id)) + 1,
						user_id: user?.id || expense.user_id,
						title: item ? item.name : expense.title,
						items: clonedItems,
						source_document_id: undefined,
					},
				];
			});
			setEditingExpense(null);
			setEditingItemIndex(null);
			setRecordDetail(null);
			setSpaceID(targetSpaceID);
			setNotice(
				uiText(
					language,
					operation === "clone" ? "expenseCloned" : "expenseMoved",
				),
			);
			return;
		}
		setSaving(true);
		try {
			await apiRequest(
				`/spaces/${spaceID}/expenses/${expense.id}${path}/move`,
				token,
				{
					method: "POST",
					body: JSON.stringify({
						target_space_id: targetSpaceID,
						operation,
					}),
				},
			);
			setEditingExpense(null);
			setEditingItemIndex(null);
			setRecordDetail(null);
			if (operation === "move") {
				setExpenses((current) =>
					current.filter((currentExpense) => currentExpense.id !== expense.id),
				);
			}
			setSpaceID(targetSpaceID);
			setNotice(
				uiText(
					language,
					operation === "clone" ? "expenseCloned" : "expenseMoved",
				),
			);
		} catch (err) {
			setNotice(
				err instanceof Error ? err.message : uiText(language, "moveFailed"),
			);
		} finally {
			setSaving(false);
		}
	};

	const deleteExpenseItem = async (
		expense: Expense | null = editingExpense,
		itemIndex: number | null = editingItemIndex,
	) => {
		if (!expense || itemIndex === null || expense.id === 0) return;
		const item = expense.items[itemIndex];
		if (!item?.id) return;
		const deletesExpense = expense.items.length === 1;
		const message = deletesExpense
			? `Это последняя покупка. Удалить её вместе с расходом «${expense.title}»?`
			: `Удалить покупку «${item.name}»?`;
		if (!window.confirm(message)) return;
		if (previewMode) {
			if (deletesExpense) {
				setExpenses((current) =>
					current.filter((currentExpense) => currentExpense.id !== expense.id),
				);
			} else {
				const items = expense.items.filter((_, index) => index !== itemIndex);
				const total = items.reduce((sum, current) => sum + current.amount, 0);
				setExpenses((current) =>
					current.map((currentExpense) =>
						currentExpense.id === expense.id
							? { ...expense, items, total, space_total: total }
							: currentExpense,
					),
				);
			}
			setEditingExpense(null);
			setEditingItemIndex(null);
			setRecordDetail(null);
			setNotice(deletesExpense ? "Расход удалён" : "Покупка удалена");
			return;
		}
		setSaving(true);
		try {
			const result = await apiRequest<{ expense_deleted: boolean }>(
				`/spaces/${spaceID}/expenses/${expense.id}/items/${item.id}`,
				token,
				{ method: "DELETE" },
			);
			setEditingExpense(null);
			setEditingItemIndex(null);
			setRecordDetail(null);
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
								is_system: false,
								created_by_user_id: user?.id,
								created_by_name: user?.name,
								can_edit: true,
								can_delete: true,
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

	const uploadProfileAvatar = async (file: File) => {
		if (file.size > 5 * 1024 * 1024) {
			setNotice(uiText(language, "avatarTooLarge"));
			return;
		}
		if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
			setNotice(uiText(language, "avatarFormatError"));
			return;
		}
		if (previewMode) {
			setProfileAvatarURL(URL.createObjectURL(file));
			setNotice(uiText(language, "avatarSaved"));
			return;
		}
		const body = new FormData();
		body.append("avatar", file);
		setProfileAvatarSaving(true);
		try {
			const saved = await apiRequest<User>("/auth/profile/avatar", token, {
				method: "POST",
				body,
			});
			setUser(saved);
			setNotice(uiText(language, "avatarSaved"));
		} catch (err) {
			setNotice(
				err instanceof Error
					? err.message
					: uiText(language, "avatarSaveFailed"),
			);
		} finally {
			setProfileAvatarSaving(false);
		}
	};

	const removeProfileAvatar = async () => {
		if (previewMode) {
			setProfileAvatarURL(user?.telegramPhotoUrl || "");
			setNotice(uiText(language, "avatarRemoved"));
			return;
		}
		setProfileAvatarSaving(true);
		try {
			const saved = await apiRequest<User>("/auth/profile/avatar", token, {
				method: "DELETE",
			});
			setUser(saved);
			setNotice(uiText(language, "avatarRemoved"));
		} catch (err) {
			setNotice(
				err instanceof Error
					? err.message
					: uiText(language, "avatarSaveFailed"),
			);
		} finally {
			setProfileAvatarSaving(false);
		}
	};

	const saveProfile = async () => {
		if (!editingProfile) return;
		const profileToSave = {
			...editingProfile,
			name: editingProfile.name.trim(),
		};
		if (previewMode) {
			setUser(profileToSave);
			setEditingProfile(null);
			setNotice(uiText(language, "profileSaved"));
			return;
		}
		setSaving(true);
		try {
			const saved = await apiRequest<User>("/auth/profile", token, {
				method: "PUT",
				body: JSON.stringify(profileToSave),
			});
			if (profileEditorMode === "notifications") {
				await apiRequest("/me/notification-channels", token, {
					method: "PUT",
					body: JSON.stringify({
						channels: {
							in_app: true,
							email: notificationChannelSettings.preferred === "email",
							telegram: notificationChannelSettings.preferred === "telegram",
							push: false,
						},
						delivery_time: profileToSave.notificationTime || "09:00",
					}),
				});
			}
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

	const openNotificationSettings = async () => {
		if (!user) return;
		setProfileEditorMode("notifications");
		setEditingProfile({
			...user,
			timezone:
				user.timezone ||
				Intl.DateTimeFormat().resolvedOptions().timeZone ||
				"Europe/Moscow",
			notificationTime: user.notificationTime || "09:00",
		});
		const available = {
			email:
				Boolean(user.emailVerified) &&
				Boolean(user.email) &&
				!user.email.endsWith("@telegram.local"),
			telegram: Boolean(user.telegramId),
		};
		const fallback: NotificationChannel | "" =
			user.authType === "email" && available.email
				? "email"
				: available.telegram
					? "telegram"
					: available.email
						? "email"
						: "";
		setNotificationChannelSettings({ preferred: fallback, available });
		if (previewMode || !token) return;
		try {
			const response = await apiRequest<{
				channels: {
					channel: string;
					enabled: boolean;
					available?: boolean;
				}[];
				delivery_time: string;
				preferred_channel?: string;
			}>("/me/notification-channels", token);
			const nextAvailable = {
				email:
					response.channels.find(({ channel }) => channel === "email")
						?.available ?? available.email,
				telegram:
					response.channels.find(({ channel }) => channel === "telegram")
						?.available ?? available.telegram,
			};
			const preferred =
				response.preferred_channel === "email" ||
				response.preferred_channel === "telegram"
					? response.preferred_channel
					: fallback;
			setNotificationChannelSettings({
				preferred,
				available: nextAvailable,
			});
			setEditingProfile((current) =>
				current
					? {
							...current,
							notificationTime:
								response.delivery_time || current.notificationTime,
						}
					: current,
			);
		} catch {
			// Profile defaults remain usable if notification preferences are unavailable.
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

	const removeSpaceMember = async (member: SpaceMember) => {
		if (
			!activeSpace ||
			activeSpace.owner_user_id !== user?.id ||
			member.user_id === activeSpace.owner_user_id ||
			saving
		)
			return;
		if (
			!window.confirm(
				`Удалить ${member.name || "участника"} из пространства «${activeSpace.name}»?`,
			)
		)
			return;
		setSaving(true);
		try {
			if (!previewMode) {
				await apiRequest(
					`/spaces/${activeSpace.id}/members/${member.user_id}`,
					token,
					{ method: "DELETE" },
				);
			}
			setMembers((current) =>
				current.filter((item) => item.user_id !== member.user_id),
			);
			setNotice(`${member.name || "Участник"} удалён из пространства`);
		} catch (err) {
			setNotice(
				err instanceof Error ? err.message : "Не удалось удалить участника",
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
			vendor_id: null,
			vendor_name: "",
			due_date: null,
			status: "planned",
			items: [{ name: "", expected_amount: null, category_id: null }],
		});
	};

	const savePlan = async () => {
		if (!editingPlan) return;
		const planSpaceID = editingPlan.space_id || spaceID;
		const vendorName = (
			editingPlan.vendor_name ||
			vendors.find((vendor) => vendor.id === editingPlan.vendor_id)?.name ||
			""
		).trim();
		let vendorID =
			editingPlan.vendor_id || findVendorByName(vendors, vendorName)?.id;
		const payload = {
			title: editingPlan.title.trim(),
			expected_amount: editingPlan.expected_amount || null,
			category_id: editingPlan.category_id || null,
			vendor_id: vendorID || null,
			due_date: editingPlan.due_date?.slice(0, 10) || "",
			items: purchasePlanItems(editingPlan).map((item) => ({
				name: item.name.trim(),
				expected_amount: item.expected_amount || null,
				category_id: item.category_id || null,
			})),
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
			if (!vendorID && vendorName) {
				const vendor = await apiRequest<Vendor>(
					`/spaces/${planSpaceID}/vendors`,
					token,
					{
						method: "POST",
						body: JSON.stringify({ name: vendorName, aliases: [] }),
					},
				);
				vendorID = vendor.id;
				payload.vendor_id = vendor.id;
				setVendors((current) =>
					current.some((item) => item.id === vendor.id)
						? current
						: [...current, vendor],
				);
			}
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

	const deletePlan = async (plan: PurchasePlan | null = editingPlan) => {
		if (!plan?.id) return;
		if (!window.confirm(uiText(language, "deletePlanConfirm"))) return;
		if (previewMode) {
			setPlans((current) => current.filter((item) => item.id !== plan.id));
			setEditingPlan(null);
			setRecordDetail(null);
			setNotice(uiText(language, "planDeleted"));
			return;
		}
		setSaving(true);
		try {
			await apiRequest(
				`/spaces/${plan.space_id || spaceID}/plans/${plan.id}`,
				token,
				{
					method: "DELETE",
				},
			);
			setPlans((current) => current.filter((item) => item.id !== plan.id));
			setEditingPlan(null);
			setRecordDetail(null);
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

	const deletePlanItem = async (plan: PurchasePlan, itemIndex: number) => {
		const item = purchasePlanItems(plan)[itemIndex];
		if (!item?.id || saving) return;
		const deletesPlan = purchasePlanItems(plan).length === 1;
		if (
			!window.confirm(
				deletesPlan
					? uiText(language, "deletePlanConfirm")
					: uiText(language, "deletePlanItemConfirm"),
			)
		)
			return;
		if (!previewMode) {
			setSaving(true);
			try {
				await apiRequest(
					`/spaces/${plan.space_id || spaceID}/plans/${plan.id}/items/${item.id}`,
					token,
					{ method: "DELETE" },
				);
			} catch (err) {
				setNotice(
					err instanceof Error
						? err.message
						: uiText(language, "planDeleteFailed"),
				);
				setSaving(false);
				return;
			}
			setSaving(false);
		}
		setPlans((current) =>
			current.flatMap((currentPlan) => {
				if (currentPlan.id !== plan.id) return [currentPlan];
				if (deletesPlan) return [];
				return [
					withPurchasePlanItems(
						currentPlan,
						purchasePlanItems(currentPlan).filter(
							(_, index) => index !== itemIndex,
						),
					),
				];
			}),
		);
		setRecordDetail(null);
		setNotice(
			deletesPlan
				? uiText(language, "planDeleted")
				: uiText(language, "planItemDeleted"),
		);
	};

	const movePlan = async (
		targetSpaceID: number,
		plan: PurchasePlan | null = editingPlan,
		itemIndex: number | null = null,
		operation: TransferOperation = "move",
	) => {
		if (!plan?.id || saving) return;
		const sourceSpaceID = plan.space_id || spaceID;
		const item = itemIndex === null ? null : purchasePlanItems(plan)[itemIndex];
		const path = item?.id ? `/items/${item.id}` : "";
		if (previewMode) {
			setPlans((current) => {
				if (operation === "move") {
					return current.filter((currentPlan) => currentPlan.id !== plan.id);
				}
				const clonedItems = item
					? [{ ...item, id: Date.now() }]
					: purchasePlanItems(plan).map((current, index) => ({
							...current,
							id: Date.now() + index,
						}));
				return [
					...current,
					withPurchasePlanItems(
						{
							...plan,
							id: Math.max(0, ...current.map(({ id }) => id)) + 1,
							space_id: targetSpaceID,
							created_by_user_id: user?.id || plan.created_by_user_id,
							title: item ? item.name : plan.title,
							source_document_id: undefined,
						},
						clonedItems,
					),
				];
			});
			setEditingPlan(null);
			setRecordDetail(null);
			setSpaceID(targetSpaceID);
			setNotice(
				uiText(language, operation === "clone" ? "planCloned" : "planMoved"),
			);
			return;
		}
		setSaving(true);
		try {
			await apiRequest(
				`/spaces/${sourceSpaceID}/plans/${plan.id}${path}/move`,
				token,
				{
					method: "POST",
					body: JSON.stringify({
						target_space_id: targetSpaceID,
						operation,
					}),
				},
			);
			setEditingPlan(null);
			setRecordDetail(null);
			if (operation === "move") {
				setPlans((current) =>
					current.filter((currentPlan) => currentPlan.id !== plan.id),
				);
			}
			setSpaceID(targetSpaceID);
			setNotice(
				uiText(language, operation === "clone" ? "planCloned" : "planMoved"),
			);
		} catch (err) {
			setNotice(
				err instanceof Error ? err.message : uiText(language, "moveFailed"),
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

	const buyPlan = (plan: PurchasePlan, planItem?: PurchasePlanItem) => {
		const fallbackCategory =
			categories.find((item) => item.key === "other") || categories[0];
		const vendorName =
			plan.vendor_name ||
			vendors.find((vendor) => vendor.id === plan.vendor_id)?.name ||
			"";
		setCompletingPlanID(plan.id);
		setCompletingPlanItemID(planItem?.id || 0);
		setEditingItemIndex(null);
		setEditingExpense({
			id: 0,
			user_id: user?.id || 0,
			title: planItem?.name || plan.title,
			payee_text: vendorName,
			vendor_id: plan.vendor_id || undefined,
			expense_date: localISODate(),
			currency: plan.currency,
			space_currency: plan.currency,
			items: (planItem ? [planItem] : purchasePlanItems(plan)).map((item) => ({
				name: item.name,
				amount: item.expected_amount || 0,
				category_id: item.category_id || fallbackCategory?.id,
				vendor_id: plan.vendor_id || undefined,
				vendor_name: vendorName,
			})),
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
			vendor_id: item.vendor_id || editingExpense.vendor_id || null,
			vendor_name:
				item.vendor_name ||
				vendors.find(
					(vendor) =>
						vendor.id === (item.vendor_id || editingExpense.vendor_id),
				)?.name ||
				editingExpense.payee_text ||
				"",
			due_date: null,
			status: "planned",
			items: [
				{
					name: item.name,
					expected_amount: item.space_amount ?? item.amount,
					category_id: item.category_id || null,
				},
			],
		});
	};

	const addExpense = () => {
		setCompletingPlanID(0);
		setCompletingPlanItemID(0);
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
		if (captureSubmitting) {
			setNotice("Текущий запрос ещё отправляется");
			return;
		}
		setCaptureError("");
		setCaptureFailure("");
		setCaptureMode(mode);
		setCapturePurpose(purpose);
		setCaptureOpen(true);
	};

	const editRecord = (detail: RecordDetail) => {
		setRecordDetail(null);
		if (detail.kind === "expense" || detail.kind === "expense-item") {
			setEditingItemIndex(
				detail.kind === "expense-item" ? detail.itemIndex : null,
			);
			setEditingExpense({
				...detail.expense,
				items: detail.expense.items.map((item) => ({ ...item })),
			});
			return;
		}
		setEditingPlan({
			...detail.plan,
			items: purchasePlanItems(detail.plan).map((item) => ({ ...item })),
		});
	};

	const cancelBlockingLoad = () => {
		blockingRequest.current?.abort();
		blockingRequest.current = null;
		setOpeningLabel("");
		setOpeningReview(false);
		setSourceLoading(false);
		setBillingLoading(false);
		setSaving(false);
		if (view !== "review") return;
		if (loading) {
			loadSequence.current += 1;
			setLoading(false);
		}
		setDismissedCaptureSourceID(0);
		setReviewDraft(null);
		setReviewMediaURL("");
		if (requestedReview && WebApp.initData) {
			WebApp.close();
			return;
		}
		setView(reviewReturnView.current);
	};

	const retryService = () => {
		setLoadFailed(false);
		setServiceUnavailable(false);
		setError("");
		setLoading(true);
		if (token) void loadSpace();
		else if (WebApp.initData) void login();
		else void restoreBrowserSession();
	};

	if (serviceUnavailable)
		return <ServiceUnavailable language={language} onRetry={retryService} />;
	if (loading && !token) return <LoadingScreen />;
	if (!token && !WebApp.initData)
		return (
			<BrowserEntry
				error={error}
				homeScreenStatus={homeScreenStatus}
				browserInstallAvailable={Boolean(browserInstallPrompt)}
				installGuideOpen={installGuideOpen}
				onInstall={installOnHomeScreen}
				onCloseInstallGuide={() => setInstallGuideOpen(false)}
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
				onKeyDown={focusNextFieldOnEnter}
				onPointerDown={dismissKeyboard}
			>
				{loading || openingReview ? (
					<LoadingScreen
						label={uiText(language, "openingExpense")}
						onCancel={cancelBlockingLoad}
					/>
				) : savedReviewExpense ? (
					<ReviewSaved expense={savedReviewExpense} onClose={closeReview} />
				) : reviewDraft ? (
					<ReviewEditor
						draft={reviewDraft}
						language={language}
						mediaURL={reviewMediaURL}
						categories={categories}
						vendors={vendors}
						tagSuggestions={knownTags}
						saving={saving}
						deleting={deletingReview}
						error={error}
						onChange={setReviewDraft}
						onSave={saveReview}
						onDelete={deleteReview}
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
			onKeyDown={focusNextFieldOnEnter}
			onPointerDown={dismissKeyboard}
			onTouchStart={beginPullRefresh}
			onTouchMove={movePullRefresh}
			onTouchEnd={endPullRefresh}
			onTouchCancel={() => {
				pullStart.current = null;
				updatePullDistance(0);
			}}
		>
			<div
				className={`mini-pull-refresh${pullDistance > 0 || refreshing ? " is-visible" : ""}`}
				role="status"
				aria-live="polite"
				aria-hidden={pullDistance <= 0 && !refreshing}
			>
				<KnotLoader compact />
				<span>
					{uiText(
						language,
						refreshing
							? "refreshing"
							: pullDistance >= PULL_REFRESH_THRESHOLD
								? "releaseToRefresh"
								: "pullToRefresh",
					)}
				</span>
			</div>
			<header className="mini-header">
				<div className="mini-header-primary">
					<div className="mini-space-switcher" ref={spaceMenuRef}>
						<button
							className={`mini-space-trigger${spaceMenuOpen ? " is-open" : ""}`}
							type="button"
							aria-label={`${uiText(language, "space")}: ${activeSpace?.name || ""}`}
							aria-haspopup="menu"
							aria-expanded={spaceMenuOpen}
							onClick={() => {
								setAccountMenuOpen(false);
								setSpaceMenuOpen((open) => !open);
							}}
						>
							<img className="mini-brand-mark" src={BRAND_LOGO_URL} alt="" />
							<span className="mini-space-trigger-copy">
								<strong>{uiText(language, "brand")}</strong>
								<span>
									<small title={activeSpace?.name}>{activeSpace?.name}</small>
									<CaretDown size={13} weight="bold" />
								</span>
							</span>
						</button>
						{spaceMenuOpen && (
							<div className="mini-space-menu" role="menu">
								{activeSpace && (
									<div className="mini-space-menu-summary">
										<small>{uiText(language, "currentSpace")}</small>
										<strong>{activeSpace.name}</strong>
										<span>{spaceSubtitle(activeSpace)}</span>
									</div>
								)}
								<div className="mini-space-menu-list">
									<small>{uiText(language, "yourSpaces")}</small>
									{spaces.map((space) => (
										<button
											key={space.id}
											className={space.id === spaceID ? "is-active" : ""}
											type="button"
											role="menuitemradio"
											aria-checked={space.id === spaceID}
											onClick={() => {
												setSpaceID(space.id);
												setSpaceMenuOpen(false);
											}}
										>
											<span className="mini-space-menu-icon">
												{space.is_personal ? (
													<House size={18} weight="fill" />
												) : (
													<UsersThree size={18} weight="fill" />
												)}
											</span>
											<span>
												<strong>{space.name}</strong>
												<small>{spaceSubtitle(space)}</small>
											</span>
											{space.id === spaceID && (
												<Check size={18} weight="bold" />
											)}
										</button>
									))}
								</div>
								<div className="mini-space-menu-actions">
									{activeSpace && (
										<button
											type="button"
											role="menuitem"
											onClick={() => {
												setSpaceMenuOpen(false);
												setEditingSpace({ ...activeSpace });
											}}
										>
											<GearSix size={18} />
											<span>{uiText(language, "configureCurrentSpace")}</span>
										</button>
									)}
									<button
										type="button"
										role="menuitem"
										onClick={() => {
											setSpaceMenuOpen(false);
											setView("spaces");
										}}
									>
										<UsersThree size={18} />
										<span>{uiText(language, "manageSpaces")}</span>
										<ArrowRight size={16} />
									</button>
								</div>
							</div>
						)}
					</div>
				</div>
				<div className="mini-header-context">
					<button
						className="mini-notification-trigger"
						type="button"
						aria-label={`${uiText(language, "notifications")}: ${unreadNotificationCount}`}
						title={uiText(language, "notifications")}
						onClick={openNotifications}
					>
						<BellRinging size={20} weight="bold" />
						{unreadNotificationCount > 0 && (
							<span>
								{unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
							</span>
						)}
					</button>
					<div className="mini-account" ref={accountMenuRef}>
						<button
							className="mini-account-trigger"
							type="button"
							aria-label={user?.name || uiText(language, "user")}
							aria-haspopup="menu"
							aria-expanded={accountMenuOpen}
							onClick={() => {
								setSpaceMenuOpen(false);
								setAccountMenuOpen((open) => !open);
							}}
						>
							<span>
								{(user?.name || uiText(language, "user"))
									.slice(0, 1)
									.toUpperCase()}
							</span>
							{profileAvatarURL && (
								<img
									src={profileAvatarURL}
									alt=""
									onError={() => setProfileAvatarURL("")}
								/>
							)}
						</button>
						{accountMenuOpen && (
							<div className="mini-account-menu" role="menu">
								<div className="mini-account-summary">
									<strong>{user?.name || uiText(language, "user")}</strong>
									{(user?.telegramUsername ||
										(user?.email &&
											!user.email.endsWith("@telegram.local"))) && (
										<small>
											{user?.telegramUsername
												? `@${user.telegramUsername}`
												: user?.email}
										</small>
									)}
								</div>
								<button
									type="button"
									role="menuitem"
									onClick={() => {
										setAccountMenuOpen(false);
										setView("subscription");
									}}
								>
									<span className="mini-account-menu-icon">
										<Star size={18} weight="fill" />
									</span>
									<span>
										<strong>
											{uiText(
												language,
												["medium", "plus"].includes(accountQuota?.plan || "")
													? "plus"
													: "basic",
											)}
										</strong>
										<small>
											{uiText(language, "left")}: {accountQuota?.remaining ?? 0}
										</small>
									</span>
									<ArrowRight size={17} />
								</button>
								<button
									type="button"
									role="menuitem"
									onClick={() => {
										setAccountMenuOpen(false);
										setView("profile");
									}}
								>
									<span className="mini-account-menu-icon">
										<GearSix size={18} weight="bold" />
									</span>
									<span>
										<strong>{uiText(language, "settings")}</strong>
									</span>
									<ArrowRight size={17} />
								</button>
								{!WebApp.initData && !previewMode && (
									<button
										className="mini-account-logout"
										type="button"
										role="menuitem"
										onClick={() => {
											setAccountMenuOpen(false);
											logoutBrowser();
										}}
									>
										<span className="mini-account-menu-icon">
											<SignOut size={18} />
										</span>
										<span>
											<strong>{uiText(language, "logout")}</strong>
										</span>
									</button>
								)}
							</div>
						)}
					</div>
				</div>
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
						key={notice}
						className="mini-toast"
						type="button"
						aria-live="polite"
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
								hasAnyBudgets={hasAnyBudgets}
								expenses={overviewExpenses}
								latestExpenses={expenses}
								plans={plans}
								vendors={vendors}
								captures={captures}
								members={members}
								hasAnyExpenses={expenses.length > 0}
								pendingCandidates={pendingReviewCandidates}
								onCategory={openCategory}
								onManageBudgets={() => setView("categories")}
								onExpense={(expense) =>
									setRecordDetail({ kind: "expense", expense })
								}
								onExpenses={openAllExpenses}
								onPlans={(initialPeriod = "all") => {
									setPlanInitialPeriod(initialPeriod);
									setExpenseSection("plans");
									setView("expenses");
								}}
								onEditPlan={(plan) => setRecordDetail({ kind: "plan", plan })}
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
								planInitialPeriod={planInitialPeriod}
								language={language}
								categories={categories}
								vendors={vendors}
								captures={captures}
								members={members}
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
								onPlanSource={openPlanSource}
								onOpenExpense={(expense) =>
									setRecordDetail({ kind: "expense", expense })
								}
								onOpenExpenseItem={({ expense, itemIndex }) =>
									setRecordDetail({ kind: "expense-item", expense, itemIndex })
								}
								onAdd={openCapture}
								onSection={(section) => {
									if (section === "plans") setPlanInitialPeriod("all");
									setExpenseSection(section);
								}}
								onAddPlan={() => openCapture("choose", "purchase_plan")}
								onOpenPlan={(plan) => setRecordDetail({ kind: "plan", plan })}
								onOpenPlanItem={(plan, itemIndex) =>
									setRecordDetail({ kind: "plan-item", plan, itemIndex })
								}
								onBuyPlan={buyPlan}
							/>
						)}
						{view === "vendors" && (
							<VendorsView
								vendors={vendors}
								language={language}
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
								shared={members.length > 1}
								onOpen={openCategory}
								onEdit={editCategory}
								onPin={(category) => void toggleCategoryPin(category)}
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
										is_system: false,
										created_by_user_id: user?.id,
										created_by_name: user?.name,
										can_edit: true,
										can_delete: true,
									})
								}
							/>
						)}
						{view === "spaces" && (
							<SpacesView
								spaces={spaces}
								language={language}
								activeSpaceID={spaceID}
								members={members}
								canManageMembers={activeSpace?.owner_user_id === user?.id}
								saving={saving}
								onSelect={setSpaceID}
								onBack={() => setView("profile")}
								onEdit={(space) => setEditingSpace({ ...space })}
								onRemoveMember={removeSpaceMember}
								onInvite={
									activeSpace &&
									!activeSpace.is_personal &&
									activeSpace.owner_user_id === user?.id
										? setInvitingSpace
										: undefined
								}
								inviting={Boolean(invitingSpace)}
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
								avatarURL={profileAvatarURL}
								avatarSaving={profileAvatarSaving}
								language={language}
								quota={accountQuota}
								developerDashboard={developerDashboard}
								developerDashboardLoading={developerDashboardLoading}
								developerFeedback={developerFeedback}
								developerFeedbackLoading={developerFeedbackLoading}
								selectedFeedbackID={requestedFeedbackID}
								vendorsCount={vendors.length}
								spacesCount={spaces.length}
								homeScreenStatus={homeScreenStatus}
								onInstall={installOnHomeScreen}
								onManageVendors={() => setView("vendors")}
								onManageSpaces={() => setView("spaces")}
								onLinkEmail={() => setEmailLinkOpen(true)}
								onLinkTelegram={() => setTelegramLinkOpen(true)}
								onAvatarUpload={(file) => void uploadProfileAvatar(file)}
								onAvatarRemove={() => void removeProfileAvatar()}
								onEdit={() => {
									if (!user) return;
									setProfileEditorMode("profile");
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
										notificationTime: user.notificationTime || "09:00",
										currency: user.currency || "RUB",
										dateFormat: user.dateFormat || "DD.MM.YYYY",
									});
								}}
								onManageNotifications={() => {
									void openNotificationSettings();
								}}
								onDevUpdate={(patch) => void updateDeveloperQuota(patch)}
								onRefreshDeveloperDashboard={() =>
									void refreshDeveloperDashboard()
								}
								onRefreshDeveloperFeedback={() =>
									void refreshDeveloperFeedback()
								}
								onOpenFeedbackMedia={(feedback, kind) =>
									void openFeedbackMedia(feedback, kind)
								}
								feedbackMediaLoading={feedbackMediaLoading}
								billingLoading={billingLoading}
							/>
						)}
						{view === "subscription" && (
							<SubscriptionView
								language={language}
								quota={accountQuota}
								billingLoading={billingLoading}
								onBack={() => setView("profile")}
								onStartPlus={() => void startCheckout("plus_30d")}
								onBuyPack={() => setPackPickerOpen(true)}
							/>
						)}
					</>
				)}
			</main>

			{showCaptureStatus && (
				<div
					className={`capture-status${captureFailure ? " is-error" : showReadyCandidate && !captureSubmitting && !pendingCapture ? " is-success" : " is-processing"}`}
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
								? captureFailurePurpose === "purchase_plan"
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
										: pendingCaptures.length > 1
											? `Идёт разбор: ${pendingCaptures.length}`
											: pendingCapture?.purpose === "purchase_plan"
												? "Разбираем план…"
												: "Разбираем расход…"}
						</strong>
						<small>
							{captureFailure
								? captureFailure
								: showReadyCandidate && !captureSubmitting && !pendingCapture
									? "Проверьте распознанные данные"
									: pendingCaptures.length > 1
										? "Можно отправлять следующие расходы и планы"
										: "Можно продолжать пользоваться приложением"}
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
							setView("subscription");
						}}
					>
						{uiText(language, "manageSubscription")}
					</button>
				</div>
			)}
			{showExpiredSubscriptionStatus && (
				<div
					className="capture-status is-quota is-exhausted"
					role="alert"
					aria-live="polite"
				>
					<WarningCircle size={22} weight="fill" />
					<div>
						<strong>{uiText(language, "subscriptionExpiredTitle")}</strong>
						<small>{uiText(language, "subscriptionExpiredBody")}</small>
					</div>
					<button
						className="capture-status-dismiss"
						type="button"
						aria-label={uiText(language, "close")}
						onClick={() => setDismissedExpiredSubscription(true)}
					>
						<X size={17} />
					</button>
					<button
						className="capture-status-action"
						type="button"
						onClick={() => {
							setDismissedExpiredSubscription(true);
							setView("subscription");
						}}
					>
						{uiText(language, "manageSubscription")}
					</button>
				</div>
			)}
			{showInstallStatus && (
				<div className="capture-status is-quota is-install" role="status">
					<House size={22} weight="fill" />
					<div>
						<strong>Пока не забыл всегда под рукой</strong>
						<small>Добавьте приложение на главный экран телефона.</small>
					</div>
					<button
						className="capture-status-dismiss"
						type="button"
						aria-label="Закрыть"
						onClick={() => setDismissedInstallPrompt(true)}
					>
						<X size={17} />
					</button>
					<button
						className="capture-status-action"
						type="button"
						onClick={() => {
							setDismissedInstallPrompt(true);
							void installOnHomeScreen();
						}}
					>
						{browserInstallPrompt ? "Установить" : "Как добавить"}
					</button>
				</div>
			)}

			{token &&
				(feedbackStatus?.feedback_daily_remaining ?? 0) > 0 &&
				!showCaptureStatus &&
				!showQuotaStatus &&
				!showExpiredSubscriptionStatus &&
				!showInstallStatus && (
					<button
						className="mini-feedback-button"
						type="button"
						aria-label="Написать в поддержку"
						title="Обратная связь"
						onClick={() => {
							setFeedbackError("");
							setFeedbackOpen(true);
						}}
					>
						<ChatCircleText size={21} weight="bold" />
					</button>
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
					onClick={() => setAddChoiceOpen(true)}
				/>
				<NavButton
					active={view === "categories"}
					label={uiText(language, "navCategories")}
					icon={<Tag />}
					onClick={() => setView("categories")}
				/>
				<NavButton
					active={view === "profile" || view === "vendors" || view === "spaces"}
					label={uiText(language, "settings")}
					icon={<GearSix />}
					onClick={() => {
						setAccountMenuOpen(false);
						setView("profile");
					}}
				/>
			</nav>

			{installGuideOpen && (
				<InstallGuide onClose={() => setInstallGuideOpen(false)} />
			)}

			{addChoiceOpen && (
				<Modal
					title={uiText(language, "addChoiceTitle")}
					onClose={() => setAddChoiceOpen(false)}
				>
					<p className="add-choice-hint">{uiText(language, "addChoiceHint")}</p>
					<div className="add-choice-options">
						<button
							type="button"
							onClick={() => {
								setAddChoiceOpen(false);
								openCapture("choose", "expense");
							}}
						>
							<span className="add-choice-icon is-expense">
								<Receipt size={23} weight="fill" />
							</span>
							<span>
								<strong>{uiText(language, "addExpense")}</strong>
								<small>{uiText(language, "addExpenseHint")}</small>
							</span>
							<ArrowRight size={18} />
						</button>
						<button
							type="button"
							onClick={() => {
								setAddChoiceOpen(false);
								openCapture("choose", "purchase_plan");
							}}
						>
							<span className="add-choice-icon is-plan">
								<CalendarBlank size={23} weight="fill" />
							</span>
							<span>
								<strong>{uiText(language, "addPlan")}</strong>
								<small>{uiText(language, "addPlanHint")}</small>
							</span>
							<ArrowRight size={18} />
						</button>
					</div>
				</Modal>
			)}

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
			{feedbackOpen && (
				<FeedbackComposer
					language={language}
					retentionDays={
						["medium", "plus"].includes(accountQuota?.plan || "") ? 30 : 3
					}
					saving={feedbackSaving}
					error={feedbackError}
					remaining={feedbackStatus?.feedback_daily_remaining ?? 0}
					onClose={() => setFeedbackOpen(false)}
					onSubmit={submitFeedback}
				/>
			)}
			{notificationsOpen && (
				<NotificationCenter
					notifications={notifications}
					unreadCount={unreadNotificationCount}
					loading={notificationsLoading}
					selected={selectedNotification}
					language={language}
					timezone={user?.timezone || "UTC"}
					onSelect={openNotification}
					onBack={() => setSelectedNotification(null)}
					onReadAll={readAllNotifications}
					onDelete={deleteNotification}
					onAction={followNotification}
					onClose={() => {
						setNotificationsOpen(false);
						setSelectedNotification(null);
					}}
				/>
			)}
			{feedbackMedia && (
				<FeedbackMediaModal
					viewer={feedbackMedia}
					onClose={closeFeedbackMedia}
				/>
			)}
			{packPickerOpen && (
				<BillingPackPicker
					language={language}
					plus={accountQuota?.plan === "plus"}
					loading={billingLoading}
					onClose={() => setPackPickerOpen(false)}
					onSelect={(code) => void startCheckout(code)}
				/>
			)}
			{recordDetail?.kind === "expense" && (
				<ExpenseDetail
					expense={recordDetail.expense}
					language={language}
					categories={categories}
					members={members}
					capture={captureForExpense(recordDetail.expense, captures)}
					sourceLoading={sourceLoading}
					moveTargets={spaces.filter(
						(space) =>
							space.id !== spaceID &&
							space.tenant_id === activeSpace?.tenant_id &&
							space.currency === (activeSpace?.currency || currency),
					)}
					saving={saving}
					onClose={() => setRecordDetail(null)}
					onEdit={() => editRecord(recordDetail)}
					onDelete={() => void deleteExpense(recordDetail.expense)}
					onMove={(targetSpaceID, operation) =>
						void moveExpense(
							targetSpaceID,
							recordDetail.expense,
							null,
							operation,
						)
					}
					onSource={() => openExpenseSource(recordDetail.expense)}
					onOpenExpense={() => undefined}
					onOpenItem={(itemIndex) =>
						setRecordDetail({
							kind: "expense-item",
							expense: recordDetail.expense,
							itemIndex,
						})
					}
				/>
			)}
			{recordDetail?.kind === "expense-item" && (
				<ExpenseDetail
					expense={recordDetail.expense}
					itemIndex={recordDetail.itemIndex}
					language={language}
					categories={categories}
					members={members}
					capture={captureForExpense(recordDetail.expense, captures)}
					sourceLoading={sourceLoading}
					moveTargets={spaces.filter(
						(space) =>
							space.id !== spaceID &&
							space.tenant_id === activeSpace?.tenant_id &&
							space.currency === (activeSpace?.currency || currency),
					)}
					saving={saving}
					onClose={() => setRecordDetail(null)}
					onEdit={() => editRecord(recordDetail)}
					onDelete={() =>
						void deleteExpenseItem(recordDetail.expense, recordDetail.itemIndex)
					}
					onMove={(targetSpaceID, operation) =>
						void moveExpense(
							targetSpaceID,
							recordDetail.expense,
							recordDetail.itemIndex,
							operation,
						)
					}
					onSource={() => openExpenseSource(recordDetail.expense)}
					onOpenExpense={() =>
						setRecordDetail({ kind: "expense", expense: recordDetail.expense })
					}
					onOpenItem={() => undefined}
				/>
			)}
			{recordDetail?.kind === "plan" && (
				<PlanDetail
					plan={recordDetail.plan}
					language={language}
					categories={categories}
					vendors={vendors}
					members={members}
					capture={captureForPlan(recordDetail.plan, captures)}
					sourceLoading={sourceLoading}
					moveTargets={spaces.filter(
						(space) =>
							space.id !== (recordDetail.plan.space_id || spaceID) &&
							space.tenant_id === recordDetail.plan.tenant_id &&
							space.currency === recordDetail.plan.currency,
					)}
					saving={saving}
					onClose={() => setRecordDetail(null)}
					onEdit={() => editRecord(recordDetail)}
					onDelete={() => void deletePlan(recordDetail.plan)}
					onMove={(targetSpaceID, operation) =>
						void movePlan(targetSpaceID, recordDetail.plan, null, operation)
					}
					onSource={() => openPlanSource(recordDetail.plan)}
					onOpenPlan={() => undefined}
					onOpenItem={(itemIndex) =>
						setRecordDetail({
							kind: "plan-item",
							plan: recordDetail.plan,
							itemIndex,
						})
					}
				/>
			)}
			{recordDetail?.kind === "plan-item" && (
				<PlanDetail
					plan={recordDetail.plan}
					itemIndex={recordDetail.itemIndex}
					language={language}
					categories={categories}
					vendors={vendors}
					members={members}
					capture={captureForPlan(recordDetail.plan, captures)}
					sourceLoading={sourceLoading}
					moveTargets={spaces.filter(
						(space) =>
							space.id !== (recordDetail.plan.space_id || spaceID) &&
							space.tenant_id === recordDetail.plan.tenant_id &&
							space.currency === recordDetail.plan.currency,
					)}
					saving={saving}
					onClose={() => setRecordDetail(null)}
					onEdit={() => editRecord(recordDetail)}
					onDelete={() =>
						void deletePlanItem(recordDetail.plan, recordDetail.itemIndex)
					}
					onMove={(targetSpaceID, operation) =>
						void movePlan(
							targetSpaceID,
							recordDetail.plan,
							recordDetail.itemIndex,
							operation,
						)
					}
					onSource={() => openPlanSource(recordDetail.plan)}
					onOpenPlan={() =>
						setRecordDetail({ kind: "plan", plan: recordDetail.plan })
					}
					onOpenItem={() => undefined}
				/>
			)}

			{editingExpense && editingItemIndex === null && (
				<ExpenseEditor
					expense={editingExpense}
					language={language}
					categories={categories}
					vendors={vendors}
					itemNameSuggestions={itemNameSuggestions}
					tagSuggestions={knownTags}
					creating={editingExpense.id === 0}
					saving={saving}
					capture={captureForExpense(editingExpense, captures)}
					sourceLoading={sourceLoading}
					moveTargets={spaces.filter(
						(space) =>
							space.id !== spaceID &&
							space.tenant_id === activeSpace?.tenant_id &&
							space.currency === (activeSpace?.currency || currency),
					)}
					onChange={setEditingExpense}
					onClose={() => {
						setEditingExpense(null);
						setCompletingPlanID(0);
						setCompletingPlanItemID(0);
					}}
					onSave={saveExpense}
					onSource={() => openExpenseSource(editingExpense)}
					onMove={(targetSpaceID, operation) =>
						void moveExpense(targetSpaceID, editingExpense, null, operation)
					}
					onDelete={editingExpense.id > 0 ? deleteExpense : undefined}
				/>
			)}
			{editingPlan && (
				<PlanEditor
					plan={editingPlan}
					language={language}
					categories={categories}
					vendors={vendors}
					saving={saving}
					fromCandidate={Boolean(editingPlanCandidate)}
					capture={captureForPlan(editingPlan, captures)}
					sourceLoading={sourceLoading}
					moveTargets={spaces.filter(
						(space) =>
							space.id !== (editingPlan.space_id || spaceID) &&
							space.tenant_id === editingPlan.tenant_id &&
							space.currency === editingPlan.currency,
					)}
					onChange={setEditingPlan}
					onClose={() => {
						setEditingPlan(null);
						setEditingPlanCandidate(null);
					}}
					onSave={savePlan}
					onSource={() => openPlanSource(editingPlan)}
					onMove={(targetSpaceID, operation) =>
						void movePlan(targetSpaceID, editingPlan, null, operation)
					}
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
					tagSuggestions={knownTags}
					saving={saving}
					capture={captureForExpense(editingExpense, captures)}
					sourceLoading={sourceLoading}
					moveTargets={spaces.filter(
						(space) =>
							space.id !== spaceID &&
							space.tenant_id === activeSpace?.tenant_id &&
							space.currency === (activeSpace?.currency || currency),
					)}
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
					onMove={(targetSpaceID, operation) =>
						void moveExpense(
							targetSpaceID,
							editingExpense,
							editingItemIndex,
							operation,
						)
					}
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
					language={language}
					onClose={() => setSourceViewer(null)}
				/>
			)}
			{editingVendor && (
				<VendorEditor
					vendor={editingVendor}
					expenses={expenses}
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
						editingCategory.id > 0 &&
						editingCategory.key !== "other" &&
						editingCategory.can_delete !== false
							? deleteCategory
							: undefined
					}
				/>
			)}
			{editingProfile && (
				<ProfileEditor
					user={editingProfile}
					mode={profileEditorMode}
					notificationChannel={notificationChannelSettings.preferred}
					notificationChannelsAvailable={notificationChannelSettings.available}
					saving={saving}
					onChange={setEditingProfile}
					onNotificationChannelChange={(preferred) =>
						setNotificationChannelSettings((current) => ({
							...current,
							preferred,
						}))
					}
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
			{editingSpace && !invitingSpace && (
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
							? () => setInvitingSpace(editingSpace)
							: undefined
					}
					onDelete={
						editingSpace.id && !editingSpace.is_personal
							? deleteSpace
							: undefined
					}
				/>
			)}
			{invitingSpace && (
				<SpaceInviteDialog
					space={invitingSpace}
					token={token}
					previewMode={previewMode}
					onClose={() => setInvitingSpace(null)}
					onNotice={setNotice}
				/>
			)}
			{openingLabel && (
				<OpeningOverlay label={openingLabel} onCancel={cancelBlockingLoad} />
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
		imageType: readString(data, "image_type", "document_type", "type"),
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
				tags: readStrings(item.tags),
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

const readStrings = (value: unknown) =>
	Array.isArray(value)
		? value.filter((item): item is string => typeof item === "string")
		: [];

const focusNextFieldOnEnter = (event: React.KeyboardEvent<HTMLElement>) => {
	if (
		event.defaultPrevented ||
		event.key !== "Enter" ||
		event.shiftKey ||
		event.ctrlKey ||
		event.metaKey ||
		event.nativeEvent.isComposing ||
		!(event.target instanceof HTMLInputElement)
	)
		return;

	const scope = event.target.closest(
		"form, [role='dialog'], [data-enter-navigation]",
	);
	if (!scope) return;

	const fields = Array.from(
		scope.querySelectorAll<
			HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
		>(
			"input:not([type='hidden']):not([type='checkbox']):not([type='radio']):not([type='file']), select, textarea",
		),
	).filter(
		(field) =>
			!field.disabled &&
			!("readOnly" in field && field.readOnly) &&
			field.tabIndex !== -1,
	);
	const currentIndex = fields.indexOf(event.target);
	const next = currentIndex >= 0 ? fields[currentIndex + 1] : undefined;
	if (!next) return;

	event.preventDefault();
	next.focus();
	next.scrollIntoView({ block: "nearest", inline: "nearest" });
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

const HashtagNotesInput = ({
	language,
	value,
	suggestions,
	onChange,
}: {
	language: UILanguage;
	value: string;
	suggestions: string[];
	onChange: (value: string) => void;
}) => {
	const listID = useId();
	const inputRef = useRef<HTMLTextAreaElement>(null);
	const [cursor, setCursor] = useState(value.length);
	const [focused, setFocused] = useState(false);
	const [activeIndex, setActiveIndex] = useState(0);
	const activeHashtag = hashtagAtCursor(value, cursor);
	const options = activeHashtag
		? hashtagSuggestions(suggestions, activeHashtag.query)
		: [];
	const open = focused && options.length > 0;
	const selectTag = (tag: string) => {
		const replacement = replaceHashtagAtCursor(value, cursor, tag);
		onChange(replacement.value);
		setCursor(replacement.cursor);
		setActiveIndex(0);
		requestAnimationFrame(() => {
			inputRef.current?.focus();
			inputRef.current?.setSelectionRange(
				replacement.cursor,
				replacement.cursor,
			);
		});
	};

	return (
		<label className="hashtag-notes">
			<span>{uiText(language, "notes")}</span>
			<div>
				{open && (
					<div
						id={listID}
						className="hashtag-notes-list"
						role="listbox"
						tabIndex={0}
					>
						{options.map((tag, index) => (
							<button
								id={`${listID}-option-${index}`}
								key={tag}
								className={index === activeIndex ? "active" : undefined}
								type="button"
								role="option"
								aria-selected={index === activeIndex}
								onPointerDown={(event) => {
									event.preventDefault();
									event.stopPropagation();
									selectTag(tag);
								}}
							>
								#{tag}
							</button>
						))}
					</div>
				)}
				<textarea
					ref={inputRef}
					rows={3}
					role="combobox"
					aria-autocomplete="list"
					aria-expanded={open}
					aria-controls={listID}
					aria-activedescendant={
						open ? `${listID}-option-${activeIndex}` : undefined
					}
					placeholder={uiText(language, "notesPlaceholder")}
					value={value}
					onFocus={(event) => {
						setFocused(true);
						setCursor(event.currentTarget.selectionStart);
					}}
					onBlur={() => window.setTimeout(() => setFocused(false), 100)}
					onSelect={(event) => setCursor(event.currentTarget.selectionStart)}
					onChange={(event) => {
						onChange(event.target.value);
						setCursor(event.target.selectionStart);
						setActiveIndex(0);
					}}
					onKeyDown={(event) => {
						if (!open) return;
						if (event.key === "Escape") {
							setFocused(false);
							return;
						}
						if (event.key === "ArrowDown" || event.key === "ArrowUp") {
							event.preventDefault();
							setActiveIndex((current) => {
								const direction = event.key === "ArrowDown" ? 1 : -1;
								return (current + direction + options.length) % options.length;
							});
						}
						if (event.key === "Enter") {
							event.preventDefault();
							selectTag(options[activeIndex]);
						}
					}}
				/>
			</div>
			<small>{uiText(language, "notesHint")}</small>
		</label>
	);
};

const ReviewEditor = ({
	draft,
	language,
	mediaURL,
	categories,
	vendors,
	tagSuggestions,
	saving,
	deleting,
	error,
	onChange,
	onSave,
	onDelete,
	onClose,
}: {
	draft: ReviewDraft;
	language: UILanguage;
	mediaURL: string;
	categories: Category[];
	vendors: Vendor[];
	tagSuggestions: string[];
	saving: boolean;
	deleting: boolean;
	error: string;
	onChange: (draft: ReviewDraft) => void;
	onSave: () => void;
	onDelete: () => void;
	onClose: () => void;
}) => {
	const total = draft.items.reduce((sum, item) => sum + Number(item.amount), 0);
	const estimatedItemPhoto = [
		"item_photo",
		"object_photo",
		"product_photo",
	].includes(draft.imageType.toLowerCase());
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
		incompleteItems > 0 || (!estimatedItemPhoto && totalMatches === false)
			? "warning"
			: "ok";
	const applyItems = (items: ReviewDraftItem[]) => {
		const commonName = commonVendorName(items.map((item) => item.vendor_name));
		onChange({ ...draft, payeeText: commonName ?? "", items });
	};
	const invalid =
		!draft.title.trim() ||
		draft.items.length === 0 ||
		draft.items.some((item) => !item.name.trim() || item.amount <= 0);
	return (
		<main className="review-shell" data-enter-navigation>
			<header className="review-topbar">
				<button type="button" aria-label="Закрыть" onClick={onClose}>
					<X size={22} />
				</button>
				<div>
					<span>{uiText(language, "brand")}</span>
					<b>
						{estimatedItemPhoto
							? "Проверьте оценку"
							: mediaURL
								? "Проверьте чек"
								: "Проверьте расход"}
					</b>
				</div>
				<span className="review-currency">{draft.sourceCurrency}</span>
			</header>

			{mediaURL && (
				<details className="review-source-details">
					<summary>
						<span>
							<Receipt size={19} />
							{estimatedItemPhoto ? "Исходное фото" : "Оригинал чека"}
						</span>
						<em>{estimatedItemPhoto ? "Сравнить" : "Сверить"}</em>
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
								: estimatedItemPhoto
									? "Цена оценена по фото"
									: totalMatches === false
										? "Сумма не сходится"
										: totalMatches
											? "Сумма сошлась"
											: "Проверьте позиции"}
						</b>
						<small>
							{estimatedItemPhoto
								? "Проверьте название и сумму перед сохранением"
								: draft.receiptTotal !== null && totalMatches === false
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
						<article key={item.key} className="review-line">
							<div className="review-line-head">
								<span>
									<b>{index + 1}</b>
									Позиция
								</span>
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
							</div>
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
							<div className="review-line-details">
								<div className="review-line-controls">
									<AmountInput
										ariaLabel={`Цена позиции ${index + 1}`}
										amount={item.amount}
										onChange={(amount) =>
											onChange({
												...draft,
												items: draft.items.map((current, itemIndex) =>
													itemIndex === index
														? { ...current, amount }
														: current,
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
							</div>
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
							<HashtagNotesInput
								language={language}
								value={item.notes}
								suggestions={tagSuggestions}
								onChange={(notes) =>
									applyItems(
										draft.items.map((current, itemIndex) =>
											itemIndex === index
												? {
														...current,
														notes,
														tags: tagsAfterNotesEdit(
															current.tags,
															current.notes,
															notes,
														),
													}
												: current,
										),
									)
								}
							/>
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
									tags: [],
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
					{deleting ? "Подождите…" : saving ? "Сохраняем…" : "Сохранить расход"}
				</button>
				<button
					className="review-delete"
					type="button"
					disabled={saving}
					onClick={onDelete}
				>
					<Trash size={18} />
					{deleting ? "Удаляем…" : "Удалить распознанный расход"}
				</button>
			</footer>
		</main>
	);
};

const ReviewSaved = ({
	expense,
	onClose,
}: {
	expense: Expense;
	onClose: () => void;
}) => {
	const items = Array.isArray(expense.items) ? expense.items : [];
	const total =
		items.length > 0
			? items.reduce((sum, item) => sum + item.amount, 0)
			: expense.total || expense.amount || 0;
	return (
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
				{items.map((item) => (
					<div key={item.id || item.name}>
						<span>{item.name}</span>
						<b>{formatMoney(item.amount, expense.currency)}</b>
					</div>
				))}
				<footer>
					<span>Итого</span>
					<strong>{formatMoney(total, expense.currency)}</strong>
				</footer>
			</article>
			<button type="button" onClick={onClose}>
				Закрыть
			</button>
		</main>
	);
};

const Overview = ({
	user,
	language,
	total,
	currency,
	categories,
	hasAnyBudgets,
	expenses,
	latestExpenses,
	plans,
	vendors,
	captures,
	members,
	hasAnyExpenses,
	pendingCandidates,
	onCategory,
	onManageBudgets,
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
	categories: HomeCategoryRow<Category & { filteredTotal: number }>[];
	hasAnyBudgets: boolean;
	expenses: Expense[];
	latestExpenses: Expense[];
	plans: PurchasePlan[];
	vendors: Vendor[];
	captures: CapturePacket[];
	members: SpaceMember[];
	hasAnyExpenses: boolean;
	pendingCandidates: ReviewCandidate[];
	onCategory: (id: number, period?: Period) => void;
	onManageBudgets: () => void;
	onExpense: (expense: Expense) => void;
	onExpenses: () => void;
	onPlans: (initialPeriod?: Period) => void;
	onEditPlan: (plan: PurchasePlan) => void;
	onBuyPlan: (plan: PurchasePlan, item?: PurchasePlanItem) => void;
	onReviewCandidate: (candidate: ReviewCandidate) => void;
	onCapture: (mode?: CaptureMode) => void;
	onManual: () => void;
}) => {
	if (!hasAnyExpenses && plans.length === 0 && pendingCandidates.length === 0) {
		return <FirstExpenseEmpty onCapture={onCapture} onManual={onManual} />;
	}

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
	const monthPlanBounds = planPeriodBounds("month");
	const monthPlans = filterPurchasePlans(plans, {
		query: "",
		categoryID: 0,
		vendorID: 0,
		from: monthPlanBounds.from,
		to: monthPlanBounds.to,
	});
	const monthPlannedTotal = monthPlans.reduce(
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
						<button
							className="mini-total-plans"
							type="button"
							onClick={() => onPlans("month")}
							aria-label={uiText(language, "openMonthPlans")}
						>
							<ShoppingBagOpen size={17} />
							<span>{uiText(language, "plannedThisMonth")}</span>
							<b>{formatMoney(monthPlannedTotal, currency)}</b>
							<ArrowRight size={16} />
						</button>
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
								<h2>{uiText(language, "upcomingPlans")}</h2>
								<button type="button" onClick={() => onPlans()}>
									{uiText(language, "all")}
								</button>
							</div>
							<div className="mini-home-plan-list">
								{upcomingPlans.map((plan) => {
									const vendorName =
										plan.vendor_name ||
										vendors.find((vendor) => vendor.id === plan.vendor_id)
											?.name;
									const details = [
										plan.due_date
											? formatPlanDate(plan.due_date, language)
											: null,
										vendorName,
									].filter(Boolean);
									return (
										<div key={plan.id}>
											<button type="button" onClick={() => onEditPlan(plan)}>
												<span className="mini-home-plan-title">
													<b>{plan.title}</b>
													{plan.expected_amount != null && (
														<strong>
															{formatMoney(
																plan.expected_amount,
																plan.currency || currency,
															)}
														</strong>
													)}
												</span>
												{details.length > 0 && (
													<small>{details.join(" · ")}</small>
												)}
												{sharedRecordAuthor(
													members,
													plan.created_by_user_id,
												) && (
													<small className="mini-record-author">
														{uiText(language, "addedBy")}{" "}
														{sharedRecordAuthor(
															members,
															plan.created_by_user_id,
														)}
													</small>
												)}
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
									);
								})}
							</div>
						</section>
					)}
					<div className="mini-section-head">
						<h2>{uiText(language, "categoryOverview")}</h2>
						<button type="button" onClick={onManageBudgets}>
							{uiText(language, hasAnyBudgets ? "configure" : "addLimit")}
						</button>
					</div>
					<div className="mini-home-categories">
						{categories.map((category) => {
							const period = uiText(
								language,
								category.budget_period === "week" ? "forWeek" : "forMonth",
							);
							const status = `${uiText(language, "limit")} ${formatMoney(category.budget_amount || 0, currency)} · ${uiText(language, category.homeOverLimit ? "overLimitBy" : "remaining")} ${formatMoney(category.homeDifference, currency)} · ${period}`;
							return (
								<button
									className={category.homeOverLimit ? "is-over" : ""}
									key={category.id}
									type="button"
									onClick={() => onCategory(category.id, "month")}
								>
									<span>
										<span className="mini-home-category-title">
											<b>{localizedCategoryName(category, language)}</b>
											{category.pinned && <PushPin size={13} weight="fill" />}
										</span>
										<strong>
											{formatMoney(category.homeAmount, currency)}
										</strong>
									</span>
									{category.homeHasLimit ? (
										<>
											<small>{status}</small>
											<span
												className="mini-home-category-progress"
												role="progressbar"
												aria-label={status}
												aria-valuemin={0}
												aria-valuemax={100}
												aria-valuenow={Math.round(category.homeProgress)}
												tabIndex={0}
											>
												<i style={{ width: `${category.homeProgress}%` }} />
											</span>
										</>
									) : (
										<span className="mini-home-category-no-limit">
											<i />
											{uiText(language, "limitNotSet")}
										</span>
									)}
								</button>
							);
						})}
						{categories.length === 0 && (
							<Empty text="В этом месяце расходов пока нет" />
						)}
					</div>
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
						members={members}
						language={language}
						currency={currency}
						onEdit={onExpense}
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
	planInitialPeriod,
	language,
	categories,
	vendors,
	captures,
	members,
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
	onPlanSource,
	onOpenExpense,
	onOpenExpenseItem,
	onAdd,
	onSection,
	onAddPlan,
	onOpenPlan,
	onOpenPlanItem,
	onBuyPlan,
}: {
	items: ExpenseItemRow[];
	section: ExpenseSection;
	plans: PurchasePlan[];
	planInitialPeriod: Period;
	language: UILanguage;
	categories: Category[];
	vendors: Vendor[];
	captures: CapturePacket[];
	members: SpaceMember[];
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
	onPlanSource: (plan: PurchasePlan) => void;
	onOpenExpense: (expense: Expense) => void;
	onOpenExpenseItem: (item: ExpenseItemRow) => void;
	onAdd: () => void;
	onSection: (section: ExpenseSection) => void;
	onAddPlan: () => void;
	onOpenPlan: (plan: PurchasePlan) => void;
	onOpenPlanItem: (plan: PurchasePlan, itemIndex: number) => void;
	onBuyPlan: (plan: PurchasePlan, item?: PurchasePlanItem) => void;
}) => {
	const [filtersOpen, setFiltersOpen] = useState(false);
	const [filterContextVisible, setFilterContextVisible] = useState(false);
	const filtersRef = useRef<HTMLDivElement>(null);
	const activeCategory = categories.find(({ id }) => id === categoryID);
	const activeVendor = vendors.find(({ id }) => id === vendorID);
	const activeFilterCount =
		Number(Boolean(activeCategory)) + Number(Boolean(activeVendor));
	const formatRangeDate = (value: string) =>
		new Intl.DateTimeFormat(language, {
			day: "numeric",
			month: "short",
		}).format(new Date(`${value}T12:00:00`));
	const periodSummary =
		period === "custom"
			? dateFrom && dateTo
				? `${formatRangeDate(dateFrom)} — ${formatRangeDate(dateTo)}`
				: dateFrom
					? `${uiText(language, "dateFrom")} ${formatRangeDate(dateFrom)}`
					: dateTo
						? `${uiText(language, "dateTo")} ${formatRangeDate(dateTo)}`
						: uiText(language, "periodCustom")
			: period === "today"
				? uiText(language, "periodToday")
				: period === "three-days"
					? uiText(language, "periodThreeDays")
					: period === "week"
						? uiText(language, "periodWeek")
						: period === "month"
							? uiText(language, "periodMonth")
							: period === "three-months"
								? uiText(language, "periodThreeMonths")
								: period === "six-months"
									? uiText(language, "periodSixMonths")
									: period === "year"
										? uiText(language, "periodYear")
										: uiText(language, "periodAll");
	const filterContext = [
		periodSummary,
		expense?.title || expense?.items[0]?.name,
		activeCategory
			? localizedCategoryName(activeCategory, language)
			: undefined,
		activeVendor?.name,
		query.trim() ? `«${query.trim()}»` : undefined,
		groupByExpense ? uiText(language, "groupByExpense") : undefined,
	]
		.filter(Boolean)
		.join(" · ");

	useEffect(() => {
		if (section !== "history" || !filtersRef.current) return;
		const filters = filtersRef.current;
		const headerHeight =
			document.querySelector<HTMLElement>(".mini-header")?.offsetHeight ?? 58;
		const observer = new IntersectionObserver(
			([entry]) => {
				setFilterContextVisible(
					!entry.isIntersecting &&
						entry.boundingClientRect.bottom <= headerHeight,
				);
			},
			{
				rootMargin: `-${headerHeight}px 0px 0px`,
				threshold: 0,
			},
		);
		observer.observe(filters);
		return () => observer.disconnect();
	}, [section]);

	const openFilters = () => {
		setFiltersOpen(true);
		window.requestAnimationFrame(() => {
			filtersRef.current?.scrollIntoView({
				behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
					? "auto"
					: "smooth",
				block: "start",
			});
		});
	};
	const changeSection = (nextSection: ExpenseSection) => {
		setFilterContextVisible(false);
		onSection(nextSection);
	};
	const addLabel = uiText(
		language,
		section === "history" ? "addExpense" : "addPlan",
	);

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
					aria-label={addLabel}
					onClick={() => (section === "history" ? onAdd() : onAddPlan())}
				>
					<Plus size={18} weight="bold" />
					{addLabel}
				</button>
			</div>
			<div className="mini-expense-sections" role="tablist">
				<button
					className={section === "history" ? "active" : ""}
					type="button"
					role="tab"
					aria-selected={section === "history"}
					onClick={() => changeSection("history")}
				>
					{uiText(language, "history")}
				</button>
				<button
					className={section === "plans" ? "active" : ""}
					type="button"
					role="tab"
					aria-selected={section === "plans"}
					onClick={() => changeSection("plans")}
				>
					{uiText(language, "plans")}
					{plans.length > 0 && <b>{plans.length}</b>}
				</button>
			</div>
			{section === "plans" ? (
				<PlansView
					plans={plans}
					initialPeriod={planInitialPeriod}
					categories={categories}
					vendors={vendors}
					captures={captures}
					members={members}
					currency={currency}
					language={language}
					onAdd={onAddPlan}
					onOpenPlan={onOpenPlan}
					onOpenPlanItem={onOpenPlanItem}
					onBuy={onBuyPlan}
					onSource={onPlanSource}
				/>
			) : (
				<>
					<div
						className={`mini-filter-context-anchor${filterContextVisible ? " is-visible" : ""}`}
					>
						<button
							className="mini-filter-context"
							type="button"
							aria-hidden={!filterContextVisible}
							tabIndex={filterContextVisible ? 0 : -1}
							onClick={openFilters}
						>
							<span className="mini-filter-context-icon">
								<FunnelSimple size={17} weight="fill" />
							</span>
							<span className="mini-filter-context-copy">
								<small>{uiText(language, "filterContextLabel")}</small>
								<b>{filterContext}</b>
							</span>
							<span className="mini-filter-context-action">
								{uiText(language, "configure")}
							</span>
						</button>
					</div>
					<div className="mini-expense-filter-stack" ref={filtersRef}>
						<label className="mini-search">
							<MagnifyingGlass size={19} />
							<input
								value={query}
								onChange={(event) => onQuery(event.target.value)}
								placeholder={uiText(language, "expenseSearchPlaceholder")}
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
												(itemAmountInCurrency(
													row.item,
													row.expense,
													currency,
												) ?? 0),
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
								<option value="custom">
									{uiText(language, "periodCustom")}
								</option>
							</select>
							<button
								type="button"
								aria-expanded={filtersOpen}
								aria-controls="expense-filters"
								onClick={() => setFiltersOpen((open) => !open)}
							>
								<FunnelSimple size={17} />
								{uiText(language, "filters")}
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
										{uiText(language, "groupByExpense")}
									</button>
								</div>
							</div>
						)}
					</div>
					{groupByExpense ? (
						<GroupedExpenseItemList
							items={items}
							categories={categories}
							captures={captures}
							members={members}
							language={language}
							currency={currency}
							onSource={onSource}
							onOpenExpense={onOpenExpense}
							onOpenItem={onOpenExpenseItem}
						/>
					) : (
						<ExpenseItemList
							items={items}
							categories={categories}
							captures={captures}
							members={members}
							language={language}
							currency={currency}
							onOpen={onOpenExpenseItem}
						/>
					)}
				</>
			)}
		</section>
	);
};

const PlansView = ({
	plans,
	initialPeriod,
	categories,
	vendors,
	captures,
	members,
	currency,
	language,
	onAdd,
	onOpenPlan,
	onOpenPlanItem,
	onBuy,
	onSource,
}: {
	plans: PurchasePlan[];
	initialPeriod: Period;
	categories: Category[];
	vendors: Vendor[];
	captures: CapturePacket[];
	members: SpaceMember[];
	currency: string;
	language: UILanguage;
	onAdd: () => void;
	onOpenPlan: (plan: PurchasePlan) => void;
	onOpenPlanItem: (plan: PurchasePlan, itemIndex: number) => void;
	onBuy: (plan: PurchasePlan, item?: PurchasePlanItem) => void;
	onSource: (plan: PurchasePlan) => void;
}) => {
	const [query, setQuery] = useState("");
	const [period, setPeriod] = useState<Period>(initialPeriod);
	const [dateFrom, setDateFrom] = useState("");
	const [dateTo, setDateTo] = useState("");
	const [categoryID, setCategoryID] = useState(0);
	const [vendorID, setVendorID] = useState(0);
	const [filtersOpen, setFiltersOpen] = useState(false);
	const [groupByPlan, setGroupByPlan] = useState(false);
	const bounds = planPeriodBounds(period, dateFrom, dateTo);
	const filteredPlans = filterPurchasePlans(plans, {
		query,
		categoryID,
		vendorID,
		from: bounds.from,
		to: bounds.to,
	});
	const dated = filteredPlans.filter((plan) => plan.due_date);
	const withoutDate = filteredPlans.filter((plan) => !plan.due_date);
	const visibleItems = filteredPlans.flatMap((plan) =>
		purchasePlanItems(plan).map((item, index) => ({ plan, item, index })),
	);
	const activeFilterCount =
		Number(Boolean(categoryID)) + Number(Boolean(vendorID));
	const visibleTotal = visibleItems.reduce(
		(sum, row) => sum + (row.item.expected_amount || 0),
		0,
	);
	const sourceButton = (plan: PurchasePlan) =>
		plan.source_document_id ? (
			<button
				className="mini-plan-icon mini-plan-source"
				type="button"
				aria-label="Открыть исходный материал"
				onClick={() => onSource(plan)}
			>
				<SourceIcon capture={captureForPlan(plan, captures)} size={20} />
			</button>
		) : (
			<span className="mini-plan-icon">
				<ShoppingBagOpen size={20} />
			</span>
		);
	const categoryLabel = (categoryIDs: Array<number | null | undefined>) => {
		const names = categoryIDs
			.map((id) => categories.find((category) => category.id === id))
			.filter((category): category is Category => Boolean(category))
			.map((category) => localizedCategoryName(category, language));
		return [...new Set(names)].join(", ") || uiText(language, "categoryNotSet");
	};
	const authorLine = (plan: PurchasePlan) =>
		sharedRecordAuthor(members, plan.created_by_user_id);
	const renderPlan = (plan: PurchasePlan) => {
		const planItems = purchasePlanItems(plan);
		const vendorName =
			plan.vendor_name ||
			vendors.find((item) => item.id === plan.vendor_id)?.name;
		return (
			<div className="mini-plan-row" key={plan.id}>
				{sourceButton(plan)}
				<button
					className="mini-plan-copy"
					type="button"
					onClick={() => onOpenPlan(plan)}
				>
					<b>{plan.title}</b>
					{planItems.length > 1 && (
						<small>{planItems.map((item) => item.name).join(", ")}</small>
					)}
					<small>
						{categoryLabel(planItems.map((item) => item.category_id))}
						{vendorName ? ` · ${vendorName}` : ""}
						{plan.due_date
							? ` · ${formatPlanDate(plan.due_date, language)}`
							: ""}
					</small>
					{authorLine(plan) && (
						<small className="mini-record-author">
							{uiText(language, "addedBy")} {authorLine(plan)}
						</small>
					)}
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
	const renderPlanItem = ({
		plan,
		item,
		index,
	}: {
		plan: PurchasePlan;
		item: PurchasePlanItem;
		index: number;
	}) => {
		const vendorName =
			plan.vendor_name ||
			vendors.find((vendor) => vendor.id === plan.vendor_id)?.name;
		return (
			<div className="mini-plan-row" key={`${plan.id}-${item.id || index}`}>
				{sourceButton(plan)}
				<button
					className="mini-plan-copy"
					type="button"
					onClick={() => onOpenPlanItem(plan, index)}
				>
					<b>{item.name}</b>
					<small>{plan.title}</small>
					<small>
						{categoryLabel([item.category_id])}
						{vendorName ? ` · ${vendorName}` : ""}
						{plan.due_date
							? ` · ${formatPlanDate(plan.due_date, language)}`
							: ""}
					</small>
					{authorLine(plan) && (
						<small className="mini-record-author">
							{uiText(language, "addedBy")} {authorLine(plan)}
						</small>
					)}
				</button>
				<div className="mini-plan-actions">
					{item.expected_amount ? (
						<strong>{formatMoney(item.expected_amount, plan.currency)}</strong>
					) : (
						<small>{uiText(language, "amountNotSet")}</small>
					)}
					<button type="button" onClick={() => onBuy(plan, item)}>
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
		<div className="mini-plan-workspace">
			<div className="mini-expense-filter-stack">
				<label className="mini-search">
					<MagnifyingGlass size={19} />
					<input
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder={uiText(language, "planSearchPlaceholder")}
					/>
				</label>
				<div className="mini-result">
					<div>
						<small>{uiText(language, "found")}</small>
						<span>
							{groupByPlan ? filteredPlans.length : visibleItems.length} ·{" "}
							{uiText(
								language,
								groupByPlan ? "planListsView" : "planItemsView",
							)}
						</span>
					</div>
					<div>
						<small>{uiText(language, "plannedTotalShort")}</small>
						<strong>{formatMoney(visibleTotal, currency)}</strong>
					</div>
				</div>
				<div className="mini-filter-bar">
					<select
						aria-label={uiText(language, "periodLabel")}
						value={period}
						onChange={(event) => setPeriod(event.target.value as Period)}
					>
						<option value="today">{uiText(language, "periodToday")}</option>
						<option value="three-days">
							{uiText(language, "planPeriodThreeDays")}
						</option>
						<option value="week">{uiText(language, "planPeriodWeek")}</option>
						<option value="month">{uiText(language, "periodMonth")}</option>
						<option value="three-months">
							{uiText(language, "planPeriodThreeMonths")}
						</option>
						<option value="six-months">
							{uiText(language, "planPeriodSixMonths")}
						</option>
						<option value="year">{uiText(language, "periodYear")}</option>
						<option value="all">{uiText(language, "periodAll")}</option>
						<option value="custom">{uiText(language, "periodCustom")}</option>
					</select>
					<button
						type="button"
						aria-expanded={filtersOpen}
						onClick={() => setFiltersOpen((open) => !open)}
					>
						<FunnelSimple size={17} />
						{uiText(language, "filters")}
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
								onChange={(event) => setDateFrom(event.target.value)}
							/>
						</label>
						<label>
							<span>{uiText(language, "dateTo")}</span>
							<input
								type="date"
								min={dateFrom || undefined}
								value={dateTo}
								onChange={(event) => setDateTo(event.target.value)}
							/>
						</label>
					</div>
				)}
				{(categoryID || vendorID) > 0 && (
					<div className="mini-filter-chips" aria-label="Активные фильтры">
						{categoryID > 0 && (
							<button type="button" onClick={() => setCategoryID(0)}>
								{categoryLabel([categoryID])}
								<X size={13} />
							</button>
						)}
						{vendorID > 0 && (
							<button type="button" onClick={() => setVendorID(0)}>
								{vendors.find((vendor) => vendor.id === vendorID)?.name}
								<X size={13} />
							</button>
						)}
					</div>
				)}
				{filtersOpen && (
					<div className="mini-filter-panel">
						<div className="mini-filters">
							<select
								aria-label={uiText(language, "category")}
								value={categoryID}
								onChange={(event) => setCategoryID(Number(event.target.value))}
							>
								<option value={0}>{uiText(language, "allCategories")}</option>
								{categories.map((category) => (
									<option key={category.id} value={category.id}>
										{localizedCategoryName(category, language)}
									</option>
								))}
							</select>
							<select
								aria-label={uiText(language, "planVendor")}
								value={vendorID}
								onChange={(event) => setVendorID(Number(event.target.value))}
							>
								<option value={0}>{uiText(language, "allVendors")}</option>
								{vendors.map((vendor) => (
									<option key={vendor.id} value={vendor.id}>
										{vendor.name}
									</option>
								))}
							</select>
						</div>
						<div className="mini-expense-mode" role="group">
							<button
								className={!groupByPlan ? "active" : ""}
								type="button"
								aria-pressed={!groupByPlan}
								onClick={() => setGroupByPlan(false)}
							>
								{uiText(language, "planItemsView")}
							</button>
							<button
								className={groupByPlan ? "active" : ""}
								type="button"
								aria-pressed={groupByPlan}
								onClick={() => setGroupByPlan(true)}
							>
								{uiText(language, "planListsView")}
							</button>
						</div>
					</div>
				)}
			</div>
			{groupByPlan ? (
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
							<div className="mini-plan-list">
								{withoutDate.map(renderPlan)}
							</div>
						</section>
					)}
				</div>
			) : visibleItems.length > 0 ? (
				<div className="mini-plan-list">{visibleItems.map(renderPlanItem)}</div>
			) : null}
			{filteredPlans.length === 0 && (
				<Empty text={uiText(language, "nothingFound")} />
			)}
		</div>
	);
};

const ExpenseItemList = ({
	items,
	categories,
	captures,
	members,
	language,
	currency,
	onOpen,
	showAuthors = true,
}: {
	items: ExpenseItemRow[];
	categories: Category[];
	captures: CapturePacket[];
	members: SpaceMember[];
	language: UILanguage;
	currency: string;
	onOpen: (item: ExpenseItemRow) => void;
	showAuthors?: boolean;
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
			const author = showAuthors
				? sharedRecordAuthor(members, row.expense.user_id)
				: "";
			return (
				<button
					key={`${row.expense.id}-${row.item.id || row.itemIndex}`}
					type="button"
					onClick={() => onOpen(row)}
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
						{author && (
							<small className="mini-record-author">
								{uiText(language, "addedBy")} {author}
							</small>
						)}
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
	members,
	language,
	currency,
	onSource,
	onOpenExpense,
	onOpenItem,
}: {
	items: ExpenseItemRow[];
	categories: Category[];
	captures: CapturePacket[];
	members: SpaceMember[];
	language: UILanguage;
	currency: string;
	onSource: (expense: Expense) => void;
	onOpenExpense: (expense: Expense) => void;
	onOpenItem: (item: ExpenseItemRow) => void;
}) => {
	const groups = groupRowsByExpense(items);
	return (
		<div className="mini-expense-groups">
			{groups.map((rows) => {
				const expense = rows[0].expense;
				const author = sharedRecordAuthor(members, expense.user_id);
				const total = rows.reduce(
					(sum, row) =>
						sum + (itemAmountInCurrency(row.item, row.expense, currency) ?? 0),
					0,
				);
				return (
					<section key={expense.id}>
						<header>
							<button
								className="mini-expense-group-copy"
								type="button"
								onClick={() => onOpenExpense(expense)}
							>
								<b>{expense.title || rows[0].item.name || "Расход"}</b>
								<small>
									{formatDate(expense.expense_date)} · {rows.length}{" "}
									{itemWord(rows.length)}
								</small>
								{author && (
									<small className="mini-record-author">
										{uiText(language, "addedBy")} {author}
									</small>
								)}
							</button>
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
							members={members}
							language={language}
							currency={currency}
							onOpen={onOpenItem}
							showAuthors={false}
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
	members,
	language,
	currency,
	onEdit,
}: {
	expenses: Expense[];
	captures: CapturePacket[];
	members: SpaceMember[];
	language: UILanguage;
	currency: string;
	onEdit: (expense: Expense) => void;
}) => (
	<div className="mini-expenses">
		{expenses.map((expense) => {
			const money = expenseDisplayMoney(expense, currency);
			const seller = expenseSellerName(expense);
			const capture = captureForExpense(expense, captures);
			const author = sharedRecordAuthor(members, expense.user_id);
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
						{author && (
							<small className="mini-record-author">
								{uiText(language, "addedBy")} {author}
							</small>
						)}
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
	language,
	onClose,
}: {
	viewer: SourceViewer;
	language: UILanguage;
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
					<SourceExpiryNote capture={viewer.capture} language={language} />
				</div>
			</div>
			{kind === "image" && viewer.media.length > 0 && (
				<div
					className={`mini-source-gallery${viewer.media.length === 1 ? " single" : ""}`}
				>
					{viewer.media.map((media, index) => (
						<figure key={media.id}>
							<img
								className="mini-source-image"
								src={media.url}
								alt={`Исходное изображение ${index + 1} из ${viewer.media.length}`}
							/>
							{viewer.media.length > 1 && (
								<figcaption>
									{index + 1} / {viewer.media.length}
								</figcaption>
							)}
						</figure>
					))}
				</div>
			)}
			{kind === "voice" && viewer.media[0]?.url && (
				<>
					{/* biome-ignore lint/a11y/useMediaCaption: transcript is rendered below when the provider returned one. */}
					<audio
						className="mini-source-audio"
						controls
						src={viewer.media[0].url}
					/>
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
			{viewer.media.length === 0 && !viewer.capture.source_text && (
				<Empty text="Исходный материал недоступен" />
			)}
		</Modal>
	);
};

const SourceExpiryNote = ({
	capture,
	language,
}: {
	capture?: CapturePacket;
	language: UILanguage;
}) => {
	if (!capture?.media_expires_at || captureSourceKind(capture) === "text")
		return null;
	return (
		<small className="mini-source-expiry">
			Исходник удалится {formatMediaExpiry(capture.media_expires_at, language)}
		</small>
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
	shared,
	onOpen,
	onEdit,
	onPin,
	onAdd,
}: {
	categories: Category[];
	currency: string;
	language: UILanguage;
	shared: boolean;
	onOpen: (id: number) => void;
	onEdit: (category: Category) => void;
	onPin: (category: Category) => void;
	onAdd: () => void;
}) => {
	const orderedCategories = [...categories].sort(
		(left, right) =>
			Number(Boolean(right.pinned)) - Number(Boolean(left.pinned)) ||
			(right.month_spent ?? right.total) - (left.month_spent ?? left.total),
	);
	return (
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
				{orderedCategories.map((category) => {
					const hasLimit = (category.budget_amount || 0) > 0;
					const budgetSpent = category.budget_spent || 0;
					const monthSpent =
						category.month_spent ??
						(category.budget_period === "month" ? budgetSpent : category.total);
					const overLimit =
						hasLimit && budgetSpent > (category.budget_amount || 0);
					const difference = Math.abs(
						(category.budget_amount || 0) - budgetSpent,
					);
					const limitPeriodKey =
						category.budget_period === "week" ? "forWeek" : "forMonth";
					const attribution = category.is_system
						? uiText(language, "systemCategory")
						: shared && category.created_by_name
							? `${uiText(language, "userCategory")} · ${category.created_by_name}`
							: uiText(language, "userCategory");
					return (
						<article
							className={`${category.pinned ? "is-pinned " : ""}${overLimit ? "is-over" : ""}`.trim()}
							key={category.id}
						>
							<button
								className="mini-category-open"
								type="button"
								onClick={() => onOpen(category.id)}
							>
								<span className="mini-category-dot" />
								<span className="mini-category-content">
									<b>{localizedCategoryName(category, language)}</b>
									<small className="mini-category-attribution">
										{attribution}
									</small>
									<span className="mini-category-metrics">
										<span>
											<small>{uiText(language, "spentForMonth")}</small>
											<strong>{formatMoney(monthSpent, currency)}</strong>
										</span>
										<span>
											<small>{uiText(language, "spentTotal")}</small>
											<strong>{formatMoney(category.total, currency)}</strong>
										</span>
									</span>
									{hasLimit ? (
										<span className="mini-category-limit">
											<span className="mini-category-limit-head">
												<small>
													{uiText(language, "limit")}{" "}
													{uiText(language, limitPeriodKey)}
												</small>
												<strong>
													{formatMoney(category.budget_amount || 0, currency)}
												</strong>
											</span>
											<small className="mini-category-limit-copy">
												{uiText(
													language,
													overLimit ? "overLimitBy" : "remaining",
												)}{" "}
												{formatMoney(difference, currency)}
											</small>
											<span className="mini-category-budget">
												<i
													style={{
														width: `${Math.min(
															100,
															category.budget_percent || 0,
														)}%`,
													}}
												/>
											</span>
										</span>
									) : (
										<span className="mini-category-no-limit">
											<i />
											{uiText(language, "limitNotSet")}
										</span>
									)}
								</span>
							</button>
							<div className="mini-category-actions">
								<button
									className={`mini-icon-button mini-category-pin${category.pinned ? " is-active" : ""}`}
									type="button"
									aria-label={uiText(
										language,
										category.pinned ? "unpinCategory" : "pinCategory",
									)}
									title={uiText(
										language,
										category.pinned ? "unpinCategory" : "pinCategory",
									)}
									onClick={() => onPin(category)}
								>
									<PushPin
										size={17}
										weight={category.pinned ? "fill" : "regular"}
									/>
								</button>
								{category.can_edit !== false && (
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
								)}
							</div>
						</article>
					);
				})}
			</div>
		</section>
	);
};

const VendorsView = ({
	vendors,
	language,
	onBack,
	onEdit,
	onAdd,
}: {
	vendors: Vendor[];
	language: UILanguage;
	onBack: () => void;
	onEdit: (vendor: Vendor) => void;
	onAdd: () => void;
}) => (
	<section className="mini-view mini-vendors-view">
		<button className="mini-back-link" type="button" onClick={onBack}>
			<ArrowLeft size={18} />
			{uiText(language, "settings")}
		</button>
		<div className="mini-title-row">
			<div className="mini-title">
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
	language,
	activeSpaceID,
	members,
	canManageMembers,
	onSelect,
	onBack,
	onEdit,
	onRemoveMember,
	onInvite,
	inviting,
	saving,
	onAdd,
}: {
	spaces: Space[];
	language: UILanguage;
	activeSpaceID: number;
	members: SpaceMember[];
	canManageMembers: boolean;
	onSelect: (id: number) => void;
	onBack: () => void;
	onEdit: (space: Space) => void;
	onRemoveMember: (member: SpaceMember) => void;
	onInvite?: (space: Space) => void;
	inviting: boolean;
	saving: boolean;
	onAdd: () => void;
}) => {
	const activeSpace = spaces.find((space) => space.id === activeSpaceID);
	return (
		<section className="mini-view mini-spaces-view">
			<button className="mini-back-link" type="button" onClick={onBack}>
				<ArrowLeft size={18} />
				{uiText(language, "settings")}
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
				{members.map((member) => {
					const canRemove =
						canManageMembers && activeSpace?.owner_user_id !== member.user_id;
					return (
						<div key={member.user_id}>
							<span>{(member.name || "У").slice(0, 1).toUpperCase()}</span>
							<p>
								<b>{member.name || "Пользователь"}</b>
								<small>{memberRole(member.role)}</small>
							</p>
							{canRemove && (
								<button
									className="mini-icon-button mini-member-remove"
									type="button"
									disabled={saving}
									aria-label={`Удалить ${member.name || "участника"}`}
									onClick={() => onRemoveMember(member)}
								>
									<Trash size={18} />
								</button>
							)}
						</div>
					);
				})}
			</div>
		</section>
	);
};

const SubscriptionView = ({
	language,
	quota,
	billingLoading,
	onBack,
	onStartPlus,
	onBuyPack,
}: {
	language: UILanguage;
	quota: Quota | null;
	billingLoading: boolean;
	onBack: () => void;
	onStartPlus: () => void;
	onBuyPack: () => void;
}) => {
	const plus = ["medium", "plus"].includes(quota?.plan || "");
	const recurringLimit = quota?.recurring_limit || 0;
	const recurringUsed = quota?.recurring_used || 0;
	const allowanceLimit = plus ? recurringLimit : quota?.limit || 20;
	const allowanceUsed = plus ? recurringUsed : quota?.used || 0;
	const progress =
		allowanceLimit > 0
			? Math.min(100, (allowanceUsed / allowanceLimit) * 100)
			: 0;
	const copy =
		language === "ru"
			? {
					eyebrow: "Тариф и быстрые разборы",
					title: "Подписка",
					current: "Сейчас у вас",
					available: "разборов доступно",
					included: "Включено в тариф",
					welcome: "Приветственный набор",
					purchased: "Куплено дополнительно",
					total: "Доступно всего",
					expires: "Следующее продление",
					plusTitle: "Зачем нужен Плюс",
					basicNote: "Для спокойного ручного учёта и знакомства с разборами.",
					plusNote:
						"Для регулярного использования, планов и общих пространств.",
					basicBenefits: [
						"Ручные расходы и история без ограничений",
						"20 приветственных разборов один раз",
						"10 активных планов и 3 лимита категорий",
						"2 своих пространства, включая Личное",
						"Исходные фото и голос хранятся 3 дня",
					],
					plusBenefits: [
						"400 разборов каждые 30 дней",
						"До 100 планов, лимитов и своих категорий",
						"До 10 своих пространств",
						"Исходные фото и голос хранятся 30 дней",
						"Скидки на дополнительные пакеты",
					],
					exampleTitle: "400 разборов — это примерно",
					text: "400 текстов",
					voice: "200 голосовых",
					photo: "133 фото чеков",
					modes:
						"Текст, голос, чеки и оценка предмета доступны на обоих тарифах. Плюс даёт больше разборов и возможностей организации.",
					packsTitle: "Дополнительные пакеты",
					packsBody:
						"Нужны, если разборы закончились раньше. Пакет добавляет баланс, но не меняет тариф и остаётся после окончания Плюса.",
					packsPrice: plus
						? "Для Плюса: 100 от 79 ₽"
						: "Для Базового: 100 от 99 ₽",
					ratesTitle: "Как списываются разборы",
					ratesHint: "Только после успешного результата",
					retryNote:
						"Технические повторы бесплатны. Оценка отдельного предмета стоит 10 разборов.",
				}
			: language === "es"
				? {
						eyebrow: "Plan y registros rápidos",
						title: "Suscripción",
						current: "Tu plan actual",
						available: "registros disponibles",
						included: "Incluido en el plan",
						welcome: "Paquete de bienvenida",
						purchased: "Comprado adicionalmente",
						total: "Total disponible",
						expires: "Próxima renovación",
						plusTitle: "Por qué elegir Plus",
						basicNote: "Para el control manual y probar los registros rápidos.",
						plusNote: "Para uso frecuente, planes y espacios compartidos.",
						basicBenefits: [
							"Gastos manuales e historial sin límites",
							"20 registros de bienvenida una sola vez",
							"10 planes activos y 3 límites de categoría",
							"2 espacios propios, incluido Personal",
							"Fotos y audio originales durante 3 días",
						],
						plusBenefits: [
							"400 registros cada 30 días",
							"Hasta 100 planes, límites y categorías propias",
							"Hasta 10 espacios propios",
							"Fotos y audio originales durante 30 días",
							"Descuentos en paquetes adicionales",
						],
						exampleTitle: "400 registros equivalen aproximadamente a",
						text: "400 textos",
						voice: "200 audios",
						photo: "133 fotos",
						modes:
							"Texto, voz, recibos y valoración de objetos están disponibles en ambos planes. Plus ofrece más capacidad y organización.",
						packsTitle: "Paquetes adicionales",
						packsBody:
							"Úsalos si se agota el saldo. Añaden registros, no cambian el plan y permanecen después de Plus.",
						packsPrice: plus
							? "Con Plus: 100 desde 79 ₽"
							: "Básico: 100 desde 99 ₽",
						ratesTitle: "Cómo se descuentan",
						ratesHint: "Solo tras un resultado correcto",
						retryNote:
							"Los reintentos técnicos son gratuitos. Valorar un objeto cuesta 10 registros.",
					}
				: {
						eyebrow: "Plan and quick additions",
						title: "Subscription",
						current: "Your current plan",
						available: "additions available",
						included: "Included in plan",
						welcome: "Welcome allowance",
						purchased: "Purchased allowance",
						total: "Total available",
						expires: "Next renewal",
						plusTitle: "Why choose Plus",
						basicNote: "For manual tracking and trying quick additions.",
						plusNote: "For regular use, planning, and shared spaces.",
						basicBenefits: [
							"Unlimited manual expenses and history",
							"20 welcome additions once",
							"10 active plans and 3 category budgets",
							"2 owned spaces, including Personal",
							"Original photos and voice stored for 3 days",
						],
						plusBenefits: [
							"400 additions every 30 days",
							"Up to 100 plans, budgets, and custom categories",
							"Up to 10 owned spaces",
							"Original photos and voice stored for 30 days",
							"Discounts on additional packs",
						],
						exampleTitle: "400 additions is roughly",
						text: "400 texts",
						voice: "200 voice notes",
						photo: "133 receipt photos",
						modes:
							"Text, voice, receipts, and item valuation are available on both plans. Plus adds more allowance and organization.",
						packsTitle: "Additional packs",
						packsBody:
							"Use a pack if your allowance runs out. It adds balance, does not change your plan, and remains after Plus ends.",
						packsPrice: plus
							? "With Plus: 100 from 79 ₽"
							: "Basic: 100 from 99 ₽",
						ratesTitle: "How additions are charged",
						ratesHint: "Only after a successful result",
						retryNote:
							"Technical retries are free. Valuing a standalone item costs 10 additions.",
					};
	const parseRates = [
		{
			icon: <ChatCircleText size={19} />,
			label: language === "ru" ? "Текст" : language === "es" ? "Texto" : "Text",
			units: 1,
		},
		{
			icon: <Microphone size={19} />,
			label: language === "ru" ? "Голос" : language === "es" ? "Voz" : "Voice",
			units: 2,
		},
		{
			icon: <Camera size={19} />,
			label: language === "ru" ? "Фото" : language === "es" ? "Foto" : "Photo",
			units: 3,
		},
		{
			icon: <Receipt size={19} />,
			label:
				language === "ru"
					? "Большой чек"
					: language === "es"
						? "Recibo grande"
						: "Large receipt",
			units: 5,
		},
		{
			icon: <MagnifyingGlass size={19} />,
			label:
				language === "ru"
					? "Оценка предмета"
					: language === "es"
						? "Valoración de objeto"
						: "Item valuation",
			units: 10,
		},
	];

	return (
		<section className="mini-view mini-subscription-view">
			<button className="mini-back-link" type="button" onClick={onBack}>
				<ArrowLeft size={18} />
				{uiText(language, "settings")}
			</button>
			<div className="mini-title">
				<p>{copy.eyebrow}</p>
				<h1>{copy.title}</h1>
			</div>

			<section className={`subscription-current${plus ? " is-plus" : ""}`}>
				<header>
					<div>
						<span>{copy.current}</span>
						<h2>{uiText(language, plus ? "plus" : "basic")}</h2>
					</div>
					<b>{plus ? "249 ₽ / 30 дней" : "0 ₽"}</b>
				</header>
				<div className="subscription-balance">
					<strong>{quota?.remaining ?? 0}</strong>
					<span>{copy.available}</span>
				</div>
				<div className="mini-progress">
					<i style={{ width: `${progress}%` }} />
				</div>
				<div className="mini-allowance-breakdown">
					<p>
						<span>{plus ? copy.included : copy.welcome}</span>
						<b>
							{plus
								? quota?.recurring_remaining || 0
								: quota?.welcome_remaining || 0}
						</b>
					</p>
					<p>
						<span>{copy.purchased}</span>
						<b>{quota?.additional_limit || 0}</b>
					</p>
					<p className="is-total">
						<span>{copy.total}</span>
						<b>{quota?.remaining ?? 0}</b>
					</p>
				</div>
				{quota?.plan_expires_at && (
					<small className="mini-plan-expiry">
						{copy.expires}: {formatDateTime(quota.plan_expires_at, language)}
					</small>
				)}
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
			</section>

			<section className="subscription-compare">
				<div className="mini-section-head">
					<h2>{copy.plusTitle}</h2>
				</div>
				<div className="subscription-tiers">
					<article>
						<header>
							<h3>{uiText(language, "basic")}</h3>
							<b>0 ₽</b>
						</header>
						<p>{copy.basicNote}</p>
						<ul>
							{copy.basicBenefits.map((benefit) => (
								<li key={benefit}>
									<Check size={16} weight="bold" />
									{benefit}
								</li>
							))}
						</ul>
					</article>
					<article className="is-plus">
						<header>
							<h3>{uiText(language, "plus")}</h3>
							<b>249 ₽</b>
						</header>
						<p>{copy.plusNote}</p>
						<ul>
							{copy.plusBenefits.map((benefit) => (
								<li key={benefit}>
									<Check size={16} weight="bold" />
									{benefit}
								</li>
							))}
						</ul>
						<div>
							<strong>{copy.exampleTitle}</strong>
							<span className="subscription-examples">
								<small>{copy.text}</small>
								<small>{copy.voice}</small>
								<small>{copy.photo}</small>
							</span>
						</div>
					</article>
				</div>
				<p className="subscription-modes-note">{copy.modes}</p>
			</section>

			<section className="subscription-packs">
				<ShoppingBagOpen size={24} weight="fill" />
				<div>
					<h2>{copy.packsTitle}</h2>
					<p>{copy.packsBody}</p>
					<strong>{copy.packsPrice}</strong>
				</div>
				<button type="button" onClick={onBuyPack}>
					{uiText(language, "buyPack")}
				</button>
			</section>

			<details className="mini-plan-rates">
				<summary>
					<span>
						<b>{copy.ratesTitle}</b>
						<small>{copy.ratesHint}</small>
					</span>
					<CaretDown size={18} weight="bold" />
				</summary>
				<div className="mini-plan-rate-list">
					{parseRates.map((rate) => (
						<div key={rate.label}>
							<i>{rate.icon}</i>
							<span>
								<b>{rate.label}</b>
							</span>
							<strong>{rate.units}</strong>
						</div>
					))}
				</div>
				<p>{copy.retryNote}</p>
			</details>
		</section>
	);
};

const ProfileView = ({
	user,
	avatarURL,
	avatarSaving,
	language,
	quota,
	developerDashboard,
	developerDashboardLoading,
	developerFeedback,
	developerFeedbackLoading,
	selectedFeedbackID,
	vendorsCount,
	spacesCount,
	homeScreenStatus,
	onEdit,
	onManageNotifications,
	onManageVendors,
	onManageSpaces,
	onLinkEmail,
	onLinkTelegram,
	onAvatarUpload,
	onAvatarRemove,
	onInstall,
	onDevUpdate,
	onRefreshDeveloperDashboard,
	onRefreshDeveloperFeedback,
	onOpenFeedbackMedia,
	feedbackMediaLoading,
	billingLoading,
}: {
	user: User | null;
	avatarURL: string;
	avatarSaving: boolean;
	language: UILanguage;
	quota: Quota | null;
	developerDashboard: DeveloperDashboard | null;
	developerDashboardLoading: boolean;
	developerFeedback: DeveloperFeedback[];
	developerFeedbackLoading: boolean;
	selectedFeedbackID: number;
	vendorsCount: number;
	spacesCount: number;
	homeScreenStatus: HomeScreenStatus;
	onEdit: () => void;
	onManageNotifications: () => void;
	onManageVendors: () => void;
	onManageSpaces: () => void;
	onLinkEmail: () => void;
	onLinkTelegram: () => void;
	onAvatarUpload: (file: File) => void;
	onAvatarRemove: () => void;
	onInstall: () => void;
	onDevUpdate: (patch: DeveloperQuotaPatch) => void;
	onRefreshDeveloperDashboard: () => void;
	onRefreshDeveloperFeedback: () => void;
	onOpenFeedbackMedia: (
		feedback: DeveloperFeedback,
		kind: "photo" | "audio",
	) => void;
	feedbackMediaLoading: boolean;
	billingLoading: boolean;
}) => {
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
			<div className="mini-title">
				<h1>{uiText(language, "settings")}</h1>
			</div>
			{quota?.dev_tools_enabled && (
				<BillingDeveloperTools
					quota={quota}
					dashboard={developerDashboard}
					dashboardLoading={developerDashboardLoading}
					loading={billingLoading}
					onApply={onDevUpdate}
					onRefresh={onRefreshDeveloperDashboard}
				/>
			)}
			{quota?.feedback_admin_enabled && (
				<FeedbackDeveloperTools
					feedback={developerFeedback}
					loading={developerFeedbackLoading}
					mediaLoading={feedbackMediaLoading}
					selectedFeedbackID={selectedFeedbackID}
					onRefresh={onRefreshDeveloperFeedback}
					onOpenMedia={onOpenFeedbackMedia}
				/>
			)}
			<div className="mini-profile-groups">
				<section className="mini-profile-group">
					<h2>{uiText(language, "accountAndLogin")}</h2>
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
										: uiText(language, "linked")
									: uiText(language, "link")}
							</b>
						</button>
						<button type="button" onClick={onLinkEmail}>
							<span>
								<EnvelopeSimple size={18} />
								{uiText(language, "loginEmail")}
							</span>
							<b>{linkedEmail || uiText(language, "link")}</b>
						</button>
					</div>
				</section>

				<section className="mini-profile-group">
					<h2>{uiText(language, "personalSettings")}</h2>
					<div className="mini-profile-list">
						<div className="mini-profile-avatar-row">
							<div className="mini-profile-avatar">
								<span>
									{(user?.name || uiText(language, "user"))
										.slice(0, 1)
										.toUpperCase()}
								</span>
								{avatarURL && (
									<img
										src={avatarURL}
										alt=""
										onError={(event) => event.currentTarget.remove()}
									/>
								)}
							</div>
							<div className="mini-profile-avatar-copy">
								<strong>{uiText(language, "profilePhoto")}</strong>
								<small>{uiText(language, "profilePhotoHint")}</small>
							</div>
							<div className="mini-profile-avatar-actions">
								<label
									className="mini-profile-avatar-action"
									aria-label={uiText(language, "changePhoto")}
									title={uiText(language, "changePhoto")}
								>
									<Camera size={18} weight="bold" />
									<span>{uiText(language, "changePhoto")}</span>
									<input
										type="file"
										accept="image/jpeg,image/png,image/webp"
										disabled={avatarSaving}
										onChange={(event) => {
											const file = event.currentTarget.files?.[0];
											if (file) onAvatarUpload(file);
											event.currentTarget.value = "";
										}}
									/>
								</label>
								{user?.avatarMediaId && (
									<button
										type="button"
										aria-label={uiText(language, "removePhoto")}
										title={uiText(language, "removePhoto")}
										disabled={avatarSaving}
										onClick={onAvatarRemove}
									>
										<Trash size={17} />
									</button>
								)}
							</div>
						</div>
						<button
							className="mini-profile-setting"
							type="button"
							onClick={onEdit}
						>
							<span>{uiText(language, "profileName")}</span>
							<b>
								{user?.name || uiText(language, "user")}
								<PencilSimple size={15} />
							</b>
						</button>
						<button
							className="mini-profile-setting"
							type="button"
							onClick={onEdit}
						>
							<span>{uiText(language, "currency")}</span>
							<b>
								{localizedCurrencyName(user?.currency || "RUB", language)}
								<PencilSimple size={15} />
							</b>
						</button>
						<button
							className="mini-profile-setting"
							type="button"
							onClick={onEdit}
						>
							<span>{uiText(language, "country")}</span>
							<b>
								{localizedRegionName(user?.country || "RU", language)}
								<PencilSimple size={15} />
							</b>
						</button>
						<button
							className="mini-profile-setting"
							type="button"
							onClick={onEdit}
						>
							<span>{uiText(language, "language")}</span>
							<b>
								{languageOptions.find(([code]) => code === language)?.[1]}
								<PencilSimple size={15} />
							</b>
						</button>
						<button
							className="mini-profile-setting"
							type="button"
							onClick={onEdit}
						>
							<span>{uiText(language, "timezone")}</span>
							<b>
								{localizedTimezoneName(
									user?.timezone || "Europe/Moscow",
									language,
								)}
								<PencilSimple size={15} />
							</b>
						</button>
					</div>
				</section>

				<section className="mini-profile-group">
					<h2>{uiText(language, "dataOrganization")}</h2>
					<div className="mini-profile-list">
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
					</div>
				</section>

				<section className="mini-profile-group">
					<h2>{uiText(language, "application")}</h2>
					<div className="mini-profile-list">
						<button type="button" onClick={onManageNotifications}>
							<span>
								<BellRinging size={18} />
								{uiText(language, "notifications")}
							</span>
							<b>{user?.notificationTime || "09:00"}</b>
						</button>
						<button
							type="button"
							onClick={onInstall}
							disabled={installDisabled}
						>
							<span>
								<House size={18} />
								{uiText(language, "homeShortcut")}
							</span>
							<b>{installStatus}</b>
						</button>
					</div>
				</section>
			</div>
		</section>
	);
};

const developerPercent = (value: number) =>
	`${(Math.max(0, value) * 100).toFixed(1)}%`;

const developerDuration = (milliseconds: number) =>
	milliseconds >= 1000
		? `${(milliseconds / 1000).toFixed(milliseconds >= 10_000 ? 0 : 1)} с`
		: `${Math.round(milliseconds)} мс`;

const developerBytes = (bytes: number) => {
	if (bytes < 1024) return `${bytes} Б`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
	return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
};

const developerModuleLabel = (module: string) =>
	module === "plan" ? "Планы" : module === "assistant" ? "Помощник" : "Расходы";

const developerInputLabel = (input: string) =>
	input === "image"
		? "Фото"
		: input === "voice"
			? "Голос"
			: input === "text"
				? "Текст"
				: input;

const BillingDeveloperTools = ({
	quota,
	dashboard,
	dashboardLoading,
	loading,
	onApply,
	onRefresh,
}: {
	quota: Quota;
	dashboard: DeveloperDashboard | null;
	dashboardLoading: boolean;
	loading: boolean;
	onApply: (patch: DeveloperQuotaPatch) => void;
	onRefresh: () => void;
}) => (
	<details className="mini-dev-tools">
		<summary>
			<span>
				<b>Инструменты разработчика</b>
				<small>
					{dashboard
						? `Личный доступ · user #${dashboard.user_id}`
						: "Личный доступ"}
				</small>
			</span>
			<CaretDown size={18} weight="bold" />
		</summary>
		<div className="mini-dev-content">
			<div className="mini-dev-section-head">
				<div>
					<strong>Сводка продукта</strong>
					<small>
						{dashboard
							? `Последние ${dashboard.period_days} дней`
							: "Метрики ещё не загружены"}
					</small>
				</div>
				<button
					type="button"
					aria-label="Обновить метрики"
					title="Обновить метрики"
					disabled={dashboardLoading}
					onClick={onRefresh}
				>
					<ArrowClockwise size={17} />
				</button>
			</div>
			{dashboardLoading && !dashboard ? (
				<p className="mini-dev-empty">Загружаю метрики…</p>
			) : dashboard ? (
				<>
					<details className="mini-dev-panel" open>
						<summary>
							<span>
								<b>Пользователи и активность</b>
								<small>Регистрации и вводы по всему продукту</small>
							</span>
							<CaretDown size={17} weight="bold" />
						</summary>
						<div className="mini-dev-panel-body">
							<div className="mini-dev-metrics">
								<p>
									<span>Всего</span>
									<b>{dashboard.product.total_users}</b>
									<small>пользователей</small>
								</p>
								<p>
									<span>Новые</span>
									<b>{dashboard.product.new_users_7_days}</b>
									<small>
										{dashboard.product.new_users_30_days} за 30 дней
									</small>
								</p>
								<p>
									<span>Активные</span>
									<b>{dashboard.product.active_users_7_days}</b>
									<small>
										{dashboard.product.active_users_30_days} за 30 дней
									</small>
								</p>
								<p>
									<span>Вводы</span>
									<b>{dashboard.product.inputs_30_days}</b>
									<small>за 30 дней</small>
								</p>
								<p>
									<span>Разборы</span>
									<b>{dashboard.product.quota_units_30_days}</b>
									<small>списано за 30 дней</small>
								</p>
								<p>
									<span>Частота</span>
									<b>
										{dashboard.product.average_inputs_per_active_user.toFixed(
											1,
										)}
									</b>
									<small>ввода на активного</small>
								</p>
							</div>
							{dashboard.product.recent_users.length > 0 && (
								<div className="mini-dev-users">
									<strong>Последние регистрации</strong>
									{dashboard.product.recent_users.map((recentUser) => (
										<p key={recentUser.id}>
											<span>
												<b>
													{recentUser.name || `Пользователь #${recentUser.id}`}
												</b>
												<small>
													#{recentUser.id} · {recentUser.auth_type || "unknown"}{" "}
													· {formatDateTime(recentUser.created_at, "ru")}
												</small>
												{recentUser.last_input_at && (
													<small>
														Последний ввод:{" "}
														{formatDateTime(recentUser.last_input_at, "ru")}
													</small>
												)}
											</span>
											<strong>
												{recentUser.inputs_30_days}
												<small>{recentUser.quota_units_30_days} разборов</small>
											</strong>
										</p>
									))}
								</div>
							)}
						</div>
					</details>
					<details className="mini-dev-panel">
						<summary>
							<span>
								<b>Контроль обработки</b>
								<small>Очередь, результаты и последние ошибки</small>
							</span>
							<CaretDown size={17} weight="bold" />
						</summary>
						<div className="mini-dev-panel-body">
							<div className="mini-dev-metrics">
								<p>
									<span>Обработано</span>
									<b>{dashboard.processing.processing_jobs}</b>
									<small>{dashboard.processing.succeeded_jobs} успешно</small>
								</p>
								<p>
									<span>В работе</span>
									<b>
										{dashboard.processing.pending_jobs +
											dashboard.processing.running_jobs}
									</b>
									<small>{dashboard.processing.pending_jobs} ожидает</small>
								</p>
								<p>
									<span>Ошибки</span>
									<b>{dashboard.processing.failed_jobs}</b>
									<small>{dashboard.models.failed_calls} вызова моделей</small>
								</p>
								<p>
									<span>Среднее время</span>
									<b>
										{developerDuration(dashboard.processing.average_latency_ms)}
									</b>
									<small>на один ввод</small>
								</p>
							</div>
							{dashboard.breakdown.length > 0 && (
								<div className="mini-dev-breakdown">
									<strong>По типам ввода</strong>
									{dashboard.breakdown.map((row) => (
										<p key={`${row.module}-${row.input_kind}`}>
											<span>
												{developerModuleLabel(row.module)} ·{" "}
												{developerInputLabel(row.input_kind)}
											</span>
											<b>{row.processing_jobs}</b>
										</p>
									))}
								</div>
							)}
							{dashboard.recent_failures.length > 0 && (
								<div className="mini-dev-failures">
									<strong>Последние ошибки</strong>
									{dashboard.recent_failures.map((failure) => (
										<p key={failure.source_document_id}>
											<span>
												#{failure.source_document_id} ·{" "}
												{developerInputLabel(failure.input_kind)} · попыток{" "}
												{failure.attempts}
											</span>
											<small>{failure.error || "Без текста ошибки"}</small>
										</p>
									))}
								</div>
							)}
						</div>
					</details>
					<details className="mini-dev-panel">
						<summary>
							<span>
								<b>Качество и модели</b>
								<small>Подтверждения, стоимость и fallback</small>
							</span>
							<CaretDown size={17} weight="bold" />
						</summary>
						<div className="mini-dev-panel-body">
							<div className="mini-dev-metrics">
								<p>
									<span>Подтверждено</span>
									<b>{developerPercent(dashboard.quality.confirm_rate)}</b>
									<small>
										{dashboard.quality.confirmed_results} результатов
									</small>
								</p>
								<p>
									<span>С правками</span>
									<b>{developerPercent(dashboard.quality.edit_rate)}</b>
									<small>{dashboard.quality.edited_results} результатов</small>
								</p>
								<p>
									<span>Отменено</span>
									<b>{developerPercent(dashboard.quality.delete_rate)}</b>
									<small>{dashboard.quality.deleted_results} результатов</small>
								</p>
								<p>
									<span>Fallback</span>
									<b>{developerPercent(dashboard.models.fallback_rate)}</b>
									<small>{dashboard.models.fallback_calls} вызовов</small>
								</p>
								<p>
									<span>Стоимость</span>
									<b>${dashboard.models.total_cost_usd.toFixed(4)}</b>
									<small>за 30 дней</small>
								</p>
								<p>
									<span>Вызовы</span>
									<b>{dashboard.models.model_calls}</b>
									<small>моделей</small>
								</p>
							</div>
							<div className="mini-dev-details">
								<p>
									<span>За подтверждённый результат</span>
									<b>${dashboard.quality.cost_per_confirmed_usd.toFixed(4)}</b>
								</p>
								<p>
									<span>p95 стоимости действия</span>
									<b>${dashboard.quality.p95_cost_per_action_usd.toFixed(4)}</b>
								</p>
								<p>
									<span>Списано личных разборов</span>
									<b>{dashboard.processing.quota_units}</b>
								</p>
								<p>
									<span>Средний ответ модели</span>
									<b>
										{developerDuration(dashboard.models.average_latency_ms)}
									</b>
								</p>
							</div>
						</div>
					</details>
					<details className="mini-dev-panel">
						<summary>
							<span>
								<b>Данные и доступ</b>
								<small>Ваши сессии, исходники и согласия</small>
							</span>
							<CaretDown size={17} weight="bold" />
						</summary>
						<div className="mini-dev-panel-body">
							<div className="mini-dev-details">
								<p>
									<span>Активные сессии</span>
									<b>{dashboard.data.active_sessions}</b>
								</p>
								<p>
									<span>Сохранённые исходники</span>
									<b>
										{dashboard.data.stored_files} ·{" "}
										{developerBytes(dashboard.data.stored_bytes)}
									</b>
								</p>
								<p>
									<span>Ближайшее удаление</span>
									<b>
										{dashboard.data.earliest_media_expiry
											? formatDateTime(
													dashboard.data.earliest_media_expiry,
													"ru",
												)
											: "Нет"}
									</b>
								</p>
								<p>
									<span>Почта / согласие</span>
									<b>
										{dashboard.data.email_verified ? "Да" : "Нет"} /{" "}
										{dashboard.data.personal_data_consent ? "Да" : "Нет"}
									</b>
								</p>
							</div>
						</div>
					</details>
				</>
			) : (
				<p className="mini-dev-empty">
					Не удалось загрузить метрики. Нажмите обновить.
				</p>
			)}
			<details className="mini-dev-panel">
				<summary>
					<span>
						<b>Подписка и тесты</b>
						<small>Временные инструменты для проверки ограничений</small>
					</span>
					<CaretDown size={17} weight="bold" />
				</summary>
				<div className="mini-dev-panel-body">
					<fieldset disabled={loading}>
						<form
							key={`${quota.plan}-${quota.plan_expires_at}-${quota.recurring_limit}-${quota.additional_limit}`}
							onSubmit={(event) => {
								event.preventDefault();
								const data = new FormData(event.currentTarget);
								const expiresAt = String(data.get("expires_at") || "");
								onApply({
									plan: String(data.get("plan")) === "plus" ? "plus" : "free",
									plan_expires_at: expiresAt
										? new Date(expiresAt).toISOString()
										: "",
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
										plan_expires_at: new Date(
											Date.now() + 2 * 60_000,
										).toISOString(),
									})
								}
							>
								Плюс на 2 минуты
							</button>
							<button
								type="button"
								onClick={() => onApply({ plan: "free", plan_expires_at: "" })}
							>
								Отменить Плюс
							</button>
						</div>
						<div className="mini-dev-inline">
							<button
								type="button"
								onClick={() => onApply({ reset_usage: true })}
							>
								Обнулить использование ({quota.used})
							</button>
						</div>
						<form
							className="mini-dev-inline"
							onSubmit={(event) => {
								event.preventDefault();
								const units = Number(
									new FormData(event.currentTarget).get("units"),
								);
								onApply({ additional_units: units });
							}}
						>
							<select
								name="units"
								aria-label="Размер тестового пакета"
								defaultValue="100"
							>
								<option value="100">Пакет 100</option>
								<option value="500">Пакет 500</option>
								<option value="1500">Пакет 1500</option>
							</select>
							<button type="submit">Добавить</button>
							<button
								type="button"
								onClick={() => onApply({ additional_limit: 0 })}
							>
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
							<select
								name="notification"
								aria-label="Тип тестового уведомления"
							>
								<option value="subscription_expiring">
									Подписка заканчивается
								</option>
								<option value="subscription_expired">
									Подписка закончилась
								</option>
								<option value="quota_low">Лимит скоро закончится</option>
								<option value="quota_exhausted">Лимит закончился</option>
							</select>
							<button type="submit">Отправить</button>
						</form>
					</fieldset>
				</div>
			</details>
		</div>
	</details>
);

const feedbackCategoryLabel = (category: FeedbackCategory) =>
	category === "problem"
		? "Проблема"
		: category === "idea"
			? "Предложение"
			: category === "thanks"
				? "Спасибо"
				: "Другое";

const FeedbackDeveloperTools = ({
	feedback,
	loading,
	mediaLoading,
	selectedFeedbackID,
	onRefresh,
	onOpenMedia,
}: {
	feedback: DeveloperFeedback[];
	loading: boolean;
	mediaLoading: boolean;
	selectedFeedbackID: number;
	onRefresh: () => void;
	onOpenMedia: (feedback: DeveloperFeedback, kind: "photo" | "audio") => void;
}) => (
	<details
		className="mini-dev-tools mini-feedback-admin"
		open={selectedFeedbackID > 0 || undefined}
	>
		<summary>
			<span>Фидбэк пользователей</span>
			<small>
				{feedback.length
					? `${feedback.length} последних обращений`
					: "Поддержка"}
			</small>
		</summary>
		<div className="mini-feedback-admin-body">
			<div className="mini-dev-section-head">
				<div>
					<strong>Обращения</strong>
					<small>Предложения, проблемы и благодарности</small>
				</div>
				<button
					type="button"
					aria-label="Обновить обращения"
					title="Обновить обращения"
					disabled={loading}
					onClick={onRefresh}
				>
					<ArrowClockwise size={17} />
				</button>
			</div>
			{loading && feedback.length === 0 ? (
				<p className="mini-dev-empty">Загружаю обращения…</p>
			) : feedback.length === 0 ? (
				<p className="mini-dev-empty">Пока никто ничего не написал.</p>
			) : (
				<div className="mini-feedback-list">
					{feedback.map((item) => {
						const email =
							item.user.email_verified &&
							!item.user.email.endsWith("@telegram.local")
								? item.user.email
								: "";
						const telegramUsername = item.user.telegram_username?.replace(
							/^@/,
							"",
						);
						return (
							<article
								id={`feedback-${item.id}`}
								className={item.id === selectedFeedbackID ? "is-selected" : ""}
								key={item.id}
							>
								<header>
									<span className={`is-${item.category}`}>
										{feedbackCategoryLabel(item.category)}
									</span>
									<time>{formatDateTime(item.created_at, "ru")}</time>
								</header>
								<p>{item.message || "Сообщение без текста"}</p>
								<div className="mini-feedback-person">
									<strong>{item.user.name || `User #${item.user_id}`}</strong>
									<small>
										#{item.id} · user #{item.user_id} · {item.source}
									</small>
								</div>
								<div className="mini-feedback-links">
									{email && (
										<a
											href={`mailto:${email}?subject=Пока не забыл · обращение %23${item.id}`}
										>
											Ответить по почте
										</a>
									)}
									{telegramUsername && (
										<a
											href={`https://t.me/${telegramUsername}`}
											target="_blank"
											rel="noreferrer"
										>
											Открыть Telegram
										</a>
									)}
									{!email && !telegramUsername && (
										<small>
											Контакт: Telegram ID{" "}
											{item.user.telegram_id || "не указан"}
										</small>
									)}
								</div>
								{(item.photo || item.audio) && (
									<div className="mini-feedback-attachments">
										{item.photo &&
											(item.photo.available ? (
												<button
													type="button"
													disabled={mediaLoading}
													onClick={() => onOpenMedia(item, "photo")}
												>
													<Camera size={17} />
													Фото
													<small>
														{developerBytes(item.photo.byte_size || 0)}
													</small>
												</button>
											) : (
												<span>Фото удалено</span>
											))}
										{item.audio &&
											(item.audio.available ? (
												<button
													type="button"
													disabled={mediaLoading}
													onClick={() => onOpenMedia(item, "audio")}
												>
													<Microphone size={17} />
													Аудио
													<small>
														{developerBytes(item.audio.byte_size || 0)}
													</small>
												</button>
											) : (
												<span>Аудио удалено</span>
											))}
									</div>
								)}
							</article>
						);
					})}
				</div>
			)}
		</div>
	</details>
);

const billingPacks = [
	{ code: "pack_100", basicPrice: 99, plusPrice: 79, units: 100 },
	{ code: "pack_500", basicPrice: 399, plusPrice: 299, units: 500 },
	{ code: "pack_1500", basicPrice: 899, plusPrice: 699, units: 1500 },
];

const BillingPackPicker = ({
	language,
	plus,
	loading,
	onClose,
	onSelect,
}: {
	language: UILanguage;
	plus: boolean;
	loading: boolean;
	onClose: () => void;
	onSelect: (code: string) => void;
}) => {
	const unitsLabel =
		language === "en"
			? "quick additions"
			: language === "es"
				? "registros rápidos"
				: "разборов";
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
						<strong>{plus ? pack.plusPrice : pack.basicPrice} ₽</strong>
					</button>
				))}
			</div>
			<p className="mini-modal-note">
				{language === "ru"
					? `${plus ? "Скидка Плюс уже учтена. " : ""}Пакет увеличивает доступный лимит и не продлевает подписку.`
					: language === "es"
						? `${plus ? "El descuento Plus ya está aplicado. " : ""}El paquete aumenta el límite y no renueva la suscripción.`
						: `${plus ? "Your Plus discount is already applied. " : ""}The pack increases your allowance and does not renew the subscription.`}
			</p>
		</Modal>
	);
};

const FeedbackComposer = ({
	language,
	retentionDays,
	saving,
	error,
	remaining,
	onClose,
	onSubmit,
}: {
	language: UILanguage;
	retentionDays: number;
	saving: boolean;
	error: string;
	remaining: number;
	onClose: () => void;
	onSubmit: (submission: FeedbackSubmission) => Promise<void>;
}) => {
	const copy =
		language === "es"
			? {
					title: "Escribir a soporte",
					prompt: "Cuéntenos qué ocurrió o qué le gustaría mejorar.",
					placeholder: "Describa el problema, la idea o simplemente salude…",
					problem: "Problema",
					idea: "Idea",
					thanks: "Gracias",
					other: "Otro",
					photo: "Adjuntar foto",
					record: "Grabar voz",
					stop: "Detener",
					send: "Enviar",
					sending: "Enviando…",
					private:
						"Se enviará directamente a soporte, sin reconocimiento automático.",
					remaining: `Hoy puede enviar ${remaining} mensaje${remaining === 1 ? "" : "s"} más.`,
				}
			: language === "en"
				? {
						title: "Contact support",
						prompt: "Tell us what happened or what you would like to improve.",
						placeholder:
							"Describe a problem, share an idea, or just say hello…",
						problem: "Problem",
						idea: "Idea",
						thanks: "Thanks",
						other: "Other",
						photo: "Attach photo",
						record: "Record voice",
						stop: "Stop",
						send: "Send",
						sending: "Sending…",
						private:
							"This goes directly to support without automatic recognition.",
						remaining: `You can send ${remaining} more message${remaining === 1 ? "" : "s"} today.`,
					}
				: {
						title: "Написать в поддержку",
						prompt: "Расскажите, что произошло или чего не хватает.",
						placeholder:
							"Опишите проблему, предложите идею или просто передайте привет…",
						problem: "Проблема",
						idea: "Идея",
						thanks: "Спасибо",
						other: "Другое",
						photo: "Приложить фото",
						record: "Записать голос",
						stop: "Остановить",
						send: "Отправить",
						sending: "Отправляем…",
						private:
							"Обращение уйдёт прямо в поддержку, без автоматического разбора.",
						remaining: `Сегодня можно отправить ещё ${remaining} ${remaining === 1 ? "обращение" : remaining < 5 ? "обращения" : "обращений"}.`,
					};
	const [category, setCategory] = useState<FeedbackCategory>("problem");
	const [message, setMessage] = useState("");
	const [photo, setPhoto] = useState<File | undefined>();
	const [audio, setAudio] = useState<File | undefined>();
	const [audioURL, setAudioURL] = useState("");
	const [recording, setRecording] = useState(false);
	const [seconds, setSeconds] = useState(0);
	const [localError, setLocalError] = useState("");
	const photoInput = useRef<HTMLInputElement>(null);
	const recorder = useRef<MediaRecorder | null>(null);
	const stream = useRef<MediaStream | null>(null);
	const chunks = useRef<Blob[]>([]);
	const timer = useRef(0);
	const timeout = useRef(0);

	const clearRecording = () => {
		window.clearInterval(timer.current);
		window.clearTimeout(timeout.current);
		for (const track of stream.current?.getTracks() || []) track.stop();
		stream.current = null;
		setRecording(false);
	};

	useEffect(
		() => () => {
			window.clearInterval(timer.current);
			window.clearTimeout(timeout.current);
			if (recorder.current?.state === "recording") {
				recorder.current.onstop = null;
				recorder.current.stop();
			}
			for (const track of stream.current?.getTracks() || []) track.stop();
		},
		[],
	);

	useEffect(
		() => () => {
			if (audioURL) URL.revokeObjectURL(audioURL);
		},
		[audioURL],
	);

	const setAudioFile = (file?: File) => {
		if (audioURL) URL.revokeObjectURL(audioURL);
		setAudio(file);
		setAudioURL(file ? URL.createObjectURL(file) : "");
	};

	const startRecording = async () => {
		setLocalError("");
		if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
			setLocalError("Запись голоса недоступна на этом устройстве");
			return;
		}
		try {
			const nextStream = await navigator.mediaDevices.getUserMedia({
				audio: true,
			});
			stream.current = nextStream;
			const mimeType = [
				"audio/webm;codecs=opus",
				"audio/mp4",
				"audio/webm",
			].find((type) => MediaRecorder.isTypeSupported(type));
			const nextRecorder = new MediaRecorder(
				nextStream,
				mimeType ? { mimeType } : undefined,
			);
			chunks.current = [];
			nextRecorder.ondataavailable = (event) => {
				if (event.data.size > 0) chunks.current.push(event.data);
			};
			nextRecorder.onstop = () => {
				clearRecording();
				const type = nextRecorder.mimeType || mimeType || "audio/webm";
				const blob = new Blob(chunks.current, { type });
				if (!blob.size) {
					setLocalError("Не удалось записать голос");
					return;
				}
				const extension = type.includes("mp4") ? "m4a" : "webm";
				setAudioFile(new File([blob], `feedback.${extension}`, { type }));
			};
			recorder.current = nextRecorder;
			setAudioFile(undefined);
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
			clearRecording();
			setLocalError("Не удалось включить микрофон. Проверьте разрешение");
		}
	};

	const selectPhoto = (file?: File) => {
		if (!file) return;
		if (file.size > 15 * 1024 * 1024) {
			setLocalError("Файл должен быть меньше 15 МБ");
			return;
		}
		if (!file.type.startsWith("image/")) {
			setLocalError("Выберите изображение");
			return;
		}
		setLocalError("");
		setPhoto(file);
	};

	const categories: [FeedbackCategory, string][] = [
		["problem", copy.problem],
		["idea", copy.idea],
		["thanks", copy.thanks],
		["other", copy.other],
	];
	return (
		<Modal title={copy.title} onClose={onClose}>
			<div className="feedback-composer">
				<p className="feedback-prompt">{copy.prompt}</p>
				<small className="feedback-remaining">{copy.remaining}</small>
				<div className="feedback-kinds" aria-label="Тип обращения">
					{categories.map(([value, label]) => (
						<button
							className={category === value ? "active" : ""}
							type="button"
							key={value}
							onClick={() => setCategory(value)}
						>
							{label}
						</button>
					))}
				</div>
				<textarea
					maxLength={5000}
					placeholder={copy.placeholder}
					value={message}
					onChange={(event) => setMessage(event.target.value)}
				/>
				<div className="feedback-attachment-actions">
					<button
						type="button"
						disabled={saving}
						onClick={() => photoInput.current?.click()}
					>
						<Camera size={19} />
						{copy.photo}
					</button>
					<button
						className={recording ? "recording" : ""}
						type="button"
						disabled={saving}
						onClick={() =>
							recording ? recorder.current?.stop() : void startRecording()
						}
					>
						<Microphone size={19} weight={recording ? "fill" : "regular"} />
						{recording ? copy.stop : copy.record}
					</button>
				</div>
				{recording && (
					<strong className="feedback-recording-time">
						{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")} /
						1:00
					</strong>
				)}
				{(photo || audio) && (
					<div className="feedback-files">
						{photo && (
							<p>
								<Camera size={17} />
								<span>{photo.name}</span>
								<button
									type="button"
									aria-label="Убрать фото"
									onClick={() => setPhoto(undefined)}
								>
									<X size={16} />
								</button>
							</p>
						)}
						{audio && (
							<div>
								<p>
									<Microphone size={17} />
									<span>{audio.name}</span>
									<button
										type="button"
										aria-label="Убрать аудио"
										onClick={() => setAudioFile(undefined)}
									>
										<X size={16} />
									</button>
								</p>
								{/* biome-ignore lint/a11y/useMediaCaption: user-created feedback has no transcript */}
								<audio controls src={audioURL} />
							</div>
						)}
					</div>
				)}
				<input
					ref={photoInput}
					className="capture-file-input"
					type="file"
					accept="image/*"
					capture="environment"
					onChange={(event) => {
						selectPhoto(event.target.files?.[0]);
						event.target.value = "";
					}}
				/>
				<small className="feedback-private-note">
					{copy.private}{" "}
					{language === "es"
						? `Los archivos se guardan ${retentionDays} días.`
						: language === "en"
							? `Files are kept for ${retentionDays} days.`
							: `Файлы хранятся ${retentionDays} ${retentionDays === 3 ? "дня" : "дней"}.`}
				</small>
				{(localError || error) && (
					<div className="mini-alert">{localError || error}</div>
				)}
				<button
					className="mini-save feedback-submit"
					type="button"
					disabled={
						saving || recording || (!message.trim() && !photo && !audio)
					}
					onClick={() =>
						void onSubmit({
							category,
							message: message.trim(),
							photo,
							audio,
						})
					}
				>
					<PaperPlaneTilt size={18} weight="bold" />
					{saving ? copy.sending : copy.send}
				</button>
			</div>
		</Modal>
	);
};

const FeedbackMediaModal = ({
	viewer,
	onClose,
}: {
	viewer: FeedbackMediaViewer;
	onClose: () => void;
}) => (
	<Modal title={viewer.title} onClose={onClose}>
		<div className="feedback-media-viewer">
			{viewer.kind === "photo" ? (
				<img src={viewer.url} alt="Вложение к обращению" />
			) : (
				// biome-ignore lint/a11y/useMediaCaption: user feedback audio has no transcript
				<audio controls autoPlay src={viewer.url} />
			)}
		</div>
	</Modal>
);

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
	const [photos, setPhotos] = useState<
		{ id: string; file: File; url: string }[]
	>([]);
	const [localError, setLocalError] = useState("");
	const cameraInput = useRef<HTMLInputElement>(null);
	const galleryInput = useRef<HTMLInputElement>(null);
	const recorder = useRef<MediaRecorder | null>(null);
	const stream = useRef<MediaStream | null>(null);
	const chunks = useRef<Blob[]>([]);
	const timer = useRef(0);
	const timeout = useRef(0);
	const photoURLs = useRef(new Set<string>());

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
			for (const url of photoURLs.current) URL.revokeObjectURL(url);
			photoURLs.current.clear();
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

	const selectPhoto = (event: React.ChangeEvent<HTMLInputElement>) => {
		const selected = Array.from(event.target.files || []);
		event.target.value = "";
		if (!selected.length) return;
		if (selected.some((file) => !file.type.startsWith("image/"))) {
			setLocalError("Выберите фотографию");
			return;
		}
		if (selected.some((file) => file.size > 10 * 1024 * 1024)) {
			setLocalError("Каждая фотография должна быть меньше 10 МБ");
			return;
		}
		if (photos.length + selected.length > 5) {
			setLocalError("Можно добавить не больше 5 фотографий");
			return;
		}
		const next = selected.map((file) => {
			const url = URL.createObjectURL(file);
			photoURLs.current.add(url);
			return { id: crypto.randomUUID(), file, url };
		});
		setPhotos((current) => [...current, ...next]);
		setLocalError("");
	};

	const removePhoto = (id: string) => {
		setPhotos((current) => {
			const removed = current.find((photo) => photo.id === id);
			if (removed) {
				URL.revokeObjectURL(removed.url);
				photoURLs.current.delete(removed.url);
			}
			return current.filter((photo) => photo.id !== id);
		});
	};

	const clearPhotos = () => {
		for (const photo of photos) {
			URL.revokeObjectURL(photo.url);
			photoURLs.current.delete(photo.url);
		}
		setPhotos([]);
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
						onClick={() => setMode("photo")}
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
									void onSubmit({
										kind: "voice",
										file: voiceFile,
										durationSeconds: Math.max(1, seconds),
									})
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
					{photos.length === 0 && (
						<div className="capture-photo-mark">
							<Camera size={34} weight="bold" />
						</div>
					)}
					<strong>
						{photos.length
							? `${photos.length} из 5 фотографий`
							: isPlan
								? "Добавьте фото покупки или списка"
								: "Добавьте фото чека или покупки"}
					</strong>
					<small>
						{photos.length
							? "Проверьте кадры и отправьте их одним разбором"
							: "Можно снять несколько фото или выбрать их из галереи"}
					</small>
					{photos.length > 0 && (
						<div className="capture-photo-preview" aria-label="Выбранные фото">
							{photos.map((photo, index) => (
								<figure key={photo.id}>
									<img src={photo.url} alt={`Фото ${index + 1}`} />
									<span>{index + 1}</span>
									<button
										type="button"
										aria-label={`Удалить фото ${index + 1}`}
										onClick={() => removePhoto(photo.id)}
									>
										<X size={15} weight="bold" />
									</button>
								</figure>
							))}
						</div>
					)}
					<div className="capture-source-actions">
						<button
							type="button"
							disabled={saving || photos.length >= 5}
							onClick={() => cameraInput.current?.click()}
						>
							<Camera size={19} />
							{photos.length ? "Ещё фото" : "Снять фото"}
						</button>
						<button
							type="button"
							disabled={saving || photos.length >= 5}
							onClick={() => galleryInput.current?.click()}
						>
							<ImageSquare size={19} />
							{photos.length ? "Добавить" : "Из галереи"}
						</button>
					</div>
					<div
						className={`capture-actions capture-photo-actions${photos.length ? " has-selection" : ""}`}
					>
						<button
							type="button"
							disabled={saving}
							onClick={() => {
								clearPhotos();
								setMode("choose");
							}}
						>
							Назад
						</button>
						{photos.length > 0 && (
							<button
								className="capture-submit"
								type="button"
								disabled={saving}
								onClick={() =>
									void onSubmit({
										kind: "image",
										files: photos.map((photo) => photo.file),
									})
								}
							>
								<PaperPlaneTilt size={18} />
								{saving ? "Разбираем…" : "Отправить"}
							</button>
						)}
					</div>
				</div>
			)}

			<input
				ref={cameraInput}
				className="capture-file-input"
				type="file"
				accept="image/*"
				capture="environment"
				onChange={(event) => void selectPhoto(event)}
			/>
			<input
				ref={galleryInput}
				className="capture-file-input"
				type="file"
				accept="image/*"
				multiple
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

const MoveRecordControl = ({
	language,
	targets,
	saving,
	hint,
	cloneHint,
	onMove,
}: {
	language: UILanguage;
	targets: Space[];
	saving: boolean;
	hint: string;
	cloneHint: string;
	onMove: (spaceID: number, operation: TransferOperation) => void;
}) => {
	const [targetSpaceID, setTargetSpaceID] = useState(targets[0]?.id || 0);
	const [operation, setOperation] = useState<TransferOperation>("move");
	if (!targets.length) return null;
	return (
		<details
			className="mini-record-move"
			onToggle={(event) => {
				if (
					!event.currentTarget.open ||
					!window.matchMedia("(max-width: 699px)").matches
				)
					return;
				const details = event.currentTarget;
				window.requestAnimationFrame(() =>
					details.scrollIntoView({ block: "center", behavior: "smooth" }),
				);
			}}
		>
			<summary>
				<ArrowRight size={18} />
				{uiText(language, "moveRecord")}
			</summary>
			<div>
				<div
					className="mini-record-operation"
					role="radiogroup"
					aria-label={uiText(language, "moveRecord")}
				>
					<button
						className={operation === "move" ? "active" : ""}
						type="button"
						role="radio"
						aria-checked={operation === "move"}
						onClick={() => setOperation("move")}
					>
						<ArrowRight size={16} />
						{uiText(language, "move")}
					</button>
					<button
						className={operation === "clone" ? "active" : ""}
						type="button"
						role="radio"
						aria-checked={operation === "clone"}
						onClick={() => setOperation("clone")}
					>
						<Copy size={16} />
						{uiText(language, "clone")}
					</button>
				</div>
				<p>{operation === "clone" ? cloneHint : hint}</p>
				<label>
					<span>{uiText(language, "moveToSpace")}</span>
					<select
						value={targetSpaceID}
						onChange={(event) => setTargetSpaceID(Number(event.target.value))}
					>
						{targets.map((space) => (
							<option key={space.id} value={space.id}>
								{space.name}
							</option>
						))}
					</select>
				</label>
				<button
					className="mini-secondary-action"
					type="button"
					disabled={saving || !targetSpaceID}
					onClick={() => onMove(targetSpaceID, operation)}
				>
					{operation === "clone" ? (
						<Copy size={18} />
					) : (
						<ArrowRight size={18} />
					)}
					{saving
						? uiText(language, "saving")
						: uiText(language, operation === "clone" ? "clone" : "move")}
				</button>
			</div>
		</details>
	);
};

const ExpenseDetail = ({
	expense,
	itemIndex,
	language,
	categories,
	members,
	capture,
	sourceLoading,
	moveTargets,
	saving,
	onClose,
	onEdit,
	onDelete,
	onMove,
	onSource,
	onOpenExpense,
	onOpenItem,
}: {
	expense: Expense;
	itemIndex?: number;
	language: UILanguage;
	categories: Category[];
	members: SpaceMember[];
	capture?: CapturePacket;
	sourceLoading: boolean;
	moveTargets: Space[];
	saving: boolean;
	onClose: () => void;
	onEdit: () => void;
	onDelete: () => void;
	onMove: (spaceID: number, operation: TransferOperation) => void;
	onSource: () => void;
	onOpenExpense: () => void;
	onOpenItem: (itemIndex: number) => void;
}) => {
	const item = itemIndex === undefined ? undefined : expense.items[itemIndex];
	const money = item
		? itemDisplayMoney(
				item,
				expense,
				expense.space_currency || expense.currency,
			)
		: expenseDisplayMoney(expense, expense.space_currency || expense.currency);
	const seller = item
		? expenseItemSellerName(item, expense)
		: expenseSellerName(expense);
	const category = item
		? categories.find((current) => current.id === item.category_id)
		: undefined;
	const author = sharedRecordAuthor(members, expense.user_id);
	return (
		<Modal
			title={uiText(language, item ? "viewExpense" : "viewReceipt")}
			onClose={onClose}
		>
			<div className="mini-record-hero">
				<span>
					<Receipt size={22} weight="bold" />
				</span>
				<div>
					<small>
						{item
							? expense.title
							: `${expense.items.length} ${itemWord(expense.items.length)}`}
					</small>
					<h3>
						{item?.name ||
							expense.title ||
							expense.items[0]?.name ||
							uiText(language, "viewExpense")}
					</h3>
				</div>
				<strong>{formatMoney(money.amount, money.currency)}</strong>
			</div>
			<div className="mini-record-meta">
				<div>
					<small>{uiText(language, "purchaseDate")}</small>
					<b>{formatDate(expense.expense_date)}</b>
				</div>
				<div>
					<small>
						{item
							? uiText(language, "category")
							: uiText(language, "planVendor")}
					</small>
					<b>
						{item
							? category
								? localizedCategoryName(category, language)
								: uiText(language, "categoryNotSet")
							: seller}
					</b>
				</div>
				{item && (
					<div>
						<small>{uiText(language, "planVendor")}</small>
						<b>{seller}</b>
					</div>
				)}
				{author && (
					<div>
						<small>{uiText(language, "author")}</small>
						<b>{author}</b>
					</div>
				)}
			</div>
			{expense.source_document_id && (
				<div className="mini-source-access">
					<button
						className="mini-source-open"
						type="button"
						disabled={sourceLoading}
						onClick={onSource}
					>
						<SourceIcon capture={capture} size={18} />
						{sourceLoading ? "Загружаем…" : "Посмотреть исходник"}
					</button>
					<SourceExpiryNote capture={capture} language={language} />
				</div>
			)}
			{item ? (
				<>
					<button
						className="mini-record-parent"
						type="button"
						onClick={onOpenExpense}
					>
						<Receipt size={18} />
						<span>
							<b>{uiText(language, "openReceipt")}</b>
							<small>
								{expense.items.length} {itemWord(expense.items.length)}
							</small>
						</span>
						<ArrowRight size={17} />
					</button>
					{item.notes && <p className="mini-record-note">{item.notes}</p>}
				</>
			) : (
				<div className="mini-record-lines">
					{expense.items.map((current, index) => {
						const currentMoney = itemDisplayMoney(
							current,
							expense,
							money.currency,
						);
						return (
							<button
								key={current.id || index}
								type="button"
								onClick={() => onOpenItem(index)}
							>
								<span>{index + 1}</span>
								<b>{current.name}</b>
								<strong>
									{formatMoney(currentMoney.amount, currentMoney.currency)}
								</strong>
								<ArrowRight size={15} />
							</button>
						);
					})}
				</div>
			)}
			<MoveRecordControl
				language={language}
				targets={moveTargets}
				saving={saving}
				hint={uiText(
					language,
					item ? "moveExpenseItemHint" : "moveExpenseHint",
				)}
				cloneHint={uiText(
					language,
					item ? "cloneExpenseItemHint" : "cloneExpenseHint",
				)}
				onMove={onMove}
			/>
			<div className="mini-modal-actions mini-record-actions">
				<button
					className="mini-save"
					type="button"
					disabled={saving}
					onClick={onEdit}
				>
					<PencilSimple size={18} />
					{uiText(language, "edit")}
				</button>
				<button
					className="mini-delete"
					type="button"
					disabled={saving}
					onClick={onDelete}
				>
					<Trash size={18} />
					{item ? uiText(language, "deleteExpenseItem") : "Удалить расход"}
				</button>
			</div>
		</Modal>
	);
};

const PlanDetail = ({
	plan,
	itemIndex,
	language,
	categories,
	vendors,
	members,
	capture,
	sourceLoading,
	moveTargets,
	saving,
	onClose,
	onEdit,
	onDelete,
	onMove,
	onSource,
	onOpenPlan,
	onOpenItem,
}: {
	plan: PurchasePlan;
	itemIndex?: number;
	language: UILanguage;
	categories: Category[];
	vendors: Vendor[];
	members: SpaceMember[];
	capture?: CapturePacket;
	sourceLoading: boolean;
	moveTargets: Space[];
	saving: boolean;
	onClose: () => void;
	onEdit: () => void;
	onDelete: () => void;
	onMove: (spaceID: number, operation: TransferOperation) => void;
	onSource: () => void;
	onOpenPlan: () => void;
	onOpenItem: (itemIndex: number) => void;
}) => {
	const items = purchasePlanItems(plan);
	const item = itemIndex === undefined ? undefined : items[itemIndex];
	const amount = item?.expected_amount ?? plan.expected_amount;
	const categoryID = item?.category_id ?? plan.category_id;
	const category = categories.find((current) => current.id === categoryID);
	const seller =
		plan.vendor_name ||
		vendors.find((vendor) => vendor.id === plan.vendor_id)?.name ||
		uiText(language, "vendorNotSet");
	const author = sharedRecordAuthor(members, plan.created_by_user_id);
	return (
		<Modal
			title={uiText(language, item ? "viewPlan" : "viewPlanList")}
			onClose={onClose}
		>
			<div className="mini-record-hero is-plan">
				<span>
					<ShoppingBagOpen size={22} weight="bold" />
				</span>
				<div>
					<small>
						{item
							? plan.title
							: `${items.length} ${uiText(language, "planItemsView")}`}
					</small>
					<h3>{item?.name || plan.title}</h3>
				</div>
				<strong>
					{amount
						? formatMoney(amount, plan.currency)
						: uiText(language, "amountNotSet")}
				</strong>
			</div>
			<div className="mini-record-meta">
				<div>
					<small>{uiText(language, "plannedDate")}</small>
					<b>
						{plan.due_date
							? formatPlanDate(plan.due_date, language)
							: uiText(language, "someday")}
					</b>
				</div>
				<div>
					<small>{uiText(language, "category")}</small>
					<b>
						{category
							? localizedCategoryName(category, language)
							: uiText(language, "categoryNotSet")}
					</b>
				</div>
				<div>
					<small>{uiText(language, "planVendor")}</small>
					<b>{seller}</b>
				</div>
				{author && (
					<div>
						<small>{uiText(language, "author")}</small>
						<b>{author}</b>
					</div>
				)}
			</div>
			{plan.source_document_id && (
				<div className="mini-source-access">
					<button
						className="mini-source-open"
						type="button"
						disabled={sourceLoading}
						onClick={onSource}
					>
						<SourceIcon capture={capture} size={18} />
						{sourceLoading ? "Загружаем…" : "Посмотреть исходник"}
					</button>
					<SourceExpiryNote capture={capture} language={language} />
				</div>
			)}
			{item ? (
				<button
					className="mini-record-parent"
					type="button"
					onClick={onOpenPlan}
				>
					<ShoppingBagOpen size={18} />
					<span>
						<b>{uiText(language, "openPlanList")}</b>
						<small>
							{items.length} {uiText(language, "planItemsView")}
						</small>
					</span>
					<ArrowRight size={17} />
				</button>
			) : (
				<div className="mini-record-lines">
					{items.map((current, index) => (
						<button
							key={current.id || index}
							type="button"
							onClick={() => onOpenItem(index)}
						>
							<span>{index + 1}</span>
							<b>{current.name}</b>
							<strong>
								{current.expected_amount
									? formatMoney(current.expected_amount, plan.currency)
									: "—"}
							</strong>
							<ArrowRight size={15} />
						</button>
					))}
				</div>
			)}
			<MoveRecordControl
				language={language}
				targets={moveTargets}
				saving={saving}
				hint={uiText(language, item ? "movePlanItemHint" : "movePlanHint")}
				cloneHint={uiText(
					language,
					item ? "clonePlanItemHint" : "clonePlanHint",
				)}
				onMove={onMove}
			/>
			<div className="mini-modal-actions mini-record-actions">
				<button
					className="mini-save"
					type="button"
					disabled={saving}
					onClick={onEdit}
				>
					<PencilSimple size={18} />
					{uiText(language, "edit")}
				</button>
				<button
					className="mini-delete"
					type="button"
					disabled={saving}
					onClick={onDelete}
				>
					<Trash size={18} />
					{item
						? uiText(language, "deletePlanItem")
						: uiText(language, "deletePlan")}
				</button>
			</div>
		</Modal>
	);
};

const PlanEditor = ({
	plan,
	language,
	categories,
	vendors,
	saving,
	fromCandidate,
	capture,
	sourceLoading,
	moveTargets,
	onChange,
	onClose,
	onSave,
	onSource,
	onMove,
	onDelete,
}: {
	plan: PurchasePlan;
	language: UILanguage;
	categories: Category[];
	vendors: Vendor[];
	saving: boolean;
	fromCandidate?: boolean;
	capture?: CapturePacket;
	sourceLoading: boolean;
	moveTargets: Space[];
	onChange: (plan: PurchasePlan) => void;
	onClose: () => void;
	onSave: () => void;
	onSource: () => void;
	onMove: (spaceID: number, operation: TransferOperation) => void;
	onDelete?: () => void;
}) => {
	const items = purchasePlanItems(plan);
	const updateItems = (nextItems: PurchasePlanItem[]) =>
		onChange(withPurchasePlanItems(plan, nextItems));
	return (
		<Modal
			title={
				fromCandidate
					? uiText(language, "reviewPlan")
					: plan.id
						? uiText(language, "editPlan")
						: uiText(language, "newPlan")
			}
			onClose={onClose}
		>
			{fromCandidate && (
				<div className="mini-review-kind">
					<ShoppingBagOpen size={18} />
					<span>{uiText(language, "reviewPlanHint")}</span>
				</div>
			)}
			{plan.source_document_id && (
				<div className="mini-source-access">
					<button
						className="mini-source-open"
						type="button"
						disabled={sourceLoading}
						onClick={onSource}
					>
						<SourceIcon capture={capture} size={18} />
						{sourceLoading ? "Загружаем…" : "Посмотреть исходник"}
					</button>
					<SourceExpiryNote capture={capture} language={language} />
				</div>
			)}
			<p className="mini-field-note">{uiText(language, "planEditorHint")}</p>
			<label>
				{uiText(language, "planListName")}
				<input
					value={plan.title}
					placeholder={uiText(language, "planListNamePlaceholder")}
					onChange={(event) => onChange({ ...plan, title: event.target.value })}
				/>
			</label>
			<div className="mini-field">
				<span>{uiText(language, "planVendor")}</span>
				<VendorAutocomplete
					vendors={vendors}
					ariaLabel={uiText(language, "planVendor")}
					placeholder={uiText(language, "planVendorPlaceholder")}
					value={
						plan.vendor_name ??
						vendors.find((vendor) => vendor.id === plan.vendor_id)?.name ??
						""
					}
					onChange={(vendorName) =>
						onChange({
							...plan,
							vendor_name: vendorName,
							vendor_id: findVendorByName(vendors, vendorName)?.id || null,
						})
					}
				/>
				<small className="mini-field-hint">
					{uiText(language, "planVendorHint")}
				</small>
			</div>
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
			<div className="mini-plan-editor-items">
				<div className="mini-plan-editor-head">
					<span>{uiText(language, "planItems")}</span>
					{plan.expected_amount != null && (
						<strong>{formatMoney(plan.expected_amount, plan.currency)}</strong>
					)}
				</div>
				{items.map((item, index) => (
					<div className="mini-plan-editor-item" key={item.id || index}>
						<div className="mini-plan-item-name">
							<input
								aria-label={uiText(language, "planItemName")}
								value={item.name}
								placeholder={uiText(language, "planItemNamePlaceholder")}
								onChange={(event) =>
									updateItems(
										items.map((current, itemIndex) =>
											itemIndex === index
												? { ...current, name: event.target.value }
												: current,
										),
									)
								}
							/>
							{items.length > 1 && (
								<button
									type="button"
									aria-label={uiText(language, "removePlanItem")}
									onClick={() =>
										updateItems(
											items.filter((_, itemIndex) => itemIndex !== index),
										)
									}
								>
									<Trash size={17} />
								</button>
							)}
						</div>
						<div className="mini-plan-item-fields">
							<div className="mini-plan-item-field">
								<span>{uiText(language, "expectedAmount")}</span>
								<AmountInput
									ariaLabel={uiText(language, "expectedAmount")}
									amount={item.expected_amount || 0}
									onChange={(amount) =>
										updateItems(
											items.map((current, itemIndex) =>
												itemIndex === index
													? { ...current, expected_amount: amount || null }
													: current,
											),
										)
									}
								/>
							</div>
							<label>
								<span>{uiText(language, "category")}</span>
								<select
									value={item.category_id || 0}
									onChange={(event) =>
										updateItems(
											items.map((current, itemIndex) =>
												itemIndex === index
													? {
															...current,
															category_id: Number(event.target.value) || null,
														}
													: current,
											),
										)
									}
								>
									<option value={0}>
										{uiText(language, "categoryNotSet")}
									</option>
									{categories.map((category) => (
										<option key={category.id} value={category.id}>
											{localizedCategoryName(category, language)}
										</option>
									))}
								</select>
							</label>
						</div>
					</div>
				))}
				<button
					className="mini-plan-add-item"
					type="button"
					disabled={items.length >= 100}
					onClick={() =>
						updateItems([
							...items,
							{ name: "", expected_amount: null, category_id: null },
						])
					}
				>
					<Plus size={17} weight="bold" />
					{uiText(language, "addPlanItem")}
				</button>
			</div>
			{plan.id > 0 && !fromCandidate && (
				<MoveRecordControl
					language={language}
					targets={moveTargets}
					saving={saving}
					hint={uiText(language, "movePlanHint")}
					cloneHint={uiText(language, "clonePlanHint")}
					onMove={onMove}
				/>
			)}
			<div className="mini-modal-actions">
				<button
					className="mini-save"
					type="button"
					disabled={
						saving ||
						!plan.title.trim() ||
						items.some((item) => !item.name.trim())
					}
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
};

const ExpenseEditor = ({
	expense,
	language,
	categories,
	vendors,
	itemNameSuggestions,
	tagSuggestions,
	creating,
	saving,
	capture,
	sourceLoading,
	moveTargets,
	onChange,
	onClose,
	onSave,
	onSource,
	onMove,
	onDelete,
}: {
	expense: Expense;
	language: UILanguage;
	categories: Category[];
	vendors: Vendor[];
	itemNameSuggestions: string[];
	tagSuggestions: string[];
	creating: boolean;
	saving: boolean;
	capture?: CapturePacket;
	sourceLoading: boolean;
	moveTargets: Space[];
	onChange: (expense: Expense) => void;
	onClose: () => void;
	onSave: () => void;
	onSource: () => void;
	onMove: (spaceID: number, operation: TransferOperation) => void;
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
				<div className="mini-source-access">
					<button
						className="mini-source-open"
						type="button"
						disabled={sourceLoading}
						onClick={onSource}
					>
						<SourceIcon capture={capture} size={18} />
						{sourceLoading ? "Загружаем…" : "Посмотреть исходник"}
					</button>
					<SourceExpiryNote capture={capture} language={language} />
				</div>
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
						{creating && (
							<label className="mini-editor-field" htmlFor="new-expense-amount">
								<span className="mini-editor-label">Сумма</span>
								<AmountInput
									ariaLabel="Сумма"
									amount={item.amount}
									id="new-expense-amount"
									onChange={(amount) =>
										onChange({
											...expense,
											items: expense.items.map((current, itemIndex) =>
												itemIndex === index ? { ...current, amount } : current,
											),
										})
									}
								/>
							</label>
						)}
						<label
							className={
								creating ? "mini-editor-field" : "mini-editor-field--contents"
							}
						>
							{creating && <span className="mini-editor-label">Категория</span>}
							<select
								aria-label="Категория позиции"
								value={item.category_id || 0}
								onChange={(event) =>
									onChange({
										...expense,
										items: expense.items.map((current, itemIndex) =>
											itemIndex === index
												? {
														...current,
														category_id: Number(event.target.value),
													}
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
						</label>
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
				{!creating && (
					<button
						className="mini-plan-add-item"
						type="button"
						disabled={expense.items.length >= 100}
						onClick={() =>
							onChange({
								...expense,
								items: [
									...expense.items,
									{ name: "", amount: 0, category_id: categories[0]?.id },
								],
							})
						}
					>
						<Plus size={17} weight="bold" />
						Добавить позицию
					</button>
				)}
			</div>
			{creating && expense.items[0] && (
				<HashtagNotesInput
					language={language}
					value={expense.items[0].notes || ""}
					suggestions={tagSuggestions}
					onChange={(notes) =>
						onChange({
							...expense,
							items: expense.items.map((item, index) =>
								index === 0
									? {
											...item,
											notes,
											tags: tagsAfterNotesEdit(
												item.tags || [],
												item.notes || "",
												notes,
											),
										}
									: item,
							),
						})
					}
				/>
			)}
			{!creating && (
				<MoveRecordControl
					language={language}
					targets={moveTargets}
					saving={saving}
					hint={uiText(language, "moveExpenseHint")}
					cloneHint={uiText(language, "cloneExpenseHint")}
					onMove={onMove}
				/>
			)}
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
	tagSuggestions,
	saving,
	capture,
	sourceLoading,
	moveTargets,
	onChange,
	onClose,
	onSave,
	onSource,
	onMove,
	onPlanAgain,
	onDelete,
}: {
	expense: Expense;
	language: UILanguage;
	item: ExpenseItem;
	categories: Category[];
	vendors: Vendor[];
	tagSuggestions: string[];
	saving: boolean;
	capture?: CapturePacket;
	sourceLoading: boolean;
	moveTargets: Space[];
	onChange: (item: ExpenseItem) => void;
	onClose: () => void;
	onSave: () => void;
	onSource: () => void;
	onMove: (spaceID: number, operation: TransferOperation) => void;
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
				<div className="mini-source-access">
					<button
						className="mini-source-open"
						type="button"
						disabled={sourceLoading}
						onClick={onSource}
					>
						<SourceIcon capture={capture} size={18} />
						{sourceLoading ? "Загружаем…" : "Посмотреть исходник"}
					</button>
					<SourceExpiryNote capture={capture} language={language} />
				</div>
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
			<HashtagNotesInput
				language={language}
				value={item.notes || ""}
				suggestions={tagSuggestions}
				onChange={(notes) =>
					onChange({
						...item,
						notes,
						tags: tagsAfterNotesEdit(item.tags || [], item.notes || "", notes),
					})
				}
			/>
			<MoveRecordControl
				language={language}
				targets={moveTargets}
				saving={saving}
				hint={uiText(language, "moveExpenseItemHint")}
				cloneHint={uiText(language, "cloneExpenseItemHint")}
				onMove={onMove}
			/>
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
	expenses,
	saving,
	onChange,
	onClose,
	onSave,
	onMerge,
	onDelete,
}: {
	vendor: Vendor;
	vendors: Vendor[];
	expenses: Expense[];
	saving: boolean;
	onChange: (vendor: Vendor) => void;
	onClose: () => void;
	onSave: () => void;
	onMerge: (targetVendorID: number) => void;
	onDelete: () => void;
}) => {
	const [targetVendorID, setTargetVendorID] = useState(0);
	const mergeTargets = vendors.filter((item) => item.id !== vendor.id);
	const purchaseExamples = Array.from(
		new Set(
			[...expenses]
				.sort((left, right) =>
					right.expense_date.localeCompare(left.expense_date),
				)
				.flatMap((expense) =>
					expense.items
						.filter(
							(item) =>
								(item.vendor_id ||
									item.vendor?.id ||
									expense.vendor_id ||
									expense.vendor?.id) === vendor.id,
						)
						.map((item) => item.name.trim())
						.filter(Boolean),
				),
		),
	).slice(0, 3);
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
			{purchaseExamples.length > 0 && (
				<div className="mini-vendor-examples">
					<strong>
						<ShoppingBagOpen size={18} />
						Что покупали здесь
					</strong>
					<ul>
						{purchaseExamples.map((name) => (
							<li key={name}>{name}</li>
						))}
					</ul>
				</div>
			)}
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
	const canDestructivelyChange = category.can_delete !== false;
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
					canDestructivelyChange &&
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
	mode,
	notificationChannel,
	notificationChannelsAvailable,
	saving,
	onChange,
	onNotificationChannelChange,
	onClose,
	onSave,
}: {
	user: User;
	mode: "profile" | "notifications";
	notificationChannel: NotificationChannel | "";
	notificationChannelsAvailable: Record<NotificationChannel, boolean>;
	saving: boolean;
	onChange: (user: User) => void;
	onNotificationChannelChange: (channel: NotificationChannel | "") => void;
	onClose: () => void;
	onSave: () => void;
}) => {
	const language = normalizeUILanguage(user.language);
	return (
		<Modal
			title={uiText(
				language,
				mode === "notifications" ? "notificationSettings" : "profileSettings",
			)}
			closeLabel={uiText(language, "close")}
			onClose={onClose}
		>
			{mode === "profile" && (
				<label>
					{uiText(language, "profileName")}
					<input
						maxLength={120}
						autoComplete="name"
						placeholder={uiText(language, "profileNamePlaceholder")}
						value={user.name}
						onChange={(event) =>
							onChange({ ...user, name: event.target.value })
						}
					/>
				</label>
			)}
			{mode === "profile" && (
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
			)}
			{mode === "profile" && (
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
			)}
			{mode === "profile" && (
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
			)}
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
			{mode === "notifications" && (
				<div className="mini-field">
					<span>{uiText(language, "notificationMethod")}</span>
					<div className="mini-notification-channels">
						<button
							type="button"
							className={notificationChannel === "" ? "active" : ""}
							aria-pressed={notificationChannel === ""}
							onClick={() => onNotificationChannelChange("")}
						>
							<BellSlash size={20} />
							{uiText(language, "notificationsOff")}
						</button>
						{notificationChannelsAvailable.email && (
							<button
								type="button"
								className={notificationChannel === "email" ? "active" : ""}
								aria-pressed={notificationChannel === "email"}
								onClick={() => onNotificationChannelChange("email")}
							>
								<EnvelopeSimple size={20} />
								{uiText(language, "emailChannel")}
							</button>
						)}
						{notificationChannelsAvailable.telegram && (
							<button
								type="button"
								className={notificationChannel === "telegram" ? "active" : ""}
								aria-pressed={notificationChannel === "telegram"}
								onClick={() => onNotificationChannelChange("telegram")}
							>
								<PaperPlaneTilt size={20} />
								{uiText(language, "telegramChannel")}
							</button>
						)}
					</div>
					<small className="mini-modal-note">
						{uiText(language, "notificationMethodHint")}
					</small>
				</div>
			)}
			{mode === "notifications" && notificationChannel && (
				<label>
					{uiText(language, "notificationTime")}
					<input
						type="time"
						step={60}
						value={user.notificationTime || "09:00"}
						onChange={(event) =>
							onChange({ ...user, notificationTime: event.target.value })
						}
					/>
					<small className="mini-modal-note">
						{uiText(language, "notificationTimeHint")}
					</small>
				</label>
			)}
			<button
				className="mini-save"
				type="button"
				disabled={
					saving ||
					(mode === "profile" && !user.name.trim()) ||
					user.currency.length !== 3 ||
					!user.country.trim() ||
					!user.language.trim() ||
					!user.timezone.trim() ||
					(mode === "notifications" &&
						Boolean(notificationChannel) &&
						!user.notificationTime)
				}
				onClick={onSave}
			>
				{uiText(language, saving ? "saving" : "save")}
			</button>
		</Modal>
	);
};

const SpaceInviteDialog = ({
	space,
	token,
	previewMode,
	onClose,
	onNotice,
}: {
	space: Space;
	token: string;
	previewMode: boolean;
	onClose: () => void;
	onNotice: (message: string) => void;
}) => {
	const [email, setEmail] = useState("");
	const [data, setData] = useState<SpaceInviteSuggestions>({
		suggestions: [],
		pending_invites_for_space: [],
	});
	const [loading, setLoading] = useState(true);
	const [submitting, setSubmitting] = useState(false);
	const [busyInviteID, setBusyInviteID] = useState(0);
	const [createdLinkToken, setCreatedLinkToken] = useState("");
	const [error, setError] = useState("");

	const loadSuggestions = async () => {
		if (previewMode) {
			setData({
				suggestions: [
					{
						user_id: 2,
						name: "Анна",
						relationship_label: "Другое пространство",
					},
				],
				pending_invites_for_space: [],
			});
			setLoading(false);
			return;
		}
		setLoading(true);
		try {
			setData(
				await apiRequest<SpaceInviteSuggestions>(
					`/spaces/${space.id}/invite-suggestions`,
					token,
				),
			);
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: "Не удалось загрузить варианты приглашения",
			);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		void loadSuggestions();
	}, [space.id, token, previewMode]);

	const suggestions = availableInviteSuggestions(
		data.suggestions,
		data.pending_invites_for_space,
		email,
	);

	const sendInvite = async (
		rawEmail: string,
		inviteeUserID?: number,
		inviteeName?: string,
	) => {
		const inviteeEmail = rawEmail.trim().toLocaleLowerCase();
		if ((!inviteeEmail && !inviteeUserID) || submitting) return;
		setSubmitting(true);
		setError("");
		try {
			if (previewMode) {
				setData((current) => ({
					...current,
					pending_invites_for_space: [
						{
							id: Date.now(),
							invitee_user_id: inviteeUserID,
							invitee_name: inviteeName,
							invitee_email: inviteeEmail,
							token: `preview-email-${Date.now()}`,
							expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
						},
						...current.pending_invites_for_space,
					],
				}));
			} else {
				await apiRequest(`/spaces/${space.id}/invites`, token, {
					method: "POST",
					body: JSON.stringify(
						inviteeUserID
							? { user_id: inviteeUserID }
							: { email: inviteeEmail },
					),
				});
				await loadSuggestions();
			}
			setEmail("");
			onNotice(
				inviteeName
					? `Приглашение для ${inviteeName} отправлено`
					: `Приглашение отправлено на ${inviteeEmail}`,
			);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Не удалось отправить приглашение",
			);
		} finally {
			setSubmitting(false);
		}
	};

	const submitInvite = async (event: React.FormEvent) => {
		event.preventDefault();
		await sendInvite(email);
	};

	const inviteURL = (inviteToken: string) =>
		`${window.location.origin}/join?token=${encodeURIComponent(inviteToken)}`;

	const copyInvite = async (inviteToken: string) => {
		try {
			await navigator.clipboard.writeText(inviteURL(inviteToken));
			onNotice("Ссылка приглашения скопирована");
		} catch {
			setError("Не удалось скопировать ссылку. Выделите её вручную");
		}
	};

	const shareInvite = async (inviteToken: string) => {
		if (!navigator.share) {
			await copyInvite(inviteToken);
			return;
		}
		try {
			await navigator.share({
				title: `Пространство «${space.name}»`,
				text: `Присоединяйся к пространству «${space.name}» в «Пока не забыл».`,
				url: inviteURL(inviteToken),
			});
		} catch (err) {
			if (err instanceof DOMException && err.name === "AbortError") return;
			setError("Не удалось открыть меню отправки");
		}
	};

	const createLinkInvite = async () => {
		if (submitting) return;
		setSubmitting(true);
		setError("");
		try {
			const invite = previewMode
				? {
						token: `preview-link-${Date.now()}`,
						expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
					}
				: await apiRequest<{ token: string; expires_at: string }>(
						`/spaces/${space.id}/invites`,
						token,
						{
							method: "POST",
							body: JSON.stringify({ channel: "link" }),
						},
					);
			setCreatedLinkToken(invite.token);
			if (previewMode) {
				setData((current) => ({
					...current,
					pending_invites_for_space: [
						{
							id: Date.now(),
							invitee_email: "",
							token: invite.token,
							expires_at: invite.expires_at,
						},
						...current.pending_invites_for_space,
					],
				}));
			} else {
				await loadSuggestions();
			}
			onNotice("Ссылка приглашения готова");
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Не удалось создать ссылку",
			);
		} finally {
			setSubmitting(false);
		}
	};

	const updatePendingInvite = async (
		invite: PendingSpaceInvite,
		action: "resend" | "cancel",
	) => {
		if (previewMode) {
			if (action === "cancel") {
				setData((current) => ({
					...current,
					pending_invites_for_space: current.pending_invites_for_space.filter(
						({ id }) => id !== invite.id,
					),
				}));
			}
			onNotice(
				action === "resend"
					? "Приглашение отправлено снова"
					: "Приглашение отменено",
			);
			return;
		}
		setBusyInviteID(invite.id);
		setError("");
		try {
			await apiRequest(
				`/spaces/${space.id}/invites/${invite.id}${action === "resend" ? "/resend" : ""}`,
				token,
				{ method: action === "resend" ? "POST" : "DELETE" },
			);
			await loadSuggestions();
			onNotice(
				action === "resend"
					? "Приглашение отправлено снова"
					: "Приглашение отменено",
			);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Не удалось обновить приглашение",
			);
		} finally {
			setBusyInviteID(0);
		}
	};

	return (
		<Modal title={`Пригласить в «${space.name}»`} onClose={onClose}>
			<form className="mini-invite-form" onSubmit={submitInvite}>
				<p className="mini-invite-copy">
					Поделитесь ссылкой в любом приложении или отправьте приглашение на
					почту. После входа человек автоматически попадёт в пространство.
				</p>
				<div className="mini-invite-link">
					<span>
						<b>Пригласить по ссылке</b>
						<small>
							Ссылка действует 7 дней. Первый вошедший по ней получит доступ.
						</small>
					</span>
					<button
						type="button"
						disabled={submitting}
						onClick={createLinkInvite}
					>
						<ShareNetwork size={18} weight="bold" />
						Создать ссылку
					</button>
					{createdLinkToken && (
						<div className="mini-invite-share">
							<input readOnly value={inviteURL(createdLinkToken)} />
							<button
								type="button"
								onClick={() => shareInvite(createdLinkToken)}
							>
								<ShareNetwork size={17} />
								Поделиться
							</button>
							<button
								type="button"
								onClick={() => copyInvite(createdLinkToken)}
							>
								<Copy size={17} />
								Копировать
							</button>
						</div>
					)}
				</div>
				{!loading && suggestions.length > 0 && (
					<div className="mini-invite-people">
						<b>Люди из других пространств</b>
						<div>
							{suggestions.map((suggestion) => (
								<article key={suggestion.user_id}>
									<span>
										{(suggestion.name || "У").slice(0, 1).toUpperCase()}
									</span>
									<p>
										<b>{suggestion.name || "Пользователь"}</b>
										<small>
											{suggestion.relationship_label ||
												suggestion.email ||
												"Почта не привязана"}
										</small>
									</p>
									<button
										type="button"
										disabled={submitting}
										onClick={() =>
											void sendInvite(
												suggestion.email || "",
												suggestion.user_id,
												suggestion.name || "Пользователя",
											)
										}
									>
										<PaperPlaneTilt size={15} weight="bold" />
										Пригласить
									</button>
								</article>
							))}
						</div>
					</div>
				)}
				<label>
					Электронная почта
					<input
						type="email"
						inputMode="email"
						autoComplete="email"
						required
						value={email}
						placeholder="name@example.com"
						onChange={(event) => setEmail(event.target.value)}
					/>
				</label>
				{loading && <small className="mini-modal-note">Загружаем…</small>}
				{error && <p className="mini-error">{error}</p>}
				{data.pending_invites_for_space.length > 0 && (
					<div className="mini-invite-pending">
						<b>Ожидают ответа</b>
						{data.pending_invites_for_space.map((invite) => (
							<article key={invite.id}>
								<span>
									<b>
										{invite.invitee_name ||
											invite.invitee_email ||
											"Приглашение по ссылке"}
									</b>
									<small>
										Действует до{" "}
										{new Date(invite.expires_at).toLocaleDateString("ru-RU")}
									</small>
								</span>
								<div>
									{invite.invitee_email || invite.invitee_user_id ? (
										<button
											type="button"
											disabled={busyInviteID === invite.id}
											onClick={() => updatePendingInvite(invite, "resend")}
										>
											<ArrowClockwise size={16} />
											Ещё раз
										</button>
									) : (
										<button
											type="button"
											onClick={() => shareInvite(invite.token)}
										>
											<ShareNetwork size={16} />
											Поделиться
										</button>
									)}
									<button
										type="button"
										aria-label="Отменить приглашение"
										disabled={busyInviteID === invite.id}
										onClick={() => updatePendingInvite(invite, "cancel")}
									>
										<Trash size={16} />
									</button>
								</div>
							</article>
						))}
					</div>
				)}
				<div className="mini-modal-actions">
					<button
						className="mini-save"
						type="submit"
						disabled={loading || submitting || !email.trim()}
					>
						<PaperPlaneTilt size={18} weight="bold" />
						{submitting ? "Отправляем…" : "Отправить приглашение"}
					</button>
					<button className="mini-delete" type="button" onClick={onClose}>
						<ArrowLeft size={18} />
						Назад
					</button>
				</div>
			</form>
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
					<small>
						Пригласите по ссылке, email или из другого пространства.
					</small>
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

const notificationTitle = (type: string, language: UILanguage) => {
	const titles: Record<string, Record<UILanguage, string>> = {
		purchase_plan_due: {
			ru: "Напоминание о покупке",
			en: "Purchase reminder",
			es: "Recordatorio de compra",
		},
		shared_expense_created: {
			ru: "Новый общий расход",
			en: "New shared expense",
			es: "Nuevo gasto compartido",
		},
		space_invite_accepted: {
			ru: "Новый участник пространства",
			en: "New space member",
			es: "Nuevo miembro del espacio",
		},
		space_invite_received: {
			ru: "Приглашение в пространство",
			en: "Space invitation",
			es: "Invitación a un espacio",
		},
		subscription_expiring: {
			ru: "Плюс скоро закончится",
			en: "Plus is ending soon",
			es: "Plus termina pronto",
		},
		subscription_expired: {
			ru: "Подписка закончилась",
			en: "Subscription ended",
			es: "La suscripción terminó",
		},
		capture_review_ready: {
			ru: "Разбор готов",
			en: "Ready to review",
			es: "Listo para revisar",
		},
		capture_processing_failed: {
			ru: "Разбор не выполнен",
			en: "Processing failed",
			es: "Error de procesamiento",
		},
		quota_low: {
			ru: "Разборы скоро закончатся",
			en: "Allowance is running low",
			es: "Quedan pocos análisis",
		},
		quota_exhausted: {
			ru: "Разборы закончились",
			en: "Allowance exhausted",
			es: "Análisis agotados",
		},
		recurring_expense: {
			ru: "Повторяющийся расход",
			en: "Recurring expense",
			es: "Gasto recurrente",
		},
	};
	return titles[type]?.[language] || uiText(language, "notification");
};

const notificationDate = (
	value: string,
	language: UILanguage,
	timezone: string,
) => {
	const options: Intl.DateTimeFormatOptions = {
		day: "numeric",
		month: "short",
		hour: "2-digit",
		minute: "2-digit",
		timeZone: timezone,
	};
	const locale =
		language === "ru" ? "ru-RU" : language === "es" ? "es-ES" : "en-US";
	const date = new Date(value);
	try {
		return new Intl.DateTimeFormat(locale, options).format(date);
	} catch {
		return new Intl.DateTimeFormat(locale, {
			...options,
			timeZone: "UTC",
		}).format(date);
	}
};

const NotificationCenter = ({
	notifications,
	unreadCount,
	loading,
	selected,
	language,
	timezone,
	onSelect,
	onBack,
	onReadAll,
	onDelete,
	onAction,
	onClose,
}: {
	notifications: AppNotification[];
	unreadCount: number;
	loading: boolean;
	selected: AppNotification | null;
	language: UILanguage;
	timezone: string;
	onSelect: (notification: AppNotification) => void;
	onBack: () => void;
	onReadAll: () => void;
	onDelete: (notification: AppNotification) => void;
	onAction: (notification: AppNotification) => void;
	onClose: () => void;
}) => (
	<Modal title={uiText(language, "notifications")} onClose={onClose}>
		{selected ? (
			<div className="notification-detail">
				<button className="notification-back" type="button" onClick={onBack}>
					<ArrowLeft size={17} />
					{uiText(language, "backToNotifications")}
				</button>
				<div className="notification-detail-heading">
					<span className={`notification-kind is-${selected.type}`}>
						<BellRinging size={21} weight="fill" />
					</span>
					<div>
						<h3>{notificationTitle(selected.type, language)}</h3>
						{selected.space_name && (
							<span className="notification-space">
								<UsersThree size={13} />
								{selected.space_name}
							</span>
						)}
						<time>
							{notificationDate(selected.created_at, language, timezone)}
						</time>
					</div>
				</div>
				<p>{selected.message}</p>
				<div className="notification-detail-actions">
					{(selected.action_url || selected.space_id) && (
						<button
							className="mini-save"
							type="button"
							onClick={() => onAction(selected)}
						>
							{uiText(
								language,
								selected.type === "space_invite_received"
									? "acceptInvitation"
									: "openNotification",
							)}
						</button>
					)}
					<button
						className="mini-delete"
						type="button"
						onClick={() => onDelete(selected)}
					>
						<Trash size={18} />
						{uiText(language, "deleteNotification")}
					</button>
				</div>
			</div>
		) : (
			<div className="notification-inbox">
				{unreadCount > 0 && (
					<div className="notification-toolbar">
						<span>
							{uiText(language, "unreadNotifications").replace(
								"{count}",
								String(unreadCount),
							)}
						</span>
						<button type="button" onClick={onReadAll}>
							<Check size={16} weight="bold" />
							{uiText(language, "markAllRead")}
						</button>
					</div>
				)}
				{loading && notifications.length === 0 ? (
					<LoadingRows />
				) : notifications.length === 0 ? (
					<div className="notification-empty">
						<BellRinging size={30} />
						<strong>{uiText(language, "noNotifications")}</strong>
						<small>{uiText(language, "noNotificationsHint")}</small>
					</div>
				) : (
					<div className="notification-list">
						{notifications.map((notification) => (
							<article
								key={notification.id}
								className={notification.read_at ? "" : "is-unread"}
							>
								<button
									className="notification-open"
									type="button"
									onClick={() => onSelect(notification)}
								>
									<span className={`notification-kind is-${notification.type}`}>
										<BellRinging size={19} weight="fill" />
									</span>
									<span>
										<strong>
											{notificationTitle(notification.type, language)}
										</strong>
										{notification.space_name && (
											<span className="notification-space">
												<UsersThree size={12} />
												{notification.space_name}
											</span>
										)}
										<small>{notification.message}</small>
										<time>
											{notificationDate(
												notification.created_at,
												language,
												timezone,
											)}
										</time>
									</span>
								</button>
								<button
									className="notification-delete"
									type="button"
									aria-label={uiText(language, "deleteNotification")}
									onClick={() => onDelete(notification)}
								>
									<Trash size={17} />
								</button>
							</article>
						))}
					</div>
				)}
			</div>
		)}
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

const InstallGuide = ({ onClose }: { onClose: () => void }) => {
	const platform = homeScreenPlatform(navigator.userAgent);
	const steps =
		platform === "ios"
			? [
					"Откройте эту страницу в Safari.",
					"Нажмите «Поделиться» в панели браузера.",
					"Выберите «На экран Домой», затем «Добавить».",
				]
			: platform === "android"
				? [
						"Откройте меню браузера ⋮.",
						"Выберите «Установить приложение» или «Добавить на главный экран».",
						"Подтвердите установку.",
					]
				: [
						"Откройте меню браузера.",
						"Выберите «Установить Пока не забыл».",
						"Подтвердите установку приложения.",
					];
	return (
		<Modal title="Добавить на главный экран" onClose={onClose}>
			<div className="install-guide">
				<House size={34} weight="fill" />
				<p>
					Приложение откроется отдельным окном и будет доступно как обычная
					иконка.
				</p>
				<ol>
					{steps.map((step) => (
						<li key={step}>{step}</li>
					))}
				</ol>
			</div>
			<button
				className="mini-save install-guide-done"
				type="button"
				onClick={onClose}
			>
				Понятно
			</button>
		</Modal>
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
const LoadingCancelButton = ({ onClick }: { onClick: () => void }) => (
	<button className="mini-loading-cancel" type="button" onClick={onClick}>
		<ArrowLeft size={17} />
		Вернуться
	</button>
);
const OpeningOverlay = ({
	label,
	onCancel,
}: {
	label: string;
	onCancel: () => void;
}) => (
	<div className="mini-opening-overlay" role="status" aria-live="assertive">
		<KnotLoader />
		<strong>{label}</strong>
		<LoadingCancelButton onClick={onCancel} />
	</div>
);
const LoadingScreen = ({
	label,
	onCancel,
}: { label?: string; onCancel?: () => void } = {}) => {
	const language = normalizeUILanguage(
		WebApp.initDataUnsafe.user?.language_code,
	);
	return (
		<div className="mini-loading">
			<KnotLoader />
			<span>{label || uiText(language, "loadingExpenses")}</span>
			{onCancel && <LoadingCancelButton onClick={onCancel} />}
		</div>
	);
};
const ServiceUnavailable = ({
	language,
	onRetry,
}: {
	language: UILanguage;
	onRetry: () => void;
}) => (
	<main className="app-recovery mini-service-unavailable" role="status">
		<KnotLoader />
		<p>{uiText(language, "servicePause")}</p>
		<h1>{uiText(language, "serviceUnavailableTitle")}</h1>
		<span>{uiText(language, "serviceUnavailableText")}</span>
		<div>
			<button type="button" onClick={onRetry}>
				<ArrowClockwise size={18} weight="bold" />
				{uiText(language, "checkAgain")}
			</button>
		</div>
	</main>
);
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
const AUTH_CODE_TTL_MS = 10 * 60 * 1000;
const AUTH_CODE_RESEND_MS = 60 * 1000;
const formatCountdown = (seconds: number) =>
	`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

const BrowserEntry = ({
	error,
	homeScreenStatus,
	browserInstallAvailable,
	installGuideOpen,
	onInstall,
	onCloseInstallGuide,
	onTelegramAuth,
	onEmailAuth,
}: {
	error: string;
	homeScreenStatus: HomeScreenStatus;
	browserInstallAvailable: boolean;
	installGuideOpen: boolean;
	onInstall: () => Promise<void>;
	onCloseInstallGuide: () => void;
	onTelegramAuth: (user: TelegramWidgetUser) => Promise<void>;
	onEmailAuth: (auth: AuthResponse) => Promise<void>;
}) => {
	const [region, setRegion] = useState<"ru" | "outside">("ru");
	const [method, setMethod] = useState<"phone" | "email" | "telegram">("phone");
	const [authMode, setAuthMode] = useState<"login" | "register">("register");
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [phone, setPhone] = useState("");
	const [code, setCode] = useState("");
	const [codeSent, setCodeSent] = useState(false);
	const [clockTime, setClockTime] = useState(0);
	const [codeExpiresAt, setCodeExpiresAt] = useState(0);
	const [resendAvailableAt, setResendAvailableAt] = useState(0);
	const [loading, setLoading] = useState(false);
	const [localError, setLocalError] = useState("");
	const [personalDataConsent, setPersonalDataConsent] = useState(false);
	const [clipboardHint, setClipboardHint] = useState("");

	useEffect(() => {
		if (!codeSent) return;
		setClockTime(Date.now());
		const timer = window.setInterval(() => setClockTime(Date.now()), 1000);
		return () => window.clearInterval(timer);
	}, [codeSent]);

	const codeSecondsLeft = Math.max(
		0,
		Math.ceil((codeExpiresAt - clockTime) / 1000),
	);
	const resendSeconds = Math.max(
		0,
		Math.ceil((resendAvailableAt - clockTime) / 1000),
	);
	const codeExpired = codeSent && codeSecondsLeft === 0;
	const codeTimeLeft = formatCountdown(codeSecondsLeft);

	const resetCodeStep = () => {
		setCodeSent(false);
		setCode("");
		setCodeExpiresAt(0);
		setResendAvailableAt(0);
		setClipboardHint("");
		setLocalError("");
	};
	const changeRegion = (nextRegion: "ru" | "outside") => {
		setRegion(nextRegion);
		setMethod(nextRegion === "ru" ? "phone" : "email");
		resetCodeStep();
	};
	const changeMethod = (nextMethod: "phone" | "email" | "telegram") => {
		setMethod(nextMethod);
		resetCodeStep();
	};
	const isPhone = method === "phone";
	const contact = isPhone ? phone.trim() : email.trim();
	const phoneDigits = phone.replace(/\D/g, "");
	const validPhone =
		phoneDigits.length === 10 ||
		(phoneDigits.length === 11 && /^[78]/.test(phoneDigits));

	const requestCode = async () => {
		setLoading(true);
		setLocalError("");
		try {
			await apiRequest(
				`/auth/${isPhone ? "phone" : "email"}/${authMode}/request`,
				"",
				{
					method: "POST",
					body: JSON.stringify({
						name: name.trim(),
						...(isPhone ? { phone: phone.trim() } : { email: email.trim() }),
						personal_data_consent: personalDataConsent,
					}),
				},
			);
			const now = Date.now();
			setCodeSent(true);
			setClockTime(now);
			setCodeExpiresAt(now + AUTH_CODE_TTL_MS);
			setResendAvailableAt(now + AUTH_CODE_RESEND_MS);
			setCode("");
			setClipboardHint("");
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
				`/auth/${isPhone ? "phone" : "email"}/${authMode}/confirm`,
				"",
				{
					method: "POST",
					body: JSON.stringify({
						name: name.trim(),
						...(isPhone ? { phone: phone.trim() } : { email: email.trim() }),
						code: code.trim(),
						country: "RU",
						language: navigator.language.split("-")[0] || "ru",
						timezone:
							Intl.DateTimeFormat().resolvedOptions().timeZone ||
							"Europe/Moscow",
						currency: "RUB",
						personal_data_consent: personalDataConsent,
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

	const pasteCode = async () => {
		setClipboardHint("");
		try {
			const clipboardCode = (await navigator.clipboard.readText())
				.replace(/\D/g, "")
				.slice(0, 6);
			if (clipboardCode.length !== 6) {
				setClipboardHint("В буфере нет кода из 6 цифр");
				return;
			}
			setCode(clipboardCode);
			setClipboardHint("Код вставлен");
		} catch {
			setClipboardHint("Зажмите поле и выберите «Вставить»");
		}
	};

	return (
		<main
			className="mini-entry mini-browser-entry"
			data-enter-navigation
			onKeyDown={focusNextFieldOnEnter}
		>
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
				{!codeSent && (
					<>
						<div className="browser-region-picker">
							<span>Где вы сейчас находитесь?</span>
							<div role="group" aria-label="Местоположение">
								<button
									type="button"
									className={region === "ru" ? "active" : ""}
									onClick={() => changeRegion("ru")}
								>
									В России
								</button>
								<button
									type="button"
									className={region === "outside" ? "active" : ""}
									onClick={() => changeRegion("outside")}
								>
									За пределами
								</button>
							</div>
						</div>
						<div
							className="browser-auth-tabs"
							role="tablist"
							aria-label="Способ входа"
						>
							{region === "ru" && (
								<button
									type="button"
									className={method === "phone" ? "active" : ""}
									onClick={() => changeMethod("phone")}
								>
									Телефон
								</button>
							)}
							<button
								type="button"
								className={method === "email" ? "active" : ""}
								onClick={() => changeMethod("email")}
							>
								Почта
							</button>
							{region === "outside" && (
								<button
									type="button"
									className={method === "telegram" ? "active" : ""}
									onClick={() => changeMethod("telegram")}
								>
									Telegram
								</button>
							)}
						</div>
					</>
				)}
				{method === "telegram" ? (
					<div className="browser-telegram-auth">
						<TelegramLoginButton onAuth={onTelegramAuth} />
						<small>Доступно пользователям за пределами России</small>
					</div>
				) : (
					<div className="browser-email-auth">
						{codeSent ? (
							<div className="browser-code-step">
								<div className="browser-code-heading">
									<span className="browser-code-icon" aria-hidden="true">
										<PaperPlaneTilt size={22} weight="fill" />
									</span>
									<div>
										<strong>
											Введите код {isPhone ? "из SMS" : "из письма"}
										</strong>
										<small>
											Отправили на{" "}
											<span className="browser-code-email">{contact}</span>
										</small>
									</div>
								</div>
								<label className="browser-code-field">
									<span>Код из 6 цифр</span>
									<div className="browser-otp-field">
										<input
											className="browser-code-input"
											type="text"
											inputMode="numeric"
											autoComplete="one-time-code"
											maxLength={6}
											value={code}
											onChange={(event) => {
												setCode(event.target.value.replace(/\D/g, ""));
												setClipboardHint("");
											}}
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
								<div
									className={`browser-code-timer${codeExpired ? " expired" : ""}`}
									aria-live="polite"
								>
									{codeExpired
										? "Срок действия кода истёк. Отправьте новый."
										: `Код действует ещё ${codeTimeLeft}`}
								</div>
								{clipboardHint && (
									<small className="browser-clipboard-hint">
										{clipboardHint}
									</small>
								)}
								<button
									className="browser-primary-action"
									type="button"
									disabled={loading || code.length !== 6 || codeExpired}
									onClick={confirmCode}
								>
									{loading
										? "Проверяем…"
										: authMode === "register"
											? "Создать аккаунт"
											: "Войти"}
								</button>
								<div className="browser-code-actions">
									{typeof navigator !== "undefined" && navigator.clipboard && (
										<button
											className="browser-auth-link"
											type="button"
											onClick={() => void pasteCode()}
										>
											Вставить код
										</button>
									)}
									<button
										className="browser-auth-link browser-resend-code"
										type="button"
										disabled={loading || resendSeconds > 0}
										onClick={requestCode}
									>
										{resendSeconds > 0
											? `Снова через ${formatCountdown(resendSeconds)}`
											: "Отправить снова"}
									</button>
								</div>
								<button
									className="browser-auth-link browser-change-email"
									type="button"
									onClick={resetCodeStep}
								>
									{isPhone ? "Изменить номер" : "Изменить почту"}
								</button>
								<small className="browser-code-help">
									{isPhone
										? "SMS обычно приходит в течение минуты."
										: "Не нашли письмо? Проверьте папку «Спам»."}
								</small>
							</div>
						) : (
							<>
								<div
									className="browser-email-modes"
									aria-label="Действие с почтой"
								>
									<button
										type="button"
										className={authMode === "login" ? "active" : ""}
										onClick={() => {
											setAuthMode("login");
											resetCodeStep();
											setPersonalDataConsent(false);
										}}
									>
										Войти
									</button>
									<button
										type="button"
										className={authMode === "register" ? "active" : ""}
										onClick={() => {
											setAuthMode("register");
											resetCodeStep();
											setPersonalDataConsent(false);
										}}
									>
										Регистрация
									</button>
								</div>
								{authMode === "register" && (
									<label>
										Имя
										<input
											type="text"
											autoComplete="name"
											value={name}
											onChange={(event) => setName(event.target.value)}
											placeholder="Как к вам обращаться"
										/>
									</label>
								)}
								<label>
									{isPhone ? "Телефон" : "Почта"}
									<input
										type={isPhone ? "tel" : "email"}
										autoComplete={isPhone ? "tel" : "email"}
										inputMode={isPhone ? "tel" : "email"}
										value={isPhone ? phone : email}
										onChange={(event) =>
											isPhone
												? setPhone(event.target.value)
												: setEmail(event.target.value)
										}
										placeholder={
											isPhone ? "+7 999 123-45-67" : "name@example.com"
										}
									/>
								</label>
								{authMode === "register" && (
									<label className="browser-consent">
										<input
											type="checkbox"
											checked={personalDataConsent}
											onChange={(event) =>
												setPersonalDataConsent(event.target.checked)
											}
										/>
										<span>
											Даю отдельное{" "}
											<a href="/consent" target="_blank" rel="noreferrer">
												согласие на обработку персональных данных
											</a>
										</span>
									</label>
								)}
								<button
									className="browser-primary-action"
									type="button"
									disabled={
										loading ||
										(isPhone ? !validPhone : !email.includes("@")) ||
										(authMode === "register" && !name.trim()) ||
										(authMode === "register" && !personalDataConsent)
									}
									onClick={requestCode}
								>
									{loading ? "Отправляем…" : "Получить код"}
								</button>
								<small>
									{authMode === "register"
										? `Пароль не нужен — вход подтверждается кодом ${isPhone ? "из SMS" : "из письма"}.`
										: `Введите ${isPhone ? "номер" : "почту"}, указанные при регистрации или в профиле.`}
								</small>
							</>
						)}
					</div>
				)}
				{localError || error ? (
					<p className="mini-entry-error">{localError || error}</p>
				) : null}
				{!codeSent && (
					<div className="browser-legal">
						<a href="/offer" target="_blank" rel="noreferrer">
							Оферта
						</a>
						<a href="/privacy" target="_blank" rel="noreferrer">
							Конфиденциальность
						</a>
						<a href="/consent" target="_blank" rel="noreferrer">
							Обработка данных
						</a>
						<a href="/refunds" target="_blank" rel="noreferrer">
							Возвраты
						</a>
					</div>
				)}
				{!codeSent && homeScreenStatus === "unknown" && (
					<div className="browser-install-card">
						<House size={22} weight="fill" />
						<div>
							<strong>Добавьте приложение на экран</strong>
							<small>Открывайте расходы одним касанием.</small>
						</div>
						<button type="button" onClick={() => void onInstall()}>
							{browserInstallAvailable ? "Установить" : "Инструкция"}
						</button>
					</div>
				)}
			</section>
			{installGuideOpen && <InstallGuide onClose={onCloseInstallGuide} />}
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
const formatMediaExpiry = (value: string, language: UILanguage) =>
	new Intl.DateTimeFormat(language, {
		day: "numeric",
		month: "long",
		hour: "2-digit",
		minute: "2-digit",
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
