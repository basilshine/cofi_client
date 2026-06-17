import { type Page, expect, test } from "@playwright/test";

const spaceId = 10;
const sourceDocumentId = 700;

const json = (body: unknown) => ({
	body: JSON.stringify(body),
	contentType: "application/json",
});

const dashboardPayload = {
	context: {
		tenant_id: 20,
		tenant_name: "Personal",
		user_id: 42,
	},
	recurring_upcoming: [],
	summary: {},
};

const membersPayload = {
	can_manage_member_roles: true,
	members: [
		{
			email: "basil@example.com",
			name: "Basil",
			role: "owner",
			user_id: 42,
		},
	],
};

const capturePacketPayload = {
	captures: [
		{
			candidate_count: 5,
			candidate_counts: {
				benefits: 1,
				documents: 0,
				expense_items: 2,
				expenses: 1,
				future: 1,
				people: 1,
				splits: 1,
			},
			candidate_status_counts: {
				projected: 5,
			},
			candidate_type_counts: {
				expense_candidate: 1,
				expense_item_candidate: 2,
				participant_placeholder_candidate: 1,
				promo_code_candidate: 1,
				recurring_candidate: 1,
				split_candidate: 1,
			},
			confidence: 0.93,
			created_at: "2026-06-01T09:00:00.000Z",
			created_by_user_id: 42,
			currency: "RUB",
			document_date: "2026-06-01",
			document_type: "receipt",
			id: 900,
			ignored_count: 0,
			input_kind: "photo",
			latest_candidate_at: "2026-06-01T09:05:00.000Z",
			media_object_id: null,
			merchant_text: "Family receipt",
			pending_count: 0,
			projected_count: 5,
			records: {
				benefits: [
					{
						created_by_user_id: 42,
						discount_type: "percent",
						discount_value: 20,
						id: 301,
						promo_code: "SAVE20",
						redeem_merchant_name: "Family Store",
						status: "active",
						title: "Family Store promo",
						valid_until: "2026-07-01",
					},
				],
				expenses: [
					{
						created_by_user_id: 42,
						currency: "RUB",
						id: 201,
						items: [
							{ amount: 1200, id: 1, name: "Groceries" },
							{ amount: 500, id: 2, name: "Delivery" },
						],
						status: "approved",
						title: "Family receipt",
						total_amount: 1700,
						txn_date: "2026-06-01",
					},
				],
				participants: [
					{
						created_by_user_id: 42,
						display_name: "Misha",
						id: 401,
						participant_type: "placeholder",
						status: "active",
					},
				],
				recurring: [
					{
						amount: 999,
						created_by_user_id: 42,
						id: 501,
						interval: "monthly",
						name: "Monthly internet",
						next_run: "2026-07-01",
						paused: false,
					},
				],
				splits: [
					{
						created_by_user_id: 42,
						expense_id: 201,
						participant_lines: [
							{
								amount: 850,
								display_name: "Alex",
								id: 1,
								space_participant_id: 10,
							},
							{
								amount: 850,
								display_name: "Misha",
								id: 2,
								space_participant_id: 401,
							},
						],
						split_count: 2,
						total_amount: 1700,
					},
				],
			},
			source_document_id: sourceDocumentId,
			source_type: "receipt",
			space_id: spaceId,
			title: "Family receipt",
			total_amount: 1700,
			updated_at: "2026-06-01T09:05:00.000Z",
		},
	],
};

const searchPayload = {
	query: "family",
	results: [
		{
			amount: 1700,
			created_at: "2026-06-01T09:05:00.000Z",
			currency: "RUB",
			detail: "Groceries and delivery from the captured receipt",
			entity_id: 201,
			href: `/console/spaces/${spaceId}/expenses?expenseId=201`,
			id: "expense:201",
			matched_fields: ["title", "items"],
			occurred_at: "2026-06-01",
			source_document_id: sourceDocumentId,
			space_id: spaceId,
			space_name: "Fixture Space",
			status: "draft",
			subtitle: "Fixture Space",
			title: "Family receipt",
			type: "expense",
		},
	],
	scope: "all_accessible",
	total: 1,
	types: ["expense"],
};

const messagesPayload = [
	{
		created_at: "2026-06-01T09:00:00.000Z",
		direction: "out",
		id: 1001,
		message_type: "text",
		sender_type: "user",
		source_document_id: sourceDocumentId,
		space_id: spaceId,
		text: "Family receipt with groceries and delivery",
		user_id: 42,
	},
];

const activityPayload = {
	items: [
		{
			action: "capture_records_created",
			actor: {
				display_name: "Basil",
				id: 42,
			},
			created_at: "2026-06-01T09:05:00.000Z",
			entity: "capture",
			id: 6101,
			metadata: {
				source_document_id: sourceDocumentId,
			},
			read_state: "pending",
		},
	],
};

const parseCapturePayload = {
	candidates: [
		{
			candidate_type: "expense_candidate",
			confidence: 0.93,
			id: 710,
			source_document_id: sourceDocumentId,
			status: "projected",
			title: "Family receipt",
		},
		{
			candidate_type: "expense_item_candidate",
			confidence: 0.91,
			id: 711,
			source_document_id: sourceDocumentId,
			status: "projected",
			title: "Groceries",
		},
	],
	confidence: 0.93,
	input_kind: "text",
	intent: "expense_text",
	items: [
		{ amount: 1200, name: "Groceries" },
		{ amount: 500, name: "Delivery" },
	],
	requires_review: true,
	source_document_id: sourceDocumentId,
	vendor_name: "Family Store",
};

const setupReviewMocks = async (page: Page) => {
	await page.addInitScript(() => {
		window.localStorage.setItem("cofi_token", "test-token");
	});

	await page.route("**/api/v1/**", async (route) => {
		const url = new URL(route.request().url());
		const path = url.pathname;

		if (path === "/api/v1/auth/me") {
			await route.fulfill(
				json({
					country: "RU",
					currency: "RUB",
					email: "basil@example.com",
					id: 42,
					language: "ru",
					name: "Basil",
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

		if (path === "/api/v1/dashboard") {
			await route.fulfill(json(dashboardPayload));
			return;
		}

		if (path === "/api/v1/spaces") {
			await route.fulfill(
				json([
					{
						id: spaceId,
						last_activity_at: "2026-06-01T09:05:00.000Z",
						name: "Fixture Space",
						owner_user_id: 42,
						tenant_id: 20,
						tenant_name: "Personal",
					},
				]),
			);
			return;
		}

		if (path === `/api/v1/spaces/${spaceId}/members`) {
			await route.fulfill(json(membersPayload));
			return;
		}

		if (path === `/api/v1/spaces/${spaceId}/captures`) {
			const payload = JSON.parse(JSON.stringify(capturePacketPayload));
			await route.fulfill(json(payload));
			return;
		}

		if (path === `/api/v1/spaces/${spaceId}/review/benefit-candidates`) {
			await route.fulfill(json({ candidates: [] }));
			return;
		}

		if (path === `/api/v1/spaces/${spaceId}/review/candidates`) {
			await route.fulfill(json({ candidates: [] }));
			return;
		}

		if (path === `/api/v1/spaces/${spaceId}/expenses`) {
			await route.fulfill(json([]));
			return;
		}

		if (path === `/api/v1/spaces/${spaceId}/messages`) {
			await route.fulfill(json(messagesPayload));
			return;
		}

		if (path === `/api/v1/spaces/${spaceId}/activity/summary`) {
			await route.fulfill(json({ has_unread: true, unread_count: 1 }));
			return;
		}

		if (path === `/api/v1/spaces/${spaceId}/activity`) {
			if (route.request().method() === "POST") {
				await route.fulfill(json({}));
				return;
			}
			await route.fulfill(json(activityPayload));
			return;
		}

		if (path === "/api/v1/search") {
			await route.fulfill(json(searchPayload));
			return;
		}

		if (path === "/api/v1/capture") {
			await route.fulfill(json(parseCapturePayload));
			return;
		}

		await route.fulfill(json({}));
	});
};

test("review capture card shows all saved record types from one source capture", async ({
	page,
}) => {
	const pageErrors: string[] = [];
	page.on("pageerror", (error) => {
		if (error.message === "WS not connected") return;
		pageErrors.push(error.message);
	});

	await setupReviewMocks(page);

	await page.goto(
		`/console/review?spaceId=${spaceId}&sourceDocumentId=${sourceDocumentId}`,
		{ waitUntil: "domcontentloaded" },
	);

	await expect(
		page.getByText(`Capture #${sourceDocumentId}`).first(),
	).toBeVisible();
	await expect(page.getByText("Review complete").first()).toBeVisible();
	await expect(page.getByText("7 created")).toBeVisible();
	await expect(
		page.getByText("Created records from this capture"),
	).toBeVisible();
	await expect(page.getByText("Expense items")).toBeVisible();
	await expect(
		page.getByText(
			"This capture is complete, so the records below are shown as saved output.",
		),
	).toBeVisible();

	for (const label of ["Items 2", "Benefits 1", "People 1", "Splits 1"]) {
		await expect(page.getByText(label).first()).toBeVisible();
	}

	for (const recordText of [
		"Family receipt",
		"Groceries",
		"Delivery",
		"Misha",
	]) {
		await expect(page.getByText(recordText).first()).toBeVisible();
	}
	await expect(page.getByText("Benefit records").first()).toBeVisible();
	await expect(page.getByText("Future rules").first()).toBeVisible();
	await expect(
		page.getByText("Everything from this capture is resolved"),
	).toBeVisible();

	expect(pageErrors).toEqual([]);
});

test("chat capture submit creates source-backed review feedback", async ({
	page,
}) => {
	const pageErrors: string[] = [];
	let captureRequests = 0;
	page.on("pageerror", (error) => {
		if (error.message === "WS not connected") return;
		pageErrors.push(error.message);
	});
	page.on("request", (request) => {
		const url = new URL(request.url());
		if (request.method() === "POST" && url.pathname === "/api/v1/capture") {
			captureRequests += 1;
		}
	});

	await setupReviewMocks(page);

	await page.goto(`/console/chat?spaceId=${spaceId}`, {
		waitUntil: "domcontentloaded",
	});

	await page.getByRole("button", { name: /Capture: Review capture/ }).click();
	await expect(page.getByText("How would you like to add it?")).toBeVisible();
	await page.getByRole("button", { name: "Text" }).click();
	await page
		.getByLabel("Text input")
		.fill("Family receipt groceries 1200 delivery 500");
	await page.getByRole("button", { name: "Add" }).click();
	await expect.poll(() => captureRequests).toBe(1);

	await expect(page.getByLabel("Capture progress")).toBeVisible();
	await expect(page.getByText("Text capture")).toBeVisible();
	await expect(page.getByText("Ready", { exact: true })).toBeVisible();
	await page
		.getByLabel("Capture progress")
		.getByRole("link", { name: "Review capture" })
		.click();
	await expect(page).toHaveURL(
		new RegExp(
			`/console/review\\?spaceId=${spaceId}&sourceDocumentId=${sourceDocumentId}`,
		),
	);

	expect(pageErrors).toEqual([]);
});

test("global dock capture submit hydrates created records and links to review", async ({
	page,
}) => {
	const pageErrors: string[] = [];
	let captureRequests = 0;
	page.on("pageerror", (error) => {
		if (error.message === "WS not connected") return;
		pageErrors.push(error.message);
	});
	page.on("request", (request) => {
		const url = new URL(request.url());
		if (request.method() === "POST" && url.pathname === "/api/v1/capture") {
			captureRequests += 1;
		}
	});

	await setupReviewMocks(page);

	await page.goto(`/console/spaces/${spaceId}/overview`, {
		waitUntil: "domcontentloaded",
	});

	const dock = page.getByTestId("global-composer-dock");
	await expect(dock).toBeVisible();
	await dock.getByRole("button", { name: "Add expense" }).click();
	await dock.getByRole("button", { name: "Text" }).click();
	await dock
		.getByLabel("Text input")
		.fill("Family receipt groceries 1200 delivery 500");
	await dock.getByRole("button", { name: "Add" }).click();
	await expect.poll(() => captureRequests).toBe(1);

	const summary = page.getByTestId("global-composer-candidate-summary");
	await expect(summary).toBeVisible();
	await expect(summary).toContainText("Capture result");
	await expect(summary).toContainText("Records created from this capture");
	await expect(summary).toContainText("expense");
	await expect(summary).toContainText("2 items");
	await summary.getByRole("button", { name: "Review capture" }).click();
	await expect(page.getByTestId("global-composer-review-drawer")).toBeVisible();
	await expect(summary).toContainText("Expense saved");
	await expect(
		summary.getByRole("link", { name: "Review capture" }),
	).toHaveCount(0);
	await page
		.getByTestId("global-composer-review-drawer")
		.getByRole("link", { name: "Review expense" })
		.click();
	await expect(page).toHaveURL(
		new RegExp(
			`/console/review\\?spaceId=${spaceId}&sourceDocumentId=${sourceDocumentId}&section=expenses`,
		),
	);

	expect(pageErrors).toEqual([]);
});

test("search, activity, and chat expose source capture review links", async ({
	page,
}) => {
	const pageErrors: string[] = [];
	page.on("pageerror", (error) => {
		if (error.message === "WS not connected") return;
		pageErrors.push(error.message);
	});

	await setupReviewMocks(page);

	await page.goto(`/console/search?q=family&spaceId=${spaceId}`, {
		waitUntil: "domcontentloaded",
	});
	await expect(
		page.getByText(`Source capture #${sourceDocumentId}`),
	).toBeVisible();
	await page.getByRole("link", { name: "Review capture" }).click();
	await expect(page).toHaveURL(
		new RegExp(
			`/console/review\\?spaceId=${spaceId}&sourceDocumentId=${sourceDocumentId}`,
		),
	);

	await page.goto(`/console/chat?spaceId=${spaceId}`, {
		waitUntil: "domcontentloaded",
	});
	await expect(
		page.getByText("Family receipt with groceries and delivery"),
	).toBeVisible();
	await page.getByRole("link", { name: "Review capture" }).first().click();
	await expect(page).toHaveURL(
		new RegExp(
			`/console/review\\?spaceId=${spaceId}&sourceDocumentId=${sourceDocumentId}`,
		),
	);

	await page.goto(`/console/chat?spaceId=${spaceId}`, {
		waitUntil: "domcontentloaded",
	});
	await page.getByRole("button", { name: /Space activity/ }).click();
	await expect(page.getByText("Recent in this space")).toBeVisible();
	await page.getByRole("link", { name: "Review capture" }).last().click();
	await expect(page).toHaveURL(
		new RegExp(
			`/console/review\\?spaceId=${spaceId}&sourceDocumentId=${sourceDocumentId}`,
		),
	);

	expect(pageErrors).toEqual([]);
});
