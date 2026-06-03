import { motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
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
import { ceitsAuthWordmarkRegisterClass } from "./authCeitsWordmarkClasses";
import {
	AUTH_COUNTRY_OPTIONS,
	AUTH_LANGUAGE_OPTIONS,
} from "./authLocaleOptions";
import {
	authSocialPlaceholderMessage,
	isAuthSocialOAuthConfigured,
} from "./authOAuthConfig";
import type { AuthSocialProvider } from "./authSocialTypes";
import { authUserFacingError } from "./authUserFacingError";

const inputClassName =
	"h-12 w-full rounded-xl border border-[#D4CEC6] bg-[#FFFCF8] px-3.5 text-sm text-[#122032] shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] outline-none transition placeholder:text-[#6B7280]/65 focus-visible:border-[#8B9F8E] focus-visible:ring-2 focus-visible:ring-[#8B9F8E]/25";

const selectClassName = `${inputClassName} cursor-pointer appearance-none bg-[length:0.65rem] bg-[right_1rem_center] bg-no-repeat pr-10`;

const labelClassName =
	"text-xs font-medium uppercase tracking-[0.12em] text-[#3D4F5C]";

type RegisterSpaceExample = {
	title: string;
	expenseLine: string;
	amount: string;
	note?: string;
	status?: "pending" | "confirmed";
};

const REGISTER_SPACE_EXAMPLES: readonly RegisterSpaceExample[] = [
	{
		title: "Family Budget",
		expenseLine: "Groceries",
		amount: "$42",
		note: "Milk, bread, fruit",
		status: "pending",
	},
	{
		title: "Home & Bills",
		expenseLine: "Electricity",
		amount: "$68",
		status: "confirmed",
	},
	{
		title: "Plans & Trips",
		expenseLine: "Flights",
		amount: "$320",
	},
] as const;

const statusLabel = (s: "pending" | "confirmed") =>
	s === "pending" ? "Pending" : "Confirmed";

const RegisterSpaceExampleCard = ({
	space,
	compact,
}: {
	space: RegisterSpaceExample;
	compact?: boolean;
}) => (
	<li
		className={
			compact
				? "rounded-[14px] border border-[#E5DFD6] bg-[#FFFCF8] px-3.5 py-3"
				: "rounded-[14px] border border-[#E5DFD6] bg-[#FFFCF8] px-4 py-3.5"
		}
	>
		<div className="flex gap-3">
			<div
				className="flex shrink-0 flex-col items-center gap-1.5 pt-0.5"
				aria-hidden
			>
				<span className="h-2 w-2 rounded-full bg-[#8B9F8E]/75 ring-2 ring-[#8B9F8E]/15" />
				<span className="h-8 w-px bg-gradient-to-b from-[#D4CEC6] to-transparent" />
			</div>
			<div className="min-w-0 flex-1">
				<p className="text-sm font-semibold tracking-tight text-[#122032]">
					{space.title}
				</p>
				<div className="mt-2.5 border-t border-[#E8E2DA]/90 pt-2.5">
					<p className="text-xs font-medium text-[#3D4F5C]">
						{space.expenseLine}{" "}
						<span className="font-normal text-[#9CA3AF]">—</span>{" "}
						<span className="tabular-nums text-[#122032]">{space.amount}</span>
					</p>
					{space.note ? (
						<p className="mt-1 text-[11px] leading-relaxed italic text-[#6B7280]">
							&ldquo;{space.note}&rdquo;
						</p>
					) : null}
					{space.status ? (
						<div className="mt-2 flex items-center justify-between gap-2">
							<span className="h-px flex-1 bg-gradient-to-r from-[#E0D9D0] to-transparent" />
							<span
								className={
									space.status === "pending"
										? "shrink-0 rounded-md border border-[#D4CEC6] bg-[#F6F4EF] px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-[#6B7280]"
										: "shrink-0 rounded-md border border-[#8B9F8E]/30 bg-[#EEF3EE]/90 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-[#5F6F62]"
								}
							>
								{statusLabel(space.status)}
							</span>
						</div>
					) : null}
				</div>
			</div>
		</div>
	</li>
);

export const RegisterPage = () => {
	const {
		register,
		login,
		requestEmailCode,
		confirmEmailCode,
		isAuthenticated,
		isLoading: authLoading,
		onboarding,
	} = useAuth();
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();

	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [name, setName] = useState("");
	const [country, setCountry] = useState("us");
	const [language, setLanguage] = useState("en");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [verificationCode, setVerificationCode] = useState("");
	const [verificationSent, setVerificationSent] = useState(false);
	const [isResendingCode, setIsResendingCode] = useState(false);
	const [isVerifyingCode, setIsVerifyingCode] = useState(false);
	const [verificationInfo, setVerificationInfo] = useState<string | null>(null);
	const [oauthSignUpIntent, setOauthSignUpIntent] =
		useState<AuthSocialProvider | null>(null);
	const [socialNotice, setSocialNotice] = useState<string | null>(null);

	const returnTo = searchParams.get("returnTo");
	const inviteOnly = searchParams.get("invite")?.trim();
	const authQueryPreserve = searchParams.toString();
	const loginHref = authQueryPreserve
		? `/login?${authQueryPreserve}`
		: "/login";

	useEffect(() => {
		persistOnboardingIntentFromSearch(searchParams);
		persistInviteFromSearchParams(searchParams);
	}, [searchParams]);

	useEffect(() => {
		if (authLoading || !isAuthenticated) return;
		if (onboarding && !onboarding.completed) {
			navigate("/onboarding", { replace: true });
			return;
		}
		if (returnTo?.startsWith("/")) {
			navigate(returnTo, { replace: true });
			return;
		}
		if (inviteOnly) {
			navigate(`/join?token=${encodeURIComponent(inviteOnly)}`, {
				replace: true,
			});
			return;
		}
		navigate("/console", { replace: true });
	}, [
		authLoading,
		isAuthenticated,
		navigate,
		returnTo,
		inviteOnly,
		onboarding,
	]);

	const handleRegisterProvider = useCallback((provider: AuthSocialProvider) => {
		setErrorMessage(null);
		setSocialNotice(null);
		if (isAuthSocialOAuthConfigured()) {
			void provider;
			setSocialNotice(
				"Social sign-up will continue from here once the provider flow is connected.",
			);
			return;
		}
		setOauthSignUpIntent(provider);
		setSocialNotice(authSocialPlaceholderMessage());
	}, []);

	const handleClearOauthIntent = useCallback(() => {
		setOauthSignUpIntent(null);
		setSocialNotice(null);
		setErrorMessage(null);
	}, []);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (oauthSignUpIntent && !isAuthSocialOAuthConfigured()) {
			return;
		}
		setIsSubmitting(true);
		setErrorMessage(null);
		try {
			await register({ email, password, name, country, language });
			setVerificationSent(true);
			setOauthSignUpIntent(null);
			setSocialNotice(null);
			setVerificationInfo(
				"We sent a 6-digit code to your inbox. Enter it below to finish creating your account.",
			);
		} catch (err) {
			setErrorMessage(
				authUserFacingError(
					err,
					"We couldn't complete sign-up. Check your details and try again.",
				),
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleResendCode = async () => {
		setIsResendingCode(true);
		setErrorMessage(null);
		try {
			await requestEmailCode(email);
			setVerificationInfo("A fresh code is on its way to your email.");
		} catch (err) {
			setErrorMessage(
				authUserFacingError(
					err,
					"We couldn't resend the code. Wait a moment and try again.",
				),
			);
		} finally {
			setIsResendingCode(false);
		}
	};

	const handleVerifyCode = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsVerifyingCode(true);
		setErrorMessage(null);
		try {
			await confirmEmailCode({ email, code: verificationCode.trim() });
			await login({ email, password });
		} catch (err) {
			setErrorMessage(
				authUserFacingError(
					err,
					"That code doesn't look right. Double-check your email and try again.",
				),
			);
		} finally {
			setIsVerifyingCode(false);
		}
	};

	if (authLoading) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-[#F6F4EF] text-sm text-[#4A5568]">
				<p className="animate-pulse">Loading…</p>
			</div>
		);
	}

	const selectChevronStyle = {
		backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%235C6773' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
	} as const;

	const emailCreateBlocked =
		Boolean(oauthSignUpIntent) && !isAuthSocialOAuthConfigured();
	const showPasswordField = !oauthSignUpIntent;

	return (
		<div className="min-h-screen bg-[#F6F4EF] px-5 py-12 md:px-8 md:py-16">
			<motion.div
				animate="visible"
				className="mx-auto max-w-6xl"
				initial="hidden"
				variants={staggerContainer}
			>
				<motion.div
					className="mb-12 text-center md:mb-14"
					variants={staggerItem}
				>
					<a
						className={ceitsAuthWordmarkRegisterClass}
						href={marketingUrl("/")}
					>
						Ceits
					</a>
				</motion.div>

				<div className="grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,22rem)] lg:items-start lg:gap-14">
					<motion.div className="min-w-0 space-y-10" variants={staggerItem}>
						<div className="space-y-4 text-center lg:text-left">
							<h1 className="font-serif text-[2rem] font-normal leading-tight tracking-tight text-[#122032] md:text-[2.35rem]">
								Create your Ceits account
							</h1>
							<p className="mx-auto max-w-xl text-base leading-relaxed text-[#3D4F5C] lg:mx-0">
								Start organizing your expenses inside personal, shared, and
								business spaces.
							</p>
						</div>

						<AuthCard role="region" aria-labelledby="register-form-title">
							<h2 className="sr-only" id="register-form-title">
								Registration form
							</h2>

							{!verificationSent ? (
								<div className="mb-6 space-y-2.5">
									<AuthProviderButton
										label="Sign up with Google"
										provider="google"
										onClick={() => handleRegisterProvider("google")}
									/>
									<AuthProviderButton
										label="Sign up with Apple"
										provider="apple"
										onClick={() => handleRegisterProvider("apple")}
									/>
									<div className="space-y-1">
										<AuthProviderButton
											label="Sign up with Telegram"
											provider="telegram"
											onClick={() => handleRegisterProvider("telegram")}
										/>
										<AuthTelegramCaptureHint />
									</div>
									{socialNotice && !oauthSignUpIntent ? (
										<p
											className="text-center text-[11px] leading-relaxed text-[#6B7280]"
											role="status"
										>
											{socialNotice}
										</p>
									) : null}
									<AuthDivider className="py-4">
										or create account with email
									</AuthDivider>
								</div>
							) : null}

							{oauthSignUpIntent && !verificationSent ? (
								<div className="mb-5 space-y-3 rounded-xl border border-[#E5DFD6] bg-[#F8F6F2] px-3.5 py-3">
									<p className="text-xs leading-relaxed text-[#4A5568]">
										You chose{" "}
										<span className="font-semibold text-[#122032]">
											{oauthSignUpIntent === "google"
												? "Google"
												: oauthSignUpIntent === "apple"
													? "Apple"
													: "Telegram"}
										</span>
										. A password is not used for that sign-up path.
									</p>
									{socialNotice ? (
										<p className="text-[11px] leading-relaxed text-[#6B7280]">
											{socialNotice}
										</p>
									) : null}
									<button
										className="text-xs font-semibold text-[#122032] underline decoration-[#D4CEC6] underline-offset-4 transition hover:decoration-[#8B9F8E]"
										type="button"
										onClick={handleClearOauthIntent}
									>
										Use email instead
									</button>
								</div>
							) : null}

							<form
								className="space-y-5"
								onSubmit={verificationSent ? handleVerifyCode : handleSubmit}
							>
								<label className="grid gap-2" htmlFor="register-name">
									<span className={labelClassName}>Name</span>
									<input
										autoComplete="name"
										className={inputClassName}
										disabled={verificationSent}
										id="register-name"
										onChange={(e) => setName(e.target.value)}
										placeholder="Your name"
										required
										type="text"
										value={name}
									/>
								</label>
								<label className="grid gap-2" htmlFor="register-email">
									<span className={labelClassName}>Email</span>
									<input
										autoComplete="email"
										className={inputClassName}
										disabled={verificationSent}
										id="register-email"
										onChange={(e) => setEmail(e.target.value)}
										placeholder="you@example.com"
										required
										type="email"
										value={email}
									/>
								</label>
								{showPasswordField ? (
									<label className="grid gap-2" htmlFor="register-password">
										<span className={labelClassName}>Password</span>
										<input
											autoComplete="new-password"
											className={inputClassName}
											disabled={verificationSent}
											id="register-password"
											minLength={6}
											onChange={(e) => setPassword(e.target.value)}
											placeholder="At least 6 characters"
											required
											type="password"
											value={password}
										/>
									</label>
								) : null}

								<div className="grid gap-5 sm:grid-cols-2">
									<label className="grid gap-2" htmlFor="register-country">
										<span className={labelClassName}>Country</span>
										<select
											className={selectClassName}
											disabled={verificationSent}
											id="register-country"
											onChange={(e) => setCountry(e.target.value)}
											required
											style={selectChevronStyle}
											value={country}
										>
											{AUTH_COUNTRY_OPTIONS.map((c) => (
												<option key={c.code} value={c.code}>
													{c.label}
												</option>
											))}
										</select>
									</label>
									<label className="grid gap-2" htmlFor="register-language">
										<span className={labelClassName}>Language</span>
										<select
											className={selectClassName}
											disabled={verificationSent}
											id="register-language"
											onChange={(e) => setLanguage(e.target.value)}
											required
											style={selectChevronStyle}
											value={language}
										>
											{AUTH_LANGUAGE_OPTIONS.map((l) => (
												<option key={l.code} value={l.code}>
													{l.label}
												</option>
											))}
										</select>
									</label>
								</div>

								{verificationSent ? (
									<label className="grid gap-2" htmlFor="register-code">
										<span className={labelClassName}>Email code</span>
										<input
											className={`${inputClassName} tracking-[0.35em]`}
											id="register-code"
											inputMode="numeric"
											maxLength={6}
											onChange={(e) =>
												setVerificationCode(e.target.value.replace(/\D/g, ""))
											}
											placeholder="• • • • • •"
											required
											type="text"
											value={verificationCode}
										/>
									</label>
								) : null}

								{verificationInfo ? (
									<div className="rounded-xl border border-[#8B9F8E]/35 bg-[#EEF3EE] px-3.5 py-3 text-sm leading-relaxed text-[#2F4538]">
										{verificationInfo}
									</div>
								) : null}

								{errorMessage ? (
									<div
										className="rounded-xl border border-[#C4A69C]/50 bg-[#FAF0EC] px-3.5 py-3 text-sm leading-relaxed text-[#5C3D36]"
										role="alert"
									>
										{errorMessage}
									</div>
								) : null}

								<div className="space-y-3 pt-1">
									<button
										className="flex h-12 w-full items-center justify-center rounded-xl bg-[#6B8574] text-sm font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,0.12)_inset] transition hover:bg-[#5F7868] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B9F8E]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#FDFCFA] disabled:cursor-not-allowed disabled:opacity-55"
										disabled={
											verificationSent
												? isVerifyingCode ||
													verificationCode.trim().length !== 6
												: isSubmitting || emailCreateBlocked
										}
										type="submit"
									>
										{verificationSent
											? isVerifyingCode
												? "Verifying…"
												: "Verify and continue"
											: isSubmitting
												? "Creating account…"
												: "Create account"}
									</button>
									{verificationSent ? (
										<button
											className="flex h-12 w-full items-center justify-center rounded-xl border border-[#D4CEC6] bg-[#FFFCF8] text-sm font-semibold text-[#122032] transition hover:border-[#C4BDB2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B9F8E]/25 disabled:cursor-not-allowed disabled:opacity-50"
											disabled={isResendingCode}
											onClick={handleResendCode}
											type="button"
										>
											{isResendingCode ? "Sending…" : "Resend code"}
										</button>
									) : null}
								</div>
							</form>
						</AuthCard>

						<p className="text-center text-sm text-[#4A5568] lg:text-left">
							Already have an account?{" "}
							<Link
								className="font-semibold text-[#122032] underline decoration-[#D4CEC6] underline-offset-[5px] transition hover:decoration-[#8B9F8E]"
								to={loginHref}
							>
								Sign in
							</Link>
						</p>
					</motion.div>

					<motion.aside
						className="hidden lg:block"
						variants={staggerItem}
						aria-label="Example Ceits spaces"
					>
						<div className="sticky top-10 rounded-2xl border border-[#D4CEC6] bg-[#FDFCFA] p-8 shadow-[0_20px_40px_-24px_rgba(18,32,50,0.1)]">
							<p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-[#6B7280]">
								Inside Ceits
							</p>
							<p className="mt-2 font-serif text-xl text-[#122032]">
								Spaces keep context together
							</p>
							<ul className="mt-8 space-y-4">
								{REGISTER_SPACE_EXAMPLES.map((space) => (
									<RegisterSpaceExampleCard key={space.title} space={space} />
								))}
							</ul>
						</div>
					</motion.aside>
				</div>

				<motion.div
					className="mt-10 border-t border-[#E0D9D0] pt-8 lg:hidden"
					variants={staggerItem}
				>
					<p className="text-center text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-[#6B7280]">
						Example spaces
					</p>
					<ul className="mt-4 space-y-3">
						{REGISTER_SPACE_EXAMPLES.map((space) => (
							<RegisterSpaceExampleCard
								compact
								key={space.title}
								space={space}
							/>
						))}
					</ul>
				</motion.div>
			</motion.div>
		</div>
	);
};
