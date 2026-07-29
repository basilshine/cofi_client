import assert from "node:assert/strict";
import test from "node:test";
import {
	BUSINESS_APP_HOST,
	businessAppHref,
	isBusinessAppLocation,
	isBusinessSpace,
	personalAppHref,
	spacesForAppExperience,
} from "../src/business-app.ts";

test("recognizes only the business host and explicit local preview", () => {
	assert.equal(isBusinessAppLocation(BUSINESS_APP_HOST), true);
	assert.equal(isBusinessAppLocation("poka-ne-zabyl.ru"), false);
	assert.equal(isBusinessAppLocation("127.0.0.1", "?business=1"), true);
	assert.equal(isBusinessAppLocation("127.0.0.1"), false);
});

test("opens production on the business host and keeps local development local", () => {
	assert.equal(
		businessAppHref("?utm_source=landing", "poka-ne-zabyl.ru"),
		`https://${BUSINESS_APP_HOST}/?utm_source=landing&funnel=business`,
	);
	assert.equal(
		businessAppHref("?utm_source=landing", "127.0.0.1"),
		"/app?utm_source=landing&funnel=business&business=1",
	);
	assert.equal(
		personalAppHref("?space_id=2", BUSINESS_APP_HOST),
		"https://poka-ne-zabyl.ru/app?space_id=2",
	);
	assert.equal(personalAppHref("?space_id=2", "127.0.0.1"), "/app?space_id=2");
});

test("treats only organization tenant spaces as business", () => {
	const spaces = [
		{ id: 1, settings: { experience: "personal" } },
		{ id: 2, settings: { experience: "business" } },
		{ id: 3, tenant_type: "organization" },
		{ id: 4 },
	];
	assert.equal(isBusinessSpace(spaces[1]), false);
	assert.deepEqual(
		spacesForAppExperience(spaces, false).map(({ id }) => id),
		[1, 2, 4],
	);
	assert.deepEqual(
		spacesForAppExperience(spaces, true).map(({ id }) => id),
		[3],
	);
});
