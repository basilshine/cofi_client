import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { staggerContainer, staggerItem } from "../../shared/lib/appMotion";
import { marketingUrl } from "../../shared/lib/ceitsMarketingUrl";
import { persistOnboardingIntentFromSearch } from "../../shared/lib/onboardingIntent";

export const LoginPage = () => {
	const { login, isAuthenticated, isLoading: authLoading } = useAuth();
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();

	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	const returnTo = searchParams.get("returnTo");
	const inviteOnly = searchParams.get("invite")?.trim();
	const authQueryPreserve = searchParams.toString();
	const registerHref = authQueryPreserve
		? `/register?${authQueryPreserve}`
		: "/register";

	useEffect(() => {
		persistOnboardingIntentFromSearch(searchParams);
	}, [searchParams]);

	useEffect(() => {
		if (authLoading || !isAuthenticated) return;
		if (returnTo?.startsWith("/")) {
			navigate(returnTo, { replace: true });
			return;
		}
		if (inviteOnly) {
			navigate(`/console/chat?invite=${encodeURIComponent(inviteOnly)}`, {
				replace: true,
			});
			return;
		}
		navigate("/console", { replace: true });
	}, [authLoading, isAuthenticated, navigate, returnTo, inviteOnly]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsSubmitting(true);
		setErrorMessage(null);
		try {
			await login({ email, password });
		} catch (err) {
			setErrorMessage(err instanceof Error ? err.message : "Login failed");
		} finally {
			setIsSubmitting(false);
		}
	};

	if (authLoading) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-[hsl(var(--bg))] text-sm text-[hsl(var(--text-secondary))]">
				Loading…
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-[hsl(var(--bg))] px-4 py-10 md:py-16">
			<motion.div
				className="mx-auto grid w-full max-w-6xl gap-8 md:grid-cols-12 md:items-start"
				animate="visible"
				initial="hidden"
				variants={staggerContainer}
			>
				<motion.div
					className="space-y-5 md:col-span-5 md:pr-8"
					variants={staggerItem}
				>
					<a
						className="inline-flex text-lg font-semibold tracking-tight"
						href={marketingUrl("/")}
					>
						Ceits
					</a>
					<h1 className="font-serif text-3xl tracking-tight md:text-4xl">
						Welcome back.
					</h1>
					<p className="text-base leading-7 text-[hsl(var(--text-secondary))]">
						Continue where you left off. You can switch between personal and
						organization spaces after sign-in.
					</p>
					<div className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface))] p-4">
						<p className="text-sm leading-6 text-[hsl(var(--text-secondary))]">
							Signing in for personal use? Use your usual account.
						</p>
						<p className="mt-2 text-sm leading-6 text-[hsl(var(--text-secondary))]">
							Joining an organization? Your workspace is available after
							authentication.
						</p>
						<p className="mt-3 text-xs text-[hsl(var(--text-secondary))]">
							Your existing auth flow, including return destination behavior,
							remains unchanged.
						</p>
					</div>
				</motion.div>

				<motion.div className="md:col-span-7" variants={staggerItem}>
					<div className="mx-auto w-full max-w-md rounded-2xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface))] p-6 shadow-sm md:p-8">
						<h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
						<p className="mt-2 text-sm leading-6 text-[hsl(var(--text-secondary))]">
							Use your email and password to continue.
						</p>

						<form className="mt-6 space-y-6" onSubmit={handleSubmit}>
							<div className="space-y-4">
								<label className="grid gap-1.5" htmlFor="login-email">
									<span className="text-xs font-medium text-[hsl(var(--text-secondary))]">
										Email
									</span>
									<input
										autoComplete="email"
										className="h-11 rounded-md border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg))] px-3 text-sm text-[hsl(var(--text-primary))] outline-none transition focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))]"
										id="login-email"
										onChange={(e) => setEmail(e.target.value)}
										placeholder="you@example.com"
										required
										type="email"
										value={email}
									/>
								</label>
								<label className="grid gap-1.5" htmlFor="login-password">
									<span className="text-xs font-medium text-[hsl(var(--text-secondary))]">
										Password
									</span>
									<input
										autoComplete="current-password"
										className="h-11 rounded-md border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg))] px-3 text-sm text-[hsl(var(--text-primary))] outline-none transition focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))]"
										id="login-password"
										onChange={(e) => setPassword(e.target.value)}
										placeholder="Enter your password"
										required
										type="password"
										value={password}
									/>
								</label>
							</div>

							{errorMessage ? (
								<div
									className="rounded-md border border-[hsl(var(--destructive))]/30 bg-[hsl(var(--destructive))]/10 p-3 text-sm text-[hsl(var(--destructive))]"
									role="alert"
								>
									<span aria-hidden="true" className="mr-2">
										!
									</span>
									{errorMessage}
								</div>
							) : null}

							<div className="space-y-3">
								<button
									className="flex h-11 w-full items-center justify-center rounded-md bg-[hsl(var(--accent))] text-sm font-medium text-[hsl(var(--accent-contrast))] transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--surface))] disabled:cursor-not-allowed disabled:opacity-60 md:w-auto md:min-w-[180px]"
									disabled={isSubmitting}
									type="submit"
								>
									{isSubmitting ? "Signing in…" : "Sign in"}
								</button>
								<div className="flex flex-col gap-2 text-sm text-[hsl(var(--text-secondary))]">
									<p>
										No account?{" "}
										<Link
											className="font-medium text-[hsl(var(--text-primary))] underline underline-offset-4"
											to={registerHref}
										>
											Create one
										</Link>
									</p>
									<p>Need help signing in? Contact your workspace admin.</p>
								</div>
							</div>
						</form>
					</div>
				</motion.div>
			</motion.div>
		</div>
	);
};
