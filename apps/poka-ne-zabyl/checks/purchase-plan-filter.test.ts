import assert from "node:assert/strict";
import test from "node:test";
import {
	filterPurchasePlans,
	partitionOverduePurchasePlans,
	planPeriodBounds,
} from "../src/purchase-plan-filter.ts";

test("filters multi-item plans and builds future date ranges", () => {
	const plans = [
		{
			title: "Покупки на неделю",
			vendor_id: 4,
			due_date: "2026-07-17",
			items: [
				{ name: "Молоко", category_id: 2 },
				{ name: "Хлеб", category_id: 2 },
			],
		},
		{
			title: "Когда-нибудь",
			items: [{ name: "Лампа", category_id: 8 }],
		},
	];
	assert.deepEqual(planPeriodBounds("week", "", "", new Date(2026, 6, 15)), {
		from: "2026-07-15",
		to: "2026-07-21",
	});
	assert.equal(
		filterPurchasePlans(plans, {
			query: "хлеб",
			categoryID: 2,
			vendorID: 4,
			from: "2026-07-15",
			to: "2026-07-21",
		}).length,
		1,
	);
	assert.deepEqual(
		partitionOverduePurchasePlans(plans, "2026-07-18").overdue.map(
			(plan) => plan.title,
		),
		["Покупки на неделю"],
	);
});
