import assert from "node:assert/strict";
import test from "node:test";

import { isSubscriptionExpired } from "../src/subscription.ts";

test("recognizes an expired subscription", () => {
	const now = Date.parse("2026-07-16T10:00:00Z");
	assert.equal(isSubscriptionExpired("2026-07-16T09:59:00Z", now), true);
	assert.equal(isSubscriptionExpired("2026-07-16T10:01:00Z", now), false);
	assert.equal(isSubscriptionExpired(null, now), false);
});
