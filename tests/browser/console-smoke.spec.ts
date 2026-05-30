import { expect, test } from "@playwright/test";

test("opens the console route in a real browser", async ({ page }) => {
	const pageErrors: string[] = [];
	page.on("pageerror", (error) => {
		pageErrors.push(error.message);
	});

	await page.goto("/console/spaces/11/overview", {
		waitUntil: "domcontentloaded",
	});

	await expect(page.locator("body")).toBeVisible();
	await expect(page.locator("body")).not.toContainText("failed to load config");
	await expect(page.locator("body")).not.toContainText("Internal server error");

	expect(pageErrors).toEqual([]);
});

test("shows the global composer on workspace pages but not native chat composer pages", async ({
	page,
}) => {
	const pageErrors: string[] = [];
	page.on("pageerror", (error) => {
		pageErrors.push(error.message);
	});

	const dock = page.getByTestId("global-composer-dock");

	await page.goto("/console/spaces/11/overview", {
		waitUntil: "domcontentloaded",
	});
	const needsAuth = await page
		.getByRole("link", { name: "Sign in" })
		.isVisible()
		.catch(() => false);
	test.skip(needsAuth, "requires authenticated console storage state");
	await expect(dock).toBeVisible();

	await page.goto("/console/chat/expenses?spaceId=11", {
		waitUntil: "domcontentloaded",
	});
	await expect(dock).toBeVisible();

	await page.goto("/console/spaces/11/benefits", {
		waitUntil: "domcontentloaded",
	});
	await expect(dock).toBeVisible();

	await page.goto("/console/chat?spaceId=11", {
		waitUntil: "domcontentloaded",
	});
	await expect(dock).toHaveCount(0);

	await page.goto("/console/chat/thread?spaceId=11&expenseId=1", {
		waitUntil: "domcontentloaded",
	});
	await expect(dock).toHaveCount(0);

	await page.goto("/console/spaces/11/settings", {
		waitUntil: "domcontentloaded",
	});
	await expect(dock).toHaveCount(0);

	expect(pageErrors).toEqual([]);
});
