import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "cofi.workspaceRightSidebar.expandedWidthPx";
const DEFAULT_VIEWPORT_RATIO = 0.4;
const MIN_WIDTH_PX = 260;
const MAX_VIEWPORT_RATIO = 0.78;

const IconPanelOpen = ({ className }: { className?: string }) => (
	<svg
		aria-hidden
		className={className}
		fill="none"
		height="18"
		stroke="currentColor"
		strokeWidth="2"
		viewBox="0 0 24 24"
		width="18"
	>
		<title>Expand panel</title>
		<path
			d="M15 4H9a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h6M9 12h10M6 8l-4 4 4 4"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</svg>
);

const IconPanelClose = ({ className }: { className?: string }) => (
	<svg
		aria-hidden
		className={className}
		fill="none"
		height="18"
		stroke="currentColor"
		strokeWidth="2"
		viewBox="0 0 24 24"
		width="18"
	>
		<title>Collapse panel</title>
		<path
			d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4M15 12H9M18 8l4 4-4 4"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</svg>
);

const IconReceipt = ({ className }: { className?: string }) => (
	<svg
		aria-hidden
		className={className}
		fill="none"
		height="18"
		stroke="currentColor"
		strokeWidth="2"
		viewBox="0 0 24 24"
		width="18"
	>
		<title>Expenses</title>
		<path
			d="M9 5h6l4 4v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
		<path d="M9 9h6M9 13h4" strokeLinecap="round" />
	</svg>
);

const maxWidthPx = () =>
	Math.max(
		MIN_WIDTH_PX,
		Math.floor(
			(typeof window !== "undefined" ? window.innerWidth : 1200) *
				MAX_VIEWPORT_RATIO,
		),
	);

const clampWidth = (w: number) =>
	Math.min(maxWidthPx(), Math.max(MIN_WIDTH_PX, Math.round(w)));

const readStoredWidthPx = (): number | null => {
	if (typeof window === "undefined") return null;
	const raw = window.localStorage.getItem(STORAGE_KEY);
	if (raw == null) return null;
	const n = Number.parseInt(raw, 10);
	if (!Number.isFinite(n)) return null;
	return clampWidth(n);
};

const defaultWidthPx = () =>
	clampWidth(
		Math.round(
			(typeof window !== "undefined" ? window.innerWidth : 1200) *
				DEFAULT_VIEWPORT_RATIO,
		),
	);

export type WorkspaceRightSidebarProps = {
	expanded: boolean;
	onExpandedChange: (next: boolean) => void;
	title: string;
	children: ReactNode;
	/** Stronger focus on this rail (e.g. expense workspace edit). */
	workSurfaceActive?: boolean;
};

export const WorkspaceRightSidebar = ({
	expanded,
	onExpandedChange,
	title,
	children,
	workSurfaceActive = false,
}: WorkspaceRightSidebarProps) => {
	const [expandedWidthPx, setExpandedWidthPx] = useState(() => {
		const stored = readStoredWidthPx();
		if (stored != null) return stored;
		return defaultWidthPx();
	});
	const [isResizing, setIsResizing] = useState(false);
	const widthDuringDragRef = useRef(expandedWidthPx);
	const resizeStartXRef = useRef(0);
	const resizeStartWidthRef = useRef(expandedWidthPx);
	useEffect(() => {
		widthDuringDragRef.current = expandedWidthPx;
	}, [expandedWidthPx]);

	const persistWidth = useCallback((w: number) => {
		const c = clampWidth(w);
		widthDuringDragRef.current = c;
		if (typeof window !== "undefined") {
			window.localStorage.setItem(STORAGE_KEY, String(c));
		}
		setExpandedWidthPx(c);
	}, []);

	useEffect(() => {
		const onResize = () => {
			setExpandedWidthPx((prev) => clampWidth(prev));
		};
		window.addEventListener("resize", onResize);
		return () => window.removeEventListener("resize", onResize);
	}, []);

	const handleResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
		if (!expanded) return;
		e.preventDefault();
		resizeStartXRef.current = e.clientX;
		resizeStartWidthRef.current = widthDuringDragRef.current;
		setIsResizing(true);
		e.currentTarget.setPointerCapture(e.pointerId);
	};

	const handleResizePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
		if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
		const dx = e.clientX - resizeStartXRef.current;
		const next = clampWidth(resizeStartWidthRef.current - dx);
		widthDuringDragRef.current = next;
		setExpandedWidthPx(next);
	};

	const handleResizePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
		if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
		e.currentTarget.releasePointerCapture(e.pointerId);
		setIsResizing(false);
		persistWidth(widthDuringDragRef.current);
	};

	const maxVal = maxWidthPx();

	return (
		<aside
			className={[
				"relative flex min-h-0 shrink-0 flex-col self-stretch border-l border-border/80 bg-muted/15",
				workSurfaceActive
					? "z-10 shadow-[8px_0_32px_-12px_rgba(0,0,0,0.2)] ring-1 ring-amber-400/30 dark:ring-amber-600/35"
					: "",
				expanded
					? isResizing
						? ""
						: "transition-[width] duration-200 ease-out"
					: "w-full max-w-[4.5rem] transition-[width,max-width] duration-200 ease-out lg:w-[4.5rem]",
			].join(" ")}
			style={
				expanded
					? {
							width: expandedWidthPx,
							minWidth: MIN_WIDTH_PX,
							maxWidth: maxVal,
						}
					: undefined
			}
		>
			{expanded ? (
				<>
					{/* Sibling of overflow-hidden panel so the grip is not clipped */}
					<div
						aria-label={`Resize ${title} panel`}
						aria-orientation="vertical"
						aria-valuemax={maxVal}
						aria-valuemin={MIN_WIDTH_PX}
						aria-valuenow={expandedWidthPx}
						className="group absolute left-0 top-0 z-30 flex h-full w-5 -translate-x-1/2 cursor-col-resize touch-none select-none items-center justify-center bg-gradient-to-r from-transparent via-muted/35 to-transparent hover:via-muted/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:via-primary/15"
						onKeyDown={(e) => {
							const step = e.shiftKey ? 40 : 16;
							if (e.key === "ArrowLeft") {
								e.preventDefault();
								setExpandedWidthPx((prev) => {
									const next = clampWidth(prev + step);
									if (typeof window !== "undefined") {
										window.localStorage.setItem(STORAGE_KEY, String(next));
									}
									widthDuringDragRef.current = next;
									return next;
								});
							}
							if (e.key === "ArrowRight") {
								e.preventDefault();
								setExpandedWidthPx((prev) => {
									const next = clampWidth(prev - step);
									if (typeof window !== "undefined") {
										window.localStorage.setItem(STORAGE_KEY, String(next));
									}
									widthDuringDragRef.current = next;
									return next;
								});
							}
						}}
						onPointerCancel={handleResizePointerUp}
						onPointerDown={handleResizePointerDown}
						onPointerMove={handleResizePointerMove}
						onPointerUp={handleResizePointerUp}
						role="separator"
						tabIndex={0}
					>
						<span
							aria-hidden
							className="pointer-events-none block h-full min-h-[10rem] w-[2px] shrink-0 rounded-full bg-muted-foreground/45 shadow-[0_0_0_1px_hsl(var(--border))] ring-1 ring-border transition-[width,background-color,box-shadow] group-hover:w-[3px] group-hover:bg-primary group-hover:shadow-[0_0_0_1px_hsl(var(--primary)/0.5)] group-hover:ring-primary/40 group-active:bg-primary"
						/>
					</div>
					<div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
						<div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 bg-muted/10 px-3 py-2.5 pl-2">
							<div className="min-w-0 truncate text-sm font-semibold tracking-tight">
								{title}
							</div>
							<button
								aria-expanded={expanded}
								aria-label="Collapse expenses panel"
								className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-muted/40 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
								onClick={() => onExpandedChange(false)}
								type="button"
							>
								<IconPanelClose className="h-4 w-4" />
							</button>
						</div>
						<div className="scrollbar-chat min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
							{children}
						</div>
					</div>
				</>
			) : (
				<div className="flex min-h-0 flex-1 flex-col items-center gap-3 py-2">
					<button
						aria-label={`Expand ${title}`}
						className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/80 bg-muted/50 text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						onClick={() => onExpandedChange(true)}
						type="button"
					>
						<IconPanelOpen className="h-4 w-4" />
					</button>
					<div className="h-px w-8 shrink-0 bg-gradient-to-r from-transparent via-border to-transparent" />
					<button
						aria-label={`${title} — expand to browse`}
						className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background text-muted-foreground shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						onClick={() => onExpandedChange(true)}
						title={title}
						type="button"
					>
						<IconReceipt className="h-4 w-4" />
					</button>
				</div>
			)}
		</aside>
	);
};
