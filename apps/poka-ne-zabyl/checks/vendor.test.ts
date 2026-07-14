import assert from "node:assert/strict";
import test from "node:test";
import {
	commonVendorName,
	findVendorByName,
	vendorFieldValue,
	vendorSuggestions,
} from "../src/vendor.ts";

test("matches an existing vendor from autocomplete input", () => {
	const vendors = [
		{
			id: 7,
			name: "Белый кролик",
			aliases: [{ alias: "ИП Иванов Иван Иванович" }],
		},
	];
	assert.equal(findVendorByName(vendors, "  БЕЛЫЙ КРОЛИК ")?.id, 7);
	assert.equal(findVendorByName(vendors, "ип иванов иван иванович")?.id, 7);
	assert.equal(findVendorByName(vendors, "Новый магазин"), undefined);
});

test("keeps an explicitly cleared vendor field empty", () => {
	assert.equal(vendorFieldValue("", "Старое название"), "");
	assert.equal(
		vendorFieldValue(undefined, "Старое название"),
		"Старое название",
	);
});

test("summarizes item vendors for the shared seller field", () => {
	assert.equal(commonVendorName(["Лента", " лента "]), "Лента");
	assert.equal(commonVendorName(["С ", "С "]), "С ");
	assert.equal(commonVendorName(["Лента", "Пятёрочка"]), null);
	assert.equal(commonVendorName(["", ""]), "");
});

test("suggests vendors by name and alias", () => {
	const vendors = [
		{ id: 1, name: "Сибирский теннисный центр", aliases: [] },
		{ id: 2, name: "С блеском", aliases: [{ alias: "ИП Иванов" }] },
	];
	assert.deepEqual(
		vendorSuggestions(vendors, "теннис").map((vendor) => vendor.id),
		[1],
	);
	assert.deepEqual(
		vendorSuggestions(vendors, "иванов").map((vendor) => vendor.id),
		[2],
	);
});
