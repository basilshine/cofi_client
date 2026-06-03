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
import { AuthProviderButton } from "./AuthProviderButton";
import { ceitsAuthWordmarkLoginClass } from "./authCeitsWordmarkClasses";
import {
	authSocialPlaceholderMessage,
	isAuthSocialOAuthConfigured,
} from "./authOAuthConfig";
import type { AuthSocialProvider } from "./authSocialTypes";
import { authUserFacingError } from "./authUserFacingError";

const inputClassName =
	"h-12 w-full rounded-xl border border-[#D4CEC6] bg-[#FFFCF8] px-3.5 text-sm text-[#122032] shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] outline-none transition placeholder:text-[#6B7280]/65 focus-visible:border-[#8B9F8E] focus-visible:ring-2 focus-visible:ring-[#8B9F8E]/25";

const labelClassName =
	"text-xs font-medium uppercase tracking-[0.12em] text-[#3D4F5C]";

export const LoginPage = () => {
	const {
		login,
		isAuthenticated,
		isLoading: authLoading,
		onboarding,
	} = useAuth();
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();

	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [loginSocialNotice, setLoginSocialNotice] = useState<string | null>(
		null,
	);

	const handleLoginProvider = useCallback((provider: AuthSocialProvider) => {
		void provider;
		if (isAuthSocialOAuthConfigured()) {
			setLoginSocialNotice(
				"Social sign-in will continue from here once your workspace enables it.",
			);
			return;
		}
		setLoginSocialNotice(authSocialPlaceholderMessage());
	}, []);

	const returnTo = searchParams.get("returnTo");
	const inviteOnly = searchParams.get("invite")?.trim();
	const authQueryPreserve = searchParams.toString();
	const registerHref = authQueryPreserve
		? `/register?${authQueryPreserve}`
		: "/register";

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

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsSubmitting(true);
		setErrorMessage(null);
		try {
			await login({ email, password });
		} catch (err) {
			setErrorMessage(
				authUserFacingError(
					err,
					"We couldn't sign you in. Check your email and password, then try again.",
				),
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	if (authLoading) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-[#F6F4EF] text-sm text-[#4A5568]">
				<p className="animate-pulse">Loading…</p>
			</div>
		);
	}

	return (
		<div className="relative min-h-screen overflow-hidden bg-[#F6F4EF] px-5 py-14 md:px-8 md:py-20">
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_70%_at_0%_-10%,rgba(139,159,142,0.055),transparent_52%),radial-gradient(ellipse_90%_55%_at_100%_100%,rgba(18,32,50,0.028),transparent_48%)]"
			/>
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0 opacity-[0.35] mix-blend-multiply"
				style={{
					backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.06'/%3E%3C/svg%3E")`,
					backgroundSize: "256px 256px",
				}}
			/>
			<motion.div
				animate="visible"
				className="relative z-[1] mx-auto grid w-full max-w-5xl gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-center lg:gap-16"
				initial="hidden"
				variants={staggerContainer}
			>
				<motion.header className="flex flex-col" variants={staggerItem}>
					<a
						className={`${ceitsAuthWordmarkLoginClass} mb-10 lg:mb-11`}
						href={marketingUrl("/")}
					>
						Ceits
					</a>
					<div className="flex flex-col gap-5">
						<h1 className="font-serif text-[2rem] font-normal leading-tight tracking-tight text-[#122032] md:text-[2.35rem]">
							Welcome back
						</h1>
						<p className="max-w-md text-base leading-relaxed text-[#3D4F5C]">
							Continue where your money context lives.
						</p>
					</div>
					<p className="mt-10 hidden max-w-sm text-sm leading-relaxed text-[#5C6773] lg:block">
						Personal, shared, and business spaces stay in sync—so you pick up
						right where you left off.
					</p>
				</motion.header>

				<motion.div
					className="lg:border-l lg:border-[#E0D9D0]/55 lg:pl-14"
					variants={staggerItem}
				>
					<AuthCard role="region" aria-labelledby="login-form-title">
						<h2 className="sr-only" id="login-form-title">
							Sign in to Ceits
						</h2>

						<div className="space-y-2.5">
							<AuthProviderButton
								label="Sign in with Google"
								provider="google"
								onClick={() => handleLoginProvider("google")}
							/>
							<AuthProviderButton
								label="Sign in with Apple"
								provider="apple"
								onClick={() => handleLoginProvider("apple")}
							/>
							<AuthProviderButton
								label="Sign in with Telegram"
								provider="telegram"
								onClick={() => handleLoginProvider("telegram")}
							/>
						</div>

						<AuthDivider className="py-4">or sign in with email</AuthDivider>

						{loginSocialNotice ? (
							<p
								className="mb-5 rounded-lg border border-[#E5DFD6] bg-[#F8F6F2] px-3 py-2.5 text-center text-xs leading-relaxed text-[#5C6773]"
								role="status"
							>
								{loginSocialNotice}
							</p>
						) : null}

						<form className="space-y-6" onSubmit={handleSubmit}>
							<div className="space-y-5">
								<label className="grid gap-2" htmlFor="login-email">
									<span className={labelClassName}>Email</span>
									<input
										autoComplete="email"
										className={inputClassName}
										id="login-email"
										onChange={(e) => setEmail(e.target.value)}
										placeholder="you@example.com"
										required
										type="email"
										value={email}
									/>
								</label>
								<div className="grid gap-2">
									<div className="flex items-center justify-between gap-3">
										<label className={labelClassName} htmlFor="login-password">
											Password
										</label>
										<a
											className="text-xs font-medium text-[#5F6B6A] underline decoration-[#D4CEC6] underline-offset-4 transition hover:text-[#122032] hover:decoration-[#8B9F8E]"
											href="mailto:support@ceits.app?subject=Ceits%20password%20help"
										>
											Forgot password?
										</a>
									</div>
									<input
										autoComplete="current-password"
										className={inputClassName}
										id="login-password"
										onChange={(e) => setPassword(e.target.value)}
										placeholder="Enter your password"
										required
										type="password"
										value={password}
									/>
								</div>
							</div>

							{errorMessage ? (
								<div
									className="rounded-xl border border-[#C4A69C]/50 bg-[#FAF0EC] px-3.5 py-3 text-sm leading-relaxed text-[#5C3D36]"
									role="alert"
								>
									{errorMessage}
								</div>
							) : null}

							<div className="space-y-5 pt-1">
								<button
									className="flex h-12 w-full items-center justify-center rounded-xl bg-[#6B8574] text-sm font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,0.12)_inset] transition hover:bg-[#5F7868] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B9F8E]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#FDFCFA] disabled:cursor-not-allowed disabled:opacity-55"
									disabled={isSubmitting}
									type="submit"
								>
									{isSubmitting ? "Signing in…" : "Sign in"}
								</button>
								<p className="text-center text-sm text-[#4A5568]">
									<Link
										className="font-semibold text-[#122032] underline decoration-[#D4CEC6] underline-offset-[5px] transition hover:decoration-[#8B9F8E]"
										to={registerHref}
									>
										Create account
									</Link>
								</p>
							</div>
						</form>
					</AuthCard>
				</motion.div>
			</motion.div>
		</div>
	);
};
