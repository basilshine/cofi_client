import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
	EntityIcon,
	EntityListItem,
	type EntityViewModel,
} from "../../shared/lib/entityPresentation";
import {
	type EntityVisualKey,
	captureCandidateTypeVisual,
	capturePacketEntityVisual,
} from "../../shared/lib/entityVisual";
import {
	WorkspaceEntityCard,
	WorkspaceFilterBar,
	WorkspaceListBody,
	WorkspaceListingPage,
	WorkspacePagedList,
	WorkspaceSummaryChip,
} from "../../shared/ui/WorkspaceListingPage";
import type {
	CandidateReviewItem,
	CapturePacket,
	SplitTargetOption,
} from "./reviewPacketTypes";

type CapturePacketReviewSectionProps = {
	packets: CapturePacket[];
	candidateCount: number;
	hasMorePackets?: boolean;
	isLoadingMorePackets?: boolean;
	spaceId: number;
	memberLabels: Map<number, string>;
	focusedSourceDocumentId?: number | null;
	documentCandidateError: string | null;
	benefitCandidateActingId: number | null;
	documentCandidateActingId: number | null;
	deletingSourceDocumentId: number | null;
	splitTargetOptions: SplitTargetOption[];
	splitTargetExpenseIdFor: (candidate: CandidateReviewItem) => number | null;
	pendingParticipantCountForSplitCandidate: (
		candidate: CandidateReviewItem,
	) => number;
	onSplitTargetChange: (candidateId: number, expenseId: number) => void;
	onSavePromoCandidate: (
		candidate: CandidateReviewItem,
	) => Promise<void> | void;
	onConfirmDocumentCandidate: (
		candidate: CandidateReviewItem,
	) => Promise<void> | void;
	onCreateParticipantCandidate: (
		candidate: CandidateReviewItem,
	) => Promise<void> | void;
	onCreateRecurringCandidate: (
		candidate: CandidateReviewItem,
	) => Promise<void> | void;
	onApplySplitCandidate: (
		candidate: CandidateReviewItem,
		targetExpenseId: number | null,
	) => Promise<void> | void;
	onDeleteCapture: (sourceDocumentId: number) => void;
	onFinishReview: (packet: CapturePacket) => Promise<void> | void;
	onIgnoreCandidate: (candidate: CandidateReviewItem) => void;
	onLoadMorePackets?: () => void;
	finishingSourceDocumentId: number | null;
};

type PacketSectionKey =
	| "expenses"
	| "benefits"
	| "people"
	| "splits"
	| "future"
	| "documents";

type PacketSectionDefinition = {
	key: PacketSectionKey;
	title: string;
	description: string;
	shortTitle: string;
	recordSingular: string;
	recordLabel: string;
	signalSingular: string;
	signalLabel: string;
};

type CaptureReviewFilter = "all" | "needs_review" | "complete" | "no_actions";

const packetSectionDefinitions: PacketSectionDefinition[] = [
	{
		key: "expenses",
		title: "Items",
		shortTitle: "Items",
		description:
			"Products, services, quantities, and amounts found in the capture.",
		recordSingular: "item",
		recordLabel: "items",
		signalSingular: "item signal",
		signalLabel: "item signals",
	},
	{
		key: "benefits",
		title: "Benefits",
		shortTitle: "Benefits",
		description: "Promos and loyalty findings that can be saved separately.",
		recordSingular: "benefit record",
		recordLabel: "benefit records",
		signalSingular: "benefit signal",
		signalLabel: "benefit signals",
	},
	{
		key: "people",
		title: "People",
		shortTitle: "People",
		description: "Participants and placeholders detected from this capture.",
		recordSingular: "participant",
		recordLabel: "participants",
		signalSingular: "people signal",
		signalLabel: "people signals",
	},
	{
		key: "splits",
		title: "Splits",
		shortTitle: "Splits",
		description: "Split proposals that need people and target expense context.",
		recordSingular: "split record",
		recordLabel: "split records",
		signalSingular: "split signal",
		signalLabel: "split signals",
	},
	{
		key: "future",
		title: "Future actions",
		shortTitle: "Future",
		description: "Recurring, membership, reminder, and renewal hints.",
		recordSingular: "future record",
		recordLabel: "future records",
		signalSingular: "future signal",
		signalLabel: "future signals",
	},
	{
		key: "documents",
		title: "Document signals",
		shortTitle: "Documents",
		description:
			"Payment proof, privacy, merge, and supporting document signals.",
		recordSingular: "document record",
		recordLabel: "document records",
		signalSingular: "document signal",
		signalLabel: "document signals",
	},
];

const packetSectionKey = (candidate: CandidateReviewItem): PacketSectionKey => {
	if (
		candidate.candidateType === "expense_candidate" ||
		candidate.candidateType === "expense_item_candidate"
	) {
		return "expenses";
	}
	if (
		candidate.candidateType === "promo_code_candidate" ||
		candidate.candidateType === "loyalty_event_candidate"
	) {
		return "benefits";
	}
	if (candidate.candidateType === "participant_placeholder_candidate") {
		return "people";
	}
	if (candidate.candidateType === "split_candidate") return "splits";
	if (
		candidate.candidateType === "recurring_candidate" ||
		candidate.candidateType === "membership_candidate" ||
		candidate.candidateType === "reminder_candidate"
	) {
		return "future";
	}
	return "documents";
};

const isTechnicalExpenseCandidate = (candidate: CandidateReviewItem): boolean =>
	candidate.candidateType === "expense_candidate" ||
	candidate.candidateType === "expense_item_candidate";

const reviewVisibleCandidates = (
	candidates: CandidateReviewItem[],
): CandidateReviewItem[] =>
	candidates.filter((candidate) => !isTechnicalExpenseCandidate(candidate));

const isPendingReviewStatus = (status: string): boolean =>
	status.trim().toLowerCase() === "pending_review";

const candidateStatusLabel = (status: string): string =>
	isPendingReviewStatus(status || "pending_review")
		? "Needs review"
		: status.replace(/_/g, " ");

const hasOpenCandidateAction = (candidate: CandidateReviewItem): boolean =>
	isPendingReviewStatus(candidate.status) &&
	(candidate.canSavePromo ||
		candidate.canCreateParticipant ||
		candidate.canOpenSplitReview ||
		candidate.canCreateRecurring ||
		candidate.canMarkReviewed);

const actionableCount = (candidates: CandidateReviewItem[]): number =>
	candidates.filter(hasOpenCandidateAction).length;

const humanizeReviewLabel = (value: string): string => {
	const clean = value
		.trim()
		.replace(/_candidate$/i, "")
		.replace(/_/g, " ");
	if (!clean) return "";
	return clean.charAt(0).toUpperCase() + clean.slice(1);
};

const candidateReviewTypeLabel = (candidate: CandidateReviewItem): string => {
	const section = packetSectionDefinitions.find(
		(item) => item.key === packetSectionKey(candidate),
	);
	if (candidate.documentType?.trim()) {
		return humanizeReviewLabel(candidate.documentType);
	}
	if (candidate.candidateType?.trim()) {
		return humanizeReviewLabel(candidate.candidateType);
	}
	return section?.signalSingular ?? "review item";
};

const candidateReviewSummary = (candidate: CandidateReviewItem): string => {
	const fields = candidate.fields
		.map((field) =>
			[field.label, field.value].filter((part) => part.trim()).join(": "),
		)
		.filter(Boolean)
		.slice(0, 3);
	const details = [
		candidate.detail,
		candidate.meta,
		candidate.merchantText,
		...fields,
	]
		.map((part) => part?.trim() ?? "")
		.filter(Boolean);
	return (
		details[0] ?? "Ceits found this signal, but it still needs a decision."
	);
};

const candidateReviewNextStep = (candidate: CandidateReviewItem): string => {
	if (candidate.canSavePromo) return "Save this benefit from the capture.";
	if (candidate.canCreateParticipant)
		return candidate.isSelfParticipant
			? "This looks like you, so it can be marked reviewed."
			: "Create or connect this participant before using them in splits.";
	if (candidate.canOpenSplitReview)
		return "Choose the target expense and apply the split from the split step.";
	if (candidate.canCreateRecurring)
		return "Create a recurring schedule or ignore this future hint.";
	if (candidate.canMarkReviewed)
		return "Mark this signal reviewed when it does not need a saved record.";
	return "No direct action is wired for this signal yet; keep or remove the capture review data below.";
};

const isProjectedStatus = (status: string): boolean =>
	["projected", "confirmed", "saved", "created"].includes(
		status.trim().toLowerCase(),
	);

const isIgnoredStatus = (status: string): boolean =>
	["ignored", "expired", "archived"].includes(status.trim().toLowerCase());

const visiblePendingCount = (packet: CapturePacket): number => {
	const visibleCandidates = reviewVisibleCandidates(packet.candidates);
	if (visibleCandidates.length > 0) {
		return visibleCandidates.filter((candidate) =>
			isPendingReviewStatus(candidate.status),
		).length;
	}
	if (packet.candidates.length === 0 && capturePacketRecordCount(packet) > 0) {
		return 0;
	}
	const hiddenPendingReviewExpenseCandidates = packet.candidates.filter(
		(candidate) =>
			isTechnicalExpenseCandidate(candidate) &&
			isPendingReviewStatus(candidate.status),
	).length;
	return Math.max(
		(packet.pendingCount ?? 0) - hiddenPendingReviewExpenseCandidates,
		0,
	);
};

const totalPendingCount = (packet: CapturePacket): number => {
	const visibleCount = visiblePendingCount(packet);
	if (packet.candidates.length > 0 || capturePacketRecordCount(packet) > 0) {
		return visibleCount;
	}
	return Math.max(packet.pendingCount ?? 0, visibleCount);
};

const capturePacketClosedReviewCount = (packet: CapturePacket): number =>
	reviewVisibleCandidates(packet.candidates).filter((candidate) => {
		if (isPendingReviewStatus(candidate.status)) return false;
		return (
			isProjectedStatus(candidate.status) ||
			isIgnoredStatus(candidate.status) ||
			candidate.status.trim().length > 0
		);
	}).length;

const capturePacketHasCompletedWork = (packet: CapturePacket): boolean =>
	capturePacketRecordCount(packet) > 0 ||
	(packet.projectedCount ?? 0) > 0 ||
	(packet.ignoredCount ?? 0) > 0 ||
	capturePacketClosedReviewCount(packet) > 0;

const capturePacketReviewState = (
	packet: CapturePacket,
): "complete" | "needs_review" | "empty" => {
	if (totalPendingCount(packet) > 0) return "needs_review";
	if (capturePacketHasCompletedWork(packet)) return "complete";
	return "empty";
};

const sectionCount = (
	candidates: CandidateReviewItem[],
	sectionKey: PacketSectionKey,
): number =>
	candidates.filter((candidate) => packetSectionKey(candidate) === sectionKey)
		.length;

const visibleSectionSignalCount = (
	packet: CapturePacket,
	sectionKey: PacketSectionKey,
	candidates = reviewVisibleCandidates(packet.candidates),
): number => {
	const loadedCount = sectionCount(candidates, sectionKey);
	if (loadedCount > 0) return loadedCount;
	if (sectionKey === "expenses") {
		const savedItemCount = (packet.records?.expenses ?? []).reduce(
			(total, expense) => total + (expense.items?.length ?? 0),
			0,
		);
		if (savedItemCount > 0) return savedItemCount;
	}
	return packet.counts[sectionKey] ?? 0;
};

const packetEntity = (
	packet: CapturePacket,
	selected: boolean,
): EntityViewModel => {
	const candidates = reviewVisibleCandidates(packet.candidates);
	const pendingCount = totalPendingCount(packet);
	const scopedSections = packetSectionDefinitions
		.map((section) => ({
			label: section.shortTitle,
			count: visibleSectionSignalCount(packet, section.key, candidates),
		}))
		.filter((section) => section.count > 0);

	return {
		id: String(packet.sourceDocumentId),
		visualKey: "reviewPacket",
		label: "Capture",
		title: packet.title,
		subtitle: `Capture #${packet.sourceDocumentId} - ${packet.meta}`,
		detail: packet.summary,
		meta: scopedSections.map((section) => `${section.label} ${section.count}`),
		status:
			pendingCount > 0
				? packet.primaryActionLabel
				: capturePacketHasCompletedWork(packet)
					? "Review complete"
					: packet.primaryActionLabel,
		selected,
	};
};

const candidateEntity = (candidate: CandidateReviewItem): EntityViewModel => ({
	id: `${candidate.source}-${candidate.id}`,
	visualKey: captureCandidateTypeVisual(candidate.candidateType).key,
	label: candidate.label,
	title: candidate.title,
	subtitle: candidate.detail,
	detail: candidate.meta,
	meta: candidate.fields
		.slice(0, 3)
		.map((field) => `${field.label}: ${field.value}`),
	status: isProjectedStatus(candidate.status)
		? "Created"
		: isPendingReviewStatus(candidate.status)
			? candidate.confidenceLabel
			: isIgnoredStatus(candidate.status)
				? "Closed"
				: candidateStatusLabel(candidate.status),
});

type CandidateActionTone =
	| "attention"
	| "benefit"
	| "neutral"
	| "people"
	| "review";

const candidateActionButtonClass = (tone: CandidateActionTone): string => {
	const base =
		"min-h-9 rounded-full border px-3 text-xs font-semibold transition disabled:opacity-50";
	const toneClass: Record<CandidateActionTone, string> = {
		attention:
			"border-[rgba(181,131,52,0.32)] bg-[rgba(255,240,208,0.78)] text-[#73501b] hover:border-[rgba(181,131,52,0.48)] hover:bg-[rgba(255,232,188,0.94)]",
		benefit:
			"border-[rgba(91,116,87,0.34)] bg-[rgba(237,247,239,0.94)] text-[#355238] hover:border-[rgba(91,116,87,0.5)] hover:bg-[rgba(218,238,222,0.98)]",
		neutral:
			"border-border/70 bg-white text-muted-foreground hover:border-destructive/30 hover:text-destructive",
		people:
			"border-[rgba(83,103,139,0.28)] bg-[rgba(235,241,252,0.88)] text-[#405574] hover:border-[rgba(83,103,139,0.45)] hover:bg-[rgba(222,232,249,0.96)]",
		review:
			"border-[rgba(78,92,72,0.26)] bg-[rgba(246,249,242,0.9)] text-[#495944] hover:border-[rgba(78,92,72,0.42)] hover:bg-[rgba(232,239,225,0.96)]",
	};
	return `${base} ${toneClass[tone]}`;
};

const spaceMembersHref = (spaceId: string | number) =>
	`/console/spaces/${encodeURIComponent(String(spaceId))}/members`;

type CandidateActionButtonProps = {
	children: ReactNode;
	disabled?: boolean;
	onClick: () => void;
	tone: CandidateActionTone;
};

const CandidateActionButton = ({
	children,
	disabled = false,
	onClick,
	tone,
}: CandidateActionButtonProps) => (
	<button
		className={candidateActionButtonClass(tone)}
		disabled={disabled}
		onClick={onClick}
		type="button"
	>
		{children}
	</button>
);

type PacketPillTone = "default" | "muted" | "strong";
type PacketPillSize = "regular" | "compact";

type PacketPillProps = {
	children: ReactNode;
	size?: PacketPillSize;
	tone?: PacketPillTone;
};

const packetPillClass = (
	tone: PacketPillTone,
	size: PacketPillSize,
): string => {
	const base =
		size === "compact"
			? "rounded-full border px-2 py-0.5 text-[11px] font-semibold"
			: "rounded-full border px-2.5 py-1 text-xs font-semibold";
	const toneClass: Record<PacketPillTone, string> = {
		default: "border-[rgba(120,100,80,0.22)] bg-white text-foreground/75",
		muted: "border-[rgba(120,100,80,0.16)] bg-white/70 text-muted-foreground",
		strong:
			"border-[rgba(68,58,42,0.16)] bg-[rgba(68,58,42,0.08)] text-[#4d4231]",
	};
	return `${base} ${toneClass[tone]}`;
};

const PacketPill = ({
	children,
	size = "regular",
	tone = "default",
}: PacketPillProps) => (
	<span className={packetPillClass(tone, size)}>{children}</span>
);

const formatRecordMoney = (amount: number, currency?: string): string =>
	new Intl.NumberFormat("ru-RU", {
		currency: currency || "RUB",
		maximumFractionDigits: 2,
		style: "currency",
	}).format(Number.isFinite(amount) ? amount : 0);

const formatRecordDate = (value?: string | null): string | null => {
	if (!value) return null;
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return null;
	return new Intl.DateTimeFormat("ru-RU", {
		day: "2-digit",
		month: "short",
		year: "numeric",
	}).format(date);
};

export const CapturePacketReviewSection = ({
	packets,
	candidateCount,
	hasMorePackets = false,
	isLoadingMorePackets = false,
	spaceId,
	memberLabels,
	focusedSourceDocumentId,
	documentCandidateError,
	benefitCandidateActingId,
	documentCandidateActingId,
	deletingSourceDocumentId,
	splitTargetOptions,
	splitTargetExpenseIdFor,
	pendingParticipantCountForSplitCandidate,
	onSplitTargetChange,
	onSavePromoCandidate,
	onConfirmDocumentCandidate,
	onCreateParticipantCandidate,
	onCreateRecurringCandidate,
	onApplySplitCandidate,
	onDeleteCapture,
	onFinishReview,
	onIgnoreCandidate,
	onLoadMorePackets,
	finishingSourceDocumentId,
}: CapturePacketReviewSectionProps) => {
	const [reviewFilter, setReviewFilter] = useState<CaptureReviewFilter>("all");
	const packetStateCounts = useMemo(
		() =>
			packets.reduce(
				(counts, packet) => {
					const state = capturePacketReviewState(packet);
					counts.all += 1;
					if (state === "needs_review") counts.needs_review += 1;
					if (state === "complete") counts.complete += 1;
					if (state === "empty") counts.no_actions += 1;
					return counts;
				},
				{ all: 0, complete: 0, needs_review: 0, no_actions: 0 },
			),
		[packets],
	);
	const visiblePackets = useMemo(
		() =>
			reviewFilter === "all"
				? packets
				: packets.filter((packet) => {
						const state = capturePacketReviewState(packet);
						return reviewFilter === "no_actions"
							? state === "empty"
							: state === reviewFilter;
					}),
		[packets, reviewFilter],
	);
	const defaultPacketId = useMemo(() => {
		if (
			focusedSourceDocumentId != null &&
			visiblePackets.some(
				(packet) => packet.sourceDocumentId === focusedSourceDocumentId,
			)
		) {
			return focusedSourceDocumentId;
		}
		return visiblePackets[0]?.sourceDocumentId ?? null;
	}, [focusedSourceDocumentId, visiblePackets]);
	const [selectedPacketId, setSelectedPacketId] = useState<number | null>(
		() => defaultPacketId,
	);

	useEffect(() => {
		if (
			selectedPacketId != null &&
			visiblePackets.some(
				(packet) => packet.sourceDocumentId === selectedPacketId,
			)
		) {
			return;
		}
		setSelectedPacketId(defaultPacketId);
	}, [visiblePackets, selectedPacketId, defaultPacketId]);

	return (
		<WorkspaceListingPage
			description="Each capture is one extracted text, voice note, receipt, or screenshot. Review what Ceits found and follow what already became expenses, promos, people, splits, future hints, or document signals."
			stats={
				<>
					<WorkspaceSummaryChip label="Captures" value={packets.length} />
					<WorkspaceSummaryChip label="Findings" value={candidateCount} />
					<WorkspaceSummaryChip
						accent={
							packetStateCounts.needs_review > 0 ? "attention" : "default"
						}
						label="Needs review"
						value={packetStateCounts.needs_review}
					/>
					<WorkspaceSummaryChip
						accent="positive"
						label="Complete"
						value={packetStateCounts.complete}
					/>
				</>
			}
			title="Captures"
		>
			<WorkspaceFilterBar
				resultLabel={`${visiblePackets.length} shown · ${packets.length} captures by newest first`}
			>
				<div
					aria-label="Capture review filter"
					className="flex min-w-0 flex-wrap items-center gap-1 rounded-full border border-[rgba(120,100,80,0.12)] bg-white/62 p-1"
					role="group"
				>
					{[
						["all", "All", packetStateCounts.all],
						["needs_review", "Needs review", packetStateCounts.needs_review],
						["complete", "Complete", packetStateCounts.complete],
						["no_actions", "No actions", packetStateCounts.no_actions],
					].map(([key, label, count]) => {
						const filterKey = key as CaptureReviewFilter;
						const active = reviewFilter === filterKey;
						return (
							<button
								aria-pressed={active}
								className={[
									"inline-flex min-h-7 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
									active
										? "bg-[rgba(68,58,42,0.92)] text-[#fffaf0] shadow-[0_8px_18px_-14px_rgba(44,32,18,0.58)]"
										: "text-muted-foreground hover:bg-card hover:text-foreground",
								].join(" ")}
								key={filterKey}
								onClick={() => setReviewFilter(filterKey)}
								type="button"
							>
								<span>{label}</span>
								<span className="tabular-nums opacity-75">{count}</span>
							</button>
						);
					})}
				</div>
			</WorkspaceFilterBar>
			<WorkspaceListBody error={documentCandidateError}>
				{visiblePackets.length > 0 ? (
					<WorkspacePagedList
						hasMore={hasMorePackets}
						items={visiblePackets}
						isLoadingMore={isLoadingMorePackets}
						loadMoreLabel="Load more captures"
						onLoadMore={onLoadMorePackets}
						renderItem={(packet) => {
							const selected = selectedPacketId === packet.sourceDocumentId;
							const reviewState = capturePacketReviewState(packet);
							const complete = reviewState === "complete";
							const needsReview = reviewState === "needs_review";
							return (
								<WorkspaceEntityCard
									ariaPressed={selected}
									key={packet.sourceDocumentId}
									onClick={() =>
										setSelectedPacketId((current) =>
											current === packet.sourceDocumentId
												? null
												: packet.sourceDocumentId,
										)
									}
									selected={selected}
									summary={
										<>
											<div className="mb-2 flex items-center justify-between gap-3">
												<span
													className={[
														"inline-flex min-h-6 items-center rounded-full border px-2 text-[10px] font-bold uppercase tracking-[0.12em]",
														complete
															? "border-[rgba(91,116,87,0.22)] bg-[rgba(239,249,238,0.86)] text-[#3d6743]"
															: needsReview
																? "border-[rgba(181,131,52,0.24)] bg-[rgba(255,245,218,0.86)] text-[#73501b]"
																: "border-[rgba(120,100,80,0.14)] bg-white/64 text-muted-foreground",
													].join(" ")}
												>
													{complete
														? "Complete"
														: needsReview
															? "Needs review"
															: "No actions"}
												</span>
												{complete ? (
													<span className="text-[11px] font-medium text-muted-foreground">
														All created records are saved
													</span>
												) : null}
											</div>
											<EntityListItem entity={packetEntity(packet, selected)} />
										</>
									}
									tone={
										complete ? "complete" : needsReview ? "attention" : "muted"
									}
								>
									{selected ? (
										<CapturePacketRow
											benefitCandidateActingId={benefitCandidateActingId}
											deletingSourceDocumentId={deletingSourceDocumentId}
											documentCandidateActingId={documentCandidateActingId}
											onApplySplitCandidate={onApplySplitCandidate}
											onConfirmDocumentCandidate={onConfirmDocumentCandidate}
											onCreateParticipantCandidate={
												onCreateParticipantCandidate
											}
											onCreateRecurringCandidate={onCreateRecurringCandidate}
											onDeleteCapture={onDeleteCapture}
											onFinishReview={onFinishReview}
											onIgnoreCandidate={onIgnoreCandidate}
											onSavePromoCandidate={onSavePromoCandidate}
											onSplitTargetChange={onSplitTargetChange}
											packet={packet}
											memberLabels={memberLabels}
											pendingParticipantCountForSplitCandidate={
												pendingParticipantCountForSplitCandidate
											}
											spaceId={spaceId}
											splitTargetExpenseIdFor={splitTargetExpenseIdFor}
											splitTargetOptions={splitTargetOptions}
											finishingSourceDocumentId={finishingSourceDocumentId}
										/>
									) : null}
								</WorkspaceEntityCard>
							);
						}}
					/>
				) : (
					<p className="rounded-xl border border-[rgba(120,100,80,0.12)] bg-white/58 px-3 py-3 text-xs text-muted-foreground">
						No captures match this filter.
					</p>
				)}
			</WorkspaceListBody>
		</WorkspaceListingPage>
	);
};

type CapturePacketRowProps = Omit<
	CapturePacketReviewSectionProps,
	"packets" | "candidateCount" | "documentCandidateError"
> & {
	packet: CapturePacket;
};

const CapturePacketRow = ({
	packet,
	memberLabels,
	benefitCandidateActingId,
	documentCandidateActingId,
	deletingSourceDocumentId,
	splitTargetOptions,
	spaceId,
	splitTargetExpenseIdFor,
	pendingParticipantCountForSplitCandidate,
	onSplitTargetChange,
	onSavePromoCandidate,
	onConfirmDocumentCandidate,
	onCreateParticipantCandidate,
	onCreateRecurringCandidate,
	onApplySplitCandidate,
	onDeleteCapture,
	onFinishReview,
	onIgnoreCandidate,
	finishingSourceDocumentId,
}: CapturePacketRowProps) => {
	const visibleCandidates = reviewVisibleCandidates(packet.candidates);
	const sections = packetSectionDefinitions
		.map((section) => ({
			...section,
			candidates: visibleCandidates.filter(
				(candidate) => packetSectionKey(candidate) === section.key,
			),
		}))
		.filter((section) => section.candidates.length > 0);
	const actionCount = actionableCount(visibleCandidates);
	const isDeletingCapture =
		deletingSourceDocumentId === packet.sourceDocumentId;
	const hasDetails = packet.candidates.length > 0;
	const hasRecords =
		(packet.records?.expenses?.length ?? 0) > 0 ||
		(packet.records?.benefits?.length ?? 0) > 0 ||
		(packet.records?.participants?.length ?? 0) > 0 ||
		(packet.records?.splits?.length ?? 0) > 0 ||
		(packet.records?.recurring?.length ?? 0) > 0;
	const pendingCount = totalPendingCount(packet);
	const createdCount = Math.max(
		packet.projectedCount ?? 0,
		capturePacketRecordCount(packet),
	);

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-[rgba(120,100,80,0.12)] bg-white/68 px-3 py-3">
				<div className="min-w-0">
					<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
						Capture #{packet.sourceDocumentId}
					</p>
					<h3 className="mt-1 truncate text-base font-semibold text-foreground">
						{packet.title}
					</h3>
					<p className="mt-1 text-xs text-muted-foreground">{packet.meta}</p>
					{packet.createdByLabel || packet.createdByUserId ? (
						<p className="mt-1 text-[11px] font-medium text-muted-foreground">
							Submitted by{" "}
							{packet.createdByLabel ??
								`user #${String(packet.createdByUserId)}`}
						</p>
					) : null}
				</div>
				<div className="flex max-w-full flex-wrap items-center justify-end gap-1.5">
					<PacketPill>{packet.summary}</PacketPill>
					{pendingCount > 0 ? (
						<PacketPill tone="strong">{pendingCount} pending</PacketPill>
					) : null}
					{createdCount > 0 ? (
						<PacketPill tone={pendingCount > 0 ? "muted" : "strong"}>
							{createdCount} created
						</PacketPill>
					) : null}
					{pendingCount > 0 ? (
						<PacketPill tone="strong">{packet.primaryActionLabel}</PacketPill>
					) : null}
				</div>
			</div>
			{!hasDetails && !hasRecords ? (
				<p className="rounded-xl border border-[rgba(120,100,80,0.16)] bg-white/70 px-3 py-3 text-sm text-muted-foreground">
					This capture is in the backend queue, but detailed candidate forms are
					not loaded here because there may be no pending decisions left. Use
					the Expenses, Benefits, Members, or Splits tabs to inspect records
					that were already created from it.
				</p>
			) : null}
			<CaptureReviewWizard
				memberLabels={memberLabels}
				packet={packet}
				spaceId={spaceId}
			/>
			{sections.some(
				(section) => !["expenses", "people", "splits"].includes(section.key),
			) ? (
				<div className="divide-y divide-[rgba(120,100,80,0.12)] rounded-2xl border border-[rgba(120,100,80,0.12)] bg-white/58 px-3">
					{sections.map((section) =>
						["expenses", "people", "splits"].includes(section.key) ? null : (
							<section className="py-3 first:pt-0 last:pb-0" key={section.key}>
								<div className="flex flex-wrap items-start justify-between gap-2">
									<div className="flex min-w-0 items-start gap-2">
										<EntityIcon
											size="sm"
											visualKey={capturePacketEntityVisual(section.key).key}
										/>
										<div className="min-w-0">
											<h4 className="text-sm font-semibold text-foreground">
												{section.title}
											</h4>
											<p className="mt-0.5 text-xs text-muted-foreground">
												{section.description}
											</p>
										</div>
									</div>
									<p className="text-xs font-semibold text-muted-foreground">
										{section.candidates.length}{" "}
										{section.candidates.length === 1 ? "finding" : "findings"}
									</p>
								</div>
								<div className="mt-2 divide-y divide-[rgba(120,100,80,0.1)]">
									{section.candidates.map((candidate) => (
										<CaptureCandidateRow
											benefitCandidateActingId={benefitCandidateActingId}
											candidate={candidate}
											documentCandidateActingId={documentCandidateActingId}
											key={`${candidate.source}-${candidate.id}`}
											onApplySplitCandidate={onApplySplitCandidate}
											onConfirmDocumentCandidate={onConfirmDocumentCandidate}
											onCreateParticipantCandidate={
												onCreateParticipantCandidate
											}
											onCreateRecurringCandidate={onCreateRecurringCandidate}
											onIgnoreCandidate={onIgnoreCandidate}
											onSavePromoCandidate={onSavePromoCandidate}
											onSplitTargetChange={onSplitTargetChange}
											pendingParticipantCountForSplitCandidate={
												pendingParticipantCountForSplitCandidate
											}
											spaceId={spaceId}
											splitTargetExpenseIdFor={splitTargetExpenseIdFor}
											splitTargetOptions={splitTargetOptions}
										/>
									))}
								</div>
							</section>
						),
					)}
				</div>
			) : null}
			<RemainingReviewSummary packet={packet} />
			{sections.length === 0 && totalPendingCount(packet) === 0 ? (
				<p className="rounded-xl border border-[rgba(120,100,80,0.12)] bg-white/58 px-3 py-2 text-xs text-muted-foreground">
					Ceits did not find reviewable findings in this capture.
				</p>
			) : null}
			<PacketFinishReviewBar
				actionCount={actionCount}
				finishing={finishingSourceDocumentId === packet.sourceDocumentId}
				isDeletingCapture={isDeletingCapture}
				onDeleteCapture={onDeleteCapture}
				onFinishReview={onFinishReview}
				packet={packet}
			/>
		</div>
	);
};

type PacketFinishReviewBarProps = {
	actionCount: number;
	finishing: boolean;
	isDeletingCapture: boolean;
	onDeleteCapture: (sourceDocumentId: number) => void;
	onFinishReview: (packet: CapturePacket) => Promise<void> | void;
	packet: CapturePacket;
};

const PacketFinishReviewBar = ({
	actionCount,
	finishing,
	isDeletingCapture,
	onDeleteCapture,
	onFinishReview,
	packet,
}: PacketFinishReviewBarProps) => {
	const pendingCount = totalPendingCount(packet);
	const recordCount = capturePacketRecordCount(packet);
	const completedWorkCount = Math.max(
		recordCount,
		packet.projectedCount ?? 0,
		packet.ignoredCount ?? 0,
		capturePacketClosedReviewCount(packet),
	);
	const pendingExpenseCount = (packet.records?.expenses ?? []).filter(
		(expense) => expense.status.trim().toLowerCase() === "pending_review",
	).length;
	const saveableExpenseCandidateCount = packet.candidates.filter(
		(candidate) =>
			isPendingReviewStatus(candidate.status) &&
			(candidate.candidateType === "expense_candidate" ||
				candidate.candidateType === "expense_item_candidate"),
	).length;
	const needsAction = pendingCount > 0 || actionCount > 0;
	const hasSaveableExpenseWork =
		pendingCount > 0 &&
		(pendingExpenseCount > 0 || saveableExpenseCandidateCount > 0);
	const isComplete =
		pendingCount === 0 && completedWorkCount > 0 && actionCount === 0;
	const canSaveAll = !isComplete && (hasSaveableExpenseWork || needsAction);
	const outcomeTitle = isComplete
		? "Everything from this capture is resolved"
		: canSaveAll
			? "Some capture work is still open"
			: "Nothing else to save here";
	const outcomeDescription = isComplete
		? recordCount > 0
			? `${recordCount} ${recordCount === 1 ? "record has" : "records have"} already been created from this capture.`
			: "Every reviewable signal from this capture has already been handled."
		: canSaveAll
			? `${[
					recordCount > 0
						? `${recordCount} ${recordCount === 1 ? "record is" : "records are"} already created`
						: null,
					pendingCount > 0
						? `${pendingCount} ${pendingCount === 1 ? "thing still needs" : "things still need"} review`
						: null,
					actionCount > 0
						? `${actionCount} ${actionCount === 1 ? "action is" : "actions are"} available`
						: null,
				]
					.filter(Boolean)
					.join(". ")}.`
			: recordCount > 0
				? `${recordCount} ${recordCount === 1 ? "record is" : "records are"} created; no remaining action is available in this capture.`
				: "Ceits has no reviewable records or actions for this capture.";

	return (
		<div
			className={[
				"flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]",
				isComplete
					? "border-[rgba(91,116,87,0.2)] bg-[rgba(249,253,247,0.84)]"
					: "border-[rgba(181,131,52,0.22)] bg-[rgba(255,247,225,0.78)]",
			].join(" ")}
		>
			<div className="min-w-0">
				<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
					Capture outcome
				</p>
				<p className="mt-0.5 text-sm font-semibold text-foreground">
					{outcomeTitle}
				</p>
				<p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
					{outcomeDescription}
				</p>
			</div>
			<div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
				{isComplete ? (
					<span className="inline-flex min-h-9 items-center rounded-full border border-[rgba(91,116,87,0.22)] bg-[rgba(239,249,238,0.86)] px-3.5 text-xs font-bold text-[#3d6743]">
						Done
					</span>
				) : canSaveAll ? (
					<button
						className="inline-flex min-h-9 items-center rounded-full bg-[rgba(68,58,42,0.94)] px-3.5 text-xs font-bold text-[#fffaf0] shadow-[0_10px_24px_-18px_rgba(44,32,18,0.58)] transition hover:bg-[rgba(50,43,32,0.98)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
						disabled={finishing}
						onClick={() => void onFinishReview(packet)}
						type="button"
					>
						{finishing ? "Saving" : "Save all"}
					</button>
				) : (
					<span className="inline-flex min-h-9 items-center rounded-full border border-[rgba(120,100,80,0.14)] bg-white/66 px-3.5 text-xs font-semibold text-muted-foreground">
						No action
					</span>
				)}
				<button
					className="inline-flex min-h-9 items-center rounded-full border border-destructive/20 bg-white/70 px-3.5 text-xs font-semibold text-destructive transition hover:border-destructive/35 hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/30 disabled:opacity-50"
					disabled={isDeletingCapture}
					onClick={() => onDeleteCapture(packet.sourceDocumentId)}
					type="button"
				>
					{isDeletingCapture ? "Removing" : "Remove review data"}
				</button>
			</div>
		</div>
	);
};

type RemainingReviewSummaryProps = {
	packet: CapturePacket;
};

const RemainingReviewSummary = ({ packet }: RemainingReviewSummaryProps) => {
	const pendingCount = totalPendingCount(packet);
	if (pendingCount <= 0) return null;

	const pendingCandidates = reviewVisibleCandidates(packet.candidates).filter(
		(candidate) => isPendingReviewStatus(candidate.status),
	);
	const fallbackSections = packetSectionDefinitions
		.map((section) => ({
			...section,
			count:
				section.key === "expenses"
					? Math.max(
							0,
							(packet.counts.expenses ?? 0) +
								(packet.counts.expenses ? 0 : 0) -
								(packet.records?.expenses?.length ?? 0),
						)
					: (packet.counts[section.key] ?? 0),
		}))
		.filter((section) => section.count > 0)
		.filter(
			(section) => !["expenses", "people", "splits"].includes(section.key),
		);
	const visibleFallback =
		pendingCandidates.length > 0
			? []
			: fallbackSections.length > 0
				? fallbackSections.slice(0, pendingCount)
				: [
						{
							key: "documents" as PacketSectionKey,
							title: "Backend review item",
							shortTitle: "Pending",
							description:
								"Backend reports a remaining review item, but did not return an editable candidate row for it.",
							recordSingular: "record",
							recordLabel: "records",
							signalSingular: "review item",
							signalLabel: "review items",
							count: pendingCount,
						},
					];
	const fallbackTitle = (section: (typeof visibleFallback)[number]): string => {
		if (section.key === "documents") return "Review document signal";
		if (section.key === "benefits") return "Review benefit signal";
		if (section.key === "future") return "Review future action";
		return `Review ${section.shortTitle.toLowerCase()}`;
	};
	const fallbackDescription = (
		section: (typeof visibleFallback)[number],
	): string => {
		if (section.key === "documents") {
			return "Ceits found a document-related signal such as proof, privacy, duplicate, or supporting context, but it is not tied to a saved action yet.";
		}
		if (section.key === "benefits") {
			return "Ceits found a promo or loyalty signal that still needs a save or ignore decision.";
		}
		if (section.key === "future") {
			return "Ceits found a recurring, reminder, renewal, or membership hint that still needs review.";
		}
		return `${section.count} ${
			section.count === 1 ? section.signalSingular : section.signalLabel
		} still needs review.`;
	};

	return (
		<section className="rounded-2xl border border-[rgba(181,131,52,0.24)] bg-[rgba(255,248,229,0.74)] px-3 py-3">
			<div className="flex flex-wrap items-start justify-between gap-2">
				<div>
					<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#73501b]">
						Remaining review
					</p>
					<p className="mt-1 text-sm font-semibold text-foreground">
						{pendingCount}{" "}
						{pendingCount === 1 ? "thing still needs" : "things still need"}{" "}
						review
					</p>
					<p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
						These are not part of the item, people, or split wizard above.
					</p>
				</div>
				<PacketPill tone="strong">{pendingCount} pending</PacketPill>
			</div>
			<div className="mt-3 grid gap-2">
				{pendingCandidates.length > 0
					? pendingCandidates.map((candidate) => {
							const sectionKey = packetSectionKey(candidate);
							const visual = capturePacketEntityVisual(sectionKey);
							const section = packetSectionDefinitions.find(
								(item) => item.key === sectionKey,
							);
							const typeLabel = candidateReviewTypeLabel(candidate);
							const title =
								candidate.title ||
								candidate.label ||
								section?.signalSingular ||
								"Review item";
							return (
								<div
									className="flex items-start gap-2 rounded-xl border border-[rgba(181,131,52,0.18)] bg-white/74 px-3 py-3"
									key={`${candidate.source}-${candidate.id}`}
								>
									<EntityIcon size="sm" visualKey={visual.key} />
									<div className="min-w-0 flex-1">
										<div className="flex flex-wrap items-center gap-1.5">
											<span className="inline-flex min-h-5 items-center rounded-full border border-[rgba(181,131,52,0.18)] bg-[rgba(255,248,229,0.74)] px-2 text-[10px] font-bold uppercase tracking-[0.1em] text-[#73501b]">
												{typeLabel}
											</span>
											<span className="inline-flex min-h-5 items-center rounded-full border border-[rgba(120,100,80,0.12)] bg-white/70 px-2 text-[10px] font-semibold text-muted-foreground">
												{candidateStatusLabel(
													candidate.status || "pending_review",
												)}
											</span>
										</div>
										<p className="mt-1.5 text-sm font-semibold text-foreground">
											{title}
										</p>
										<p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
											{candidateReviewSummary(candidate)}
										</p>
										<p className="mt-2 rounded-lg border border-[rgba(181,131,52,0.14)] bg-[rgba(255,248,229,0.62)] px-2.5 py-1.5 text-xs leading-relaxed text-[#73501b]">
											{candidateReviewNextStep(candidate)}
										</p>
									</div>
								</div>
							);
						})
					: visibleFallback.map((section) => (
							<div
								className="flex items-start gap-2 rounded-xl border border-[rgba(181,131,52,0.18)] bg-white/74 px-3 py-3"
								key={section.key}
							>
								<EntityIcon
									size="sm"
									visualKey={capturePacketEntityVisual(section.key).key}
								/>
								<div className="min-w-0">
									<p className="text-sm font-semibold text-foreground">
										{fallbackTitle(section)}
									</p>
									<p className="mt-0.5 text-xs text-muted-foreground">
										{section.count}{" "}
										{section.count === 1
											? section.signalSingular
											: section.signalLabel}{" "}
										needs review.
									</p>
									<p className="mt-1 text-xs leading-relaxed text-muted-foreground">
										{fallbackDescription(section)}
									</p>
									<p className="mt-2 rounded-lg border border-[rgba(181,131,52,0.14)] bg-[rgba(255,248,229,0.62)] px-2.5 py-1.5 text-xs text-[#73501b]">
										Use the capture outcome below to save or remove this review
										data. A dedicated document editor can come in the next
										slice.
									</p>
								</div>
							</div>
						))}
			</div>
		</section>
	);
};

type WizardItemReviewRow = {
	id: string;
	name: string;
	amount: string;
	currency?: string;
	status: "created" | "needs_review";
};

type WizardPersonReviewRow = {
	id: string;
	name: string;
	detail: string;
	status: "created" | "needs_review";
};

type WizardSplitReviewRow = {
	id: string;
	label: string;
	amount: string;
	lines: Array<{ id: string; name: string; amount: string }>;
	status: "created" | "needs_review";
};

type CaptureReviewWizardProps = {
	memberLabels: Map<number, string>;
	packet: CapturePacket;
	spaceId: number;
};

const editableFieldClass =
	"h-9 min-w-0 rounded-lg border border-[rgba(120,100,80,0.16)] bg-white/86 px-2.5 text-xs font-medium text-foreground outline-none transition focus:border-[rgba(181,131,52,0.5)] focus:ring-2 focus:ring-[rgba(181,131,52,0.12)]";

const wizardValueClass =
	"min-h-9 min-w-0 rounded-lg border border-[rgba(120,100,80,0.1)] bg-white/52 px-2.5 py-2 text-xs font-medium text-foreground";

const CaptureReviewWizard = ({
	memberLabels,
	packet,
	spaceId,
}: CaptureReviewWizardProps) => {
	const isReadOnly = capturePacketReviewState(packet) === "complete";
	const itemRows = useMemo<WizardItemReviewRow[]>(() => {
		const savedItems = (packet.records?.expenses ?? []).flatMap((expense) =>
			(expense.items ?? []).map((item) => ({
				id: `saved-item-${expense.id}-${item.id}`,
				name: item.name || "Item",
				amount: String(item.amount ?? ""),
				currency: expense.currency,
				status: "created" as const,
			})),
		);
		if (savedItems.length) return savedItems;
		return captureItemLabels(packet).map((name, index) => ({
			id: `candidate-item-${packet.sourceDocumentId}-${index}`,
			name,
			amount: "",
			status: "needs_review" as const,
		}));
	}, [packet]);
	const personRows = useMemo<WizardPersonReviewRow[]>(() => {
		const savedPeople = (packet.records?.participants ?? []).map((person) => ({
			id: `saved-person-${person.id}`,
			name: person.display_name || "Participant",
			detail:
				[
					person.email || person.telegram_username,
					person.status || person.participant_type,
				]
					.filter(Boolean)
					.join(" · ") || "Participant",
			status: "created" as const,
		}));
		const candidatePeople = reviewVisibleCandidates(packet.candidates)
			.filter(
				(candidate) =>
					packetSectionKey(candidate) === "people" &&
					!savedPeople.some(
						(person) =>
							person.name.trim().toLowerCase() ===
							candidate.title.trim().toLowerCase(),
					),
			)
			.map((candidate) => ({
				id: `candidate-person-${candidate.id}`,
				name: candidate.title || candidate.label || "Participant",
				detail: candidate.meta || candidate.detail || "Needs review",
				status: "needs_review" as const,
			}));
		return [...savedPeople, ...candidatePeople];
	}, [packet]);
	const splitRows = useMemo<WizardSplitReviewRow[]>(() => {
		const savedSplits = (packet.records?.splits ?? []).map((split) => ({
			id: `saved-split-${split.expense_id}`,
			label: "Split",
			amount: formatRecordMoney(split.total_amount),
			lines: (split.participant_lines ?? []).map((line) => ({
				id: `split-line-${line.id}`,
				name:
					line.display_name?.trim() ||
					(line.space_participant_id != null
						? `Participant #${line.space_participant_id}`
						: line.user_id != null
							? (memberLabels.get(Number(line.user_id)) ??
								`User #${line.user_id}`)
							: "Participant"),
				amount: formatRecordMoney(line.amount),
			})),
			status: "created" as const,
		}));
		const candidateSplits = reviewVisibleCandidates(packet.candidates)
			.filter((candidate) => packetSectionKey(candidate) === "splits")
			.map((candidate) => ({
				id: `candidate-split-${candidate.id}`,
				label: candidate.title || "Split",
				amount: candidate.meta || "Needs target expense",
				lines: candidate.fields.map((field, index) => ({
					id: `candidate-split-${candidate.id}-${index}`,
					name: field.label,
					amount: field.value,
				})),
				status: "needs_review" as const,
			}));
		return [...savedSplits, ...candidateSplits];
	}, [memberLabels, packet]);
	const [items, setItems] = useState(itemRows);
	const [people, setPeople] = useState(personRows);
	const [splits, setSplits] = useState(splitRows);

	useEffect(() => setItems(itemRows), [itemRows]);
	useEffect(() => setPeople(personRows), [personRows]);
	useEffect(() => setSplits(splitRows), [splitRows]);

	const itemReadyCount = items.filter(
		(item) => item.status === "created",
	).length;
	const peopleReadyCount = people.filter(
		(person) => person.status === "created",
	).length;
	const splitReadyCount = splits.filter(
		(split) => split.status === "created",
	).length;

	return (
		<section className="overflow-hidden rounded-2xl border border-[rgba(120,100,80,0.14)] bg-[rgba(255,252,246,0.82)] shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
			<div className="border-b border-[rgba(120,100,80,0.1)] px-3 py-3">
				<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
					Review wizard
				</p>
				<h4 className="mt-1 text-base font-semibold text-foreground">
					{isReadOnly
						? "Created records from this capture"
						: "Confirm what this capture should create"}
				</h4>
				<p className="mt-1 text-xs leading-relaxed text-muted-foreground">
					{isReadOnly
						? "This capture is complete, so the records below are shown as saved output."
						: "Work top to bottom: confirm expense items, then people, then split shares. Fields stay editable until backend update endpoints are wired."}
				</p>
			</div>
			<div className="divide-y divide-[rgba(120,100,80,0.1)]">
				<WizardStep
					countLabel={`${itemReadyCount}/${items.length || 0} ready`}
					index={1}
					title="Expense items"
				>
					{items.length ? (
						<div className="space-y-2">
							{items.map((item) => (
								<div
									className="grid gap-2 rounded-xl border border-[rgba(120,100,80,0.12)] bg-white/72 p-2 sm:grid-cols-[minmax(0,1fr)_8.5rem_auto] sm:items-center"
									key={item.id}
								>
									{isReadOnly ? (
										<WizardValue>{item.name}</WizardValue>
									) : (
										<input
											aria-label="Item name"
											className={editableFieldClass}
											onChange={(event) =>
												setItems((current) =>
													current.map((entry) =>
														entry.id === item.id
															? { ...entry, name: event.target.value }
															: entry,
													),
												)
											}
											value={item.name}
										/>
									)}
									{isReadOnly ? (
										<WizardValue className="tabular-nums">
											{item.amount || "Amount not set"}
										</WizardValue>
									) : (
										<input
											aria-label="Item amount"
											className={`${editableFieldClass} tabular-nums`}
											onChange={(event) =>
												setItems((current) =>
													current.map((entry) =>
														entry.id === item.id
															? { ...entry, amount: event.target.value }
															: entry,
													),
												)
											}
											placeholder="Amount"
											value={item.amount}
										/>
									)}
									<WizardStatus status={item.status} />
								</div>
							))}
						</div>
					) : (
						<WizardEmpty text="No expense items were found in this capture." />
					)}
				</WizardStep>
				<WizardStep
					countLabel={`${peopleReadyCount}/${people.length || 0} ready`}
					index={2}
					title="People"
				>
					{people.length ? (
						<div className="space-y-2">
							{people.map((person) => (
								<div
									className="grid gap-2 rounded-xl border border-[rgba(91,116,87,0.14)] bg-[rgba(248,252,247,0.76)] p-2 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,0.8fr)_auto]"
									key={person.id}
								>
									{isReadOnly ? (
										<WizardValue>{person.name}</WizardValue>
									) : (
										<input
											aria-label="Participant name"
											className={editableFieldClass}
											onChange={(event) =>
												setPeople((current) =>
													current.map((entry) =>
														entry.id === person.id
															? { ...entry, name: event.target.value }
															: entry,
													),
												)
											}
											value={person.name}
										/>
									)}
									{isReadOnly ? (
										<WizardValue>{person.detail}</WizardValue>
									) : (
										<input
											aria-label="Participant detail"
											className={editableFieldClass}
											onChange={(event) =>
												setPeople((current) =>
													current.map((entry) =>
														entry.id === person.id
															? { ...entry, detail: event.target.value }
															: entry,
													),
												)
											}
											value={person.detail}
										/>
									)}
									<WizardStatus status={person.status} />
								</div>
							))}
							{isReadOnly ? null : (
								<Link
									className="inline-flex min-h-8 items-center rounded-full border border-[rgba(91,116,87,0.18)] bg-white/78 px-3 text-xs font-semibold text-foreground transition hover:bg-white"
									to={spaceMembersHref(spaceId)}
								>
									Manage aliases
								</Link>
							)}
						</div>
					) : (
						<WizardEmpty text="No people were found in this capture." />
					)}
				</WizardStep>
				<WizardStep
					countLabel={`${splitReadyCount}/${splits.length || 0} ready`}
					index={3}
					title="Splits"
				>
					{splits.length ? (
						<div className="space-y-2">
							{splits.map((split) => (
								<div
									className="rounded-xl border border-[rgba(181,131,52,0.16)] bg-[rgba(255,250,236,0.76)] p-2"
									key={split.id}
								>
									<div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_auto] sm:items-center">
										{isReadOnly ? (
											<WizardValue>{split.label}</WizardValue>
										) : (
											<input
												aria-label="Split label"
												className={editableFieldClass}
												onChange={(event) =>
													setSplits((current) =>
														current.map((entry) =>
															entry.id === split.id
																? { ...entry, label: event.target.value }
																: entry,
														),
													)
												}
												value={split.label}
											/>
										)}
										{isReadOnly ? (
											<WizardValue className="tabular-nums">
												{split.amount || "Amount not set"}
											</WizardValue>
										) : (
											<input
												aria-label="Split amount"
												className={`${editableFieldClass} tabular-nums`}
												onChange={(event) =>
													setSplits((current) =>
														current.map((entry) =>
															entry.id === split.id
																? { ...entry, amount: event.target.value }
																: entry,
														),
													)
												}
												value={split.amount}
											/>
										)}
										<WizardStatus status={split.status} />
									</div>
									{split.lines.length ? (
										<div className="mt-2 grid gap-1.5">
											{split.lines.map((line) => (
												<div
													className="flex items-center justify-between gap-2 rounded-lg bg-white/62 px-2.5 py-1.5 text-xs"
													key={line.id}
												>
													<span className="min-w-0 truncate text-muted-foreground">
														{line.name}
													</span>
													<span className="shrink-0 font-semibold tabular-nums text-foreground">
														{line.amount}
													</span>
												</div>
											))}
										</div>
									) : null}
								</div>
							))}
						</div>
					) : (
						<WizardEmpty text="No splits were found in this capture." />
					)}
				</WizardStep>
			</div>
		</section>
	);
};

type WizardStepProps = {
	children: ReactNode;
	countLabel: string;
	index: number;
	title: string;
};

const WizardStep = ({
	children,
	countLabel,
	index,
	title,
}: WizardStepProps) => (
	<div className="grid gap-3 px-3 py-3 lg:grid-cols-[9.5rem_minmax(0,1fr)]">
		<div className="flex items-center gap-2 lg:block">
			<span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[rgba(68,58,42,0.92)] text-xs font-bold text-[#fffaf0]">
				{index}
			</span>
			<div className="min-w-0 lg:mt-2">
				<p className="text-sm font-semibold text-foreground">{title}</p>
				<p className="text-xs text-muted-foreground">{countLabel}</p>
			</div>
		</div>
		<div className="min-w-0">{children}</div>
	</div>
);

type WizardValueProps = {
	children: ReactNode;
	className?: string;
};

const WizardValue = ({ children, className = "" }: WizardValueProps) => (
	<div className={`${wizardValueClass} ${className}`.trim()}>{children}</div>
);

const WizardStatus = ({
	status,
}: {
	status: "created" | "needs_review";
}) => (
	<span
		className={[
			"inline-flex h-8 shrink-0 items-center justify-center rounded-full border px-2.5 text-[11px] font-semibold",
			status === "created"
				? "border-[rgba(91,116,87,0.18)] bg-[rgba(242,250,241,0.78)] text-[#3d6743]"
				: "border-[rgba(181,131,52,0.22)] bg-[rgba(255,247,225,0.78)] text-[#73501b]",
		].join(" ")}
	>
		{status === "created" ? "Created" : "Review"}
	</span>
);

const WizardEmpty = ({ text }: { text: string }) => (
	<p className="rounded-xl border border-dashed border-[rgba(120,100,80,0.16)] bg-white/48 px-3 py-3 text-xs text-muted-foreground">
		{text}
	</p>
);

type CaptureItemsFoundProps = {
	packet: CapturePacket;
};

const captureItemLabels = (packet: CapturePacket): string[] => {
	const labels: string[] = [];
	for (const candidate of packet.candidates) {
		for (const itemLabel of candidate.itemLabels ?? []) {
			const clean = itemLabel.trim();
			if (clean) labels.push(clean);
		}
	}
	for (const expense of packet.records?.expenses ?? []) {
		for (const item of expense.items ?? []) {
			const clean = item.name?.trim();
			if (clean) labels.push(clean);
		}
	}
	const seen = new Set<string>();
	return labels.filter((label) => {
		const key = label.toLowerCase();
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
};

export const CaptureItemsFound = ({ packet }: CaptureItemsFoundProps) => {
	const items = captureItemLabels(packet);
	if (items.length === 0) return null;
	const visibleItems = items.slice(0, 8);
	const extraCount = Math.max(0, items.length - visibleItems.length);
	return (
		<div className="rounded-2xl border border-[rgba(120,100,80,0.12)] bg-[rgba(255,252,246,0.78)] px-3 py-3">
			<div className="flex flex-wrap items-start justify-between gap-2">
				<div className="flex min-w-0 items-start gap-2">
					<EntityIcon size="sm" visualKey="expenseItem" />
					<div className="min-w-0">
						<p className="text-sm font-semibold text-foreground">
							Items found in this capture
						</p>
						<p className="mt-0.5 text-xs text-muted-foreground">
							Line items stay attached to the capture and can become expense
							items after review.
						</p>
					</div>
				</div>
				<PacketPill size="compact" tone="muted">
					{items.length} {items.length === 1 ? "item" : "items"}
				</PacketPill>
			</div>
			<div className="mt-3 flex flex-wrap gap-1.5">
				{visibleItems.map((item) => (
					<span
						className="rounded-full border border-[rgba(120,100,80,0.14)] bg-white/82 px-2.5 py-1 text-[11px] font-medium text-foreground/78"
						key={item}
					>
						{item}
					</span>
				))}
				{extraCount > 0 ? (
					<span className="rounded-full border border-[rgba(120,100,80,0.14)] bg-white/70 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
						+{extraCount} more
					</span>
				) : null}
			</div>
		</div>
	);
};

type CaptureRecordsSummaryProps = {
	memberLabels: Map<number, string>;
	packet: CapturePacket;
};

const recordCreatorLabel = (
	userID: number | null | undefined,
	memberLabels: Map<number, string>,
	packet: CapturePacket,
): string | null => {
	if (userID == null || !Number.isFinite(Number(userID))) return null;
	const numeric = Number(userID);
	return (
		memberLabels.get(numeric) ??
		(packet.createdByUserId === numeric ? packet.createdByLabel : null) ??
		`user #${numeric}`
	);
};

const capturePacketRecordCount = (packet: CapturePacket): number => {
	const records = packet.records;
	if (!records) return 0;
	return (
		(records.expenses?.length ?? 0) +
		(records.expenses ?? []).reduce(
			(total, expense) => total + (expense.items?.length ?? 0),
			0,
		) +
		(records.benefits?.length ?? 0) +
		(records.participants?.length ?? 0) +
		(records.splits?.length ?? 0) +
		(records.recurring?.length ?? 0)
	);
};

export const CaptureRecordsSummary = ({
	memberLabels,
	packet,
}: CaptureRecordsSummaryProps) => {
	const expenses = packet.records?.expenses ?? [];
	const benefits = packet.records?.benefits ?? [];
	const participants = packet.records?.participants ?? [];
	const splits = packet.records?.splits ?? [];
	const recurring = packet.records?.recurring ?? [];
	const expenseRecordItems = expenses.flatMap((expense) =>
		(expense.items ?? []).map((item) => ({
			...item,
			currency: expense.currency,
			expenseId: expense.id,
		})),
	);
	const recordCount = capturePacketRecordCount(packet);
	if (recordCount === 0) return null;

	return (
		<div className="rounded-2xl border border-[rgba(91,116,87,0.18)] bg-[rgba(249,253,247,0.8)] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
			<div className="flex flex-wrap items-start justify-between gap-2">
				<div>
					<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
						Created from this capture
					</p>
					<p className="mt-0.5 text-xs text-muted-foreground">
						These are already saved records linked back to this capture.
					</p>
				</div>
				<PacketPill size="compact" tone="strong">
					{recordCount} records
				</PacketPill>
			</div>
			<div className="mt-3 grid gap-2 lg:grid-cols-2">
				{expenseRecordItems.length ? (
					<div className="rounded-xl border border-[rgba(120,100,80,0.12)] bg-white/82 px-3 py-3">
						<div className="flex items-start justify-between gap-3">
							<div className="flex min-w-0 items-start gap-2">
								<EntityIcon size="sm" visualKey="expenseItem" />
								<div className="min-w-0">
									<p className="truncate text-sm font-semibold text-foreground">
										Items saved
									</p>
									<p className="mt-0.5 text-xs text-muted-foreground">
										{expenseRecordItems.length}{" "}
										{expenseRecordItems.length === 1 ? "item" : "items"} linked
										to this capture
									</p>
								</div>
							</div>
						</div>
						<div className="mt-2 space-y-1 rounded-lg border border-[rgba(120,100,80,0.1)] bg-[rgba(255,252,246,0.7)] px-2.5 py-2">
							{expenseRecordItems.slice(0, 6).map((item) => (
								<div
									className="flex items-center justify-between gap-2 text-xs"
									key={`expense-${item.expenseId}-item-${item.id}`}
								>
									<span className="min-w-0 truncate text-muted-foreground">
										{item.name || "Item"}
									</span>
									<span className="shrink-0 font-semibold tabular-nums text-foreground">
										{formatRecordMoney(item.amount, item.currency)}
									</span>
								</div>
							))}
							{expenseRecordItems.length > 6 ? (
								<div className="text-xs font-medium text-muted-foreground">
									+{expenseRecordItems.length - 6} more
								</div>
							) : null}
						</div>
					</div>
				) : null}
				{participants.map((participant) => {
					const creator = recordCreatorLabel(
						participant.created_by_user_id,
						memberLabels,
						packet,
					);
					return (
						<div
							className="rounded-xl border border-[rgba(91,116,87,0.18)] bg-[rgba(247,252,246,0.82)] px-3 py-3"
							key={`participant-${participant.id}`}
						>
							<div className="flex items-start gap-2">
								<EntityIcon
									size="sm"
									visualKey={
										participant.participant_type === "placeholder"
											? "placeholder"
											: "people"
									}
								/>
								<div className="min-w-0">
									<p className="truncate text-sm font-semibold text-foreground">
										{participant.display_name || "Participant"}
									</p>
									<p className="mt-0.5 text-xs text-muted-foreground">
										{[
											participant.status || participant.participant_type,
											participant.email || participant.telegram_username,
											creator ? `by ${creator}` : null,
										]
											.filter(Boolean)
											.join(" • ")}
									</p>
								</div>
							</div>
						</div>
					);
				})}
				{splits.map((split) => {
					const creator = recordCreatorLabel(
						split.created_by_user_id,
						memberLabels,
						packet,
					);
					const participantLines = split.participant_lines ?? [];
					const visibleLines = participantLines.slice(0, 3);
					const extraLines = Math.max(
						0,
						participantLines.length - visibleLines.length,
					);
					return (
						<div
							className="rounded-xl border border-[rgba(91,116,87,0.18)] bg-[rgba(249,253,247,0.82)] px-3 py-3"
							key={`split-${split.expense_id}`}
						>
							<div className="flex items-start justify-between gap-3">
								<div className="flex min-w-0 items-start gap-2">
									<EntityIcon size="sm" visualKey="split" />
									<div className="min-w-0">
										<p className="truncate text-sm font-semibold text-foreground">
											Split saved
										</p>
										<p className="mt-0.5 text-xs text-muted-foreground">
											{[
												split.split_count
													? `${split.split_count} participant shares`
													: null,
												creator ? `by ${creator}` : null,
											]
												.filter(Boolean)
												.join(" • ")}
										</p>
									</div>
								</div>
								<p className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
									{formatRecordMoney(split.total_amount)}
								</p>
							</div>
							{visibleLines.length ? (
								<div className="mt-2 space-y-1 rounded-lg border border-[rgba(91,116,87,0.12)] bg-white/64 px-2.5 py-2">
									{visibleLines.map((line) => {
										const label =
											line.display_name?.trim() ||
											(line.space_participant_id != null
												? `Participant #${line.space_participant_id}`
												: line.user_id != null
													? `User #${line.user_id}`
													: "Participant");
										return (
											<div
												className="flex items-center justify-between gap-2 text-xs"
												key={`split-${split.expense_id}-line-${line.id}`}
											>
												<span className="min-w-0 truncate text-muted-foreground">
													{label}
												</span>
												<span className="shrink-0 font-semibold tabular-nums text-foreground">
													{formatRecordMoney(line.amount)}
												</span>
											</div>
										);
									})}
									{extraLines ? (
										<div className="text-xs font-medium text-muted-foreground">
											+{extraLines} more
										</div>
									) : null}
								</div>
							) : null}
						</div>
					);
				})}
				{recurring.map((item) => {
					const creator = recordCreatorLabel(
						item.created_by_user_id,
						memberLabels,
						packet,
					);
					return (
						<div
							className="rounded-xl border border-[rgba(72,97,137,0.18)] bg-[rgba(244,248,253,0.82)] px-3 py-3"
							key={`recurring-${item.id}`}
						>
							<div className="flex items-start justify-between gap-3">
								<div className="flex min-w-0 items-start gap-2">
									<EntityIcon size="sm" visualKey="future" />
									<div className="min-w-0">
										<p className="truncate text-sm font-semibold text-foreground">
											{item.name || "Recurring rule"}
										</p>
										<p className="mt-0.5 text-xs text-muted-foreground">
											{[
												item.interval,
												item.next_run
													? `next ${formatRecordDate(item.next_run)}`
													: null,
												creator ? `by ${creator}` : null,
											]
												.filter(Boolean)
												.join(" • ")}
										</p>
									</div>
								</div>
								<p className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
									{formatRecordMoney(item.amount)}
								</p>
							</div>
						</div>
					);
				})}
				{benefits.map((benefit) => {
					const creator = recordCreatorLabel(
						benefit.created_by_user_id,
						memberLabels,
						packet,
					);
					return (
						<div
							className="rounded-xl border border-[rgba(181,131,52,0.2)] bg-[rgba(255,250,235,0.82)] px-3 py-3"
							key={`benefit-${benefit.id}`}
						>
							<div className="flex items-start justify-between gap-3">
								<div className="flex min-w-0 items-start gap-2">
									<EntityIcon size="sm" visualKey="benefit" />
									<div className="min-w-0">
										<p className="truncate text-sm font-semibold text-foreground">
											{benefit.promo_code || benefit.title || "Saved promo"}
										</p>
										<p className="mt-0.5 text-xs text-muted-foreground">
											{[
												benefit.redeem_platform ||
													benefit.redeem_merchant_name ||
													benefit.source_merchant_name,
												benefit.discount_type,
												benefit.valid_until
													? `until ${formatRecordDate(benefit.valid_until)}`
													: null,
												creator ? `by ${creator}` : null,
											]
												.filter(Boolean)
												.join(" • ") || benefit.status}
										</p>
									</div>
								</div>
								{benefit.discount_value != null ? (
									<p className="shrink-0 text-sm font-semibold tabular-nums text-[#715016]">
										{benefit.discount_value}
									</p>
								) : null}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
};

type CaptureOutcomeMapProps = {
	packet: CapturePacket;
};

export const CaptureOutcomeMap = ({ packet }: CaptureOutcomeMapProps) => {
	const visibleCandidates = reviewVisibleCandidates(packet.candidates);
	const packetPendingCount = totalPendingCount(packet);
	const summaries = packetSectionDefinitions
		.map((section) => {
			const candidates = visibleCandidates.filter(
				(candidate) => packetSectionKey(candidate) === section.key,
			);
			const total = visibleSectionSignalCount(
				packet,
				section.key,
				visibleCandidates,
			);
			const loadedPending = candidates.filter((candidate) =>
				isPendingReviewStatus(candidate.status),
			).length;
			const loadedCreated = candidates.filter((candidate) =>
				isProjectedStatus(candidate.status),
			).length;
			const loadedClosed = candidates.filter((candidate) =>
				isIgnoredStatus(candidate.status),
			).length;
			const hasLoadedStatus = candidates.length > 0;
			const pending =
				loadedPending ||
				(!hasLoadedStatus && packetPendingCount > 0 ? total : 0);
			const created =
				loadedCreated ||
				(!hasLoadedStatus &&
				packetPendingCount === 0 &&
				(packet.projectedCount ?? 0) > 0
					? total
					: 0);
			const closed =
				loadedClosed ||
				(!hasLoadedStatus &&
				packetPendingCount === 0 &&
				(packet.projectedCount ?? 0) === 0 &&
				(packet.ignoredCount ?? 0) > 0
					? total
					: 0);
			return { candidates, closed, created, pending, section, total };
		})
		.filter((summary) => summary.total > 0 || summary.candidates.length > 0);

	if (summaries.length === 0) return null;

	return (
		<div className="rounded-2xl border border-[rgba(120,100,80,0.12)] bg-[rgba(255,253,249,0.72)] px-3 py-3">
			<div className="flex flex-wrap items-start justify-between gap-2">
				<div>
					<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
						What this capture contains
					</p>
					<p className="mt-0.5 text-xs text-muted-foreground">
						Each group stays under this capture until it becomes a saved record
						or is ignored.
					</p>
				</div>
				<PacketPill size="compact" tone="muted">
					{summaries.length} groups
				</PacketPill>
			</div>
			<div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
				{summaries.map(({ closed, created, pending, section, total }) => {
					const visual = capturePacketEntityVisual(section.key);
					const totalLabel =
						total === 1 ? section.signalSingular : section.signalLabel;
					const stateLabel =
						pending > 0
							? `${pending} need review`
							: created > 0
								? `${created} created`
								: closed > 0
									? `${closed} closed`
									: "Detected";
					const consequence =
						section.key === "expenses"
							? "Can become expenses and line items."
							: section.key === "benefits"
								? "Can become promos or loyalty records."
								: section.key === "people"
									? "Can become participants or aliases."
									: section.key === "splits"
										? "Can attach people to an expense split."
										: section.key === "future"
											? "Can become recurring rules or reminders."
											: "Can become proof, privacy, or supporting context.";
					return (
						<div
							className="rounded-xl border border-[rgba(120,100,80,0.12)] bg-white/76 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]"
							key={section.key}
						>
							<div className="flex items-start justify-between gap-2">
								<div className="flex min-w-0 items-center gap-2">
									<EntityIcon size="xs" visualKey={visual.key} />
									<div className="min-w-0">
										<p className="truncate text-xs font-semibold text-foreground">
											{section.shortTitle}
										</p>
										<p className="text-[11px] text-muted-foreground">
											{total} {totalLabel}
										</p>
									</div>
								</div>
								<span className="shrink-0 rounded-full border border-[rgba(120,100,80,0.12)] bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-foreground/70">
									{stateLabel}
								</span>
							</div>
							<p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
								{consequence}
							</p>
						</div>
					);
				})}
			</div>
		</div>
	);
};

type CaptureProgressStripProps = {
	packet: CapturePacket;
	actionCount: number;
};

export const CaptureProgressStrip = ({
	packet,
	actionCount,
}: CaptureProgressStripProps) => {
	const visibleCandidates = reviewVisibleCandidates(packet.candidates);
	const visibleSectionDefinitions = packetSectionDefinitions
		.map((section) => ({
			...section,
			count: visibleSectionSignalCount(packet, section.key, visibleCandidates),
		}))
		.filter((section) => section.count > 0);
	const pendingCount = visiblePendingCount(packet);
	const createdCount = packet.projectedCount ?? 0;
	const foundCount =
		visibleCandidates.length > 0
			? visibleCandidates.length
			: (packet.candidateCount ?? 0);
	const foundLabel =
		foundCount > 0
			? `Found ${foundCount} ${foundCount === 1 ? "signal" : "signals"}`
			: "Found no open signals";
	const actionLabel =
		pendingCount > 0
			? `Needs action: ${pendingCount}`
			: actionCount > 0
				? `Needs action: ${actionCount}`
				: "Needs action: none";
	const recordCount = capturePacketRecordCount(packet);
	const createdRecordCount = Math.max(createdCount, recordCount);
	const createdLabel =
		createdRecordCount > 0
			? `Created ${createdRecordCount} ${createdRecordCount === 1 ? "record" : "records"}`
			: "Created no records yet";

	return (
		<div className="rounded-2xl border border-[rgba(120,100,80,0.12)] bg-white/62 px-3 py-3">
			<div className="flex flex-wrap items-center gap-2">
				<CaptureStepPill
					label={`Received ${packet.meta.toLowerCase()}`}
					visualKey="reviewPacket"
				/>
				<CaptureStepPill label={foundLabel} visualKey="document" />
				<CaptureStepPill
					label={actionLabel}
					tone={pendingCount > 0 ? "strong" : "muted"}
					visualKey={pendingCount > 0 ? "reviewPacket" : "expense"}
				/>
				<CaptureStepPill
					label={createdLabel}
					tone={createdRecordCount > 0 ? "strong" : "muted"}
					visualKey="future"
				/>
			</div>
			{visibleSectionDefinitions.length > 0 ? (
				<div className="mt-2 flex flex-wrap items-center gap-1.5">
					{visibleSectionDefinitions.map((section) => {
						const visual = capturePacketEntityVisual(section.key);
						return (
							<span
								className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-[rgba(120,100,80,0.12)] bg-white/74 px-2.5 text-[11px] font-semibold text-foreground/76"
								key={section.key}
							>
								<EntityIcon size="xs" visualKey={visual.key} />
								{section.shortTitle} {section.count}
							</span>
						);
					})}
				</div>
			) : null}
		</div>
	);
};

type CaptureStepPillProps = {
	label: string;
	tone?: PacketPillTone;
	visualKey: EntityVisualKey;
};

const CaptureStepPill = ({
	label,
	tone = "muted",
	visualKey,
}: CaptureStepPillProps) => (
	<span
		className={[
			"inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold",
			tone === "strong"
				? "border-[rgba(172,124,35,0.24)] bg-[rgba(255,245,219,0.9)] text-[#715016]"
				: "border-[rgba(120,100,80,0.12)] bg-white/76 text-muted-foreground",
		].join(" ")}
	>
		<EntityIcon size="xs" visualKey={visualKey} />
		{label}
	</span>
);

type PacketActionBarProps = {
	candidates: CandidateReviewItem[];
	benefitCandidateActingId: number | null;
	documentCandidateActingId: number | null;
	splitTargetExpenseIdFor: (candidate: CandidateReviewItem) => number | null;
	pendingParticipantCountForSplitCandidate: (
		candidate: CandidateReviewItem,
	) => number;
	onSavePromoCandidate: (
		candidate: CandidateReviewItem,
	) => Promise<void> | void;
	onConfirmDocumentCandidate: (
		candidate: CandidateReviewItem,
	) => Promise<void> | void;
	onCreateParticipantCandidate: (
		candidate: CandidateReviewItem,
	) => Promise<void> | void;
	onCreateRecurringCandidate: (
		candidate: CandidateReviewItem,
	) => Promise<void> | void;
	onApplySplitCandidate: (
		candidate: CandidateReviewItem,
		targetExpenseId: number | null,
	) => Promise<void> | void;
};

export const PacketActionBar = ({
	candidates,
	benefitCandidateActingId,
	documentCandidateActingId,
	splitTargetExpenseIdFor,
	pendingParticipantCountForSplitCandidate,
	onSavePromoCandidate,
	onConfirmDocumentCandidate,
	onCreateParticipantCandidate,
	onCreateRecurringCandidate,
	onApplySplitCandidate,
}: PacketActionBarProps) => {
	const [acceptingAll, setAcceptingAll] = useState(false);
	const openActionCandidates = candidates.filter(hasOpenCandidateAction);
	const promoCandidate = openActionCandidates.find(
		(candidate) => candidate.canSavePromo,
	);
	const participantCandidate = candidates.find(
		(candidate) =>
			hasOpenCandidateAction(candidate) && candidate.canCreateParticipant,
	);
	const recurringCandidate = openActionCandidates.find(
		(candidate) => candidate.canCreateRecurring,
	);
	const reviewCandidate = openActionCandidates.find(
		(candidate) => candidate.canMarkReviewed,
	);
	const splitCandidate = openActionCandidates.find(
		(candidate) => candidate.canOpenSplitReview,
	);
	const splitTargetExpenseId = splitCandidate
		? splitTargetExpenseIdFor(splitCandidate)
		: null;
	const splitBlocked =
		splitCandidate != null &&
		pendingParticipantCountForSplitCandidate(splitCandidate) > 0;
	const isBenefitActing = (candidate: CandidateReviewItem | undefined) =>
		candidate != null &&
		candidate.source === "benefit" &&
		benefitCandidateActingId === candidate.id;
	const isDocumentActing = (candidate: CandidateReviewItem | undefined) =>
		candidate != null &&
		candidate.source === "document" &&
		documentCandidateActingId === candidate.id;
	const hasActions =
		promoCandidate ||
		participantCandidate ||
		recurringCandidate ||
		reviewCandidate ||
		splitCandidate;
	const handleAcceptAll = async () => {
		if (!hasActions || acceptingAll) return;
		setAcceptingAll(true);
		try {
			for (const candidate of openActionCandidates.filter(
				(item) => item.canCreateParticipant,
			)) {
				await Promise.resolve(onCreateParticipantCandidate(candidate));
			}
			for (const candidate of openActionCandidates.filter(
				(item) => item.canSavePromo,
			)) {
				await Promise.resolve(onSavePromoCandidate(candidate));
			}
			for (const candidate of openActionCandidates.filter(
				(item) => item.canCreateRecurring,
			)) {
				await Promise.resolve(onCreateRecurringCandidate(candidate));
			}
			for (const candidate of openActionCandidates.filter(
				(item) => item.canMarkReviewed,
			)) {
				await Promise.resolve(onConfirmDocumentCandidate(candidate));
			}
			for (const candidate of openActionCandidates.filter(
				(item) => item.canOpenSplitReview,
			)) {
				await Promise.resolve(
					onApplySplitCandidate(candidate, splitTargetExpenseIdFor(candidate)),
				);
			}
		} finally {
			setAcceptingAll(false);
		}
	};

	if (!hasActions) return null;

	return (
		<div className="border-b border-[rgba(120,100,80,0.1)] pb-3">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div>
					<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
						Next actions
					</p>
					<p className="mt-0.5 text-xs text-muted-foreground">
						Start with the highest-signal candidates, then finish details inside
						sections.
					</p>
				</div>
				<div className="flex flex-wrap items-center justify-end gap-1.5">
					<CandidateActionButton
						disabled={acceptingAll}
						onClick={() => void handleAcceptAll()}
						tone="attention"
					>
						{acceptingAll ? "Accepting" : "Accept all"}
					</CandidateActionButton>
					{promoCandidate ? (
						<CandidateActionButton
							disabled={acceptingAll || isBenefitActing(promoCandidate)}
							onClick={() => onSavePromoCandidate(promoCandidate)}
							tone="benefit"
						>
							{isBenefitActing(promoCandidate) ? "Saving" : "Save promo"}
						</CandidateActionButton>
					) : null}
					{participantCandidate ? (
						<CandidateActionButton
							disabled={acceptingAll || isDocumentActing(participantCandidate)}
							onClick={() => onCreateParticipantCandidate(participantCandidate)}
							tone="people"
						>
							{isDocumentActing(participantCandidate)
								? "Creating"
								: "Add person"}
						</CandidateActionButton>
					) : null}
					{splitCandidate ? (
						<CandidateActionButton
							disabled={
								acceptingAll ||
								splitBlocked ||
								splitTargetExpenseId == null ||
								isDocumentActing(splitCandidate)
							}
							onClick={() =>
								onApplySplitCandidate(splitCandidate, splitTargetExpenseId)
							}
							tone="attention"
						>
							{splitBlocked
								? "Add people first"
								: isDocumentActing(splitCandidate)
									? "Applying"
									: "Apply split"}
						</CandidateActionButton>
					) : null}
					{recurringCandidate ? (
						<CandidateActionButton
							disabled={acceptingAll || isDocumentActing(recurringCandidate)}
							onClick={() => onCreateRecurringCandidate(recurringCandidate)}
							tone="attention"
						>
							{isDocumentActing(recurringCandidate)
								? "Creating"
								: "Create recurring"}
						</CandidateActionButton>
					) : null}
					{reviewCandidate ? (
						<CandidateActionButton
							disabled={acceptingAll || isDocumentActing(reviewCandidate)}
							onClick={() => onConfirmDocumentCandidate(reviewCandidate)}
							tone="review"
						>
							{isDocumentActing(reviewCandidate) ? "Saving" : "Mark reviewed"}
						</CandidateActionButton>
					) : null}
				</div>
			</div>
		</div>
	);
};

type CaptureCandidateRowProps = Omit<
	CapturePacketRowProps,
	| "packet"
	| "memberLabels"
	| "deletingSourceDocumentId"
	| "onDeleteCapture"
	| "onFinishReview"
	| "finishingSourceDocumentId"
> & {
	candidate: CandidateReviewItem;
};

const CaptureCandidateRow = ({
	candidate,
	benefitCandidateActingId,
	documentCandidateActingId,
	splitTargetOptions,
	spaceId,
	splitTargetExpenseIdFor,
	pendingParticipantCountForSplitCandidate,
	onSplitTargetChange,
	onSavePromoCandidate,
	onConfirmDocumentCandidate,
	onCreateParticipantCandidate,
	onCreateRecurringCandidate,
	onApplySplitCandidate,
	onIgnoreCandidate,
}: CaptureCandidateRowProps) => {
	const actingId =
		candidate.source === "benefit"
			? benefitCandidateActingId
			: documentCandidateActingId;
	const isActing = actingId === candidate.id;
	const splitTargetExpenseId = candidate.canOpenSplitReview
		? splitTargetExpenseIdFor(candidate)
		: null;
	const projectedSplitTargetExpenseId =
		candidate.source === "document" ? candidate.projectedExpenseId : null;
	const splitTargetMatchedSource =
		splitTargetExpenseId != null &&
		projectedSplitTargetExpenseId === splitTargetExpenseId;
	const pendingSplitParticipantCount =
		pendingParticipantCountForSplitCandidate(candidate);
	const splitApplyBlocked = pendingSplitParticipantCount > 0;
	const splitParticipantLabel =
		pendingSplitParticipantCount === 1 ? "person" : "people";
	const hasOpenAction = hasOpenCandidateAction(candidate);

	return (
		<div className="py-2.5 first:pt-0 last:pb-0">
			<EntityListItem
				density="compact"
				entity={candidateEntity(candidate)}
				trailing={
					<CaptureCandidateActions
						candidate={candidate}
						isActing={isActing}
						onApplySplitCandidate={onApplySplitCandidate}
						onConfirmDocumentCandidate={onConfirmDocumentCandidate}
						onCreateParticipantCandidate={onCreateParticipantCandidate}
						onCreateRecurringCandidate={onCreateRecurringCandidate}
						onIgnoreCandidate={onIgnoreCandidate}
						onSavePromoCandidate={onSavePromoCandidate}
						spaceId={spaceId}
						splitApplyBlocked={splitApplyBlocked}
						splitTargetExpenseId={splitTargetExpenseId}
					/>
				}
			/>
			{candidate.isSelfParticipant ? (
				<p className="mt-2 rounded-lg border border-[rgba(83,103,139,0.18)] bg-white/58 px-2.5 py-1.5 text-xs text-[#405574]">
					Already covered by your space member. Mark it reviewed or ignore it.
				</p>
			) : null}
			{hasOpenAction && candidate.canOpenSplitReview ? (
				<div className="mt-2 rounded-lg border border-[rgba(181,131,52,0.18)] bg-[rgba(255,252,246,0.72)] px-2.5 py-2">
					<label
						className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
						htmlFor={`split-target-${candidate.id}`}
					>
						Apply to expense
					</label>
					{splitTargetOptions.length > 0 ? (
						<select
							className="mt-1 h-9 w-full rounded-md border border-[rgba(120,100,80,0.18)] bg-white px-2 text-xs font-medium text-foreground shadow-sm outline-none transition focus:border-[rgba(181,131,52,0.48)]"
							disabled={isActing || splitApplyBlocked}
							id={`split-target-${candidate.id}`}
							onChange={(event) =>
								onSplitTargetChange(candidate.id, Number(event.target.value))
							}
							value={String(splitTargetExpenseId ?? "")}
						>
							{splitTargetOptions.map((option) => (
								<option key={option.expenseId} value={option.expenseId}>
									{option.label}
								</option>
							))}
						</select>
					) : (
						<p className="mt-1 text-xs text-muted-foreground">
							No review expense is available yet.
						</p>
					)}
					{splitApplyBlocked ? (
						<p className="mt-2 rounded-md border border-[rgba(83,103,139,0.18)] bg-[rgba(247,250,255,0.72)] px-2 py-1.5 text-xs text-[#405574]">
							Add {pendingSplitParticipantCount} {splitParticipantLabel} from
							this capture first, then apply the split to the expense.
						</p>
					) : null}
					{splitTargetMatchedSource && !splitApplyBlocked ? (
						<p className="mt-2 text-xs text-muted-foreground">
							Matched to the expense created from this capture.
						</p>
					) : null}
				</div>
			) : null}
		</div>
	);
};

type CaptureCandidateActionsProps = {
	candidate: CandidateReviewItem;
	isActing: boolean;
	spaceId: number;
	splitApplyBlocked: boolean;
	splitTargetExpenseId: number | null;
	onSavePromoCandidate: (candidate: CandidateReviewItem) => void;
	onConfirmDocumentCandidate: (candidate: CandidateReviewItem) => void;
	onCreateParticipantCandidate: (candidate: CandidateReviewItem) => void;
	onCreateRecurringCandidate: (candidate: CandidateReviewItem) => void;
	onApplySplitCandidate: (
		candidate: CandidateReviewItem,
		targetExpenseId: number | null,
	) => void;
	onIgnoreCandidate: (candidate: CandidateReviewItem) => void;
};

const CaptureCandidateActions = ({
	candidate,
	isActing,
	spaceId,
	splitApplyBlocked,
	splitTargetExpenseId,
	onSavePromoCandidate,
	onConfirmDocumentCandidate,
	onCreateParticipantCandidate,
	onCreateRecurringCandidate,
	onApplySplitCandidate,
	onIgnoreCandidate,
}: CaptureCandidateActionsProps) => {
	const isPendingReview = isPendingReviewStatus(candidate.status);
	const hasOpenAction = hasOpenCandidateAction(candidate);
	return (
		<div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
			{hasOpenAction && candidate.canSavePromo ? (
				<CandidateActionButton
					disabled={isActing}
					onClick={() => onSavePromoCandidate(candidate)}
					tone="benefit"
				>
					{isActing ? "Saving" : "Save promo"}
				</CandidateActionButton>
			) : null}
			{hasOpenAction && candidate.canMarkReviewed ? (
				<CandidateActionButton
					disabled={isActing}
					onClick={() => onConfirmDocumentCandidate(candidate)}
					tone="review"
				>
					{isActing ? "Saving" : "Reviewed"}
				</CandidateActionButton>
			) : null}
			{hasOpenAction && candidate.canCreateParticipant ? (
				<CandidateActionButton
					disabled={isActing}
					onClick={() => onCreateParticipantCandidate(candidate)}
					tone="people"
				>
					{isActing ? "Creating" : "Add person"}
				</CandidateActionButton>
			) : null}
			{candidate.candidateType === "participant_placeholder_candidate" ? (
				<Link
					className={`inline-flex items-center ${candidateActionButtonClass("people")}`}
					to={spaceMembersHref(spaceId)}
				>
					Manage aliases
				</Link>
			) : null}
			{hasOpenAction && candidate.canCreateRecurring ? (
				<CandidateActionButton
					disabled={isActing}
					onClick={() => onCreateRecurringCandidate(candidate)}
					tone="attention"
				>
					{isActing ? "Creating" : "Create recurring"}
				</CandidateActionButton>
			) : null}
			{hasOpenAction && candidate.canOpenSplitReview ? (
				splitTargetExpenseId != null ? (
					<CandidateActionButton
						disabled={isActing || splitApplyBlocked}
						onClick={() =>
							onApplySplitCandidate(candidate, splitTargetExpenseId)
						}
						tone="attention"
					>
						{splitApplyBlocked
							? "Add people first"
							: isActing
								? "Applying"
								: "Apply split"}
					</CandidateActionButton>
				) : (
					<Link
						className={`inline-flex items-center ${candidateActionButtonClass("attention")}`}
						to={`/console/spaces/${spaceId}/splits`}
					>
						Open splits
					</Link>
				)
			) : null}
			{isPendingReview ? (
				<CandidateActionButton
					disabled={isActing}
					onClick={() => onIgnoreCandidate(candidate)}
					tone="neutral"
				>
					{isActing ? "Working" : "Ignore"}
				</CandidateActionButton>
			) : null}
		</div>
	);
};
