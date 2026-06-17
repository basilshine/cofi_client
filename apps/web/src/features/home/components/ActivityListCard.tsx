import {
	ArrowDownToLine,
	Check,
	ListChecks,
	type LucideIcon,
	PencilLine,
	ScanLine,
} from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
	EntityMicro,
	type EntityViewModel,
} from "../../../shared/lib/entityPresentation";

const sectionCard =
	"rounded-2xl border border-border/70 bg-card text-card-foreground soft-shadow inner-glow";

const sectionHeading =
	"flex items-center justify-between gap-3 border-b border-border/50 px-6 py-4";

const sectionTitle =
	"text-lg font-semibold tracking-tight text-foreground sm:text-xl";

const sectionEyebrow = "eyebrow";

type ActivityItem = {
	id: string | number;
	title: string;
	spaceName: string;
	timeLabel: string;
	occurredAt?: string | null;
	statusLabel: string;
	amountLabel?: string;
	statusPillLabel?: string;
	/** One short line of “why this matters” (e.g. Space Overview). */
	meaningLine?: string | null;
	categoryLabel?: string;
	answerPreview?: string | null;
	nextDueLabel?: string | null;
	itemPreview?: string[];
	previewNote?: string | null;
	sourceDocumentId?: number | null;
	sourceCaptureTo?: string | null;
	eventType?:
		| "expense"
		| "draft"
		| "edited"
		| "split-assigned"
		| "recurring-created"
		| "benefit"
		| "participant"
		| "capture"
		| "question"
		| "recurring"
		| "receipt"
		| "voice";
	to: string;
};

type ActivityListCardProps = {
	title: string;
	eyebrow?: string;
	emptyText: string;
	emptySubtext?: string;
	items: ActivityItem[];
	ctaLabel: string;
	ctaTo: string;
	linkState?: unknown;
	/** Warmer surface + stronger row affordances (Space Overview). */
	surfaceVariant?: "default" | "spaceWarm";
	/** Group into “Needs you” vs “Recorded” instead of time buckets. */
	streamGroupByAttention?: boolean;
	/** When the decision-queue CTA is hovered, emphasize matching rows. */
	railHighlightActive?: boolean;
	railHighlightMode?: "splits" | "drafts" | "bills" | "none";
	/** Optional anchor id (e.g. link from rail hint). */
	activityAnchorId?: string;
	/** Whether the list represents one space or a cross-space dashboard. */
	scope?: "global" | "space";
};

type TimeGroupKey = "today" | "yesterday" | "earlier";

const activityEntityFor = (
	item: ActivityItem,
): Pick<EntityViewModel, "label" | "visualKey"> => {
	if (item.eventType === "capture") {
		return { label: "Capture", visualKey: "reviewPacket" };
	}
	if (item.eventType === "split-assigned") {
		return { label: "Split", visualKey: "split" };
	}
	if (item.eventType === "benefit") {
		return { label: "Benefit", visualKey: "benefit" };
	}
	if (item.eventType === "participant") {
		return { label: "Person", visualKey: "people" };
	}
	if (
		item.eventType === "recurring" ||
		item.eventType === "recurring-created"
	) {
		return { label: "Future", visualKey: "future" };
	}
	if (item.eventType === "receipt") {
		return { label: "Document", visualKey: "document" };
	}
	if (item.eventType === "question") {
		return { label: "Signal", visualKey: "unknown" };
	}
	return { label: "Expense", visualKey: "expense" };
};

const toTimeGroup = (occurredAt?: string | null): TimeGroupKey => {
	if (!occurredAt) return "earlier";
	const parsed = new Date(occurredAt);
	if (Number.isNaN(parsed.getTime())) return "earlier";
	const now = new Date();
	const startOfToday = new Date(
		now.getFullYear(),
		now.getMonth(),
		now.getDate(),
	).getTime();
	const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
	const timestamp = parsed.getTime();
	if (timestamp >= startOfToday) return "today";
	if (timestamp >= startOfYesterday) return "yesterday";
	return "earlier";
};

const timeGroupTitle: Record<TimeGroupKey, string> = {
	today: "Today",
	yesterday: "Yesterday",
	earlier: "Earlier",
};

const normalizeActivityTitle = (title: string, spaceName: string): string => {
	const raw = title.trim();
	if (!raw) return "Activity";
	const loweredSpace = spaceName.trim().toLowerCase();
	const cleaned = raw.replace(/\s+/g, " ");
	const colonIndex = cleaned.indexOf(":");
	if (colonIndex > 0 && colonIndex < cleaned.length - 1) {
		const prefix = cleaned.slice(0, colonIndex).trim().toLowerCase();
		const suffix = cleaned.slice(colonIndex + 1).trim();
		const genericPrefixes = new Set([
			"expense",
			"groceries",
			"home & bills",
			"subscription",
			"receipt",
			"voice",
		]);
		if (prefix === loweredSpace || genericPrefixes.has(prefix)) return suffix;
	}
	if (cleaned.toLowerCase().startsWith(`${loweredSpace} - `)) {
		return cleaned.slice(spaceName.length + 3).trim();
	}
	if (cleaned.toLowerCase().startsWith(`${loweredSpace} · `)) {
		return cleaned.slice(spaceName.length + 3).trim();
	}
	return cleaned;
};

const isVeryRecent = (occurredAt?: string | null): boolean => {
	if (!occurredAt) return false;
	const ts = Date.parse(occurredAt);
	if (!Number.isFinite(ts)) return false;
	return Date.now() - ts <= 45 * 60 * 1000;
};

const toDisplayDate = (
	occurredAt?: string | null,
	fallback?: string,
): string => {
	if (!occurredAt) return fallback ?? "—";
	const parsed = new Date(occurredAt);
	if (Number.isNaN(parsed.getTime())) return fallback ?? occurredAt;
	return parsed.toLocaleString(undefined, {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
};

const buildQueryAnswerPreview = (item: ActivityItem): string => {
	if (item.answerPreview?.trim()) return item.answerPreview.trim();
	if (item.amountLabel?.trim()) {
		return `You spent ${item.amountLabel.trim()} on this topic recently.`;
	}
	return "You spent $124 on food last week.";
};

const extractReceiptItemCount = (item: ActivityItem): number | null => {
	if (item.itemPreview?.length) return item.itemPreview.length;
	const match = item.title.match(/(\d+)\s*(?:items?|lines?)/i);
	if (!match) return null;
	const parsed = Number.parseInt(match[1], 10);
	return Number.isFinite(parsed) ? parsed : null;
};

const extractReceiptMerchant = (title: string): string => {
	const lower = title.toLowerCase();
	if (lower.includes("wholesale")) return "Wholesale Club";
	if (lower.includes("costco")) return "Costco";
	if (lower.includes("walmart")) return "Walmart";
	if (lower.includes("receipt")) {
		const cleaned = title
			.replace(/receipt/gi, "")
			.replace(/stress test/gi, "")
			.replace(/[-–—]/g, " ")
			.trim();
		return cleaned ? cleaned.split(/\s+/).slice(0, 2).join(" ") : "Receipt";
	}
	return "Receipt";
};

const hashToIndex = (value: string | number, length: number): number => {
	if (length <= 0) return 0;
	const text = String(value);
	let hash = 0;
	for (let index = 0; index < text.length; index += 1) {
		hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
	}
	return hash % length;
};

const getReceiptEventTitle = (
	item: ActivityItem,
	itemCount: number | null,
): string => {
	const variants = [
		"Receipt imported",
		itemCount != null ? `${itemCount} items detected` : "Items detected",
		"Draft created",
		"Ready for review",
	];
	return variants[
		hashToIndex(`${item.id}:${item.statusLabel}`, variants.length)
	];
};

const isNeedsReviewStatus = (status: string): boolean => {
	const lower = status.toLowerCase();
	return (
		lower.includes("review") ||
		lower.includes("pending") ||
		lower.includes("not saved")
	);
};

const isDraftStatus = (status: string): boolean => {
	const lower = status.toLowerCase();
	return lower.includes("draft") || lower.includes("not saved");
};

const isConfirmedStatus = (status: string): boolean => {
	const lower = status.toLowerCase();
	return lower.includes("confirmed") || lower.includes("approved");
};

/** Pending / actionable rows for Space Overview attention stream. */
const rowNeedsAttention = (item: ActivityItem): boolean => {
	if (item.eventType === "capture") {
		return (
			!isConfirmedStatus(item.statusLabel) &&
			!isConfirmedStatus(item.statusPillLabel ?? "")
		);
	}
	if (item.eventType === "split-assigned") return true;
	if (item.eventType === "draft") return true;
	const sl = item.statusLabel ?? "";
	if (item.eventType === "receipt" && isNeedsReviewStatus(sl)) return true;
	if (isConfirmedStatus(sl)) return false;
	if (isNeedsReviewStatus(sl) || isDraftStatus(sl)) return true;
	if (item.eventType === "question") {
		return isNeedsReviewStatus(sl) || isDraftStatus(sl);
	}
	return false;
};

const rowMatchesRailHighlight = (
	item: ActivityItem,
	mode: "splits" | "drafts" | "bills" | "none",
): boolean => {
	if (mode === "none") return false;
	const labels = `${item.statusLabel ?? ""} ${item.statusPillLabel ?? ""} ${item.meaningLine ?? ""}`;
	if (mode === "splits") {
		return (
			item.eventType === "split-assigned" ||
			/\bsplit\b/i.test(labels) ||
			/\bapproval\b/i.test(labels)
		);
	}
	if (mode === "drafts") {
		return (
			item.eventType === "capture" ||
			item.eventType === "draft" ||
			item.eventType === "receipt" ||
			/\bexpense candidate\b/i.test(labels) ||
			/\bdraft\b/i.test(labels) ||
			/\bneeds review\b/i.test(labels.toLowerCase()) ||
			/\bpending\b/i.test(labels.toLowerCase())
		);
	}
	return false;
};

const buildHoverPreviewHint = (
	item: ActivityItem,
	receiptMerchant: string | null,
	receiptItemCount: number | null,
): string | null => {
	if (item.previewNote?.trim()) return item.previewNote.trim();
	if (item.eventType === "receipt") {
		if (receiptMerchant && receiptItemCount != null) {
			return `Parsed ${receiptItemCount} lines from ${receiptMerchant}`;
		}
		return "Parsed and ready for review";
	}
	if (item.itemPreview && item.itemPreview.length > 0) {
		return `Detected ${item.itemPreview.length} line items`;
	}
	if (item.eventType === "question") {
		return "Includes a generated answer preview";
	}
	if (item.eventType === "capture") {
		return isConfirmedStatus(item.statusLabel) ||
			isConfirmedStatus(item.statusPillLabel ?? "")
			? "Capture records were saved"
			: "Capture is waiting for review";
	}
	return null;
};

const expenseRecordStateLine = (item: ActivityItem): string => {
	if (item.eventType === "draft" || isDraftStatus(item.statusLabel)) {
		return "Draft needs confirmation";
	}
	if (isNeedsReviewStatus(item.statusLabel)) {
		return "Needs capture review";
	}
	if (isConfirmedStatus(item.statusLabel)) {
		return "Saved expense record";
	}
	return "Expense record";
};

const sourceCaptureLabel = (item: ActivityItem): string | null => {
	const sourceDocumentId = item.sourceDocumentId;
	if (
		sourceDocumentId == null ||
		!Number.isFinite(sourceDocumentId) ||
		sourceDocumentId <= 0
	) {
		return null;
	}
	return `Source capture #${sourceDocumentId}`;
};

type ReceiptProcessStep = {
	id: "imported" | "scanned" | "detected" | "draft";
	label: string;
	strong?: boolean;
};

const buildReceiptProcessSteps = (
	itemCount: number | null,
): ReceiptProcessStep[] => [
	{ id: "imported", label: "Imported" },
	{ id: "scanned", label: "Scanned" },
	{
		id: "detected",
		label: itemCount != null ? `${itemCount} items detected` : "Items detected",
	},
	{ id: "draft", label: "Draft created", strong: true },
];

const receiptProcessStepIcons: Record<ReceiptProcessStep["id"], LucideIcon> = {
	imported: ArrowDownToLine,
	scanned: ScanLine,
	detected: ListChecks,
	draft: PencilLine,
};

export const ActivityListCard = ({
	title,
	eyebrow = "Recent",
	emptyText,
	emptySubtext = "Capture an expense or open a space to get started.",
	items,
	ctaLabel,
	ctaTo,
	linkState,
	surfaceVariant = "default",
	streamGroupByAttention = false,
	railHighlightActive = false,
	railHighlightMode = "none",
	activityAnchorId,
	scope = "space",
}: ActivityListCardProps) => {
	const navigate = useNavigate();
	const isSpaceWarm = surfaceVariant === "spaceWarm";
	const isGlobalScope = scope === "global";
	const surfaceSectionClass = isSpaceWarm
		? "rounded-2xl border border-[rgba(95,105,125,0.18)] bg-gradient-to-b from-[#fdfcfa] to-[#f7f5f2] text-card-foreground shadow-[0_10px_32px_-24px_rgba(45,42,38,0.2)] transition-shadow duration-150 hover:shadow-[0_14px_36px_-22px_rgba(45,42,38,0.22)]"
		: `${sectionCard} transition-shadow duration-150 hover:shadow-[0_12px_28px_-20px_rgba(31,37,35,0.12)]`;
	const [expandedId, setExpandedId] = useState<string | number | null>(null);

	const renderExpandedContent = (item: ActivityItem) => {
		const isQuestion = item.eventType === "question";
		const isRecurring =
			item.eventType === "recurring" || item.eventType === "recurring-created";
		const isReceiptParsed = item.eventType === "receipt";
		const isExpenseLike =
			item.eventType === "capture" ||
			item.eventType === "expense" ||
			item.eventType === "draft" ||
			item.eventType === "benefit" ||
			item.eventType === "participant" ||
			item.eventType === "split-assigned" ||
			item.eventType === "receipt" ||
			item.eventType === "voice" ||
			!item.eventType;
		const helperLine =
			item.eventType === "draft"
				? isGlobalScope
					? `Added to ${item.spaceName} as draft`
					: "Added to this space as draft"
				: item.eventType === "capture"
					? isGlobalScope
						? `Waiting in ${item.spaceName} capture review`
						: "Waiting in this space capture review"
					: item.eventType === "voice"
						? "Recorded from voice"
						: item.eventType === "receipt"
							? isGlobalScope
								? `Added to ${item.spaceName} from receipt`
								: "Added to this space from receipt"
							: isGlobalScope
								? `Saved in ${item.spaceName}`
								: "Saved in this space";
		const detailLine = [
			item.categoryLabel,
			item.timeLabel,
			isGlobalScope ? item.spaceName : null,
			sourceCaptureLabel(item),
		]
			.filter(Boolean)
			.join(" · ");

		if (isQuestion) {
			const answerLine = buildQueryAnswerPreview(item);
			const breakdownLine =
				item.previewNote?.trim() ||
				(item.categoryLabel && item.itemPreview?.length
					? `${item.categoryLabel} · ${item.itemPreview.length} expense records`
					: item.categoryLabel
						? `${item.categoryLabel} + ${item.spaceName}`
						: `${item.spaceName} · recent activity`);
			return (
				<div className="space-y-1.5">
					<p className="line-clamp-2 text-[14px] text-foreground/90">
						{answerLine}
					</p>
					<p className="text-[11px] text-foreground/75">{breakdownLine}</p>
					<p className="text-[11px] text-muted-foreground">
						{isGlobalScope ? `${item.spaceName} · ` : ""}
						{toDisplayDate(item.occurredAt, item.timeLabel)}
					</p>
					<div className="flex flex-wrap gap-1.5 pt-1">
						<Link
							className="inline-flex h-7 items-center rounded-full bg-transparent px-2 text-[11px] text-foreground/75 transition hover:bg-background/40 hover:text-foreground"
							state={linkState}
							to={item.to}
						>
							View details
						</Link>
						<Link
							className="inline-flex h-7 items-center rounded-full bg-transparent px-2 text-[11px] text-foreground/75 transition hover:bg-background/40 hover:text-foreground"
							state={linkState}
							to={item.to}
						>
							Open conversation
						</Link>
					</div>
				</div>
			);
		}

		if (isReceiptParsed) {
			const itemCount = extractReceiptItemCount(item);
			const processSteps = buildReceiptProcessSteps(itemCount);
			const needsReview = isNeedsReviewStatus(
				item.statusLabel || "Needs review",
			);
			return (
				<div className="space-y-2">
					<div className="rounded-md bg-white/90 px-2.5 py-1.5 shadow-[0_6px_14px_-16px_rgba(31,37,35,0.55)]">
						<p className="text-[14px] text-foreground/78">
							{isGlobalScope ? `Added to ${item.spaceName}` : "Added here"} ·{" "}
							{needsReview ? "needs review before saving" : "processed"}
						</p>
					</div>
					<div className="rounded-md border border-[rgba(189,143,64,0.14)] bg-white px-2.5 py-2">
						<div className="overflow-x-auto">
							<ul className="inline-flex min-w-max items-center gap-1">
								{processSteps.map((step, index) => {
									const isCurrent = needsReview && step.id === "draft";
									const StepIcon = receiptProcessStepIcons[step.id];
									const shortLabel =
										step.id === "detected" && itemCount != null
											? `${itemCount} items`
											: step.id === "draft"
												? "Draft"
												: step.label;
									return (
										<li
											className="inline-flex items-center gap-1"
											key={step.id}
										>
											<span
												className={`inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border ${
													isCurrent
														? "border-[rgba(189,143,64,0.62)] bg-[rgba(189,143,64,0.88)] text-white"
														: "border-border/55 bg-background/90 text-foreground/60"
												}`}
											>
												<StepIcon
													aria-hidden
													className="h-[0.4rem] w-[0.4rem]"
												/>
											</span>
											<span
												className={`text-[12px] ${
													isCurrent
														? "font-medium text-[rgba(111,78,22,0.95)]"
														: "text-foreground/75"
												}`}
											>
												{shortLabel}
											</span>
											{index < processSteps.length - 1 ? (
												<span
													aria-hidden
													className="mx-0.5 h-px w-2.5 bg-border/40"
												/>
											) : null}
										</li>
									);
								})}
							</ul>
						</div>
					</div>
					<div className="rounded-md bg-white/92 px-2.5 py-1.5">
						<div className="flex flex-wrap gap-1.5">
							<Link
								className="inline-flex h-7 items-center rounded-full bg-[rgba(189,143,64,0.24)] px-3 text-[11px] font-semibold text-[rgba(111,78,22,0.96)] shadow-[0_6px_16px_-14px_rgba(111,78,22,0.8)] transition hover:bg-[rgba(189,143,64,0.32)]"
								state={linkState}
								to={item.to}
							>
								Review receipt
							</Link>
							<Link
								className="inline-flex h-7 items-center rounded-full border border-border/60 bg-background/60 px-3 text-[11px] text-foreground/85 transition hover:bg-background"
								state={linkState}
								to={item.to}
							>
								Split
							</Link>
							<Link
								className="inline-flex h-7 items-center rounded-full bg-transparent px-2 text-[11px] text-foreground/65 transition hover:bg-background/35 hover:text-foreground"
								state={linkState}
								to={item.to}
							>
								Open space
							</Link>
						</div>
					</div>
				</div>
			);
		}

		if (isRecurring) {
			return (
				<div className="space-y-1.5">
					<p className="text-[11px] text-muted-foreground">
						{item.nextDueLabel
							? `Next due ${item.nextDueLabel}`
							: "No due date scheduled"}{" "}
						{isGlobalScope ? `· ${item.spaceName}` : ""}
					</p>
					<p className="text-[11px] text-muted-foreground">
						{isGlobalScope
							? `Recurring in ${item.spaceName}`
							: "Recurring in this space"}
					</p>
					<div className="flex flex-wrap gap-1.5 pt-1">
						<Link
							className="inline-flex h-7 items-center rounded-full border border-border/60 bg-background/50 px-3 text-[11px] text-foreground/80 transition hover:bg-background"
							state={linkState}
							to={item.to}
						>
							Manage
						</Link>
						<Link
							className="inline-flex h-7 items-center rounded-full border border-border/60 bg-background/50 px-3 text-[11px] text-foreground/80 transition hover:bg-background"
							state={linkState}
							to={item.to}
						>
							Open record
						</Link>
						{item.sourceCaptureTo ? (
							<Link
								className="inline-flex h-7 items-center rounded-full border border-[rgba(82,72,57,0.16)] bg-background/70 px-3 text-[11px] font-semibold text-foreground transition hover:bg-background"
								state={linkState}
								to={item.sourceCaptureTo}
							>
								Review capture
							</Link>
						) : null}
					</div>
				</div>
			);
		}

		if (isExpenseLike) {
			if (item.eventType === "capture") {
				const captureConfirmed =
					isConfirmedStatus(item.statusLabel) ||
					isConfirmedStatus(item.statusPillLabel ?? "");
				return (
					<div className="space-y-1.5">
						<p className="truncate text-[11px] text-muted-foreground">
							{detailLine ||
								(isGlobalScope
									? `${item.timeLabel} · ${item.spaceName}`
									: item.timeLabel)}
						</p>
						<p className="text-[11px] text-foreground/75">
							{item.meaningLine || helperLine}
						</p>
						<p className="text-[11px] text-foreground/75">
							{captureConfirmed
								? "Open the source capture to inspect saved records."
								: "Open capture review to decide what becomes records."}
						</p>
						<div className="flex flex-wrap gap-1.5 pt-1">
							<Link
								className={
									captureConfirmed
										? "inline-flex h-7 items-center rounded-full border border-border/60 bg-background/60 px-3 text-[11px] text-foreground/85 transition hover:bg-background"
										: "inline-flex h-7 items-center rounded-full bg-[rgba(189,143,64,0.24)] px-3 text-[11px] font-semibold text-[rgba(111,78,22,0.96)] shadow-[0_6px_16px_-14px_rgba(111,78,22,0.8)] transition hover:bg-[rgba(189,143,64,0.32)]"
								}
								state={linkState}
								to={item.to}
							>
								{captureConfirmed ? "Open capture" : "Review capture"}
							</Link>
						</div>
					</div>
				);
			}
			return (
				<div className="space-y-1.5">
					<p className="truncate text-[11px] text-muted-foreground">
						{detailLine ||
							(isGlobalScope
								? `${item.timeLabel} · ${item.spaceName}`
								: item.timeLabel)}
					</p>
					<p className="text-[11px] text-foreground/75">{helperLine}</p>
					<p className="text-[11px] text-foreground/75">
						{expenseRecordStateLine(item)}
					</p>
					{item.itemPreview && item.itemPreview.length > 0 ? (
						<div className="border-t border-border/35 pt-1.5">
							<ul className="space-y-0.5">
								{item.itemPreview.slice(0, 2).map((line) => (
									<li className="text-sm text-foreground/90" key={line}>
										- {line}
									</li>
								))}
								{item.itemPreview.length > 2 ? (
									<li className="text-xs text-muted-foreground">+ more</li>
								) : null}
							</ul>
						</div>
					) : null}
					{item.previewNote ? (
						<p className="text-xs text-muted-foreground">{item.previewNote}</p>
					) : null}
					<div className="flex flex-wrap gap-1.5 pt-1">
						<Link
							className="inline-flex h-7 items-center rounded-full border border-border/60 bg-background/50 px-3 text-[11px] text-foreground/80 transition hover:bg-background"
							state={linkState}
							to={item.to}
						>
							Open in space
						</Link>
						{item.sourceCaptureTo ? (
							<Link
								className="inline-flex h-7 items-center rounded-full border border-[rgba(82,72,57,0.16)] bg-background/70 px-3 text-[11px] font-semibold text-foreground transition hover:bg-background"
								state={linkState}
								to={item.sourceCaptureTo}
							>
								Review capture
							</Link>
						) : null}
						<Link
							className="inline-flex h-7 items-center rounded-full border border-border/60 bg-background/50 px-3 text-[11px] text-foreground/80 transition hover:bg-background"
							state={linkState}
							to={item.to}
						>
							Adjust
						</Link>
						<Link
							className="inline-flex h-7 items-center rounded-full border border-border/60 bg-background/50 px-3 text-[11px] text-foreground/80 transition hover:bg-background"
							state={linkState}
							to={item.to}
						>
							Split
						</Link>
					</div>
				</div>
			);
		}

		return null;
	};

	const intentionalItems = useMemo(() => {
		const seen = new Set<string>();
		return items.filter((item) => {
			// Only remove true duplicates (same event payload), never collapse
			// distinct events that happen to share destination links.
			const signature = [
				String(item.id),
				item.title,
				item.spaceName,
				item.timeLabel,
				item.occurredAt ?? "",
				item.statusLabel,
				item.amountLabel ?? "",
				item.eventType ?? "",
				item.to,
			].join("|");
			if (seen.has(signature)) return false;
			seen.add(signature);
			return true;
		});
	}, [items]);

	const groupedItems = useMemo(
		() =>
			intentionalItems.reduce<Record<TimeGroupKey, ActivityItem[]>>(
				(acc, item) => {
					const key = toTimeGroup(item.occurredAt);
					acc[key].push(item);
					return acc;
				},
				{ today: [], yesterday: [], earlier: [] },
			),
		[intentionalItems],
	);

	const orderedGroups: TimeGroupKey[] = ["today", "yesterday", "earlier"];

	const timeGroupsSorted = useMemo(() => {
		if (!streamGroupByAttention) return groupedItems;
		const sortBucket = (list: ActivityItem[]) =>
			[...list].sort(
				(a, b) =>
					(rowNeedsAttention(b) ? 1 : 0) - (rowNeedsAttention(a) ? 1 : 0),
			);
		return {
			today: sortBucket(groupedItems.today),
			yesterday: sortBucket(groupedItems.yesterday),
			earlier: sortBucket(groupedItems.earlier),
		};
	}, [streamGroupByAttention, groupedItems]);

	const groupedItemsForRender = streamGroupByAttention
		? timeGroupsSorted
		: groupedItems;

	return (
		<section
			aria-labelledby="activity-list-card"
			className={surfaceSectionClass}
			id={activityAnchorId}
		>
			<div className={sectionHeading}>
				<div className="min-w-0">
					<p className={sectionEyebrow}>{eyebrow}</p>
					<h2
						className={`${sectionTitle} ${isSpaceWarm ? "font-bold text-foreground" : ""}`}
						id="activity-list-card"
					>
						{title}
					</h2>
				</div>
				<Link
					className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border/70 bg-background/40 backdrop-blur-sm px-3.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground transition-all duration-150 ease-out hover:-translate-y-px hover:bg-card hover:text-foreground hover:shadow-sm active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
					to={ctaTo}
				>
					{ctaLabel}
				</Link>
			</div>
			{intentionalItems.length === 0 ? (
				<ul>
					<li className="px-6 py-8">
						<p className="text-sm font-medium text-foreground/90">
							{emptyText}
						</p>
						<p className="mt-1 text-xs text-muted-foreground">{emptySubtext}</p>
					</li>
				</ul>
			) : (
				<div className="px-4 pb-4 pt-2">
					{orderedGroups.map((groupKey) => {
						const groupItems = groupedItemsForRender[groupKey];
						if (groupItems.length === 0) return null;
						return (
							<div className="mt-4 first:mt-0" key={groupKey}>
								<p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
									{timeGroupTitle[groupKey]}
								</p>
								{streamGroupByAttention &&
								groupItems.some((row) => rowNeedsAttention(row)) ? (
									<p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[rgba(145,95,30,0.92)]">
										Needs you
									</p>
								) : null}
								<ul className="space-y-2.5">
									{groupItems.map((item, index) => {
										const isReceiptParsed = item.eventType === "receipt";
										const receiptItemCount = extractReceiptItemCount(item);
										const receiptMerchant = extractReceiptMerchant(item.title);
										const displayStatus = isReceiptParsed
											? item.statusLabel || "Needs review"
											: item.statusLabel;
										const recentHighlightClass = isVeryRecent(item.occurredAt)
											? "bg-[rgba(142,159,136,0.08)]"
											: "bg-transparent";
										const rowTitle = normalizeActivityTitle(
											item.title,
											item.spaceName,
										);
										const displayTitle = isReceiptParsed
											? getReceiptEventTitle(item, receiptItemCount)
											: rowTitle;
										const leadingMeta = isReceiptParsed
											? `${receiptMerchant}${receiptItemCount != null ? ` · ${receiptItemCount} items` : ""}`
											: null;
										const lineTwoText = isReceiptParsed
											? leadingMeta
											: item.categoryLabel ||
												(item.statusPillLabel
													? `${item.statusPillLabel}`
													: displayStatus);
										const sourceLabel = sourceCaptureLabel(item);
										const hoverPreviewHint = buildHoverPreviewHint(
											item,
											isReceiptParsed ? receiptMerchant : null,
											isReceiptParsed ? receiptItemCount : null,
										);
										const showTimeline = index < groupItems.length - 1;
										const isExpanded = expandedId === item.id;
										const expandedContent = renderExpandedContent(item);
										const expandedToneClass =
											item.eventType === "question"
												? "border-l border-[rgba(142,159,136,0.28)] bg-[rgba(236,243,235,0.62)]"
												: "border-l border-[rgba(189,143,64,0.28)] bg-[rgba(255,248,236,0.76)] shadow-[0_10px_24px_-22px_rgba(143,104,43,0.55)]";
										const expandedLayoutClass = "ml-[1.4rem] mr-10";
										const entity = activityEntityFor(item);
										const timelineDotClass = isNeedsReviewStatus(displayStatus)
											? "border-[rgba(189,143,64,0.55)] bg-[rgba(189,143,64,0.88)] text-[rgba(255,248,237,0.98)]"
											: isConfirmedStatus(displayStatus)
												? "border-[rgba(120,154,124,0.6)] bg-[rgba(120,154,124,0.85)] text-white"
												: "border-[rgba(122,126,138,0.5)] bg-transparent text-[#6E7280]";
										const showCheckDot = isConfirmedStatus(displayStatus);
										const railLinked =
											railHighlightActive &&
											streamGroupByAttention &&
											rowMatchesRailHighlight(item, railHighlightMode);
										const railMuted =
											railHighlightActive &&
											streamGroupByAttention &&
											!railLinked &&
											(railHighlightMode === "splits" ||
												railHighlightMode === "drafts");
										const urgentRow = Boolean(
											isSpaceWarm && isNeedsReviewStatus(displayStatus),
										);
										const prevItem = index > 0 ? groupItems[index - 1] : null;
										const showAttentionDivider =
											streamGroupByAttention &&
											index > 0 &&
											prevItem != null &&
											rowNeedsAttention(prevItem) &&
											!rowNeedsAttention(item);
										return (
											<Fragment key={item.id}>
												{showAttentionDivider ? (
													<li
														aria-hidden
														className="list-none py-2"
														key={`${String(item.id)}-attention-divider`}
													>
														<div className="flex items-center gap-3 px-1">
															<span className="h-px flex-1 bg-gradient-to-r from-transparent via-[rgba(140,115,85,0.22)] to-transparent" />
															<span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
																Recorded
															</span>
															<span className="h-px flex-1 bg-gradient-to-l from-transparent via-[rgba(140,115,85,0.22)] to-transparent" />
														</div>
													</li>
												) : null}
												<li className="relative">
													<button
														className={`group w-full cursor-pointer rounded-xl px-2 py-3 text-left transition-[background-color,box-shadow,transform,opacity] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset ${recentHighlightClass} ${
															isSpaceWarm
																? `hover:-translate-y-px hover:bg-[rgba(255,251,242,0.98)] hover:shadow-[0_10px_26px_-16px_rgba(120,90,50,0.22)] active:translate-y-0 ${urgentRow && !railMuted ? "ring-1 ring-inset ring-[rgba(189,143,64,0.2)]" : ""}`
																: "hover:-translate-y-px hover:bg-background/45 hover:shadow-[0_8px_18px_-14px_rgba(31,37,35,0.45)] active:translate-y-0"
														} ${railLinked ? "ring-2 ring-[rgba(200,150,72,0.48)] shadow-[0_12px_28px_-14px_rgba(160,110,45,0.2)]" : ""} ${railMuted ? "opacity-[0.72]" : ""} ${
															isExpanded
																? isSpaceWarm
																	? "bg-[rgba(255,248,236,0.88)] shadow-[0_14px_28px_-22px_rgba(143,104,43,0.35)]"
																	: "bg-[rgba(255,247,233,0.72)] shadow-[0_14px_26px_-24px_rgba(143,104,43,0.62)]"
																: ""
														}`}
														onClick={() => {
															if (item.eventType === "capture") {
																navigate(item.to, { state: linkState });
																return;
															}
															setExpandedId((prev) =>
																prev === item.id ? null : item.id,
															);
														}}
														type="button"
													>
														<div className="grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-start gap-x-3">
															<div className="relative flex justify-center pt-0.5">
																{showTimeline ? (
																	<span
																		aria-hidden
																		className="absolute top-7 h-[calc(100%+0.6rem)] w-px bg-border/45"
																	/>
																) : null}
																<span
																	className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-all duration-150 ${timelineDotClass}`}
																>
																	{showCheckDot ? (
																		<Check
																			aria-hidden
																			className="h-3.5 w-3.5"
																		/>
																	) : (
																		<span
																			aria-hidden
																			className="h-2 w-2 rounded-full bg-current"
																		/>
																	)}
																</span>
															</div>
															<div className="min-w-0">
																<p className="truncate text-[16px] font-semibold tracking-tight text-foreground">
																	{displayTitle}
																</p>
																{item.meaningLine ? (
																	<p className="mt-1 line-clamp-2 text-[13px] leading-snug text-foreground/70">
																		{item.meaningLine}
																	</p>
																) : null}
																<p
																	className={`flex min-w-0 flex-wrap items-center gap-1.5 text-[14px] font-medium text-foreground/78 ${item.meaningLine ? "mt-1.5" : "mt-0.5"}`}
																>
																	<EntityMicro entity={entity} />
																	<span className="truncate">
																		{lineTwoText}
																	</span>
																</p>
																<p className="mt-0.5 flex min-w-0 items-center gap-1.5 truncate text-[12px] text-muted-foreground/95">
																	{isGlobalScope ? (
																		<>
																			<span className="truncate">
																				Space: {item.spaceName}
																			</span>
																			<span aria-hidden>·</span>
																		</>
																	) : null}
																	<span>{item.timeLabel}</span>
																</p>
																{sourceLabel ? (
																	<p className="mt-0.5 truncate text-[11px] font-medium text-muted-foreground">
																		{sourceLabel}
																	</p>
																) : null}
																{hoverPreviewHint ? (
																	<p className="mt-1 h-3 overflow-hidden text-[10px] text-foreground/65 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
																		{hoverPreviewHint}
																	</p>
																) : null}
															</div>
															<div className="flex items-start justify-end gap-2 text-right">
																<div>
																	{item.amountLabel ? (
																		<p className="text-[16px] font-semibold tabular-nums text-foreground/92 opacity-95 transition-opacity duration-150 group-hover:opacity-100">
																			{item.amountLabel}
																		</p>
																	) : (
																		<p className="text-xs font-medium text-muted-foreground">
																			{displayStatus}
																		</p>
																	)}
																	{item.statusPillLabel ? (
																		<span
																			className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${isNeedsReviewStatus(item.statusPillLabel) ? "border border-[rgba(189,143,64,0.45)] bg-[rgba(189,143,64,0.28)] font-semibold text-[rgba(102,68,14,0.98)]" : isDraftStatus(item.statusPillLabel) ? "bg-[rgba(122,126,138,0.14)] text-[#5B6070]" : "bg-muted text-muted-foreground"}`}
																		>
																			{item.statusPillLabel}
																		</span>
																	) : null}
																</div>
																<span
																	aria-hidden
																	className={`pt-0.5 text-muted-foreground/40 transition-all duration-150 ${isExpanded ? "rotate-90" : "group-hover:translate-x-0.5"}`}
																>
																	›
																</span>
															</div>
														</div>
													</button>
													<div
														className={`${expandedLayoutClass} overflow-hidden transition-all duration-150 ease-out ${isExpanded && expandedContent ? "max-h-[22rem] translate-y-0 opacity-100" : "max-h-0 -translate-y-1 opacity-0"}`}
													>
														{expandedContent ? (
															<div
																className={`mt-0.5 px-2 py-1.5 ${expandedToneClass}`}
															>
																{expandedContent}
															</div>
														) : null}
													</div>
												</li>
											</Fragment>
										);
									})}
								</ul>
							</div>
						);
					})}
				</div>
			)}
		</section>
	);
};
