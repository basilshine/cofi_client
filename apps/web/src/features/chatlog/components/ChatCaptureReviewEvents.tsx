import type { BenefitCandidate, DocumentCandidate } from "@cofi/api";
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
	EntityListItem,
	type EntityViewModel,
} from "../../../shared/lib/entityPresentation";
import { capturePacketEntityVisual } from "../../../shared/lib/entityVisual";

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

const packetHref = (
	spaceId: string | number,
	sourceDocumentId: number,
): string =>
	`/console/review?spaceId=${encodeURIComponent(String(spaceId))}&sourceDocumentId=${encodeURIComponent(String(sourceDocumentId))}`;

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
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [candidates, setCandidates] = useState<ReviewCandidate[]>([]);

	useEffect(() => {
		let cancelled = false;
		const numericSpaceId = Number(spaceId);
		if (!Number.isFinite(numericSpaceId) || numericSpaceId <= 0) return;
		setLoading(true);
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
			} finally {
				if (!cancelled) setLoading(false);
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

	if (packets.length === 0 && !loading && !error) return null;

	return (
		<section
			aria-label="Parsed capture review events"
			className="mx-auto w-full max-w-[min(780px,95%)] rounded-2xl border border-[rgba(120,100,80,0.16)] bg-[rgba(255,252,246,0.92)] px-3 py-3 shadow-sm"
		>
			<div className="flex flex-wrap items-start justify-between gap-2">
				<div className="min-w-0">
					<p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
						Capture review
					</p>
					<h3 className="mt-0.5 text-sm font-semibold text-foreground">
						Parsed captures waiting in {spaceName ?? "this space"}
					</h3>
					<p className="mt-0.5 text-xs leading-5 text-muted-foreground">
						Ceits found structured candidates. Open Review to decide what
						becomes expenses, promos, people, splits, or document signals.
					</p>
				</div>
				<Link
					className="inline-flex min-h-8 shrink-0 items-center rounded-full bg-[rgba(68,58,42,0.92)] px-3 text-[11px] font-bold text-[#fffaf0] shadow-sm transition hover:bg-[rgba(50,43,32,0.96)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					to={`/console/review?spaceId=${encodeURIComponent(String(spaceId))}`}
				>
					Open review
				</Link>
			</div>
			{error ? (
				<p className="mt-2 rounded-lg border border-destructive/25 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
					{error}
				</p>
			) : null}
			{loading && packets.length === 0 ? (
				<p className="mt-2 text-xs text-muted-foreground">
					Checking parsed captures...
				</p>
			) : null}
			{packets.length > 0 ? (
				<div className="mt-3 space-y-2">
					{packets.map((packet) => (
						<EntityListItem
							entity={packetEntity(packet, spaceId)}
							key={packet.sourceDocumentId}
							trailing={
								<span className="rounded-full border border-[rgba(120,100,80,0.16)] bg-[rgba(255,252,246,0.9)] px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
									Packet #{packet.sourceDocumentId}
								</span>
							}
						/>
					))}
				</div>
			) : null}
		</section>
	);
};
