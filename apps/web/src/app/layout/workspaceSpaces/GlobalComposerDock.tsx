import {
	CheckCircle2,
	Clock3,
	FileText,
	Image,
	ListChecks,
	type LucideIcon,
	MessageSquareText,
	Mic,
	Plus,
	ScanSearch,
	Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../../contexts/AuthContext";
import {
	type ComposerPayload,
	type ComposerState,
	SmartTextareaComposer,
	type SmartTextareaComposerHandle,
} from "../../../features/chatlog/components/SmartTextareaComposer";
import { composerCandidateVisual } from "../../../shared/lib/entityVisual";
import {
	createManualDraftInSpace,
	parseCaptureIntentText,
	parseCapturePhoto,
	parseCaptureText,
	parseCaptureVoice,
} from "../../../shared/lib/quickCaptureTransactions";
import { useWorkspaceSpaces } from "./WorkspaceSpacesContext";
import {
	type GlobalComposerCandidateBundle,
	summarizeCaptureIntentPreview,
	summarizeCapturePreview,
} from "./globalComposerFlow";
import { readGlobalComposerIntent } from "./globalComposerIntent";
import {
	hasNativeChatComposer,
	hasSettingsActionDock,
} from "./globalComposerRoutePolicy";
import { useGlobalComposerFlow } from "./useGlobalComposerFlow";

const toDraftItems = (
	items:
		| {
				name: string;
				amount: number;
				tags?: string[];
		  }[]
		| undefined,
) =>
	(items ?? [])
		.filter((item) => item.name?.trim() && Number(item.amount) !== 0)
		.map((item) => ({
			name: item.name.trim(),
			amount: Number(item.amount),
			tags: item.tags,
		}));

const spaceIdFromPath = (pathname: string): string | null => {
	const match = pathname.match(
		/^\/console\/(?:spaces|settings\/spaces)\/([^/]+)/,
	);
	return match?.[1] ? decodeURIComponent(match[1]) : null;
};

const spaceIdFromSearch = (search: string): string | null => {
	const params = new URLSearchParams(search);
	return params.get("spaceId") ?? params.get("space_id");
};

const askPayloadToMessage = (
	payload: Extract<ComposerPayload, { composer_mode: "ask" }>,
) => {
	if (payload.ask_type === "period_expenses") {
		return payload.content
			? `How much did I spend on ${payload.content} ${payload.period.toLowerCase()}?`
			: `How much did I spend ${payload.period.toLowerCase()}?`;
	}
	if (payload.ask_type === "find_expense")
		return `Find expense: ${payload.content}`;
	if (payload.ask_type === "next_payment") {
		return `What's my next payment? (${payload.period})`;
	}
	if (payload.ask_type === "split_balance") {
		return payload.content
			? `Who owes whom? ${payload.content}`
			: "Who owes whom in this space?";
	}
	return payload.content;
};

const bundleHasAny = (
	bundle: GlobalComposerCandidateBundle,
	kinds: GlobalComposerCandidateBundle["candidates"][number]["kind"][],
) => bundle.candidates.some((candidate) => kinds.includes(candidate.kind));

const isPromoCapabilityGate = (bundle?: GlobalComposerCandidateBundle) =>
	bundle?.intent === "promo_only" &&
	!bundleHasAny(bundle, ["promo"]) &&
	bundle.capabilityNotice != null;

const candidateOnlyStatus = (
	bundle: GlobalComposerCandidateBundle,
	spaceName: string,
) => {
	if (bundleHasAny(bundle, ["promo", "loyalty"])) {
		return `Benefits candidate ready in ${spaceName}`;
	}
	if (bundleHasAny(bundle, ["split", "participant"])) {
		return `Split candidate ready in ${spaceName}`;
	}
	if (
		bundleHasAny(bundle, [
			"payment_proof",
			"privacy",
			"merge",
			"supporting_document",
			"space_suggestion",
		])
	) {
		return `Document candidate ready for review in ${spaceName}`;
	}
	if (bundle.candidates.length) {
		return `Parsed result ready for review in ${spaceName}`;
	}
	if (bundle.capabilityNotice) {
		return `Basic parse finished in ${spaceName}; smart candidates are gated by plan.`;
	}
	return "Ceits parsed the input, but needs clearer expense details before creating a draft.";
};

const withReviewParams = (
	href: string,
	params: {
		sourceDocumentId?: number;
		section?: string;
	},
): string => {
	if (params.sourceDocumentId == null && !params.section) return href;
	const [pathAndSearch, hash] = href.split("#");
	const [pathname, search] = pathAndSearch.split("?");
	const next = new URLSearchParams(search ?? "");
	if (params.sourceDocumentId != null) {
		next.set("sourceDocumentId", String(params.sourceDocumentId));
	}
	if (params.section) next.set("section", params.section);
	return `${pathname}?${next.toString()}${hash ? `#${hash}` : ""}`;
};

type ComposerFlowStatus = "done" | "current" | "pending" | "blocked";

type ComposerFlowItem = {
	key: string;
	title: string;
	detail: string;
	status: ComposerFlowStatus;
	icon: LucideIcon;
};

const composerStatusClass = (status: ComposerFlowStatus): string => {
	if (status === "done") {
		return "border-[rgba(72,112,76,0.22)] bg-[rgba(236,247,238,0.86)] text-[#355a3c]";
	}
	if (status === "current") {
		return "border-[rgba(181,131,52,0.32)] bg-[rgba(255,240,208,0.78)] text-[#73501b]";
	}
	if (status === "blocked") {
		return "border-[rgba(160,70,58,0.28)] bg-[rgba(255,232,228,0.78)] text-[#7a3026]";
	}
	return "border-[rgba(120,100,80,0.16)] bg-white/64 text-muted-foreground";
};

const inputKindLabel = (bundle: GlobalComposerCandidateBundle): string => {
	if (bundle.inputKind === "voice") return "Voice captured";
	if (bundle.inputKind === "photo") return "Image uploaded";
	if (bundle.inputKind === "ask") return "Question captured";
	if (bundle.inputKind === "message") return "Message captured";
	return "Text captured";
};

const inputKindIcon = (bundle: GlobalComposerCandidateBundle): LucideIcon => {
	if (bundle.inputKind === "voice") return Mic;
	if (bundle.inputKind === "photo") return Image;
	return MessageSquareText;
};

const candidateSummaryText = (
	bundle: GlobalComposerCandidateBundle,
): string => {
	if (!bundle.candidates.length) {
		return bundle.capabilityNotice ? "Plan gated" : "Needs details";
	}
	return bundle.candidates
		.slice(0, 3)
		.map((candidate) =>
			candidate.count > 1
				? `${candidate.count} ${candidate.label}`
				: candidate.label,
		)
		.join(", ");
};

const buildComposerFlowItems = (
	bundle: GlobalComposerCandidateBundle,
): ComposerFlowItem[] => [
	{
		key: "capture",
		title: "Capture",
		detail: inputKindLabel(bundle),
		status: "done",
		icon: inputKindIcon(bundle),
	},
	{
		key: "parse",
		title: "Parse",
		detail: bundle.modelProfile
			? `${bundle.modelProfile} model`
			: "Structure detected",
		status: "done",
		icon: ScanSearch,
	},
	{
		key: "candidates",
		title: "Candidates",
		detail: candidateSummaryText(bundle),
		status:
			bundle.candidates.length || bundle.capabilityNotice ? "done" : "blocked",
		icon: ListChecks,
	},
	{
		key: "review",
		title: "Review",
		detail: bundle.requiresReview ? "Needs decision" : "Ready to save",
		status: bundle.requiresReview ? "current" : "done",
		icon: Clock3,
	},
	{
		key: "finish",
		title: "Save",
		detail: "After review",
		status: bundle.requiresReview ? "pending" : "current",
		icon: CheckCircle2,
	},
];

const candidateIcon = (
	kind: GlobalComposerCandidateBundle["candidates"][number]["kind"],
): LucideIcon => composerCandidateVisual(kind).icon;

const candidateActionText = (
	kind: GlobalComposerCandidateBundle["candidates"][number]["kind"],
	count: number,
	label: string,
): string => {
	const prefix = count > 1 ? `${count} ${label}` : label;
	if (kind === "expense") return "Expense draft candidate created";
	if (kind === "expense_item") return `${prefix} extracted from the capture`;
	if (kind === "promo") return "Promo candidate separated from the expense";
	if (kind === "loyalty") return "Loyalty or bonus signal detected";
	if (kind === "split") return "Split proposal prepared for review";
	if (kind === "participant")
		return "Participant placeholder candidate created";
	if (kind === "recurring") return "Recurring rule candidate prepared";
	if (kind === "membership") return "Membership period candidate detected";
	if (kind === "reminder") return "Reminder candidate detected";
	if (kind === "payment_proof")
		return "Payment proof detected as a document signal";
	if (kind === "privacy") return "Privacy signal detected";
	if (kind === "merge") return "Possible duplicate or merge signal detected";
	if (kind === "supporting_document")
		return "Supporting document signal detected";
	if (kind === "space_suggestion") return "Target space suggestion detected";
	return `${prefix} detected`;
};

const ComposerFlowInfographic = ({
	bundle,
	reviewHref,
}: {
	bundle: GlobalComposerCandidateBundle;
	reviewHref: string;
}) => {
	const flowItems = buildComposerFlowItems(bundle);
	const actionItems = [
		{
			key: "source",
			label: bundle.sourceDocumentId
				? `Source document #${bundle.sourceDocumentId} saved`
				: "Capture source received",
			icon: FileText,
		},
		{
			key: "intent",
			label: `Intent: ${bundle.intent.replace(/_/g, " ")}`,
			icon: Sparkles,
		},
		...bundle.candidates.map((candidate) => ({
			key: candidate.kind,
			label: candidateActionText(
				candidate.kind,
				candidate.count,
				candidate.label,
			),
			icon: candidateIcon(candidate.kind),
		})),
	];

	return (
		<div className="rounded-2xl border border-[rgba(120,100,80,0.14)] bg-[rgba(255,252,246,0.72)] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
			<div className="grid gap-2 sm:grid-cols-5">
				{flowItems.map((item, index) => {
					const Icon = item.icon;
					return (
						<div className="relative min-w-0" key={item.key}>
							{index > 0 ? (
								<span className="absolute -left-1.5 top-5 hidden h-px w-3 bg-[rgba(120,100,80,0.16)] sm:block" />
							) : null}
							<div
								className={[
									"min-h-[5.4rem] rounded-xl border px-2.5 py-2",
									composerStatusClass(item.status),
								].join(" ")}
							>
								<div className="flex items-center justify-between gap-2">
									<Icon className="h-4 w-4 shrink-0" size={16} />
									<span className="rounded-full bg-white/62 px-1.5 py-0.5 text-[10px] font-bold tabular-nums">
										{index + 1}
									</span>
								</div>
								<p className="mt-2 truncate text-xs font-bold">{item.title}</p>
								<p className="mt-0.5 line-clamp-2 text-[11px] leading-4 opacity-78">
									{item.detail}
								</p>
							</div>
						</div>
					);
				})}
			</div>
			<div className="mt-2 grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
				<div className="min-w-0">
					<p className="px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
						Action history
					</p>
					<div className="mt-1 flex min-w-0 gap-1.5 overflow-x-auto pb-1">
						{actionItems.slice(0, 8).map((item) => {
							const Icon = item.icon;
							return (
								<span
									className="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-full bg-white/72 px-2.5 text-[11px] font-semibold text-foreground/76 shadow-[0_0_0_1px_rgba(87,70,49,0.08)]"
									key={item.key}
								>
									<Icon className="h-3.5 w-3.5 shrink-0" size={14} />
									{item.label}
								</span>
							);
						})}
						{actionItems.length > 8 ? (
							<span className="inline-flex min-h-8 shrink-0 items-center rounded-full border border-dashed border-border bg-transparent px-2.5 text-[11px] font-semibold text-muted-foreground">
								+{actionItems.length - 8} more
							</span>
						) : null}
					</div>
				</div>
				<Link
					className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-full bg-[rgba(68,58,42,0.94)] px-4 text-xs font-bold text-[#fffaf0] shadow-[0_12px_26px_-18px_rgba(44,32,18,0.58)] transition-[background-color,box-shadow,transform] hover:bg-[rgba(50,43,32,0.98)] hover:shadow-[0_14px_30px_-18px_rgba(44,32,18,0.64)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					to={reviewHref}
				>
					Review parsed result
				</Link>
			</div>
		</div>
	);
};

type DockReviewSection = {
	key: string;
	title: string;
	description: string;
	addLabel: string;
	foundLabel: string;
	kinds: GlobalComposerCandidateBundle["candidates"][number]["kind"][];
	href: string;
	reviewSection: string;
};

const candidateCountFor = (
	bundle: GlobalComposerCandidateBundle,
	kinds: DockReviewSection["kinds"],
): number =>
	bundle.candidates
		.filter((candidate) => kinds.includes(candidate.kind))
		.reduce((sum, candidate) => sum + candidate.count, 0);

const DockReviewDrawer = ({
	benefitsHref,
	bundle,
	expensesHref,
	reviewHref,
	splitsHref,
}: {
	benefitsHref: string;
	bundle: GlobalComposerCandidateBundle;
	expensesHref: string;
	reviewHref: string;
	splitsHref: string;
}) => {
	const sections: DockReviewSection[] = [
		{
			key: "expense",
			title: "Expense",
			description: "Merchant, amount, date, category, and draft status.",
			addLabel: "Add expense",
			foundLabel: "Expense candidate",
			kinds: ["expense"],
			href: expensesHref,
			reviewSection: "expenses",
		},
		{
			key: "items",
			title: "Items",
			description: "Products or service lines extracted from the capture.",
			addLabel: "Add item",
			foundLabel: "Parsed items",
			kinds: ["expense_item"],
			href: expensesHref,
			reviewSection: "expenses",
		},
		{
			key: "people",
			title: "People",
			description: "Participants and placeholders to use in splits.",
			addLabel: "Add person",
			foundLabel: "People candidate",
			kinds: ["participant"],
			href: reviewHref,
			reviewSection: "people",
		},
		{
			key: "splits",
			title: "Splits",
			description: "Who paid, who is involved, and how shares are calculated.",
			addLabel: "Add split",
			foundLabel: "Split candidate",
			kinds: ["split"],
			href: splitsHref,
			reviewSection: "splits",
		},
		{
			key: "benefits",
			title: "Promos",
			description: "Promo codes, loyalty, and future value found in the input.",
			addLabel: "Add promo",
			foundLabel: "Benefit candidate",
			kinds: ["promo", "loyalty"],
			href: benefitsHref,
			reviewSection: "benefits",
		},
		{
			key: "future",
			title: "Recurring",
			description: "Recurring, membership, renewal, or reminder hints.",
			addLabel: "Add recurring",
			foundLabel: "Future action",
			kinds: ["recurring", "membership", "reminder"],
			href: reviewHref,
			reviewSection: "future",
		},
		{
			key: "documents",
			title: "Documents",
			description: "Payment proof, privacy, merge, and supporting documents.",
			addLabel: "Add document",
			foundLabel: "Document signal",
			kinds: ["payment_proof", "privacy", "merge", "supporting_document"],
			href: reviewHref,
			reviewSection: "documents",
		},
	];

	return (
		<div
			className="mt-2 rounded-[1.1rem] border border-[rgba(120,100,80,0.16)] bg-[rgba(255,252,246,0.92)] p-3 shadow-[0_18px_48px_-36px_rgba(44,32,18,0.58),inset_0_1px_0_rgba(255,255,255,0.78)]"
			data-testid="global-composer-review-drawer"
		>
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="min-w-0">
					<p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
						Review drawer
					</p>
					<h3 className="mt-0.5 text-sm font-bold text-foreground">
						Complete this parsed result
					</h3>
					<p className="mt-0.5 max-w-2xl text-xs leading-5 text-muted-foreground [text-wrap:pretty]">
						Use detected candidates where Ceits found them. Add missing parts
						manually when the parse did not include them.
					</p>
				</div>
				<Link
					className="inline-flex min-h-9 items-center rounded-full bg-[rgba(68,58,42,0.92)] px-3 text-xs font-bold text-[#fffaf0] shadow-[0_10px_24px_-18px_rgba(44,32,18,0.58)] transition-[background-color,box-shadow,transform] hover:bg-[rgba(50,43,32,0.96)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					to={reviewHref}
				>
					Open full review
				</Link>
			</div>
			<div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
				{sections.map((section) => {
					const count = candidateCountFor(bundle, section.kinds);
					const hasCandidate = count > 0;
					const visual = composerCandidateVisual(section.kinds[0]);
					const Icon = visual.icon;
					const sectionHref = hasCandidate
						? withReviewParams(reviewHref, {
								section: section.reviewSection,
								sourceDocumentId: bundle.sourceDocumentId,
							})
						: section.href;
					return (
						<div
							className={[
								"min-w-0 rounded-xl border p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]",
								hasCandidate
									? "border-[rgba(72,112,76,0.2)] bg-[rgba(236,247,238,0.68)]"
									: "border-[rgba(120,100,80,0.13)] bg-white/62",
							].join(" ")}
							key={section.key}
						>
							<div className="flex items-start gap-2">
								<span
									className={[
										"inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-[inset_0_0_0_1px_rgba(87,70,49,0.08)]",
										hasCandidate
											? visual.softToneClass
											: "bg-[rgba(248,245,238,0.9)] text-muted-foreground",
									].join(" ")}
								>
									<Icon className="h-4 w-4" size={16} />
								</span>
								<div className="min-w-0">
									<div className="flex min-w-0 items-center gap-1.5">
										<p className="truncate text-xs font-bold text-foreground">
											{section.title}
										</p>
										{hasCandidate ? (
											<span className="rounded-full bg-white/68 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-[#355a3c]">
												{count}
											</span>
										) : null}
									</div>
									<p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-muted-foreground">
										{hasCandidate ? section.foundLabel : section.description}
									</p>
								</div>
							</div>
							<Link
								className={[
									"mt-2 inline-flex min-h-8 w-full items-center justify-center gap-1.5 rounded-lg px-2 text-[11px] font-bold transition-[background-color,box-shadow,transform] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
									hasCandidate
										? "bg-white/78 text-[#355a3c] shadow-[0_0_0_1px_rgba(72,112,76,0.14)] hover:bg-white"
										: "bg-[rgba(68,58,42,0.06)] text-foreground/78 shadow-[0_0_0_1px_rgba(87,70,49,0.08)] hover:bg-[rgba(68,58,42,0.1)]",
								].join(" ")}
								to={sectionHref}
							>
								{hasCandidate ? (
									<>Review {section.title.toLowerCase()}</>
								) : (
									<>
										<Plus className="h-3.5 w-3.5" size={14} />
										{section.addLabel}
									</>
								)}
							</Link>
						</div>
					);
				})}
			</div>
		</div>
	);
};

const CandidateBundlePanel = ({
	bundle,
	expensesHref,
	benefitsHref,
	splitsHref,
	reviewHref,
}: {
	bundle: GlobalComposerCandidateBundle;
	expensesHref: string;
	benefitsHref: string;
	splitsHref: string;
	reviewHref: string;
}) => {
	const [isReviewDrawerOpen, setIsReviewDrawerOpen] = useState(false);
	const reviewHrefWithSource = withReviewParams(reviewHref, {
		sourceDocumentId: bundle.sourceDocumentId,
	});

	if (!bundle.candidates.length && !bundle.capabilityNotice) return null;

	const visibleCandidates = bundle.candidates.slice(0, 5);
	const hiddenCount = bundle.candidates.length - visibleCandidates.length;

	return (
		<div
			className="border-t border-border/45 bg-muted/25 px-3.5 py-2"
			data-testid="global-composer-candidate-summary"
		>
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div className="min-w-0">
					<p className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
						Parsed result status
					</p>
					{visibleCandidates.length ? (
						<div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
							{visibleCandidates.map((candidate) => (
								<span
									className="inline-flex min-h-7 items-center rounded-full bg-background px-2.5 text-[11px] font-semibold text-foreground/78 shadow-[0_0_0_1px_rgba(87,70,49,0.1)]"
									key={candidate.kind}
								>
									{candidate.count > 1
										? `${candidate.count} ${candidate.label}`
										: candidate.label}
								</span>
							))}
							{hiddenCount > 0 ? (
								<span className="inline-flex h-6 items-center rounded-full border border-dashed border-border bg-transparent px-2 text-[11px] font-semibold text-muted-foreground">
									+{hiddenCount} more
								</span>
							) : null}
						</div>
					) : null}
					{bundleHasAny(bundle, [
						"payment_proof",
						"privacy",
						"merge",
						"supporting_document",
					]) ? (
						<p className="mt-1.5 max-w-3xl text-[11px] leading-4 text-muted-foreground">
							This result should be reviewed as a document signal, not saved as
							a duplicate expense automatically.
						</p>
					) : null}
					{bundle.capabilityNotice ? (
						<p className="mt-1.5 max-w-3xl text-[11px] leading-4 text-muted-foreground">
							{bundle.capabilityNotice}
						</p>
					) : null}
				</div>
				<div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
					<button
						className="inline-flex min-h-8 shrink-0 items-center rounded-full bg-[rgba(68,58,42,0.92)] px-3 text-[11px] font-semibold text-[#fffaf0] shadow-[0_0_0_1px_rgba(87,70,49,0.1),0_8px_18px_-16px_rgba(44,32,18,0.42)] transition-[background-color,box-shadow,transform] hover:bg-[rgba(50,43,32,0.96)] hover:shadow-[0_0_0_1px_rgba(87,70,49,0.16),0_10px_22px_-16px_rgba(44,32,18,0.48)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						onClick={() => setIsReviewDrawerOpen((current) => !current)}
						type="button"
					>
						{isReviewDrawerOpen ? "Hide review" : "Review parsed result"}
					</button>
				</div>
			</div>
			{isReviewDrawerOpen ? (
				<DockReviewDrawer
					benefitsHref={benefitsHref}
					bundle={bundle}
					expensesHref={expensesHref}
					reviewHref={reviewHrefWithSource}
					splitsHref={splitsHref}
				/>
			) : null}
			<div className="mt-2">
				<ComposerFlowInfographic
					bundle={bundle}
					reviewHref={reviewHrefWithSource}
				/>
			</div>
		</div>
	);
};

const clarificationActionClass =
	"inline-flex min-h-10 shrink-0 items-center rounded-full bg-background px-3.5 text-xs font-semibold text-foreground/82 shadow-[0_0_0_1px_rgba(87,70,49,0.1),0_8px_18px_-16px_rgba(44,32,18,0.42)] transition-[background-color,box-shadow,transform] hover:bg-card hover:shadow-[0_0_0_1px_rgba(87,70,49,0.16),0_10px_22px_-16px_rgba(44,32,18,0.48)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-45";

const ClarificationActionsPanel = ({
	benefitsHref,
	billingHref,
	bundle,
	chatHref,
	chatDraftText,
	disabled,
	hasSpaceContext,
	onAddExpense,
	onAskCeits,
	onCreateSpace,
	spacesHref,
}: {
	benefitsHref: string;
	billingHref: string;
	bundle?: GlobalComposerCandidateBundle;
	chatHref: string;
	chatDraftText: string | null;
	disabled: boolean;
	hasSpaceContext: boolean;
	onAddExpense: () => void;
	onAskCeits: () => void;
	onCreateSpace: () => void;
	spacesHref: string;
}) => {
	const promoGate = isPromoCapabilityGate(bundle);
	const title = promoGate ? "Promo found" : "Choose next step";
	const body = promoGate
		? "This looks like a promo code. Basic can detect it, but saving promo candidates is available in Medium or Premium."
		: "Ceits is not sure whether this should become a record, a question, or a chat message.";

	return (
		<div
			className="border-t border-border/35 bg-[linear-gradient(180deg,rgba(255,251,244,0.78),rgba(255,248,235,0.55))] px-3.5 py-2.5"
			data-testid="global-composer-clarification-actions"
		>
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div className="min-w-0">
					<p className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
						{title}
					</p>
					<p className="mt-0.5 max-w-xl text-[11px] leading-4 text-muted-foreground [text-wrap:pretty]">
						{body}
					</p>
				</div>
				<div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
					{promoGate ? (
						<>
							<Link className={clarificationActionClass} to={billingHref}>
								Test plan
							</Link>
							<Link className={clarificationActionClass} to={benefitsHref}>
								Open benefits
							</Link>
						</>
					) : (
						<button
							className={clarificationActionClass}
							disabled={disabled}
							onClick={onAddExpense}
							type="button"
						>
							Add expense
						</button>
					)}
					<button
						className={clarificationActionClass}
						disabled={disabled}
						onClick={onAskCeits}
						type="button"
					>
						Ask Ceits
					</button>
					{hasSpaceContext ? (
						<Link
							className={clarificationActionClass}
							state={
								chatDraftText?.trim()
									? { composerDraftText: chatDraftText.trim() }
									: undefined
							}
							to={chatHref}
						>
							Open chat
						</Link>
					) : (
						<>
							<Link className={clarificationActionClass} to={spacesHref}>
								Choose space
							</Link>
							<button
								className={clarificationActionClass}
								onClick={onCreateSpace}
								type="button"
							>
								New space
							</button>
						</>
					)}
				</div>
			</div>
		</div>
	);
};

type GlobalComposerDockProps = {
	isCollapsed: boolean;
	onCollapsedChange: (isCollapsed: boolean) => void;
};

type PendingComposerTarget = {
	state?: ComposerState;
	text?: string;
};

export const GlobalComposerDock = ({
	isCollapsed,
	onCollapsedChange,
}: GlobalComposerDockProps) => {
	const location = useLocation();
	const navigate = useNavigate();
	const { user } = useAuth();
	const { selectedSpaceId, spaces, isLoading, setCreateSpaceDialogOpen } =
		useWorkspaceSpaces();
	const composerRef = useRef<SmartTextareaComposerHandle | null>(null);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const mediaChunksRef = useRef<BlobPart[]>([]);

	const [busy, setBusy] = useState(false);
	const [isRecording, setIsRecording] = useState(false);
	const [pendingComposerTarget, setPendingComposerTarget] =
		useState<PendingComposerTarget | null>(null);
	const [clarificationDraftText, setClarificationDraftText] = useState<
		string | null
	>(null);
	const [statusText, setStatusText] = useState<string | null>(null);
	const [errorText, setErrorText] = useState<string | null>(null);
	const {
		flow: composerFlow,
		beginDetecting,
		clarify,
		complete,
		fail,
		showCandidateSummary,
	} = useGlobalComposerFlow();

	const hasNativeComposer = hasNativeChatComposer(location.pathname);
	const settingsActionDock = hasSettingsActionDock(location.pathname);
	const routeSpaceId = spaceIdFromPath(location.pathname);
	const querySpaceId = spaceIdFromSearch(location.search);
	const activeSpaceId = routeSpaceId ?? querySpaceId ?? selectedSpaceId;
	const activeSpace = useMemo(
		() =>
			activeSpaceId == null
				? null
				: ((spaces ?? []).find(
						(space) => String(space.id) === String(activeSpaceId),
					) ?? null),
		[activeSpaceId, spaces],
	);
	const activeSpaceName =
		activeSpace?.name?.trim() ||
		(activeSpaceId == null ? "Choose a space" : `Space ${activeSpaceId}`);
	const hasSpaceContext = activeSpaceId != null;
	const contextSource = routeSpaceId
		? "page"
		: querySpaceId
			? "linked page"
			: selectedSpaceId != null
				? "workspace"
				: null;
	const userDisplay =
		user?.name?.trim() || user?.email?.split("@")[0] || "Account";
	const userInitial = userDisplay.trim().charAt(0).toUpperCase() || "?";
	const spaceSettingsHref =
		activeSpaceId == null
			? "/console/settings/spaces"
			: `/console/settings/spaces/${encodeURIComponent(String(activeSpaceId))}`;
	const activeSpaceOverviewHref =
		activeSpaceId == null
			? "/console/settings/spaces"
			: `/console/spaces/${encodeURIComponent(String(activeSpaceId))}/overview`;
	const activeSpaceChatHref =
		activeSpaceId == null
			? "/console/settings/spaces"
			: `/console/chat?spaceId=${encodeURIComponent(String(activeSpaceId))}`;
	const activeSpaceBenefitsHref =
		activeSpaceId == null
			? "/console/settings/spaces"
			: `/console/spaces/${encodeURIComponent(String(activeSpaceId))}/benefits`;
	const activeSpaceSplitsHref =
		activeSpaceId == null
			? "/console/settings/spaces"
			: `/console/spaces/${encodeURIComponent(String(activeSpaceId))}/splits`;
	const activeSpaceExpensesHref =
		activeSpaceId == null
			? "/console/settings/spaces"
			: `/console/chat/expenses?spaceId=${encodeURIComponent(String(activeSpaceId))}`;
	const activeSpaceReviewHref =
		activeSpaceId == null
			? "/console/review"
			: `/console/review?spaceId=${encodeURIComponent(String(activeSpaceId))}`;
	const activeSpaceActivityHref =
		activeSpaceId == null
			? "/console/home"
			: `/console/chat?spaceId=${encodeURIComponent(String(activeSpaceId))}&view=activity`;

	const disabled = busy || isLoading || !hasSpaceContext;
	const composerNotice =
		errorText ??
		statusText ??
		(!hasSpaceContext
			? "Choose a space before capturing expenses or posting messages."
			: (composerFlow.message ?? null));

	const showTransientStatus = useCallback((message: string) => {
		setStatusText(message);
		window.setTimeout(() => {
			setStatusText((current) => (current === message ? null : current));
		}, 2600);
	}, []);

	const createDraftFromParsed = useCallback(
		async (
			spaceId: string | number,
			description: string,
			items:
				| {
						name: string;
						amount: number;
						tags?: string[];
				  }[]
				| undefined,
			sourceDocumentId?: number,
		) => {
			const draftItems = toDraftItems(items);
			if (!draftItems.length) {
				return false;
			}
			await createManualDraftInSpace(spaceId, description, draftItems, {
				sourceDocumentId,
			});
			return true;
		},
		[],
	);

	const handleSubmit = useCallback(
		async (payload: ComposerPayload) => {
			if (activeSpaceId == null) {
				clarify(
					"Choose a space first. Soon Ceits will also help create or suggest the right space from here.",
				);
				return;
			}
			setBusy(true);
			setErrorText(null);
			try {
				if (payload.composer_mode === "expense") {
					if (payload.expense_input_type === "text") {
						beginDetecting("text");
						const text = payload.content.trim();
						const parsed = await parseCaptureText(text, {
							spaceId: activeSpaceId,
						});
						const bundle = summarizeCapturePreview(parsed, {
							fallbackIntent: "expense",
							inputKind: "text",
							spaceId: activeSpaceId,
						});
						showCandidateSummary(bundle);
						const savedDraft = await createDraftFromParsed(
							activeSpaceId,
							text,
							parsed.items,
							parsed.source_document_id,
						);
						showTransientStatus(
							savedDraft
								? `Draft saved to ${activeSpaceName}`
								: candidateOnlyStatus(bundle, activeSpaceName),
						);
					} else if (payload.expense_input_type === "photo") {
						beginDetecting("photo");
						const parsed = await parseCapturePhoto(payload.file, {
							spaceId: activeSpaceId,
						});
						const bundle = summarizeCapturePreview(parsed, {
							fallbackIntent: "expense",
							inputKind: "photo",
							spaceId: activeSpaceId,
						});
						showCandidateSummary(bundle);
						const savedDraft = await createDraftFromParsed(
							activeSpaceId,
							payload.file.name || "Receipt photo",
							parsed.items,
							parsed.source_document_id,
						);
						showTransientStatus(
							savedDraft
								? `Receipt draft saved to ${activeSpaceName}`
								: candidateOnlyStatus(bundle, activeSpaceName),
						);
					}
					return;
				}

				const text =
					payload.composer_mode === "message"
						? payload.content.trim()
						: askPayloadToMessage(payload).trim();
				if (!text) return;
				setClarificationDraftText(null);
				beginDetecting(payload.composer_mode === "message" ? "message" : "ask");
				const intentPreview = await parseCaptureIntentText(text, {
					spaceId: activeSpaceId,
				});
				const bundle = summarizeCaptureIntentPreview(intentPreview, {
					fallbackIntent: payload.composer_mode,
					inputKind: payload.composer_mode === "message" ? "message" : "ask",
					spaceId: activeSpaceId,
				});
				if (bundle.clarificationMessage) {
					setClarificationDraftText(text);
					clarify(bundle.clarificationMessage, bundle);
					return;
				}
				if (bundle.candidates.length > 0 || bundle.capabilityNotice) {
					showCandidateSummary(bundle);
					showTransientStatus(candidateOnlyStatus(bundle, activeSpaceName));
					return;
				}
				if (
					intentPreview.next_action === "open_chat" ||
					intentPreview.intent === "chat_message"
				) {
					setClarificationDraftText(text);
					complete(`Open chat to send this in ${activeSpaceName}`);
					showTransientStatus(`Open chat to send this in ${activeSpaceName}`);
					return;
				}
				complete(`Ceits understood this as ${intentPreview.intent}.`);
				showTransientStatus(
					`Ceits understood this as ${intentPreview.intent}.`,
				);
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Composer failed";
				fail(message);
				setErrorText(message);
			} finally {
				setBusy(false);
			}
		},
		[
			activeSpaceId,
			activeSpaceName,
			beginDetecting,
			clarify,
			complete,
			createDraftFromParsed,
			fail,
			showCandidateSummary,
			showTransientStatus,
		],
	);

	const handleStartRecording = useCallback(async () => {
		if (disabled) return;
		setErrorText(null);
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			const recorder = new MediaRecorder(stream);
			mediaChunksRef.current = [];
			recorder.addEventListener("dataavailable", (event) => {
				if (event.data.size > 0) mediaChunksRef.current.push(event.data);
			});
			recorder.addEventListener(
				"stop",
				() => {
					for (const track of stream.getTracks()) {
						track.stop();
					}
				},
				{ once: true },
			);
			mediaRecorderRef.current = recorder;
			recorder.start();
			setIsRecording(true);
		} catch (error) {
			setErrorText(
				error instanceof Error
					? error.message
					: "Microphone permission denied.",
			);
		}
	}, [disabled]);

	const handleStopRecording = useCallback(async () => {
		if (activeSpaceId == null) return;
		const recorder = mediaRecorderRef.current;
		if (!recorder || recorder.state !== "recording") return;
		const stopped = new Promise<void>((resolve) => {
			recorder.addEventListener("stop", () => resolve(), { once: true });
		});
		recorder.stop();
		await stopped;
		setIsRecording(false);

		const blob = new Blob(mediaChunksRef.current, {
			type: recorder.mimeType || "audio/webm",
		});
		mediaChunksRef.current = [];
		mediaRecorderRef.current = null;
		if (!blob.size) return;

		setBusy(true);
		setErrorText(null);
		try {
			beginDetecting("voice");
			const parsed = await parseCaptureVoice(
				blob,
				recorder.mimeType || "audio/webm",
				{ spaceId: activeSpaceId },
			);
			const bundle = summarizeCapturePreview(parsed, {
				fallbackIntent: "expense",
				inputKind: "voice",
				spaceId: activeSpaceId,
			});
			showCandidateSummary(bundle);
			const savedDraft = await createDraftFromParsed(
				activeSpaceId,
				parsed.transcription?.trim() || "Voice expense",
				parsed.items,
				parsed.source_document_id,
			);
			showTransientStatus(
				savedDraft
					? `Voice draft saved to ${activeSpaceName}`
					: candidateOnlyStatus(bundle, activeSpaceName),
			);
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to parse voice";
			fail(message);
			setErrorText(message);
		} finally {
			setBusy(false);
		}
	}, [
		activeSpaceId,
		activeSpaceName,
		beginDetecting,
		createDraftFromParsed,
		fail,
		showCandidateSummary,
		showTransientStatus,
	]);

	const handleCancelRecording = useCallback(() => {
		const recorder = mediaRecorderRef.current;
		if (recorder?.state === "recording") recorder.stop();
		mediaRecorderRef.current = null;
		mediaChunksRef.current = [];
		setIsRecording(false);
	}, []);

	useEffect(() => {
		if (isCollapsed || !pendingComposerTarget) return;
		if (pendingComposerTarget.state && pendingComposerTarget.text) {
			composerRef.current?.composeText(
				pendingComposerTarget.state,
				pendingComposerTarget.text,
			);
		} else if (pendingComposerTarget.state) {
			composerRef.current?.navigateTo(pendingComposerTarget.state);
		}
		setPendingComposerTarget(null);
	}, [isCollapsed, pendingComposerTarget]);

	const expandTo = useCallback(
		(state?: ComposerState, text?: string) => {
			const targetText = text?.trim();
			setPendingComposerTarget(
				state || targetText ? { state, text: targetText } : null,
			);
			onCollapsedChange(false);
		},
		[onCollapsedChange],
	);

	const expandToText = useCallback(
		(state: ComposerState, text: string | null) => {
			const targetText = text?.trim();
			if (!targetText) {
				expandTo(state);
				return;
			}
			if (isCollapsed) {
				expandTo(state, targetText);
				return;
			}
			composerRef.current?.composeText(state, targetText);
		},
		[expandTo, isCollapsed],
	);

	const handleCollapseToggle = useCallback(() => {
		if (isCollapsed) {
			expandTo();
			return;
		}
		handleCancelRecording();
		onCollapsedChange(true);
	}, [expandTo, handleCancelRecording, isCollapsed, onCollapsedChange]);

	useEffect(() => {
		const intent = readGlobalComposerIntent(location.state);
		if (!intent || hasNativeComposer) return;

		if (intent === "expense") {
			expandTo("expense_method_select");
		} else if (intent === "ask") {
			expandTo("ask_topic_select");
		} else if (intent === "message") {
			expandTo("message_text");
		}

		navigate(
			{
				hash: location.hash,
				pathname: location.pathname,
				search: location.search,
			},
			{ replace: true, state: null },
		);
	}, [
		expandTo,
		hasNativeComposer,
		location.hash,
		location.pathname,
		location.search,
		location.state,
		navigate,
	]);

	if (hasNativeComposer) return null;

	const actionButtonClass =
		"inline-flex min-h-9 shrink-0 items-center rounded-full bg-[rgba(68,58,42,0.92)] px-3.5 text-xs font-semibold text-[#fffaf0] shadow-[0_10px_24px_-18px_rgba(44,32,18,0.58)] transition-[background-color,box-shadow,transform] hover:bg-[rgba(50,43,32,0.96)] hover:shadow-[0_12px_28px_-18px_rgba(44,32,18,0.64)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-45";
	const dockLinkClass =
		"inline-flex min-h-8 shrink-0 items-center rounded-full px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-[background-color,color,transform] hover:bg-background/78 hover:text-foreground active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
	const userLinkClass =
		"inline-flex min-h-10 min-w-0 shrink-0 items-center gap-2 rounded-full bg-background px-3 text-xs font-semibold text-foreground/85 shadow-[0_0_0_1px_rgba(87,70,49,0.1),0_8px_20px_-16px_rgba(44,32,18,0.42)] transition-[background-color,box-shadow,transform] hover:bg-card hover:shadow-[0_0_0_1px_rgba(87,70,49,0.16),0_10px_24px_-16px_rgba(44,32,18,0.48)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
	const settingsActionClass =
		"inline-flex min-h-10 shrink-0 items-center rounded-full bg-card/92 px-3.5 text-xs font-semibold text-foreground/85 shadow-[0_0_0_1px_rgba(87,70,49,0.1),0_8px_20px_-16px_rgba(44,32,18,0.44)] transition-[background-color,box-shadow,transform] hover:bg-background hover:shadow-[0_0_0_1px_rgba(87,70,49,0.16),0_10px_24px_-16px_rgba(44,32,18,0.5)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
	const dockHeaderLinkClass =
		"inline-flex min-h-8 items-center rounded-full px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground transition-[color,transform] hover:text-foreground active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

	if (settingsActionDock) {
		return (
			<div
				className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex justify-center border-t border-border/35 bg-[linear-gradient(180deg,rgba(250,247,240,0.62),rgba(250,247,240,0.9))] px-3 pb-3 pt-2 shadow-[0_-18px_44px_-36px_rgba(44,32,18,0.42)] backdrop-blur-xl sm:px-5"
				data-testid="global-composer-dock"
			>
				<div
					className="pointer-events-auto flex w-full max-w-5xl flex-col gap-2 rounded-[1.35rem] bg-background/96 p-2.5 shadow-[0_0_0_1px_rgba(87,70,49,0.1),0_18px_52px_-34px_rgba(44,32,18,0.5),0_2px_8px_-6px_rgba(44,32,18,0.32)] ring-1 ring-white/65 sm:flex-row sm:items-center sm:justify-between"
					data-testid="settings-action-dock"
				>
					<div className="min-w-0 px-1">
						<p className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
							Settings surface
						</p>
						<p className="mt-0.5 truncate text-sm font-semibold text-foreground">
							{activeSpaceId == null
								? "Account and workspace settings"
								: `${activeSpaceName} settings`}
						</p>
					</div>
					<div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">
						<Link
							className={settingsActionClass}
							to="/console/settings/account"
						>
							Account
						</Link>
						<Link className={settingsActionClass} to="/console/settings/spaces">
							All spaces
						</Link>
						{hasSpaceContext ? (
							<>
								<Link className={settingsActionClass} to={spaceSettingsHref}>
									Space settings
								</Link>
								<Link
									className={settingsActionClass}
									to={activeSpaceOverviewHref}
								>
									Open space
								</Link>
								<Link className={settingsActionClass} to={activeSpaceChatHref}>
									Open chat
								</Link>
							</>
						) : (
							<button
								className={settingsActionClass}
								onClick={() => setCreateSpaceDialogOpen(true)}
								type="button"
							>
								New space
							</button>
						)}
						<Link className={userLinkClass} to="/console/settings/account">
							<span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-bold uppercase text-secondary-foreground">
								{userInitial}
							</span>
							<span className="hidden max-w-[8rem] truncate sm:inline">
								{userDisplay}
							</span>
						</Link>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div
			className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex justify-center border-t border-border/35 bg-[linear-gradient(180deg,rgba(250,247,240,0.56),rgba(250,247,240,0.92))] px-3 pb-3 pt-2 shadow-[0_-18px_44px_-36px_rgba(44,32,18,0.42)] backdrop-blur-xl sm:px-5"
			data-testid="global-composer-dock"
		>
			<div className="pointer-events-auto w-full max-w-5xl overflow-hidden rounded-[1.35rem] bg-background/96 shadow-[0_0_0_1px_rgba(87,70,49,0.1),0_18px_52px_-34px_rgba(44,32,18,0.5),0_2px_8px_-6px_rgba(44,32,18,0.32)] ring-1 ring-white/65">
				{isCollapsed ? (
					<div className="grid gap-2 p-2.5 xl:grid-cols-[minmax(11rem,15rem)_minmax(18rem,1fr)_auto] xl:items-center">
						<div className="min-w-0 rounded-[0.85rem] bg-muted/35 px-3 py-2 shadow-[inset_0_0_0_1px_rgba(87,70,49,0.06)]">
							<p className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/88">
								Context
							</p>
							<p className="mt-0.5 truncate text-sm font-semibold text-foreground">
								{activeSpaceName}
							</p>
							{contextSource ? (
								<p className="truncate text-[11px] text-muted-foreground/72">
									{contextSource}
								</p>
							) : null}
						</div>
						<button
							aria-label="Expand global composer"
							className="flex min-h-14 min-w-0 items-center justify-between gap-3 rounded-[1rem] bg-card/95 px-4 text-left shadow-[inset_0_0_0_1px_rgba(87,70,49,0.12),0_12px_28px_-24px_rgba(44,32,18,0.56)] transition-[background-color,box-shadow,transform] hover:bg-background hover:shadow-[inset_0_0_0_1px_rgba(87,70,49,0.2),0_14px_32px_-24px_rgba(44,32,18,0.62)] active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-45"
							disabled={disabled}
							onClick={() => expandTo("message_text")}
							type="button"
						>
							<span className="min-w-0">
								<span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b651f]">
									Tell Ceits
								</span>
								<span className="mt-0.5 block truncate text-sm font-semibold text-foreground">
									What happened? Add a receipt, expense, promo, or question.
								</span>
							</span>
							<span className="hidden rounded-full bg-[rgba(68,58,42,0.08)] px-2.5 py-1 text-[11px] font-semibold text-muted-foreground sm:inline">
								Start here
							</span>
						</button>
						<div className="flex min-w-0 flex-col gap-2 lg:items-end">
							<div className="flex min-w-0 flex-wrap items-center gap-2 lg:justify-end">
								<button
									className={actionButtonClass}
									disabled={disabled}
									onClick={() => expandTo("expense_method_select")}
									type="button"
								>
									Add expense
								</button>
								<button
									className={actionButtonClass}
									disabled={disabled}
									onClick={() => expandTo("ask_topic_select")}
									type="button"
								>
									Ask Ceits
								</button>
								{hasSpaceContext ? (
									<Link
										className={actionButtonClass}
										to={`/console/chat?spaceId=${encodeURIComponent(String(activeSpaceId))}`}
									>
										Message
									</Link>
								) : null}
							</div>
							<div className="flex min-w-0 flex-wrap items-center gap-1.5 rounded-full bg-muted/30 px-1.5 py-1 lg:justify-end">
								<Link className={dockLinkClass} to={activeSpaceActivityHref}>
									Activity
								</Link>
								<Link className={dockLinkClass} to={spaceSettingsHref}>
									Manage
								</Link>
								<Link className={dockLinkClass} to="/console/settings/account">
									Account
								</Link>
								<Link className={userLinkClass} to="/console/settings/account">
									<span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-bold uppercase text-secondary-foreground">
										{userInitial}
									</span>
								</Link>
							</div>
						</div>
					</div>
				) : (
					<>
						<div className="flex items-center justify-between gap-3 border-b border-border/35 bg-muted/20 px-3.5 py-2">
							<div className="flex min-w-0 items-center gap-2">
								<span className="h-2 w-2 shrink-0 rounded-full bg-[rgba(72,112,76,0.72)] shadow-[0_0_0_4px_rgba(72,112,76,0.1)]" />
								<p className="min-w-0 truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
									Context: {activeSpaceName}
									{contextSource ? ` · ${contextSource}` : ""}
								</p>
							</div>
							<div className="flex shrink-0 items-center gap-3 rounded-full bg-background/72 px-2.5 py-1 shadow-[0_0_0_1px_rgba(87,70,49,0.07)]">
								<button
									aria-label="Collapse global composer"
									aria-pressed={isCollapsed}
									className="min-h-8 rounded-full px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground transition-[color,transform] hover:text-foreground active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
									onClick={handleCollapseToggle}
									type="button"
								>
									Collapse
								</button>
								{hasSpaceContext ? (
									<Link className={dockHeaderLinkClass} to={spaceSettingsHref}>
										Manage
									</Link>
								) : (
									<Link
										className={dockHeaderLinkClass}
										to="/console/settings/spaces"
									>
										Spaces
									</Link>
								)}
								<Link
									className={dockHeaderLinkClass}
									to="/console/settings/account"
								>
									Account
								</Link>
								<Link
									className={dockHeaderLinkClass}
									to={activeSpaceActivityHref}
								>
									Activity
								</Link>
								{hasSpaceContext ? (
									<Link
										className={dockHeaderLinkClass}
										to={`/console/chat?spaceId=${encodeURIComponent(String(activeSpaceId))}`}
									>
										Open chat
									</Link>
								) : (
									<Link className={dockHeaderLinkClass} to="/console/spaces">
										Choose space
									</Link>
								)}
							</div>
						</div>
						<SmartTextareaComposer
							ref={composerRef}
							disabled={disabled}
							isRecording={isRecording}
							onCancelRecording={handleCancelRecording}
							onComposerSubmit={(payload) => void handleSubmit(payload)}
							onStartExpenseRecording={() => void handleStartRecording()}
							onStopRecording={() => void handleStopRecording()}
							spaceId={activeSpaceId ?? "0"}
							surface="dock"
						/>
					</>
				)}
				{composerFlow.bundle ? (
					<CandidateBundlePanel
						benefitsHref={activeSpaceBenefitsHref}
						bundle={composerFlow.bundle}
						expensesHref={activeSpaceExpensesHref}
						reviewHref={activeSpaceReviewHref}
						splitsHref={activeSpaceSplitsHref}
					/>
				) : null}
				{composerFlow.step === "clarifying" ? (
					<ClarificationActionsPanel
						benefitsHref={activeSpaceBenefitsHref}
						billingHref="/console/settings/billing"
						bundle={composerFlow.bundle}
						chatHref={activeSpaceChatHref}
						chatDraftText={clarificationDraftText}
						disabled={busy || isLoading || !hasSpaceContext}
						hasSpaceContext={hasSpaceContext}
						onAddExpense={() =>
							expandToText("expense_text", clarificationDraftText)
						}
						onAskCeits={() =>
							expandToText("ask_custom", clarificationDraftText)
						}
						onCreateSpace={() => setCreateSpaceDialogOpen(true)}
						spacesHref="/console/settings/spaces"
					/>
				) : null}
				{composerNotice ? (
					<div
						aria-live="polite"
						className={[
							"border-t px-4 py-2 text-xs",
							errorText
								? "border-destructive/20 bg-destructive/10 text-destructive"
								: statusText
									? "border-[rgba(90,130,96,0.18)] bg-[rgba(230,246,232,0.9)] text-[#355a3c]"
									: "border-border/50 bg-muted/45 text-muted-foreground",
						].join(" ")}
					>
						{composerNotice}
					</div>
				) : null}
			</div>
		</div>
	);
};
