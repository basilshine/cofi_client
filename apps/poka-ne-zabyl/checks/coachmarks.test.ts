import assert from "node:assert/strict";
import test from "node:test";
import { nextCoachmark, parseCoachmarks } from "../src/coachmarks.ts";

test("coachmarks choose the first eligible unseen hint", () => {
	assert.equal(
		nextCoachmark(["spaceSwitcher"], {
			spaceSwitcher: true,
			overview: true,
			add: true,
		}),
		"overview",
	);
	assert.equal(
		nextCoachmark(["spaceSwitcher", "overview", "expenses"], {
			add: true,
			categories: true,
		}),
		"add",
	);
	assert.equal(nextCoachmark(["spaceSwitcher"], { add: false }), null);
});

test("coachmark storage ignores invalid data", () => {
	assert.deepEqual(parseCoachmarks('["spaceSwitcher","unknown","plans"]'), [
		"spaceSwitcher",
		"plans",
	]);
	assert.deepEqual(parseCoachmarks("broken"), []);
});
