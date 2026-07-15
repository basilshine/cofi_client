import assert from "node:assert/strict";
import test from "node:test";
import { periodBounds } from "../src/expense-period.ts";

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
