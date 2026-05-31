import { Link } from "react-router-dom";
import {
	EntityMini,
	type EntityViewModel,
} from "../../../shared/lib/entityPresentation";

export type SplitMemberSummary = {
	id: string;
	name: string;
	exposureLabel: string;
	directionLabel: string;
};

export type SplitActivitySummary = {
	id: string;
	label: string;
	timeLabel: string;
};

export type SplitDetailParticipant = {
	id: string;
	name: string;
	amountLabel: string;
	isCurrentUser?: boolean;
};

export type SelectedSplitDetail = {
	id: string;
	title: string;
	dateLabel: string;
	/** Short calendar-style date for inspector (e.g. Apr 28). */
	dateDisplayLabel: string;
	categoryLabel: string;
	spaceLabel: string;
	totalLabel: string;
	myShareLabel: string;
	/** Sum of other participants' shares (formatted). */
	othersShareLabel: string;
	participantCount: number;
	splitMethod: string;
	sourceStatus: string;
	statusLabel: string;
	participants: SplitDetailParticipant[];
	currentUserId?: number | null;
	reviewTo: string;
	expenseTo: string;
};

type SpaceSplitsRightRailProps = {
	spaceId: number;
	reviewCount: number;
	draftCount: number;
	splitCoveragePercent: number;
	splitActivityCount: number;
	memberExposureCount: number;
	unconfirmedAmountLabel: string;
	membersSummary: SplitMemberSummary[];
	recentActivity: SplitActivitySummary[];
	selectedDetail: SelectedSplitDetail | null;
	moneyFlow: {
		youOweLabel: string;
		youAreOwedLabel: string;
		netLabel: string;
		netTone: "positive" | "negative" | "neutral";
	};
	onCloseDetail: () => void;
};

const toSplitParticipantEntity = (
	participant: SplitDetailParticipant,
): EntityViewModel => ({
	id: participant.id,
	visualKey: "people",
	label: participant.isCurrentUser ? "You" : "Participant",
	title: participant.isCurrentUser ? "You" : participant.name,
	subtitle: participant.amountLabel,
	status: participant.isCurrentUser ? "Your share" : undefined,
});

const toSplitMemberSummaryEntity = (
	member: SplitMemberSummary,
): EntityViewModel => ({
	id: member.id,
	visualKey: "people",
	label: "Member",
	title: member.name,
	subtitle: member.directionLabel,
	detail: member.exposureLabel,
	status: member.exposureLabel,
});

export const SpaceSplitsRightRail = ({
	spaceId,
	reviewCount,
	draftCount,
	splitCoveragePercent,
	splitActivityCount,
	memberExposureCount,
	unconfirmedAmountLabel,
	membersSummary,
	recentActivity,
	selectedDetail,
	moneyFlow,
	onCloseDetail,
}: SpaceSplitsRightRailProps) => {
	const detailStatusLabel =
		selectedDetail?.sourceStatus === "cancelled"
			? "Cancelled"
			: selectedDetail?.sourceStatus === "draft"
				? "Draft"
				: selectedDetail?.statusLabel === "Needs confirmation"
					? "Needs confirmation"
					: "Confirmed";
	const detailStatusClass =
		detailStatusLabel === "Cancelled"
			? "border-destructive/35 bg-destructive/10 text-destructive"
			: detailStatusLabel === "Draft"
				? "border-[rgba(120,117,132,0.34)] bg-[rgba(120,117,132,0.16)] text-[rgba(70,68,82,0.92)]"
				: detailStatusLabel === "Needs confirmation"
					? "border-[rgba(189,143,64,0.42)] bg-[rgba(189,143,64,0.18)] text-[rgba(111,78,22,0.95)]"
					: "border-[rgba(120,154,124,0.42)] bg-[rgba(120,154,124,0.18)] text-[#4d6e53]";

	const isCancelled = detailStatusLabel === "Cancelled";

	const statusSecondaryText =
		selectedDetail == null
			? null
			: detailStatusLabel === "Needs confirmation"
				? "Waiting for your approval."
				: detailStatusLabel === "Cancelled"
					? "This will not affect balances."
					: detailStatusLabel === "Draft"
						? "Not applied to balances until confirmed."
						: detailStatusLabel === "Confirmed" &&
								selectedDetail.statusLabel === "Split saved" &&
								selectedDetail.sourceStatus !== "draft"
							? `Already included in ${selectedDetail.spaceLabel} balances.`
							: null;

	/** Shown only when it adds context beyond Status + subtitle (no duplicate balance messaging). */
	const decisionHintText =
		selectedDetail == null
			? null
			: detailStatusLabel === "Needs confirmation"
				? `Approving this will update ${selectedDetail.spaceLabel} balances.`
				: detailStatusLabel === "Cancelled"
					? "No action is required unless you want to review the source expense."
					: null;

	const whatWillHappenText =
		selectedDetail == null
			? null
			: detailStatusLabel === "Cancelled"
				? null
				: selectedDetail.statusLabel === "Split saved" &&
						detailStatusLabel === "Confirmed" &&
						selectedDetail.sourceStatus !== "draft"
					? null
					: selectedDetail.participantCount <= 1
						? "After confirmation, balances in this space will update."
						: `This split will assign ${selectedDetail.myShareLabel} to you and ${selectedDetail.othersShareLabel} to other participants.`;

	if (selectedDetail) {
		return (
			<div className="flex flex-col gap-4">
				<section className="rounded-2xl border border-border/55 bg-gradient-to-b from-[#fefdfb] to-[#f5f3ef] p-5 shadow-[0_12px_32px_-24px_rgba(45,40,36,0.22)]">
					<div className="flex items-start justify-between gap-3">
						<div>
							<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground/62">
								Split detail
							</p>
							<p className="mt-2 text-[15px] font-semibold leading-snug text-foreground">
								{selectedDetail.title}
							</p>
						</div>
						<button
							className="rounded-md border border-border/60 bg-background/85 px-2.5 py-1 text-[11px] font-medium text-foreground/80 transition hover:border-border hover:bg-background hover:text-foreground"
							onClick={onCloseDetail}
							type="button"
						>
							Close
						</button>
					</div>
				</section>

				<section className="rounded-2xl border border-border/60 bg-card p-5 shadow-[0_8px_24px_-20px_rgba(31,37,35,0.2)]">
					<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground/58">
						Expense summary
					</p>
					<div className="mt-3 space-y-2 text-sm">
						<p className="text-[16px] font-semibold leading-snug text-foreground">
							{selectedDetail.title}
						</p>
						<p className="text-[13px] leading-relaxed text-muted-foreground">
							{selectedDetail.dateDisplayLabel} · {selectedDetail.categoryLabel}{" "}
							· {selectedDetail.spaceLabel}
						</p>
						<p className="text-xl font-semibold tabular-nums tracking-tight text-foreground">
							{selectedDetail.totalLabel}
						</p>
					</div>
				</section>

				<section className="rounded-2xl border border-border/60 bg-card p-5 shadow-[0_8px_24px_-20px_rgba(31,37,35,0.2)]">
					<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground/58">
						Split summary
					</p>
					<div className="mt-3 space-y-2.5 text-[13px] leading-snug">
						<div className="flex items-baseline justify-between gap-4">
							<span className="shrink-0 text-foreground/70">Total</span>
							<span className="min-w-0 text-right font-semibold tabular-nums text-foreground">
								{selectedDetail.totalLabel}
							</span>
						</div>
						<div className="flex items-baseline justify-between gap-4">
							<span className="shrink-0 text-foreground/70">Your share</span>
							<span className="min-w-0 text-right font-semibold tabular-nums text-foreground">
								{selectedDetail.myShareLabel}
							</span>
						</div>
						<div className="flex items-baseline justify-between gap-4">
							<span className="shrink-0 text-foreground/70">Participants</span>
							<span className="min-w-0 text-right font-semibold tabular-nums text-foreground">
								{selectedDetail.participantCount}
							</span>
						</div>
						<div className="flex items-baseline justify-between gap-4">
							<span className="shrink-0 text-foreground/70">Method</span>
							<span className="min-w-0 text-right font-semibold text-foreground">
								{selectedDetail.splitMethod}
							</span>
						</div>
					</div>
					<div className="mt-4 border-t border-border/40 pt-4">
						<p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
							Participants
						</p>
						{selectedDetail.participantCount <= 1 ? (
							<p className="mt-2 text-[13px] text-foreground/80">
								Single participant
							</p>
						) : selectedDetail.participants.length > 0 ? (
							<ul className="mt-2 space-y-2.5">
								{selectedDetail.participants.map((participant) => (
									<li key={participant.id}>
										<EntityMini
											entity={toSplitParticipantEntity(participant)}
										/>
									</li>
								))}
							</ul>
						) : (
							<p className="mt-2 text-xs text-muted-foreground">
								{/* TODO: fill participant distribution from split API when missing */}
								Participant distribution unavailable yet.
							</p>
						)}
					</div>
				</section>

				<section className="rounded-2xl border border-border/50 bg-card/80 p-5 shadow-[0_4px_18px_-16px_rgba(31,37,35,0.14)]">
					<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground/52">
						Status
					</p>
					<p
						className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${detailStatusClass}`}
					>
						{detailStatusLabel}
					</p>
					{statusSecondaryText ? (
						<p className="mt-3 text-[13px] leading-snug text-foreground/82">
							{statusSecondaryText}
						</p>
					) : null}
				</section>

				{decisionHintText ? (
					<section className="rounded-2xl border border-[rgba(120,154,124,0.22)] bg-[linear-gradient(165deg,rgba(244,250,246,0.88)_0%,rgba(255,252,248,0.95)_100%)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
						<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground/50">
							Decision hint
						</p>
						<p className="mt-2.5 text-[13px] leading-relaxed text-foreground/88">
							{decisionHintText}
						</p>
					</section>
				) : null}

				{whatWillHappenText ? (
					<section className="rounded-2xl border border-border/50 bg-muted/15 p-5 shadow-[0_4px_18px_-16px_rgba(31,37,35,0.12)]">
						<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground/52">
							What will happen
						</p>
						<p className="mt-3 text-[13px] leading-relaxed text-foreground/85">
							{whatWillHappenText}
						</p>
					</section>
				) : null}

				<div className="rounded-2xl border border-border/45 bg-muted/15 p-5">
					<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground/52">
						Next steps
					</p>
					<div className="mt-4 flex flex-col gap-3">
						{isCancelled ? (
							<Link
								className="inline-flex h-10 items-center justify-center rounded-xl border border-border/55 bg-background px-4 text-sm font-medium text-foreground/90 shadow-[0_6px_20px_-16px_rgba(31,37,35,0.12)] transition hover:border-border/80 hover:bg-background"
								to={selectedDetail.reviewTo}
							>
								Review source
							</Link>
						) : (
							<Link
								className="inline-flex h-11 items-center justify-center rounded-xl bg-foreground px-4 text-sm font-semibold tracking-wide text-background shadow-[0_14px_32px_-18px_rgba(20,22,21,0.55)] transition hover:bg-foreground/92 hover:shadow-[0_16px_36px_-18px_rgba(20,22,21,0.5)] active:scale-[0.99]"
								to={selectedDetail.reviewTo}
							>
								Review split
							</Link>
						)}
						<Link
							className="inline-flex h-10 items-center justify-center rounded-xl border border-border/45 bg-background/90 px-4 text-sm font-medium text-foreground/88 transition hover:border-border/70 hover:bg-background"
							to={selectedDetail.expenseTo}
						>
							Open expense
						</Link>
						<button
							className="inline-flex h-9 items-center justify-center px-2 text-sm font-medium text-muted-foreground underline-offset-[5px] transition hover:text-foreground/75 hover:underline"
							onClick={onCloseDetail}
							type="button"
						>
							Close detail
						</button>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			<section className="rounded-2xl border border-[rgba(189,143,64,0.28)] bg-[linear-gradient(180deg,rgba(255,250,241,0.97)_0%,rgba(255,245,229,0.9)_100%)] p-4 shadow-[0_12px_20px_-18px_rgba(143,104,43,0.72)]">
				<p className="eyebrow">Decision queue</p>
				<p className="mt-1 text-[15px] font-semibold text-foreground">
					{reviewCount === 0
						? "Nothing waiting for confirmation"
						: reviewCount === 1
							? "1 decision needs your confirmation"
							: `${reviewCount} decisions need your confirmation`}
				</p>
				<p className="mt-1 text-xs text-foreground/75">
					{draftCount} draft{draftCount === 1 ? "" : "s"} still pending split
					review.
				</p>
				<Link
					className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-lg bg-primary px-3 text-xs font-semibold uppercase tracking-[0.1em] text-primary-foreground"
					to={`/console/review?spaceId=${encodeURIComponent(String(spaceId))}`}
				>
					Open split reviews
				</Link>
			</section>

			<section className="rounded-2xl border border-border/70 bg-card p-4 soft-shadow inner-glow">
				<p className="eyebrow">Money flow</p>
				<div className="mt-2 space-y-2 text-[13px]">
					<div className="flex items-baseline justify-between gap-3">
						<span className="text-foreground/75">You owe</span>
						<span className="font-semibold tabular-nums text-foreground">
							{moneyFlow.youOweLabel}
						</span>
					</div>
					<div className="flex items-baseline justify-between gap-3">
						<span className="text-foreground/75">You are owed</span>
						<span className="font-semibold tabular-nums text-foreground">
							{moneyFlow.youAreOwedLabel}
						</span>
					</div>
					<div className="mt-5 border-t border-border/40 pt-5">
						<div className="flex items-baseline justify-between gap-3 text-[15px]">
							<span className="text-foreground/75">Net balance</span>
							<span
								className={`font-semibold tabular-nums ${
									moneyFlow.netTone === "positive"
										? "text-[#5a7a5f]"
										: moneyFlow.netTone === "negative"
											? "text-[rgba(150,118,62,0.95)]"
											: "text-foreground"
								}`}
							>
								{moneyFlow.netLabel}
							</span>
						</div>
					</div>
				</div>
			</section>

			<section className="rounded-2xl border border-border/70 bg-card p-4 soft-shadow inner-glow">
				<p className="eyebrow">Split health</p>
				<ul className="mt-2 space-y-2">
					<li className="rounded-lg bg-background/50 px-3 py-2">
						<p className="text-xs text-muted-foreground">Split coverage</p>
						<p className="text-lg font-semibold text-foreground">
							{splitCoveragePercent}%
						</p>
					</li>
					<li className="rounded-lg bg-background/50 px-3 py-2">
						<p className="text-xs text-muted-foreground">
							Split activity events
						</p>
						<p className="text-lg font-semibold text-foreground">
							{splitActivityCount}
						</p>
					</li>
					<li className="rounded-lg bg-background/50 px-3 py-2">
						<p className="text-xs text-muted-foreground">
							Members with exposure
						</p>
						<p className="text-lg font-semibold text-foreground">
							{memberExposureCount}
						</p>
					</li>
					<li className="rounded-lg bg-background/50 px-3 py-2">
						<p className="text-xs text-muted-foreground">Unconfirmed amount</p>
						<p className="text-lg font-semibold text-foreground">
							{unconfirmedAmountLabel}
						</p>
					</li>
				</ul>
			</section>

			<section className="rounded-2xl border border-border/70 bg-card p-4 soft-shadow inner-glow">
				<p className="eyebrow">Members summary</p>
				{membersSummary.length === 0 ? (
					<p className="mt-2 text-xs text-muted-foreground">
						Member summary unavailable. TODO: owed/owes direction.
					</p>
				) : (
					<ul className="mt-2 space-y-1.5">
						{membersSummary.map((member) => (
							<li key={member.id}>
								<EntityMini entity={toSplitMemberSummaryEntity(member)} />
							</li>
						))}
					</ul>
				)}
			</section>

			<section className="rounded-2xl border border-border/70 bg-card p-4 soft-shadow inner-glow">
				<p className="eyebrow">Recent split activity</p>
				{recentActivity.length === 0 ? (
					<p className="mt-2 text-xs text-muted-foreground">
						No split activity events yet.
					</p>
				) : (
					<ul className="mt-2 space-y-1.5">
						{recentActivity.map((entry) => (
							<li
								className="rounded-lg bg-background/45 px-3 py-2"
								key={entry.id}
							>
								<p className="text-sm text-foreground/90">{entry.label}</p>
								<p className="text-[11px] text-muted-foreground">
									{entry.timeLabel}
								</p>
							</li>
						))}
					</ul>
				)}
			</section>
		</div>
	);
};
