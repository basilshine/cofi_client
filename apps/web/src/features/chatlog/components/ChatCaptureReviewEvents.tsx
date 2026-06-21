import type { CapturePacket as ApiCapturePacket } from "@cofi/api";
import { ChevronDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../../shared/lib/apiClient";
import {
	type CapturePacketCounts,
	type CapturePacketSummary,
	capturePacketEntityCountLabel,
	capturePacketSummaryFromApi,
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

const packetIconKeys: Array<keyof CapturePacketCounts> = [
	"expenses",
	"benefits",
	"people",
	"splits",
	"future",
	"documents",
];

const aggregatePacketCounts = (
	packets: Array<CapturePacketSummary<unknown>>,
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

const capturePacketRecordCount = (packet: ApiCapturePacket): number => {
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

const packetHref = (
	spaceId: string | number,
	sourceDocumentId: number,
): string =>
	`/console/review?spaceId=${encodeURIComponent(String(spaceId))}&sourceDocumentId=${encodeURIComponent(String(sourceDocumentId))}`;

const reviewProcessSteps = (
	totalCandidateCount: number,
	isSaved: boolean,
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
		label: "Extracted",
		visualKey: "reviewPacket",
	},
	{
		detail:
			totalCandidateCount > 0
				? `${totalCandidateCount} found`
				: "Grouped for review",
		label: "Findings",
		visualKey: "benefit",
	},
	{
		detail: isSaved ? "Records created" : "You decide",
		label: isSaved ? "Saved" : "Review",
		visualKey: "expense",
	},
];

const packetEntity = (
	packet: CapturePacketSummary<unknown>,
	spaceId: string | number,
	options?: { hasCreatedRecords?: boolean },
): EntityViewModel => ({
	id: String(packet.sourceDocumentId),
	visualKey: "reviewPacket",
	label: "Capture",
	title: packet.title,
	subtitle: capturePacketSummaryLine(packet.counts),
	detail: packet.meta,
	href: packetHref(spaceId, packet.sourceDocumentId),
	status: options?.hasCreatedRecords ? "Records created" : "Needs review",
	meta: packetIconKeys
		.map((key) => {
			const count = packet.counts[key];
			return capturePacketEntityCountLabel(key, count);
		})
		.filter((value): value is string => Boolean(value)),
});

export const ChatCaptureReviewEvents = ({
	spaceId,
	spaceName,
	refreshKey,
}: ChatCaptureReviewEventsProps) => {
	const [error, setError] = useState<string | null>(null);
	const [capturePackets, setCapturePackets] = useState<ApiCapturePacket[]>([]);
	const [detailsOpen, setDetailsOpen] = useState(false);

	useEffect(() => {
		let cancelled = false;
		const numericSpaceId = Number(spaceId);
		if (!Number.isFinite(numericSpaceId) || numericSpaceId <= 0) return;
		setError(null);
		void (async () => {
			try {
				const response = await apiClient.spaces.listCapturePackets(
					numericSpaceId,
					{ includeRecords: true, limit: 24 },
				);
				if (cancelled) return;
				setCapturePackets(
					(response.captures ?? []).filter(
						(packet) =>
							Number(packet.pending_count ?? 0) > 0 ||
							capturePacketRecordCount(packet) > 0,
					),
				);
			} catch (err) {
				if (!cancelled) {
					setError(
						err instanceof Error
							? err.message
							: "Failed to load capture review events",
					);
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [spaceId, refreshKey]);

	const packets = useMemo(
		() => capturePackets.map(capturePacketSummaryFromApi).slice(0, 3),
		[capturePackets],
	);
	const createdRecordPacketIds = useMemo(
		() =>
			new Set(
				capturePackets
					.filter((packet) => capturePacketRecordCount(packet) > 0)
					.map((packet) => Number(packet.source_document_id)),
			),
		[capturePackets],
	);
	const pendingCaptureCount = useMemo(
		() =>
			capturePackets.filter((packet) => Number(packet.pending_count ?? 0) > 0)
				.length,
		[capturePackets],
	);
	const createdRecordCaptureCount = useMemo(
		() =>
			capturePackets.filter(
				(packet) =>
					Number(packet.pending_count ?? 0) <= 0 &&
					capturePacketRecordCount(packet) > 0,
			).length,
		[capturePackets],
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
		pendingCaptureCount > 0
			? packets.length > 1
				? "Review newest capture"
				: "Review capture"
			: packets.length > 1
				? "Open newest capture"
				: "Open capture";
	const hasPendingCaptures = pendingCaptureCount > 0;
	const hasOnlySavedCaptures =
		!hasPendingCaptures && createdRecordCaptureCount > 0;
	const processSteps = reviewProcessSteps(
		totalCandidateCount,
		hasOnlySavedCaptures,
	);
	const detailsRegionId = `capture-review-details-${String(spaceId)}`;

	if (packets.length === 0 && !error) return null;

	return (
		<section
			aria-label="Extracted capture review events"
			aria-live="polite"
			className="group mx-auto mb-[-1px] w-full max-w-[min(780px,95%)] rounded-t-2xl border border-b-0 border-[rgba(181,131,52,0.22)] bg-[rgba(255,247,229,0.96)] shadow-[0_-10px_26px_-24px_rgba(44,32,18,0.42)] transition focus-within:shadow-[0_-14px_34px_-24px_rgba(44,32,18,0.5)] hover:shadow-[0_-14px_34px_-24px_rgba(44,32,18,0.5)]"
		>
			<div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
				<div className="min-w-0">
					<p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b651f]">
						{hasOnlySavedCaptures ? "Capture records" : "Capture review"}
					</p>
					<h3 className="mt-0.5 truncate text-sm font-semibold text-foreground">
						{error && packets.length === 0
							? "Capture review unavailable"
							: pendingCaptureCount > 0
								? `${packetCountLabel(pendingCaptureCount)} need review`
								: `${packetCountLabel(createdRecordCaptureCount)} created records`}
					</h3>
					<p className="mt-0.5 truncate text-xs text-muted-foreground">
						{pendingCaptureCount > 0 && totalCandidateCount > 0
							? `Ceits found ${totalCandidateCount} candidates in ${spaceName ?? "this space"}.`
							: createdRecordCaptureCount > 0
								? `Ceits saved records from captures in ${spaceName ?? "this space"}.`
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
						{detailsOpen ? "Hide" : "Process"}
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
						? "max-h-96 border-[rgba(181,131,52,0.18)] opacity-100"
						: "max-h-0 border-transparent opacity-0",
				].join(" ")}
				id={detailsRegionId}
			>
				<div className="max-h-96 space-y-2 overflow-y-auto px-3 pb-3 pt-2">
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
						{hasOnlySavedCaptures
							? "This is system work from captures, not a message from a person. Open the source capture to inspect provenance and saved records."
							: "This is system work from captures, not a message from a person. Open review to confirm expenses, promos, people, splits, or document signals."}
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
									entity={packetEntity(packet, spaceId, {
										hasCreatedRecords: createdRecordPacketIds.has(
											packet.sourceDocumentId,
										),
									})}
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
