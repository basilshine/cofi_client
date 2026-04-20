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
	variant?: "default" | "thread";
};

/** Per expense line: optional recurring schedule (not the whole transaction). */
export const ExpenseItemRecurringControls = ({
	disabled = false,
	enabled,
	onEnabledChange,
	interval,
	onIntervalChange,
	idPrefix,
	variant = "default",
}: Props) => {
	const cbId = `${idPrefix}-recurring-cb`;
	const selId = `${idPrefix}-recurring-interval`;
	const intervals = recurringIntervalChoices();
	const testIntervalsVisible = showTestRecurringIntervals();
	const isThread = variant === "thread";

	return (
		<div
			className={
				isThread
					? "mt-2 flex flex-col gap-2 border-t border-border/60 pt-2"
					: "mt-2 flex flex-col gap-2 border-t border-border/60 pt-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3"
			}
		>
			<div className="flex min-w-0 items-start gap-2">
				<input
					aria-describedby={`${cbId}-hint`}
					checked={enabled}
					className="mt-0.5 h-4 w-4 shrink-0 rounded border-border"
					disabled={disabled}
					id={cbId}
					onChange={(e) => onEnabledChange(e.target.checked)}
					type="checkbox"
				/>
				<label
					className={
						isThread
							? "min-w-0 flex-1 text-[11px] font-medium leading-snug text-foreground"
							: "text-[11px] font-medium text-foreground"
					}
					htmlFor={cbId}
				>
					Recurring for this line
				</label>
			</div>
			<p className="sr-only" id={`${cbId}-hint`}>
				When checked, a repeating schedule is created for this line only after
				you confirm the draft.
			</p>
			{enabled ? (
				<div
					className={
						isThread
							? "flex min-w-0 flex-col gap-1.5"
							: "flex min-w-0 flex-col gap-1 sm:flex-1"
					}
				>
					<label
						className={
							isThread
								? "flex min-w-0 flex-col gap-1"
								: "flex flex-wrap items-center gap-2"
						}
						htmlFor={selId}
					>
						<span className="text-[11px] text-muted-foreground">Every</span>
						<select
							aria-label="Recurring interval for this line"
							className={
								isThread
									? "h-9 w-full min-w-0 rounded-md border border-border bg-background px-2 text-xs"
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
