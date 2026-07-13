import assert from "node:assert/strict";
import test from "node:test";
import { findVendorByName } from "../src/vendor.ts";

test("matches an existing vendor from autocomplete input", () => {
	const vendors = [{ id: 7, name: "Белый кролик" }];
	assert.equal(findVendorByName(vendors, "  БЕЛЫЙ КРОЛИК ")?.id, 7);
	assert.equal(findVendorByName(vendors, "Новый магазин"), undefined);
});
