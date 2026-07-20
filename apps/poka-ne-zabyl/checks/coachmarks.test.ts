import assert from "node:assert/strict";
import test from "node:test";
import { nextCoachmark, parseCoachmarks } from "../src/coachmarks.ts";

test("coachmarks choose the first eligible unseen hint", () => {
	assert.equal(
		nextCoachmark(["space"], { space: true, add: true, expenses: true }),
		"add",
	);
	assert.equal(nextCoachmark(["space", "add"], { plans: true }), "plans");
	assert.equal(nextCoachmark(["space"], { add: false }), null);
});

test("coachmark storage ignores invalid data", () => {
	assert.deepEqual(parseCoachmarks('["space","unknown","plans"]'), [
		"space",
		"plans",
	]);
	assert.deepEqual(parseCoachmarks("broken"), []);
});
