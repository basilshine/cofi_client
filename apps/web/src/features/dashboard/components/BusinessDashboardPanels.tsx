import type {
	DashboardActivityItem,
	DashboardExpenseThreadApprovalItem,
	DashboardOrgSnapshot,
	DashboardReviewQueue,
	DashboardReviewQueueItem,
	DashboardSpendOverview,
} from "@cofi/api";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { UnknownRecordBlock } from "./UnknownRecordBlock";

export const OrgSnapshotPanel = ({
	org,
}: {
	org: NonNullable<DashboardOrgSnapshot>;
}): ReactNode => (
	<div className="space-y-2">
		<div className="flex flex-wrap items-baseline gap-2">
			<p className="text-lg font-semibold text-[hsl(var(--text-primary))]">
				{org.name}
			</p>
			<span className="rounded-full border border-emerald-600/40 bg-emerald-600/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
				{org.type}
			</span>
		</div>
		<p className="text-xs text-[hsl(var(--text-secondary))]">
			Organization #{org.id}
		</p>
	</div>
);

const normalizeSpendOverview = (
	raw: DashboardSpendOverview,
): {
	period?: { start: string; end: string };
	by_tag: { tag: string; amount: number }[];
} | null => {
	if (raw == null) return null;
	const byTag = Array.isArray(raw.by_tag) ? raw.by_tag : [];
	return { period: raw.period ?? undefined, by_tag: byTag };
};

export const SpendByTagPanel = ({
	spend,
	currency,
	formatCurrencyAmount,
	formatDateLabel,
}: {
	spend: NonNullable<DashboardSpendOverview>;
	currency: string;
	formatCurrencyAmount: (amount: number, cur: string) => string;
	formatDateLabel: (iso: string) => string;
}): ReactNode => {
	const normalized = normalizeSpendOverview(spend);
	if (!normalized) return null;
	const sorted = [...normalized.by_tag].sort((a, b) => b.amount - a.amount);
	const max = Math.max(...sorted.map((r) => r.amount), 1);

	return (
		<div className="space-y-3">
			{normalized.period ? (
				<p className="text-xs text-[hsl(var(--text-secondary))]">
					{formatDateLabel(normalized.period.start)} –{" "}
					{formatDateLabel(normalized.period.end)}
				</p>
			) : null}
			{sorted.length === 0 ? (
				<p className="text-sm text-[hsl(var(--text-secondary))]">
					No tagged spend recorded this month yet.
				</p>
			) : (
				<ul className="space-y-2.5">
					{sorted.map((row) => (
						<li key={row.tag || "__untagged"}>
							<div className="flex justify-between gap-2 text-xs">
								<span className="min-w-0 truncate font-medium text-[hsl(var(--text-primary))]">
									{row.tag?.trim() ? row.tag : "Untagged"}
								</span>
								<span className="shrink-0 tabular-nums text-[hsl(var(--text-primary))]">
									{formatCurrencyAmount(row.amount, currency)}
								</span>
							</div>
							<div
								aria-hidden
								className="mt-1 h-1.5 overflow-hidden rounded-full bg-[hsl(var(--surface-muted))]"
							>
								<div
									className="h-full rounded-full bg-emerald-600/80 dark:bg-emerald-500/65"
									style={{
										width: `${Math.min(100, (row.amount / max) * 100)}%`,
									}}
								/>
							</div>
						</li>
					))}
				</ul>
			)}
		</div>
	);
};

const formatActivityWhen = (iso: string): string => {
	try {
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return iso;
		return d.toLocaleString(undefined, {
			dateStyle: "medium",
			timeStyle: "short",
		});
	} catch {
		return iso;
	}
};

export const RecentActivityPanel = ({
	items,
	chatNavState,
}: {
	items: DashboardActivityItem[];
	chatNavState: (extra: Record<string, unknown>) => Record<string, unknown>;
}): ReactNode => (
	<ul className="space-y-2">
		{items.map((item, i) => (
			<li key={`${item.space_id}-${item.timestamp}-${i}`}>
				<Link
					className="flex flex-col rounded-md border border-[hsl(var(--border-subtle))] px-3 py-2 text-left text-xs transition hover:bg-[hsl(var(--surface-muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--bg))]"
					state={chatNavState({ selectSpaceId: item.space_id })}
					to="/console/chat"
				>
					<span className="font-medium text-[hsl(var(--text-primary))]">
						{item.caption?.trim() ? item.caption : "Activity"}
					</span>
					<span className="mt-0.5 text-[hsl(var(--text-secondary))]">
						{item.space_name?.trim()
							? item.space_name
							: `Space ${item.space_id}`}{" "}
						· {formatActivityWhen(item.timestamp)}
					</span>
				</Link>
			</li>
		))}
	</ul>
);

const isExpenseThreadApprovalItem = (
	item: DashboardReviewQueueItem,
): item is DashboardExpenseThreadApprovalItem =>
	item != null &&
	typeof item === "object" &&
	!Array.isArray(item) &&
	(item as { kind?: unknown }).kind === "expense_thread_approval";

const reviewItemBody = (
	item: DashboardReviewQueueItem,
	chatNavState: (extra: Record<string, unknown>) => Record<string, unknown>,
	formatCurrencyAmount: (amount: number, cur: string) => string,
	formatDateLabel: (iso: string) => string,
	fallbackCurrency: string,
): ReactNode => {
	if (isExpenseThreadApprovalItem(item)) {
		const cur =
			typeof item.currency === "string" && item.currency.trim() !== ""
				? item.currency
				: fallbackCurrency;
		return (
			<Link
				className="flex flex-col gap-0.5 rounded-md text-left transition hover:bg-[hsl(var(--surface-muted))]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--bg))]"
				state={chatNavState({
					openThreadExpenseId: item.expense_id,
					openThreadSpaceId: item.space_id,
					selectSpaceId: item.space_id,
				})}
				to="/console/chat"
			>
				<span className="font-medium text-[hsl(var(--text-primary))]">
					{item.label?.trim() ? item.label : "Expense"}
				</span>
				<span className="text-xs text-[hsl(var(--text-secondary))]">
					{item.space_name?.trim() ? item.space_name : `Space ${item.space_id}`}{" "}
					· Total {formatCurrencyAmount(item.total, cur)}
					{item.my_share > 0
						? ` · Your share ${formatCurrencyAmount(item.my_share, cur)}`
						: null}
				</span>
				<span className="text-[10px] text-[hsl(var(--text-secondary))]">
					Approve in thread · Updated {formatDateLabel(item.updated_at)}
				</span>
			</Link>
		);
	}
	if (item != null && typeof item === "object" && !Array.isArray(item)) {
		return <UnknownRecordBlock value={item as Record<string, unknown>} />;
	}
	return (
		<span className="font-sans text-[hsl(var(--text-primary))]">
			{String(item)}
		</span>
	);
};

const reviewQueueItemKey = (item: DashboardReviewQueueItem): string => {
	if (isExpenseThreadApprovalItem(item)) {
		return `thread-approval-${item.thread_id}-${item.expense_id}`;
	}
	if (item != null && typeof item === "object" && !Array.isArray(item)) {
		const o = item as Record<string, unknown>;
		const id = o.id ?? o.expense_id;
		if (typeof id === "number" || typeof id === "string") {
			return `review-${id}`;
		}
	}
	try {
		return `review-${JSON.stringify(item)}`;
	} catch {
		return `review-${String(item)}`;
	}
};

export const ReviewQueuePanel = ({
	queue,
	chatNavState,
	currency,
	formatCurrencyAmount,
	formatDateLabel,
}: {
	queue: DashboardReviewQueue;
	chatNavState: (extra: Record<string, unknown>) => Record<string, unknown>;
	currency: string;
	formatCurrencyAmount: (amount: number, cur: string) => string;
	formatDateLabel: (iso: string) => string;
}): ReactNode => {
	if (queue.total_count > 0 && queue.items.length === 0) {
		return (
			<div className="space-y-2 text-sm text-[hsl(var(--text-secondary))]">
				<p>
					{queue.total_count} item{queue.total_count === 1 ? "" : "s"} queued
					for review. Open Ceits chat to continue.
				</p>
				<Link
					className="inline-flex text-xs font-medium text-[hsl(var(--accent))] underline underline-offset-2"
					to="/console/chat"
				>
					Open chat
				</Link>
			</div>
		);
	}

	if (queue.items.length === 0) {
		return null;
	}

	return (
		<ul className="space-y-2">
			{queue.items.map((item) => (
				<li
					className="rounded-md border border-[hsl(var(--border-subtle))] px-3 py-2"
					key={reviewQueueItemKey(item)}
				>
					{reviewItemBody(
						item,
						chatNavState,
						formatCurrencyAmount,
						formatDateLabel,
						currency,
					)}
				</li>
			))}
		</ul>
	);
};

export const isActivityItem = (v: unknown): v is DashboardActivityItem => {
	if (v == null || typeof v !== "object") return false;
	const o = v as Record<string, unknown>;
	return (
		typeof o.caption === "string" &&
		typeof o.timestamp === "string" &&
		typeof o.space_name === "string" &&
		typeof o.space_id === "number"
	);
};

export const normalizeActivityItems = (
	raw: unknown[] | undefined,
): DashboardActivityItem[] => {
	if (!raw?.length) return [];
	return raw.filter(isActivityItem);
};
