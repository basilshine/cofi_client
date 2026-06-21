import type {
	CapturePacket as ApiCapturePacket,
	ExpenseRecord,
} from "@cofi/api";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useUserFormat } from "../../../shared/hooks/useUserFormat";
import { apiClient } from "../../../shared/lib/apiClient";
import {
	type CapturePacketCounts,
	type CapturePacketSummary,
	capturePacketEntityCountLabel,
	capturePacketSummaryFromApi,
	capturePacketSummaryLine,
} from "../../../shared/lib/capturePacketSummary";
import {
	EntityListItem,
	EntityMicro,
	type EntityViewModel,
} from "../../../shared/lib/entityPresentation";
import {
	expenseStatusTone,
	toExpenseRecordEntity,
} from "../../../shared/lib/expensePresentation";
import { SpaceExpenseDetailPanel } from "./SpaceExpenseDetailPanel";

type Props = {
	spaceId: string | number;
	spaceExpenseRecords: ExpenseRecord[] | null;
	listLoading: boolean;
	listError: string | null;
	onReloadList: () => void;
	selectedExpenseId: string | number | null;
	onSelectExpense: (expenseId: string | number) => void;
	onCloseExpense: () => void;
	/** When true, this rail supports the dedicated Space Expenses route. */
	expensesWorkspaceRoute?: boolean;
	spaceName?: string | null;
};

const packetIconKeys: Array<keyof CapturePacketCounts> = [
	"expenses",
	"benefits",
	"people",
	"splits",
	"future",
	"documents",
];

const emptyPacketCounts = (): CapturePacketCounts => ({
	expenses: 0,
	benefits: 0,
	people: 0,
	splits: 0,
	future: 0,
	documents: 0,
});

const aggregatePacketCounts = (
	packets: Array<CapturePacketSummary<unknown>>,
): CapturePacketCounts =>
	packets.reduce<CapturePacketCounts>((counts, packet) => {
		for (const key of packetIconKeys) counts[key] += packet.counts[key];
		return counts;
	}, emptyPacketCounts());

const packetHref = (
	spaceId: string | number,
	sourceDocumentId: string | number,
): string =>
	`/console/review?spaceId=${encodeURIComponent(String(spaceId))}&sourceDocumentId=${encodeURIComponent(String(sourceDocumentId))}`;

const packetEntity = (
	packet: CapturePacketSummary<unknown>,
	spaceId: string | number,
	pendingCount: number,
): EntityViewModel => ({
	id: String(packet.sourceDocumentId),
	visualKey: "reviewPacket",
	label: "Capture",
	title: packet.title,
	subtitle: capturePacketSummaryLine(packet.counts),
	detail: packet.meta,
	href: packetHref(spaceId, packet.sourceDocumentId),
	status: pendingCount > 0 ? "Needs review" : "Created",
	meta: packetIconKeys
		.map((key) => {
			const count = packet.counts[key];
			return capturePacketEntityCountLabel(key, count);
		})
		.filter((value): value is string => Boolean(value)),
});

export const ChatExpenseRightPanelContent = ({
	spaceId,
	spaceExpenseRecords,
	listLoading,
	listError,
	onReloadList,
	selectedExpenseId,
	onSelectExpense,
	onCloseExpense,
	expensesWorkspaceRoute = false,
	spaceName = null,
}: Props) => {
	const { formatMoney, formatDateTime } = useUserFormat();
	const [capturePackets, setCapturePackets] = useState<ApiCapturePacket[]>([]);
	const [captureLoading, setCaptureLoading] = useState(false);
	const [captureError, setCaptureError] = useState<string | null>(null);
	const spaceLabel = spaceName?.trim() || "this space";
	const reviewHref = `/console/review?spaceId=${encodeURIComponent(String(spaceId))}`;

	const loadCapturePackets = useCallback(async () => {
		if (expensesWorkspaceRoute) return;
		const numericSpaceId = Number(spaceId);
		if (!Number.isFinite(numericSpaceId) || numericSpaceId <= 0) return;
		setCaptureLoading(true);
		setCaptureError(null);
		try {
			const response = await apiClient.spaces.listCapturePackets(
				numericSpaceId,
				{
					includeRecords: true,
					limit: 12,
				},
			);
			setCapturePackets(response.captures ?? []);
		} catch (err) {
			setCaptureError(
				err instanceof Error ? err.message : "Failed to load captures.",
			);
			setCapturePackets([]);
		} finally {
			setCaptureLoading(false);
		}
	}, [expensesWorkspaceRoute, spaceId]);

	useEffect(() => {
		void loadCapturePackets();
	}, [loadCapturePackets]);

	const stats = useMemo(() => {
		const list = spaceExpenseRecords ?? [];
		let recorded = 0;
		let needsReview = 0;
		let approved = 0;
		let linkedCaptures = 0;
		for (const tx of list) {
			const tone = expenseStatusTone(tx.status);
			if (tx.source_document_id != null) linkedCaptures += 1;
			if (tone === "needs_review") needsReview += 1;
			else if (tone === "approved") approved += 1;
			else if (tone !== "cancelled") recorded += 1;
		}
		const recentRecords = list
			.filter((tx) => {
				const tone = expenseStatusTone(tx.status);
				return tone !== "needs_review" && tone !== "cancelled";
			})
			.slice()
			.sort((a, b) => {
				const ta = a.created_at ? Date.parse(a.created_at) : 0;
				const tb = b.created_at ? Date.parse(b.created_at) : 0;
				return tb - ta;
			})
			.slice(0, 4);
		return {
			total: list.length,
			recorded,
			needsReview,
			approved,
			linkedCaptures,
			recentRecords,
		};
	}, [spaceExpenseRecords]);

	const captureSummaries = useMemo(
		() => capturePackets.map(capturePacketSummaryFromApi),
		[capturePackets],
	);
	const captureCounts = useMemo(
		() => aggregatePacketCounts(captureSummaries),
		[captureSummaries],
	);
	const pendingCaptureCount = useMemo(
		() =>
			capturePackets.filter((packet) => Number(packet.pending_count ?? 0) > 0)
				.length,
		[capturePackets],
	);
	const totalCaptureOutcomes = packetIconKeys.reduce(
		(total, key) => total + captureCounts[key],
		0,
	);

	if (selectedExpenseId != null) {
		return (
			<SpaceExpenseDetailPanel
				expenseId={selectedExpenseId}
				formatDateTime={formatDateTime}
				formatMoney={formatMoney}
				onClose={onCloseExpense}
				onReloadList={onReloadList}
				spaceId={spaceId}
			/>
		);
	}

	if (!expensesWorkspaceRoute) {
		return (
			<div className="flex h-full min-h-0 flex-col overflow-y-auto border-l border-[rgba(120,100,80,0.12)] bg-[linear-gradient(180deg,#fdfaf5_0%,#f5f0e8_100%)] px-4 py-5 sm:px-5">
				<div className="mx-auto w-full max-w-md space-y-5">
					<div>
						<p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8b651f]">
							Capture context
						</p>
						<h2 className="mt-1 font-display text-lg font-bold tracking-tight text-foreground">
							Captures in {spaceLabel}
						</h2>
						<p className="mt-1 text-sm leading-relaxed text-muted-foreground">
							Review what Ceits found from chat, receipts, voice, and text.
							Expenses, benefits, people, splits, and recurring hints stay
							grouped under their source capture.
						</p>
					</div>

					{captureError ? (
						<div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
							{captureError}
						</div>
					) : null}

					<section
						aria-labelledby="capture-rail-summary"
						className="rounded-2xl border border-[rgba(172,124,35,0.18)] bg-[rgba(255,252,246,0.88)] p-4 shadow-sm"
					>
						<div className="flex items-start justify-between gap-3">
							<div>
								<h3
									className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
									id="capture-rail-summary"
								>
									Review work
								</h3>
								<p className="mt-1 text-sm text-muted-foreground">
									{pendingCaptureCount > 0
										? `${pendingCaptureCount} ${pendingCaptureCount === 1 ? "capture needs" : "captures need"} review.`
										: "No captures are waiting for review."}
								</p>
							</div>
							<Link
								className="inline-flex h-9 shrink-0 items-center rounded-lg bg-[rgba(55,45,30,0.9)] px-3 text-xs font-semibold text-[#fffaf0] shadow-sm transition hover:bg-[rgba(45,38,28,0.95)]"
								to={reviewHref}
							>
								Open review
							</Link>
						</div>
						<dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
							<div>
								<dt className="text-xs font-medium text-muted-foreground">
									Captures
								</dt>
								<dd className="mt-0.5 text-lg font-bold tabular-nums text-foreground">
									{capturePackets.length}
								</dd>
							</div>
							<div>
								<dt className="text-xs font-medium text-[#7a4510]">Outcomes</dt>
								<dd className="mt-0.5 text-lg font-bold tabular-nums text-[#5a3008]">
									{totalCaptureOutcomes}
								</dd>
							</div>
							<div>
								<dt className="text-xs font-medium text-[#7a5210]">Benefits</dt>
								<dd className="mt-0.5 text-lg font-bold tabular-nums text-[#5a3008]">
									{captureCounts.benefits}
								</dd>
							</div>
							<div>
								<dt className="text-xs font-medium text-[#355a3c]">People</dt>
								<dd className="mt-0.5 text-lg font-bold tabular-nums text-[#2d4a32]">
									{captureCounts.people}
								</dd>
							</div>
						</dl>
					</section>

					{captureLoading && capturePackets.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							Loading capture queue…
						</p>
					) : null}

					{!captureLoading && capturePackets.length === 0 ? (
						<p className="rounded-2xl border border-dashed border-[rgba(120,100,80,0.18)] bg-white/60 px-4 py-4 text-sm leading-relaxed text-muted-foreground">
							No captures in this space yet. Send text, voice, or a receipt from
							chat and Ceits will keep the review work here.
						</p>
					) : null}

					{captureSummaries.length > 0 ? (
						<section className="space-y-2">
							<div className="flex items-center justify-between gap-3">
								<h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
									Recent captures
								</h3>
								<button
									className="rounded-full border border-[rgba(120,100,80,0.18)] bg-white/70 px-3 py-1 text-[11px] font-semibold text-muted-foreground transition hover:bg-white hover:text-foreground disabled:opacity-50"
									disabled={captureLoading}
									onClick={() => void loadCapturePackets()}
									type="button"
								>
									{captureLoading ? "Refreshing…" : "Refresh"}
								</button>
							</div>
							<div className="space-y-2">
								{captureSummaries.slice(0, 6).map((packet) => {
									const source = capturePackets.find(
										(item) =>
											Number(item.source_document_id) ===
											Number(packet.sourceDocumentId),
									);
									const pendingCount = Number(source?.pending_count ?? 0);
									return (
										<EntityListItem
											density="compact"
											entity={packetEntity(packet, spaceId, pendingCount)}
											key={packet.sourceDocumentId}
											trailing={
												<span className="rounded-full border border-[rgba(120,100,80,0.16)] bg-[rgba(255,252,246,0.9)] px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
													#{packet.sourceDocumentId}
												</span>
											}
										/>
									);
								})}
							</div>
						</section>
					) : null}
				</div>
			</div>
		);
	}

	return (
		<div className="flex h-full min-h-0 flex-col overflow-y-auto border-l border-[rgba(120,100,80,0.12)] bg-[linear-gradient(180deg,#fdfaf5_0%,#f5f0e8_100%)] px-4 py-5 sm:px-5">
			<div className="mx-auto w-full max-w-md space-y-5">
				<div>
					<h2 className="font-display text-lg font-bold tracking-tight text-foreground">
						{expensesWorkspaceRoute ? "Expense context" : "Space captures"}
					</h2>
					<p className="mt-1 text-sm leading-relaxed text-muted-foreground">
						{expensesWorkspaceRoute
							? `Select a saved expense record from ${spaceLabel} to inspect line items, source capture, and saved splits.`
							: `Review what Ceits found from chat, receipts, voice, and text in ${spaceLabel}. Expense records are one possible outcome of a capture.`}
					</p>
				</div>

				{listError ? (
					<div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
						{listError}
					</div>
				) : null}

				{listLoading && !spaceExpenseRecords?.length ? (
					<p className="text-sm text-muted-foreground">
						{expensesWorkspaceRoute ? "Loading expenses…" : "Loading captures…"}
					</p>
				) : null}

				{!listLoading &&
				spaceExpenseRecords &&
				spaceExpenseRecords.length === 0 ? (
					<p className="text-sm leading-relaxed text-muted-foreground">
						{expensesWorkspaceRoute
							? "No saved expense records yet. New spending starts in Captures review or from the global Add expense action."
							: "No capture results in this space yet. Send text, voice, or a receipt from chat."}
					</p>
				) : null}

				{spaceExpenseRecords && spaceExpenseRecords.length > 0 ? (
					<section
						aria-labelledby="exp-rail-summary"
						className="rounded-2xl border border-[rgba(120,100,80,0.18)] bg-[rgba(255,252,246,0.85)] p-4 shadow-sm"
					>
						<h3
							className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
							id="exp-rail-summary"
						>
							{expensesWorkspaceRoute
								? "Records"
								: "Saved outcomes from captures"}
						</h3>
						<dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
							<div>
								<dt className="text-xs font-medium text-muted-foreground">
									Expense records
								</dt>
								<dd className="mt-0.5 text-lg font-bold tabular-nums text-foreground">
									{stats.total}
								</dd>
							</div>
							<div>
								<dt className="text-xs font-medium text-[#7a4510]">Recorded</dt>
								<dd className="mt-0.5 text-lg font-bold tabular-nums text-[#5a3008]">
									{stats.recorded}
								</dd>
							</div>
							<div>
								<dt className="text-xs font-medium text-[#7a5210]">
									Needs review
								</dt>
								<dd className="mt-0.5 text-lg font-bold tabular-nums text-[#5a3008]">
									{stats.needsReview}
								</dd>
							</div>
							<div>
								<dt className="text-xs font-medium text-[#355a3c]">
									Linked captures
								</dt>
								<dd className="mt-0.5 text-lg font-bold tabular-nums text-[#2d4a32]">
									{stats.linkedCaptures}
								</dd>
							</div>
						</dl>

						{stats.recentRecords.length > 0 ? (
							<div className="mt-4 border-t border-[rgba(120,100,80,0.12)] pt-3">
								<h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
									Recent records
								</h4>
								<ul className="mt-2 space-y-2">
									{stats.recentRecords.map((tx) => {
										const entity = toExpenseRecordEntity(tx, {
											amountLabel: formatMoney(tx.total),
										});
										return (
											<li key={`ap-${String(tx.id)}`}>
												<button
													className="flex w-full items-start justify-between gap-2 rounded-lg border border-transparent px-2 py-1.5 text-left text-sm transition hover:border-[rgba(120,100,80,0.15)] hover:bg-white/80"
													onClick={() => onSelectExpense(tx.id)}
													type="button"
												>
													<span className="min-w-0">
														<EntityMicro
															entity={{
																label: entity.label,
																visualKey: entity.visualKey,
															}}
														/>
														<span className="mt-1 block truncate font-medium text-foreground">
															{entity.title}
														</span>
														{entity.subtitle ? (
															<span className="mt-0.5 block truncate text-xs text-muted-foreground">
																{entity.subtitle}
															</span>
														) : null}
													</span>
													<span className="shrink-0 pt-1 tabular-nums text-muted-foreground">
														{formatMoney(tx.total)}
													</span>
												</button>
											</li>
										);
									})}
								</ul>
							</div>
						) : null}

						<div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[rgba(120,100,80,0.12)] pt-3">
							{expensesWorkspaceRoute ? (
								<Link
									className="inline-flex h-10 items-center rounded-lg border border-[rgba(120,100,80,0.22)] bg-white/90 px-4 text-sm font-medium text-foreground transition hover:bg-white"
									to={reviewHref}
								>
									Open captures
								</Link>
							) : (
								<Link
									className="inline-flex h-10 items-center rounded-lg bg-[rgba(55,45,30,0.9)] px-4 text-sm font-semibold text-[#fffaf0] shadow-sm transition hover:bg-[rgba(45,38,28,0.95)]"
									to={reviewHref}
								>
									Review captures
								</Link>
							)}
						</div>
					</section>
				) : null}
			</div>
		</div>
	);
};
