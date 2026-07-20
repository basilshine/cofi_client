import assert from "node:assert/strict";
import test from "node:test";
import { nextCoachmark, parseCoachmarks } from "../src/coachmarks.ts";

test("coachmarks choose the first eligible unseen hint", () => {
	assert.equal(
		nextCoachmark(["space"], { space: true, overview: true, add: true }),
		"overview",
	);
	assert.equal(
		nextCoachmark(["space", "overview", "expenses"], {
			add: true,
			categories: true,
		}),
		"add",
	);
	assert.equal(nextCoachmark(["space"], { add: false }), null);
});

test("coachmark storage ignores invalid data", () => {
	assert.deepEqual(parseCoachmarks('["space","unknown","plans"]'), [
		"space",
		"plans",
	]);
	assert.deepEqual(parseCoachmarks("broken"), []);
});
