import assert from "node:assert/strict";
import test from "node:test";
import {
	applyPlanCategory,
	inheritedPlanCategoryID,
	planCategoryState,
	uniquePlanCategoryIDs,
	visiblePlanCategoryIDs,
} from "../src/plan-category.ts";

test("describes a category shared by every plan item", () => {
	assert.deepEqual(
		planCategoryState([{ category_id: 7 }, { category_id: 7 }]),
		{ kind: "shared", categoryID: 7 },
	);
	assert.equal(
		inheritedPlanCategoryID([{ category_id: 7 }, { category_id: 7 }]),
		7,
	);
});

test("distinguishes empty and mixed plan categories", () => {
	assert.deepEqual(planCategoryState([{}, { category_id: null }]), {
		kind: "empty",
		categoryID: null,
	});
	assert.deepEqual(
		planCategoryState([{ category_id: 7 }, { category_id: 8 }]),
		{ kind: "mixed", categoryID: null },
	);
	assert.deepEqual(planCategoryState([{ category_id: 7 }, {}]), {
		kind: "mixed",
		categoryID: null,
	});
	assert.equal(inheritedPlanCategoryID([{ category_id: 7 }, {}]), null);
});

test("applies an explicitly selected category to every plan item", () => {
	const items = [
		{ name: "Краска", category_id: 2 },
		{ name: "Валик", category_id: null },
	];

	assert.deepEqual(applyPlanCategory(items, 9), [
		{ name: "Краска", category_id: 9 },
		{ name: "Валик", category_id: 9 },
	]);
	assert.deepEqual(applyPlanCategory(items, null), [
		{ name: "Краска", category_id: null },
		{ name: "Валик", category_id: null },
	]);
});

test("returns unique category icons in plan item order", () => {
	assert.deepEqual(
		uniquePlanCategoryIDs([
			{ category_id: 7 },
			{ category_id: null },
			{ category_id: 4 },
			{ category_id: 7 },
		]),
		[7, 4],
	);
});

test("uses the plan category icon before item category fallbacks", () => {
	assert.deepEqual(
		visiblePlanCategoryIDs(9, [{ category_id: null }, { category_id: 4 }]),
		[9],
	);
	assert.deepEqual(
		visiblePlanCategoryIDs(null, [
			{ category_id: 7 },
			{ category_id: 4 },
			{ category_id: 7 },
		]),
		[7, 4],
	);
});
