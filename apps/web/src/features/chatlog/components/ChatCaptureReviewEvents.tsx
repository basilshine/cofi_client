import type { BenefitCandidate, DocumentCandidate } from "@cofi/api";
import {
	FileText,
	Gift,
	ReceiptText,
	Repeat,
	Split,
	UsersRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../../shared/lib/apiClient";

type ChatCaptureReviewEventsProps = {
	spaceId: string | number;
	spaceName: string | null;
	refreshKey?: string | number | null;
};

type ReviewCandidate = BenefitCandidate | DocumentCandidate;

type PacketSummary = {
	sourceDocumentId: number;
	title: string;
	meta: string;
	createdAt: string;
	counts: {
		expenses: number;
		benefits: number;
		people: number;
		splits: number;
		future: number;
		documents: number;
	};
};

const activeCandidateStatuses = new Set(["", "draft", "pending", "review"]);

const candidateStatus = (candidate: ReviewCandidate): string =>
	String(candidate.status ?? "")
		.trim()
		.toLowerCase();

const isActiveCandidate = (candidate: ReviewCandidate): boolean => {
	const status = candidateStatus(candidate);
	return activeCandidateStatuses.has(status);
};

const candidateGroup = (
	candidateType: string,
): keyof PacketSummary["counts"] => {
	if (
		candidateType === "expense_candidate" ||
		candidateType === "expense_item_candidate"
	) {
		return "expenses";
	}
	if (
		candidateType === "promo_code_candidate" ||
		candidateType === "loyalty_event_candidate"
	) {
		return "benefits";
	}
	if (candidateType === "participant_placeholder_candidate") return "people";
	if (candidateType === "split_candidate") return "splits";
	if (
		candidateType === "recurring_candidate" ||
		candidateType === "membership_candidate" ||
		candidateType === "reminder_candidate"
	) {
		return "future";
	}
	return "documents";
};

const countLabel = (
	count: number,
	singular: string,
	plural = `${singular}s`,
): string | null => {
	if (count <= 0) return null;
	return `${count} ${count === 1 ? singular : plural}`;
};

const packetLine = (counts: PacketSummary["counts"]): string =>
	[
		countLabel(counts.expenses, "expense"),
		countLabel(counts.benefits, "benefit"),
		countLabel(counts.people, "person", "people"),
		countLabel(counts.splits, "split"),
		countLabel(counts.future, "future hint"),
		countLabel(counts.documents, "document signal"),
	]
		.filter((value): value is string => Boolean(value))
		.join(", ") || "Capture packet";

const packetTitle = (candidate: ReviewCandidate, sourceDocumentId: number) =>
	candidate.merchant_text?.trim() ||
	candidate.title?.trim() ||
	`Capture #${sourceDocumentId}`;

const packetMeta = (candidate: ReviewCandidate): string =>
	[candidate.input_kind, candidate.document_type, candidate.source_type]
		.map((value) => value?.trim())
		.filter(Boolean)
		.join(" • ") || "Parsed capture";

const buildPackets = (candidates: ReviewCandidate[]): PacketSummary[] => {
	const bySource = new Map<number, ReviewCandidate[]>();
	for (const candidate of candidates) {
		const sourceDocumentId = Number(candidate.source_document_id);
		if (!Number.isFinite(sourceDocumentId) || sourceDocumentId <= 0) continue;
		const list = bySource.get(sourceDocumentId) ?? [];
		list.push(candidate);
		bySource.set(sourceDocumentId, list);
	}

	return Array.from(bySource.entries())
		.map(([sourceDocumentId, packetCandidates]) => {
			const sorted = [...packetCandidates].sort((a, b) => {
				const left = Date.parse(a.created_at ?? "");
				const right = Date.parse(b.created_at ?? "");
				if (!Number.isFinite(left) && !Number.isFinite(right)) return 0;
				if (!Number.isFinite(left)) return 1;
				if (!Number.isFinite(right)) return -1;
				return right - left;
			});
			const first = sorted[0];
			const counts: PacketSummary["counts"] = {
				expenses: 0,
				benefits: 0,
				people: 0,
				splits: 0,
				future: 0,
				documents: 0,
			};
			for (const candidate of sorted) {
				counts[candidateGroup(candidate.candidate_type)] += 1;
			}
			return {
				sourceDocumentId,
				title: first ? packetTitle(first, sourceDocumentId) : "Capture packet",
				meta: first ? packetMeta(first) : "Parsed capture",
				createdAt: first?.created_at ?? "",
				counts,
			};
		})
		.sort((a, b) => {
			const left = Date.parse(a.createdAt);
			const right = Date.parse(b.createdAt);
			if (!Number.isFinite(left) && !Number.isFinite(right)) return 0;
			if (!Number.isFinite(left)) return 1;
			if (!Number.isFinite(right)) return -1;
			return right - left;
		});
};

const packetIcons: Array<{
	key: keyof PacketSummary["counts"];
	label: string;
	icon: typeof ReceiptText;
	className: string;
}> = [
	{
		key: "expenses",
		label: "Expenses",
		icon: ReceiptText,
		className: "bg-[rgba(255,250,240,0.9)] text-[#6d5331]",
	},
	{
		key: "benefits",
		label: "Benefits",
		icon: Gift,
		className: "bg-[rgba(237,247,239,0.9)] text-[#405f44]",
	},
	{
		key: "people",
		label: "People",
		icon: UsersRound,
		className: "bg-[rgba(235,241,252,0.9)] text-[#405574]",
	},
	{
		key: "splits",
		label: "Splits",
		icon: Split,
		className: "bg-[rgba(255,240,208,0.86)] text-[#73501b]",
	},
	{
		key: "future",
		label: "Future",
		icon: Repeat,
		className: "bg-[rgba(245,240,250,0.9)] text-[#5c4a72]",
	},
	{
		key: "documents",
		label: "Documents",
		icon: FileText,
		className: "bg-[rgba(241,245,246,0.9)] text-[#4d5b5e]",
	},
];

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
		() => buildPackets(candidates).slice(0, 3),
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
						<Link
							className="block rounded-xl border border-[rgba(120,100,80,0.12)] bg-white/62 px-3 py-2 transition hover:border-[rgba(120,100,80,0.26)] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							key={packet.sourceDocumentId}
							to={`/console/review?spaceId=${encodeURIComponent(String(spaceId))}&sourceDocumentId=${encodeURIComponent(String(packet.sourceDocumentId))}`}
						>
							<div className="flex flex-wrap items-start justify-between gap-2">
								<div className="min-w-0">
									<p className="truncate text-sm font-semibold text-foreground">
										{packet.title}
									</p>
									<p className="mt-0.5 text-xs text-muted-foreground">
										{packetLine(packet.counts)}
									</p>
									<p className="mt-0.5 text-[11px] text-muted-foreground">
										{packet.meta}
									</p>
								</div>
								<span className="rounded-full border border-[rgba(120,100,80,0.16)] bg-[rgba(255,252,246,0.9)] px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
									Packet #{packet.sourceDocumentId}
								</span>
							</div>
							<div className="mt-2 flex flex-wrap gap-1.5">
								{packetIcons.map((item) => {
									const count = packet.counts[item.key];
									if (count <= 0) return null;
									const Icon = item.icon;
									return (
										<span
											className={`inline-flex min-h-7 items-center gap-1.5 rounded-full px-2 text-[11px] font-semibold ${item.className}`}
											key={item.key}
											title={item.label}
										>
											<Icon className="h-3.5 w-3.5" size={14} />
											{count}
										</span>
									);
								})}
							</div>
						</Link>
					))}
				</div>
			) : null}
		</section>
	);
};
