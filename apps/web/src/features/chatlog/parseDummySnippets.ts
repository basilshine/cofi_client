import { PARSE_DUMMY_TEST_SNIPPETS as SHARED_PARSE_DUMMY_TEST_SNIPPETS } from "../../shared/lib/parseDummySnippets";
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
export const PARSE_DUMMY_TEST_SNIPPETS: ParseTestSnippet[] =
	SHARED_PARSE_DUMMY_TEST_SNIPPETS;
