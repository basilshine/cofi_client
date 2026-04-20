import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { marketingUrl } from "../../shared/lib/ceitsMarketingUrl";
import { persistOnboardingIntentFromSearch } from "../../shared/lib/onboardingIntent";

export const RegisterPage = () => {
	const { register, isAuthenticated, isLoading: authLoading } = useAuth();
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();

	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [name, setName] = useState("");
	const [country, setCountry] = useState("us");
	const [language, setLanguage] = useState("en");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	const returnTo = searchParams.get("returnTo");
	const inviteOnly = searchParams.get("invite")?.trim();
	const authQueryPreserve = searchParams.toString();
	const loginHref = authQueryPreserve
		? `/login?${authQueryPreserve}`
		: "/login";

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
			await register({ email, password, name, country, language });
		} catch (err) {
			setErrorMessage(
				err instanceof Error ? err.message : "Registration failed",
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	if (authLoading) {
		return (
			<div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
				Loading…
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-background px-4 py-12">
			<div className="mx-auto w-full max-w-md space-y-8">
				<div className="text-center">
					<a className="text-lg font-semibold" href={marketingUrl("/")}>
						Ceits
					</a>
					<h1 className="mt-6 text-2xl font-semibold">Create account</h1>
					<p className="mt-2 text-sm text-muted-foreground">
						Registers with the same{" "}
						<code className="rounded bg-muted px-1 text-xs">
							/api/v1/auth/register
						</code>{" "}
						flow as the API.
					</p>
				</div>

				<form className="space-y-4" onSubmit={handleSubmit}>
					<label className="grid gap-1">
						<span className="text-xs font-medium text-muted-foreground">
							Name
						</span>
						<input
							className="h-11 rounded-md border border-border bg-background px-3 text-sm"
							onChange={(e) => setName(e.target.value)}
							required
							type="text"
							value={name}
						/>
					</label>
					<label className="grid gap-1">
						<span className="text-xs font-medium text-muted-foreground">
							Email
						</span>
						<input
							autoComplete="email"
							className="h-11 rounded-md border border-border bg-background px-3 text-sm"
							onChange={(e) => setEmail(e.target.value)}
							required
							type="email"
							value={email}
						/>
					</label>
					<label className="grid gap-1">
						<span className="text-xs font-medium text-muted-foreground">
							Password
						</span>
						<input
							autoComplete="new-password"
							className="h-11 rounded-md border border-border bg-background px-3 text-sm"
							minLength={6}
							onChange={(e) => setPassword(e.target.value)}
							required
							type="password"
							value={password}
						/>
					</label>
					<div className="grid gap-4 md:grid-cols-2">
						<label className="grid gap-1">
							<span className="text-xs font-medium text-muted-foreground">
								Country
							</span>
							<input
								className="h-11 rounded-md border border-border bg-background px-3 text-sm"
								onChange={(e) => setCountry(e.target.value)}
								required
								type="text"
								value={country}
							/>
						</label>
						<label className="grid gap-1">
							<span className="text-xs font-medium text-muted-foreground">
								Language
							</span>
							<input
								className="h-11 rounded-md border border-border bg-background px-3 text-sm"
								onChange={(e) => setLanguage(e.target.value)}
								required
								type="text"
								value={language}
							/>
						</label>
					</div>

					{errorMessage ? (
						<div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
							{errorMessage}
						</div>
					) : null}

					<button
						className="flex h-11 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50"
						disabled={isSubmitting}
						type="submit"
					>
						{isSubmitting ? "Creating…" : "Create account"}
					</button>
				</form>

				<p className="text-center text-sm text-muted-foreground">
					Already have an account?{" "}
					<Link
						className="font-medium text-foreground underline"
						to={loginHref}
					>
						Sign in
					</Link>
				</p>
			</div>
		</div>
	);
};
