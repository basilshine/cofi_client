import type {
	PaymentLinkContext,
	PaymentMethod,
	PaymentObligation,
	PaymentObligationStatus,
} from "@cofi/api";
import {
	ArrowLeft,
	Check,
	Copy,
	ExternalLink,
	LockKeyhole,
	ReceiptText,
	Send,
	ShieldCheck,
	UserRound,
	X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { apiClient } from "../../shared/lib/apiClient";

type LoadState =
	| { status: "loading"; context: null; error: null }
	| { status: "ready"; context: PaymentLinkContext; error: null }
	| { status: "error"; context: null; error: string };

const formatMoney = (amount: number, currency = "USD") =>
	new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: currency || "USD",
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(amount);

const formatExpiry = (expiresAt: string) => {
	const date = new Date(expiresAt);
	if (Number.isNaN(date.getTime())) return "Limited payment link";
	return `Expires ${new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(date)}`;
};

const statusCopy: Record<string, string> = {
	unpaid: "Unpaid",
	sent: "Sent",
	received: "Received",
	confirmed: "Confirmed",
	disputed: "Disputed",
};

const methodHints: Record<string, string> = {
	venmo: "Open Venmo if available, then copy the note before sending.",
	cash_app: "Open Cash App if available, then paste the amount and note.",
	paypal: "Open PayPal or PayPal.me, then send outside Ceits.",
	zelle:
		"Copy the contact into your bank app. Ceits cannot open Zelle directly.",
	manual: "Use the details in any external payment method.",
};

const isTerminalStatus = (status: PaymentObligationStatus | string) =>
	status === "confirmed";

const isActionLockedStatus = (status: PaymentObligationStatus | string) =>
	status === "sent" || status === "confirmed";

const userFacingError = (error: unknown) => {
	const message = error instanceof Error ? error.message : String(error);
	if (message.includes("401"))
		return "This payment link is invalid or expired.";
	if (message.includes("403"))
		return "This payment link cannot perform that action.";
	if (message.includes("404"))
		return "That payment obligation is no longer available.";
	return "We could not load this payment link.";
};

const paymentRoleLabel = (
	obligation: PaymentObligation,
	selectedParticipantId: number,
) => {
	const payer = obligation.payer_participant;
	const recipient = obligation.recipient_participant;
	if (payer.id === selectedParticipantId) {
		return `Pay ${recipient.display_name}`;
	}
	return `${payer.display_name} owes you`;
};

const CopyButton = ({
	label,
	value,
	onCopied,
}: {
	label: string;
	value: string;
	onCopied: (label: string) => void;
}) => (
	<button
		className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-800 shadow-sm transition hover:border-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-700"
		onClick={() => {
			void navigator.clipboard?.writeText(value);
			onCopied(label);
		}}
		type="button"
	>
		<Copy className="h-4 w-4" />
		{label}
	</button>
);

export const PaymentResolutionPage = () => {
	const { token = "" } = useParams();
	const [loadState, setLoadState] = useState<LoadState>({
		status: "loading",
		context: null,
		error: null,
	});
	const [copiedLabel, setCopiedLabel] = useState<string | null>(null);
	const [selectedObligationId, setSelectedObligationId] = useState<
		string | null
	>(null);
	const [selectedMethodType, setSelectedMethodType] =
		useState<string>("manual");
	const [claimingParticipantId, setClaimingParticipantId] = useState<
		number | null
	>(null);
	const [markingObligationId, setMarkingObligationId] = useState<string | null>(
		null,
	);
	const [uploadingProofObligationId, setUploadingProofObligationId] = useState<
		string | null
	>(null);
	const [actionError, setActionError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		setLoadState({ status: "loading", context: null, error: null });
		setSelectedObligationId(null);
		setSelectedMethodType("manual");
		setActionError(null);

		void apiClient.paymentLinks
			.verify(token)
			.then((context) => {
				if (cancelled) return;
				setLoadState({ status: "ready", context, error: null });
			})
			.catch((error: unknown) => {
				if (cancelled) return;
				setLoadState({
					status: "error",
					context: null,
					error: userFacingError(error),
				});
			});

		return () => {
			cancelled = true;
		};
	}, [token]);

	const context = loadState.context;
	const selectedParticipant = context?.selected_participant ?? null;
	const selectedParticipantId = selectedParticipant?.id ?? null;
	const obligations = context?.obligations ?? [];

	const youOwe = useMemo(
		() =>
			selectedParticipantId == null
				? []
				: obligations.filter(
						(obligation) =>
							obligation.payer_participant.id === selectedParticipantId,
					),
		[obligations, selectedParticipantId],
	);
	const owedToYou = useMemo(
		() =>
			selectedParticipantId == null
				? []
				: obligations.filter(
						(obligation) =>
							obligation.recipient_participant.id === selectedParticipantId,
					),
		[obligations, selectedParticipantId],
	);

	const selectedObligation =
		obligations.find((obligation) => obligation.id === selectedObligationId) ??
		obligations[0] ??
		null;
	const paymentMethods = selectedObligation?.payment_methods?.length
		? selectedObligation.payment_methods
		: (selectedObligation?.recipient_participant.payment_methods ?? []);
	const selectedMethod =
		paymentMethods.find((method) => method.type === selectedMethodType) ??
		paymentMethods[0] ??
		null;

	useEffect(() => {
		if (selectedObligation == null) return;
		const nextMethod =
			selectedObligation.payment_methods?.[0]?.type ??
			selectedObligation.recipient_participant.payment_methods?.[0]?.type ??
			"manual";
		setSelectedMethodType((current) =>
			paymentMethods.some((method) => method.type === current)
				? current
				: nextMethod,
		);
	}, [selectedObligation, paymentMethods]);

	const claimParticipant = async (participantId: number) => {
		setClaimingParticipantId(participantId);
		setActionError(null);
		try {
			const next = await apiClient.paymentLinks.claimParticipant(
				token,
				participantId,
			);
			setLoadState({ status: "ready", context: next, error: null });
			setSelectedObligationId(null);
		} catch (error) {
			setActionError(userFacingError(error));
		} finally {
			setClaimingParticipantId(null);
		}
	};

	const reloadContext = async () => {
		setLoadState({ status: "loading", context: null, error: null });
		try {
			const next = await apiClient.paymentLinks.verify(token);
			setLoadState({ status: "ready", context: next, error: null });
		} catch (error) {
			setLoadState({
				status: "error",
				context: null,
				error: userFacingError(error),
			});
		}
	};

	const markSent = async (obligationId: string) => {
		setMarkingObligationId(obligationId);
		setActionError(null);
		try {
			const next = await apiClient.paymentLinks.markSent(token, obligationId);
			setLoadState({ status: "ready", context: next, error: null });
			setSelectedObligationId(obligationId);
		} catch (error) {
			setActionError(userFacingError(error));
		} finally {
			setMarkingObligationId(null);
		}
	};

	const uploadProof = async (obligationId: string, file: File) => {
		setUploadingProofObligationId(obligationId);
		setActionError(null);
		try {
			const formData = new FormData();
			formData.append("obligation_id", obligationId);
			formData.append("proof", file);
			const next = await apiClient.paymentLinks.uploadProof(token, formData);
			setLoadState({ status: "ready", context: next.context, error: null });
			setSelectedObligationId(obligationId);
		} catch (error) {
			setActionError(userFacingError(error));
		} finally {
			setUploadingProofObligationId(null);
		}
	};

	const confirmReceived = async (obligationId: string) => {
		setMarkingObligationId(obligationId);
		setActionError(null);
		try {
			const next = await apiClient.paymentLinks.markReceived(
				token,
				obligationId,
			);
			setLoadState({ status: "ready", context: next, error: null });
			setSelectedObligationId(obligationId);
		} catch (error) {
			setActionError(userFacingError(error));
		} finally {
			setMarkingObligationId(null);
		}
	};

	if (loadState.status === "loading") {
		return (
			<PaymentLinkFrame>
				<section className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-[0_24px_80px_rgb(70_52_33_/_0.14)]">
					<div className="h-12 w-12 animate-pulse rounded-full bg-stone-200" />
					<div className="mt-6 h-4 w-28 animate-pulse rounded-full bg-stone-200" />
					<div className="mt-4 h-9 w-64 max-w-full animate-pulse rounded-full bg-stone-200" />
					<div className="mt-3 h-4 w-full animate-pulse rounded-full bg-stone-100" />
					<div className="mt-2 h-4 w-3/4 animate-pulse rounded-full bg-stone-100" />
				</section>
			</PaymentLinkFrame>
		);
	}

	if (loadState.status === "error") {
		return (
			<PaymentLinkFrame>
				<section className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-[0_24px_80px_rgb(70_52_33_/_0.14)]">
					<div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-stone-900 text-white">
						<LockKeyhole className="h-5 w-5" />
					</div>
					<p className="text-xs font-bold uppercase tracking-[0.22em] text-stone-500">
						Payment link
					</p>
					<h1 className="mt-2 text-3xl font-semibold tracking-normal text-stone-950">
						Link unavailable.
					</h1>
					<p className="mt-3 text-sm leading-6 text-stone-600">
						{loadState.error}
					</p>
					<button
						className="mt-6 inline-flex min-h-11 items-center rounded-full bg-stone-900 px-5 text-sm font-semibold text-white"
						onClick={() => void reloadContext()}
						type="button"
					>
						Try again
					</button>
				</section>
			</PaymentLinkFrame>
		);
	}

	if (context == null) return null;

	if (context.claim_required || selectedParticipant == null) {
		const eligibleParticipants = context.eligible_participants ?? [];
		return (
			<PaymentLinkFrame
				header={
					<PaymentHeader
						spaceName={context.space_name}
						tokenStatus={context.token_status}
					/>
				}
			>
				<section className="rounded-[1.75rem] border border-stone-200 bg-white p-5 shadow-[0_24px_80px_rgb(70_52_33_/_0.13)]">
					<div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#e9f0dc] text-emerald-900">
						<UserRound className="h-5 w-5" />
					</div>
					<p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-stone-500">
						Participant claim
					</p>
					<h1 className="mt-2 text-3xl font-semibold tracking-normal">
						Choose your name before obligations load.
					</h1>
					<p className="mt-3 text-sm leading-6 text-stone-600">
						This link reveals payment obligations only after the server binds it
						to a participant.
					</p>
					{actionError ? (
						<p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
							{actionError}
						</p>
					) : null}
					<div className="mt-5 grid gap-2">
						{eligibleParticipants.map((participant) => (
							<button
								className="flex min-h-14 items-center justify-between rounded-2xl border border-stone-200 bg-[#fbfaf6] px-4 text-left transition hover:border-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-700 disabled:cursor-not-allowed disabled:opacity-60"
								disabled={claimingParticipantId != null}
								key={participant.id}
								onClick={() => void claimParticipant(participant.id)}
								type="button"
							>
								<span>
									<span className="block text-sm font-semibold">
										{participant.display_name}
									</span>
									<span className="block text-xs text-stone-500">
										{participant.detail || "Payment participant"}
									</span>
								</span>
								{claimingParticipantId === participant.id ? (
									<span className="text-xs font-semibold text-stone-500">
										Claiming
									</span>
								) : (
									<ArrowLeft className="h-4 w-4 rotate-180 text-stone-500" />
								)}
							</button>
						))}
						{eligibleParticipants.length === 0 ? (
							<div className="rounded-2xl border border-dashed border-stone-300 bg-white/70 p-4 text-sm text-stone-500">
								No eligible participants are available for this link.
							</div>
						) : null}
					</div>
				</section>
			</PaymentLinkFrame>
		);
	}

	return (
		<PaymentLinkFrame
			header={
				<PaymentHeader
					spaceName={context.space_name}
					tokenStatus={context.token_status}
				/>
			}
		>
			<section className="overflow-hidden rounded-[2rem] border border-stone-200 bg-white shadow-[0_24px_80px_rgb(70_52_33_/_0.13)]">
				<div className="bg-stone-950 px-5 py-5 text-[#f8f3e8]">
					<div className="flex items-start justify-between gap-3">
						<div>
							<p className="text-xs font-bold uppercase tracking-[0.2em] text-stone-300">
								Payment summary
							</p>
							<h1 className="mt-2 text-3xl font-semibold tracking-normal">
								{selectedParticipant.display_name}
							</h1>
							<p className="mt-1 text-sm text-stone-300">
								{formatExpiry(context.expires_at)}
							</p>
						</div>
						<button
							className="inline-flex min-h-10 items-center gap-2 rounded-full border border-stone-600 px-3 text-xs font-semibold text-stone-100"
							onClick={() => void reloadContext()}
							type="button"
						>
							<X className="h-4 w-4 rotate-45" />
							Refresh
						</button>
					</div>
					<div className="mt-6 grid grid-cols-2 gap-3">
						<div className="rounded-2xl bg-[#f8f3e8] p-4 text-stone-950">
							<p className="text-xs font-semibold text-stone-500">You owe</p>
							<p className="mt-1 font-mono text-2xl font-semibold">
								{formatMoney(context.summary.you_owe)}
							</p>
						</div>
						<div className="rounded-2xl bg-[#e9f0dc] p-4 text-stone-950">
							<p className="text-xs font-semibold text-stone-600">
								Owed to you
							</p>
							<p className="mt-1 font-mono text-2xl font-semibold">
								{formatMoney(context.summary.owed_to_you)}
							</p>
						</div>
					</div>
				</div>
				<div className="grid grid-cols-2 gap-px bg-stone-200">
					<div className="bg-white px-5 py-4">
						<p className="text-xs font-semibold text-stone-500">Pending sent</p>
						<p className="mt-1 text-lg font-semibold">
							{context.summary.pending_sent_payments}
						</p>
					</div>
					<div className="bg-white px-5 py-4">
						<p className="text-xs font-semibold text-stone-500">
							Needs confirmation
						</p>
						<p className="mt-1 text-lg font-semibold">
							{context.summary.needs_confirmation}
						</p>
					</div>
				</div>
			</section>

			<section className="grid gap-3">
				<ObligationGroup
					obligations={youOwe}
					onSelect={setSelectedObligationId}
					selectedId={selectedObligation?.id ?? null}
					selectedParticipantId={selectedParticipant.id}
					title="You owe"
				/>
				<ObligationGroup
					obligations={owedToYou}
					onSelect={setSelectedObligationId}
					selectedId={selectedObligation?.id ?? null}
					selectedParticipantId={selectedParticipant.id}
					title="Owed to you"
				/>
			</section>

			{selectedObligation ? (
				<ResolveSheet
					actionError={actionError}
					copiedLabel={copiedLabel}
					marking={markingObligationId === selectedObligation.id}
					method={selectedMethod}
					methods={paymentMethods}
					obligation={selectedObligation}
					onCopied={setCopiedLabel}
					onConfirmReceived={() => void confirmReceived(selectedObligation.id)}
					onMarkSent={() => void markSent(selectedObligation.id)}
					onSelectMethod={setSelectedMethodType}
					onUploadProof={(file) =>
						void uploadProof(selectedObligation.id, file)
					}
					selectedMethodType={selectedMethod?.type ?? "manual"}
					selectedParticipantId={selectedParticipant.id}
					uploadingProof={uploadingProofObligationId === selectedObligation.id}
				/>
			) : null}
		</PaymentLinkFrame>
	);
};

const PaymentLinkFrame = ({
	children,
	header,
}: {
	children: React.ReactNode;
	header?: React.ReactNode;
}) => (
	<main className="min-h-screen bg-[#f8f3e8] px-4 py-5 text-stone-950 sm:px-6">
		<section className="mx-auto flex w-full max-w-[30rem] flex-col gap-4">
			{header}
			{children}
		</section>
	</main>
);

const PaymentHeader = ({
	spaceName,
	tokenStatus,
}: {
	spaceName: string;
	tokenStatus: string;
}) => (
	<header className="flex items-center justify-between">
		<div>
			<p className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-stone-500">
				ceits.
			</p>
			<h1 className="text-lg font-semibold tracking-normal">{spaceName}</h1>
		</div>
		<div className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white/80 px-3 py-2 text-xs font-semibold text-stone-700 shadow-sm">
			<ShieldCheck className="h-4 w-4 text-emerald-700" />
			{tokenStatus === "active" ? "Scoped link" : tokenStatus}
		</div>
	</header>
);

const ResolveSheet = ({
	actionError,
	copiedLabel,
	marking,
	method,
	methods,
	obligation,
	onCopied,
	onConfirmReceived,
	onMarkSent,
	onSelectMethod,
	onUploadProof,
	selectedMethodType,
	selectedParticipantId,
	uploadingProof,
}: {
	actionError: string | null;
	copiedLabel: string | null;
	marking: boolean;
	method: PaymentMethod | null;
	methods: PaymentMethod[];
	obligation: PaymentObligation;
	onCopied: (label: string) => void;
	onConfirmReceived: () => void;
	onMarkSent: () => void;
	onSelectMethod: (type: string) => void;
	onUploadProof: (file: File) => void;
	selectedMethodType: string;
	selectedParticipantId: number;
	uploadingProof: boolean;
}) => {
	const payer = obligation.payer_participant;
	const recipient = obligation.recipient_participant;
	const isPayer = payer.id === selectedParticipantId;
	const isRecipient = recipient.id === selectedParticipantId;
	const payerProofs = obligation.proofs.filter(
		(proof) => proof.actor_participant.id === payer.id,
	);
	const proofMissing = obligation.proof_required && payerProofs.length === 0;
	const canMarkSent =
		isPayer && !isActionLockedStatus(obligation.status) && !proofMissing;
	const canConfirmReceived = isRecipient && obligation.status === "sent";
	const primaryActionLabel = isRecipient
		? obligation.status === "confirmed"
			? "Confirmed"
			: obligation.status === "sent"
				? "Confirm received"
				: "Waiting for sender"
		: obligation.status === "sent"
			? "Marked sent"
			: obligation.status === "confirmed"
				? "Confirmed"
				: "Mark sent";
	const primaryActionDisabled =
		marking || (isRecipient ? !canConfirmReceived : !canMarkSent);
	const handlePrimaryAction = isRecipient ? onConfirmReceived : onMarkSent;

	return (
		<section
			aria-label="Resolve selected obligation"
			className="sticky bottom-3 rounded-[1.75rem] border border-stone-200 bg-white p-4 shadow-[0_24px_80px_rgb(70_52_33_/_0.18)]"
		>
			<div className="flex items-start justify-between gap-3">
				<div>
					<p className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">
						Resolve
					</p>
					<h2 className="mt-1 text-2xl font-semibold tracking-normal">
						{formatMoney(obligation.amount, obligation.currency)}
					</h2>
					<p className="text-sm text-stone-600">
						{payer.display_name} {"->"} {recipient.display_name}
					</p>
				</div>
				<div className="rounded-full bg-[#f4dfba] px-3 py-1 text-xs font-bold text-stone-800">
					{statusCopy[obligation.status] ?? obligation.status}
				</div>
			</div>

			<div className="mt-4 flex gap-2 overflow-x-auto pb-1">
				{methods.map((candidate) => (
					<button
						className={`min-h-10 shrink-0 rounded-full border px-4 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-stone-700 ${
							selectedMethodType === candidate.type
								? "border-stone-900 bg-stone-900 text-white"
								: "border-stone-300 bg-white text-stone-800"
						}`}
						key={`${obligation.id}-${candidate.type}-${candidate.value}`}
						onClick={() => onSelectMethod(candidate.type)}
						type="button"
					>
						{candidate.label}
					</button>
				))}
			</div>

			{method ? (
				<div className="mt-4 rounded-2xl bg-[#fbfaf6] p-4">
					<div className="flex items-start justify-between gap-3">
						<div>
							<p className="text-sm font-semibold">{method.label}</p>
							<p className="mt-1 text-sm text-stone-600">{method.value}</p>
						</div>
						{method.url ? (
							<a
								className="inline-flex min-h-10 items-center gap-2 rounded-full bg-white px-3 text-xs font-semibold text-stone-900 shadow-sm"
								href={method.url}
								rel="noreferrer"
								target="_blank"
							>
								Open
								<ExternalLink className="h-4 w-4" />
							</a>
						) : null}
					</div>
					<p className="mt-3 text-xs leading-5 text-stone-500">
						{methodHints[method.type] ?? methodHints.manual}
					</p>
				</div>
			) : null}

			<div className="mt-4 flex flex-wrap gap-2">
				<CopyButton
					label="Copy amount"
					onCopied={onCopied}
					value={formatMoney(obligation.amount, obligation.currency)}
				/>
				<CopyButton
					label="Copy note"
					onCopied={onCopied}
					value={obligation.note}
				/>
			</div>
			{copiedLabel ? (
				<p className="mt-2 text-xs font-semibold text-emerald-800">
					{copiedLabel} copied
				</p>
			) : null}
			{isPayer ? (
				<div className="mt-4 rounded-2xl border border-stone-200 bg-[#fbfaf6] p-4">
					<div className="flex items-start justify-between gap-3">
						<div>
							<p className="text-sm font-semibold">
								Payment proof{" "}
								{obligation.proof_required ? "required" : "optional"}
							</p>
							<p className="mt-1 text-xs leading-5 text-stone-500">
								Upload a screenshot or receipt from the external payment app.
							</p>
						</div>
						<span
							className={`rounded-full px-2 py-1 text-[0.68rem] font-bold ${
								proofMissing
									? "bg-amber-100 text-amber-800"
									: "bg-emerald-100 text-emerald-800"
							}`}
						>
							{payerProofs.length > 0 ? "Proof attached" : "No proof"}
						</span>
					</div>
					<label className="mt-3 inline-flex min-h-10 cursor-pointer items-center rounded-full border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-800 shadow-sm transition hover:border-stone-500">
						<input
							accept="image/*,application/pdf"
							className="sr-only"
							disabled={uploadingProof || isTerminalStatus(obligation.status)}
							onChange={(event) => {
								const file = event.target.files?.[0];
								event.currentTarget.value = "";
								if (file) onUploadProof(file);
							}}
							type="file"
						/>
						{uploadingProof ? "Uploading" : "Upload proof"}
					</label>
					{payerProofs.length > 0 ? (
						<div className="mt-3 grid gap-1">
							{payerProofs.map((proof) => (
								<p className="text-xs text-stone-600" key={proof.id}>
									{proof.original_filename?.trim() || "Payment proof"} attached
								</p>
							))}
						</div>
					) : null}
				</div>
			) : null}
			{actionError ? (
				<p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
					{actionError}
				</p>
			) : null}

			<button
				className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-stone-950 px-5 text-sm font-semibold text-white transition hover:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-700 disabled:cursor-not-allowed disabled:bg-stone-300"
				disabled={primaryActionDisabled}
				onClick={handlePrimaryAction}
				type="button"
			>
				{isRecipient ? (
					<Check className="h-4 w-4" />
				) : (
					<Send className="h-4 w-4" />
				)}
				{marking ? "Updating" : primaryActionLabel}
			</button>
		</section>
	);
};

const ObligationGroup = ({
	obligations,
	onSelect,
	selectedId,
	selectedParticipantId,
	title,
}: {
	obligations: PaymentObligation[];
	onSelect: (id: string) => void;
	selectedId: string | null;
	selectedParticipantId: number;
	title: string;
}) => (
	<div>
		<div className="mb-2 flex items-center justify-between px-1">
			<h2 className="text-sm font-bold uppercase tracking-[0.16em] text-stone-500">
				{title}
			</h2>
			<span className="text-xs font-semibold text-stone-500">
				{obligations.length}
			</span>
		</div>
		<div className="grid gap-2">
			{obligations.length === 0 ? (
				<div className="rounded-2xl border border-dashed border-stone-300 bg-white/70 p-4 text-sm text-stone-500">
					No obligations in this group for the selected participant.
				</div>
			) : (
				obligations.map((obligation) => (
					<button
						className={`min-h-20 rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:border-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-700 ${
							selectedId === obligation.id
								? "border-stone-900"
								: "border-stone-200"
						}`}
						key={obligation.id}
						onClick={() => onSelect(obligation.id)}
						type="button"
					>
						<div className="flex items-start justify-between gap-3">
							<div className="min-w-0">
								<p className="flex items-center gap-2 text-sm font-semibold">
									<ReceiptText className="h-4 w-4 shrink-0 text-stone-500" />
									<span className="truncate">{obligation.source_label}</span>
								</p>
								<p className="mt-1 text-xs text-stone-500">
									{paymentRoleLabel(obligation, selectedParticipantId)}
								</p>
								<p className="mt-1 text-xs text-stone-500">
									{obligation.source_detail || "Approved participant split"}
								</p>
							</div>
							<div className="text-right">
								<p className="font-mono text-lg font-semibold">
									{formatMoney(obligation.amount, obligation.currency)}
								</p>
								<span className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#f4dfba] px-2 py-1 text-[0.68rem] font-bold text-stone-800">
									{obligation.status === "sent" ||
									isTerminalStatus(obligation.status) ? (
										<Check className="h-3 w-3" />
									) : null}
									{statusCopy[obligation.status] ?? obligation.status}
								</span>
							</div>
						</div>
					</button>
				))
			)}
		</div>
	</div>
);
