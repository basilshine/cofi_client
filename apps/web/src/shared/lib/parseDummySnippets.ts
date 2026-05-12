export type ParseDummySnippet = {
	label: string;
	text: string;
};

/**
 * Shared quick-fill chips for local dummy parser mode.
 * Used across chat and dashboard capture surfaces.
 */
export const PARSE_DUMMY_TEST_SNIPPETS: ParseDummySnippet[] = [
	{
		label: "Coffee / breakfast",
		text: "Morning cappuccino and croissant at the usual place",
	},
	{ label: "Subscription", text: "Netflix subscription renewal" },
	{ label: "Ride", text: "Uber to the office" },
	{ label: "Groceries", text: "Groceries: oat milk and fresh bread" },
	{
		label: "Analytics (placeholder)",
		text: "How much did I spend on food last week?",
	},
	{ label: "RU · такси", text: "такси до дома 500 рублей" },
	{ label: "Multi-item lunch", text: "Lunch bowl and sparkling water" },
	{ label: "Electronics", text: "Bought a USB-C hub for the desk" },
	{
		label: "Mega receipt (50 lines)",
		text: "mega receipt — wholesale club stress test; dummy parser emits 50 line items for UI",
	},
	{
		label: "Payee A · grocery (Whole Foods)",
		text: "Groceries: oat milk and fresh bread",
	},
	{
		label: "Payee B · Uber ride",
		text: "Uber to the office",
	},
];
