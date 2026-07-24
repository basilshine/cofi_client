import assert from "node:assert/strict";
import test from "node:test";

import { newestUnseenNotification } from "../src/notification-inbox.ts";

test("notification toast skips the initial snapshot and picks the newest unseen item", () => {
	const notifications = [{ id: 3 }, { id: 2 }, { id: 1 }];

	assert.equal(newestUnseenNotification(notifications, null), undefined);
	assert.equal(newestUnseenNotification(notifications, new Set([1, 2]))?.id, 3);
});
