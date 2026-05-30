import type { ChatMessage } from "@cofi/api";
import { useMemo } from "react";
import type { ChatWorkspaceScope } from "../../../shared/lib/chatWorkspaceScope";
import { userMessageAccent } from "../lib/userMessageAccent";
import {
	isDraftExpenseSystemMessage,
	isRecurringExpenseChatMessage,
} from "./DraftExpenseBoilerplateCaption";
import { DraftExpenseCard } from "./DraftExpenseCard";
import { ExpenseMessageCard } from "./ExpenseMessageCard";
import {
	type ThreadDeepLink,
	ThreadDiscussionRichText,
} from "./ThreadDiscussionRichText";

type NativeChatMessageListProps = {
	canDeleteMessage: (message: ChatMessage) => boolean;
	canEditMessage: (message: ChatMessage) => boolean;
	chatWorkspace: ChatWorkspaceScope;
	editingMessageId: string | number | null;
	editingMessageText: string;
	formatDateTime: (value: string) => string;
	getMessageSenderLabel: (message: ChatMessage) => string;
	isLoading: boolean;
	messages: ChatMessage[] | null;
	onCancelEditMessage: () => void;
	onDeleteMessageRequest: (message: ChatMessage) => void;
	onEditMessageTextChange: (text: string) => void;
	onOpenExpenseThread: (expenseId: string | number) => void;
	onOpenThreadLink: (link: ThreadDeepLink) => void;
	onRelatedResourceGone: (messageId: string | number) => void;
	onSaveEditMessage: () => void;
	onStartEditMessage: (message: ChatMessage) => void;
	selectedSpaceId: string | number;
	sidebarThreadExpenseId: string | number | null;
};

export const NativeChatMessageList = ({
	canDeleteMessage,
	canEditMessage,
	chatWorkspace,
	editingMessageId,
	editingMessageText,
	formatDateTime,
	getMessageSenderLabel,
	isLoading,
	messages,
	onCancelEditMessage,
	onDeleteMessageRequest,
	onEditMessageTextChange,
	onOpenExpenseThread,
	onOpenThreadLink,
	onRelatedResourceGone,
	onSaveEditMessage,
	onStartEditMessage,
	selectedSpaceId,
	sidebarThreadExpenseId,
}: NativeChatMessageListProps) => {
	const expenseRenderMeta = useMemo(() => {
		const latestIndexByKey = new Map<string, number>();
		const updatesByKey = new Map<
			string,
			Array<{
				state: "draft" | "approved" | "needs_review";
				timestamp?: string | null;
				note?: string | null;
			}>
		>();
		for (let i = 0; i < (messages?.length ?? 0); i += 1) {
			const m = messages?.[i];
			if (!m) continue;
			const relatedId = m.related_transaction_id ?? m.related_expense_id;
			if (relatedId == null) continue;
			const key = String(relatedId);
			latestIndexByKey.set(key, i);
			const raw = (m.related_expense_status ?? "").toLowerCase();
			const state: "draft" | "approved" | "needs_review" =
				m.related_transaction_id != null || raw === "approved"
					? "approved"
					: raw === "draft"
						? "draft"
						: raw.includes("pending") || raw.includes("review")
							? "needs_review"
							: "draft";
			const note =
				state === "approved" && (updatesByKey.get(key)?.length ?? 0) > 0
					? "Updated after confirmation"
					: state === "needs_review"
						? "Needs agreement"
						: null;
			const list = updatesByKey.get(key) ?? [];
			list.push({
				state,
				timestamp: m.created_at ?? null,
				note,
			});
			updatesByKey.set(key, list);
		}
		return { latestIndexByKey, updatesByKey };
	}, [messages]);

	if (messages?.length) {
		return messages.map((m, idx) => {
			const isUser = m.sender_type === "user";
			const accent = isUser ? userMessageAccent(m.user_id) : null;
			const showCaptionAboveExpense =
				Boolean(m.related_transaction_id || m.related_expense_id) &&
				Boolean(m.text?.trim()) &&
				!isRecurringExpenseChatMessage(m) &&
				!isDraftExpenseSystemMessage(m) &&
				!(
					editingMessageId != null && String(editingMessageId) === String(m.id)
				);
			const isRelatedSelected =
				sidebarThreadExpenseId != null &&
				((m.related_expense_id != null &&
					String(m.related_expense_id) === String(sidebarThreadExpenseId)) ||
					(m.related_transaction_id != null &&
						String(m.related_transaction_id) ===
							String(sidebarThreadExpenseId)));
			const hasExpenseAttachment = Boolean(
				m.related_expense_id || m.related_transaction_id,
			);
			const messageDateKey = m.created_at
				? new Date(m.created_at).toDateString()
				: "";
			const prev = idx > 0 ? messages[idx - 1] : null;
			const prevDateKey =
				prev?.created_at != null
					? new Date(prev.created_at).toDateString()
					: "";
			const showDaySeparator = idx === 0 || messageDateKey !== prevDateKey;
			const dateLabel = (() => {
				if (!m.created_at) return "";
				const d = new Date(m.created_at);
				const today = new Date();
				const y = new Date();
				y.setDate(today.getDate() - 1);
				if (d.toDateString() === today.toDateString()) return "Today";
				if (d.toDateString() === y.toDateString()) return "Yesterday";
				return d.toLocaleDateString(undefined, {
					month: "short",
					day: "numeric",
				});
			})();
			const currentRelatedId =
				m.related_expense_id != null
					? String(m.related_expense_id)
					: m.related_transaction_id != null
						? String(m.related_transaction_id)
						: null;
			const prevRelatedId =
				prev?.related_expense_id != null
					? String(prev.related_expense_id)
					: prev?.related_transaction_id != null
						? String(prev.related_transaction_id)
						: null;
			const sameRelatedAsPrev =
				currentRelatedId != null &&
				prevRelatedId != null &&
				currentRelatedId === prevRelatedId;
			const isLatestForExpense =
				currentRelatedId == null
					? true
					: expenseRenderMeta.latestIndexByKey.get(currentRelatedId) === idx;
			const groupedUpdates =
				currentRelatedId == null
					? []
					: (expenseRenderMeta.updatesByKey.get(currentRelatedId) ?? []);
			const inspectorOpen = sidebarThreadExpenseId != null;
			// Chat cards are compact event summaries. Detailed expense work belongs to the shared inspector or review flow.
			if (
				hasExpenseAttachment &&
				!isLatestForExpense &&
				!showCaptionAboveExpense &&
				!m.text?.trim()
			) {
				return null;
			}

			return (
				<div
					className={sameRelatedAsPrev ? "space-y-0.5" : "space-y-1"}
					key={String(m.id)}
				>
					{showDaySeparator ? (
						<div className="flex items-center py-0.5">
							<div className="h-px flex-1 bg-border/45" />
							<span className="px-2 text-[10px] font-medium text-muted-foreground">
								{dateLabel}
							</span>
							<div className="h-px flex-1 bg-border/45" />
						</div>
					) : null}
					{sameRelatedAsPrev && hasExpenseAttachment ? (
						<div className="ml-2.5 h-2 w-px bg-[rgba(120,100,80,0.26)]" />
					) : null}
					<div
						className={["flex", isUser ? "justify-end" : "justify-start"].join(
							" ",
						)}
					>
						<div
							className={[
								"group relative transition-colors",
								hasExpenseAttachment
									? "max-w-[min(780px,95%)]"
									: isUser
										? "max-w-[min(620px,88%)]"
										: "max-w-[min(700px,92%)]",
								hasExpenseAttachment
									? "space-y-1 px-0 py-0"
									: "space-y-2 rounded-xl border px-4 py-3 shadow-sm",
								hasExpenseAttachment
									? ""
									: isUser
										? "border-primary/35 bg-primary/[0.16]"
										: "border-[rgba(120,100,80,0.18)] bg-[rgba(255,252,246,0.94)]",
								isRelatedSelected
									? hasExpenseAttachment
										? "border-l-2 border-l-[rgba(120,98,62,0.45)] pl-2"
										: "border-[rgba(120,98,62,0.38)] bg-[rgba(255,248,235,0.96)]"
									: "",
							].join(" ")}
							style={
								isUser && accent && !hasExpenseAttachment
									? {
											borderLeftWidth: 4,
											borderLeftStyle: "solid",
											borderLeftColor: accent.borderLeftColor,
											backgroundColor: accent.surface,
										}
									: undefined
							}
						>
							<div className="flex items-center justify-between gap-2">
								{hasExpenseAttachment ? (
									<span />
								) : (
									<div className="min-w-0 text-[10px] font-semibold text-foreground">
										{getMessageSenderLabel(m)}
									</div>
								)}
								<div className="flex shrink-0 items-center gap-2">
									{canEditMessage(m) ? (
										<button
											aria-label="Edit message"
											className="rounded px-1.5 py-0.5 text-[10px] font-medium text-primary opacity-0 transition-opacity hover:bg-primary/10 group-hover:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
											onClick={() => onStartEditMessage(m)}
											title="Edit message"
											type="button"
										>
											Edit
										</button>
									) : null}
									{canDeleteMessage(m) ? (
										<button
											aria-label="Delete message"
											className="rounded px-1.5 py-0.5 text-[10px] font-medium text-destructive opacity-0 transition-opacity hover:bg-destructive/10 group-hover:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
											onClick={() => onDeleteMessageRequest(m)}
											title="Delete message"
											type="button"
										>
											Delete
										</button>
									) : null}
									<div className="text-[10px] text-muted-foreground">
										{m.created_at ? formatDateTime(m.created_at) : ""}
									</div>
								</div>
							</div>

							{showCaptionAboveExpense ? (
								<div className="whitespace-pre-wrap text-sm text-foreground">
									<ThreadDiscussionRichText
										body={m.text ?? ""}
										expenseId={null}
										onJumpToLine={() => {}}
										onOpenThreadLink={onOpenThreadLink}
										spaceId={selectedSpaceId}
									/>
								</div>
							) : null}

							{m.related_transaction_id && isLatestForExpense ? (
								<ExpenseMessageCard
									chatWorkspace={chatWorkspace}
									compact
									inspectorOpen={inspectorOpen}
									isSelected={isRelatedSelected}
									onOpenExpenseThread={onOpenExpenseThread}
									onTransactionOrphaned={() => onRelatedResourceGone(m.id)}
									spaceId={selectedSpaceId}
									transactionId={m.related_transaction_id}
									updates={groupedUpdates}
								/>
							) : null}

							{m.related_expense_id && isLatestForExpense ? (
								<DraftExpenseCard
									chatWorkspace={chatWorkspace}
									compact
									expenseId={m.related_expense_id}
									inspectorOpen={inspectorOpen}
									isSelected={isRelatedSelected}
									onExpenseOrphaned={() => onRelatedResourceGone(m.id)}
									onOpenExpenseThread={onOpenExpenseThread}
									originMessageId={m.id}
									relatedExpenseStatusHint={m.related_expense_status}
									spaceId={selectedSpaceId}
								/>
							) : null}

							{canEditMessage(m) &&
							editingMessageId != null &&
							String(editingMessageId) === String(m.id) ? (
								<div className="mt-2 space-y-2">
									<label className="grid gap-1">
										<span className="sr-only">Edit message</span>
										<textarea
											className="min-h-[5rem] w-full resize-y rounded-md border border-border bg-background p-2 text-sm text-foreground"
											onChange={(e) => onEditMessageTextChange(e.target.value)}
											rows={5}
											value={editingMessageText}
										/>
									</label>
									<div className="flex flex-wrap gap-2">
										<button
											className="rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
											onClick={onSaveEditMessage}
											type="button"
										>
											Save
										</button>
										<button
											className="rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-accent"
											onClick={onCancelEditMessage}
											type="button"
										>
											Cancel
										</button>
									</div>
								</div>
							) : isRecurringExpenseChatMessage(m) ? (
								<div className="space-y-1">
									<p className="text-[11px] font-semibold uppercase tracking-wide text-primary/90">
										Recurring schedule
									</p>
									<div className="whitespace-pre-wrap text-sm text-foreground">
										<ThreadDiscussionRichText
											body={m.text ?? ""}
											expenseId={null}
											onJumpToLine={() => {}}
											onOpenThreadLink={onOpenThreadLink}
											spaceId={selectedSpaceId}
										/>
									</div>
								</div>
							) : isDraftExpenseSystemMessage(
									m,
								) ? null : showCaptionAboveExpense ? null : (
								<div className="whitespace-pre-wrap text-sm text-foreground">
									<ThreadDiscussionRichText
										body={m.text ?? ""}
										expenseId={null}
										onJumpToLine={() => {}}
										onOpenThreadLink={onOpenThreadLink}
										spaceId={selectedSpaceId}
									/>
								</div>
							)}
						</div>
					</div>
				</div>
			);
		});
	}

	if (isLoading) {
		return (
			<div className="rounded-xl border border-[rgba(120,100,80,0.16)] bg-[rgba(255,252,246,0.9)] px-4 py-3 text-sm text-muted-foreground">
				Loading conversation…
			</div>
		);
	}

	return (
		<div className="rounded-xl border border-[rgba(120,100,80,0.16)] bg-[rgba(255,252,246,0.9)] px-4 py-3 text-sm text-muted-foreground">
			<p className="font-medium text-foreground/85">
				Start with a quick expense note:
			</p>
			<p className="mt-1 text-xs">
				Coffee 4.50 · Taxi home 500 · Split dinner with Natalia
			</p>
		</div>
	);
};
