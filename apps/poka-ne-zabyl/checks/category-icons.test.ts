import assert from "node:assert/strict";
import test from "node:test";
import {
	CATEGORY_ICON_OPTIONS,
	categoryIconLabel,
	normalizeCategoryIconKey,
	suggestCategoryIconKey,
} from "../src/category-icon-catalog.ts";

test("offers a broad stable category icon catalog", () => {
	assert.ok(CATEGORY_ICON_OPTIONS.length >= 40);
	assert.equal(
		new Set(CATEGORY_ICON_OPTIONS.map(({ key }) => key)).size,
		CATEGORY_ICON_OPTIONS.length,
	);
	assert.equal(categoryIconLabel("repair", "ru"), "Ремонт");
});

test("suggests category icons from names and keeps a safe fallback", () => {
	assert.equal(suggestCategoryIconKey("Автомобильный ремонт"), "repair");
	assert.equal(suggestCategoryIconKey("Электрика и кабель"), "electricity");
	assert.equal(suggestCategoryIconKey("Совсем новая идея"), "tag");
	assert.equal(normalizeCategoryIconKey("unknown"), "tag");
});
