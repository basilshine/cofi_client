import assert from "node:assert/strict";
import test from "node:test";
import {
	expenseSummaryTotal,
	periodBounds,
} from "../src/expense-period.ts";

test("builds quick and custom expense periods", () => {
	const now = new Date(2026, 6, 15);
	assert.deepEqual(periodBounds("three-days", "", "", now), {
		from: "2026-07-13",
		to: "2026-07-15",
	});
	assert.deepEqual(periodBounds("custom", "2026-05-02", "2026-06-08", now), {
		from: "2026-05-02",
		to: "2026-06-08",
	});
});

test("uses the complete server month total before paginated rows finish loading", () => {
	assert.equal(expenseSummaryTotal(456.52, 3409.89, "month", false), 3409.89);
	assert.equal(expenseSummaryTotal(456.52, 3409.89, "month", true), 456.52);
});
