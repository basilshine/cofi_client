import type {
	CapturePacket as ApiCapturePacket,
	DashboardResponse,
	Space,
	SpaceMember,
	SpaceParticipant,
} from "@cofi/api";
import { useEffect, useMemo, useState } from "react";
import {
	Link,
	Navigate,
	useLocation,
	useNavigate,
	useParams,
} from "react-router-dom";
import { useConsoleHeaderTitle } from "../../app/layout/ConsoleHeaderCenterContext";
import { SpaceHeader } from "../../app/layout/workspaceSpaces/SpaceHeader";
import { SpaceWorkspaceLayout } from "../../app/layout/workspaceSpaces/SpaceWorkspaceLayout";
import { useWorkspaceSpaces } from "../../app/layout/workspaceSpaces/WorkspaceSpacesContext";
import { openGlobalComposerIntent } from "../../app/layout/workspaceSpaces/globalComposerIntent";
import { useAuth } from "../../contexts/AuthContext";
import { useUserFormat } from "../../shared/hooks/useUserFormat";
import { apiClient } from "../../shared/lib/apiClient";
import {
	capturePacketSummaryFromApi,
	capturePacketSummaryLine,
} from "../../shared/lib/capturePacketSummary";
import type { ChatWorkspaceScope } from "../../shared/lib/chatWorkspaceScope";
import { ActivityListCard } from "../../widgets/activity-list-card";
import { OverviewRightRail } from "../../widgets/overview-right-rail";
import { SpaceParticipantsPanel } from "../../widgets/space-participants-panel";

const sectionHeading =
	"flex items-center justify-between gap-3 border-b border-[rgba(95,105,125,0.12)] px-6 py-4";

const ghostButton =
	"inline-flex h-9 items-center gap-1.5 rounded-full border border-border/70 bg-background/40 backdrop-blur-sm px-3.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground transition-all duration-150 ease-out hover:-translate-y-px hover:bg-card hover:text-foreground hover:shadow-sm active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

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

const formatRelative = (iso?: string | null): string => {
	if (!iso) return "—";
	const ts = Date.parse(iso);
	if (!Number.isFinite(ts)) return iso;
	const diff = Date.now() - ts;
	const min = Math.round(diff / 60000);
	if (min < 1) return "just now";
	if (min < 60) return `${min}m ago`;
	const hr = Math.round(min / 60);
	if (hr < 24) return `${hr}h ago`;
	const day = Math.round(hr / 24);
	if (day < 7) return `${day}d ago`;
	const week = Math.round(day / 7);
	return `${week}w ago`;
};

const detectActivityType = (
	label: string,
	status?: string | null,
):
	| "expense"
	| "question"
	| "recurring"
	| "receipt"
	| "voice"
	| "edited"
	| "split-assigned"
	| "recurring-created" => {
	const normalized = `${label} ${status ?? ""}`.toLowerCase();
	if (
		normalized.includes("split assigned") ||
		normalized.includes("split review")
	) {
		return "split-assigned";
	}
	if (normalized.includes("edited") || normalized.includes("updated")) {
		return "edited";
	}
	if (
		normalized.includes("recurring created") ||
		normalized.includes("schedule created")
	) {
		return "recurring-created";
	}
	if (
		normalized.includes("question") ||
		normalized.includes("query") ||
		normalized.includes("ask")
	) {
		return "question";
	}
	if (
		normalized.includes("subscription") ||
		normalized.includes("recurring") ||
		normalized.includes("monthly")
	) {
		return "recurring";
	}
	if (
		normalized.includes("receipt") ||
		normalized.includes("invoice") ||
		normalized.includes("bill")
	) {
		return "receipt";
	}
	if (
		normalized.includes("voice") ||
		normalized.includes("transcript") ||
		normalized.includes("audio")
	) {
		return "voice";
	}
	return "expense";
};

export const SpaceOverviewPage = () => {
	const { spaceId } = useParams<{ spaceId: string }>();
	const location = useLocation();
	const navigate = useNavigate();
	const { user } = useAuth();
	const { formatMoney } = useUserFormat();
	const { spaces, workspaceScope, selectedSpaceId, setSelectedSpaceId } =
		useWorkspaceSpaces();

	const numericSpaceId = useMemo(() => {
		const n = Number(spaceId);
		return Number.isFinite(n) ? n : null;
	}, [spaceId]);

	const space: Space | null = useMemo(() => {
		if (!spaces || spaceId == null) return null;
		return spaces.find((s) => String(s.id) === String(spaceId)) ?? null;
	}, [spaces, spaceId]);

	useConsoleHeaderTitle("Overview", space?.name ?? null);

	useEffect(() => {
		if (numericSpaceId == null) return;
		if (
			selectedSpaceId == null ||
			String(selectedSpaceId) !== String(numericSpaceId)
		) {
			setSelectedSpaceId(numericSpaceId);
		}
	}, [numericSpaceId, selectedSpaceId, setSelectedSpaceId]);

	const [dashboardData, setDashboardData] = useState<DashboardResponse | null>(
		null,
	);
	const [members, setMembers] = useState<SpaceMember[] | null>(null);
	const [participants, setParticipants] = useState<SpaceParticipant[] | null>(
		null,
	);
	const [spaceCapturePackets, setSpaceCapturePackets] = useState<
		ApiCapturePacket[]
	>([]);
	const [canManageMemberRoles, setCanManageMemberRoles] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [decisionCtaHovered, setDecisionCtaHovered] = useState(false);

	useEffect(() => {
		if (numericSpaceId == null) return;
		let cancelled = false;
		setIsLoading(true);
		setLoadError(null);
		setCanManageMemberRoles(false);
		setParticipants(null);
		setSpaceCapturePackets([]);
		void (async () => {
			try {
				const [res, mem, participantRes, captureRes] = await Promise.all([
					apiClient.dashboard.get({
						variant: "personal",
						period: "month",
						space_id: numericSpaceId,
					}),
					apiClient.spaces.listMembers(numericSpaceId).catch(() => null),
					apiClient.spaces.listParticipants(numericSpaceId).catch(() => null),
					apiClient.spaces
						.listCapturePackets(numericSpaceId, {
							includeRecords: true,
							limit: 40,
						})
						.catch(() => null),
				]);
				if (!cancelled) {
					setDashboardData(res);
					setMembers(mem?.members ?? null);
					setParticipants(participantRes?.participants ?? null);
					setSpaceCapturePackets(captureRes?.captures ?? []);
					setCanManageMemberRoles(Boolean(mem?.can_manage_member_roles));
				}
			} catch (e) {
				if (!cancelled) {
					setLoadError(
						e instanceof Error
							? e.message
							: "Failed to load this space overview",
					);
				}
			} finally {
				if (!cancelled) setIsLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [numericSpaceId]);

	const handleParticipantSaved = (participant: SpaceParticipant) => {
		setParticipants((current) => {
			if (!current) return [participant];
			return current.map((item) =>
				Number(item.id) === Number(participant.id) ? participant : item,
			);
		});
	};

	const chatWorkspace = useMemo((): ChatWorkspaceScope | null => {
		if (workspaceScope) return workspaceScope;
		if (dashboardData?.context?.tenant_id != null) {
			return {
				kind: "personal",
				tenantId: Number(dashboardData.context.tenant_id),
				label: "Personal",
			};
		}
		return null;
	}, [workspaceScope, dashboardData?.context?.tenant_id]);

	if (numericSpaceId == null) {
		return <Navigate replace to="/console/home" />;
	}

	const pendingDrafts = (dashboardData?.pending_drafts ?? []).filter(
		(d) => Number(d.space_id) === Number(numericSpaceId),
	);
	const sidStr = String(numericSpaceId);

	const handleOpenAddExpense = () => {
		openGlobalComposerIntent(navigate, location, "expense");
	};

	/** TODO: replace with space-scoped balances when API exposes owe / owed / net. */
	const spacePositionPlaceholder = useMemo(
		() => ({
			youOwe: 75.8,
			youAreOwed: 120,
			net: 44.2,
		}),
		[],
	);
	const netTone: "positive" | "negative" | "neutral" =
		spacePositionPlaceholder.net > 0
			? "positive"
			: spacePositionPlaceholder.net < 0
				? "negative"
				: "neutral";
	const netLabel =
		spacePositionPlaceholder.net >= 0
			? `+${formatMoney(spacePositionPlaceholder.net)}`
			: formatMoney(spacePositionPlaceholder.net);

	const capturePackets = useMemo(() => {
		return spaceCapturePackets
			.filter(
				(packet) =>
					Number(packet.pending_count ?? 0) > 0 ||
					Number(packet.candidate_count ?? 0) > 0 ||
					capturePacketRecordCount(packet) > 0,
			)
			.map((packet) => {
				const summary = capturePacketSummaryFromApi(packet);
				const createdRecordCount = capturePacketRecordCount(packet);
				const pendingCount = Number(packet.pending_count ?? 0);
				return {
					...summary,
					createdRecordCount,
					needsReview:
						pendingCount > 0 ||
						(Number(packet.candidate_count ?? 0) > 0 &&
							createdRecordCount === 0),
				};
			});
	}, [spaceCapturePackets]);

	const pendingCapturePackets = useMemo(
		() => capturePackets.filter((packet) => packet.needsReview),
		[capturePackets],
	);

	const capturePacketCounts = useMemo(
		() =>
			pendingCapturePackets.reduce(
				(acc, packet) => ({
					expenses: acc.expenses + packet.counts.expenses,
					benefits: acc.benefits + packet.counts.benefits,
					people: acc.people + packet.counts.people,
					splits: acc.splits + packet.counts.splits,
					future: acc.future + packet.counts.future,
					documents: acc.documents + packet.counts.documents,
				}),
				{
					expenses: 0,
					benefits: 0,
					people: 0,
					splits: 0,
					future: 0,
					documents: 0,
				},
			),
		[pendingCapturePackets],
	);

	const captureReviewCount =
		pendingCapturePackets.length + pendingDrafts.length;
	const draftPendingCount = pendingDrafts.length;
	const balancesUnsettled = captureReviewCount > 0 || draftPendingCount > 0;
	const spaceDisplayName = space?.name?.trim() || "this space";
	const captureBreakdown = [
		{
			count: capturePacketCounts.expenses + pendingDrafts.length,
			label: "expense",
		},
		{ count: capturePacketCounts.benefits, label: "benefit" },
		{ count: capturePacketCounts.people, label: "person" },
		{ count: capturePacketCounts.splits, label: "split" },
		{ count: capturePacketCounts.future, label: "future hint" },
		{ count: capturePacketCounts.documents, label: "document signal" },
	]
		.filter((item) => item.count > 0)
		.map((item) => `${item.count} ${item.label}${item.count === 1 ? "" : "s"}`)
		.join(", ");

	const decisionRailHighlightMode = useMemo(() => {
		if (capturePacketCounts.splits > 0) return "splits" as const;
		if (pendingDrafts.length > 0) return "drafts" as const;
		return "none" as const;
	}, [capturePacketCounts.splits, pendingDrafts.length]);

	const recentActivityItems = useMemo(() => {
		const name = space?.name ?? "Space";
		const packetItems = capturePackets.map((packet) => {
			const reviewHref = `/console/review?spaceId=${encodeURIComponent(sidStr)}&sourceDocumentId=${encodeURIComponent(String(packet.sourceDocumentId))}`;
			const createdRecordText =
				packet.createdRecordCount > 0
					? `${packet.createdRecordCount} ${packet.createdRecordCount === 1 ? "record" : "records"} created`
					: null;
			return {
				eventType: "capture" as const,
				id: `capture-${packet.sourceDocumentId}`,
				meaningLine: packet.needsReview
					? `Ceits found ${capturePacketSummaryLine(packet.counts)}. Review this capture before it becomes records in ${spaceDisplayName}.`
					: `Records created from this capture in ${spaceDisplayName}. Open the source to inspect provenance.`,
				occurredAt: packet.createdAt,
				spaceName: name,
				statusLabel: packet.needsReview ? "Capture review" : "Confirmed",
				statusPillLabel: packet.needsReview
					? packet.summary
					: (createdRecordText ?? "Records created"),
				sourceCaptureTo: reviewHref,
				sourceDocumentId: packet.sourceDocumentId,
				timeLabel: formatRelative(packet.createdAt),
				title: packet.title,
				to: reviewHref,
			};
		});

		const draftItems = pendingDrafts.map((draft) => {
			const detectedEventType = detectActivityType(draft.label, "draft");
			const captureSource =
				detectedEventType === "receipt" ? "Receipt capture" : "Text capture";
			const lineMeaning =
				detectedEventType === "receipt"
					? "Receipt capture needs review before affecting balances."
					: "Capture produced an expense draft that is not recorded until you confirm.";
			return {
				amountLabel: formatMoney(
					typeof draft.my_share === "number" ? draft.my_share : draft.total,
				),
				eventType: "capture" as const,
				id: `draft-${draft.id}`,
				meaningLine: lineMeaning,
				occurredAt: draft.updated_at,
				spaceName: draft.space_name || space?.name || "Space",
				statusLabel: captureSource,
				statusPillLabel: "Expense draft",
				sourceCaptureTo:
					draft.source_document_id != null
						? `/console/review?spaceId=${encodeURIComponent(sidStr)}&sourceDocumentId=${encodeURIComponent(String(draft.source_document_id))}`
						: `/console/review?spaceId=${encodeURIComponent(sidStr)}`,
				sourceDocumentId: draft.source_document_id ?? null,
				timeLabel: formatRelative(draft.updated_at),
				title: draft.label || "Capture with expense draft",
				to:
					draft.source_document_id != null
						? `/console/review?spaceId=${encodeURIComponent(sidStr)}&sourceDocumentId=${encodeURIComponent(String(draft.source_document_id))}`
						: `/console/review?spaceId=${encodeURIComponent(sidStr)}`,
			};
		});

		return [...packetItems, ...draftItems]
			.sort(
				(a, b) =>
					Date.parse(b.occurredAt ?? "") - Date.parse(a.occurredAt ?? ""),
			)
			.slice(0, 6);
	}, [
		capturePackets,
		pendingDrafts,
		formatMoney,
		space?.name,
		sidStr,
		spaceDisplayName,
	]);

	const isWorkspaceLoading = !spaces && !loadError;

	return (
		<SpaceWorkspaceLayout
			contentClassName="mx-auto w-full max-w-5xl space-y-8 px-4 py-6 lg:px-8 lg:py-10"
			rightRail={
				<OverviewRightRail
					chatWorkspace={chatWorkspace}
					dashboardData={dashboardData}
					formatMoney={formatMoney}
					onSpaceOverviewCtaHover={setDecisionCtaHovered}
					spaceId={numericSpaceId}
					spaceName={space?.name ?? null}
					variant="spaceOverview"
				/>
			}
			rightRailLabel={`${space?.name ?? "Space"} utility rail`}
		>
			<SpaceHeader
				currentUserId={user?.id ?? null}
				members={members}
				rightSlot={
					<>
						<button
							className={ghostButton}
							onClick={handleOpenAddExpense}
							type="button"
						>
							Add expense
						</button>
						<Link
							className={ghostButton}
							to={`/console/chat?spaceId=${encodeURIComponent(sidStr)}`}
						>
							Open chat
						</Link>
					</>
				}
				space={
					space ??
					(numericSpaceId != null
						? ({
								id: numericSpaceId,
								name: "Space",
								tenant_id: 0,
							} as Space)
						: null)
				}
			/>

			{loadError ? (
				<div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
					{loadError}
				</div>
			) : null}

			{isWorkspaceLoading ? (
				<p className="text-sm text-muted-foreground">Loading workspace…</p>
			) : null}

			<div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start lg:gap-7">
				<section
					aria-label="Your position in this space"
					className="lg:col-span-2 rounded-2xl border border-[rgba(95,125,102,0.32)] bg-gradient-to-br from-[#f0f8f2] via-[#fefdfb] to-[#e8f2ea] text-card-foreground shadow-[0_20px_48px_-28px_rgba(48,72,52,0.26)] ring-1 ring-inset ring-white/55 transition-[box-shadow,transform] duration-150 ease-out hover:-translate-y-px hover:shadow-[0_24px_52px_-26px_rgba(48,72,52,0.22)]"
				>
					<div className="border-b border-[rgba(105,135,112,0.15)] bg-[rgba(255,255,255,0.35)] px-6 py-4">
						<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#4d6651]">
							This space
						</p>
						<h2 className="mt-1.5 font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
							Your position in {spaceDisplayName}
						</h2>
						<p className="mt-2 text-sm leading-relaxed text-foreground/75">
							This is your current balance within {spaceDisplayName} — not your
							global account.
						</p>
					</div>
					<div className="space-y-0 px-6 py-4">
						<div className="flex items-baseline justify-between gap-3 border-b border-[rgba(105,135,112,0.1)] py-2.5 first:pt-0">
							<span className="text-sm font-medium text-muted-foreground">
								You owe
							</span>
							<span className="text-sm font-medium tabular-nums text-foreground/68">
								{isLoading ? "…" : formatMoney(spacePositionPlaceholder.youOwe)}
							</span>
						</div>
						<div className="flex items-baseline justify-between gap-3 border-b border-[rgba(105,135,112,0.1)] py-2.5">
							<span className="text-sm font-medium text-muted-foreground">
								You are owed
							</span>
							<span className="text-sm font-medium tabular-nums text-foreground/68">
								{isLoading
									? "…"
									: formatMoney(spacePositionPlaceholder.youAreOwed)}
							</span>
						</div>
						<div
							className={[
								"mt-4 rounded-xl border px-4 py-4 sm:px-5 sm:py-5",
								netTone === "positive"
									? "border-[rgba(100,145,108,0.42)] bg-[linear-gradient(145deg,rgba(236,252,238,0.98)_0%,rgba(214,235,218,0.92)_55%,rgba(200,228,206,0.88)_100%)] shadow-[0_0_0_1px_rgba(120,168,128,0.12),0_16px_40px_-14px_rgba(72,120,78,0.28),inset_0_1px_0_rgba(255,255,255,0.85)]"
									: netTone === "negative"
										? "border-[rgba(185,120,72,0.45)] bg-[linear-gradient(145deg,#fff8f0_0%,#ffeede_50%,#ffe8d4_100%)] shadow-[0_0_0_1px_rgba(200,130,70,0.14),0_16px_40px_-14px_rgba(140,85,40,0.22),inset_0_1px_0_rgba(255,255,255,0.8)]"
										: "border-[rgba(120,135,125,0.28)] bg-[rgba(250,251,250,0.95)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]",
							].join(" ")}
						>
							<div className="flex flex-wrap items-baseline justify-between gap-2">
								<span className="text-sm font-semibold tracking-wide text-foreground/88">
									Net balance
								</span>
								{!isLoading && netTone === "positive" ? (
									<span className="inline-flex items-center gap-1 rounded-full bg-[rgba(90,140,98,0.22)] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#2d5234]">
										In your favor
									</span>
								) : null}
								{!isLoading && netTone === "negative" ? (
									<span className="inline-flex items-center gap-1 rounded-full bg-[rgba(185,110,55,0.2)] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#6b3d18]">
										Net you owe
									</span>
								) : null}
							</div>
							<p
								className={`mt-2 text-3xl font-bold tabular-nums tracking-tight sm:text-4xl ${
									netTone === "positive"
										? "text-[#355a3c]"
										: netTone === "negative"
											? "text-[#7a4214]"
											: "text-foreground"
								}`}
							>
								{isLoading ? "…" : netLabel}
							</p>
						</div>
						<p className="pt-3 text-sm leading-relaxed text-muted-foreground">
							Space balances sync when splits and drafts are confirmed.
						</p>
					</div>
				</section>

				<section
					aria-label="What needs attention in this space"
					className="rounded-2xl border border-[rgba(200,160,95,0.32)] bg-gradient-to-b from-[#fffdfb] via-[#fffaf4] to-[#f8f3eb] text-card-foreground shadow-[0_10px_32px_-28px_rgba(120,88,48,0.16)] ring-1 ring-inset ring-white/45 transition-[box-shadow,transform] duration-150 ease-out hover:-translate-y-px hover:shadow-[0_14px_36px_-26px_rgba(120,88,48,0.18)]"
				>
					<div className="border-b border-[rgba(200,160,95,0.18)] bg-[rgba(255,255,255,0.38)] px-6 py-4">
						<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[rgba(120,82,28,0.88)]">
							Situation
						</p>
						<h2 className="mt-1.5 font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
							Space state
						</h2>
						<p className="mt-2 text-sm font-medium leading-relaxed text-foreground/82">
							What to handle next in {spaceDisplayName}.
						</p>
					</div>
					<ul className="space-y-0 px-4 py-4 sm:px-5">
						<li
							className={[
								"flex gap-3 rounded-xl px-2 py-3.5 sm:px-3",
								captureReviewCount > 0
									? "border border-[rgba(200,130,55,0.48)] bg-[linear-gradient(90deg,rgba(255,244,220,0.98)_0%,rgba(255,250,242,0.72)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_10px_26px_-12px_rgba(150,88,32,0.18)] ring-1 ring-[rgba(200,130,60,0.22)]"
									: "",
							].join(" ")}
						>
							<div className="mt-0.5 flex shrink-0 flex-col items-center gap-1.5">
								{captureReviewCount > 0 ? (
									<span className="rounded-full bg-[rgba(185,95,28,0.16)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#7a420e]">
										Next
									</span>
								) : null}
								<span
									aria-hidden
									className={[
										"inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-2",
										captureReviewCount > 0
											? "bg-[rgba(200,120,45,0.18)] ring-[rgba(200,130,55,0.35)]"
											: "bg-[rgba(189,143,64,0.12)] ring-[rgba(189,143,64,0.15)]",
									].join(" ")}
								>
									<span
										className={[
											"h-2 w-2 rounded-full bg-[rgba(175,105,35,0.95)]",
											captureReviewCount > 0 ? "motion-safe:animate-pulse" : "",
										].join(" ")}
									/>
								</span>
							</div>
							<span
								className={[
									"min-w-0 text-sm leading-relaxed",
									captureReviewCount > 0
										? "font-semibold text-foreground"
										: "font-medium text-foreground/92",
								].join(" ")}
							>
								{captureReviewCount === 0 ? (
									<>No captures waiting for review in {spaceDisplayName}.</>
								) : (
									<>
										<span className="text-base font-extrabold tabular-nums text-[#5a3008]">
											{captureReviewCount}
										</span>{" "}
										<span className="font-bold text-foreground">
											{captureReviewCount === 1
												? "capture needs"
												: "captures need"}
										</span>{" "}
										<Link
											className="font-bold text-[#5e2f00] underline decoration-[rgba(150,80,20,0.75)] decoration-2 underline-offset-[3px] transition-colors duration-150 hover:text-[#441f00] hover:decoration-[rgba(110,55,12,0.9)]"
											to={`/console/review?spaceId=${encodeURIComponent(sidStr)}`}
										>
											review
										</Link>{" "}
										<span className="font-semibold text-foreground/90">
											before their expense, split, and benefit candidates become
											records.
										</span>
									</>
								)}
							</span>
						</li>
						<li className="flex gap-3 rounded-xl border-t border-[rgba(200,160,95,0.15)] px-2 py-3.5 transition-colors duration-150 sm:px-3">
							<span
								aria-hidden
								className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[rgba(189,143,64,0.55)] ring-4 ring-[rgba(189,143,64,0.1)]"
							/>
							<span className="text-sm font-medium leading-relaxed text-foreground/88">
								{captureReviewCount === 0 ? (
									<>Ceits has no unresolved capture candidates in this space.</>
								) : (
									<>
										Inside those captures:{" "}
										<strong className="font-semibold text-foreground">
											{captureBreakdown || "review candidates"}
										</strong>
										.{" "}
										<Link
											className="font-semibold text-[#6a3d0a] underline decoration-[rgba(160,95,28,0.55)] decoration-2 underline-offset-[3px] transition-colors duration-150 hover:text-[#482608] hover:decoration-[rgba(120,70,18,0.85)]"
											to={`/console/review?spaceId=${encodeURIComponent(sidStr)}`}
										>
											Open captures
										</Link>{" "}
										to decide what becomes records.
									</>
								)}
							</span>
						</li>
						<li className="flex gap-3 rounded-xl border-t border-[rgba(200,160,95,0.2)] px-2 py-3.5 text-foreground/88 sm:px-3">
							<span
								aria-hidden
								className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[rgba(140,125,105,0.55)] ring-4 ring-[rgba(140,125,105,0.1)]"
							/>
							<span className="text-sm leading-relaxed">
								{balancesUnsettled
									? "Balances here are not fully settled until the captures above are finished."
									: "No capture decisions are blocking balances in this space right now."}
							</span>
						</li>
					</ul>
				</section>
			</div>

			<div className="grid grid-cols-1 gap-7 pt-1 lg:grid-cols-3 lg:gap-8">
				<div className="lg:col-span-2">
					<ActivityListCard
						activityAnchorId="space-overview-activity"
						ctaLabel="Review captures"
						ctaTo={`/console/review?spaceId=${encodeURIComponent(sidStr)}`}
						eyebrow="In this space"
						emptySubtext="Capture something or invite people to see shared activity here."
						emptyText="No recent moves in this space"
						items={recentActivityItems}
						linkState={chatWorkspace ? { chatWorkspace } : undefined}
						railHighlightActive={decisionCtaHovered}
						railHighlightMode={decisionRailHighlightMode}
						scope="space"
						streamGroupByAttention
						surfaceVariant="spaceWarm"
						title="What’s happening"
					/>
				</div>

				<section
					aria-labelledby="space-members"
					className="rounded-2xl border border-[rgba(95,105,125,0.12)] bg-gradient-to-b from-[#faf8f5] to-[#f0ece6] text-card-foreground shadow-[0_8px_26px_-22px_rgba(45,48,58,0.1)] ring-1 ring-inset ring-white/50 transition-[box-shadow] duration-150 hover:shadow-[0_12px_30px_-20px_rgba(45,48,58,0.12)]"
				>
					<div className={sectionHeading}>
						<div className="min-w-0">
							<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[rgba(72,78,95,0.78)]">
								People
							</p>
							<h2
								className="mt-1 font-display text-xl font-bold tracking-tight text-foreground"
								id="space-members"
							>
								Participants
							</h2>
						</div>
						{canManageMemberRoles ? (
							<Link
								className={ghostButton}
								to={`/console/spaces/${encodeURIComponent(sidStr)}/members`}
							>
								View all
							</Link>
						) : null}
					</div>
					<SpaceParticipantsPanel
						description="Registered users, pending invites, and placeholders Ceits can use for captures and splits."
						emptyText="No participants yet. Capture something, review a split, or invite someone to start the people list."
						maxVisible={6}
						onParticipantSaved={handleParticipantSaved}
						participants={participants}
						readOnly
						registeredFirst
						showAliases={false}
						showHeader={false}
						stateOnly
						spaceId={numericSpaceId}
					/>
				</section>
			</div>

			{/* On smaller viewports the right rail content stacks here. */}
			<div className="xl:hidden">
				<OverviewRightRail
					chatWorkspace={chatWorkspace}
					dashboardData={dashboardData}
					formatMoney={formatMoney}
					onSpaceOverviewCtaHover={setDecisionCtaHovered}
					spaceId={numericSpaceId}
					spaceName={space?.name ?? null}
					variant="spaceOverview"
				/>
			</div>
		</SpaceWorkspaceLayout>
	);
};
