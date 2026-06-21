import { useState } from "react";
import { apiClient } from "../../../shared/lib/apiClient";
import { isNotFoundHttpError } from "../../../shared/lib/apiErrors";

export type ExpenseInlineActionsProps = {
	/** Expense record id. */
	expenseId: string | number;
	/** Space context for canonical space-owned expense record actions. */
	spaceId: string | number;
	recurringId?: number;
	/** When omitted for a recurring-linked row, Pause is shown. */
	recurringPaused?: boolean;
	onAfterChange?: () => void | Promise<void>;
	/** Called when a delete returns 404 (already removed) so the parent can drop the chat row, etc. */
	onResourceGone?: () => void;
	className?: string;
};

/**
 * Pause/resume schedule (if linked) + delete flows for a single posting.
 * Regular expense records: one delete. Recurring: delete posting, stop schedule, or purge all + schedule.
 */
export const ExpenseInlineActions = ({
	expenseId,
	spaceId,
	recurringId,
	recurringPaused = false,
	onAfterChange,
	onResourceGone,
	className = "",
}: ExpenseInlineActionsProps) => {
	const [isActing, setIsActing] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [infoMessage, setInfoMessage] = useState<string | null>(null);

	const runAfter = async () => {
		if (onAfterChange) await onAfterChange();
	};

	const handlePause = async () => {
		if (recurringId == null) return;
		setErrorMessage(null);
		setInfoMessage(null);
		if (
			!window.confirm(
				"Pause this schedule? Future automatic charges will stop until you resume.",
			)
		) {
			return;
		}
		setIsActing(true);
		try {
			await apiClient.spaces.recurring.pause(spaceId, recurringId);
			await runAfter();
		} catch (e) {
			setErrorMessage(
				e instanceof Error ? e.message : "Could not pause schedule",
			);
		} finally {
			setIsActing(false);
		}
	};

	const handleResume = async () => {
		if (recurringId == null) return;
		setErrorMessage(null);
		setInfoMessage(null);
		setIsActing(true);
		try {
			await apiClient.spaces.recurring.resume(spaceId, recurringId);
			await runAfter();
		} catch (e) {
			setErrorMessage(
				e instanceof Error ? e.message : "Could not resume schedule",
			);
		} finally {
			setIsActing(false);
		}
	};

	const handleDeleteExpenseRecordOnly = async () => {
		setErrorMessage(null);
		setInfoMessage(null);
		if (!window.confirm("Delete this expense record? This cannot be undone.")) {
			return;
		}
		setIsActing(true);
		try {
			await apiClient.spaces.expenses.delete(spaceId, expenseId);
			await runAfter();
		} catch (e) {
			if (isNotFoundHttpError(e)) {
				setInfoMessage(
					"This expense record was already removed or is no longer available.",
				);
				if (onResourceGone) {
					onResourceGone();
				} else {
					await runAfter();
				}
			} else {
				setErrorMessage(
					e instanceof Error ? e.message : "Could not delete expense record",
				);
			}
		} finally {
			setIsActing(false);
		}
	};

	const handleDeleteRecurringPostingOnly = async () => {
		if (recurringId == null) return;
		setErrorMessage(null);
		setInfoMessage(null);
		if (
			!window.confirm(
				"This posting came from a recurring schedule.\n\nDelete only this expense posting? The schedule will keep running for future dates.",
			)
		) {
			return;
		}
		setIsActing(true);
		try {
			await apiClient.spaces.expenses.delete(spaceId, expenseId);
			await runAfter();
		} catch (e) {
			if (isNotFoundHttpError(e)) {
				setInfoMessage(
					"This expense record was already removed or is no longer available.",
				);
				if (onResourceGone) {
					onResourceGone();
				} else {
					await runAfter();
				}
			} else {
				setErrorMessage(
					e instanceof Error ? e.message : "Could not delete expense record",
				);
			}
		} finally {
			setIsActing(false);
		}
	};

	const handleStopScheduleKeepPast = async () => {
		if (recurringId == null) return;
		setErrorMessage(null);
		setInfoMessage(null);
		if (
			!window.confirm(
				"Delete the recurring schedule? Future automatic charges will stop. Past expense records stay in your history.",
			)
		) {
			return;
		}
		setIsActing(true);
		try {
			await apiClient.spaces.recurring.remove(spaceId, recurringId);
			await runAfter();
		} catch (e) {
			if (isNotFoundHttpError(e)) {
				setInfoMessage(
					"This schedule was already removed or is no longer available.",
				);
				if (onResourceGone) {
					onResourceGone();
				} else {
					await runAfter();
				}
			} else {
				setErrorMessage(
					e instanceof Error ? e.message : "Could not delete schedule",
				);
			}
		} finally {
			setIsActing(false);
		}
	};

	const hasRecurring = recurringId != null && Number(recurringId) > 0;

	return (
		<div className={`space-y-2 ${className}`.trim()}>
			{hasRecurring ? (
				<div className="flex flex-wrap items-center gap-1.5">
					<span className="text-[10px] font-medium text-muted-foreground">
						Schedule
					</span>
					{recurringPaused ? (
						<button
							aria-label="Resume recurring schedule"
							className="inline-flex h-8 items-center rounded-md border border-border px-2 text-[10px] font-semibold hover:bg-accent disabled:opacity-50"
							disabled={isActing}
							onClick={() => void handleResume()}
							type="button"
						>
							{isActing ? "…" : "Resume"}
						</button>
					) : (
						<button
							aria-label="Pause recurring schedule"
							className="inline-flex h-8 items-center rounded-md border border-border px-2 text-[10px] font-semibold hover:bg-accent disabled:opacity-50"
							disabled={isActing}
							onClick={() => void handlePause()}
							type="button"
						>
							{isActing ? "…" : "Pause"}
						</button>
					)}
				</div>
			) : null}

			<div className="space-y-1.5">
				<div className="text-[10px] font-medium text-muted-foreground">
					Expense record
				</div>
				{hasRecurring ? (
					<div className="flex flex-col gap-1.5">
						<button
							aria-label="Delete only this posting"
							className="inline-flex h-8 items-center justify-center rounded-md border border-destructive/40 px-2 text-left text-[10px] font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
							disabled={isActing}
							onClick={() => void handleDeleteRecurringPostingOnly()}
							type="button"
						>
							Delete this posting only
						</button>
						<button
							aria-label="Stop schedule and keep past expense records"
							className="inline-flex h-8 items-center justify-center rounded-md border border-border px-2 text-[10px] font-semibold hover:bg-accent disabled:opacity-50"
							disabled={isActing}
							onClick={() => void handleStopScheduleKeepPast()}
							type="button"
						>
							Stop schedule (keep past)
						</button>
					</div>
				) : (
					<button
						aria-label="Delete expense record"
						className="inline-flex h-8 items-center rounded-md border border-destructive/40 px-2 text-[10px] font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
						disabled={isActing}
						onClick={() => void handleDeleteExpenseRecordOnly()}
						type="button"
					>
						{isActing ? "…" : "Delete"}
					</button>
				)}
			</div>

			{infoMessage ? (
				<div className="text-[10px] text-muted-foreground">{infoMessage}</div>
			) : null}
			{errorMessage ? (
				<div className="text-[10px] text-destructive">{errorMessage}</div>
			) : null}
		</div>
	);
};
