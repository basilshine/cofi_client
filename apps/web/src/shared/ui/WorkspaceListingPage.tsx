import { type ReactNode, useEffect, useState } from "react";

type WorkspaceListingPageProps = {
	children: ReactNode;
	description?: ReactNode;
	headerActions?: ReactNode;
	stats?: ReactNode;
	title: string;
};

export const WorkspaceListingPage = ({
	children,
	description,
	headerActions,
	stats,
	title,
}: WorkspaceListingPageProps) => (
	<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
		<div className="shrink-0 border-b border-[rgba(120,100,80,0.12)] bg-[rgba(255,252,246,0.92)] px-4 py-4 sm:px-5">
			<div className="mx-auto flex max-w-5xl flex-col gap-3">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="min-w-0">
						<h1 className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
							{title}
						</h1>
						{description ? (
							<p className="mt-1 max-w-2xl text-sm leading-relaxed text-foreground/75">
								{description}
							</p>
						) : null}
					</div>
					{headerActions ? (
						<div className="flex shrink-0 flex-wrap items-center gap-2">
							{headerActions}
						</div>
					) : null}
				</div>
				{stats ? (
					<div className="flex flex-wrap gap-2 sm:gap-3">{stats}</div>
				) : null}
			</div>
		</div>
		{children}
	</div>
);

type WorkspaceSummaryChipProps = {
	accent?: "default" | "positive" | "attention" | "danger";
	label: string;
	value: ReactNode;
};

export const WorkspaceSummaryChip = ({
	accent = "default",
	label,
	value,
}: WorkspaceSummaryChipProps) => {
	const accentClass: Record<
		NonNullable<WorkspaceSummaryChipProps["accent"]>,
		string
	> = {
		attention: "text-[#7a5210]",
		danger: "text-[rgba(130,70,70,0.95)]",
		default: "text-muted-foreground",
		positive: "text-[#355a3c]",
	};
	const valueClass: Record<
		NonNullable<WorkspaceSummaryChipProps["accent"]>,
		string
	> = {
		attention: "text-[#5a3008]",
		danger: "text-[rgba(110,55,55,0.95)]",
		default: "text-foreground",
		positive: "text-[#2d4a32]",
	};

	return (
		<div className="inline-flex min-w-0 items-center gap-2 rounded-xl border border-[rgba(120,100,80,0.15)] bg-[rgba(255,252,246,0.65)] px-3 py-2 text-sm shadow-sm">
			<span
				className={`text-xs font-semibold uppercase tracking-wide ${accentClass[accent]}`}
			>
				{label}
			</span>
			<span className={`font-semibold tabular-nums ${valueClass[accent]}`}>
				{value}
			</span>
		</div>
	);
};

type WorkspaceFilterBarProps = {
	children: ReactNode;
	extraFilters?: ReactNode;
	isExtraOpen?: boolean;
	resultLabel?: ReactNode;
	search?: ReactNode;
	sort?: ReactNode;
};

export const WorkspaceFilterBar = ({
	children,
	extraFilters,
	isExtraOpen = false,
	resultLabel,
	search,
	sort,
}: WorkspaceFilterBarProps) => (
	<div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 pt-4 sm:px-5">
		<div className="flex flex-col gap-2 rounded-xl border border-[rgba(120,100,80,0.14)] bg-white/70 p-3 shadow-sm sm:p-3.5">
			<div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-3">
				{search ? <div className="min-w-0 flex-1">{search}</div> : null}
				<div className="flex flex-wrap items-center gap-2 lg:justify-end">
					{children}
					{sort ? (
						<>
							<div className="hidden h-8 w-px bg-[rgba(120,100,80,0.15)] sm:block" />
							{sort}
						</>
					) : null}
				</div>
			</div>
			{isExtraOpen && extraFilters ? (
				<div className="flex flex-wrap items-end gap-3 border-t border-[rgba(120,100,80,0.1)] pt-3">
					{extraFilters}
				</div>
			) : null}
			{resultLabel ? (
				<p className="text-xs text-muted-foreground">{resultLabel}</p>
			) : null}
		</div>
	</div>
);

export const workspaceControlClass =
	"h-9 rounded-lg border border-[rgba(120,100,80,0.22)] bg-[rgba(255,252,246,0.85)] px-2.5 text-sm text-foreground shadow-sm transition-colors duration-150 hover:border-[rgba(120,100,80,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export const workspaceSearchInputClass =
	"h-10 w-full rounded-lg border border-[rgba(120,100,80,0.22)] bg-[rgba(255,252,246,0.95)] px-3.5 text-sm text-foreground shadow-inner transition-colors duration-150 placeholder:text-muted-foreground focus-visible:border-[rgba(160,120,70,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

type WorkspaceListBodyProps = {
	children: ReactNode;
	error?: ReactNode;
};

export const WorkspaceListBody = ({
	children,
	error,
}: WorkspaceListBodyProps) => (
	<div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
		<div className="mx-auto max-w-5xl">
			{error ? (
				<div className="mb-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
					{error}
				</div>
			) : null}
			{children}
		</div>
	</div>
);

type WorkspaceIncrementalListProps<T> = {
	empty?: ReactNode;
	initialCount?: number;
	items: T[];
	renderItem: (item: T, index: number) => ReactNode;
	resetKey?: string | number;
	step?: number;
};

export const WorkspaceIncrementalList = <T,>({
	empty,
	initialCount = 20,
	items,
	renderItem,
	resetKey,
	step = 20,
}: WorkspaceIncrementalListProps<T>) => {
	const [visibleCount, setVisibleCount] = useState(initialCount);

	useEffect(() => {
		setVisibleCount(initialCount);
	}, [initialCount, resetKey]);

	if (items.length === 0) return <>{empty ?? null}</>;

	const visibleItems = items.slice(0, visibleCount);
	const remainingCount = Math.max(items.length - visibleItems.length, 0);

	return (
		<div className="space-y-3">
			{visibleItems.map((item, index) => renderItem(item, index))}
			{remainingCount > 0 ? (
				<div className="flex justify-center pt-1">
					<button
						className="inline-flex min-h-9 items-center rounded-full border border-[rgba(120,100,80,0.18)] bg-white/76 px-3.5 text-xs font-semibold text-foreground transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						onClick={() =>
							setVisibleCount((current) =>
								Math.min(items.length, current + step),
							)
						}
						type="button"
					>
						Show {Math.min(step, remainingCount)} more
					</button>
				</div>
			) : null}
		</div>
	);
};

type WorkspacePagedListProps<T> = {
	empty?: ReactNode;
	hasMore?: boolean;
	isLoadingMore?: boolean;
	items: T[];
	loadMoreLabel?: ReactNode;
	loadingMoreLabel?: ReactNode;
	onLoadMore?: () => void;
	renderItem: (item: T, index: number) => ReactNode;
};

export const WorkspacePagedList = <T,>({
	empty,
	hasMore = false,
	isLoadingMore = false,
	items,
	loadMoreLabel,
	loadingMoreLabel = "Loading more",
	onLoadMore,
	renderItem,
}: WorkspacePagedListProps<T>) => {
	if (items.length === 0) return <>{empty ?? null}</>;

	return (
		<div className="space-y-3">
			{items.map((item, index) => renderItem(item, index))}
			{hasMore && onLoadMore ? (
				<div className="flex justify-center pt-1">
					<button
						className="inline-flex min-h-9 items-center rounded-full border border-[rgba(120,100,80,0.18)] bg-white/76 px-3.5 text-xs font-semibold text-foreground transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-55"
						disabled={isLoadingMore}
						onClick={onLoadMore}
						type="button"
					>
						{isLoadingMore ? loadingMoreLabel : (loadMoreLabel ?? "Load more")}
					</button>
				</div>
			) : null}
		</div>
	);
};

type WorkspaceEntityCardTone = "default" | "attention" | "complete" | "muted";

type WorkspaceEntityCardProps = {
	ariaLabel?: string;
	ariaPressed?: boolean;
	children?: ReactNode;
	className?: string;
	contentClassName?: string;
	footer?: ReactNode;
	onClick?: () => void;
	selected?: boolean;
	summary: ReactNode;
	tone?: WorkspaceEntityCardTone;
};

const workspaceEntityCardToneClass: Record<
	WorkspaceEntityCardTone,
	{ body: string; expanded: string; interactive: string }
> = {
	attention: {
		body: "border-[rgba(181,131,52,0.24)] bg-[rgba(255,250,239,0.82)] hover:border-[rgba(181,131,52,0.38)] hover:bg-[rgba(255,250,239,0.95)]",
		expanded:
			"border-[rgba(181,131,52,0.18)] bg-[linear-gradient(180deg,rgba(255,252,246,0.9)_0%,rgba(250,245,237,0.76)_100%)]",
		interactive: "hover:bg-[rgba(181,131,52,0.055)]",
	},
	complete: {
		body: "border-[rgba(91,116,87,0.22)] bg-[rgba(248,252,247,0.72)] hover:border-[rgba(91,116,87,0.34)] hover:bg-[rgba(248,252,247,0.9)]",
		expanded:
			"border-[rgba(91,116,87,0.18)] bg-[linear-gradient(180deg,rgba(249,253,247,0.9)_0%,rgba(242,248,240,0.74)_100%)]",
		interactive: "hover:bg-[rgba(91,116,87,0.055)]",
	},
	default: {
		body: "border-[rgba(120,100,80,0.14)] bg-[rgba(255,252,246,0.76)] hover:border-[rgba(120,100,80,0.26)] hover:bg-[rgba(255,252,246,0.94)]",
		expanded:
			"border-[rgba(120,100,80,0.1)] bg-[linear-gradient(180deg,rgba(255,252,246,0.9)_0%,rgba(248,244,236,0.76)_100%)]",
		interactive: "hover:bg-[rgba(120,100,80,0.05)]",
	},
	muted: {
		body: "border-[rgba(120,100,80,0.1)] bg-[rgba(255,252,246,0.58)] opacity-[0.88] hover:border-[rgba(120,100,80,0.18)] hover:bg-[rgba(255,252,246,0.78)] hover:opacity-100",
		expanded:
			"border-[rgba(120,100,80,0.1)] bg-[linear-gradient(180deg,rgba(255,252,246,0.82)_0%,rgba(248,244,236,0.64)_100%)]",
		interactive: "hover:bg-[rgba(120,100,80,0.045)]",
	},
};

export const WorkspaceEntityCard = ({
	ariaLabel,
	ariaPressed,
	children,
	className,
	contentClassName,
	footer,
	onClick,
	selected = false,
	summary,
	tone = "default",
}: WorkspaceEntityCardProps) => {
	const toneClass = workspaceEntityCardToneClass[tone];
	const bodyClass = selected
		? tone === "complete"
			? "border-[rgba(91,116,87,0.42)] bg-[rgba(247,252,246,0.96)] shadow-[0_16px_42px_-34px_rgba(43,77,47,0.48)] ring-2 ring-[rgba(91,116,87,0.14)]"
			: tone === "attention"
				? "border-[rgba(181,131,52,0.42)] bg-[rgba(255,250,239,0.96)] shadow-[0_18px_46px_-32px_rgba(84,57,21,0.52)] ring-2 ring-[rgba(200,155,95,0.2)]"
				: "border-[rgba(160,120,70,0.42)] bg-[rgba(255,252,246,0.98)] shadow-[0_14px_38px_-28px_rgba(70,48,24,0.28)] ring-2 ring-[rgba(200,155,95,0.16)]"
		: toneClass.body;
	const summaryClass = [
		"block w-full px-4 py-3 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
		onClick ? toneClass.interactive : "",
		contentClassName ?? "",
	]
		.filter(Boolean)
		.join(" ");

	return (
		<div
			className={[
				"overflow-hidden rounded-[1.35rem] border shadow-[0_14px_38px_-34px_rgba(44,32,18,0.48)] transition-[border-color,background-color,box-shadow,opacity]",
				bodyClass,
				className ?? "",
			]
				.filter(Boolean)
				.join(" ")}
		>
			{onClick ? (
				<button
					aria-label={ariaLabel}
					aria-pressed={ariaPressed}
					className={summaryClass}
					onClick={onClick}
					type="button"
				>
					{summary}
				</button>
			) : (
				<div className={summaryClass}>{summary}</div>
			)}
			{children ? (
				<div className={["border-t px-4 py-4", toneClass.expanded].join(" ")}>
					{children}
				</div>
			) : null}
			{footer ? (
				<div className="border-t border-[rgba(120,100,80,0.08)] bg-[rgba(255,252,246,0.58)] px-3 py-2 sm:px-4">
					{footer}
				</div>
			) : null}
		</div>
	);
};
