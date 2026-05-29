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
