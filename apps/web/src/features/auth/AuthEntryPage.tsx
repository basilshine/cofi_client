import { motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CeitsLogoStacked } from "../../components/brand/ceits-logo";
import { useAuth } from "../../contexts/AuthContext";
import { staggerContainer, staggerItem } from "../../shared/lib/appMotion";
import { marketingUrl } from "../../shared/lib/ceitsMarketingUrl";
import { persistOnboardingIntentFromSearch } from "../../shared/lib/onboardingIntent";
import { persistInviteFromSearchParams } from "../../shared/lib/pendingInviteToken";
import { AuthCard } from "./AuthCard";
import { AuthDivider } from "./AuthDivider";
import {
	AuthProviderButton,
	AuthTelegramCaptureHint,
} from "./AuthProviderButton";
import {
	authSocialPlaceholderMessage,
	isAuthSocialOAuthConfigured,
} from "./authOAuthConfig";
import type { AuthSocialProvider } from "./authSocialTypes";

const buildAuthChildHref = (path: "/login" | "/register", search: string) =>
	search ? `${path}?${search}` : path;

/** Decorative-only: suggests chat, expenses, and a shared space. */
const AuthEntryProductPreview = () => (
	<div
		aria-hidden
		className="pointer-events-none my-5 select-none rounded-2xl border border-[#E0D9D0]/70 bg-gradient-to-b from-[#FAF8F5]/95 to-[#F3F0EA]/80 p-4 shadow-[0_16px_44px_-28px_rgba(18,32,50,0.22)] ring-1 ring-[#FDFCFA]/80 backdrop-blur-[1.5px]"
	>
		<div className="space-y-3.5 opacity-[0.78]">
			<div className="flex items-center gap-2 border-b border-[#D4CEC6]/50 pb-2.5">
				<span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#8B9F8E]/70" />
				<span className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[#8A9199]">
					Space
				</span>
				<span className="text-xs font-medium text-[#4A5568]">
					Family Budget
				</span>
			</div>

			<div className="rounded-xl border border-[#E5DFD6]/60 bg-[#F5F2ED]/90 px-3 py-2.5">
				<p className="text-[11px] leading-snug text-[#5C6773]">
					Groceries today
				</p>
			</div>

			<div className="relative pt-0.5">
				<div className="relative z-10 rounded-[14px] border border-[#D8D2C8]/90 bg-[#FDFCFA]/95 px-3 py-2.5 shadow-[0_2px_8px_-2px_rgba(18,32,50,0.08)]">
					<div className="flex items-baseline justify-between gap-2">
						<p className="text-[11px] font-medium text-[#4A5568]">
							Groceries <span className="text-[#7A8490]">—</span>{" "}
							<span className="tabular-nums text-[#3D4F5C]">$42</span>
						</p>
						<span className="shrink-0 rounded-md border border-[#C9C2B8]/80 bg-[#F6F4EF] px-1.5 py-0.5 text-[0.6rem] font-medium uppercase tracking-wide text-[#6B7280]">
							Pending
						</span>
					</div>
					<p className="mt-1 border-t border-[#EBE6E0]/80 pt-1.5 text-[10px] leading-relaxed text-[#7A8490]">
						Items: milk, bread, fruit
					</p>
				</div>
				<div className="relative z-20 -mt-2.5 ml-3 mr-0 rounded-[14px] border border-[#D4CEC6]/85 bg-[#FAF8F5]/95 px-3 py-2.5 shadow-[0_4px_14px_-4px_rgba(18,32,50,0.1)]">
					<div className="flex items-baseline justify-between gap-2">
						<p className="text-[11px] font-medium text-[#4A5568]">
							Electricity bill <span className="text-[#7A8490]">—</span>{" "}
							<span className="tabular-nums text-[#3D4F5C]">$68</span>
						</p>
						<span className="shrink-0 rounded-md border border-[#8B9F8E]/25 bg-[#EEF3EE]/80 px-1.5 py-0.5 text-[0.6rem] font-medium uppercase tracking-wide text-[#5F6F62]">
							Confirmed
						</span>
					</div>
				</div>
			</div>
		</div>
	</div>
);

export const AuthEntryPage = () => {
	const { isAuthenticated, isLoading, onboarding } = useAuth();
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const preserved = searchParams.toString();

	useEffect(() => {
		persistOnboardingIntentFromSearch(searchParams);
		persistInviteFromSearchParams(searchParams);
	}, [searchParams]);

	const returnTo = searchParams.get("returnTo");
	const [entryNotice, setEntryNotice] = useState<string | null>(null);

	const handleEntryProvider = useCallback((provider: AuthSocialProvider) => {
		void provider;
		if (isAuthSocialOAuthConfigured()) {
			setEntryNotice(
				"Social sign-in will continue from here once your workspace enables it.",
			);
			return;
		}
		setEntryNotice(authSocialPlaceholderMessage());
	}, []);

	useEffect(() => {
		if (isLoading || !isAuthenticated) return;
		if (onboarding && !onboarding.completed) {
			navigate("/onboarding", { replace: true });
			return;
		}
		if (returnTo?.startsWith("/")) {
			navigate(returnTo, { replace: true });
			return;
		}
		navigate("/console", { replace: true });
	}, [isLoading, isAuthenticated, onboarding, navigate, returnTo]);

	if (isLoading) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-[#F6F4EF] text-sm text-[#4A5568]">
				<p className="animate-pulse">Loading…</p>
			</div>
		);
	}

	if (isAuthenticated) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-[#F6F4EF] text-sm text-[#4A5568]">
				<p className="animate-pulse">Redirecting…</p>
			</div>
		);
	}

	const inviteHint = searchParams.get("invite")?.trim();
	const loginHref = buildAuthChildHref("/login", preserved);
	const registerHref = buildAuthChildHref("/register", preserved);

	return (
		<div className="min-h-screen bg-[#F6F4EF] px-5 py-16 md:px-8 md:py-24">
			<motion.div
				animate="visible"
				className="mx-auto w-full max-w-lg"
				initial="hidden"
				variants={staggerContainer}
			>
				<motion.div className="text-center" variants={staggerItem}>
					<a
						aria-label="Ceits — home"
						className="mb-14 inline-flex justify-center md:mb-16"
						href={marketingUrl("/")}
					>
						<CeitsLogoStacked
							className="opacity-[0.92] transition-opacity hover:opacity-100"
							markSize={56}
							variant="light"
							wordmarkSize="xl"
						/>
					</a>
					<h1 className="font-serif text-[2rem] font-normal leading-tight tracking-tight text-[#122032] md:text-[2.35rem]">
						Your shared life, calmly organized.
					</h1>
					<p className="mt-5 text-base leading-relaxed text-[#3D4F5C]">
						Chat-first spaces for couples, families, and shared projects —
						bills, groceries, subscriptions, and receipts in one composed place.
					</p>
				</motion.div>

				<motion.div className="mt-14" variants={staggerItem}>
					<AuthCard className="space-y-3">
						{inviteHint ? (
							<p
								className="rounded-xl border border-[#8B9F8E]/35 bg-[#EEF3EE] px-3.5 py-3 text-sm leading-relaxed text-[#2F4538]"
								role="status"
							>
								You have a space invite — we&apos;ll keep it with you while you
								sign up or sign in.
							</p>
						) : null}

						<div className="space-y-2.5">
							<AuthProviderButton
								label="Continue with Google"
								provider="google"
								onClick={() => handleEntryProvider("google")}
							/>
							<AuthProviderButton
								label="Continue with Apple"
								provider="apple"
								onClick={() => handleEntryProvider("apple")}
							/>
							<div className="space-y-1">
								<AuthProviderButton
									label="Continue with Telegram"
									provider="telegram"
									onClick={() => handleEntryProvider("telegram")}
								/>
								<AuthTelegramCaptureHint />
							</div>
						</div>

						<AuthDivider>or</AuthDivider>

						<Link
							className="flex h-12 w-full items-center justify-center rounded-xl bg-[#6B8574] text-sm font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,0.12)_inset] transition hover:bg-[#5F7868] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B9F8E]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#FDFCFA]"
							to={registerHref}
						>
							Continue with email
						</Link>

						<AuthEntryProductPreview />

						<Link
							className="flex h-12 w-full items-center justify-center rounded-xl border border-[#D4CEC6] bg-[#FFFCF8] text-sm font-semibold text-[#122032] transition hover:border-[#C4BDB2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B9F8E]/25 focus-visible:ring-offset-2 focus-visible:ring-offset-[#FDFCFA]"
							to={loginHref}
						>
							Sign in
						</Link>

						{entryNotice ? (
							<p
								className="rounded-lg border border-[#E5DFD6] bg-[#F8F6F2] px-3 py-2.5 text-center text-xs leading-relaxed text-[#5C6773]"
								role="status"
							>
								{entryNotice}
							</p>
						) : null}

						<p className="pt-0.5 text-center text-xs leading-relaxed text-[#5C6773]">
							Email keeps your account secure. Ceits remembers invites and
							return links automatically.
						</p>
					</AuthCard>
				</motion.div>
			</motion.div>
		</div>
	);
};
