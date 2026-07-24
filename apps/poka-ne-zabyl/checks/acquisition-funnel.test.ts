import assert from "node:assert/strict";
import test from "node:test";
import {
	acquisitionFunnelFromPath,
	landingQueryWithFunnel,
	rememberAcquisitionFunnel,
} from "../src/acquisition-funnel.ts";

test("maps only supported landing routes to acquisition funnels", () => {
	assert.equal(acquisitionFunnelFromPath("/family"), "family");
	assert.equal(acquisitionFunnelFromPath("/repair/"), "repair");
	assert.equal(acquisitionFunnelFromPath("/crew"), "crew");
	assert.equal(acquisitionFunnelFromPath("/events"), "events");
	assert.equal(acquisitionFunnelFromPath("/privacy"), "general");
});

test("adds the funnel without dropping campaign attribution", () => {
	assert.equal(
		landingQueryWithFunnel("?utm_source=direct", "repair"),
		"?utm_source=direct&funnel=repair",
	);
});

test("keeps the first valid funnel seen by the app", () => {
	const values = new Map<string, string>();
	const storage = {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => values.set(key, value),
	};
	assert.equal(rememberAcquisitionFunnel("?funnel=family", storage), "family");
	assert.equal(rememberAcquisitionFunnel("?funnel=crew", storage), "family");
});
