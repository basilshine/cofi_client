import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { staggerContainer, staggerItem } from "../../shared/lib/appMotion";
import { marketingUrl } from "../../shared/lib/ceitsMarketingUrl";
import {
	clearPendingInviteToken,
	readPendingInviteToken,
} from "../../shared/lib/pendingInviteToken";
import { onboardingApi } from "./onboardingApi";

type StartContext = "family" | "personal" | "trip_project";

const stepIndexFromCursor = (cursor: string): number => {
	switch (cursor) {
		case "context":
			return 0;
		case "purpose":
			return 1;
		case "space":
			return 2;
		default:
			return 3;
	}
};

const PURPOSE_OPTIONS: Record<
	StartContext,
	{ value: string; label: string }[]
> = {
	family: [
		{ value: "family_budget", label: "Family budget" },
		{ value: "home_bills", label: "Home & bills" },
		{ value: "groceries", label: "Groceries" },
		{ value: "shared_subscriptions", label: "Shared subscriptions" },
		{ value: "kids_school", label: "Kids & school" },
		{ value: "home_project", label: "Home project" },
	],
	personal: [
		{ value: "solo_personal", label: "Just for me" },
		{ value: "groceries", label: "Groceries" },
		{ value: "home_bills", label: "Home & bills" },
		{ value: "shared_subscriptions", label: "Subscriptions" },
		{ value: "home_project", label: "Personal project" },
	],
	trip_project: [
		{ value: "trip_project", label: "Trip or getaway" },
		{ value: "shared_purchases", label: "Shared purchases" },
		{ value: "travel_spending", label: "Travel spending" },
		{ value: "groceries", label: "Groceries on the road" },
		{ value: "home_project", label: "Shared project" },
	],
};

const TRACKING_OPTIONS: { value: string; label: string }[] = [
	{ value: "groceries", label: "Groceries" },
	{ value: "bills", label: "Bills" },
	{ value: "rent_mortgage", label: "Rent / mortgage" },
	{ value: "subscriptions", label: "Subscriptions" },
	{ value: "home_expenses", label: "Home expenses" },
	{ value: "shared_purchases", label: "Shared purchases" },
	{ value: "travel_spending", label: "Travel spending" },
	{ value: "kids_school", label: "Kids / school" },
];

const CAPTURE_OPTIONS: { value: string; label: string }[] = [
	{ value: "text", label: "Type a quick note" },
	{ value: "receipt", label: "Upload a receipt" },
	{ value: "voice", label: "Record a voice note" },
	{ value: "mix", label: "A mix of all three" },
];

export const OnboardingPage = () => {
	const navigate = useNavigate();
	const { refreshUser, logout } = useAuth();
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [step, setStep] = useState(0);
	const [draft, setDraft] = useState<Record<string, unknown>>({});
	const [spaceName, setSpaceName] = useState("");
	const [priorities, setPriorities] = useState<string[]>([]);
	const [captureMode, setCaptureMode] = useState<string>("");

	const startContext =
		(draft.start_context as StartContext | undefined) ?? undefined;
	const spacePurpose = draft.space_purpose as string | undefined;

	const load = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const s = await onboardingApi.getState();
			if (s.completed) {
				navigate("/console", { replace: true });
				return;
			}
			setDraft(s.draft ?? {});
			setStep(stepIndexFromCursor(s.current_step));
			const n = (s.draft?.space_name as string | undefined) ?? "";
			setSpaceName(n);
			const pr = (s.draft?.tracking_priorities as string[] | undefined) ?? [];
			setPriorities(Array.isArray(pr) ? pr : []);
			const cm = (s.draft?.capture_mode as string | undefined) ?? "";
			setCaptureMode(cm);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Could not load onboarding");
		} finally {
			setLoading(false);
		}
	}, [navigate]);

	useEffect(() => {
		void load();
	}, [load]);

	const purposeChoices = useMemo(() => {
		if (!startContext) return PURPOSE_OPTIONS.family;
		return PURPOSE_OPTIONS[startContext] ?? PURPOSE_OPTIONS.family;
	}, [startContext]);

	const inviteHint = readPendingInviteToken();

	const persistStep = async (
		patch: Record<string, unknown>,
		nextCursor: string,
	) => {
		const inv = readPendingInviteToken();
		return onboardingApi.saveStep({
			patch,
			cursor: nextCursor,
			invite_token: inv ?? undefined,
		});
	};

	const handleSelectContext = async (ctx: StartContext) => {
		setSaving(true);
		setError(null);
		try {
			const next = await persistStep({ start_context: ctx }, "purpose");
			setDraft(next.draft ?? {});
			setStep(stepIndexFromCursor(next.current_step));
		} catch (e) {
			setError(e instanceof Error ? e.message : "Save failed");
		} finally {
			setSaving(false);
		}
	};

	const handleSelectPurpose = async (purpose: string) => {
		setSaving(true);
		setError(null);
		try {
			const next = await persistStep({ space_purpose: purpose }, "space");
			setDraft(next.draft ?? {});
			setStep(stepIndexFromCursor(next.current_step));
		} catch (e) {
			setError(e instanceof Error ? e.message : "Save failed");
		} finally {
			setSaving(false);
		}
	};

	const handleSpaceContinue = async () => {
		const name = spaceName.trim();
		if (!name) {
			setError("Please name your first space.");
			return;
		}
		setSaving(true);
		setError(null);
		try {
			const next = await persistStep(
				{
					space_name: name,
					tracking_priorities: priorities,
				},
				"capture",
			);
			setDraft(next.draft ?? {});
			setStep(stepIndexFromCursor(next.current_step));
		} catch (e) {
			setError(e instanceof Error ? e.message : "Save failed");
		} finally {
			setSaving(false);
		}
	};

	const handleFinish = async () => {
		if (!captureMode) {
			setError("Pick how you want to add expenses.");
			return;
		}
		setSaving(true);
		setError(null);
		try {
			await persistStep({ capture_mode: captureMode }, "capture");
			const res = await onboardingApi.complete();
			clearPendingInviteToken();
			await refreshUser();
			navigate(
				`/console/spaces/${encodeURIComponent(String(res.first_space_id))}/expenses`,
				{ replace: true },
			);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Could not finish setup");
		} finally {
			setSaving(false);
		}
	};

	const handleBack = () => {
		setError(null);
		if (step <= 0) return;
		setStep((s) => s - 1);
	};

	const progressLabels = ["Start", "Focus", "Space", "Capture"];

	if (loading) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-[hsl(var(--bg))] text-sm text-[hsl(var(--text-secondary))]">
				Loading your setup…
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-[hsl(var(--bg))] px-4 py-10 md:py-16">
			<motion.div
				animate="visible"
				className="mx-auto w-full max-w-xl"
				initial="hidden"
				variants={staggerContainer}
			>
				<motion.div
					className="mb-8 flex items-center justify-between"
					variants={staggerItem}
				>
					<a
						className="text-sm font-medium text-[hsl(var(--text-secondary))] underline-offset-4 hover:text-[hsl(var(--text-primary))] hover:underline"
						href={marketingUrl("/")}
					>
						Ceits
					</a>
					<button
						className="text-xs text-[hsl(var(--text-secondary))] underline-offset-4 hover:underline"
						onClick={() => {
							logout();
							navigate("/auth", { replace: true });
						}}
						type="button"
					>
						Sign out
					</button>
				</motion.div>

				<motion.div className="mb-6" variants={staggerItem}>
					<div className="flex gap-2">
						{progressLabels.map((label, i) => (
							<div className="flex-1" key={label}>
								<div
									className={[
										"h-1.5 rounded-full transition",
										i <= step
											? "bg-[hsl(var(--accent))]"
											: "bg-[hsl(var(--border-subtle))]",
									].join(" ")}
								/>
								<p className="mt-1.5 text-[10px] font-medium text-[hsl(var(--text-secondary))]">
									{label}
								</p>
							</div>
						))}
					</div>
				</motion.div>

				<motion.div
					className="rounded-2xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface))] p-6 shadow-sm md:p-8"
					variants={staggerItem}
				>
					{inviteHint ? (
						<p
							className="mb-4 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-[hsl(var(--text-primary))]"
							role="status"
						>
							Invite saved — we&apos;ll attach you to the right space after this
							short setup.
						</p>
					) : null}

					{error ? (
						<div
							className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
							role="alert"
						>
							{error}
						</div>
					) : null}

					{step === 0 ? (
						<section aria-labelledby="ob-context-title">
							<h1
								className="font-serif text-2xl tracking-tight text-[hsl(var(--text-primary))] md:text-3xl"
								id="ob-context-title"
							>
								How do you want to start?
							</h1>
							<p className="mt-2 text-sm text-[hsl(var(--text-secondary))]">
								This shapes your first space and suggestions.
							</p>
							<div className="mt-6 grid gap-3">
								{(
									[
										{
											id: "family" as const,
											title: "With my partner or family",
											body: "Shared budgets, bills, and everyday spending.",
										},
										{
											id: "personal" as const,
											title: "Just for myself",
											body: "Personal tracking with room to grow later.",
										},
										{
											id: "trip_project" as const,
											title: "For a trip or shared project",
											body: "Travel, events, or a focused collaboration.",
										},
									] as const
								).map((opt) => (
									<button
										className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg))] px-4 py-4 text-left transition hover:border-[hsl(var(--accent))]/40 hover:bg-[hsl(var(--accent))]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))] disabled:opacity-50"
										disabled={saving}
										key={opt.id}
										onClick={() => void handleSelectContext(opt.id)}
										type="button"
									>
										<p className="font-semibold text-[hsl(var(--text-primary))]">
											{opt.title}
										</p>
										<p className="mt-1 text-sm text-[hsl(var(--text-secondary))]">
											{opt.body}
										</p>
									</button>
								))}
							</div>
						</section>
					) : null}

					{step === 1 ? (
						<section aria-labelledby="ob-purpose-title">
							<h1
								className="font-serif text-2xl tracking-tight text-[hsl(var(--text-primary))] md:text-3xl"
								id="ob-purpose-title"
							>
								What should your first space be about?
							</h1>
							<p className="mt-2 text-sm text-[hsl(var(--text-secondary))]">
								Pick the closest fit — you can refine later.
							</p>
							<div className="mt-6 grid gap-2 sm:grid-cols-2">
								{purposeChoices.map((opt) => (
									<button
										className={[
											"rounded-xl border px-3 py-3 text-left text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))] disabled:opacity-50",
											spacePurpose === opt.value
												? "border-[hsl(var(--accent))] bg-[hsl(var(--accent))]/10 text-[hsl(var(--text-primary))]"
												: "border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg))] text-[hsl(var(--text-primary))] hover:border-[hsl(var(--accent))]/30",
										].join(" ")}
										disabled={saving}
										key={opt.value}
										onClick={() => void handleSelectPurpose(opt.value)}
										type="button"
									>
										{opt.label}
									</button>
								))}
							</div>
						</section>
					) : null}

					{step === 2 ? (
						<section aria-labelledby="ob-space-title">
							<h1
								className="font-serif text-2xl tracking-tight text-[hsl(var(--text-primary))] md:text-3xl"
								id="ob-space-title"
							>
								Set up your first space
							</h1>
							<p className="mt-2 text-sm text-[hsl(var(--text-secondary))]">
								Name it something you&apos;ll recognize in the sidebar.
							</p>
							<label className="mt-6 grid gap-2" htmlFor="ob-space-name">
								<span className="text-xs font-medium text-[hsl(var(--text-secondary))]">
									Space name
								</span>
								<input
									className="h-11 rounded-lg border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg))] px-3 text-sm text-[hsl(var(--text-primary))] outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))]"
									id="ob-space-name"
									onChange={(e) => setSpaceName(e.target.value)}
									placeholder="e.g. Family Budget"
									value={spaceName}
								/>
							</label>
							<p className="mt-6 text-sm font-medium text-[hsl(var(--text-primary))]">
								What do you want to keep track of first? (optional)
							</p>
							<div className="mt-3 flex flex-wrap gap-2">
								{TRACKING_OPTIONS.map((opt) => {
									const on = priorities.includes(opt.value);
									return (
										<button
											aria-pressed={on}
											className={[
												"rounded-full border px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))]",
												on
													? "border-[hsl(var(--accent))] bg-[hsl(var(--accent))]/15 text-[hsl(var(--text-primary))]"
													: "border-[hsl(var(--border-subtle))] text-[hsl(var(--text-secondary))] hover:border-[hsl(var(--accent))]/30",
											].join(" ")}
											key={opt.value}
											onClick={() => {
												setPriorities((prev) =>
													prev.includes(opt.value)
														? prev.filter((x) => x !== opt.value)
														: [...prev, opt.value],
												);
											}}
											type="button"
										>
											{opt.label}
										</button>
									);
								})}
							</div>
							<div className="mt-8 flex flex-wrap gap-3">
								<button
									className="h-11 rounded-lg border border-[hsl(var(--border-subtle))] px-4 text-sm font-medium text-[hsl(var(--text-primary))] hover:bg-[hsl(var(--bg))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))]"
									onClick={handleBack}
									type="button"
								>
									Back
								</button>
								<button
									className="h-11 rounded-lg bg-[hsl(var(--accent))] px-5 text-sm font-semibold text-[hsl(var(--accent-contrast))] hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))] disabled:opacity-50"
									disabled={saving}
									onClick={() => void handleSpaceContinue()}
									type="button"
								>
									{saving ? "Saving…" : "Continue"}
								</button>
							</div>
						</section>
					) : null}

					{step === 3 ? (
						<section aria-labelledby="ob-capture-title">
							<h1
								className="font-serif text-2xl tracking-tight text-[hsl(var(--text-primary))] md:text-3xl"
								id="ob-capture-title"
							>
								How do you usually want to add expenses?
							</h1>
							<p className="mt-2 text-sm text-[hsl(var(--text-secondary))]">
								This nudges the composer and quick actions in your first chat.
							</p>
							<div className="mt-6 grid gap-2">
								{CAPTURE_OPTIONS.map((opt) => (
									<button
										className={[
											"rounded-xl border px-4 py-3 text-left text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))] disabled:opacity-50",
											captureMode === opt.value
												? "border-[hsl(var(--accent))] bg-[hsl(var(--accent))]/10 text-[hsl(var(--text-primary))]"
												: "border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg))] text-[hsl(var(--text-primary))] hover:border-[hsl(var(--accent))]/30",
										].join(" ")}
										disabled={saving}
										key={opt.value}
										onClick={() => setCaptureMode(opt.value)}
										type="button"
									>
										{opt.label}
									</button>
								))}
							</div>
							<div className="mt-8 flex flex-wrap gap-3">
								<button
									className="h-11 rounded-lg border border-[hsl(var(--border-subtle))] px-4 text-sm font-medium text-[hsl(var(--text-primary))] hover:bg-[hsl(var(--bg))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))]"
									onClick={handleBack}
									type="button"
								>
									Back
								</button>
								<button
									className="h-11 rounded-lg bg-[hsl(var(--accent))] px-5 text-sm font-semibold text-[hsl(var(--accent-contrast))] hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))] disabled:opacity-50"
									disabled={saving}
									onClick={() => void handleFinish()}
									type="button"
								>
									{saving ? "Finishing…" : "Finish & open chat"}
								</button>
							</div>
						</section>
					) : null}
				</motion.div>
			</motion.div>
		</div>
	);
};
