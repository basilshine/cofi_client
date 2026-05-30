import {
	type RecurringExpense,
	STANDARD_RECURRING_INTERVALS,
	type StandardRecurringInterval,
	TEST_RECURRING_INTERVALS,
} from "@cofi/api";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConsoleHeaderTitle } from "../../app/layout/ConsoleHeaderCenterContext";
import { SpaceWorkspaceLayout } from "../../app/layout/workspaceSpaces/SpaceWorkspaceLayout";
import { useUserFormat } from "../../shared/hooks/useUserFormat";
import { apiClient } from "../../shared/lib/apiClient";

const sectionCard =
	"rounded-2xl border border-border/70 bg-card text-card-foreground soft-shadow inner-glow";
const sectionHeading =
	"flex items-center justify-between gap-3 border-b border-border/50 px-6 py-4";
const sectionTitle =
	"font-display text-lg font-bold tracking-tight text-foreground sm:text-xl";
const sectionEyebrow = "eyebrow";
const ghostButton =
	"inline-flex h-9 items-center gap-1.5 rounded-full border border-border/70 bg-background/40 px-3.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground transition hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const plannerMiniButton =
	"inline-flex h-8 items-center rounded-md border border-border bg-background px-3 text-xs font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const formInputClass =
	"h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const formLabelClass =
	"text-xs font-semibold uppercase tracking-wide text-muted-foreground";
const metaPillClass =
	"inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground";
const actionButtonClass =
	"inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-50";
const destructiveActionButtonClass =
	"inline-flex h-8 items-center gap-1.5 rounded-md border border-destructive/40 bg-background px-2.5 text-xs font-medium text-destructive transition hover:bg-destructive/10 disabled:opacity-50";
const forecastCardBaseClass =
	"rounded-xl border p-3.5 shadow-sm transition hover:shadow-md";

const showTestRecurringIntervals = () =>
	import.meta.env.DEV ||
	import.meta.env.VITE_RECURRING_TEST_INTERVALS === "true" ||
	import.meta.env.VITE_RECURRING_TEST_INTERVALS === "1";

const recurringIntervalChoices = (): StandardRecurringInterval[] =>
	showTestRecurringIntervals()
		? [...STANDARD_RECURRING_INTERVALS, ...TEST_RECURRING_INTERVALS]
		: [...STANDARD_RECURRING_INTERVALS];

type PeriodPreset = "day" | "week" | "month" | "year";

const periodOptions: { key: PeriodPreset; label: string; hint: string }[] = [
	{ key: "day", label: "Day", hint: "Single date" },
	{ key: "week", label: "Week", hint: "Week in month" },
	{ key: "month", label: "Month", hint: "Month in year" },
	{ key: "year", label: "Year", hint: "Year range" },
];

const startOfDay = (d: Date) =>
	new Date(d.getFullYear(), d.getMonth(), d.getDate());
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const startOfYear = (d: Date) => new Date(d.getFullYear(), 0, 1);
const startOfWeekMonday = (d: Date) => {
	const dayStart = startOfDay(d);
	const weekdayMon0 = (dayStart.getDay() + 6) % 7;
	return addDays(dayStart, -weekdayMon0);
};
const addDays = (d: Date, days: number) => {
	const next = new Date(d);
	next.setDate(next.getDate() + days);
	return next;
};
const addMonths = (d: Date, months: number) => {
	const next = new Date(d);
	next.setMonth(next.getMonth() + months);
	return next;
};
const addYears = (d: Date, years: number) => {
	const next = new Date(d);
	next.setFullYear(next.getFullYear() + years);
	return next;
};
const addMinutes = (d: Date, minutes: number) => {
	const next = new Date(d);
	next.setMinutes(next.getMinutes() + minutes);
	return next;
};
const addSeconds = (d: Date, seconds: number) => {
	const next = new Date(d);
	next.setSeconds(next.getSeconds() + seconds);
	return next;
};
const sameDay = (a: Date, b: Date) =>
	a.getFullYear() === b.getFullYear() &&
	a.getMonth() === b.getMonth() &&
	a.getDate() === b.getDate();
const sameMonth = (a: Date, b: Date) =>
	a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
const isoDayKey = (d: Date) =>
	`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
		d.getDate(),
	).padStart(2, "0")}`;

const normalizeAnchor = (anchor: Date, period: PeriodPreset) => {
	switch (period) {
		case "day":
			return startOfDay(anchor);
		case "week":
			return startOfWeekMonday(anchor);
		case "month":
			return startOfMonth(anchor);
		case "year":
			return startOfYear(anchor);
	}
};

const periodEndExclusive = (anchor: Date, period: PeriodPreset) => {
	switch (period) {
		case "day":
			return addDays(anchor, 1);
		case "week":
			return addDays(anchor, 7);
		case "month":
			return addMonths(anchor, 1);
		case "year":
			return addYears(anchor, 1);
	}
};

const formatRangeLabel = (start: Date, endExclusive: Date) => {
	const end = addDays(endExclusive, -1);
	const fmt: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
	const startText = start.toLocaleDateString(undefined, fmt);
	const endText = end.toLocaleDateString(undefined, {
		...fmt,
		year: start.getFullYear() === end.getFullYear() ? undefined : "numeric",
	});
	return `${startText} - ${endText}`;
};

const parseRunDate = (row: RecurringExpense): Date | null => {
	const raw = row.next_run ?? row.nextRun;
	if (!raw) return null;
	const parsed = new Date(String(raw));
	return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const heatClass = (count: number, max: number) => {
	if (count <= 0 || max <= 0) return "bg-background text-foreground";
	const ratio = count / max;
	if (ratio >= 0.85) return "bg-rose-500/35 text-rose-950 dark:text-rose-100";
	if (ratio >= 0.65) return "bg-rose-400/30 text-rose-900 dark:text-rose-100";
	if (ratio >= 0.45) return "bg-rose-300/25 text-rose-900 dark:text-rose-100";
	if (ratio >= 0.25) return "bg-rose-200/20 text-rose-900 dark:text-rose-100";
	return "bg-rose-100/20 text-rose-900 dark:text-rose-100";
};

const yearRangeStart = (year: number) => Math.floor(year / 12) * 12;
const OCCURRENCE_GUARD_PER_SCHEDULE = 3000;

const recurringIntervalLabel = (interval?: string) => {
	const key = String(interval ?? "")
		.trim()
		.toLowerCase();
	switch (key) {
		case "daily":
			return "Daily";
		case "weekly":
			return "Weekly";
		case "monthly":
			return "Monthly";
		case "yearly":
			return "Yearly";
		case "minute":
			return "Every minute (test)";
		case "test":
			return "Every 30s (test)";
		default:
			return key || "-";
	}
};

const forecastTone = (label: ForecastSummary["label"]) => {
	switch (label) {
		case "Day":
			return {
				card: "border-emerald-500/30 bg-gradient-to-b from-emerald-500/10 to-background",
				badge: "bg-emerald-500/20 text-emerald-900 dark:text-emerald-100",
				fill: "bg-emerald-500/70",
			};
		case "Month":
			return {
				card: "border-sky-500/30 bg-gradient-to-b from-sky-500/10 to-background",
				badge: "bg-sky-500/20 text-sky-900 dark:text-sky-100",
				fill: "bg-sky-500/70",
			};
		case "Year":
			return {
				card: "border-violet-500/30 bg-gradient-to-b from-violet-500/10 to-background",
				badge: "bg-violet-500/20 text-violet-900 dark:text-violet-100",
				fill: "bg-violet-500/70",
			};
	}
};

const IconCalendarMini = ({ className }: { className?: string }) => (
	<svg
		aria-hidden
		className={className}
		fill="none"
		height="14"
		stroke="currentColor"
		strokeLinecap="round"
		strokeLinejoin="round"
		strokeWidth="1.8"
		viewBox="0 0 24 24"
		width="14"
	>
		<title>Calendar</title>
		<rect height="16" rx="2" width="18" x="3" y="5" />
		<path d="M16 3v4M8 3v4M3 10h18" />
	</svg>
);

const IconTrendMini = ({ className }: { className?: string }) => (
	<svg
		aria-hidden
		className={className}
		fill="none"
		height="14"
		stroke="currentColor"
		strokeLinecap="round"
		strokeLinejoin="round"
		strokeWidth="1.8"
		viewBox="0 0 24 24"
		width="14"
	>
		<title>Projection</title>
		<path d="M4 18h16M6 15l3-3 3 2 5-6" />
	</svg>
);

const IconTagMini = ({ className }: { className?: string }) => (
	<svg
		aria-hidden
		className={className}
		fill="none"
		height="14"
		stroke="currentColor"
		strokeLinecap="round"
		strokeLinejoin="round"
		strokeWidth="1.8"
		viewBox="0 0 24 24"
		width="14"
	>
		<title>Tag</title>
		<path d="M20 13l-7 7-9-9V4h7z" />
		<circle cx="8.5" cy="8.5" r="1.2" />
	</svg>
);

const IconEditMini = ({ className }: { className?: string }) => (
	<svg
		aria-hidden
		className={className}
		fill="none"
		height="14"
		stroke="currentColor"
		strokeLinecap="round"
		strokeLinejoin="round"
		strokeWidth="1.8"
		viewBox="0 0 24 24"
		width="14"
	>
		<title>Edit</title>
		<path d="M4 20h4l10-10-4-4L4 16zM13 7l4 4" />
	</svg>
);

const IconPauseMini = ({ className }: { className?: string }) => (
	<svg
		aria-hidden
		className={className}
		fill="none"
		height="14"
		stroke="currentColor"
		strokeLinecap="round"
		strokeLinejoin="round"
		strokeWidth="1.8"
		viewBox="0 0 24 24"
		width="14"
	>
		<title>Pause</title>
		<path d="M9 6v12M15 6v12" />
	</svg>
);

const IconPlayMini = ({ className }: { className?: string }) => (
	<svg
		aria-hidden
		className={className}
		fill="none"
		height="14"
		stroke="currentColor"
		strokeLinecap="round"
		strokeLinejoin="round"
		strokeWidth="1.8"
		viewBox="0 0 24 24"
		width="14"
	>
		<title>Resume</title>
		<path d="M8 6l10 6-10 6z" />
	</svg>
);

const IconTrashMini = ({ className }: { className?: string }) => (
	<svg
		aria-hidden
		className={className}
		fill="none"
		height="14"
		stroke="currentColor"
		strokeLinecap="round"
		strokeLinejoin="round"
		strokeWidth="1.8"
		viewBox="0 0 24 24"
		width="14"
	>
		<title>Delete</title>
		<path d="M3 6h18M8 6V4h8v2M7 6l1 14h8l1-14M10 10v7M14 10v7" />
	</svg>
);

type RecurringEditDraft = {
	name: string;
	amountInput: string;
	amount: number;
	interval: StandardRecurringInterval;
	tagLabel: string;
};

type ForecastSummary = {
	label: "Day" | "Month" | "Year";
	average: number;
	projectedTotal: number;
	projectedRuns: number;
};

const createEmptyRecurringDraft = (): RecurringEditDraft => ({
	name: "",
	amountInput: "0.00",
	amount: 0,
	interval: recurringIntervalChoices()[0] ?? "monthly",
	tagLabel: "recurring",
});

const annualRunsMultiplier = (intervalRaw?: string) => {
	const interval = String(intervalRaw ?? "")
		.trim()
		.toLowerCase();
	switch (interval) {
		case "daily":
			return 365;
		case "weekly":
			return 52;
		case "monthly":
			return 12;
		case "yearly":
			return 1;
		default:
			return 0;
	}
};

export const RecurringSchedulesPage = () => {
	useConsoleHeaderTitle("Recurring", null);
	const { formatMoney, formatDateTime } = useUserFormat();
	const [items, setItems] = useState<RecurringExpense[] | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [successMessage, setSuccessMessage] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [actingId, setActingId] = useState<string | number | null>(null);
	const [editingId, setEditingId] = useState<string | number | null>(null);
	const [editDraft, setEditDraft] = useState<RecurringEditDraft | null>(null);
	const [editError, setEditError] = useState<string | null>(null);
	const [editBusy, setEditBusy] = useState(false);
	const [createOpen, setCreateOpen] = useState(false);
	const [createDraft, setCreateDraft] = useState<RecurringEditDraft>(() =>
		createEmptyRecurringDraft(),
	);
	const [createError, setCreateError] = useState<string | null>(null);
	const [createBusy, setCreateBusy] = useState(false);
	const [highlightedRecurringId, setHighlightedRecurringId] = useState<
		string | number | null
	>(null);
	const highlightClearTimerRef = useRef<number | null>(null);

	const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("month");
	const [anchorDate, setAnchorDate] = useState(() => startOfDay(new Date()));
	const [calendarMonth, setCalendarMonth] = useState(
		() => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
	);
	const [pickerYearStart, setPickerYearStart] = useState(() =>
		yearRangeStart(new Date().getFullYear()),
	);

	const load = useCallback(async () => {
		setIsLoading(true);
		setErrorMessage(null);
		try {
			const data = await apiClient.finances.recurring.list();
			setItems(data);
		} catch (err) {
			setItems(null);
			setErrorMessage(
				err instanceof Error
					? err.message
					: "Failed to load recurring schedules",
			);
		} finally {
			setIsLoading(false);
		}
	}, []);

	const upsertRecurringLocal = useCallback((nextRow: RecurringExpense) => {
		setItems((prev) => {
			if (!prev) return [nextRow];
			const nextId = nextRow.id;
			if (nextId == null) return [nextRow, ...prev];
			const exists = prev.some((row) => row.id === nextId);
			if (!exists) return [nextRow, ...prev];
			return prev.map((row) => (row.id === nextId ? nextRow : row));
		});
	}, []);

	const removeRecurringLocal = useCallback((id: string | number) => {
		setItems((prev) => (prev ?? []).filter((row) => row.id !== id));
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	const handlePause = async (row: RecurringExpense) => {
		const id = row.id;
		if (id == null) return;
		const name = row.name?.trim() || "this schedule";
		if (
			!window.confirm(
				`Pause "${name}"? Future automatic charges will stop until you resume.`,
			)
		) {
			return;
		}
		setActingId(id);
		setSuccessMessage(null);
		setErrorMessage(null);
		try {
			const updated = await apiClient.finances.recurring.pause(id);
			upsertRecurringLocal(updated);
			setSuccessMessage(`Paused "${name}".`);
			await load();
		} catch (err) {
			setErrorMessage(
				err instanceof Error ? err.message : "Failed to pause schedule",
			);
		} finally {
			setActingId(null);
		}
	};

	const handleResume = async (row: RecurringExpense) => {
		const id = row.id;
		if (id == null) return;
		setActingId(id);
		setSuccessMessage(null);
		setErrorMessage(null);
		try {
			const updated = await apiClient.finances.recurring.resume(id);
			upsertRecurringLocal(updated);
			setSuccessMessage(
				row.name?.trim()
					? `Resumed "${row.name.trim()}".`
					: "Schedule resumed.",
			);
			await load();
		} catch (err) {
			setErrorMessage(
				err instanceof Error ? err.message : "Failed to resume schedule",
			);
		} finally {
			setActingId(null);
		}
	};

	const handleDelete = async (row: RecurringExpense) => {
		const id = row.id;
		if (id == null) return;
		const name = row.name?.trim() || "this schedule";
		if (
			!window.confirm(
				`Delete recurring schedule "${name}"? This cannot be undone.`,
			)
		) {
			return;
		}
		setActingId(id);
		setSuccessMessage(null);
		setErrorMessage(null);
		try {
			await apiClient.finances.recurring.remove(id);
			removeRecurringLocal(id);
			setSuccessMessage(`Deleted "${name}".`);
			await load();
		} catch (err) {
			setErrorMessage(
				err instanceof Error ? err.message : "Failed to delete schedule",
			);
		} finally {
			setActingId(null);
		}
	};

	const handleStartEdit = (row: RecurringExpense) => {
		const id = row.id;
		if (id == null) return;
		const intervals = recurringIntervalChoices();
		const rawInterval = String(row.interval ?? "monthly");
		const nextInterval = intervals.includes(
			rawInterval as StandardRecurringInterval,
		)
			? (rawInterval as StandardRecurringInterval)
			: intervals[0];
		const nextAmount = Number(row.amount ?? 0);
		setEditDraft({
			name: row.name?.trim() || "",
			amountInput: Number.isFinite(nextAmount) ? nextAmount.toFixed(2) : "0.00",
			amount: Number.isFinite(nextAmount) ? nextAmount : 0,
			interval: nextInterval,
			tagLabel: String(row.tag_label ?? row.tagLabel ?? "").trim(),
		});
		setEditingId(id);
		setEditError(null);
		setSuccessMessage(null);
	};

	const handleCancelEdit = () => {
		if (editBusy) return;
		setEditingId(null);
		setEditDraft(null);
		setEditError(null);
	};

	const handleSaveEdit = async (row: RecurringExpense) => {
		const id = row.id;
		if (id == null || editDraft == null) return;
		const trimmedName = editDraft.name.trim();
		if (trimmedName.length < 2) {
			setEditError("Name must be at least 2 characters.");
			return;
		}
		if (!Number.isFinite(editDraft.amount) || editDraft.amount <= 0) {
			setEditError("Amount must be greater than 0.");
			return;
		}

		setEditBusy(true);
		setEditError(null);
		setErrorMessage(null);
		setSuccessMessage(null);
		try {
			const updated = await apiClient.finances.recurring.update(id, {
				...row,
				name: trimmedName,
				amount: editDraft.amount,
				interval: editDraft.interval,
				tag_label: editDraft.tagLabel.trim() || undefined,
			});
			upsertRecurringLocal(updated);
			setEditingId(null);
			setEditDraft(null);
			setSuccessMessage(`Updated "${trimmedName}".`);
			await load();
		} catch (err) {
			setEditError(
				err instanceof Error
					? err.message
					: "Failed to update recurring schedule",
			);
		} finally {
			setEditBusy(false);
		}
	};

	const handleToggleCreate = () => {
		setCreateOpen((prev) => !prev);
		setCreateError(null);
	};

	const handleCancelCreate = () => {
		if (createBusy) return;
		setCreateOpen(false);
		setCreateDraft(createEmptyRecurringDraft());
		setCreateError(null);
	};

	const handleCreateRecurring = async () => {
		const trimmedName = createDraft.name.trim();
		if (trimmedName.length < 2) {
			setCreateError("Name must be at least 2 characters.");
			return;
		}
		if (!Number.isFinite(createDraft.amount) || createDraft.amount <= 0) {
			setCreateError("Amount must be greater than 0.");
			return;
		}

		setCreateBusy(true);
		setCreateError(null);
		setSuccessMessage(null);
		setErrorMessage(null);
		try {
			const created = await apiClient.finances.recurring.create({
				name: trimmedName,
				amount: createDraft.amount,
				interval: createDraft.interval,
				tag_label: createDraft.tagLabel.trim() || "recurring",
			});
			upsertRecurringLocal(created);
			setCreateDraft(createEmptyRecurringDraft());
			setCreateOpen(false);
			setSuccessMessage(`Created "${trimmedName}".`);
			await load();
		} catch (err) {
			setCreateError(
				err instanceof Error
					? err.message
					: "Failed to create recurring schedule",
			);
		} finally {
			setCreateBusy(false);
		}
	};

	const busy = actingId != null;
	const normalizedAnchor = useMemo(
		() => normalizeAnchor(anchorDate, periodPreset),
		[anchorDate, periodPreset],
	);
	const endExclusive = useMemo(
		() => periodEndExclusive(normalizedAnchor, periodPreset),
		[normalizedAnchor, periodPreset],
	);

	const activeRunEntries = useMemo(
		() =>
			(items ?? [])
				.map((row) => ({ row, nextRun: parseRunDate(row) }))
				.filter(
					(entry): entry is { row: RecurringExpense; nextRun: Date } =>
						Boolean(entry.nextRun) && entry.row.paused !== true,
				),
		[items],
	);

	const activeSchedules = useMemo(
		() => (items ?? []).filter((row) => row.paused !== true),
		[items],
	);

	const nextByInterval = useCallback((d: Date, intervalRaw?: string) => {
		const interval = String(intervalRaw ?? "")
			.trim()
			.toLowerCase();
		switch (interval) {
			case "daily":
				return addDays(d, 1);
			case "weekly":
				return addDays(d, 7);
			case "monthly":
				return addMonths(d, 1);
			case "yearly":
				return addYears(d, 1);
			case "minute":
				return addMinutes(d, 1);
			case "test":
				return addSeconds(d, 30);
			default:
				return null;
		}
	}, []);

	const collectOccurrencesInRange = useCallback(
		(startInclusive: Date, endExclusiveRange: Date) => {
			const rows: Array<{ row: RecurringExpense; runDate: Date }> = [];
			for (const entry of activeRunEntries) {
				let guard = 0;
				let current = new Date(entry.nextRun);

				while (current.getTime() < startInclusive.getTime()) {
					const next = nextByInterval(current, entry.row.interval);
					if (!next || next.getTime() <= current.getTime()) break;
					current = next;
					guard += 1;
					if (guard > OCCURRENCE_GUARD_PER_SCHEDULE) break;
				}

				while (current.getTime() < endExclusiveRange.getTime()) {
					if (current.getTime() >= startInclusive.getTime()) {
						rows.push({ row: entry.row, runDate: new Date(current) });
					}
					const next = nextByInterval(current, entry.row.interval);
					if (!next || next.getTime() <= current.getTime()) break;
					current = next;
					guard += 1;
					if (guard > OCCURRENCE_GUARD_PER_SCHEDULE) break;
				}
			}
			return rows;
		},
		[nextByInterval, activeRunEntries],
	);

	const upcomingInPeriod = useMemo(() => {
		return collectOccurrencesInRange(normalizedAnchor, endExclusive).sort(
			(a, b) => a.runDate.getTime() - b.runDate.getTime(),
		);
	}, [collectOccurrencesInRange, normalizedAnchor, endExclusive]);

	const upcomingCountByRecurringId = useMemo(() => {
		const map = new Map<string | number, number>();
		for (const occurrence of upcomingInPeriod) {
			const id = occurrence.row.id;
			if (id == null) continue;
			map.set(id, (map.get(id) ?? 0) + 1);
		}
		return map;
	}, [upcomingInPeriod]);

	useEffect(() => {
		setCalendarMonth(startOfMonth(normalizedAnchor));
		setPickerYearStart(yearRangeStart(normalizedAnchor.getFullYear()));
	}, [normalizedAnchor]);

	const calendarCells = useMemo(() => {
		const first = new Date(
			calendarMonth.getFullYear(),
			calendarMonth.getMonth(),
			1,
		);
		const firstWeekdayMon0 = (first.getDay() + 6) % 7;
		const start = addDays(first, -firstWeekdayMon0);
		return Array.from({ length: 42 }, (_, i) => addDays(start, i));
	}, [calendarMonth]);

	const monthLabel = calendarMonth.toLocaleDateString(undefined, {
		month: "long",
		year: "numeric",
	});

	const calendarRangeStart = calendarCells[0];
	const calendarRangeEndExclusive = addDays(
		calendarCells[calendarCells.length - 1],
		1,
	);

	const calendarOccurrences = useMemo(
		() =>
			collectOccurrencesInRange(calendarRangeStart, calendarRangeEndExclusive),
		[collectOccurrencesInRange, calendarRangeStart, calendarRangeEndExclusive],
	);

	const runCountByDay = useMemo(() => {
		const map = new Map<string, number>();
		for (const occurrence of calendarOccurrences) {
			const key = isoDayKey(occurrence.runDate);
			map.set(key, (map.get(key) ?? 0) + 1);
		}
		return map;
	}, [calendarOccurrences]);

	const visibleDayMax = useMemo(() => {
		let max = 0;
		for (const day of calendarCells) {
			const count = runCountByDay.get(isoDayKey(day)) ?? 0;
			if (count > max) max = count;
		}
		return max;
	}, [calendarCells, runCountByDay]);

	const weeksInMonth = useMemo(() => {
		const rows: Array<{ start: Date; end: Date; count: number }> = [];
		for (let i = 0; i < 6; i += 1) {
			const start = calendarCells[i * 7];
			const end = addDays(start, 6);
			let count = 0;
			for (let d = 0; d < 7; d += 1) {
				count += runCountByDay.get(isoDayKey(addDays(start, d))) ?? 0;
			}
			rows.push({ start, end, count });
		}
		return rows;
	}, [calendarCells, runCountByDay]);

	const monthCountMax = useMemo(() => {
		const yearStart = new Date(calendarMonth.getFullYear(), 0, 1);
		const yearEndExclusive = new Date(calendarMonth.getFullYear() + 1, 0, 1);
		const yearlyOccurrences = collectOccurrencesInRange(
			yearStart,
			yearEndExclusive,
		);
		const countByMonth = new Map<number, number>();
		for (const occurrence of yearlyOccurrences) {
			const monthIdx = occurrence.runDate.getMonth();
			countByMonth.set(monthIdx, (countByMonth.get(monthIdx) ?? 0) + 1);
		}
		let max = 0;
		for (let m = 0; m < 12; m += 1) {
			const monthCount = countByMonth.get(m) ?? 0;
			if (monthCount > max) max = monthCount;
		}
		return max;
	}, [collectOccurrencesInRange, calendarMonth]);

	const yearCountMax = useMemo(() => {
		const rangeStart = new Date(pickerYearStart, 0, 1);
		const rangeEndExclusive = new Date(pickerYearStart + 12, 0, 1);
		const occurrences = collectOccurrencesInRange(
			rangeStart,
			rangeEndExclusive,
		);
		const countByYear = new Map<number, number>();
		for (const occurrence of occurrences) {
			const year = occurrence.runDate.getFullYear();
			countByYear.set(year, (countByYear.get(year) ?? 0) + 1);
		}
		let max = 0;
		for (let y = pickerYearStart; y < pickerYearStart + 12; y += 1) {
			const count = countByYear.get(y) ?? 0;
			if (count > max) max = count;
		}
		return max;
	}, [collectOccurrencesInRange, pickerYearStart]);

	const periodForecastSummaries = useMemo<ForecastSummary[]>(() => {
		const now = new Date();
		const dayStart = startOfDay(now);
		const monthStart = startOfMonth(now);
		const yearStart = startOfYear(now);

		const dayOccurrences = collectOccurrencesInRange(
			dayStart,
			addDays(dayStart, 1),
		);
		const monthOccurrences = collectOccurrencesInRange(
			monthStart,
			addMonths(monthStart, 1),
		);
		const yearOccurrences = collectOccurrencesInRange(
			yearStart,
			addYears(yearStart, 1),
		);

		const totalFor = (rows: Array<{ row: RecurringExpense; runDate: Date }>) =>
			rows.reduce(
				(sum, occurrence) => sum + Number(occurrence.row.amount ?? 0),
				0,
			);
		const annualSpend = activeSchedules.reduce(
			(sum, row) =>
				sum + Number(row.amount ?? 0) * annualRunsMultiplier(row.interval),
			0,
		);

		return [
			{
				label: "Day",
				average: annualSpend / 365,
				projectedTotal: totalFor(dayOccurrences),
				projectedRuns: dayOccurrences.length,
			},
			{
				label: "Month",
				average: annualSpend / 12,
				projectedTotal: totalFor(monthOccurrences),
				projectedRuns: monthOccurrences.length,
			},
			{
				label: "Year",
				average: annualSpend,
				projectedTotal: totalFor(yearOccurrences),
				projectedRuns: yearOccurrences.length,
			},
		];
	}, [collectOccurrencesInRange, activeSchedules]);

	const handlePeriodChange = (next: PeriodPreset) => {
		setPeriodPreset(next);
		setAnchorDate((prev) => normalizeAnchor(prev, next));
	};

	const handlePrevStep = () => {
		setAnchorDate((prev) => {
			switch (periodPreset) {
				case "day":
					return addDays(startOfDay(prev), -1);
				case "week":
					return addDays(startOfWeekMonday(prev), -7);
				case "month":
					return addMonths(startOfMonth(prev), -1);
				case "year":
					return addYears(startOfYear(prev), -1);
			}
		});
	};

	const handleNextStep = () => {
		setAnchorDate((prev) => {
			switch (periodPreset) {
				case "day":
					return addDays(startOfDay(prev), 1);
				case "week":
					return addDays(startOfWeekMonday(prev), 7);
				case "month":
					return addMonths(startOfMonth(prev), 1);
				case "year":
					return addYears(startOfYear(prev), 1);
			}
		});
	};

	const handleJumpToSchedule = (id: string | number | null | undefined) => {
		if (id == null) return;
		const target = document.getElementById(`recurring-${String(id)}`);
		if (!target) return;
		target.scrollIntoView({ behavior: "smooth", block: "center" });
		setHighlightedRecurringId(id);
		if (highlightClearTimerRef.current != null) {
			window.clearTimeout(highlightClearTimerRef.current);
		}
		highlightClearTimerRef.current = window.setTimeout(() => {
			setHighlightedRecurringId((prev) => (prev === id ? null : prev));
			highlightClearTimerRef.current = null;
		}, 2200);
	};

	useEffect(() => {
		return () => {
			if (highlightClearTimerRef.current != null) {
				window.clearTimeout(highlightClearTimerRef.current);
			}
		};
	}, []);

	const monthNameShort = (monthIndex: number) =>
		new Date(2000, monthIndex, 1).toLocaleString(undefined, {
			month: "short",
		});

	const plannerPanel = (
		<div className="space-y-4">
			<div className="space-y-2 pb-3">
				<div className="flex items-center justify-between gap-2">
					<div>
						<p className={sectionEyebrow}>Upcoming recurring</p>
						<h2 className={sectionTitle}>Planner</h2>
					</div>
					<button
						className={ghostButton}
						onClick={() => setAnchorDate(startOfDay(new Date()))}
						type="button"
					>
						Today
					</button>
				</div>
				<p className="text-xs text-muted-foreground">
					Pick a period and jump directly to schedules due in that window.
				</p>
			</div>
			<div className="space-y-4 rounded-xl border border-border/70 bg-card p-4 soft-shadow inner-glow">
				<div className="grid grid-cols-2 gap-1.5">
					{periodOptions.map((option) => (
						<button
							className={[
								"rounded-lg border px-2 py-2 text-left transition",
								periodPreset === option.key
									? "border-foreground/25 bg-foreground text-background"
									: "border-border bg-background text-foreground hover:bg-accent",
							].join(" ")}
							key={option.key}
							onClick={() => handlePeriodChange(option.key)}
							type="button"
						>
							<p className="text-xs font-semibold">{option.label}</p>
							<p
								className={[
									"text-[10px]",
									periodPreset === option.key
										? "text-background/80"
										: "text-muted-foreground",
								].join(" ")}
							>
								{option.hint}
							</p>
						</button>
					))}
				</div>
				<div className="flex items-center justify-between gap-2">
					<div className="flex items-center gap-1">
						<button
							className={plannerMiniButton}
							onClick={handlePrevStep}
							type="button"
						>
							Prev
						</button>
						<button
							className={plannerMiniButton}
							onClick={handleNextStep}
							type="button"
						>
							Next
						</button>
					</div>
					<span className="text-xs font-medium text-muted-foreground">
						{formatRangeLabel(normalizedAnchor, endExclusive)}
					</span>
				</div>

				{periodPreset === "day" ? (
					<div className="space-y-2 rounded-xl border border-border/60 bg-background/40 p-3">
						<div className="mb-2 flex items-center justify-between">
							<button
								className="text-xs text-muted-foreground hover:text-foreground"
								onClick={() => setCalendarMonth(addMonths(calendarMonth, -1))}
								type="button"
							>
								Prev month
							</button>
							<p className="text-sm font-semibold">{monthLabel}</p>
							<button
								className="text-xs text-muted-foreground hover:text-foreground"
								onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}
								type="button"
							>
								Next month
							</button>
						</div>
						<div className="grid grid-cols-7 gap-1 text-[10px] text-muted-foreground">
							{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
								<div className="text-center" key={d}>
									{d}
								</div>
							))}
							{calendarCells.map((d) => {
								const isCurrentMonth =
									d.getMonth() === calendarMonth.getMonth();
								const isSelected = sameDay(d, normalizedAnchor);
								const count = runCountByDay.get(isoDayKey(d)) ?? 0;
								return (
									<button
										className={[
											"relative flex h-8 items-center justify-center rounded text-xs transition",
											isSelected
												? "bg-foreground text-background"
												: isCurrentMonth
													? `${heatClass(count, visibleDayMax)} hover:bg-muted`
													: "text-muted-foreground/60 hover:bg-muted/50",
										].join(" ")}
										key={isoDayKey(d)}
										onClick={() => setAnchorDate(startOfDay(d))}
										type="button"
									>
										{d.getDate()}
									</button>
								);
							})}
						</div>
					</div>
				) : null}

				{periodPreset === "week" ? (
					<div className="space-y-2 rounded-xl border border-border/60 bg-background/40 p-3">
						<div className="mb-2 flex items-center justify-between">
							<button
								className="text-xs text-muted-foreground hover:text-foreground"
								onClick={() => setCalendarMonth(addMonths(calendarMonth, -1))}
								type="button"
							>
								Prev month
							</button>
							<p className="text-sm font-semibold">{monthLabel}</p>
							<button
								className="text-xs text-muted-foreground hover:text-foreground"
								onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}
								type="button"
							>
								Next month
							</button>
						</div>
						<ul className="space-y-1.5">
							{weeksInMonth.map((week) => {
								const selected = sameDay(
									startOfWeekMonday(week.start),
									normalizedAnchor,
								);
								return (
									<li key={isoDayKey(week.start)}>
										<button
											className={[
												"flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-xs transition",
												selected
													? "border-foreground/30 bg-foreground text-background"
													: `${heatClass(week.count, visibleDayMax)} border-border hover:bg-accent`,
											].join(" ")}
											onClick={() =>
												setAnchorDate(startOfWeekMonday(week.start))
											}
											type="button"
										>
											<span>
												Week{" "}
												{week.start.toLocaleDateString(undefined, {
													month: "short",
													day: "numeric",
												})}{" "}
												-{" "}
												{week.end.toLocaleDateString(undefined, {
													month: "short",
													day: "numeric",
												})}
											</span>
											<span className="text-[10px] opacity-80">
												{week.count} due
											</span>
										</button>
									</li>
								);
							})}
						</ul>
					</div>
				) : null}

				{periodPreset === "month" ? (
					<div className="space-y-2 rounded-xl border border-border/60 bg-background/40 p-3">
						<div className="mb-2 flex items-center justify-between">
							<button
								className="text-xs text-muted-foreground hover:text-foreground"
								onClick={() =>
									setCalendarMonth(
										new Date(
											calendarMonth.getFullYear() - 1,
											calendarMonth.getMonth(),
											1,
										),
									)
								}
								type="button"
							>
								Prev year
							</button>
							<p className="text-sm font-semibold">
								{calendarMonth.getFullYear()}
							</p>
							<button
								className="text-xs text-muted-foreground hover:text-foreground"
								onClick={() =>
									setCalendarMonth(
										new Date(
											calendarMonth.getFullYear() + 1,
											calendarMonth.getMonth(),
											1,
										),
									)
								}
								type="button"
							>
								Next year
							</button>
						</div>
						<div className="grid grid-cols-3 gap-1.5">
							{Array.from({ length: 12 }, (_, monthIdx) => {
								const monthDate = new Date(
									calendarMonth.getFullYear(),
									monthIdx,
									1,
								);
								const selected = sameMonth(monthDate, normalizedAnchor);
								const monthRangeEnd = new Date(
									calendarMonth.getFullYear(),
									monthIdx + 1,
									1,
								);
								const monthCount = collectOccurrencesInRange(
									monthDate,
									monthRangeEnd,
								).length;
								return (
									<button
										className={[
											"rounded-lg border px-2 py-2 text-xs transition",
											selected
												? "border-foreground/30 bg-foreground text-background"
												: `${heatClass(monthCount, monthCountMax)} border-border hover:bg-accent`,
										].join(" ")}
										key={`${monthDate.getFullYear()}-${monthDate.getMonth()}`}
										onClick={() => setAnchorDate(startOfMonth(monthDate))}
										type="button"
									>
										<p className="font-medium">{monthNameShort(monthIdx)}</p>
										<p className="text-[10px] opacity-80">{monthCount}</p>
									</button>
								);
							})}
						</div>
					</div>
				) : null}

				{periodPreset === "year" ? (
					<div className="space-y-2 rounded-xl border border-border/60 bg-background/40 p-3">
						<div className="mb-2 flex items-center justify-between">
							<button
								className="text-xs text-muted-foreground hover:text-foreground"
								onClick={() => setPickerYearStart((prev) => prev - 12)}
								type="button"
							>
								Prev range
							</button>
							<p className="text-sm font-semibold">
								{pickerYearStart} - {pickerYearStart + 11}
							</p>
							<button
								className="text-xs text-muted-foreground hover:text-foreground"
								onClick={() => setPickerYearStart((prev) => prev + 12)}
								type="button"
							>
								Next range
							</button>
						</div>
						<div className="grid grid-cols-3 gap-1.5">
							{Array.from({ length: 12 }, (_, i) => {
								const y = pickerYearStart + i;
								const selected = normalizedAnchor.getFullYear() === y;
								const yearCount = collectOccurrencesInRange(
									new Date(y, 0, 1),
									new Date(y + 1, 0, 1),
								).length;
								return (
									<button
										className={[
											"rounded-lg border px-2 py-2 text-xs transition",
											selected
												? "border-foreground/30 bg-foreground text-background"
												: `${heatClass(yearCount, yearCountMax)} border-border hover:bg-accent`,
										].join(" ")}
										key={`year-${y}`}
										onClick={() =>
											setAnchorDate(startOfYear(new Date(y, 0, 1)))
										}
										type="button"
									>
										<p className="font-medium">{y}</p>
										<p className="text-[10px] opacity-80">{yearCount}</p>
									</button>
								);
							})}
						</div>
					</div>
				) : null}

				<div className="space-y-2">
					<p className="text-xs font-medium text-muted-foreground">
						Upcoming in period ({upcomingInPeriod.length})
					</p>
					<ul className="space-y-2">
						{upcomingInPeriod.length === 0 ? (
							<li className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
								No recurring runs in this range.
							</li>
						) : null}
						{upcomingInPeriod.map(({ row, runDate }) => (
							<li
								key={`upcoming-${String(row.id ?? row.name ?? runDate.getTime())}-${runDate.getTime()}`}
							>
								<button
									className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-left transition hover:bg-accent"
									onClick={() => handleJumpToSchedule(row.id)}
									type="button"
								>
									<p className="truncate text-sm font-medium text-foreground">
										{row.name?.trim() || "Schedule"}
									</p>
									<p className="text-xs text-muted-foreground">
										{runDate.toLocaleDateString()} •{" "}
										{formatMoney(row.amount ?? 0)}
									</p>
								</button>
							</li>
						))}
					</ul>
				</div>
			</div>
		</div>
	);

	return (
		<SpaceWorkspaceLayout
			contentClassName="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 lg:px-8 lg:py-8"
			mainClassName=""
			rightRail={plannerPanel}
			rightRailClassName="border-border/60 bg-muted/30"
			rightRailInnerClassName="min-h-0 flex-1 overflow-y-auto px-4 py-6"
			rightRailLabel="Recurring planner sidebar"
		>
			<section
				aria-label="Recurring averages"
				className="rounded-2xl border border-border/70 bg-card p-4 soft-shadow inner-glow sm:p-5"
			>
				<div className="flex items-start justify-between gap-3">
					<div>
						<p className={sectionEyebrow}>Spending forecast</p>
						<h2 className="font-display text-base font-semibold tracking-tight text-foreground sm:text-lg">
							Average recurring spend
						</h2>
					</div>
					<p className="rounded-full border border-border/70 bg-muted/30 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
						Active only
					</p>
				</div>
				<div className="mt-4 grid gap-3 sm:grid-cols-3">
					{periodForecastSummaries.map((summary) => {
						const tone = forecastTone(summary.label);
						const ratio =
							summary.average > 0
								? Math.max(
										0.12,
										Math.min(1, summary.projectedTotal / summary.average),
									)
								: 0;
						return (
							<div
								className={`${forecastCardBaseClass} ${tone.card}`}
								key={summary.label}
							>
								<div className="flex items-center justify-between gap-2">
									<p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
										Average / {summary.label}
									</p>
									<span
										className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-[10px] font-semibold uppercase ${tone.badge}`}
									>
										{summary.label[0]}
									</span>
								</div>
								<p className="mt-2 text-2xl font-semibold leading-none text-foreground">
									{formatMoney(summary.average)}
								</p>
								<p className="mt-1.5 text-xs text-muted-foreground">
									Projected this {summary.label.toLowerCase()}:{" "}
									{formatMoney(summary.projectedTotal)}
								</p>
								<p className="text-xs text-muted-foreground">
									{summary.projectedRuns} run
									{summary.projectedRuns === 1 ? "" : "s"}
								</p>
								<div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background/70">
									<div
										className={`h-full rounded-full ${tone.fill}`}
										style={{
											width: `${Math.round(ratio * 100)}%`,
										}}
									/>
								</div>
							</div>
						);
					})}
				</div>
			</section>
			<section className={sectionCard}>
				<div className={sectionHeading}>
					<div>
						<p className={sectionEyebrow}>Recurring schedules</p>
						<h1 className={sectionTitle}>Recurring items</h1>
					</div>
					<button
						aria-expanded={createOpen}
						className={ghostButton}
						disabled={createBusy}
						onClick={handleToggleCreate}
						type="button"
					>
						{createOpen ? "Close form" : "Add recurring"}
					</button>
				</div>
				<div className="space-y-4 p-6">
					<output aria-live="polite" className="sr-only">
						{successMessage ?? ""}
					</output>
					<p className="text-sm text-muted-foreground">
						Pause to stop future runs without removing the schedule. Delete
						removes it permanently.
					</p>
					{createOpen ? (
						<form
							className="space-y-3 rounded-xl border border-border/70 bg-muted/30 p-4"
							onSubmit={(e) => {
								e.preventDefault();
								void handleCreateRecurring();
							}}
						>
							<p className="text-sm font-semibold text-foreground">
								New recurring schedule
							</p>
							<div className="grid gap-3 sm:grid-cols-2">
								<label className="space-y-1.5">
									<span className={formLabelClass}>Name</span>
									<input
										aria-label="New recurring name"
										className={formInputClass}
										onChange={(e) =>
											setCreateDraft((prev) => ({
												...prev,
												name: e.target.value,
											}))
										}
										placeholder="Ride home"
										type="text"
										value={createDraft.name}
									/>
								</label>
								<label className="space-y-1.5">
									<span className={formLabelClass}>Amount</span>
									<input
										aria-label="New recurring amount"
										className={formInputClass}
										inputMode="decimal"
										onChange={(e) => {
											const next = e.target.value;
											const parsed = Number(next);
											setCreateDraft((prev) => ({
												...prev,
												amountInput: next,
												amount: Number.isFinite(parsed) ? parsed : 0,
											}));
										}}
										placeholder="0.00"
										type="text"
										value={createDraft.amountInput}
									/>
								</label>
								<label className="space-y-1.5">
									<span className={formLabelClass}>Interval</span>
									<select
										aria-label="New recurring interval"
										className={formInputClass}
										onChange={(e) =>
											setCreateDraft((prev) => ({
												...prev,
												interval: e.target.value as StandardRecurringInterval,
											}))
										}
										value={createDraft.interval}
									>
										{recurringIntervalChoices().map((iv) => (
											<option key={iv} value={iv}>
												{iv === "minute"
													? "minute (test)"
													: iv === "test"
														? "test (30s, dev)"
														: iv}
											</option>
										))}
									</select>
								</label>
								<label className="space-y-1.5">
									<span className={formLabelClass}>Tag</span>
									<input
										aria-label="New recurring tag"
										className={formInputClass}
										onChange={(e) =>
											setCreateDraft((prev) => ({
												...prev,
												tagLabel: e.target.value,
											}))
										}
										placeholder="transport"
										type="text"
										value={createDraft.tagLabel}
									/>
								</label>
							</div>
							{createError ? (
								<p className="text-xs text-destructive">{createError}</p>
							) : null}
							<div className="flex items-center justify-end gap-2">
								<button
									aria-label="Cancel new recurring form"
									className="inline-flex h-9 items-center rounded-md border border-border px-3 text-xs font-medium hover:bg-accent disabled:opacity-50"
									disabled={createBusy}
									onClick={handleCancelCreate}
									type="button"
								>
									Cancel
								</button>
								<button
									aria-label="Create recurring schedule"
									className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
									disabled={createBusy}
									type="submit"
								>
									{createBusy ? "Creating..." : "Create recurring"}
								</button>
							</div>
						</form>
					) : null}
					{errorMessage ? (
						<div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
							{errorMessage}
						</div>
					) : null}
					{isLoading && !items ? (
						<p className="text-sm text-muted-foreground">Loading...</p>
					) : null}
					{items?.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							No recurring schedules yet. Create one from Chat.
						</p>
					) : null}
					<ul className="space-y-3">
						{(items ?? []).map((row) => {
							const id = row.id;
							const paused = row.paused === true;
							const isActing =
								actingId != null && id != null && actingId === id;
							const label = row.name?.trim() || "Schedule";
							const tag = row.tag_label ?? row.tagLabel;
							const cadence = recurringIntervalLabel(row.interval);
							const projectedInPeriod =
								id != null ? (upcomingCountByRecurringId.get(id) ?? 0) : 0;
							return (
								<li
									className={[
										"rounded-xl border border-border/80 bg-card p-4 shadow-sm transition hover:border-border hover:shadow-md",
										highlightedRecurringId != null &&
										id != null &&
										highlightedRecurringId === id
											? "ring-2 ring-primary/60 ring-offset-2 ring-offset-background border-primary/40 bg-primary/5 shadow-lg"
											: "",
									].join(" ")}
									id={`recurring-${String(id ?? `${label}-${row.interval}`)}`}
									key={id ?? `${label}-${row.interval}`}
								>
									<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
										<div className="min-w-0 space-y-2.5">
											<div className="flex items-start gap-3">
												<div className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/70 bg-muted/40 text-muted-foreground">
													<IconCalendarMini />
												</div>
												<div className="min-w-0 space-y-1">
													<div className="flex flex-wrap items-center gap-2">
														<span className="truncate font-semibold text-foreground">
															{label}
														</span>
														{paused ? (
															<span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-900 dark:text-amber-100">
																Paused
															</span>
														) : (
															<span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-900 dark:text-emerald-100">
																Active
															</span>
														)}
													</div>
													<div className="text-sm">
														<span className="font-semibold text-foreground">
															{formatMoney(row.amount ?? 0)}
														</span>
													</div>
												</div>
											</div>
											<div className="flex flex-wrap items-center gap-1.5">
												<span className={metaPillClass}>{cadence}</span>
												{tag ? (
													<span className={metaPillClass}>
														<IconTagMini />
														{tag}
													</span>
												) : null}
											</div>
											<div className="space-y-1.5 text-xs text-muted-foreground">
												<div className="inline-flex items-center gap-1.5">
													<IconCalendarMini />
													{paused ? (
														<span>
															No runs while paused. Resume to continue creating
															expenses.
														</span>
													) : (
														<span>
															{(row.next_run ?? row.nextRun)
																? `Next active run: ${formatDateTime(String(row.next_run ?? row.nextRun))}`
																: "Next active run: -"}
														</span>
													)}
												</div>
												<div className="inline-flex items-center gap-1.5">
													<IconTrendMini />
													Projected in selected period: {projectedInPeriod}
												</div>
											</div>
										</div>
										<div className="flex shrink-0 flex-wrap gap-1.5">
											<button
												aria-label={`Edit recurring schedule ${label}`}
												className={actionButtonClass}
												disabled={busy || editBusy}
												onClick={() => handleStartEdit(row)}
												type="button"
											>
												<IconEditMini />
												Edit
											</button>
											{paused ? (
												<button
													className={actionButtonClass}
													disabled={busy}
													onClick={() => void handleResume(row)}
													type="button"
												>
													<IconPlayMini />
													{isActing ? "..." : "Resume"}
												</button>
											) : (
												<button
													className={actionButtonClass}
													disabled={busy}
													onClick={() => void handlePause(row)}
													type="button"
												>
													<IconPauseMini />
													{isActing ? "..." : "Pause"}
												</button>
											)}
											<button
												className={destructiveActionButtonClass}
												disabled={busy}
												onClick={() => void handleDelete(row)}
												type="button"
											>
												<IconTrashMini />
												{isActing ? "..." : "Delete"}
											</button>
										</div>
									</div>
									{editingId === id && editDraft != null ? (
										<form
											className="mt-4 space-y-3 rounded-xl border border-border/70 bg-muted/30 p-4"
											onSubmit={(e) => {
												e.preventDefault();
												void handleSaveEdit(row);
											}}
										>
											<div className="grid gap-3 sm:grid-cols-2">
												<label className="space-y-1.5">
													<span className={formLabelClass}>Name</span>
													<input
														aria-label="Recurring name"
														className={formInputClass}
														onChange={(e) =>
															setEditDraft((prev) =>
																prev == null
																	? prev
																	: { ...prev, name: e.target.value },
															)
														}
														placeholder="Ride home"
														type="text"
														value={editDraft.name}
													/>
												</label>
												<label className="space-y-1.5">
													<span className={formLabelClass}>Amount</span>
													<input
														aria-label="Recurring amount"
														className={formInputClass}
														inputMode="decimal"
														onChange={(e) => {
															const next = e.target.value;
															const parsed = Number(next);
															setEditDraft((prev) =>
																prev == null
																	? prev
																	: {
																			...prev,
																			amountInput: next,
																			amount: Number.isFinite(parsed)
																				? parsed
																				: 0,
																		},
															);
														}}
														placeholder="0.00"
														type="text"
														value={editDraft.amountInput}
													/>
												</label>
												<label className="space-y-1.5">
													<span className={formLabelClass}>Interval</span>
													<select
														aria-label="Recurring interval"
														className={formInputClass}
														onChange={(e) =>
															setEditDraft((prev) =>
																prev == null
																	? prev
																	: {
																			...prev,
																			interval: e.target
																				.value as StandardRecurringInterval,
																		},
															)
														}
														value={editDraft.interval}
													>
														{recurringIntervalChoices().map((iv) => (
															<option key={iv} value={iv}>
																{iv === "minute"
																	? "minute (test)"
																	: iv === "test"
																		? "test (30s, dev)"
																		: iv}
															</option>
														))}
													</select>
												</label>
												<label className="space-y-1.5">
													<span className={formLabelClass}>Tag</span>
													<input
														aria-label="Recurring tag"
														className={formInputClass}
														onChange={(e) =>
															setEditDraft((prev) =>
																prev == null
																	? prev
																	: { ...prev, tagLabel: e.target.value },
															)
														}
														placeholder="transport"
														type="text"
														value={editDraft.tagLabel}
													/>
												</label>
											</div>
											{editError ? (
												<p className="text-xs text-destructive">{editError}</p>
											) : null}
											<div className="flex items-center justify-end gap-2">
												<button
													aria-label="Cancel recurring edit"
													className="inline-flex h-9 items-center rounded-md border border-border px-3 text-xs font-medium hover:bg-accent disabled:opacity-50"
													disabled={editBusy}
													onClick={handleCancelEdit}
													type="button"
												>
													Cancel
												</button>
												<button
													aria-label="Save recurring changes"
													className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
													disabled={editBusy}
													type="submit"
												>
													{editBusy ? "Saving..." : "Save changes"}
												</button>
											</div>
										</form>
									) : null}
								</li>
							);
						})}
					</ul>
				</div>
			</section>
		</SpaceWorkspaceLayout>
	);
};
