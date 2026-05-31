import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type {
	CandidateReviewItem,
	CandidateReviewTone,
	CapturePacket,
	SplitTargetOption,
} from "./reviewPacketTypes";

type CapturePacketReviewSectionProps = {
	packets: CapturePacket[];
	decisionCount: number;
	spaceId: number;
	documentCandidateError: string | null;
	benefitCandidateActingId: number | null;
	documentCandidateActingId: number | null;
	splitTargetOptions: SplitTargetOption[];
	splitTargetExpenseIdFor: (candidate: CandidateReviewItem) => number | null;
	pendingParticipantCountForSplitCandidate: (
		candidate: CandidateReviewItem,
	) => number;
	onSplitTargetChange: (candidateId: number, expenseId: number) => void;
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

const candidateBadgeClass = (tone: CandidateReviewTone): string => {
	if (tone === "benefit") {
		return "border-[rgba(102,134,108,0.28)] bg-[rgba(237,247,239,0.82)] text-[#58745f]";
	}
	if (tone === "split") {
		return "border-[rgba(181,131,52,0.32)] bg-[rgba(255,240,208,0.72)] text-[#73501b]";
	}
	if (tone === "participant") {
		return "border-[rgba(83,103,139,0.28)] bg-[rgba(235,241,252,0.82)] text-[#405574]";
	}
	return "border-border/70 bg-white text-muted-foreground";
};

type PacketSectionKey =
	| "expenses"
	| "benefits"
	| "people"
	| "splits"
	| "future"
	| "documents";

const packetSectionDefinitions: Array<{
	key: PacketSectionKey;
	title: string;
	description: string;
}> = [
	{
		key: "expenses",
		title: "Expense draft",
		description: "Amounts, items, merchant, category, and draft expense data.",
	},
	{
		key: "benefits",
		title: "Benefits",
		description: "Promos and loyalty findings that can be saved separately.",
	},
	{
		key: "people",
		title: "People",
		description: "Participants and placeholders detected from this capture.",
	},
	{
		key: "splits",
		title: "Splits",
		description: "Split proposals that need people and target expense context.",
	},
	{
		key: "future",
		title: "Future actions",
		description: "Recurring, membership, reminder, and renewal hints.",
	},
	{
		key: "documents",
		title: "Document signals",
		description:
			"Payment proof, privacy, merge, and supporting document signals.",
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

export const CapturePacketReviewSection = ({
	packets,
	decisionCount,
	spaceId,
	documentCandidateError,
	benefitCandidateActingId,
	documentCandidateActingId,
	splitTargetOptions,
	splitTargetExpenseIdFor,
	pendingParticipantCountForSplitCandidate,
	onSplitTargetChange,
	onSavePromoCandidate,
	onConfirmDocumentCandidate,
	onCreateParticipantCandidate,
	onCreateRecurringCandidate,
	onApplySplitCandidate,
	onIgnoreCandidate,
}: CapturePacketReviewSectionProps) => {
	const visiblePackets = useMemo(() => packets.slice(0, 6), [packets]);
	const [selectedPacketId, setSelectedPacketId] = useState<number | null>(
		() => visiblePackets[0]?.sourceDocumentId ?? null,
	);
	const selectedPacket = useMemo(
		() =>
			visiblePackets.find(
				(packet) => packet.sourceDocumentId === selectedPacketId,
			) ?? visiblePackets[0],
		[visiblePackets, selectedPacketId],
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
		setSelectedPacketId(visiblePackets[0]?.sourceDocumentId ?? null);
	}, [visiblePackets, selectedPacketId]);

	return (
		<section className="mx-auto mb-5 max-w-5xl rounded-[1.35rem] border border-[rgba(120,100,80,0.2)] bg-[rgba(255,252,246,0.94)] p-4 shadow-sm">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
						Capture review
					</p>
					<h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
						Capture packets waiting for review
					</h2>
					<p className="mt-1 max-w-2xl text-sm text-muted-foreground">
						Each packet is one parsed text, voice note, receipt, or screenshot.
						Review the packet, then decide which parts become expenses, promos,
						people, splits, or document signals.
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-1.5">
					<span className="rounded-full border border-[rgba(120,100,80,0.22)] bg-white px-2.5 py-1 text-xs font-semibold text-foreground/75">
						{packets.length} packets
					</span>
					<span className="rounded-full border border-[rgba(120,100,80,0.16)] bg-white/70 px-2.5 py-1 text-xs font-semibold text-muted-foreground">
						{decisionCount} decisions
					</span>
				</div>
			</div>
			<div className="mt-4 grid gap-3 lg:grid-cols-[minmax(220px,0.36fr)_1fr]">
				<div className="space-y-2">
					<p className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
						Packet queue
					</p>
					{visiblePackets.map((packet) => {
						const selected =
							selectedPacket?.sourceDocumentId === packet.sourceDocumentId;
						return (
							<button
								aria-pressed={selected}
								className={`w-full rounded-xl border px-3 py-2 text-left transition ${
									selected
										? "border-[rgba(68,58,42,0.32)] bg-[rgba(68,58,42,0.08)] shadow-sm"
										: "border-[rgba(120,100,80,0.14)] bg-white/58 hover:border-[rgba(120,100,80,0.28)] hover:bg-white/78"
								}`}
								key={packet.sourceDocumentId}
								onClick={() => setSelectedPacketId(packet.sourceDocumentId)}
								type="button"
							>
								<span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
									Packet #{packet.sourceDocumentId}
								</span>
								<span className="mt-1 block truncate text-sm font-semibold text-foreground">
									{packet.title}
								</span>
								<span className="mt-1 block line-clamp-2 text-xs text-muted-foreground">
									{packet.summary}
								</span>
							</button>
						);
					})}
					{packets.length > 6 ? (
						<p className="px-1 text-xs text-muted-foreground">
							Showing 6 newest capture packets. Resolve a few to clear the
							queue.
						</p>
					) : null}
				</div>
				{selectedPacket ? (
					<CapturePacketRow
						benefitCandidateActingId={benefitCandidateActingId}
						documentCandidateActingId={documentCandidateActingId}
						onApplySplitCandidate={onApplySplitCandidate}
						onConfirmDocumentCandidate={onConfirmDocumentCandidate}
						onCreateParticipantCandidate={onCreateParticipantCandidate}
						onCreateRecurringCandidate={onCreateRecurringCandidate}
						onIgnoreCandidate={onIgnoreCandidate}
						onSavePromoCandidate={onSavePromoCandidate}
						onSplitTargetChange={onSplitTargetChange}
						packet={selectedPacket}
						pendingParticipantCountForSplitCandidate={
							pendingParticipantCountForSplitCandidate
						}
						spaceId={spaceId}
						splitTargetExpenseIdFor={splitTargetExpenseIdFor}
						splitTargetOptions={splitTargetOptions}
					/>
				) : null}
			</div>
			{documentCandidateError ? (
				<p className="mt-3 rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-xs text-destructive">
					{documentCandidateError}
				</p>
			) : null}
		</section>
	);
};

type CapturePacketRowProps = Omit<
	CapturePacketReviewSectionProps,
	"packets" | "decisionCount" | "documentCandidateError"
> & {
	packet: CapturePacket;
};

const CapturePacketRow = ({
	packet,
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
}: CapturePacketRowProps) => {
	const sections = packetSectionDefinitions
		.map((section) => ({
			...section,
			candidates: packet.candidates.filter(
				(candidate) => packetSectionKey(candidate) === section.key,
			),
		}))
		.filter((section) => section.candidates.length > 0);

	return (
		<article className="rounded-2xl border border-[rgba(120,100,80,0.16)] bg-white/72 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
			<div className="flex flex-wrap items-start justify-between gap-3 border-b border-[rgba(120,100,80,0.12)] pb-3">
				<div className="min-w-0">
					<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
						Packet #{packet.sourceDocumentId}
					</p>
					<h3 className="mt-1 truncate text-base font-semibold text-foreground">
						{packet.title}
					</h3>
					<p className="mt-1 text-xs text-muted-foreground">{packet.meta}</p>
				</div>
				<div className="flex max-w-full flex-wrap items-center justify-end gap-1.5">
					<span className="rounded-full border border-[rgba(120,100,80,0.18)] bg-[rgba(255,252,246,0.95)] px-2.5 py-1 text-xs font-semibold text-foreground/75">
						{packet.summary}
					</span>
					<span className="rounded-full border border-[rgba(68,58,42,0.16)] bg-[rgba(68,58,42,0.08)] px-2.5 py-1 text-xs font-semibold text-[#4d4231]">
						{packet.primaryActionLabel}
					</span>
				</div>
			</div>
			<div className="mt-3 space-y-3">
				{sections.map((section) => (
					<section
						className="rounded-xl border border-[rgba(120,100,80,0.12)] bg-[rgba(255,252,246,0.55)] p-3"
						key={section.key}
					>
						<div className="flex flex-wrap items-start justify-between gap-2">
							<div>
								<h4 className="text-sm font-semibold text-foreground">
									{section.title}
								</h4>
								<p className="mt-0.5 text-xs text-muted-foreground">
									{section.description}
								</p>
							</div>
							<span className="rounded-full border border-[rgba(120,100,80,0.16)] bg-white/70 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
								{section.candidates.length}
							</span>
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
									onCreateParticipantCandidate={onCreateParticipantCandidate}
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
				))}
			</div>
		</article>
	);
};

type CaptureCandidateRowProps = Omit<CapturePacketRowProps, "packet"> & {
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

	return (
		<div className="py-2.5 first:pt-0 last:pb-0">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-1.5">
						<span
							className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${candidateBadgeClass(candidate.tone)}`}
						>
							{candidate.label}
						</span>
						<span className="rounded-full border border-border/60 bg-white/80 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
							{candidate.confidenceLabel}
						</span>
					</div>
					<h4 className="mt-1 truncate text-sm font-semibold text-foreground">
						{candidate.title}
					</h4>
					<p className="mt-0.5 text-xs font-medium text-foreground/78">
						{candidate.detail}
					</p>
					{candidate.fields.length > 0 ? (
						<div className="mt-2 flex flex-wrap gap-1.5">
							{candidate.fields.slice(0, 3).map((field) => (
								<span
									className="max-w-full rounded-md border border-[rgba(120,100,80,0.12)] bg-white/72 px-2 py-1 text-[11px] text-muted-foreground"
									key={`${candidate.source}-${candidate.id}-${field.label}`}
								>
									<span className="font-semibold uppercase tracking-wide">
										{field.label}:{" "}
									</span>
									<span className="text-foreground/78">{field.value}</span>
								</span>
							))}
						</div>
					) : null}
				</div>
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
			</div>
			{candidate.isSelfParticipant ? (
				<p className="mt-2 rounded-lg border border-[rgba(83,103,139,0.18)] bg-white/58 px-2.5 py-1.5 text-xs text-[#405574]">
					Already covered by your space member. Mark it reviewed or ignore it.
				</p>
			) : null}
			{candidate.canOpenSplitReview ? (
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
			<p className="mt-2 line-clamp-1 text-xs text-muted-foreground">
				{candidate.meta}
			</p>
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
}: CaptureCandidateActionsProps) => (
	<div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
		{candidate.canSavePromo ? (
			<button
				className="min-h-9 rounded-full border border-[rgba(91,116,87,0.34)] bg-[rgba(237,247,239,0.92)] px-3 text-xs font-semibold text-[#355238] transition hover:border-[rgba(91,116,87,0.5)] hover:bg-[rgba(218,238,222,0.98)] disabled:opacity-50"
				disabled={isActing}
				onClick={() => onSavePromoCandidate(candidate)}
				type="button"
			>
				{isActing ? "Saving" : "Save promo"}
			</button>
		) : null}
		{candidate.canMarkReviewed ? (
			<button
				className="min-h-9 rounded-full border border-[rgba(78,92,72,0.26)] bg-[rgba(246,249,242,0.92)] px-3 text-xs font-semibold text-[#495944] transition hover:border-[rgba(78,92,72,0.42)] hover:bg-[rgba(232,239,225,0.96)] disabled:opacity-50"
				disabled={isActing}
				onClick={() => onConfirmDocumentCandidate(candidate)}
				type="button"
			>
				{isActing ? "Saving" : "Reviewed"}
			</button>
		) : null}
		{candidate.canCreateParticipant ? (
			<button
				className="min-h-9 rounded-full border border-[rgba(83,103,139,0.28)] bg-[rgba(235,241,252,0.86)] px-3 text-xs font-semibold text-[#405574] transition hover:border-[rgba(83,103,139,0.45)] hover:bg-[rgba(222,232,249,0.96)] disabled:opacity-50"
				disabled={isActing}
				onClick={() => onCreateParticipantCandidate(candidate)}
				type="button"
			>
				{isActing ? "Creating" : "Add person"}
			</button>
		) : null}
		{candidate.canCreateRecurring ? (
			<button
				className="min-h-9 rounded-full border border-[rgba(181,131,52,0.32)] bg-[rgba(255,240,208,0.72)] px-3 text-xs font-semibold text-[#73501b] transition hover:border-[rgba(181,131,52,0.48)] hover:bg-[rgba(255,232,188,0.9)] disabled:opacity-50"
				disabled={isActing}
				onClick={() => onCreateRecurringCandidate(candidate)}
				type="button"
			>
				{isActing ? "Creating" : "Create recurring"}
			</button>
		) : null}
		{candidate.canOpenSplitReview ? (
			splitTargetExpenseId != null ? (
				<button
					className="min-h-9 rounded-full border border-[rgba(181,131,52,0.32)] bg-[rgba(255,240,208,0.72)] px-3 text-xs font-semibold text-[#73501b] transition hover:border-[rgba(181,131,52,0.48)] hover:bg-[rgba(255,232,188,0.9)] disabled:opacity-50"
					disabled={isActing || splitApplyBlocked}
					onClick={() => onApplySplitCandidate(candidate, splitTargetExpenseId)}
					type="button"
				>
					{splitApplyBlocked
						? "Add people first"
						: isActing
							? "Applying"
							: "Apply split"}
				</button>
			) : (
				<Link
					className="inline-flex min-h-9 items-center rounded-full border border-[rgba(181,131,52,0.32)] bg-[rgba(255,240,208,0.72)] px-3 text-xs font-semibold text-[#73501b] transition hover:border-[rgba(181,131,52,0.48)] hover:bg-[rgba(255,232,188,0.9)]"
					to={`/console/spaces/${spaceId}/splits`}
				>
					Open splits
				</Link>
			)
		) : null}
		<button
			className="min-h-9 rounded-full border border-border/70 bg-white px-3 text-xs font-semibold text-muted-foreground transition hover:border-destructive/30 hover:text-destructive disabled:opacity-50"
			disabled={isActing}
			onClick={() => onIgnoreCandidate(candidate)}
			type="button"
		>
			{isActing ? "Working" : "Ignore"}
		</button>
	</div>
);
