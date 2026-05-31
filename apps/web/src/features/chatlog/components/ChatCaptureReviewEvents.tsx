import type { BenefitCandidate, DocumentCandidate } from "@cofi/api";
import { ChevronDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../../shared/lib/apiClient";
import {
	type CapturePacketCounts,
	type CapturePacketSummary,
	buildCapturePacketSummaries,
	capturePacketSummaryLine,
} from "../../../shared/lib/capturePacketSummary";
import {
	EntityIcon,
	EntityListItem,
	type EntityViewModel,
} from "../../../shared/lib/entityPresentation";
import {
	type EntityVisualKey,
	capturePacketEntityVisual,
} from "../../../shared/lib/entityVisual";

type ChatCaptureReviewEventsProps = {
	spaceId: string | number;
	spaceName: string | null;
	refreshKey?: string | number | null;
};

type ReviewCandidate = BenefitCandidate | DocumentCandidate;

const activeCandidateStatuses = new Set(["", "draft", "pending", "review"]);

const candidateStatus = (candidate: ReviewCandidate): string =>
	String(candidate.status ?? "")
		.trim()
		.toLowerCase();

const isActiveCandidate = (candidate: ReviewCandidate): boolean => {
	const status = candidateStatus(candidate);
	return activeCandidateStatuses.has(status);
};

const packetTitle = (candidate: ReviewCandidate, sourceDocumentId: number) =>
	candidate.merchant_text?.trim() ||
	candidate.title?.trim() ||
	`Capture #${sourceDocumentId}`;

const packetMeta = (candidate: ReviewCandidate): string =>
	[candidate.input_kind, candidate.document_type, candidate.source_type]
		.map((value) => value?.trim())
		.filter(Boolean)
		.join(" • ") || "Parsed capture";

const packetIconKeys: Array<keyof CapturePacketCounts> = [
	"expenses",
	"benefits",
	"people",
	"splits",
	"future",
	"documents",
];

const aggregatePacketCounts = (
	packets: Array<CapturePacketSummary<ReviewCandidate>>,
): CapturePacketCounts =>
	packets.reduce<CapturePacketCounts>(
		(counts, packet) => {
			for (const key of packetIconKeys) counts[key] += packet.counts[key];
			return counts;
		},
		{
			expenses: 0,
			benefits: 0,
			people: 0,
			splits: 0,
			future: 0,
			documents: 0,
		},
	);

const packetCountLabel = (count: number): string =>
	`${count} ${count === 1 ? "capture" : "captures"}`;

const packetHref = (
	spaceId: string | number,
	sourceDocumentId: number,
): string =>
	`/console/review?spaceId=${encodeURIComponent(String(spaceId))}&sourceDocumentId=${encodeURIComponent(String(sourceDocumentId))}`;

const reviewProcessSteps = (
	totalCandidateCount: number,
): Array<{
	detail: string;
	label: string;
	visualKey: EntityVisualKey;
}> => [
	{
		detail: "Input received",
		label: "Submitted",
		visualKey: "document",
	},
	{
		detail: "Source understood",
		label: "Parsed",
		visualKey: "reviewPacket",
	},
	{
		detail:
			totalCandidateCount > 0
				? `${totalCandidateCount} found`
				: "Grouped for review",
		label: "Candidates",
		visualKey: "benefit",
	},
	{
		detail: "You decide",
		label: "Review",
		visualKey: "expense",
	},
];

const packetEntity = (
	packet: CapturePacketSummary<ReviewCandidate>,
	spaceId: string | number,
): EntityViewModel => ({
	id: String(packet.sourceDocumentId),
	visualKey: "reviewPacket",
	label: "Review packet",
	title: packet.title,
	subtitle: capturePacketSummaryLine(packet.counts),
	detail: packet.meta,
	href: packetHref(spaceId, packet.sourceDocumentId),
	status: "Needs review",
	meta: packetIconKeys
		.map((key) => {
			const count = packet.counts[key];
			if (count <= 0) return null;
			const visual = capturePacketEntityVisual(key);
			return `${count} ${visual.label.toLowerCase()}`;
		})
		.filter((value): value is string => Boolean(value)),
});

export const ChatCaptureReviewEvents = ({
	spaceId,
	spaceName,
	refreshKey,
}: ChatCaptureReviewEventsProps) => {
	const [error, setError] = useState<string | null>(null);
	const [candidates, setCandidates] = useState<ReviewCandidate[]>([]);
	const [detailsOpen, setDetailsOpen] = useState(false);

	useEffect(() => {
		let cancelled = false;
		const numericSpaceId = Number(spaceId);
		if (!Number.isFinite(numericSpaceId) || numericSpaceId <= 0) return;
		setError(null);
		void (async () => {
			try {
				const [benefitRes, documentRes] = await Promise.all([
					apiClient.spaces
						.listBenefitCandidates(numericSpaceId, { limit: 24 })
						.catch(() => null),
					apiClient.spaces
						.listDocumentCandidates(numericSpaceId, { limit: 24 })
						.catch(() => null),
				]);
				if (cancelled) return;
				setCandidates(
					[
						...(benefitRes?.candidates ?? []),
						...(documentRes?.candidates ?? []),
					].filter(isActiveCandidate),
				);
			} catch (err) {
				if (!cancelled) {
					setError(
						err instanceof Error
							? err.message
							: "Failed to load parsed capture review events",
					);
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [spaceId, refreshKey]);

	const packets = useMemo(
		() =>
			buildCapturePacketSummaries(candidates, {
				getSourceDocumentId: (candidate) => candidate.source_document_id,
				getCandidateType: (candidate) => candidate.candidate_type,
				getCreatedAt: (candidate) => candidate.created_at,
				getTitle: packetTitle,
				getMeta: packetMeta,
			}).slice(0, 3),
		[candidates],
	);
	const packetCounts = useMemo(() => aggregatePacketCounts(packets), [packets]);
	const visibleEntityCounts = packetIconKeys
		.map((key) => ({ key, count: packetCounts[key] }))
		.filter((item) => item.count > 0);
	const totalCandidateCount = visibleEntityCounts.reduce(
		(total, item) => total + item.count,
		0,
	);
	const reviewHref = packets[0]
		? packetHref(spaceId, packets[0].sourceDocumentId)
		: `/console/review?spaceId=${encodeURIComponent(String(spaceId))}`;
	const primaryActionLabel =
		packets.length > 1 ? "Review newest" : "Open review";
	const processSteps = reviewProcessSteps(totalCandidateCount);
	const detailsRegionId = `capture-review-details-${String(spaceId)}`;

	if (packets.length === 0 && !error) return null;

	return (
		<section
			aria-label="Parsed capture review events"
			aria-live="polite"
			className="group mx-auto mb-[-1px] w-full max-w-[min(780px,95%)] rounded-t-2xl border border-b-0 border-[rgba(181,131,52,0.22)] bg-[rgba(255,247,229,0.96)] shadow-[0_-10px_26px_-24px_rgba(44,32,18,0.42)] transition focus-within:shadow-[0_-14px_34px_-24px_rgba(44,32,18,0.5)] hover:shadow-[0_-14px_34px_-24px_rgba(44,32,18,0.5)]"
		>
			<div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
				<div className="min-w-0">
					<p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b651f]">
						Needs review
					</p>
					<h3 className="mt-0.5 truncate text-sm font-semibold text-foreground">
						{error && packets.length === 0
							? "Capture review unavailable"
							: `${packetCountLabel(packets.length)} need decisions`}
					</h3>
					<p className="mt-0.5 truncate text-xs text-muted-foreground">
						{totalCandidateCount > 0
							? `Ceits found ${totalCandidateCount} candidates in ${spaceName ?? "this space"}.`
							: `Review before these change ${spaceName ?? "this space"}.`}
					</p>
				</div>
				{visibleEntityCounts.length > 0 ? (
					<div
						aria-label={`${totalCandidateCount} candidates found`}
						className="hidden min-w-0 flex-1 flex-wrap items-center justify-end gap-1.5 md:flex"
					>
						{visibleEntityCounts.slice(0, 5).map(({ key, count }) => {
							const visual = capturePacketEntityVisual(key);
							return (
								<span
									className={[
										"inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2 text-[11px] font-semibold",
										visual.chipClass,
									].join(" ")}
									key={key}
								>
									<EntityIcon size="xs" visualKey={visual.key} />
									<span className="tabular-nums">{count}</span>
									<span>{visual.label}</span>
								</span>
							);
						})}
					</div>
				) : null}
				<div className="flex shrink-0 items-center gap-1.5">
					<button
						aria-controls={detailsRegionId}
						aria-expanded={detailsOpen}
						className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-[rgba(120,100,80,0.18)] bg-white/72 px-3 text-[11px] font-bold text-muted-foreground shadow-sm transition hover:bg-white hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						onClick={() => setDetailsOpen((open) => !open)}
						type="button"
					>
						{detailsOpen ? "Hide" : "Details"}
						<ChevronDown
							aria-hidden
							className={[
								"h-3.5 w-3.5 transition-transform",
								detailsOpen ? "rotate-180" : "",
							].join(" ")}
						/>
					</button>
					<Link
						className="inline-flex min-h-8 items-center rounded-full bg-[rgba(68,58,42,0.92)] px-3 text-[11px] font-bold text-[#fffaf0] shadow-sm transition hover:bg-[rgba(50,43,32,0.96)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						to={reviewHref}
					>
						{primaryActionLabel}
					</Link>
				</div>
			</div>
			<div
				className={[
					"grid overflow-hidden border-t transition-[max-height,opacity,border-color] duration-200",
					detailsOpen
						? "max-h-80 border-[rgba(181,131,52,0.18)] opacity-100"
						: "max-h-0 border-transparent opacity-0",
				].join(" ")}
				id={detailsRegionId}
			>
				<div className="space-y-2 px-3 pb-3 pt-2">
					<ol className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-4">
						{processSteps.map((step, index) => (
							<li
								className="relative flex items-center gap-2 rounded-xl border border-[rgba(172,124,35,0.12)] bg-white/48 px-2 py-1.5"
								key={step.label}
							>
								<EntityIcon size="xs" visualKey={step.visualKey} />
								<span className="min-w-0">
									<span className="block truncate font-bold text-foreground">
										{step.label}
									</span>
									<span className="block truncate text-[11px]">
										{step.detail}
									</span>
								</span>
								<span className="ml-auto hidden text-[10px] font-bold tabular-nums text-[#8b651f] lg:inline">
									{index + 1}
								</span>
							</li>
						))}
					</ol>
					<p className="text-xs leading-5 text-muted-foreground">
						This is system work from captures, not a message from a person. Open
						review to confirm expenses, promos, people, splits, or document
						signals.
					</p>
					{error ? (
						<p className="rounded-lg border border-destructive/25 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
							{error}
						</p>
					) : null}
					{packets.length > 0 ? (
						<div className="space-y-2">
							{packets.map((packet) => (
								<EntityListItem
									entity={packetEntity(packet, spaceId)}
									key={packet.sourceDocumentId}
									trailing={
										<span className="rounded-full border border-[rgba(120,100,80,0.16)] bg-[rgba(255,252,246,0.9)] px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
											Capture #{packet.sourceDocumentId}
										</span>
									}
								/>
							))}
						</div>
					) : null}
				</div>
			</div>
		</section>
	);
};
