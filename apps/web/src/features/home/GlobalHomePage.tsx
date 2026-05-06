import type { DashboardResponse } from "@cofi/api";
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useConsoleHeaderTitle } from "../../app/layout/ConsoleHeaderCenterContext";
import { OverviewRightRail } from "../../app/layout/workspaceSpaces/OverviewRightRail";
import { useWorkspaceSpaces } from "../../app/layout/workspaceSpaces/WorkspaceSpacesContext";
import { useAuth } from "../../contexts/AuthContext";
import { useUserFormat } from "../../shared/hooks/useUserFormat";
import { apiClient } from "../../shared/lib/apiClient";
import type { ChatWorkspaceScope } from "../../shared/lib/chatWorkspaceScope";
import {
	createManualDraftInSpace,
	parsePhotoInSpace,
	parseTextInSpace,
	parseVoiceInSpace,
} from "../../shared/lib/quickCaptureTransactions";
import { sortSpacesByLastActivity } from "../../shared/lib/recentSpaceIds";
import { PARSE_DUMMY_TEST_SNIPPETS } from "../chatlog/parseDummySnippets";
import { ActivityListCard } from "./components/ActivityListCard";
import { InsightMetricCard } from "./components/InsightMetricCard";
import { OverviewHeroCard } from "./components/OverviewHeroCard";
import { QuickCaptureComposer } from "./components/QuickCaptureComposer";

const sectionEyebrow = "eyebrow";

const ghostButton =
	"inline-flex h-9 items-center gap-1.5 rounded-full border border-border/70 bg-background/40 backdrop-blur-sm px-3.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground transition hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

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

const friendlySpaceNameByIndex = [
	"Family Budget",
	"Home & Bills",
	"Weekend Trip",
	"Personal",
];

const normalizeSpaceName = (name: string, index: number): string => {
	const trimmed = name.trim();
	if (!trimmed) return friendlySpaceNameByIndex[index] ?? `Space ${index + 1}`;
	if (/^ws shared \d+$/i.test(trimmed)) {
		return friendlySpaceNameByIndex[index] ?? "Shared Space";
	}
	return trimmed;
};

const normalizeLabel = (
	value: string | undefined | null,
	fallback: string,
): string => {
	const trimmed = (value ?? "").trim();
	if (!trimmed) return fallback;
	if (/\(dummy\)/i.test(trimmed)) return fallback;
	return trimmed;
};

const transactionLabelFallbacks = [
	"Grocery run",
	"Home Depot",
	"Whole Foods",
	"Summer camp deposit",
	"Internet bill",
];

type HeroChipTone = "food" | "recurring" | "uncategorized";
type QuickCaptureSource = "text" | "voice" | "receipt";

type QuickCaptureDraft = {
	expenseId?: string | number;
	title: string;
	displayTitle: string;
	amount: number;
	category: string;
	dateLabel: string;
	sourceLabel: string;
	lines: Array<{ name: string; amount: number }>;
	itemCount: number;
};

const PARSE_PREVIEW_DELAY_MS = 5000;

const getHeroChipTone = (tag: string): HeroChipTone => {
	const normalized = tag.trim().toLowerCase();
	if (
		normalized.includes("food") ||
		normalized.includes("grocery") ||
		normalized.includes("groceries")
	) {
		return "food";
	}
	if (
		normalized.includes("bill") ||
		normalized.includes("recurring") ||
		normalized.includes("subscription") ||
		normalized.includes("rent") ||
		normalized.includes("utilities")
	) {
		return "recurring";
	}
	return "uncategorized";
};

const cleanReceiptItemName = (raw: string, index: number): string => {
	const value = raw.trim();
	const technical =
		/line\s*\d+|shelf item|dummy|stress test|mega receipt/i.test(value);
	if (!value || technical) {
		return `Receipt item ${String(index + 1).padStart(2, "0")}`;
	}
	return value;
};

export const GlobalHomePage = () => {
	const { user } = useAuth();
	const navigate = useNavigate();
	const { formatMoney } = useUserFormat();
	const { spaces, workspaceScope, selectedSpaceId, setSelectedSpaceId } =
		useWorkspaceSpaces();
	useConsoleHeaderTitle("Home", null);

	const [dashboardData, setDashboardData] = useState<DashboardResponse | null>(
		null,
	);
	const [isLoading, setIsLoading] = useState(true);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [captureInput, setCaptureInput] = useState("");
	const [isParsingDraft, setIsParsingDraft] = useState(false);
	const [parseStep, setParseStep] = useState(0);
	const [captureError, setCaptureError] = useState<string | null>(null);
	const [isRecordingVoice, setIsRecordingVoice] = useState(false);
	const [draftPreview, setDraftPreview] = useState<QuickCaptureDraft | null>(
		null,
	);
	const [confirmedDraft, setConfirmedDraft] =
		useState<QuickCaptureDraft | null>(null);
	const [splitChoice, setSplitChoice] = useState<"none" | "equal" | "custom">(
		"none",
	);
	const photoInputRef = useRef<HTMLInputElement | null>(null);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const mediaChunksRef = useRef<BlobPart[]>([]);

	const dummySnippetByLabel = useMemo(() => {
		const byLabel = new Map<string, string>();
		for (const snippet of PARSE_DUMMY_TEST_SNIPPETS) {
			byLabel.set(snippet.label, snippet.text);
		}
		return byLabel;
	}, []);

	const quickCaptureSuggestions = useMemo(
		() => [
			dummySnippetByLabel.get("Coffee / breakfast") ?? "Coffee 4.50",
			dummySnippetByLabel.get("Ride") ?? "Taxi home",
			dummySnippetByLabel.get("Subscription") ?? "Netflix subscription",
			dummySnippetByLabel.get("Multi-item lunch") ??
				"Lunch bowl and sparkling water",
			dummySnippetByLabel.get("Mega receipt (50 lines)") ??
				"mega receipt - wholesale club stress test; dummy parser emits 50 line items for UI",
			dummySnippetByLabel.get("RU · такси") ?? "такси до дома 500 рублей",
		],
		[dummySnippetByLabel],
	);

	useEffect(() => {
		if (!isParsingDraft) {
			setParseStep(0);
			return;
		}
		setParseStep(1);
		const id = window.setInterval(() => {
			setParseStep((prev) => (prev >= 3 ? 3 : prev + 1));
		}, 450);
		return () => window.clearInterval(id);
	}, [isParsingDraft]);

	const splitPreviewMembers = useMemo(() => {
		const primaryName = user?.name?.trim()?.split(/\s+/)[0] || "Vasiliy";
		// TODO: replace placeholder members with real selected-space members in dashboard context.
		return [primaryName, "Natalia", "Misha"];
	}, [user?.name]);

	const activeDraft = draftPreview ?? confirmedDraft;
	const equalSplitPreview = useMemo(() => {
		if (!activeDraft || splitChoice !== "equal") return [];
		const totalCents = Math.round(activeDraft.amount * 100);
		const count = Math.max(1, splitPreviewMembers.length);
		const base = Math.floor(totalCents / count);
		let remainder = totalCents - base * count;
		return splitPreviewMembers.map((member) => {
			const cents = base + (remainder > 0 ? 1 : 0);
			remainder = Math.max(0, remainder - 1);
			return { member, amount: cents / 100 };
		});
	}, [activeDraft, splitChoice, splitPreviewMembers]);

	useEffect(() => {
		let cancelled = false;
		setIsLoading(true);
		setLoadError(null);
		void (async () => {
			try {
				const res = await apiClient.dashboard.get({
					variant: "personal",
					period: "month",
				});
				if (!cancelled) {
					setDashboardData(res);
				}
			} catch (e) {
				if (!cancelled) {
					setLoadError(
						e instanceof Error ? e.message : "Failed to load home overview",
					);
				}
			} finally {
				if (!cancelled) setIsLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

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

	const spacesSorted = useMemo(() => {
		if (!spaces || spaces.length === 0) return [];
		return sortSpacesByLastActivity(spaces);
	}, [spaces]);

	const monthly = dashboardData?.monthly_snapshot ?? null;
	const pendingDrafts = dashboardData?.pending_drafts ?? [];
	const recentTx = dashboardData?.recent_transactions ?? [];
	const reviewQ = dashboardData?.review_queue ?? null;
	const recurringUpcoming = dashboardData?.recurring_upcoming ?? [];
	const spendOverview = dashboardData?.spend_overview;

	const monthlyTotal =
		monthly != null
			? typeof monthly.total_my_share === "number" &&
				!Number.isNaN(monthly.total_my_share)
				? monthly.total_my_share
				: monthly.total_spent
			: null;

	const reviewContextLine = useMemo(() => {
		const pendingSplits =
			reviewQ?.items?.filter(
				(item) =>
					typeof item === "object" &&
					item != null &&
					(item as { kind?: string }).kind === "expense_thread_approval",
			).length ?? 0;
		const dueSoonCount = recurringUpcoming.filter((item) => {
			const nextDue = Date.parse(item.next_due);
			if (!Number.isFinite(nextDue)) return false;
			const daysUntil = (nextDue - Date.now()) / (1000 * 60 * 60 * 24);
			return daysUntil >= 0 && daysUntil <= 7;
		}).length;

		if (pendingSplits > 0 && dueSoonCount > 0) {
			return `${pendingSplits} split${pendingSplits === 1 ? "" : "s"} and a bill need attention`;
		}
		if (pendingSplits > 0) {
			return "Splits need your attention";
		}
		if (dueSoonCount > 0) {
			return "A bill is due soon";
		}
		return "Splits and bills need attention";
	}, [reviewQ?.items, recurringUpcoming]);

	const newTransactionsContextLine = useMemo(() => {
		const todayCount = recentTx.filter((t) => {
			const d = new Date(t.occurred_at);
			return (
				Number.isFinite(d.getTime()) &&
				d.toDateString() === new Date().toDateString()
			);
		}).length;

		if (todayCount > 0) {
			return `+${todayCount} today`;
		}

		const fallback = recentTx[0]?.label
			? `Mostly ${normalizeLabel(recentTx[0].label, "groceries").toLowerCase()} this week`
			: "Mostly groceries this week";
		return fallback;
	}, [recentTx]);

	const reviewTopSpaces = useMemo(() => {
		const topSpaces = new Map<number, { name: string; count: number }>();
		for (const item of reviewQ?.items ?? []) {
			if (typeof item !== "object" || item == null) continue;
			const spaceId = (item as { space_id?: number }).space_id;
			const spaceName = (item as { space_name?: string }).space_name;
			if (
				typeof spaceId !== "number" ||
				!Number.isFinite(spaceId) ||
				!spaceName ||
				!spaceName.trim()
			) {
				continue;
			}
			const existing = topSpaces.get(spaceId);
			topSpaces.set(spaceId, {
				name: spaceName,
				count: (existing?.count ?? 0) + 1,
			});
		}
		for (const draft of pendingDrafts) {
			const spaceId = draft.space_id;
			const spaceName = draft.space_name?.trim();
			if (
				typeof spaceId !== "number" ||
				!Number.isFinite(spaceId) ||
				!spaceName
			) {
				continue;
			}
			const existing = topSpaces.get(spaceId);
			topSpaces.set(spaceId, {
				name: spaceName,
				count: (existing?.count ?? 0) + 1,
			});
		}
		return [...topSpaces.entries()]
			.sort((a, b) => b[1].count - a[1].count)
			.slice(0, 2)
			.map(([id, payload]) => ({ id, name: payload.name }));
	}, [reviewQ?.items, pendingDrafts]);

	const reviewPrimarySpaceId = useMemo(() => {
		return reviewTopSpaces[0]?.id ?? null;
	}, [reviewTopSpaces]);

	const transactionTopSpaces = useMemo(() => {
		const topSpaces = new Map<number, { name: string; count: number }>();
		for (const tx of recentTx) {
			if (typeof tx.space_id !== "number" || !Number.isFinite(tx.space_id)) {
				continue;
			}
			const spaceName = tx.space_name?.trim();
			if (!spaceName) continue;
			const existing = topSpaces.get(tx.space_id);
			topSpaces.set(tx.space_id, {
				name: spaceName,
				count: (existing?.count ?? 0) + 1,
			});
		}
		return [...topSpaces.entries()]
			.sort((a, b) => b[1].count - a[1].count)
			.slice(0, 2)
			.map(([id, payload]) => ({ id, name: payload.name }));
	}, [recentTx]);

	const recentActiveSpaceId = useMemo(() => {
		if (recentTx.length === 0) return null;
		const latest = [...recentTx].sort(
			(a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at),
		)[0];
		return typeof latest?.space_id === "number" ? latest.space_id : null;
	}, [recentTx]);

	const recentActivityItems = useMemo(() => {
		const txItems = recentTx.map((t) => ({
			amountLabel: formatMoney(t.amount),
			eventType: detectActivityType(t.label, t.status),
			id: `tx-${t.id}`,
			occurredAt: t.occurred_at,
			spaceName: normalizeSpaceName(
				t.space_name,
				t.space_id % friendlySpaceNameByIndex.length,
			),
			statusLabel: humanizeStatus(t.status, "Confirmed"),
			statusPillLabel: ["draft", "pending", "question", "review"].some(
				(token) => (t.status ?? "").toLowerCase().includes(token),
			)
				? humanizeStatus(t.status)
				: undefined,
			timeLabel: formatRelative(t.occurred_at),
			title: normalizeLabel(
				t.label,
				transactionLabelFallbacks[t.id % transactionLabelFallbacks.length] ??
					"Grocery run",
			),
			to: `/console/chat/thread?spaceId=${encodeURIComponent(String(t.space_id))}&expenseId=${encodeURIComponent(String(t.id))}`,
		}));

		const draftItems = pendingDrafts.map((draft) => {
			const detectedEventType = detectActivityType(draft.label, "draft");
			const draftEventType =
				detectedEventType === "receipt" ? "receipt" : "draft";
			const humanDraftStatus =
				draftEventType === "receipt" ? "Needs review" : "Not saved yet";
			return {
				amountLabel: formatMoney(
					typeof draft.my_share === "number" ? draft.my_share : draft.total,
				),
				eventType: draftEventType as "draft" | "receipt",
				id: `draft-${draft.id}`,
				occurredAt: draft.updated_at,
				spaceName: normalizeSpaceName(
					draft.space_name,
					draft.space_id % friendlySpaceNameByIndex.length,
				),
				statusLabel: humanDraftStatus,
				statusPillLabel: humanDraftStatus,
				timeLabel: formatRelative(draft.updated_at),
				title: normalizeLabel(draft.label, "Expense draft"),
				to: `/console/chat?spaceId=${encodeURIComponent(String(draft.space_id))}&view=activity`,
			};
		});

		const reviewItems = (reviewQ?.items ?? []).flatMap((item) => {
			if (
				typeof item !== "object" ||
				item == null ||
				(item as { kind?: string }).kind !== "expense_thread_approval"
			) {
				return [];
			}
			const approval = item as {
				expense_id: number;
				space_id: number;
				space_name: string;
				label: string;
				my_share: number;
				updated_at: string;
			};
			return [
				{
					amountLabel: formatMoney(approval.my_share),
					eventType: "split-assigned" as const,
					id: `review-${approval.expense_id}`,
					occurredAt: approval.updated_at,
					spaceName: normalizeSpaceName(
						approval.space_name,
						approval.space_id % friendlySpaceNameByIndex.length,
					),
					statusLabel: "Split review",
					statusPillLabel: "Review",
					timeLabel: formatRelative(approval.updated_at),
					title: normalizeLabel(approval.label, "Split approval"),
					to: `/console/chat/thread?spaceId=${encodeURIComponent(String(approval.space_id))}&expenseId=${encodeURIComponent(String(approval.expense_id))}`,
				},
			];
		});

		return [...txItems, ...draftItems, ...reviewItems]
			.sort(
				(a, b) =>
					Date.parse(b.occurredAt ?? "") - Date.parse(a.occurredAt ?? ""),
			)
			.slice(0, 6);
	}, [recentTx, pendingDrafts, reviewQ?.items, formatMoney]);

	const breakdownItems = useMemo(() => {
		const tags =
			spendOverview?.by_tag
				?.filter((item) => Number.isFinite(item.amount))
				.slice(0, 3)
				.map((item) => {
					const amountLabel = formatMoney(item.amount);
					const tone = getHeroChipTone(item.tag);
					if (monthlyTotal == null || monthlyTotal <= 0) {
						return { label: item.tag, detail: amountLabel, tone };
					}
					const share = Math.round((item.amount / monthlyTotal) * 100);
					return { label: item.tag, detail: `${share}%`, tone };
				}) ?? [];

		if (tags.length > 0) return tags;
		return [
			{ label: "Groceries", detail: "Core", tone: "food" as const },
			{ label: "Home & Bills", detail: "Steady", tone: "recurring" as const },
			{
				label: "Family Trip",
				detail: "Upcoming",
				tone: "uncategorized" as const,
			},
		];
	}, [spendOverview?.by_tag, monthlyTotal, formatMoney]);

	const breakdownStripSegments = useMemo(() => {
		const weighted = breakdownItems.map((item, index) => {
			const fromPct = Number.parseInt(item.detail.replace(/%/g, ""), 10);
			const value = Number.isFinite(fromPct)
				? fromPct
				: breakdownItems.length === 0
					? 0
					: Math.round(100 / breakdownItems.length);
			return {
				key: `${item.label}-${index}`,
				tone: item.tone,
				value,
			};
		});
		const total = weighted.reduce((sum, item) => sum + item.value, 0);
		if (total <= 0) return [];
		return weighted.map((item) => ({
			...item,
			width: `${Math.max(8, (item.value / total) * 100)}%`,
		}));
	}, [breakdownItems]);

	const insightText = useMemo(() => {
		if (monthly?.previous_period_my_share != null && monthlyTotal != null) {
			if (monthlyTotal < monthly.previous_period_my_share) {
				return "You're spending less than last month.";
			}
			if (monthlyTotal > monthly.previous_period_my_share) {
				return "Your household spending is steady this month.";
			}
		}

		const topItem = breakdownItems[0];
		if (!topItem) return "Your household spending is steady this month.";
		if (topItem.tone === "food") {
			return "Most of your spending is groceries this month.";
		}
		if (topItem.tone === "recurring") {
			return "Recurring payments are your main expense.";
		}
		return "Your household spending is steady this month.";
	}, [monthly?.previous_period_my_share, monthlyTotal, breakdownItems]);

	const captureTargetSpace = useMemo(() => {
		if (selectedSpaceId != null) {
			const sel = spacesSorted.find(
				(s) => String(s.id) === String(selectedSpaceId),
			);
			if (sel) return sel;
		}
		const defaultId = dashboardData?.quick_capture?.default_space_id;
		if (defaultId != null) {
			const def = spacesSorted.find((s) => String(s.id) === String(defaultId));
			if (def) return def;
		}
		return spacesSorted[0] ?? null;
	}, [
		selectedSpaceId,
		spacesSorted,
		dashboardData?.quick_capture?.default_space_id,
	]);

	const effectiveCaptureTarget = useMemo(() => {
		if (captureTargetSpace) return captureTargetSpace;
		const fallbackSpaces = dashboardData?.quick_capture?.spaces ?? [];
		if (fallbackSpaces.length === 0) return null;
		const defaultId = dashboardData?.quick_capture?.default_space_id;
		if (defaultId != null) {
			const preferred = fallbackSpaces.find(
				(s) => String(s.id) === String(defaultId),
			);
			if (preferred) return preferred;
		}
		return fallbackSpaces[0] ?? null;
	}, [
		captureTargetSpace,
		dashboardData?.quick_capture?.default_space_id,
		dashboardData?.quick_capture?.spaces,
	]);

	const parseDraftFromInput = (
		raw: string,
		source: QuickCaptureSource,
	): QuickCaptureDraft => {
		const normalized = raw.trim();
		const amountMatch = normalized.match(/(\d+(?:[.,]\d{1,2})?)/);
		const parsedAmount = Number.parseFloat(
			(amountMatch?.[1] ?? "0").replace(",", "."),
		);
		const amount =
			Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : 4.5;

		const cleanedTitle = normalized
			.replace(/(\d+(?:[.,]\d{1,2})?)/, "")
			.replace(/\s+/g, " ")
			.trim();

		const title = cleanedTitle.length > 0 ? cleanedTitle : "Coffee";
		const lower = normalized.toLowerCase();
		const category =
			lower.includes("taxi") || lower.includes("uber")
				? "Transport"
				: lower.includes("netflix") || lower.includes("subscription")
					? "Subscription"
					: "Food";
		const sourceLabel =
			source === "voice"
				? "Parsed from your voice note"
				: source === "receipt"
					? "Parsed from your receipt"
					: "Parsed from your text";
		return {
			title: title.charAt(0).toUpperCase() + title.slice(1),
			displayTitle: title.charAt(0).toUpperCase() + title.slice(1),
			amount,
			category,
			dateLabel: "Today",
			sourceLabel,
			lines: [{ name: title, amount }],
			itemCount: 1,
		};
	};

	const buildDisplayTitle = (
		rawTitle: string,
		itemCount: number,
		source: QuickCaptureSource,
	): string => {
		const normalized = rawTitle.trim();
		const lower = normalized.toLowerCase();
		const looksTechnical =
			/line\s*\d+|shelf item|dummy|stress test|mega receipt|wholesale club/.test(
				lower,
			);

		if (source === "receipt" && (itemCount > 5 || looksTechnical)) {
			if (lower.includes("grocer")) return "Grocery receipt";
			if (lower.includes("wholesale")) return "Wholesale receipt";
			return itemCount > 20 ? "Large receipt" : "Parsed receipt";
		}
		if (lower.includes("netflix")) return "Netflix subscription";
		if (lower.includes("uber") || lower.includes("taxi")) return "Ride";
		if (lower.includes("grocer")) return "Groceries";
		if (!/[a-zа-я]/i.test(normalized)) {
			return source === "receipt" ? "Receipt draft" : "Expense draft";
		}
		return normalized.charAt(0).toUpperCase() + normalized.slice(1);
	};

	const parseDraftFromApiItem = (
		expenseId: string | number | undefined,
		item: { name: string; amount: number; tags?: string[] },
		items: { name: string; amount: number; tags?: string[] }[],
		source: QuickCaptureSource,
		transcription?: string,
	): QuickCaptureDraft => {
		const sourceLabel =
			source === "voice"
				? "Parsed from your voice note"
				: source === "receipt"
					? "Parsed from your receipt"
					: "Parsed from your text";
		const rawTitle = item.name?.trim() || transcription?.trim() || "Expense";
		return {
			expenseId,
			title: rawTitle,
			displayTitle: buildDisplayTitle(rawTitle, items.length, source),
			amount: Number.isFinite(item.amount) ? item.amount : 0,
			category: item.tags?.[0] ?? "Uncategorized",
			dateLabel: "Today",
			sourceLabel,
			lines: items.slice(0, 3).map((it) => ({
				name: it.name,
				amount: it.amount,
			})),
			itemCount: items.length,
		};
	};

	const handleParseExpense = async (
		source: QuickCaptureSource,
		seedValue?: string,
	) => {
		if (!effectiveCaptureTarget) return;
		const sourceText =
			seedValue ??
			(source === "voice"
				? (dummySnippetByLabel.get("Ride") ?? "Taxi home")
				: source === "receipt"
					? (dummySnippetByLabel.get("Subscription") ??
						"Netflix subscription renewal")
					: captureInput);
		const trimmed = sourceText.trim();
		if (!trimmed) return;

		setCaptureError(null);
		setConfirmedDraft(null);
		setIsParsingDraft(true);
		setSelectedSpaceId(effectiveCaptureTarget.id);
		setCaptureInput(trimmed);
		const previewDelay = new Promise((resolve) =>
			setTimeout(resolve, PARSE_PREVIEW_DELAY_MS),
		);
		try {
			const parsedItems = await parseTextInSpace(
				effectiveCaptureTarget.id,
				trimmed,
			);
			const first = parsedItems[0];
			if (!first) {
				setCaptureError(
					"Nothing parsed from text - try adding amount and merchant.",
				);
				return;
			}
			const created = await createManualDraftInSpace(
				effectiveCaptureTarget.id,
				trimmed,
				parsedItems,
			);
			await previewDelay;
			const createdExpenseId = (
				created as { data?: { expense?: { id?: string | number } } }
			)?.data?.expense?.id;
			setDraftPreview(
				parseDraftFromApiItem(
					createdExpenseId,
					first,
					parsedItems,
					source,
					trimmed,
				),
			);
		} catch (err) {
			// Keep local fallback so quick capture remains usable if parser is unavailable.
			const fallbackDraft = parseDraftFromInput(trimmed, source);
			try {
				await createManualDraftInSpace(effectiveCaptureTarget.id, trimmed, [
					{
						name: fallbackDraft.title,
						amount: fallbackDraft.amount,
						tags: [fallbackDraft.category],
					},
				]);
				await previewDelay;
				setDraftPreview(fallbackDraft);
			} catch {
				setCaptureError(
					err instanceof Error ? err.message : "Could not parse this expense.",
				);
			}
		} finally {
			setIsParsingDraft(false);
		}
	};

	const handleConfirmDraft = () => {
		if (!effectiveCaptureTarget) return;
		if (!draftPreview) return;
		setConfirmedDraft(draftPreview);
		setDraftPreview(null);
	};

	const handleEditDraft = () => {
		if (!draftPreview) return;
		setCaptureInput(`${draftPreview.title} ${draftPreview.amount.toFixed(2)}`);
		setDraftPreview(null);
	};

	const handleDiscardDraft = () => {
		setDraftPreview(null);
		setConfirmedDraft(null);
		setCaptureError(null);
		setSplitChoice("none");
	};

	const handleAddAnother = () => {
		setCaptureInput("");
		setDraftPreview(null);
		setConfirmedDraft(null);
		setCaptureError(null);
		setSplitChoice("none");
	};

	const handlePhotoChange = async (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0] ?? null;
		event.target.value = "";
		if (!file || !effectiveCaptureTarget || isParsingDraft) return;
		setCaptureError(null);
		setConfirmedDraft(null);
		setIsParsingDraft(true);
		const previewDelay = new Promise((resolve) =>
			setTimeout(resolve, PARSE_PREVIEW_DELAY_MS),
		);
		try {
			const items = await parsePhotoInSpace(effectiveCaptureTarget.id, file);
			if (!items.length) {
				setCaptureError("Nothing parsed from this image - try another photo.");
				return;
			}
			const created = await createManualDraftInSpace(
				effectiveCaptureTarget.id,
				`Receipt: ${file.name}`,
				items,
			);
			await previewDelay;
			const createdExpenseId = (
				created as { data?: { expense?: { id?: string | number } } }
			)?.data?.expense?.id;
			setDraftPreview(
				parseDraftFromApiItem(createdExpenseId, items[0], items, "receipt"),
			);
		} catch (err) {
			setCaptureError(
				err instanceof Error ? err.message : "Could not parse this receipt.",
			);
		} finally {
			setIsParsingDraft(false);
		}
	};

	const handleVoiceToggle = async () => {
		if (!effectiveCaptureTarget || isParsingDraft) return;
		setCaptureError(null);
		setConfirmedDraft(null);
		if (!isRecordingVoice) {
			try {
				const stream = await navigator.mediaDevices.getUserMedia({
					audio: true,
				});
				const recorder = new MediaRecorder(stream);
				mediaRecorderRef.current = recorder;
				mediaChunksRef.current = [];
				recorder.addEventListener("dataavailable", (ev) => {
					if (ev.data?.size) mediaChunksRef.current.push(ev.data);
				});
				recorder.addEventListener(
					"stop",
					() => {
						for (const track of stream.getTracks()) {
							track.stop();
						}
					},
					{ once: true },
				);
				recorder.start();
				setIsRecordingVoice(true);
			} catch (err) {
				setCaptureError(
					err instanceof Error ? err.message : "Microphone permission denied.",
				);
			}
			return;
		}

		const recorder = mediaRecorderRef.current;
		if (!recorder || recorder.state !== "recording") return;
		const stopped = new Promise<void>((resolve) => {
			recorder.addEventListener("stop", () => resolve(), { once: true });
		});
		recorder.stop();
		await stopped;
		setIsRecordingVoice(false);

		const blob = new Blob(mediaChunksRef.current, {
			type: recorder.mimeType || "audio/webm",
		});
		mediaChunksRef.current = [];
		mediaRecorderRef.current = null;
		if (!blob.size) return;

		setIsParsingDraft(true);
		const previewDelay = new Promise((resolve) =>
			setTimeout(resolve, PARSE_PREVIEW_DELAY_MS),
		);
		try {
			const result = await parseVoiceInSpace(
				effectiveCaptureTarget.id,
				blob,
				recorder.mimeType || "audio/webm",
			);
			if (!result.items.length) {
				setCaptureError(
					"Nothing parsed from voice - try speaking amounts clearly.",
				);
				return;
			}
			const created = await createManualDraftInSpace(
				effectiveCaptureTarget.id,
				result.transcription.trim() || "Voice expense",
				result.items,
			);
			await previewDelay;
			const createdExpenseId = (
				created as { data?: { expense?: { id?: string | number } } }
			)?.data?.expense?.id;
			setCaptureInput(result.transcription || captureInput);
			setDraftPreview(
				parseDraftFromApiItem(
					createdExpenseId,
					result.items[0],
					result.items,
					"voice",
					result.transcription,
				),
			);
		} catch (err) {
			setCaptureError(
				err instanceof Error ? err.message : "Could not parse this voice note.",
			);
		} finally {
			setIsParsingDraft(false);
		}
	};

	return (
		<div className="flex min-h-0 w-full min-w-0 flex-1 overflow-hidden">
			<div className="scrollbar-editorial min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
				<div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8 lg:px-10 lg:py-10">
					<header className="flex flex-wrap items-end justify-between gap-4">
						<div className="min-w-0 max-w-full space-y-1.5">
							<p className={sectionEyebrow}>Household overview</p>
							<h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-[34px]">
								{user?.name?.trim()
									? `Welcome back, ${user.name.split(/\s+/)[0]}`
									: "Welcome back"}
							</h1>
							<p className="max-w-prose text-sm text-muted-foreground">
								Your shared spaces, bills, and spending in one place.
							</p>
						</div>
						<div className="flex shrink-0 items-center gap-2">
							<Link className={ghostButton} to="/console/spaces">
								Manage spaces
							</Link>
						</div>
					</header>

					{loadError ? (
						<div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
							{loadError}
						</div>
					) : null}

					<section
						aria-label="Summary this month"
						className="grid grid-cols-1 gap-5 lg:grid-cols-3"
					>
						<div className="lg:col-span-2">
							<OverviewHeroCard
								amount={monthlyTotal != null ? formatMoney(monthlyTotal) : "—"}
								chips={breakdownItems}
								eyebrow="Your shared money this month"
								insight={insightText}
								loading={isLoading}
								stripSegments={breakdownStripSegments}
								subtitle="Across your active spaces"
							/>
						</div>

						<div className="grid grid-cols-1 gap-4">
							<InsightMetricCard
								contextLine={reviewContextLine}
								label="Needs your review"
								loading={isLoading}
								spaceLinks={reviewTopSpaces}
								to={
									reviewPrimarySpaceId != null
										? `/console/review?spaceId=${encodeURIComponent(String(reviewPrimarySpaceId))}`
										: "/console/spaces"
								}
								tone="review"
								value={String(
									(reviewQ?.total_count ?? 0) + pendingDrafts.length,
								)}
							/>
							<InsightMetricCard
								contextLine={newTransactionsContextLine}
								label="New transactions"
								loading={isLoading}
								spaceLinks={transactionTopSpaces}
								to={
									recentActiveSpaceId != null
										? `/console/chat?spaceId=${encodeURIComponent(String(recentActiveSpaceId))}&view=activity`
										: "/console/spaces"
								}
								tone="activity"
								value={String(recentTx.length)}
							/>
						</div>
					</section>

					<QuickCaptureComposer
						errorText={captureError}
						helperText="Creates a draft in the selected space."
						inputPlaceholder="Describe an expense - Ceits will turn it into a draft..."
						inputValue={captureInput}
						onInputChange={setCaptureInput}
						onPrimaryAction={() => {
							void handleParseExpense("text");
						}}
						onReceiptAction={() => {
							photoInputRef.current?.click();
						}}
						onSuggestionClick={setCaptureInput}
						onVoiceAction={() => {
							void handleVoiceToggle();
						}}
						primaryDisabled={
							!effectiveCaptureTarget ||
							isParsingDraft ||
							isRecordingVoice ||
							captureInput.trim().length === 0
						}
						primaryTitle="Parse expense"
						receiptDisabled={!effectiveCaptureTarget || isParsingDraft}
						receiptTitle="Parse from receipt"
						statusContent={
							isParsingDraft ? (
								<div className="flex items-center gap-2 rounded-lg bg-[rgba(241,237,228,0.5)] px-3 py-2 text-[11px] text-[#6F746D]">
									<span
										aria-hidden
										className="h-2 w-2 animate-pulse rounded-full bg-[rgba(142,159,136,0.7)]"
									/>
									<span>Parsing expense...</span>
								</div>
							) : null
						}
						suggestions={quickCaptureSuggestions}
						targetSpaceName={effectiveCaptureTarget?.name ?? null}
						title="Parse a new expense"
						voiceDisabled={!effectiveCaptureTarget || isParsingDraft}
						voiceTitle={
							isRecordingVoice ? "Stop and parse voice" : "Parse from voice"
						}
					/>
					<input
						ref={photoInputRef}
						accept="image/*"
						capture="environment"
						className="sr-only"
						onChange={(event) => {
							void handlePhotoChange(event);
						}}
						type="file"
					/>

					<ActivityListCard
						ctaLabel="View history"
						ctaTo="/console/chat/expenses"
						emptyText="No activity yet"
						items={recentActivityItems}
						linkState={chatWorkspace ? { chatWorkspace } : undefined}
						title="Recent activity"
					/>

					{/* On smaller viewports the right rail content stacks here. */}
					<div className="xl:hidden">
						<OverviewRightRail
							chatWorkspace={chatWorkspace}
							dashboardData={dashboardData}
							formatMoney={formatMoney}
						/>
					</div>
				</div>
			</div>

			<aside
				aria-label="Household utility rail"
				className="hidden shrink-0 self-stretch flex-col border-l border-border/60 bg-muted/30 xl:flex xl:w-[20rem]"
			>
				<div className="min-h-0 flex-1 overflow-y-auto px-5 py-8">
					<OverviewRightRail
						chatWorkspace={chatWorkspace}
						dashboardData={dashboardData}
						formatMoney={formatMoney}
					/>
				</div>
			</aside>
			{isParsingDraft || activeDraft ? (
				<div className="fixed inset-0 z-40 flex items-end bg-[rgba(31,37,35,0.28)] backdrop-blur-[1px] sm:items-center sm:justify-center">
					<div className="w-full rounded-t-[20px] border border-[#E2DBCF] bg-[#F8F4EB] p-5 shadow-[0_24px_40px_-24px_rgba(31,37,35,0.55)] transition-all duration-300 sm:w-[min(52rem,96vw)] sm:rounded-[20px] sm:p-6">
						<div className="flex items-center justify-between gap-3">
							<div className="flex items-center gap-2">
								<span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[rgba(142,159,136,0.14)] text-[10px] font-semibold text-[#4F5D51]">
									C
								</span>
								<p className="text-[15px] font-semibold text-[#1F2523]">
									{isParsingDraft
										? "Reading your receipt..."
										: "Receipt parsed"}
								</p>
								{activeDraft ? (
									<span className="rounded-full bg-[rgba(142,159,136,0.12)] px-2 py-0.5 text-[10px] text-[#5A655C]">
										{confirmedDraft ? "Saved" : "Pending"}
									</span>
								) : null}
							</div>
							<button
								className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#D8D0C2] bg-[#FFFCF6] text-[#5C635D] transition-colors hover:bg-[#F2EEE5] hover:text-[#363D39]"
								onClick={() => {
									setDraftPreview(null);
									setConfirmedDraft(null);
								}}
								type="button"
							>
								×
							</button>
						</div>
						<p className="mt-2 text-[14px] leading-[1.5] text-[#5D645F]">
							{isParsingDraft
								? "Ceits is transforming your input into structure."
								: "Review what Ceits understood before saving."}
						</p>

						{isParsingDraft ? (
							<div className="mt-5 mx-auto max-w-2xl rounded-[12px] border border-[#E1DACC] bg-[#FFFCF6] p-6 shadow-[0_14px_28px_-22px_rgba(31,37,35,0.32)]">
								<div className="relative overflow-hidden rounded-[12px] border border-[#E3DCCC] bg-[#FFFFFF] px-5 py-8 shadow-[0_10px_24px_-20px_rgba(31,37,35,0.34)]">
									<div className="absolute inset-x-0 top-0 h-px border-t border-dashed border-[rgba(120,105,85,0.24)]" />
									<div className="absolute inset-x-0 bottom-0 h-px border-t border-dashed border-[rgba(120,105,85,0.24)]" />
									<div className="absolute inset-y-0 left-0 w-20 animate-pulse bg-[linear-gradient(90deg,rgba(255,255,255,0)_0%,rgba(142,159,136,0.22)_55%,rgba(255,255,255,0)_100%)]" />
									<div className="relative text-center">
										<span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(142,159,136,0.14)] text-[12px] font-semibold text-[#4F5D51]">
											C
										</span>
										<p className="mt-3 text-[15px] font-medium text-[#3E4742]">
											Reading receipt
										</p>
									</div>
								</div>
								<div className="mt-4 space-y-2 text-[14px] text-[#4F5651]">
									{[
										"Reading merchant and amount",
										"Detecting items",
										"Preparing draft and split",
									].map((step, idx) => (
										<div className="flex items-center gap-2" key={step}>
											<span
												aria-hidden
												className={`h-2 w-2 rounded-full ${
													parseStep > idx
														? "bg-[rgba(104,124,102,0.85)]"
														: "bg-[rgba(120,105,85,0.22)]"
												}`}
											/>
											<span>{step}</span>
										</div>
									))}
								</div>
							</div>
						) : null}

						{activeDraft ? (
							<div className="mt-4 mx-auto max-w-3xl">
								<div className="grid grid-cols-1 gap-5 sm:grid-cols-[1.18fr_0.82fr]">
									<div className="rounded-[12px] border border-[#E3DCCC] bg-[#FFFFFF] p-5 shadow-[0_16px_30px_-24px_rgba(31,37,35,0.35)]">
										<div
											aria-hidden
											className="mb-3 h-1.5 w-20 rounded-full bg-[rgba(224,195,146,0.45)]"
										/>
										<p className="text-[11px] uppercase tracking-[0.14em] text-[#737973]">
											CEITS RECEIPT
										</p>
										<p className="mt-1 text-[13px] text-[#616862]">
											Parsed draft
										</p>
										<div className="mt-3 flex items-start justify-between gap-3">
											<div className="min-w-0">
												<div className="flex items-center gap-2">
													<span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(142,159,136,0.12)] text-[11px] text-[#5B655E]">
														{activeDraft.displayTitle.charAt(0).toUpperCase()}
													</span>
													<p className="truncate font-display text-[22px] font-semibold leading-[1.15] text-[#1F2523]">
														{activeDraft.displayTitle}
													</p>
												</div>
												<p className="mt-2 text-[14px] text-[#4E5550]">
													{activeDraft.category} · {activeDraft.dateLabel}
												</p>
											</div>
											<div className="text-right">
												<p className="text-[34px] font-semibold leading-[1.05] text-[#1F2523]">
													{formatMoney(activeDraft.amount)}
												</p>
											</div>
										</div>
										<p className="mt-3 text-[14px] text-[#4E5550]">
											Draft will be saved in{" "}
											{effectiveCaptureTarget?.name ?? "Selected space"}
										</p>
										{confirmedDraft ? (
											<span className="mt-2 inline-flex rounded-full bg-[rgba(142,159,136,0.18)] px-2 py-0.5 text-[10px] font-semibold tracking-[0.08em] text-[#4A5A4C]">
												SAVED
											</span>
										) : null}

										<div className="mt-4 border-t border-dashed border-[rgba(120,105,85,0.22)] pt-4">
											<div className="grid grid-cols-2 gap-y-2 text-[14px]">
												<p className="text-[#5D645F]">Category</p>
												<p className="text-right text-[#1F2523]">
													{activeDraft.category}
												</p>
												<p className="text-[#5D645F]">Items</p>
												<p className="text-right text-[#1F2523]">
													{activeDraft.itemCount}
												</p>
												<p className="text-[#5D645F]">Confidence</p>
												<p className="text-right text-[#1F2523]">High</p>
												<p className="text-[#5D645F]">Space</p>
												<p className="text-right text-[#1F2523]">
													{effectiveCaptureTarget?.name ?? "Selected space"}
												</p>
											</div>
										</div>

										{activeDraft.itemCount > 1 ? (
											<div className="mt-4 border-t border-[rgba(120,105,85,0.14)] pt-4">
												<p className="text-[15px] font-medium text-[#3E4843]">
													Items parsed
												</p>
												<div className="mt-2 space-y-1.5">
													{activeDraft.lines.slice(0, 4).map((line, idx) => (
														<div
															className="flex items-center justify-between gap-2 text-[14px] text-[#4D544F]"
															key={`${line.name}-${idx}`}
														>
															<p className="truncate">
																{cleanReceiptItemName(line.name, idx)}
															</p>
															<p className="shrink-0">
																{formatMoney(line.amount)}
															</p>
														</div>
													))}
												</div>
												<button
													className="mt-3 text-[13px] text-[#3F4A44] underline decoration-[rgba(90,101,93,0.35)] underline-offset-2"
													onClick={() => {
														if (!effectiveCaptureTarget) return;
														const sid = String(effectiveCaptureTarget.id);
														if (activeDraft.expenseId != null) {
															navigate(
																`/console/chat/thread?spaceId=${encodeURIComponent(sid)}&expenseId=${encodeURIComponent(String(activeDraft.expenseId))}`,
															);
															return;
														}
														navigate(
															`/console/chat?spaceId=${encodeURIComponent(sid)}&view=activity`,
														);
													}}
													type="button"
												>
													Review all items{" "}
													{activeDraft.itemCount > activeDraft.lines.length
														? `· +${activeDraft.itemCount - activeDraft.lines.length} more`
														: ""}
												</button>
											</div>
										) : null}
									</div>

									<div className="rounded-[12px] border border-[#E3DCCC]/70 bg-[rgba(255,252,246,0.92)] p-4">
										<p className="text-[13px] uppercase tracking-[0.08em] text-[#787E78]">
											Pending draft
										</p>
										<p className="mt-2 text-[15px] font-medium text-[#3E4843]">
											{confirmedDraft
												? `Saved to ${effectiveCaptureTarget?.name ?? "selected space"}`
												: `Will be saved to ${effectiveCaptureTarget?.name ?? "selected space"}`}
										</p>

										<div className="mt-4">
											<p className="text-[14px] font-medium text-[#3E4843]">
												Space members
											</p>
											<div className="mt-2 space-y-1.5">
												{splitPreviewMembers.map((member) => (
													<div
														className="flex items-center justify-between text-[13px] text-[#4F5651]"
														key={member}
													>
														<p>{member}</p>
														<p>
															{splitChoice === "equal"
																? formatMoney(
																		equalSplitPreview.find(
																			(r) => r.member === member,
																		)?.amount ?? 0,
																	)
																: "Not assigned"}
														</p>
													</div>
												))}
											</div>
										</div>

										<div className="mt-4">
											<p className="text-[14px] font-medium text-[#3E4843]">
												Split
											</p>
											<div className="mt-2 inline-flex rounded-[10px] border border-[#DDD5C8] bg-[#FFFCF6] p-1">
												{[
													{ id: "none", label: "Not split" },
													{ id: "equal", label: "Equal" },
													{ id: "custom", label: "Custom" },
												].map((option) => (
													<button
														className={`rounded-[8px] px-3 py-1.5 text-[13px] transition-colors ${
															splitChoice === option.id
																? "bg-[rgba(142,159,136,0.2)] text-[#425047]"
																: "text-[#5F665F] hover:bg-[rgba(142,159,136,0.12)]"
														}`}
														key={option.id}
														onClick={() =>
															setSplitChoice(
																option.id as "none" | "equal" | "custom",
															)
														}
														type="button"
													>
														{option.label}
													</button>
												))}
											</div>
										</div>

										<div className="mt-5 flex flex-wrap items-center gap-2">
											{confirmedDraft ? (
												<>
													<button
														className="inline-flex h-11 items-center rounded-[11px] border border-[#D8D0C2] bg-[#FFFFFF] px-4 text-[14px] text-[#3F4B43] transition-colors hover:bg-[#F7F3EA]"
														onClick={() => {
															if (!effectiveCaptureTarget) return;
															const sid = String(effectiveCaptureTarget.id);
															if (confirmedDraft.expenseId != null) {
																navigate(
																	`/console/chat/thread?spaceId=${encodeURIComponent(sid)}&expenseId=${encodeURIComponent(String(confirmedDraft.expenseId))}`,
																);
																return;
															}
															navigate(
																`/console/chat?spaceId=${encodeURIComponent(sid)}&view=activity`,
															);
														}}
														type="button"
													>
														View in {effectiveCaptureTarget?.name ?? "space"}
													</button>
													<button
														className="inline-flex h-11 items-center rounded-[11px] border border-[#D8D0C2] bg-[#FFFFFF] px-4 text-[14px] text-[#4E5A52] transition-colors hover:bg-[#F7F3EA]"
														onClick={handleAddAnother}
														type="button"
													>
														Add another
													</button>
												</>
											) : (
												<>
													<button
														className="inline-flex h-11 items-center rounded-[11px] bg-[#26302D] px-4 text-[14px] font-medium text-[#F7F3EA] shadow-[0_4px_10px_-8px_rgba(31,37,35,0.55)] transition-colors hover:bg-[#2F3A36]"
														onClick={handleConfirmDraft}
														type="button"
													>
														Save draft
														{splitChoice !== "none" ? " with split" : ""}
													</button>
													<button
														className="inline-flex h-11 items-center rounded-[11px] border border-[#D8D0C2] bg-[#FFFFFF] px-4 text-[14px] text-[#4E5A52] transition-colors hover:bg-[#F7F3EA]"
														onClick={handleEditDraft}
														type="button"
													>
														Edit details
													</button>
													<button
														className="inline-flex h-11 items-center rounded-[11px] border border-[#D8D0C2] bg-[#FFFFFF] px-4 text-[14px] text-[#4E5A52] transition-colors hover:bg-[#F7F3EA]"
														onClick={() => {
															if (!effectiveCaptureTarget) return;
															const sid = String(effectiveCaptureTarget.id);
															if (activeDraft.expenseId != null) {
																navigate(
																	`/console/chat/thread?spaceId=${encodeURIComponent(sid)}&expenseId=${encodeURIComponent(String(activeDraft.expenseId))}`,
																);
																return;
															}
															navigate(
																`/console/chat?spaceId=${encodeURIComponent(sid)}&view=activity`,
															);
														}}
														type="button"
													>
														Review items
													</button>
													<button
														className="inline-flex h-11 items-center rounded-[11px] px-2 text-[14px] text-[#8A5A57] transition-colors hover:bg-[rgba(138,90,87,0.08)] hover:text-[#734A47]"
														onClick={handleDiscardDraft}
														type="button"
													>
														Discard
													</button>
												</>
											)}
										</div>
									</div>
								</div>
							</div>
						) : null}
					</div>
				</div>
			) : null}
		</div>
	);
};
