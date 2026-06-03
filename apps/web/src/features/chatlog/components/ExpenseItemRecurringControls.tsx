import {
	STANDARD_RECURRING_INTERVALS,
	type StandardRecurringInterval,
	TEST_RECURRING_INTERVALS,
} from "@cofi/api";

const showTestRecurringIntervals = () =>
	import.meta.env.DEV ||
	import.meta.env.VITE_RECURRING_TEST_INTERVALS === "true" ||
	import.meta.env.VITE_RECURRING_TEST_INTERVALS === "1";

const recurringIntervalChoices = (): StandardRecurringInterval[] =>
	showTestRecurringIntervals()
		? [...STANDARD_RECURRING_INTERVALS, ...TEST_RECURRING_INTERVALS]
		: [...STANDARD_RECURRING_INTERVALS];

type Props = {
	disabled?: boolean;
	enabled: boolean;
	onEnabledChange: (value: boolean) => void;
	interval: StandardRecurringInterval;
	onIntervalChange: (value: StandardRecurringInterval) => void;
	/** Unique id prefix for a11y (e.g. item id) */
	idPrefix: string;
	/** Narrow sidebars: one control per row, full-width interval select */
	variant?: "default" | "panel";
};

/** Per expense line: optional recurring schedule (not the whole expense). */
export const ExpenseItemRecurringControls = ({
	disabled = false,
	enabled,
	onEnabledChange,
	interval,
	onIntervalChange,
	idPrefix,
	variant = "default",
}: Props) => {
	const selId = `${idPrefix}-recurring-interval`;
	const intervals = recurringIntervalChoices();
	const testIntervalsVisible = showTestRecurringIntervals();
	const isPanel = variant === "panel";

	return (
		<div
			className={
				isPanel
					? "mt-2 rounded-lg border border-primary/20 bg-primary/[0.04] p-2.5"
					: "mt-2 flex flex-col gap-2 border-t border-border/60 pt-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3"
			}
		>
			<div className="flex min-w-0 items-center justify-between gap-2">
				<div className="min-w-0">
					<p className="text-[11px] font-semibold text-foreground">
						Recurring for this line
					</p>
					<p className="text-[10px] text-muted-foreground">
						Create schedule after draft confirmation.
					</p>
				</div>
				<button
					aria-pressed={enabled}
					className={
						enabled
							? "inline-flex h-8 items-center rounded-md border border-primary/50 bg-primary/15 px-3 text-[11px] font-semibold text-primary transition hover:bg-primary/20 disabled:opacity-50"
							: "inline-flex h-8 items-center rounded-md border border-border bg-background px-3 text-[11px] font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-50"
					}
					disabled={disabled}
					onClick={() => onEnabledChange(!enabled)}
					type="button"
				>
					{enabled ? "Enabled" : "Enable"}
				</button>
			</div>
			<p className="sr-only" id={`${idPrefix}-recurring-hint`}>
				When checked, a repeating schedule is created for this line only after
				you confirm the draft.
			</p>
			{enabled ? (
				<div
					className={
						isPanel
							? "mt-2 flex min-w-0 flex-col gap-1.5"
							: "flex min-w-0 flex-col gap-1 sm:flex-1"
					}
				>
					<label
						className={
							isPanel
								? "flex min-w-0 flex-col gap-1"
								: "flex flex-wrap items-center gap-2"
						}
						htmlFor={selId}
					>
						<span className="text-[11px] text-muted-foreground">Every</span>
						<select
							aria-label="Recurring interval for this line"
							className={
								isPanel
									? "h-9 w-full min-w-0 rounded-md border border-border bg-background px-2 text-xs shadow-sm"
									: "h-8 max-w-[14rem] rounded-md border border-border bg-background px-2 text-xs"
							}
							disabled={disabled}
							id={selId}
							onChange={(e) =>
								onIntervalChange(e.target.value as StandardRecurringInterval)
							}
							value={intervals.includes(interval) ? interval : intervals[0]}
						>
							{intervals.map((v) => (
								<option key={v} value={v}>
									{v === "minute"
										? "minute (test)"
										: v === "test"
											? "test (30s, dev)"
											: v}
								</option>
							))}
						</select>
					</label>
					{testIntervalsVisible ? (
						<p className="text-[10px] leading-snug text-muted-foreground">
							Test cadences need the server to allow them (e.g. development or{" "}
							<code className="rounded bg-muted px-0.5">
								RECURRING_ALLOW_TEST_INTERVALS
							</code>
							).
						</p>
					) : null}
				</div>
			) : null}
		</div>
	);
};
