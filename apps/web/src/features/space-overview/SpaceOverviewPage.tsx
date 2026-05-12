import type { DashboardResponse, Space, SpaceMember } from "@cofi/api";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useConsoleHeaderTitle } from "../../app/layout/ConsoleHeaderCenterContext";
import { SpaceHeader } from "../../app/layout/workspaceSpaces/SpaceHeader";
import { SpaceTabs } from "../../app/layout/workspaceSpaces/SpaceTabs";
import { useWorkspaceSpaces } from "../../app/layout/workspaceSpaces/WorkspaceSpacesContext";
import { useAuth } from "../../contexts/AuthContext";
import { useUserFormat } from "../../shared/hooks/useUserFormat";
import { apiClient } from "../../shared/lib/apiClient";
import type { ChatWorkspaceScope } from "../../shared/lib/chatWorkspaceScope";
import { PARSE_DUMMY_TEST_SNIPPETS } from "../../shared/lib/parseDummySnippets";
import { ActivityListCard } from "../../widgets/activity-list-card";
import { OverviewRightRail } from "../../widgets/overview-right-rail";
import { QuickCaptureComposer } from "../../widgets/quick-capture-composer";

const sectionHeading =
	"flex items-center justify-between gap-3 border-b border-[rgba(95,105,125,0.12)] px-6 py-4";

const ghostButton =
	"inline-flex h-9 items-center gap-1.5 rounded-full border border-border/70 bg-background/40 backdrop-blur-sm px-3.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground transition-all duration-150 ease-out hover:-translate-y-px hover:bg-card hover:text-foreground hover:shadow-sm active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const formatMemberRole = (role: string | undefined): string => {
	const r = (role ?? "").trim().toLowerCase();
	if (!r) return "Member";
	if (r.includes("owner")) return "Owner";
	if (r.includes("admin")) return "Admin";
	if (r.includes("editor")) return "Editor";
	if (r.includes("viewer")) return "Viewer";
	if (r === "member") return "Member";
	return r.charAt(0).toUpperCase() + r.slice(1);
};

const memberAvatarPalettes = [
	"bg-[rgba(92,108,128,0.22)] text-[#2a3142]",
	"bg-[rgba(138,118,98,0.24)] text-[#453a30]",
	"bg-[rgba(108,128,108,0.24)] text-[#2d3a2d]",
	"bg-[rgba(108,118,148,0.22)] text-[#323a4d]",
];

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

const humanizeStatus = (
	value?: string | null,
	fallback = "Confirmed",
): string => {
	const raw = (value ?? "").trim();
	if (!raw) return fallback;
	const withSpaces = raw.replace(/_/g, " ");
	return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
};

export const SpaceOverviewPage = () => {
	const { spaceId } = useParams<{ spaceId: string }>();
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
	const [canManageMemberRoles, setCanManageMemberRoles] = useState(false);
	const [captureInput, setCaptureInput] = useState("");
	const [isLoading, setIsLoading] = useState(true);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [decisionCtaHovered, setDecisionCtaHovered] = useState(false);

	useEffect(() => {
		if (numericSpaceId == null) return;
		let cancelled = false;
		setIsLoading(true);
		setLoadError(null);
		setCanManageMemberRoles(false);
		void (async () => {
			try {
				const [res, mem] = await Promise.all([
					apiClient.dashboard.get({
						variant: "personal",
						period: "month",
						space_id: numericSpaceId,
					}),
					apiClient.spaces.listMembers(numericSpaceId).catch(() => null),
				]);
				if (!cancelled) {
					setDashboardData(res);
					setMembers(mem?.members ?? null);
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
	const recentTx = (dashboardData?.recent_transactions ?? []).filter(
		(t) => Number(t.space_id) === Number(numericSpaceId),
	);
	const reviewItems = (dashboardData?.review_queue?.items ?? []).flatMap(
		(it) => {
			if (
				it &&
				typeof it === "object" &&
				"kind" in it &&
				it.kind === "expense_thread_approval" &&
				"space_id" in it &&
				Number((it as { space_id: number }).space_id) === Number(numericSpaceId)
			) {
				return [
					it as {
						kind: string;
						thread_id: number;
						expense_id: number;
						space_id: number;
						space_name: string;
						label: string;
						my_share: number;
						currency: string;
						updated_at: string;
					},
				];
			}
			return [];
		},
	);

	const sidStr = String(numericSpaceId);

	const handleQuickCapture = (
		mode: "photo" | "voice" | "compose" | "recurring",
	) => {
		if (mode === "recurring") {
			navigate(`/console/spaces/${encodeURIComponent(sidStr)}/recurring`);
			return;
		}
		const state =
			chatWorkspace != null
				? {
						chatWorkspace,
						selectSpaceId: numericSpaceId,
						quickCapture:
							mode === "photo" || mode === "voice"
								? (mode as "photo" | "voice")
								: undefined,
						focusMessageComposer: mode === "compose",
					}
				: undefined;
		navigate(`/console/chat?spaceId=${encodeURIComponent(sidStr)}`, {
			state,
		});
	};

	const quickCaptureSuggestions = useMemo(
		() => PARSE_DUMMY_TEST_SNIPPETS.slice(0, 6).map((snippet) => snippet.text),
		[],
	);

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

	const confirmExpenseCount = reviewItems.length;
	const draftPendingCount = pendingDrafts.length;
	const balancesUnsettled = confirmExpenseCount > 0 || draftPendingCount > 0;
	const spaceDisplayName = space?.name?.trim() || "this space";

	const decisionRailHighlightMode = useMemo(() => {
		if (reviewItems.length > 0) return "splits" as const;
		if (pendingDrafts.length > 0) return "drafts" as const;
		return "none" as const;
	}, [reviewItems.length, pendingDrafts.length]);

	const recentActivityItems = useMemo(() => {
		const name = space?.name ?? "Space";
		const meaningForTransaction = (
			status: string | null | undefined,
			spaceName: string,
		): string => {
			const s = (status ?? "").toLowerCase();
			if (s.includes("draft") || s.includes("pending")) {
				return `Won’t affect ${spaceName} balances until confirmed.`;
			}
			if (s.includes("review") || s.includes("question")) {
				return "Needs review before it affects shared balances in this space.";
			}
			return `Included in ${spaceName} — your share follows the current split.`;
		};
		const txItems = recentTx.map((t) => ({
			amountLabel: formatMoney(t.amount),
			eventType: detectActivityType(t.label, t.status),
			id: `tx-${t.id}`,
			meaningLine: meaningForTransaction(t.status, name),
			occurredAt: t.occurred_at,
			spaceName: name,
			statusLabel: humanizeStatus(t.status, "Confirmed"),
			statusPillLabel: ["draft", "pending", "question", "review"].some(
				(token) => (t.status ?? "").toLowerCase().includes(token),
			)
				? humanizeStatus(t.status)
				: undefined,
			timeLabel: formatRelative(t.occurred_at),
			title: t.label,
			to: `/console/chat/thread?spaceId=${encodeURIComponent(sidStr)}&expenseId=${encodeURIComponent(String(t.id))}`,
		}));

		const draftItems = pendingDrafts.map((draft) => {
			const detectedEventType = detectActivityType(draft.label, "draft");
			const draftEventType =
				detectedEventType === "receipt" ? "receipt" : "draft";
			const humanDraftStatus =
				draftEventType === "receipt" ? "Needs review" : "Not saved yet";
			const lineMeaning =
				draftEventType === "receipt"
					? "Receipt imported — needs review before affecting balances."
					: "Draft in this space — not recorded until you confirm.";
			return {
				amountLabel: formatMoney(
					typeof draft.my_share === "number" ? draft.my_share : draft.total,
				),
				eventType: draftEventType as "draft" | "receipt",
				id: `draft-${draft.id}`,
				meaningLine: lineMeaning,
				occurredAt: draft.updated_at,
				spaceName: draft.space_name || space?.name || "Space",
				statusLabel: humanDraftStatus,
				statusPillLabel: humanDraftStatus,
				timeLabel: formatRelative(draft.updated_at),
				title: draft.label || "Expense draft",
				to: `/console/chat?spaceId=${encodeURIComponent(sidStr)}&view=activity`,
			};
		});

		const approvalItems = reviewItems.map((review) => ({
			amountLabel: formatMoney(review.my_share),
			eventType: "split-assigned" as const,
			id: `review-${review.expense_id}`,
			meaningLine: `Needs your approval before balances update in ${spaceDisplayName}.`,
			occurredAt: review.updated_at,
			spaceName: review.space_name || space?.name || "Space",
			statusLabel: "Split review",
			statusPillLabel: "Review",
			timeLabel: "Needs action",
			title: review.label || "Split approval",
			to: `/console/chat/thread?spaceId=${encodeURIComponent(sidStr)}&expenseId=${encodeURIComponent(String(review.expense_id))}`,
		}));

		return [...txItems, ...draftItems, ...approvalItems]
			.sort(
				(a, b) =>
					Date.parse(b.occurredAt ?? "") - Date.parse(a.occurredAt ?? ""),
			)
			.slice(0, 6);
	}, [
		recentTx,
		pendingDrafts,
		reviewItems,
		formatMoney,
		space?.name,
		sidStr,
		spaceDisplayName,
	]);

	const isWorkspaceLoading = !spaces && !loadError;

	return (
		<div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
			<header className="shrink-0 border-b border-border/80 bg-background px-4 py-3 lg:px-8">
				<SpaceTabs />
			</header>

			<div className="flex min-h-0 w-full min-w-0 flex-1 overflow-hidden">
				<div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-[linear-gradient(180deg,#faf8f3_0%,#f3efe6_42%,#f6f2ea_100%)]">
					<div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-6 lg:px-8 lg:py-10">
						<SpaceHeader
							currentUserId={user?.id ?? null}
							members={members}
							rightSlot={
								<>
									<button
										className={ghostButton}
										onClick={() => handleQuickCapture("compose")}
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
							<p className="text-sm text-muted-foreground">
								Loading workspace…
							</p>
						) : null}

						<div className="relative rounded-[1.15rem] border border-[rgba(195,155,88,0.42)] bg-gradient-to-br from-[#fff4e6] via-[#ffecd8] to-[rgba(255,235,210,0.65)] p-[3px] shadow-[0_28px_64px_-32px_rgba(105,72,28,0.38),0_12px_28px_-18px_rgba(120,88,42,0.18)] ring-1 ring-inset ring-white/55 transition-[box-shadow,transform] duration-150 ease-out hover:shadow-[0_30px_68px_-30px_rgba(105,72,28,0.34)]">
							<div className="rounded-[1.02rem] bg-[rgba(255,255,252,0.45)] p-1.5 sm:p-2">
								<QuickCaptureComposer
									emphasized
									errorText={null}
									helperText="Adds a draft in this space only. Voice and receipt open chat here."
									inputPlaceholder="Coffee 4.50, taxi home, Netflix subscription..."
									inputValue={captureInput}
									onInputChange={setCaptureInput}
									onPrimaryAction={() => handleQuickCapture("compose")}
									onReceiptAction={() => handleQuickCapture("photo")}
									onSuggestionClick={(value) => setCaptureInput(value)}
									onVoiceAction={() => handleQuickCapture("voice")}
									primaryDisabled={false}
									receiptDisabled={false}
									suggestions={quickCaptureSuggestions}
									targetSpaceName={space?.name ?? null}
									title={`Capture into ${space?.name ?? "this space"}`}
									voiceDisabled={false}
								/>
							</div>
						</div>

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
										This is your current balance within {spaceDisplayName} — not
										your global account.
									</p>
								</div>
								<div className="space-y-0 px-6 py-4">
									<div className="flex items-baseline justify-between gap-3 border-b border-[rgba(105,135,112,0.1)] py-2.5 first:pt-0">
										<span className="text-sm font-medium text-muted-foreground">
											You owe
										</span>
										<span className="text-sm font-medium tabular-nums text-foreground/68">
											{isLoading
												? "…"
												: formatMoney(spacePositionPlaceholder.youOwe)}
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
											confirmExpenseCount > 0
												? "border border-[rgba(200,130,55,0.48)] bg-[linear-gradient(90deg,rgba(255,244,220,0.98)_0%,rgba(255,250,242,0.72)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_10px_26px_-12px_rgba(150,88,32,0.18)] ring-1 ring-[rgba(200,130,60,0.22)]"
												: "",
										].join(" ")}
									>
										<div className="mt-0.5 flex shrink-0 flex-col items-center gap-1.5">
											{confirmExpenseCount > 0 ? (
												<span className="rounded-full bg-[rgba(185,95,28,0.16)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#7a420e]">
													Next
												</span>
											) : null}
											<span
												aria-hidden
												className={[
													"inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-2",
													confirmExpenseCount > 0
														? "bg-[rgba(200,120,45,0.18)] ring-[rgba(200,130,55,0.35)]"
														: "bg-[rgba(189,143,64,0.12)] ring-[rgba(189,143,64,0.15)]",
												].join(" ")}
											>
												<span
													className={[
														"h-2 w-2 rounded-full bg-[rgba(175,105,35,0.95)]",
														confirmExpenseCount > 0
															? "motion-safe:animate-pulse"
															: "",
													].join(" ")}
												/>
											</span>
										</div>
										<span
											className={[
												"min-w-0 text-sm leading-relaxed",
												confirmExpenseCount > 0
													? "font-semibold text-foreground"
													: "font-medium text-foreground/92",
											].join(" ")}
										>
											{confirmExpenseCount === 0 ? (
												<>
													Nothing waiting for your split confirmation in{" "}
													{spaceDisplayName}.
												</>
											) : (
												<>
													<span className="text-base font-extrabold tabular-nums text-[#5a3008]">
														{confirmExpenseCount}
													</span>{" "}
													<span className="font-bold text-foreground">
														{confirmExpenseCount === 1
															? "expense needs"
															: "expenses need"}
													</span>{" "}
													<Link
														className="font-bold text-[#5e2f00] underline decoration-[rgba(150,80,20,0.75)] decoration-2 underline-offset-[3px] transition-colors duration-150 hover:text-[#441f00] hover:decoration-[rgba(110,55,12,0.9)]"
														to={`/console/review?spaceId=${encodeURIComponent(sidStr)}`}
													>
														your confirmation
													</Link>{" "}
													<span className="font-semibold text-foreground/90">
														before shared balances change.
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
											{draftPendingCount === 0 ? (
												<>No drafts waiting in {spaceDisplayName}.</>
											) : (
												<>
													<strong className="font-semibold text-foreground">
														{draftPendingCount}
													</strong>{" "}
													{draftPendingCount === 1 ? "draft" : "drafts"} still
													in this space —{" "}
													<Link
														className="font-semibold text-[#6a3d0a] underline decoration-[rgba(160,95,28,0.55)] decoration-2 underline-offset-[3px] transition-colors duration-150 hover:text-[#482608] hover:decoration-[rgba(120,70,18,0.85)]"
														to={`/console/chat?spaceId=${encodeURIComponent(sidStr)}&view=activity`}
													>
														review
													</Link>{" "}
													when you are ready.
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
												? "Balances here are not fully settled until the items above are finished."
												: "No confirmations blocking balances in this space right now."}
										</span>
									</li>
								</ul>
							</section>
						</div>

						<div className="grid grid-cols-1 gap-7 pt-1 lg:grid-cols-3 lg:gap-8">
							<div className="lg:col-span-2">
								<ActivityListCard
									activityAnchorId="space-overview-activity"
									ctaLabel="All items"
									ctaTo={`/console/chat/expenses?spaceId=${encodeURIComponent(sidStr)}`}
									eyebrow="In this space"
									emptySubtext="Capture something or invite people to see shared activity here."
									emptyText="No recent moves in this space"
									items={recentActivityItems}
									linkState={chatWorkspace ? { chatWorkspace } : undefined}
									railHighlightActive={decisionCtaHovered}
									railHighlightMode={decisionRailHighlightMode}
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
											Members
										</h2>
									</div>
									{canManageMemberRoles ? (
										<Link
											className={ghostButton}
											to={`/console/spaces/${encodeURIComponent(sidStr)}/settings#space-settings-members`}
										>
											Invite users
										</Link>
									) : null}
								</div>
								<ul className="divide-y divide-[rgba(95,105,125,0.1)] px-1 pb-2 pt-1">
									{(members ?? []).length === 0 ? (
										<li className="p-6 text-sm text-muted-foreground">
											Just you for now.
										</li>
									) : null}
									{(members ?? []).slice(0, 8).map((m) => {
										const isMe =
											user?.id != null && Number(m.user_id) === Number(user.id);
										const roleLabel = formatMemberRole(m.role);
										const isOwner = (m.role ?? "")
											.toLowerCase()
											.includes("owner");
										const label =
											m.name?.trim() ||
											m.email?.trim() ||
											`Member ${m.user_id}`;
										const initial = label.charAt(0).toUpperCase();
										const paletteClass =
											memberAvatarPalettes[
												Math.abs(Number(m.user_id)) %
													memberAvatarPalettes.length
											];
										return (
											<li
												className={[
													"group mx-1.5 flex items-center gap-5 rounded-xl px-4 py-4 text-sm transition-[background-color,box-shadow,transform] duration-150 ease-out sm:px-5 sm:py-4",
													isMe
														? "bg-[rgba(120,154,124,0.1)] ring-1 ring-inset ring-[rgba(120,154,124,0.18)]"
														: isOwner
															? "bg-[rgba(125,105,85,0.07)] ring-1 ring-inset ring-[rgba(125,105,85,0.12)]"
															: "bg-transparent",
													"hover:-translate-y-px hover:bg-[rgba(255,255,255,0.65)] hover:shadow-sm",
												].join(" ")}
												key={m.user_id}
											>
												<span
													aria-hidden
													className={[
														"inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold uppercase tracking-tight shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] transition-transform duration-150 group-hover:scale-[1.02]",
														isMe
															? "bg-[rgba(120,154,124,0.32)] text-[#1f3d26] ring-2 ring-[rgba(120,154,124,0.28)]"
															: paletteClass,
													].join(" ")}
												>
													{initial}
												</span>
												<div className="min-w-0 flex-1">
													<p className="truncate text-base font-semibold tracking-tight text-foreground">
														{label}
														{isMe ? (
															<span className="ml-2 inline-flex rounded-full bg-[rgba(120,154,124,0.28)] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#1f3d26] ring-1 ring-[rgba(90,130,98,0.25)]">
																You
															</span>
														) : null}
														{isOwner ? (
															<span className="ml-2 inline-flex rounded-full bg-[rgba(125,95,70,0.18)] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#4a3220] ring-1 ring-[rgba(110,80,55,0.2)]">
																Owner
															</span>
														) : null}
													</p>
													<p className="mt-1 truncate text-sm font-medium text-muted-foreground">
														{roleLabel}
													</p>
												</div>
											</li>
										);
									})}
								</ul>
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
					</div>
				</div>

				<aside
					aria-label={`${space?.name ?? "Space"} utility rail`}
					className="hidden shrink-0 self-stretch flex-col border-l border-[rgba(190,175,150,0.35)] bg-[linear-gradient(180deg,#f5f1ea_0%,#f0ebe3_100%)] xl:flex xl:w-[20rem]"
				>
					<div className="min-h-0 flex-1 overflow-y-auto px-5 py-8">
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
				</aside>
			</div>
		</div>
	);
};
