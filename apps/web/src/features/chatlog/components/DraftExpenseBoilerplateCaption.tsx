import type { ChatMessage } from "@cofi/api";
import { useEffect, useState } from "react";
import { apiClient } from "../../../shared/lib/apiClient";
import { httpClient } from "../../../shared/lib/httpClient";

/** Compatibility copy from older system draft messages. */
export const LEGACY_DRAFT_TRANSACTION_READY_TEXT =
	"Draft transaction ready. Review and approve/edit/cancel.";
export const LEGACY_DRAFT_EXPENSE_READY_TEXT =
	"Draft expense ready. Review and approve/edit/cancel.";
export const DRAFT_EXPENSE_READY_TEXT =
	"Expense draft ready. Review the capture, then save, edit, or cancel.";

const DRAFT_EXPENSE_SYSTEM_TEXTS = new Set([
	LEGACY_DRAFT_TRANSACTION_READY_TEXT,
	LEGACY_DRAFT_EXPENSE_READY_TEXT,
	DRAFT_EXPENSE_READY_TEXT,
]);

export const isDraftExpenseSystemMessage = (m: ChatMessage) =>
	Boolean(m.related_expense_id) &&
	(m.message_type === "draft_expense" ||
		DRAFT_EXPENSE_SYSTEM_TEXTS.has(m.text.trim()));

/** Bot message created by the recurring scheduler (space chat). */
export const isRecurringExpenseChatMessage = (m: ChatMessage) => {
	if (m.message_type === "recurring_expense") return true;
	// Legacy rows before message_type was specialized
	if (
		m.message_type === "confirmed_expense" &&
		m.text.trim().startsWith("Recurring expense recorded:")
	) {
		return true;
	}
	return false;
};

type ExpenseLite = { status?: string };

const loadExpenseStatus = async (
	expenseId: string | number,
	spaceId?: string | number,
) => {
	if (spaceId != null) {
		return (await apiClient.spaces.expenses.get(spaceId, expenseId)).status;
	}
	return (
		await httpClient.get<ExpenseLite>(
			`/api/v1/finances/expenses/${String(expenseId)}`,
		)
	).data?.status;
};

export const DraftExpenseBoilerplateCaption = ({
	expenseId,
	spaceId,
	serverText,
	relatedExpenseStatus,
}: {
	expenseId: string | number;
	spaceId?: string | number;
	serverText: string;
	/** From chat list payload — avoids GET when present (e.g. `gone` after delete). */
	relatedExpenseStatus?: string;
}) => {
	const [status, setStatus] = useState<string | undefined>(undefined);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (relatedExpenseStatus !== undefined && relatedExpenseStatus !== "") {
			setLoading(false);
			if (
				relatedExpenseStatus === "gone" ||
				relatedExpenseStatus === "inaccessible"
			) {
				setStatus(undefined);
				return;
			}
			setStatus(relatedExpenseStatus);
			return;
		}
		let cancelled = false;
		const run = async () => {
			setLoading(true);
			try {
				const nextStatus = await loadExpenseStatus(expenseId, spaceId);
				if (!cancelled) setStatus(nextStatus);
			} catch {
				if (!cancelled) setStatus(undefined);
			} finally {
				if (!cancelled) setLoading(false);
			}
		};
		void run();
		return () => {
			cancelled = true;
		};
	}, [expenseId, relatedExpenseStatus, spaceId]);

	if (loading) return null;

	if (status === "draft") {
		return (
			<div className="whitespace-pre-wrap text-sm text-foreground">
				{DRAFT_EXPENSE_SYSTEM_TEXTS.has(serverText.trim())
					? DRAFT_EXPENSE_READY_TEXT
					: serverText}
			</div>
		);
	}

	if (status === "approved") {
		return (
			<div className="text-xs text-muted-foreground">
				This expense was confirmed.
			</div>
		);
	}

	// Cancelled: no duplicate line — `DraftExpenseCard` shows a collapsed summary + expand.
	if (status === "cancelled") {
		return null;
	}

	return null;
};
