type PlanCategoryItem = {
	category_id?: number | null;
};

export type PlanCategoryState =
	| { kind: "empty"; categoryID: null }
	| { kind: "shared"; categoryID: number }
	| { kind: "mixed"; categoryID: null };

const normalizedCategoryID = (item: PlanCategoryItem) =>
	item.category_id && item.category_id > 0 ? item.category_id : null;

export const planCategoryState = (
	items: PlanCategoryItem[],
): PlanCategoryState => {
	if (items.length === 0) return { kind: "empty", categoryID: null };

	const firstCategoryID = normalizedCategoryID(items[0]);
	if (!items.every((item) => normalizedCategoryID(item) === firstCategoryID)) {
		return { kind: "mixed", categoryID: null };
	}

	return firstCategoryID
		? { kind: "shared", categoryID: firstCategoryID }
		: { kind: "empty", categoryID: null };
};

export const applyPlanCategory = <Item extends PlanCategoryItem>(
	items: Item[],
	categoryID: number | null,
): Item[] => items.map((item) => ({ ...item, category_id: categoryID }));

export const inheritedPlanCategoryID = (items: PlanCategoryItem[]) => {
	const state = planCategoryState(items);
	return state.kind === "shared" ? state.categoryID : null;
};

export const uniquePlanCategoryIDs = (items: PlanCategoryItem[]) =>
	items
		.map(normalizedCategoryID)
		.filter((categoryID): categoryID is number => categoryID !== null)
		.filter(
			(categoryID, index, categoryIDs) =>
				categoryIDs.indexOf(categoryID) === index,
		);

export const visiblePlanCategoryIDs = (
	planCategoryID: number | null | undefined,
	items: PlanCategoryItem[],
) => {
	if (planCategoryID && planCategoryID > 0) return [planCategoryID];
	return uniquePlanCategoryIDs(items);
};
