import { EntityMicro } from "../../../shared/lib/entityPresentation";

type SplitParticipantPreview = {
	id: string;
	name: string;
};

export type SplitDecisionRow = {
	id: string;
	title: string;
	dateLabel: string;
	contextLine: string;
	sourceStatus: string;
	/** Human-readable status for the meta line (e.g. Draft, Approved). */
	sourceStatusShort?: string;
	spaceLabel?: string;
	participantsPreview: SplitParticipantPreview[];
	participantsCount: number;
	participantsFallback: string;
	myShareLabel: string;
	totalLabel: string;
	statusLabel: "Needs confirmation" | "Split saved" | "Draft" | "Cancelled";
	sourceDocumentId?: number;
};

type SpaceSplitDecisionListProps = {
	title: string;
	eyebrow: string;
	description: string;
	rows: SplitDecisionRow[];
	emptyTitle: string;
	emptySubtitle: string;
	variant: "pending" | "confirmed";
	selectedId: string | null;
	onSelect: (id: string) => void;
};

const statusPillClass = (
	status: SplitDecisionRow["statusLabel"],
	isSelected: boolean,
) => {
	if (status === "Needs confirmation") {
		return isSelected
			? "border-[rgba(189,143,64,0.72)] bg-[rgba(189,143,64,0.34)] text-[rgba(72,48,8,0.98)] shadow-[0_1px_0_rgba(255,255,255,0.4)_inset]"
			: "border-[rgba(189,143,64,0.52)] bg-[rgba(189,143,64,0.26)] text-[rgba(88,58,14,0.98)] shadow-[0_1px_0_rgba(255,255,255,0.35)_inset]";
	}
	if (status === "Draft") {
		return "border-[rgba(120,117,132,0.34)] bg-[rgba(120,117,132,0.16)] text-[rgba(70,68,82,0.92)]";
	}
	if (status === "Cancelled") {
		return "border-destructive/35 bg-destructive/10 text-destructive";
	}
	return "border-[rgba(120,154,124,0.34)] bg-[rgba(120,154,124,0.14)] text-[#527255]";
};

export const SpaceSplitDecisionList = ({
	title,
	eyebrow,
	description,
	rows,
	emptyTitle,
	emptySubtitle,
	variant,
	selectedId,
	onSelect,
}: SpaceSplitDecisionListProps) => {
	return (
		<section className="rounded-xl border border-border/60 bg-background/70">
			<div className="border-b border-border/50 px-4 py-4 lg:px-6">
				<p className="eyebrow">{eyebrow}</p>
				<h2 className="text-xl font-semibold tracking-tight text-foreground">
					{title}
				</h2>
				<p className="mt-1 text-sm text-muted-foreground">{description}</p>
			</div>
			{rows.length === 0 ? (
				<div className="px-4 py-6 lg:px-6">
					<p className="text-sm font-medium text-foreground/85">{emptyTitle}</p>
					<p className="mt-1 text-sm text-muted-foreground">{emptySubtitle}</p>
				</div>
			) : (
				<ul className="space-y-2 px-2 py-2 lg:px-3">
					{rows.map((row) => {
						const isSelected = selectedId === row.id;
						const rowTone =
							row.statusLabel === "Needs confirmation"
								? "bg-[rgba(255,248,236,0.9)]"
								: row.statusLabel === "Draft"
									? "bg-[rgba(248,244,238,0.86)]"
									: row.statusLabel === "Cancelled"
										? "bg-[rgba(246,244,243,0.78)]"
										: variant === "pending"
											? "bg-[rgba(255,248,236,0.84)]"
											: "bg-[rgba(239,247,239,0.62)]";
						const rowBorder =
							row.statusLabel === "Needs confirmation"
								? "border-[rgba(189,143,64,0.26)]"
								: row.statusLabel === "Draft"
									? "border-[rgba(130,126,142,0.24)]"
									: row.statusLabel === "Cancelled"
										? "border-border/45"
										: "border-[rgba(120,154,124,0.24)]";
						const recedeClass =
							selectedId && !isSelected ? "opacity-[0.75]" : "opacity-100";
						const isPendingDecision = row.statusLabel === "Needs confirmation";
						const isCalmConfirmed = row.statusLabel === "Split saved";
						const showShare = !(
							row.participantsCount <= 1 && row.myShareLabel === row.totalLabel
						);
						const selectedSurface =
							"relative z-[1] origin-left scale-[1.005] rounded-xl border border-[rgba(190,170,135,0.45)] border-l-[3px] border-l-[rgba(199,154,95,0.42)] bg-gradient-to-b from-[#fefdfb] to-[#f8f6f2] px-3 py-4 shadow-[0_14px_36px_-28px_rgba(45,40,36,0.2)]";
						return (
							<li className="overflow-visible" key={row.id}>
								<button
									className={`w-full rounded-xl text-left transition-all duration-150 hover:shadow-[0_12px_20px_-22px_rgba(31,37,35,0.65)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset ${isSelected ? selectedSurface : `${rowTone} ${rowBorder} border p-3`} ${recedeClass}`}
									onClick={() => onSelect(row.id)}
									type="button"
								>
									<div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_auto] md:items-start">
										<div className="min-w-0">
											<p
												className={`truncate text-[15px] font-semibold ${isCalmConfirmed ? "text-foreground/88" : "text-foreground"} ${isPendingDecision ? "tracking-tight" : ""}`}
											>
												{row.title}
											</p>
											<p className="mt-0.5 truncate text-[12px] text-muted-foreground">
												{row.dateLabel} ·{" "}
												{row.sourceStatusShort ?? row.sourceStatus}
												{row.spaceLabel ? ` · ${row.spaceLabel}` : ""}
											</p>
											<p className="mt-1 truncate text-[12px] leading-snug text-foreground/70">
												{row.contextLine}
											</p>
											{row.sourceDocumentId != null ? (
												<span className="mt-2 inline-flex rounded-full border border-blue-200/80 bg-blue-50/70 px-2 py-0.5 text-[10px] font-semibold text-blue-900">
													Source capture #{row.sourceDocumentId}
												</span>
											) : null}
										</div>
										<div className="min-w-0">
											{row.participantsCount <= 1 ? (
												<p className="text-[12px] text-muted-foreground">
													Single participant
												</p>
											) : row.participantsPreview.length > 0 ? (
												<div className="flex flex-wrap items-center gap-1.5">
													{row.participantsPreview
														.slice(0, 2)
														.map((participant) => (
															<EntityMicro
																entity={{
																	label: participant.name,
																	visualKey: "people",
																}}
																key={participant.id}
															/>
														))}
													{row.participantsPreview.length > 2 ? (
														<span className="text-[11px] text-muted-foreground">
															+{row.participantsPreview.length - 2}
														</span>
													) : null}
												</div>
											) : (
												<p className="text-[12px] text-muted-foreground">
													{row.participantsFallback}
												</p>
											)}
										</div>
										<div className="text-right">
											{showShare ? (
												<p
													className={`text-[13px] font-medium ${isPendingDecision ? "text-foreground/90" : "text-foreground/78"}`}
												>
													My share{" "}
													<span
														className={`font-semibold tabular-nums ${isPendingDecision ? "text-foreground" : "text-foreground/88"}`}
													>
														{row.myShareLabel}
													</span>
												</p>
											) : null}
											<p className="mt-0.5 text-[12px] text-muted-foreground">
												Total{" "}
												<span
													className={`font-medium tabular-nums ${isPendingDecision ? "text-foreground/92" : "text-foreground/82"}`}
												>
													{row.totalLabel}
												</span>
											</p>
											<div className="mt-1.5 inline-flex items-center gap-2">
												<span
													className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] ${statusPillClass(row.statusLabel, isSelected)}`}
												>
													{row.statusLabel}
												</span>
												<span aria-hidden className="text-muted-foreground/45">
													›
												</span>
											</div>
										</div>
									</div>
								</button>
							</li>
						);
					})}
				</ul>
			)}
		</section>
	);
};
