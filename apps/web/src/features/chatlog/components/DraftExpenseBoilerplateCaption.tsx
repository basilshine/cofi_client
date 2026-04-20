import type { ChatMessage } from "@cofi/api";
import { useEffect, useState } from "react";
import { httpClient } from "../../../shared/lib/httpClient";

/** Matches server copy in cofi_server chat_transactions handler (system draft message). */
export const DRAFT_TRANSACTION_READY_TEXT =
	"Draft transaction ready. Review and approve/edit/cancel.";

export const isDraftExpenseSystemMessage = (m: ChatMessage) =>
	Boolean(m.related_expense_id) &&
	(m.message_type === "draft_expense" ||
		m.text.trim() === DRAFT_TRANSACTION_READY_TEXT);

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

export const DraftExpenseBoilerplateCaption = ({
	expenseId,
	serverText,
	relatedExpenseStatus,
}: {
	expenseId: string | number;
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
				const res = await httpClient.get<ExpenseLite>(
					`/api/v1/finances/expenses/${String(expenseId)}`,
				);
				if (!cancelled) setStatus(res.data?.status);
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
	}, [expenseId, relatedExpenseStatus]);

	if (loading) return null;

	if (status === "draft") {
		return (
			<div className="whitespace-pre-wrap text-sm text-foreground">
				{serverText}
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
