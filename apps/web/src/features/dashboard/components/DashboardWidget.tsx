import type { ReactNode } from "react";
import type { DashboardWidgetId } from "../dashboardWidgetIds";

export type DashboardWidgetState = "loading" | "empty" | "error" | "ready";

export type DashboardWidgetProps = {
	widgetId: DashboardWidgetId;
	title: string;
	description?: string;
	state?: DashboardWidgetState;
	emptyCopy?: string;
	errorCopy?: string;
	loadingLabel?: string;
	className?: string;
	/** Overrides default min-height on the main content region (e.g. compact widgets). */
	contentClassName?: string;
	/** Dark zinc shell for nested hero regions (drafts column beside capture). */
	variant?: "default" | "darkMuted";
	children?: ReactNode;
};

const stateContainerClass =
	"rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface))] p-5 shadow-sm";

const darkMutedContainerClass =
	"rounded-xl border border-white/10 bg-zinc-900/80 p-5 shadow-xl backdrop-blur-sm";

export const DashboardWidget = ({
	widgetId,
	title,
	description,
	state = "empty",
	emptyCopy = "No data yet.",
	errorCopy = "Something went wrong loading this widget.",
	loadingLabel = "Loading…",
	className = "",
	contentClassName,
	variant = "default",
	children,
}: DashboardWidgetProps) => {
	const titleId = `dashboard-widget-title-${widgetId}`;
	const descId = `dashboard-widget-desc-${widgetId}`;

	const shell =
		variant === "darkMuted"
			? [darkMutedContainerClass, "flex flex-col gap-3", className].join(" ")
			: [stateContainerClass, "flex flex-col gap-3", className].join(" ");

	const titleClass =
		variant === "darkMuted"
			? "text-sm font-semibold tracking-tight text-zinc-100"
			: "text-sm font-semibold tracking-tight text-[hsl(var(--text-primary))]";

	const descClass =
		variant === "darkMuted"
			? "text-xs text-zinc-400"
			: "text-xs text-[hsl(var(--text-secondary))]";

	const mutedClass =
		variant === "darkMuted"
			? "text-zinc-400"
			: "text-[hsl(var(--text-secondary))]";

	const readyWrapClass =
		variant === "darkMuted"
			? "text-zinc-100"
			: "text-[hsl(var(--text-primary))]";

	return (
		<section
			aria-labelledby={titleId}
			className={shell}
			data-widget-id={widgetId}
		>
			<header className="space-y-1">
				<h2 className={titleClass} id={titleId}>
					{title}
				</h2>
				{description ? (
					<p className={descClass} id={descId}>
						{description}
					</p>
				) : null}
			</header>

			<div
				aria-live="polite"
				className={contentClassName ?? "min-h-[4.5rem] flex-1 text-sm"}
			>
				{state === "loading" ? (
					<p aria-busy="true" className={mutedClass}>
						{loadingLabel}
					</p>
				) : null}
				{state === "empty" ? <p className={mutedClass}>{emptyCopy}</p> : null}
				{state === "error" ? (
					<p className="text-[hsl(var(--danger))]">{errorCopy}</p>
				) : null}
				{state === "ready" ? (
					<div className={readyWrapClass}>{children}</div>
				) : null}
			</div>
		</section>
	);
};
