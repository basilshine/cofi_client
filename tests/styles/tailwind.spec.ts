import { readFileSync, readdirSync } from "node:fs";
import { type Page, expect, test } from "@playwright/test";

const visualCompare = process.env.TAILWIND_VISUAL_COMPARE === "1";

async function capture(page: Page, name: string) {
	if (visualCompare) {
		await expect(page).toHaveScreenshot(`${name}.png`, {
			animations: "disabled",
			fullPage: true,
			// WebKit's v4 line-height rounding accumulates <0.2px over this 10kpx page.
			maxDiffPixelRatio:
				name === "marketing" && test.info().project.name === "webkit"
					? 0.002
					: 0.001,
		});
	}
}

test.beforeEach(async ({ page }) => {
	await page.route("**/*", (route) => {
		const url = new URL(route.request().url());
		if (url.hostname === "127.0.0.1" && !url.pathname.startsWith("/api/"))
			return route.continue();
		return route.abort();
	});
});

test("web login preserves field geometry, keyboard focus and feedback", async ({
	page,
}) => {
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	await page.goto("http://127.0.0.1:5210/login");
	await expect(
		page.getByRole("heading", { name: "Welcome back" }),
	).toBeVisible();
	const email = page.getByLabel("Email", { exact: true });
	await expect(email).toHaveCSS("height", "48px");
	await expect(email).toHaveCSS("border-top-width", "1px");
	await expect(email).toHaveCSS("padding-left", "14px");
	await expect(
		page.getByRole("button", { name: "Sign in", exact: true }),
	).toHaveCSS("height", "48px");
	await capture(page, "web-login");
	await email.fill("test@example.com");
	await expect(email).toBeFocused();
	await expect(email).not.toHaveCSS("box-shadow", "none");
	await capture(page, "web-login-focus");
	await page.getByRole("button", { name: "Sign in with Google" }).click();
	await expect(page.getByRole("status")).toBeVisible();
	await expect(email).toHaveValue("test@example.com");
	await capture(page, "web-login-notice");
	expect(errors).toEqual([]);
});

test("marketing content remains readable without horizontal overflow", async ({
	page,
}) => {
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	await page.goto("http://127.0.0.1:5211/");
	await expect(page.locator("h1")).toBeVisible();
	expect(await page.locator("h1").innerText()).not.toBe("");
	const titleSize = await page.locator("h1").evaluate((element) => {
		const style = getComputedStyle(element);
		return {
			font: Number.parseFloat(style.fontSize),
			line: Number.parseFloat(style.lineHeight),
		};
	});
	expect(titleSize.line).toBeCloseTo(
		titleSize.font * ((page.viewportSize()?.width ?? 0) >= 640 ? 1 : 1.1),
		1,
	);
	await expect(
		page.getByRole("link", { name: "Get started", exact: true }).last(),
	).toHaveCSS("padding-left", "24px");
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth > window.innerWidth,
	);
	expect(overflow).toBe(false);
	await capture(page, "marketing");
	expect(errors).toEqual([]);
});

test("legacy Telegram stylesheet retains its base tokens", async ({ page }) => {
	const assets = new URL(
		"../../apps/telegram-webapp/dist/assets/",
		import.meta.url,
	);
	const file = readdirSync(assets).find((name) => name.endsWith(".css"));
	if (!file)
		throw new Error("Build the Telegram workspace before testing styles");
	const css = readFileSync(new URL(file, assets), "utf8");
	await page.setContent(
		`<style>${css}</style><main><h1>Shared money</h1><label>Email <input type="email"></label><button type="button">Continue</button></main>`,
	);
	await expect(page.locator("body")).toHaveCSS("min-width", "320px");
	await expect(page.locator("body")).not.toHaveCSS(
		"background-color",
		"rgba(0, 0, 0, 0)",
	);
	await expect(page.getByRole("button")).toBeVisible();
	await capture(page, "telegram-base");
});
