import {
	ChartDonut,
	Check,
	GearSix,
	House,
	MagnifyingGlass,
	NotePencil,
	PencilSimple,
	Plus,
	Receipt,
	Tag,
	Trash,
	UserCircle,
	UsersThree,
	X,
} from "@phosphor-icons/react";
import WebApp from "@twa-dev/sdk";
import { useEffect, useMemo, useRef, useState } from "react";
import "./mini-app.css";
import {
	expenseAmountInCurrency,
	expenseDisplayMoney,
	itemAmountInCurrency,
} from "./money";

type View = "overview" | "expenses" | "categories" | "spaces" | "profile";
type Period = "month" | "three-months" | "year" | "all";

type Space = {
	id: number;
	tenant_id: number;
	owner_user_id: number;
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
};

type ExpenseItem = {
	id?: number;
	name: string;
	amount: number;
	source_amount?: number;
	source_currency?: string;
	space_amount?: number;
	space_currency?: string;
	category_id?: number;
	category_name?: string;
	category?: { id: number; name: string };
	notes?: string;
};

type Expense = {
	id: number;
	user_id: number;
	title: string;
	payee_text?: string;
	expense_date: string;
	amount?: number;
	total?: number;
	space_total?: number;
	currency: string;
	source_currency?: string;
	space_currency?: string;
	items: ExpenseItem[];
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

const BOT_URL = "https://t.me/poka_ne_zabyl_bot";
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

const initialView = (): View => {
	const requested = new URLSearchParams(window.location.search).get("view");
	return requested === "expenses" ||
		requested === "categories" ||
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
	const [categories, setCategories] = useState<Category[]>([]);
	const [quota, setQuota] = useState<Quota | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const [period, setPeriod] = useState<Period>("month");
	const [categoryID, setCategoryID] = useState(0);
	const [query, setQuery] = useState("");
	const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
	const [editingCategory, setEditingCategory] = useState<Category | null>(null);
	const [editingProfile, setEditingProfile] = useState<User | null>(null);
	const [editingSpace, setEditingSpace] = useState<Space | null>(null);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		document.body.classList.add("mini-body");
		return () => document.body.classList.remove("mini-body");
	}, []);

	useEffect(() => {
		if (started.current) return;
		started.current = true;
		WebApp.ready();
		WebApp.expand();
		WebApp.setHeaderColor("#f4f1ea");
		WebApp.setBackgroundColor("#f4f1ea");
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
			setCategories(previewCategories);
			setQuota({ plan: "basic", limit: 100, used: 37, remaining: 63 });
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
			setSpaceID(availableSpaces[0]?.id || 0);
			if (availableSpaces.length === 0)
				setError("Сначала создайте пространство в боте.");
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
	}, [token, spaceID]);

	const loadSpace = async () => {
		if (previewMode) return;
		setLoading(true);
		setError("");
		try {
			// ponytail: the latest 200 records cover launch usage; add server filters when this ceiling becomes visible.
			const [expenseData, categoryData, quotaData, memberData] =
				await Promise.all([
					apiRequest<{ expenses: Expense[] }>(
						`/spaces/${spaceID}/expenses?limit=200`,
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
				]);
			setExpenses(expenseData.expenses || []);
			setCategories(categoryData.categories || []);
			setQuota(quotaData);
			setMembers(memberData.members || []);
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

	const filteredExpenses = useMemo(() => {
		const normalizedQuery = query.trim().toLocaleLowerCase("ru");
		const start = periodStart(period);
		return expenses.filter((expense) => {
			const date = new Date(`${expense.expense_date}T00:00:00`);
			const categoryMatches =
				categoryID === 0 ||
				expense.items.some((item) => item.category_id === categoryID);
			const text = [
				expense.title,
				expense.payee_text,
				...expense.items.map((item) => item.name),
			]
				.filter(Boolean)
				.join(" ")
				.toLocaleLowerCase("ru");
			return (
				(!start || date >= start) &&
				categoryMatches &&
				(!normalizedQuery || text.includes(normalizedQuery))
			);
		});
	}, [expenses, period, categoryID, query]);

	const activeSpace = spaces.find((space) => space.id === spaceID);
	const currency = user?.currency || activeSpace?.currency || "RUB";
	const total = filteredExpenses.reduce(
		(sum, expense) => sum + (expenseAmountInCurrency(expense, currency) ?? 0),
		0,
	);
	const categoryTotals = useMemo(() => {
		const totals = new Map<number, number>();
		for (const expense of filteredExpenses) {
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
	}, [categories, filteredExpenses, currency]);
	const categoriesWithTotals = useMemo(() => {
		const totals = new Map<number, number>();
		for (const expense of expenses) {
			for (const item of expense.items) {
				if (!item.category_id) continue;
				totals.set(
					item.category_id,
					(totals.get(item.category_id) || 0) +
						(itemAmountInCurrency(item, expense, currency) ?? 0),
				);
			}
		}
		return categories.map((category) => ({
			...category,
			total: totals.get(category.id) || 0,
		}));
	}, [categories, expenses, currency]);

	const openCategory = (id: number) => {
		setCategoryID(id);
		setView("expenses");
	};

	const saveExpense = async () => {
		if (!editingExpense) return;
		const creating = editingExpense.id === 0;
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
			setNotice(creating ? "Расход добавлен" : "Расход сохранён");
			return;
		}
		setSaving(true);
		try {
			if (creating) {
				const captured = await apiRequest<CaptureResponse>("/capture", token, {
					method: "POST",
					body: JSON.stringify({
						input_kind: "manual",
						space_id: spaceID,
						description: editingExpense.title,
						items: editingExpense.items.map((item) => ({
							name: item.name,
							amount: Number(item.amount),
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
				await apiRequest(
					`/spaces/${spaceID}/review/candidates/${candidate.id}/create-expense`,
					token,
					{ method: "POST", body: "{}" },
				);
			} else {
				await apiRequest(
					`/spaces/${spaceID}/expenses/${editingExpense.id}`,
					token,
					{
						method: "PUT",
						body: JSON.stringify({
							title: editingExpense.title,
							payee_text: editingExpense.payee_text || "",
							expense_date: editingExpense.expense_date,
							items: editingExpense.items.map((item) => ({
								name: item.name,
								amount: Number(item.amount),
								category_id: item.category_id,
								notes: item.notes || "",
							})),
						}),
					},
				);
			}
			setEditingExpense(null);
			setNotice(creating ? "Расход добавлен" : "Расход сохранён");
			await loadSpace();
		} catch (err) {
			setNotice(
				err instanceof Error ? err.message : "Не удалось сохранить расход",
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
			await apiRequest(
				creating
					? `/spaces/${spaceID}/categories`
					: `/spaces/${spaceID}/categories/${editingCategory.id}`,
				token,
				{
					method: creating ? "POST" : "PUT",
					body: JSON.stringify({ name: editingCategory.name }),
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
		if (previewMode) {
			setSpaces((current) =>
				current.map((space) =>
					space.id === editingSpace.id ? editingSpace : space,
				),
			);
			setEditingSpace(null);
			setNotice("Пространство сохранено");
			return;
		}
		setSaving(true);
		try {
			const saved = await apiRequest<Space>(
				`/spaces/${editingSpace.id}`,
				token,
				{
					method: "PATCH",
					body: JSON.stringify({
						name: editingSpace.name,
						...(editingSpace.owner_user_id === user?.id
							? { currency: editingSpace.currency }
							: {}),
					}),
				},
			);
			setSpaces((current) =>
				current.map((space) => (space.id === saved.id ? saved : space)),
			);
			setEditingSpace(null);
			setNotice("Пространство сохранено");
			await loadSpace();
		} catch (err) {
			setNotice(
				err instanceof Error
					? err.message
					: "Не удалось сохранить пространство",
			);
		} finally {
			setSaving(false);
		}
	};

	const addExpense = () => {
		const category =
			categories.find((item) => item.key === "other") || categories[0];
		setEditingExpense({
			id: 0,
			user_id: user?.id || 0,
			title: "",
			payee_text: "",
			expense_date: new Date().toISOString().slice(0, 10),
			currency,
			space_currency: currency,
			items: [{ name: "", amount: 0, category_id: category?.id }],
		});
	};

	if (loading && !token) return <LoadingScreen />;
	if (error && !token) return <TelegramEntry error={error} />;

	return (
		<div className="mini-app">
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
								total={total}
								currency={currency}
								categories={categoryTotals}
								expenses={filteredExpenses}
								onCategory={openCategory}
								onExpenses={() => setView("expenses")}
							/>
						)}
						{view === "expenses" && (
							<ExpensesView
								expenses={filteredExpenses}
								categories={categories}
								currency={currency}
								period={period}
								categoryID={categoryID}
								query={query}
								onPeriod={setPeriod}
								onCategory={setCategoryID}
								onQuery={setQuery}
								onEdit={setEditingExpense}
								onAdd={addExpense}
							/>
						)}
						{view === "categories" && (
							<CategoriesView
								categories={categoriesWithTotals}
								currency={currency}
								onOpen={openCategory}
								onEdit={(category) => setEditingCategory({ ...category })}
								onAdd={() =>
									setEditingCategory({
										id: 0,
										key: "",
										name: "",
										count: 0,
										total: 0,
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
							/>
						)}
						{view === "profile" && (
							<ProfileView
								user={user}
								quota={quota}
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
					onClick={() => setView("expenses")}
				/>
				<NavButton
					active={view === "categories"}
					label="Категории"
					icon={<Tag />}
					onClick={() => setView("categories")}
				/>
				<NavButton
					active={view === "profile"}
					label="Профиль"
					icon={<UserCircle />}
					onClick={() => setView("profile")}
				/>
			</nav>

			{editingExpense && (
				<ExpenseEditor
					expense={editingExpense}
					categories={categories}
					creating={editingExpense.id === 0}
					saving={saving}
					onChange={setEditingExpense}
					onClose={() => setEditingExpense(null)}
					onSave={saveExpense}
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
				/>
			)}
		</div>
	);
};

const Overview = ({
	user,
	total,
	currency,
	categories,
	expenses,
	onCategory,
	onExpenses,
}: {
	user: User | null;
	total: number;
	currency: string;
	categories: Array<Category & { filteredTotal: number }>;
	expenses: Expense[];
	onCategory: (id: number) => void;
	onExpenses: () => void;
}) => {
	const max = categories[0]?.filteredTotal || 1;
	return (
		<section className="mini-view">
			<div className="mini-title">
				<p>Привет{user?.name ? `, ${user.name.split(" ")[0]}` : ""}</p>
				<h1>Расходы за месяц</h1>
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
					<Empty text="В этом месяце пока нет расходов" />
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
				currency={currency}
				onEdit={() => onExpenses()}
			/>
		</section>
	);
};

const ExpensesView = ({
	expenses,
	categories,
	currency,
	period,
	categoryID,
	query,
	onPeriod,
	onCategory,
	onQuery,
	onEdit,
	onAdd,
}: {
	expenses: Expense[];
	categories: Category[];
	currency: string;
	period: Period;
	categoryID: number;
	query: string;
	onPeriod: (period: Period) => void;
	onCategory: (id: number) => void;
	onQuery: (value: string) => void;
	onEdit: (expense: Expense) => void;
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
		<div className="mini-result">
			<div>
				<small>Найдено</small>
				<span>
					{expenses.length} {expenseWord(expenses.length)}
				</span>
			</div>
			<div>
				<small>Итого</small>
				<strong>
					{formatMoney(
						expenses.reduce(
							(sum, expense) =>
								sum + (expenseAmountInCurrency(expense, currency) ?? 0),
							0,
						),
						currency,
					)}
				</strong>
			</div>
		</div>
		<div className="mini-filters">
			<select
				aria-label="Период"
				value={period}
				onChange={(event) => onPeriod(event.target.value as Period)}
			>
				<option value="month">Этот месяц</option>
				<option value="three-months">3 месяца</option>
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
		</div>
		<ExpenseList expenses={expenses} currency={currency} onEdit={onEdit} />
	</section>
);

const ExpenseList = ({
	expenses,
	currency,
	onEdit,
}: {
	expenses: Expense[];
	currency: string;
	onEdit: (expense: Expense) => void;
}) => (
	<div className="mini-expenses">
		{expenses.map((expense) => {
			const money = expenseDisplayMoney(expense, currency);
			return (
				<button key={expense.id} type="button" onClick={() => onEdit(expense)}>
					<span className="mini-expense-icon">
						<Receipt size={19} />
					</span>
					<span className="mini-expense-copy">
						<b>{expense.payee_text || expense.title || "Расход"}</b>
						<small>
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
		<p className="mini-intro">
			Сначала идут категории, которыми вы пользовались недавно.
		</p>
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
								{category.last_used
									? `Последний расход ${formatDate(category.last_used)}`
									: "Пока не использовалась"}
							</small>
						</span>
						<em>{formatMoney(category.total, currency)}</em>
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

const SpacesView = ({
	spaces,
	activeSpaceID,
	members,
	onSelect,
	onEdit,
}: {
	spaces: Space[];
	activeSpaceID: number;
	members: SpaceMember[];
	onSelect: (id: number) => void;
	onEdit: (space: Space) => void;
}) => {
	const activeSpace = spaces.find((space) => space.id === activeSpaceID);
	return (
		<section className="mini-view">
			<div className="mini-title">
				<p>Личные и общие</p>
				<h1>Пространства</h1>
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
			<div className="mini-section-head">
				<h2>{activeSpace?.name || "Участники"}</h2>
				<span>{members.length}</span>
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
	onEdit,
	onUnavailable,
}: {
	user: User | null;
	quota: Quota | null;
	onEdit: () => void;
	onUnavailable: () => void;
}) => {
	const used = quota?.used || 0;
	const limit = quota?.limit || 0;
	const progress = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
	const plus = ["medium", "plus"].includes(quota?.plan || "");
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
					<b>{user?.country || "RU"}</b>
				</div>
				<div>
					<span>Часовой пояс</span>
					<b>{user?.timezone || "Europe/Moscow"}</b>
				</div>
			</div>
		</section>
	);
};

const ExpenseEditor = ({
	expense,
	categories,
	creating,
	saving,
	onChange,
	onClose,
	onSave,
}: {
	expense: Expense;
	categories: Category[];
	creating: boolean;
	saving: boolean;
	onChange: (expense: Expense) => void;
	onClose: () => void;
	onSave: () => void;
}) => (
	<Modal
		title={creating ? "Новый расход" : "Редактировать расход"}
		onClose={onClose}
	>
		<label>
			{creating ? "На что потратили" : "Название"}
			<input
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
		</label>
		{!creating && (
			<>
				<label>
					Магазин
					<input
						value={expense.payee_text || ""}
						onChange={(event) =>
							onChange({ ...expense, payee_text: event.target.value })
						}
					/>
				</label>
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
			</>
		)}
		<div className="mini-editor-items">
			<span>{creating ? "Сумма и категория" : "Позиции"}</span>
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
					<input
						aria-label="Сумма позиции"
						type="number"
						min="0"
						step="0.01"
						value={item.amount}
						onChange={(event) =>
							onChange({
								...expense,
								items: expense.items.map((current, itemIndex) =>
									itemIndex === index
										? { ...current, amount: Number(event.target.value) }
										: current,
								),
							})
						}
					/>
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
				</div>
			))}
		</div>
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
	</Modal>
);

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
		<div className="mini-modal-actions">
			<button
				className="mini-save"
				type="button"
				disabled={saving || !category.name.trim()}
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
			<input
				list="currency-codes"
				maxLength={3}
				value={user.currency}
				onChange={(event) =>
					onChange({ ...user, currency: event.target.value.toUpperCase() })
				}
			/>
		</label>
		<label>
			Страна
			<input
				list="country-codes"
				maxLength={2}
				value={user.country}
				onChange={(event) =>
					onChange({ ...user, country: event.target.value.toUpperCase() })
				}
			/>
		</label>
		<label>
			Часовой пояс
			<input
				list="timezone-codes"
				value={user.timezone}
				onChange={(event) =>
					onChange({ ...user, timezone: event.target.value })
				}
			/>
		</label>
		<ProfileOptions />
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
}: {
	space: Space;
	canEditCurrency: boolean;
	saving: boolean;
	onChange: (space: Space) => void;
	onClose: () => void;
	onSave: () => void;
}) => (
	<Modal title="Настройки пространства" onClose={onClose}>
		<label>
			Название
			<input
				maxLength={120}
				value={space.name}
				onChange={(event) => onChange({ ...space, name: event.target.value })}
			/>
		</label>
		<label>
			Валюта пространства
			<input
				disabled={!canEditCurrency}
				list="currency-codes"
				maxLength={3}
				value={space.currency}
				onChange={(event) =>
					onChange({ ...space, currency: event.target.value.toUpperCase() })
				}
			/>
		</label>
		<ProfileOptions />
		<p className="mini-field-note">
			{canEditCurrency
				? "После первого расхода валюта пространства фиксируется."
				: "Валюту может менять только владелец пространства."}
		</p>
		<button
			className="mini-save"
			type="button"
			disabled={
				saving || !space.name.trim() || space.currency.trim().length !== 3
			}
			onClick={onSave}
		>
			{saving ? "Сохраняем…" : "Сохранить"}
		</button>
	</Modal>
);

const ProfileOptions = () => (
	<>
		<datalist id="currency-codes">
			<option value="RUB" />
			<option value="USD" />
			<option value="EUR" />
			<option value="KZT" />
			<option value="THB" />
		</datalist>
		<datalist id="country-codes">
			<option value="RU" />
			<option value="KZ" />
			<option value="TH" />
			<option value="GE" />
			<option value="TR" />
		</datalist>
		<datalist id="timezone-codes">
			<option value="Europe/Moscow" />
			<option value="Asia/Tomsk" />
			<option value="Asia/Novosibirsk" />
			<option value="Asia/Yekaterinburg" />
			<option value="Asia/Almaty" />
			<option value="Asia/Bangkok" />
		</datalist>
	</>
);

const Modal = ({
	title,
	children,
	onClose,
}: { title: string; children: React.ReactNode; onClose: () => void }) => (
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
	if (period === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
	if (period === "three-months")
		return new Date(now.getFullYear(), now.getMonth() - 2, 1);
	return new Date(now.getFullYear(), 0, 1);
};

const formatMoney = (amount: number, currency: string) =>
	new Intl.NumberFormat("ru-RU", {
		style: "currency",
		currency: currency || "RUB",
		maximumFractionDigits: 0,
	}).format(amount || 0);
const formatDate = (value: string) =>
	new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(
		new Date(value),
	);
const expenseWord = (count: number) =>
	count % 10 === 1 && count % 100 !== 11
		? "расход"
		: count % 10 >= 2 &&
				count % 10 <= 4 &&
				(count % 100 < 10 || count % 100 >= 20)
			? "расхода"
			: "расходов";
const memberRole = (role: string) =>
	({ owner: "Владелец", admin: "Администратор", editor: "Редактор" })[role] ||
	"Участник";
function isoDay(offset: number) {
	const date = new Date();
	date.setDate(date.getDate() + offset);
	return date.toISOString().slice(0, 10);
}
