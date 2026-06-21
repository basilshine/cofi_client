import { type Page, expect, test } from "@playwright/test";

const token = "space-invite-token";
const spaceId = 77;

const json = (body: unknown) => ({
	body: JSON.stringify(body),
	contentType: "application/json",
});

const setupAuthenticatedInviteMocks = async (page: Page) => {
	await page.addInitScript(() => {
		window.localStorage.setItem("cofi_token", "test-token");
	});

	let acceptCount = 0;
	await page.route("**/api/v1/**", async (route) => {
		const url = new URL(route.request().url());
		const path = url.pathname;

		if (path === "/api/v1/auth/me") {
			await route.fulfill(
				json({
					country: "RU",
					currency: "RUB",
					email: "invitee@example.com",
					id: 42,
					language: "ru",
					name: "Invitee",
					timezone: "Asia/Tomsk",
				}),
			);
			return;
		}

		if (path === "/api/v1/onboarding") {
			await route.fulfill(
				json({
					completed: true,
					current_step: "done",
					draft: {},
					first_space_id: spaceId,
					has_pending_invite: false,
				}),
			);
			return;
		}

		if (
			path === "/api/v1/invites/preview" &&
			url.searchParams.get("token") === token
		) {
			await route.fulfill(
				json({
					invite_kind: "space",
					invited_email: "invitee@example.com",
					role: "member",
					space_name: "Joined Space",
					status: "ready",
					tenant_name: "Personal",
				}),
			);
			return;
		}

		if (
			path === `/api/v1/invites/${token}/accept` &&
			route.request().method() === "POST"
		) {
			acceptCount += 1;
			await route.fulfill(
				json({
					kind: "space",
					space: {
						id: spaceId,
						name: "Joined Space",
						owner_user_id: 1,
						tenant_id: 20,
						tenant_name: "Personal",
					},
				}),
			);
			return;
		}

		if (path === "/api/v1/dashboard") {
			await route.fulfill(
				json({
					context: {
						tenant_id: 20,
						tenant_name: "Personal",
						user_id: 42,
					},
					recurring_upcoming: [],
					summary: {},
				}),
			);
			return;
		}

		if (path === "/api/v1/spaces") {
			await route.fulfill(
				json([
					{
						id: spaceId,
						name: "Joined Space",
						owner_user_id: 1,
						tenant_id: 20,
						tenant_name: "Personal",
					},
				]),
			);
			return;
		}

		if (path === `/api/v1/spaces/${spaceId}/messages`) {
			await route.fulfill(json([]));
			return;
		}

		if (path === `/api/v1/spaces/${spaceId}/members`) {
			await route.fulfill(
				json({
					can_manage_member_roles: false,
					members: [
						{
							email: "invitee@example.com",
							name: "Invitee",
							role: "member",
							user_id: 42,
						},
					],
				}),
			);
			return;
		}

		if (path === `/api/v1/spaces/${spaceId}/activity/summary`) {
			await route.fulfill(json({ has_unread: false, unread_count: 0 }));
			return;
		}

		if (path === `/api/v1/spaces/${spaceId}/activity`) {
			await route.fulfill(json({ items: [] }));
			return;
		}

		await route.fulfill(json({}));
	});

	return () => acceptCount;
};

test("authenticated join page accepts invite and opens joined space", async ({
	page,
}) => {
	const pageErrors: string[] = [];
	page.on("pageerror", (error) => {
		pageErrors.push(error.message);
	});
	const getAcceptCount = await setupAuthenticatedInviteMocks(page);

	await page.goto(`/join?token=${token}`, { waitUntil: "domcontentloaded" });

	await expect(page).toHaveURL(
		new RegExp(`/console/spaces/${spaceId}/expenses$`),
	);
	expect(getAcceptCount()).toBe(1);
	expect(pageErrors).toEqual([]);
});
