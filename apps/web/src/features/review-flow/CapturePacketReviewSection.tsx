import type { LucideIcon } from "lucide-react";
import { FileText, Inbox, Plus, ReceiptText, Split } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
	EntityIcon,
	EntityListItem,
	EntityMicro,
	type EntityViewModel,
} from "../../shared/lib/entityPresentation";
import {
	captureCandidateTypeVisual,
	capturePacketEntityVisual,
} from "../../shared/lib/entityVisual";
import type {
	CandidateReviewItem,
	CapturePacket,
	SplitTargetOption,
} from "./reviewPacketTypes";

type CapturePacketReviewSectionProps = {
	packets: CapturePacket[];
	decisionCount: number;
	spaceId: number;
	focusedSourceDocumentId?: number | null;
	focusedSectionKey?: PacketSectionFilterKey | null;
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

type PacketSectionKey =
	| "expenses"
	| "benefits"
	| "people"
	| "splits"
	| "future"
	| "documents";
type PacketSectionFilterKey = PacketSectionKey | "all";

const packetSectionDefinitions: Array<{
	key: PacketSectionKey;
	title: string;
	description: string;
	shortTitle: string;
	addLabel: string;
}> = [
	{
		key: "expenses",
		title: "Expense draft",
		shortTitle: "Expenses",
		description: "Amounts, items, merchant, category, and draft expense data.",
		addLabel: "Add expense",
	},
	{
		key: "benefits",
		title: "Benefits",
		shortTitle: "Benefits",
		description: "Promos and loyalty findings that can be saved separately.",
		addLabel: "Add promo",
	},
	{
		key: "people",
		title: "People",
		shortTitle: "People",
		description: "Participants and placeholders detected from this capture.",
		addLabel: "Add person",
	},
	{
		key: "splits",
		title: "Splits",
		shortTitle: "Splits",
		description: "Split proposals that need people and target expense context.",
		addLabel: "Add split",
	},
	{
		key: "future",
		title: "Future actions",
		shortTitle: "Future",
		description: "Recurring, membership, reminder, and renewal hints.",
		addLabel: "Add recurring",
	},
	{
		key: "documents",
		title: "Document signals",
		shortTitle: "Documents",
		description:
			"Payment proof, privacy, merge, and supporting document signals.",
		addLabel: "Add document",
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

const actionableCount = (candidates: CandidateReviewItem[]): number =>
	candidates.filter(
		(candidate) =>
			candidate.canSavePromo ||
			candidate.canCreateParticipant ||
			candidate.canOpenSplitReview ||
			candidate.canCreateRecurring ||
			candidate.canMarkReviewed,
	).length;

const sectionCount = (
	candidates: CandidateReviewItem[],
	sectionKey: PacketSectionKey,
): number =>
	candidates.filter((candidate) => packetSectionKey(candidate) === sectionKey)
		.length;

const packetEntity = (
	packet: CapturePacket,
	selected: boolean,
	selectedSectionKey: PacketSectionFilterKey,
): EntityViewModel => {
	const scopedSections = packetSectionDefinitions
		.filter(
			(section) =>
				selectedSectionKey === "all" || selectedSectionKey === section.key,
		)
		.map((section) => ({
			label: section.shortTitle,
			count: sectionCount(packet.candidates, section.key),
		}))
		.filter((section) => section.count > 0);

	return {
		id: String(packet.sourceDocumentId),
		visualKey: "reviewPacket",
		label: "Review packet",
		title: packet.title,
		subtitle: `Packet #${packet.sourceDocumentId} - ${packet.meta}`,
		detail: packet.summary,
		meta: scopedSections.map((section) => `${section.label} ${section.count}`),
		status: packet.primaryActionLabel,
		selected,
	};
};

const addHrefForSection = (
	sectionKey: PacketSectionKey,
	spaceId: number,
	sourceDocumentId: number,
): string => {
	const encodedSpaceId = encodeURIComponent(String(spaceId));
	if (sectionKey === "expenses") {
		return `/console/chat/expenses?spaceId=${encodedSpaceId}`;
	}
	if (sectionKey === "benefits") {
		return `/console/spaces/${encodedSpaceId}/benefits`;
	}
	if (sectionKey === "people") {
		return `/console/spaces/${encodedSpaceId}/settings#space-settings-members`;
	}
	if (sectionKey === "splits") {
		return `/console/spaces/${encodedSpaceId}/splits`;
	}
	if (sectionKey === "future") {
		return `/console/spaces/${encodedSpaceId}/recurring`;
	}
	return `/console/review?spaceId=${encodedSpaceId}&sourceDocumentId=${encodeURIComponent(String(sourceDocumentId))}&section=documents`;
};

export const CapturePacketReviewSection = ({
	packets,
	decisionCount,
	spaceId,
	focusedSourceDocumentId,
	focusedSectionKey,
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
	const [selectedSectionKey, setSelectedSectionKey] =
		useState<PacketSectionFilterKey>(focusedSectionKey ?? "all");
	const entityCounts = useMemo(() => {
		const counts: Record<PacketSectionKey, number> = {
			expenses: 0,
			benefits: 0,
			people: 0,
			splits: 0,
			future: 0,
			documents: 0,
		};
		for (const packet of packets) {
			for (const candidate of packet.candidates) {
				counts[packetSectionKey(candidate)] += 1;
			}
		}
		return counts;
	}, [packets]);
	const filteredPackets = useMemo(() => {
		if (selectedSectionKey === "all") return packets;
		return packets.filter((packet) =>
			packet.candidates.some(
				(candidate) => packetSectionKey(candidate) === selectedSectionKey,
			),
		);
	}, [packets, selectedSectionKey]);
	const visiblePackets = useMemo(() => {
		const newest = filteredPackets.slice(0, 6);
		if (
			focusedSourceDocumentId == null ||
			newest.some(
				(packet) => packet.sourceDocumentId === focusedSourceDocumentId,
			)
		) {
			return newest;
		}
		const focused = filteredPackets.find(
			(packet) => packet.sourceDocumentId === focusedSourceDocumentId,
		);
		if (!focused) return newest;
		return [focused, ...newest.slice(0, 5)];
	}, [filteredPackets, focusedSourceDocumentId]);
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
		setSelectedPacketId(defaultPacketId);
	}, [visiblePackets, selectedPacketId, defaultPacketId]);

	useEffect(() => {
		if (focusedSectionKey == null) return;
		setSelectedSectionKey(focusedSectionKey);
	}, [focusedSectionKey]);

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
			<div className="mt-4 grid gap-2 rounded-2xl border border-[rgba(120,100,80,0.12)] bg-white/54 p-2 sm:grid-cols-2 xl:grid-cols-4">
				<button
					aria-pressed={selectedSectionKey === "all"}
					className={`min-h-[4.75rem] rounded-xl border px-3 py-2 text-left transition-[background-color,border-color,box-shadow,transform] active:scale-[0.99] ${
						selectedSectionKey === "all"
							? "border-[rgba(68,58,42,0.28)] bg-[rgba(68,58,42,0.92)] text-[#fffaf0] shadow-sm"
							: "border-[rgba(120,100,80,0.1)] bg-white/68 text-foreground hover:border-[rgba(120,100,80,0.22)] hover:bg-white"
					}`}
					onClick={() => setSelectedSectionKey("all")}
					type="button"
				>
					<span className="flex items-center gap-2">
						<span
							className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
								selectedSectionKey === "all"
									? "bg-white/16 text-[#fffaf0]"
									: "bg-[rgba(248,245,238,0.92)] text-muted-foreground"
							}`}
						>
							<Inbox className="h-4 w-4" size={16} />
						</span>
						<span className="min-w-0">
							<span className="block text-xs font-bold">All review</span>
							<span
								className={`mt-0.5 block text-[11px] font-semibold ${
									selectedSectionKey === "all"
										? "text-[#fffaf0]/72"
										: "text-muted-foreground"
								}`}
							>
								{decisionCount} decisions
							</span>
						</span>
					</span>
				</button>
				{packetSectionDefinitions.map((section) => {
					const count = entityCounts[section.key];
					const selected = selectedSectionKey === section.key;
					const visual = capturePacketEntityVisual(section.key);
					const Icon = visual.icon;
					return (
						<button
							aria-pressed={selected}
							className={`min-h-[4.75rem] rounded-xl border px-3 py-2 text-left transition-[background-color,border-color,box-shadow,transform] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 ${
								selected
									? "border-[rgba(68,58,42,0.28)] bg-[rgba(68,58,42,0.92)] text-[#fffaf0] shadow-sm"
									: "border-[rgba(120,100,80,0.1)] bg-white/68 text-foreground hover:border-[rgba(120,100,80,0.22)] hover:bg-white"
							}`}
							disabled={count === 0}
							key={section.key}
							onClick={() => setSelectedSectionKey(section.key)}
							type="button"
						>
							<span className="flex items-center gap-2">
								<span
									className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
										selected
											? "border-white/16 bg-white/14 text-[#fffaf0]"
											: visual.toneClass
									}`}
								>
									<Icon className="h-4 w-4" size={16} />
								</span>
								<span className="min-w-0">
									<span className="block truncate text-xs font-bold">
										{section.shortTitle}
									</span>
									<span
										className={`mt-0.5 block text-[11px] font-semibold ${
											selected ? "text-[#fffaf0]/72" : "text-muted-foreground"
										}`}
									>
										{count === 0
											? "No candidates"
											: `${count} ${count === 1 ? "candidate" : "candidates"}`}
									</span>
								</span>
							</span>
						</button>
					);
				})}
			</div>
			<div className="mt-4 grid gap-3 lg:grid-cols-[minmax(220px,0.36fr)_1fr]">
				<div className="space-y-2">
					<p className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
						{selectedSectionKey === "all"
							? "Packet queue"
							: `${packetSectionDefinitions.find((section) => section.key === selectedSectionKey)?.shortTitle ?? "Entity"} queue`}
					</p>
					{visiblePackets.length > 0 ? (
						visiblePackets.map((packet) => {
							const selected =
								selectedPacket?.sourceDocumentId === packet.sourceDocumentId;
							return (
								<button
									aria-pressed={selected}
									className="block w-full rounded-2xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
									key={packet.sourceDocumentId}
									onClick={() => setSelectedPacketId(packet.sourceDocumentId)}
									type="button"
								>
									<EntityListItem
										entity={packetEntity(packet, selected, selectedSectionKey)}
									/>
								</button>
							);
						})
					) : (
						<p className="rounded-xl border border-[rgba(120,100,80,0.12)] bg-white/58 px-3 py-3 text-xs text-muted-foreground">
							No capture packets have this entity type yet.
						</p>
					)}
					{filteredPackets.length > 6 ? (
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
						sectionFilter={selectedSectionKey}
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
	sectionFilter: PacketSectionFilterKey;
};

const CapturePacketRow = ({
	packet,
	sectionFilter,
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
	const scopedCandidates =
		sectionFilter === "all"
			? packet.candidates
			: packet.candidates.filter(
					(candidate) => packetSectionKey(candidate) === sectionFilter,
				);
	const sections = packetSectionDefinitions
		.filter(
			(section) => sectionFilter === "all" || section.key === sectionFilter,
		)
		.map((section) => ({
			...section,
			candidates: scopedCandidates.filter(
				(candidate) => packetSectionKey(candidate) === section.key,
			),
		}));
	const actionCount = actionableCount(scopedCandidates);

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
						{sectionFilter === "all"
							? packet.summary
							: `${sections[0]?.title ?? "Entity"} only`}
					</span>
					<span className="rounded-full border border-[rgba(68,58,42,0.16)] bg-[rgba(68,58,42,0.08)] px-2.5 py-1 text-xs font-semibold text-[#4d4231]">
						{packet.primaryActionLabel}
					</span>
				</div>
			</div>
			<PacketWorkspaceMap
				actionCount={actionCount}
				packet={packet}
				sectionFilter={sectionFilter}
			/>
			<PacketActionBar
				benefitCandidateActingId={benefitCandidateActingId}
				documentCandidateActingId={documentCandidateActingId}
				onApplySplitCandidate={onApplySplitCandidate}
				onConfirmDocumentCandidate={onConfirmDocumentCandidate}
				onCreateParticipantCandidate={onCreateParticipantCandidate}
				onCreateRecurringCandidate={onCreateRecurringCandidate}
				onSavePromoCandidate={onSavePromoCandidate}
				candidates={scopedCandidates}
				pendingParticipantCountForSplitCandidate={
					pendingParticipantCountForSplitCandidate
				}
				splitTargetExpenseIdFor={splitTargetExpenseIdFor}
			/>
			<div className="mt-3 space-y-3">
				{sections.map((section) => (
					<section
						className="rounded-xl border border-[rgba(120,100,80,0.12)] bg-[rgba(255,252,246,0.55)] p-3"
						key={section.key}
					>
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
							<span className="rounded-full border border-[rgba(120,100,80,0.16)] bg-white/70 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
								{section.candidates.length > 0
									? section.candidates.length
									: "Not found"}
							</span>
						</div>
						{section.candidates.length > 0 ? (
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
						) : (
							<MissingPacketSection
								addHref={addHrefForSection(
									section.key,
									spaceId,
									packet.sourceDocumentId,
								)}
								addLabel={section.addLabel}
								description={`No ${section.shortTitle.toLowerCase()} candidate came from this parse.`}
							/>
						)}
					</section>
				))}
			</div>
			{actionCount === 0 ? (
				<p className="mt-3 rounded-xl border border-[rgba(120,100,80,0.12)] bg-white/58 px-3 py-2 text-xs text-muted-foreground">
					No direct action is available for this packet yet. Review the signals
					below or ignore individual items.
				</p>
			) : null}
		</article>
	);
};

type MissingPacketSectionProps = {
	description: string;
	addLabel: string;
	addHref: string;
};

const MissingPacketSection = ({
	description,
	addLabel,
	addHref,
}: MissingPacketSectionProps) => (
	<div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-[rgba(120,100,80,0.18)] bg-white/46 px-3 py-2">
		<p className="max-w-md text-xs text-muted-foreground">{description}</p>
		<Link
			className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-[rgba(120,100,80,0.16)] bg-white/78 px-3 text-[11px] font-bold text-foreground/78 transition hover:border-[rgba(120,100,80,0.28)] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			to={addHref}
		>
			<Plus className="h-3.5 w-3.5" size={14} />
			{addLabel}
		</Link>
	</div>
);

type PacketWorkspaceMapProps = {
	packet: CapturePacket;
	sectionFilter: PacketSectionFilterKey;
	actionCount: number;
};

const PacketWorkspaceMap = ({
	packet,
	sectionFilter,
	actionCount,
}: PacketWorkspaceMapProps) => {
	const visibleSectionDefinitions = packetSectionDefinitions.filter(
		(section) =>
			packet.counts[section.key] > 0 ||
			(sectionFilter !== "all" && sectionFilter === section.key),
	);
	const reviewScope =
		sectionFilter === "all"
			? "All entities"
			: (packetSectionDefinitions.find(
					(section) => section.key === sectionFilter,
				)?.title ?? "Selected entity");

	return (
		<div className="mt-3 border-b border-[rgba(120,100,80,0.12)] pb-3">
			<div className="grid gap-2 md:grid-cols-4">
				<PacketWorkspaceStep
					detail={packet.meta}
					icon={Inbox}
					label="Source saved"
					title="Capture"
				/>
				<PacketWorkspaceStep
					detail={packet.summary}
					icon={ReceiptText}
					label={`${packet.candidates.length} found`}
					title="Structure"
				/>
				<PacketWorkspaceStep
					detail={reviewScope}
					icon={Split}
					label={actionCount > 0 ? `${actionCount} actions` : "Read only"}
					title="Review"
				/>
				<PacketWorkspaceStep
					detail="Confirm, save, apply, or ignore"
					icon={FileText}
					label="Pending"
					title="Save"
				/>
			</div>
			{visibleSectionDefinitions.length > 0 ? (
				<div className="mt-3">
					<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
						What Ceits found in this packet
					</p>
					<div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
						{visibleSectionDefinitions.map((section) => {
							const count = packet.counts[section.key];
							const selected =
								sectionFilter === "all" || sectionFilter === section.key;
							const visual = capturePacketEntityVisual(section.key);
							return (
								<div
									className={`flex min-h-14 items-center gap-2 rounded-xl border px-3 py-2 ${
										selected
											? visual.toneClass
											: "border-[rgba(120,100,80,0.1)] bg-white/54 text-muted-foreground"
									}`}
									key={section.key}
								>
									<EntityIcon size="sm" visualKey={visual.key} />
									<span className="min-w-0">
										<span className="block truncate text-xs font-bold">
											{section.shortTitle}
										</span>
										<span className="mt-0.5 block text-[11px] font-semibold opacity-75">
											{count === 0
												? "Can be added manually"
												: `${count} ${count === 1 ? "candidate" : "candidates"}`}
										</span>
									</span>
								</div>
							);
						})}
					</div>
				</div>
			) : null}
		</div>
	);
};

type PacketWorkspaceStepProps = {
	title: string;
	label: string;
	detail: string;
	icon: LucideIcon;
};

const PacketWorkspaceStep = ({
	title,
	label,
	detail,
	icon: Icon,
}: PacketWorkspaceStepProps) => (
	<div className="min-w-0 rounded-xl border border-[rgba(120,100,80,0.12)] bg-[rgba(255,252,246,0.58)] px-3 py-2">
		<div className="flex items-start gap-2">
			<span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/75 text-[#5f5442] shadow-[inset_0_0_0_1px_rgba(87,70,49,0.08)]">
				<Icon className="h-4 w-4" size={16} />
			</span>
			<span className="min-w-0">
				<span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
					{title}
				</span>
				<span className="mt-0.5 block truncate text-xs font-bold text-foreground">
					{label}
				</span>
				<span className="mt-0.5 block line-clamp-2 text-[11px] leading-4 text-muted-foreground">
					{detail}
				</span>
			</span>
		</div>
	</div>
);

type PacketActionBarProps = {
	candidates: CandidateReviewItem[];
	benefitCandidateActingId: number | null;
	documentCandidateActingId: number | null;
	splitTargetExpenseIdFor: (candidate: CandidateReviewItem) => number | null;
	pendingParticipantCountForSplitCandidate: (
		candidate: CandidateReviewItem,
	) => number;
	onSavePromoCandidate: (candidate: CandidateReviewItem) => void;
	onConfirmDocumentCandidate: (candidate: CandidateReviewItem) => void;
	onCreateParticipantCandidate: (candidate: CandidateReviewItem) => void;
	onCreateRecurringCandidate: (candidate: CandidateReviewItem) => void;
	onApplySplitCandidate: (
		candidate: CandidateReviewItem,
		targetExpenseId: number | null,
	) => void;
};

const PacketActionBar = ({
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
	const promoCandidate = candidates.find((candidate) => candidate.canSavePromo);
	const participantCandidate = candidates.find(
		(candidate) => candidate.canCreateParticipant,
	);
	const recurringCandidate = candidates.find(
		(candidate) => candidate.canCreateRecurring,
	);
	const reviewCandidate = candidates.find(
		(candidate) => candidate.canMarkReviewed,
	);
	const splitCandidate = candidates.find(
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

	if (!hasActions) return null;

	return (
		<div className="mt-3 rounded-xl border border-[rgba(68,58,42,0.14)] bg-[rgba(68,58,42,0.055)] px-3 py-2">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div>
					<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
						Next actions
					</p>
					<p className="mt-0.5 text-xs text-muted-foreground">
						Start with the highest-signal decisions, then finish details inside
						sections.
					</p>
				</div>
				<div className="flex flex-wrap items-center justify-end gap-1.5">
					{promoCandidate ? (
						<button
							className="min-h-9 rounded-full border border-[rgba(91,116,87,0.34)] bg-[rgba(237,247,239,0.96)] px-3 text-xs font-semibold text-[#355238] transition hover:border-[rgba(91,116,87,0.5)] hover:bg-[rgba(218,238,222,0.98)] disabled:opacity-50"
							disabled={isBenefitActing(promoCandidate)}
							onClick={() => onSavePromoCandidate(promoCandidate)}
							type="button"
						>
							{isBenefitActing(promoCandidate) ? "Saving" : "Save promo"}
						</button>
					) : null}
					{participantCandidate ? (
						<button
							className="min-h-9 rounded-full border border-[rgba(83,103,139,0.28)] bg-[rgba(235,241,252,0.9)] px-3 text-xs font-semibold text-[#405574] transition hover:border-[rgba(83,103,139,0.45)] hover:bg-[rgba(222,232,249,0.96)] disabled:opacity-50"
							disabled={isDocumentActing(participantCandidate)}
							onClick={() => onCreateParticipantCandidate(participantCandidate)}
							type="button"
						>
							{isDocumentActing(participantCandidate)
								? "Creating"
								: "Add person"}
						</button>
					) : null}
					{splitCandidate ? (
						<button
							className="min-h-9 rounded-full border border-[rgba(181,131,52,0.32)] bg-[rgba(255,240,208,0.82)] px-3 text-xs font-semibold text-[#73501b] transition hover:border-[rgba(181,131,52,0.48)] hover:bg-[rgba(255,232,188,0.94)] disabled:opacity-50"
							disabled={
								splitBlocked ||
								splitTargetExpenseId == null ||
								isDocumentActing(splitCandidate)
							}
							onClick={() =>
								onApplySplitCandidate(splitCandidate, splitTargetExpenseId)
							}
							type="button"
						>
							{splitBlocked
								? "Add people first"
								: isDocumentActing(splitCandidate)
									? "Applying"
									: "Apply split"}
						</button>
					) : null}
					{recurringCandidate ? (
						<button
							className="min-h-9 rounded-full border border-[rgba(181,131,52,0.32)] bg-[rgba(255,240,208,0.82)] px-3 text-xs font-semibold text-[#73501b] transition hover:border-[rgba(181,131,52,0.48)] hover:bg-[rgba(255,232,188,0.94)] disabled:opacity-50"
							disabled={isDocumentActing(recurringCandidate)}
							onClick={() => onCreateRecurringCandidate(recurringCandidate)}
							type="button"
						>
							{isDocumentActing(recurringCandidate)
								? "Creating"
								: "Create recurring"}
						</button>
					) : null}
					{reviewCandidate ? (
						<button
							className="min-h-9 rounded-full border border-[rgba(78,92,72,0.26)] bg-white/88 px-3 text-xs font-semibold text-[#495944] transition hover:border-[rgba(78,92,72,0.42)] hover:bg-[rgba(232,239,225,0.96)] disabled:opacity-50"
							disabled={isDocumentActing(reviewCandidate)}
							onClick={() => onConfirmDocumentCandidate(reviewCandidate)}
							type="button"
						>
							{isDocumentActing(reviewCandidate) ? "Saving" : "Mark reviewed"}
						</button>
					) : null}
				</div>
			</div>
		</div>
	);
};

type CaptureCandidateRowProps = Omit<
	CapturePacketRowProps,
	"packet" | "sectionFilter"
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

	return (
		<div className="py-2.5 first:pt-0 last:pb-0">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-1.5">
						<EntityMicro
							entity={{
								label: candidate.label,
								visualKey: captureCandidateTypeVisual(candidate.candidateType)
									.key,
							}}
						/>
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
