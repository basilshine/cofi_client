import type { RecurringExpense } from "@cofi/api";
import { useCallback, useEffect, useState } from "react";
import { useUserFormat } from "../../shared/hooks/useUserFormat";
import { apiClient } from "../../shared/lib/apiClient";

export const RecurringSchedulesPage = () => {
	const { formatMoney, formatDateTime } = useUserFormat();
	const [items, setItems] = useState<RecurringExpense[] | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [successMessage, setSuccessMessage] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [actingId, setActingId] = useState<string | number | null>(null);

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
			await apiClient.finances.recurring.pause(id);
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
			await apiClient.finances.recurring.resume(id);
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

	const busy = actingId != null;

	return (
		<section className="space-y-6">
			<div className="space-y-2">
				<h1 className="text-xl font-semibold">Recurring schedules</h1>
				<p className="text-sm text-muted-foreground">
					Pause to stop future runs without removing the schedule. Delete
					removes it permanently.
				</p>
			</div>

			<div className="flex flex-wrap items-center gap-2">
				<button
					className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium hover:bg-accent disabled:opacity-50"
					disabled={isLoading || busy}
					onClick={() => void load()}
					type="button"
				>
					Refresh
				</button>
			</div>

			{successMessage ? (
				<output
					aria-live="polite"
					className="block rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-900 dark:text-emerald-100"
				>
					{successMessage}
				</output>
			) : null}

			{errorMessage ? (
				<div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
					{errorMessage}
				</div>
			) : null}

			{isLoading && !items ? (
				<p className="text-sm text-muted-foreground">Loading…</p>
			) : null}

			{items?.length === 0 ? (
				<p className="text-sm text-muted-foreground">
					No recurring schedules yet. Create one from Chat (manual or draft
					confirm) or another client.
				</p>
			) : null}

			<ul className="space-y-3">
				{(items ?? []).map((row) => {
					const id = row.id;
					const paused = row.paused === true;
					const isActing = actingId != null && id != null && actingId === id;
					const label = row.name?.trim() || "Schedule";
					const tag = row.tag_label ?? row.tagLabel;
					return (
						<li
							className="rounded-lg border border-border bg-card p-4 shadow-sm"
							key={id ?? `${label}-${row.interval}`}
						>
							<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
								<div className="min-w-0 space-y-1">
									<div className="flex flex-wrap items-center gap-2">
										<span className="font-medium text-foreground">{label}</span>
										<span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
											{row.interval ?? "—"}
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
									<div className="text-sm text-muted-foreground">
										<span className="font-semibold text-foreground">
											{formatMoney(row.amount ?? 0)}
										</span>
										{tag ? (
											<span className="ml-2">
												· tag: <span className="text-foreground">{tag}</span>
											</span>
										) : null}
									</div>
									<div className="text-xs text-muted-foreground">
										Next run:{" "}
										{(row.next_run ?? row.nextRun)
											? formatDateTime(String(row.next_run ?? row.nextRun))
											: "—"}{" "}
										· Started:{" "}
										{(row.start_date ?? row.startDate)
											? formatDateTime(String(row.start_date ?? row.startDate))
											: "—"}
										{row.space_id != null || row.spaceId != null ? (
											<>
												{" "}
												· Space:{" "}
												<span className="text-foreground">
													{String(row.space_id ?? row.spaceId)}
												</span>
											</>
										) : null}
									</div>
								</div>
								<div className="flex shrink-0 flex-wrap gap-2">
									{paused ? (
										<button
											aria-label={`Resume ${label}`}
											className="inline-flex h-9 items-center rounded-md border border-border px-3 text-xs font-medium hover:bg-accent disabled:opacity-50"
											disabled={busy}
											onClick={() => void handleResume(row)}
											type="button"
										>
											{isActing ? "…" : "Resume"}
										</button>
									) : (
										<button
											aria-label={`Pause ${label}`}
											className="inline-flex h-9 items-center rounded-md border border-border px-3 text-xs font-medium hover:bg-accent disabled:opacity-50"
											disabled={busy}
											onClick={() => void handlePause(row)}
											type="button"
										>
											{isActing ? "…" : "Pause"}
										</button>
									)}
									<button
										aria-label={`Delete ${label}`}
										className="inline-flex h-9 items-center rounded-md border border-destructive/40 px-3 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
										disabled={busy}
										onClick={() => void handleDelete(row)}
										type="button"
									>
										{isActing ? "…" : "Delete"}
									</button>
								</div>
							</div>
						</li>
					);
				})}
			</ul>
		</section>
	);
};
