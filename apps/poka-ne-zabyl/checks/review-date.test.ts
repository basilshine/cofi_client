import assert from "node:assert/strict";
import test from "node:test";
import { reviewDateConcern } from "../src/review-date.ts";

const today = new Date(2026, 7, 25, 12, 0, 0);

test("flags a legal footer date mistaken for the receipt date", () => {
	assert.equal(reviewDateConcern("2020-12-31", today), "old");
});

test("accepts recent receipt dates", () => {
	assert.equal(reviewDateConcern("2026-08-25", today), null);
	assert.equal(reviewDateConcern("2025-08-25", today), null);
});

test("flags implausible future receipt dates", () => {
	assert.equal(reviewDateConcern("2026-08-27", today), "future");
});

test("leaves incomplete dates to normal form validation", () => {
	assert.equal(reviewDateConcern("", today), null);
});
