import type { ParseTestSnippet } from "./components/ParseExpenseComposer";

/**
 * Quick-fill chips for local dummy parser (`PARSER_DUMMY_MODE=1` or no `OPENAI_API_KEY`).
 * Routes by keywords in `internal/parser/dummy.go`.
 *
 * **Payee mismatch demo (thread capture):**
 * 1. Main chat: create a draft with “Groceries: oat milk…” (Whole Foods vendor).
 * 2. Open the expense thread → Capture → use “Payee B · Uber ride” → Merge.
 * 3. You should see a thread line `[cofi:payee_mismatch] …` after merge.
 */
export const PARSE_DUMMY_TEST_SNIPPETS: ParseTestSnippet[] = [
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
