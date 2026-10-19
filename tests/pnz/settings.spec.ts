import { type Page, expect, test } from "@playwright/test";

const user = {
	id: 7,
	name: "Test Owner",
	email: "owner@example.com",
	emailVerified: true,
	country: "RU",
	currency: "RUB",
	language: "ru",
	timezone: "Asia/Tomsk",
	authType: "email",
	notificationTime: "09:00",
	userPreferences: {},
};

async function mockAccount(page: Page, admin: boolean) {
	let plus = false;
	let grantCalls = 0;
	const quota = () => ({
		plan: plus ? "plus" : "basic",
		limit: plus ? 250 : 50,
		used: 0,
		remaining: plus ? 250 : 50,
		recurring_remaining: plus ? 250 : 0,
		dev_tools_enabled: admin,
		system_admin_enabled: admin,
	});
	await page.route("**/api/v1/**", async (route) => {
		const path = new URL(route.request().url()).pathname.replace("/api/v1", "");
		let body: unknown = {};
		if (path === "/auth/refresh") body = { token: "test-session", user };
		else if (path === "/spaces")
			body = [
				{
					id: 2,
					tenant_id: 11,
					owner_user_id: 7,
					is_personal: true,
					name: "Личное",
					currency: "RUB",
				},
			];
		else if (path === "/quota") body = quota();
		else if (path === "/quota/developer-dashboard")
			body = {
				user_id: 7,
				period_days: 30,
				processing: {
					processing_jobs: 0,
					pending_jobs: 0,
					running_jobs: 0,
					succeeded_jobs: 0,
					failed_jobs: 0,
					quota_units: 0,
					average_latency_ms: 0,
				},
				quality: {
					resolved_results: 0,
					confirmed_results: 0,
					edited_results: 0,
					deleted_results: 0,
					confirm_rate: 0,
					edit_rate: 0,
					delete_rate: 0,
					average_confirmation_ms: 0,
					cost_per_confirmed_usd: 0,
					p95_cost_per_action_usd: 0,
				},
				models: {
					total_cost_usd: 0,
					model_calls: 0,
					failed_calls: 0,
					fallback_calls: 0,
					fallback_rate: 0,
					average_latency_ms: 0,
				},
				data: {},
				product: {
					total_users: 1,
					average_inputs_per_active_user: 0,
					recent_users: null,
				},
				breakdown: null,
				recent_failures: null,
				incomplete_registrations: null,
			};
		else if (path === "/quota/developer-users/7/plus") {
			grantCalls++;
			plus = true;
			body = { id: 7, subscription: { plan: "plus" } };
		} else if (path.endsWith("/vendors")) body = [];
		else if (path.endsWith("/expenses")) body = { expenses: [] };
		else if (path.endsWith("/categories")) body = { categories: [] };
		else if (path.endsWith("/members")) body = { members: [] };
		else if (path.endsWith("/participants")) body = { participants: [] };
		else if (path.endsWith("/split-decisions")) body = { decisions: [] };
		else if (path.endsWith("/captures")) body = { captures: [] };
		else if (path.endsWith("/plans")) body = { plans: [] };
		else if (path.endsWith("/candidates")) body = { candidates: [] };
		else if (path.endsWith("/reports")) body = { reports: [] };
		else if (path.endsWith("/notifications"))
			body = { notifications: [], unread_count: 0 };
		await route.fulfill({ json: body });
	});
	return { grantCalls: () => grantCalls };
}

test("settings and navigation survive an empty admin reporting period", async ({
	page,
}) => {
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	await mockAccount(page, true);
	await page.goto("/app?space_id=2");
	await page.getByRole("button", { name: "Настройки", exact: true }).click();
	await expect(
		page.getByRole("heading", { name: "Настройки", exact: true }),
	).toBeVisible();
	await page.getByText("Инструменты разработчика", { exact: true }).click();
	await expect(page.getByText("Нет ожидающих попыток за 7 дней")).toBeVisible();
	for (const screen of ["Расходы", "Категории", "Главная", "Настройки"]) {
		await page
			.getByRole("navigation", { name: "Разделы приложения" })
			.getByRole("button", { name: screen, exact: true })
			.click();
		await expect(
			page.getByText("Экран не загрузился", { exact: true }),
		).toHaveCount(0);
	}
	expect(errors).toEqual([]);
});

test("owner can extend Plus from subscription without opening admin tools", async ({
	page,
}) => {
	const account = await mockAccount(page, true);
	await page.goto("/app?space_id=2&view=subscription");
	await page
		.getByRole("button", { name: "Плюс на 30 дней бесплатно", exact: true })
		.click();
	await expect(
		page.getByText("Плюс продлён на 30 дней", { exact: true }),
	).toBeVisible();
	expect(account.grantCalls()).toBe(1);
	await expect(
		page.getByRole("heading", { name: "Плюс", exact: true }).first(),
	).toBeVisible();
});

test("ordinary users cannot see the complimentary owner action", async ({
	page,
}) => {
	await mockAccount(page, false);
	await page.goto("/app?space_id=2&view=subscription");
	await expect(
		page.getByRole("heading", { name: "Подписка", exact: true }),
	).toBeVisible();
	await expect(
		page.getByRole("button", {
			name: "Плюс на 30 дней бесплатно",
			exact: true,
		}),
	).toHaveCount(0);
});

test("a denied owner grant leaves the subscription usable and shows the error", async ({
	page,
}) => {
	await mockAccount(page, true);
	await page.route("**/quota/developer-users/7/plus", (route) =>
		route.fulfill({ status: 403, json: { error: "Продление недоступно" } }),
	);
	await page.goto("/app?space_id=2&view=subscription");
	const action = page.getByRole("button", {
		name: "Плюс на 30 дней бесплатно",
		exact: true,
	});
	await action.click();
	await expect(
		page.getByText("Продление недоступно", { exact: true }),
	).toBeVisible();
	await expect(action).toBeEnabled();
	await expect(
		page.getByText("Плюс продлён на 30 дней", { exact: true }),
	).toHaveCount(0);
});
