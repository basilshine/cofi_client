import assert from "node:assert/strict";
import test from "node:test";
import { shouldRetryAppRender } from "../src/app-recovery.ts";

test("automatically retries one render failure without creating a reload loop", () => {
	assert.equal(shouldRetryAppRender(0, 100_000), true);
	assert.equal(shouldRetryAppRender(90_000, 100_000), false);
	assert.equal(shouldRetryAppRender(70_000, 100_000), true);
});
