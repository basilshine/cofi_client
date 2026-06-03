import type { ChatMessage } from "@cofi/api";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { ChatWorkspaceScope } from "../../../shared/lib/chatWorkspaceScope";
import { EntityMicro } from "../../../shared/lib/entityPresentation";
import { userMessageAccent } from "../lib/userMessageAccent";
import { ChatMediaAttachment } from "./ChatMediaAttachment";
import {
	ChatMessageRichText,
	type LegacyReviewDeepLink,
} from "./ChatMessageRichText";
import {
	isDraftExpenseSystemMessage,
	isRecurringExpenseChatMessage,
} from "./DraftExpenseBoilerplateCaption";
import { DraftExpenseCard } from "./DraftExpenseCard";
import { ExpenseMessageCard } from "./ExpenseMessageCard";

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
	onOpenExpenseDetail: (expenseId: string | number) => void;
	onOpenLegacyReviewLink: (link: LegacyReviewDeepLink) => void;
	onRelatedResourceGone: (messageId: string | number) => void;
	onSaveEditMessage: () => void;
	onStartEditMessage: (message: ChatMessage) => void;
	selectedSpaceId: string | number;
	selectedExpenseId: string | number | null;
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
	onOpenExpenseDetail,
	onOpenLegacyReviewLink,
	onRelatedResourceGone,
	onSaveEditMessage,
	onStartEditMessage,
	selectedSpaceId,
	selectedExpenseId,
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
				selectedExpenseId != null &&
				((m.related_expense_id != null &&
					String(m.related_expense_id) === String(selectedExpenseId)) ||
					(m.related_transaction_id != null &&
						String(m.related_transaction_id) === String(selectedExpenseId)));
			const relatedExpenseStatus = (
				m.related_expense_status ?? ""
			).toLowerCase();
			const hasGoneRelatedResource = relatedExpenseStatus === "gone";
			const hasExpenseAttachment =
				!hasGoneRelatedResource &&
				Boolean(m.related_expense_id || m.related_transaction_id);
			const hasMediaAttachment = Boolean(
				m.media_id &&
					(m.media_kind === "image" ||
						m.media_content_type?.startsWith("image/")),
			);
			const hasCaptureContext = Boolean(
				m.source_document_id || hasMediaAttachment || hasExpenseAttachment,
			);
			const hasRemovedCaptureReview =
				hasMediaAttachment &&
				m.source_document_id == null &&
				!hasExpenseAttachment;
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
			const currentRelatedId = hasGoneRelatedResource
				? null
				: m.related_expense_id != null
					? String(m.related_expense_id)
					: m.related_transaction_id != null
						? String(m.related_transaction_id)
						: null;
			const reviewCaptureUrl =
				m.source_document_id != null
					? `/console/review?spaceId=${encodeURIComponent(String(selectedSpaceId))}&sourceDocumentId=${encodeURIComponent(String(m.source_document_id))}`
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
			const inspectorOpen = selectedExpenseId != null;
			// Chat cards are compact event summaries. Detailed expense work belongs to the shared inspector or review flow.
			if (
				hasExpenseAttachment &&
				!isLatestForExpense &&
				!showCaptionAboveExpense &&
				!m.text?.trim()
			) {
				return null;
			}
			if (
				hasGoneRelatedResource &&
				!m.source_document_id &&
				!hasMediaAttachment &&
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
								hasExpenseAttachment || hasMediaAttachment
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
									{reviewCaptureUrl ? (
										<Link
											className="rounded-full border border-[rgba(120,100,80,0.18)] bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-foreground/75 transition hover:bg-white hover:text-foreground"
											to={reviewCaptureUrl}
										>
											Review capture
										</Link>
									) : null}
									{canEditMessage(m) && !hasCaptureContext ? (
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
									{canDeleteMessage(m) && !hasCaptureContext ? (
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
									<ChatMessageRichText
										body={m.text ?? ""}
										expenseId={null}
										onJumpToLine={() => {}}
										onOpenLegacyReviewLink={onOpenLegacyReviewLink}
										spaceId={selectedSpaceId}
									/>
								</div>
							) : null}

							{hasMediaAttachment && m.media_id ? (
								<ChatMediaAttachment
									contentType={m.media_content_type}
									filename={m.media_filename}
									mediaId={m.media_id}
									mediaKind={m.media_kind}
								/>
							) : null}

							{hasRemovedCaptureReview ? (
								<div className="rounded-lg border border-[rgba(120,100,80,0.16)] bg-white/62 px-3 py-2 text-xs text-muted-foreground">
									<EntityMicro
										entity={{
											label: "Capture review removed",
											visualKey: "reviewPacket",
										}}
									/>
									<p className="mt-1">
										This message still keeps the uploaded media, but the parsed
										review packet was removed from this space.
									</p>
								</div>
							) : null}

							{hasExpenseAttachment &&
							m.related_transaction_id &&
							isLatestForExpense ? (
								<ExpenseMessageCard
									chatWorkspace={chatWorkspace}
									compact
									inspectorOpen={inspectorOpen}
									isSelected={isRelatedSelected}
									onOpenExpenseDetail={onOpenExpenseDetail}
									onTransactionOrphaned={() => onRelatedResourceGone(m.id)}
									spaceId={selectedSpaceId}
									sourceDocumentId={m.source_document_id}
									transactionId={m.related_transaction_id}
									updates={groupedUpdates}
								/>
							) : null}

							{hasExpenseAttachment &&
							m.related_expense_id &&
							isLatestForExpense ? (
								<DraftExpenseCard
									chatWorkspace={chatWorkspace}
									compact
									expenseId={m.related_expense_id}
									inspectorOpen={inspectorOpen}
									isSelected={isRelatedSelected}
									onExpenseOrphaned={() => onRelatedResourceGone(m.id)}
									onOpenExpenseDetail={onOpenExpenseDetail}
									originMessageId={m.id}
									relatedExpenseStatusHint={m.related_expense_status}
									spaceId={selectedSpaceId}
									sourceDocumentId={m.source_document_id}
								/>
							) : null}

							{canEditMessage(m) &&
							!hasCaptureContext &&
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
									<EntityMicro
										entity={{ label: "Recurring", visualKey: "future" }}
									/>
									<div className="whitespace-pre-wrap text-sm text-foreground">
										<ChatMessageRichText
											body={m.text ?? ""}
											expenseId={null}
											onJumpToLine={() => {}}
											onOpenLegacyReviewLink={onOpenLegacyReviewLink}
											spaceId={selectedSpaceId}
										/>
									</div>
								</div>
							) : isDraftExpenseSystemMessage(
									m,
								) ? null : showCaptionAboveExpense ? null : (
								<div className="whitespace-pre-wrap text-sm text-foreground">
									<ChatMessageRichText
										body={m.text ?? ""}
										expenseId={null}
										onJumpToLine={() => {}}
										onOpenLegacyReviewLink={onOpenLegacyReviewLink}
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
