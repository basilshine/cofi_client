import { useEffect, useMemo, useState } from "react";
import { authApi, type AuthUser } from "./authApi";
import { tokenStorage, type AuthProfile } from "../../shared/lib/tokenStorage";

type Mode = "login" | "register";

export const AuthPage = () => {
	const [mode, setMode] = useState<Mode>("login");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [name, setName] = useState("");
	const [country, setCountry] = useState("ru");
	const [language, setLanguage] = useState("ru");

	const [isLoading, setIsLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [user, setUser] = useState<AuthUser | null>(null);
	const [profilesVersion, setProfilesVersion] = useState(0);

	const tokenPreview = useMemo(() => {
		const token = tokenStorage.getToken();
		if (!token) return null;
		if (token.length <= 18) return token;
		return `${token.slice(0, 10)}…${token.slice(-6)}`;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [profilesVersion]);

	const profiles = useMemo(() => {
		// eslint-disable-next-line react-hooks/exhaustive-deps
		return tokenStorage.listProfiles();
	}, [profilesVersion]);

	const activeProfileId = useMemo(() => {
		// eslint-disable-next-line react-hooks/exhaustive-deps
		return tokenStorage.getActiveProfileId();
	}, [profilesVersion]);

	const handleLoadMe = async () => {
		setIsLoading(true);
		setErrorMessage(null);
		try {
			const me = await authApi.me();
			setUser(me);
		} catch (err) {
			setUser(null);
			setErrorMessage(err instanceof Error ? err.message : "Failed to load /me");
		} finally {
			setIsLoading(false);
		}
	};

	const handleSubmit = async () => {
		setIsLoading(true);
		setErrorMessage(null);
		try {
			if (mode === "login") {
				await authApi.login({ email, password });
			} else {
				await authApi.register({ email, password, name, country, language });
			}
			setProfilesVersion((v) => v + 1);
			await handleLoadMe();
		} catch (err) {
			setUser(null);
			setErrorMessage(err instanceof Error ? err.message : "Auth failed");
		} finally {
			setIsLoading(false);
		}
	};

	const handleLogout = () => {
		authApi.logout();
		setUser(null);
		setProfilesVersion((v) => v + 1);
	};

	const handleSwitchProfile = async (profileId: string) => {
		const profile = tokenStorage.activateProfile(profileId);
		setProfilesVersion((v) => v + 1);
		if (!profile) return;
		await handleLoadMe();
	};

	const handleRemoveProfile = (profileId: string) => {
		tokenStorage.removeProfile(profileId);
		setProfilesVersion((v) => v + 1);
	};

	const handleSaveCurrentTokensAsProfile = async () => {
		const accessToken = tokenStorage.getToken();
		if (!accessToken) {
			setErrorMessage("No token found. Login first.");
			return;
		}

		setIsLoading(true);
		setErrorMessage(null);
		try {
			const me = await authApi.me();
			tokenStorage.upsertProfile({
				label: me.email ?? `user_${me.id}`,
				email: me.email,
				userId: me.id,
				accessToken,
				refreshToken: tokenStorage.getRefreshToken(),
			});
			setProfilesVersion((v) => v + 1);
			setUser(me);
		} catch (err) {
			setUser(null);
			setErrorMessage(err instanceof Error ? err.message : "Failed to save profile");
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		const token = tokenStorage.getToken();
		if (!token) return;
		handleLoadMe();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const formatProfileSubtitle = (profile: AuthProfile) => {
		const parts: string[] = [];
		if (profile.userId) parts.push(`id:${profile.userId}`);
		if (profile.email) parts.push(profile.email);
		return parts.join(" · ");
	};

	return (
		<section className="space-y-6">
			<div className="space-y-2">
				<h1 className="text-xl font-semibold">Auth (dev harness)</h1>
				<p className="text-sm text-muted-foreground">
					We keep email auth in the website app to test backend features quickly.
				</p>
			</div>

			<div className="rounded-lg border border-border bg-card p-4">
				<div className="flex flex-wrap items-center gap-2">
					<button
						className={[
							"rounded-md px-3 py-1.5 text-xs font-medium",
							mode === "login"
								? "bg-primary text-primary-foreground"
								: "border border-border text-muted-foreground hover:bg-accent hover:text-foreground",
						].join(" ")}
						onClick={() => setMode("login")}
						type="button"
					>
						Login
					</button>
					<button
						className={[
							"rounded-md px-3 py-1.5 text-xs font-medium",
							mode === "register"
								? "bg-primary text-primary-foreground"
								: "border border-border text-muted-foreground hover:bg-accent hover:text-foreground",
						].join(" ")}
						onClick={() => setMode("register")}
						type="button"
					>
						Register
					</button>
				</div>

				<div className="mt-4 grid gap-3 md:grid-cols-2">
					<label className="grid gap-1">
						<span className="text-xs font-medium text-muted-foreground">Email</span>
						<input
							className="h-10 rounded-md border border-border bg-background px-3 text-sm"
							onChange={(e) => setEmail(e.target.value)}
							placeholder="you@example.com"
							type="email"
							value={email}
						/>
					</label>

					<label className="grid gap-1">
						<span className="text-xs font-medium text-muted-foreground">
							Password
						</span>
						<input
							className="h-10 rounded-md border border-border bg-background px-3 text-sm"
							onChange={(e) => setPassword(e.target.value)}
							placeholder="••••••••"
							type="password"
							value={password}
						/>
					</label>

					{mode === "register" ? (
						<>
							<label className="grid gap-1">
								<span className="text-xs font-medium text-muted-foreground">
									Name
								</span>
								<input
									className="h-10 rounded-md border border-border bg-background px-3 text-sm"
									onChange={(e) => setName(e.target.value)}
									placeholder="Basil"
									type="text"
									value={name}
								/>
							</label>

							<label className="grid gap-1">
								<span className="text-xs font-medium text-muted-foreground">
									Country
								</span>
								<input
									className="h-10 rounded-md border border-border bg-background px-3 text-sm"
									onChange={(e) => setCountry(e.target.value)}
									placeholder="ru"
									type="text"
									value={country}
								/>
							</label>

							<label className="grid gap-1">
								<span className="text-xs font-medium text-muted-foreground">
									Language
								</span>
								<input
									className="h-10 rounded-md border border-border bg-background px-3 text-sm"
									onChange={(e) => setLanguage(e.target.value)}
									placeholder="ru"
									type="text"
									value={language}
								/>
							</label>
						</>
					) : null}
				</div>

				<div className="mt-4 flex flex-wrap items-center gap-2">
					<button
						className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
						disabled={isLoading || !email || !password || (mode === "register" && !name)}
						onClick={handleSubmit}
						type="button"
					>
						{mode === "login" ? "Login" : "Register"}
					</button>

					<button
						className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium hover:bg-accent disabled:opacity-50"
						disabled={isLoading}
						onClick={handleLoadMe}
						type="button"
					>
						Load /me
					</button>

					<button
						className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium hover:bg-accent disabled:opacity-50"
						disabled={isLoading}
						onClick={handleLogout}
						type="button"
					>
						Logout
					</button>
				</div>

				{errorMessage ? (
					<div className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
						{errorMessage}
					</div>
				) : null}
			</div>

			<div className="rounded-lg border border-border bg-card p-4">
				<div className="flex items-center justify-between gap-3">
					<div>
						<div className="text-sm font-medium">Saved users (switch accounts)</div>
						<div className="mt-1 text-xs text-muted-foreground">
							Login/register to add users. Switch to simulate “User A” vs “User B”.
						</div>
					</div>
					<button
						className="inline-flex h-9 items-center rounded-md border border-border px-3 text-xs font-medium hover:bg-accent disabled:opacity-50"
						disabled={isLoading}
						onClick={handleSaveCurrentTokensAsProfile}
						type="button"
					>
						Save current tokens
					</button>
				</div>

				{profiles.length ? (
					<ul className="mt-4 space-y-2">
						{profiles.map((p) => {
							const isActive = p.id === activeProfileId;
							return (
								<li
									className={[
										"rounded-md border border-border p-3",
										isActive ? "bg-accent/40" : "bg-background",
									].join(" ")}
									key={p.id}
								>
									<div className="flex flex-wrap items-center justify-between gap-2">
										<div className="min-w-0">
											<div className="flex items-center gap-2">
												<div className="truncate text-sm font-medium">{p.label}</div>
												{isActive ? (
													<span className="rounded bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
														ACTIVE
													</span>
												) : null}
											</div>
											<div className="mt-1 truncate text-xs text-muted-foreground">
												{formatProfileSubtitle(p) || "—"}
											</div>
										</div>

										<div className="flex flex-wrap items-center gap-2">
											<button
												className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-50"
												disabled={isLoading || isActive}
												onClick={() => void handleSwitchProfile(p.id)}
												type="button"
											>
												Switch
											</button>
											<button
												className="inline-flex h-9 items-center rounded-md border border-border px-3 text-xs font-medium hover:bg-accent disabled:opacity-50"
												disabled={isLoading}
												onClick={() => handleRemoveProfile(p.id)}
												type="button"
											>
												Remove
											</button>
										</div>
									</div>
								</li>
							);
						})}
					</ul>
				) : (
					<div className="mt-4 rounded-md border border-border bg-background p-3 text-sm text-muted-foreground">
						No saved users yet.
					</div>
				)}
			</div>

			<div className="grid gap-3 md:grid-cols-2">
				<div className="rounded-lg border border-border bg-card p-4">
					<div className="text-xs font-medium text-muted-foreground">Token</div>
					<div className="mt-1 break-all font-mono text-xs">
						{tokenPreview ?? "—"}
					</div>
				</div>

				<div className="rounded-lg border border-border bg-card p-4">
					<div className="text-xs font-medium text-muted-foreground">User</div>
					<pre className="mt-2 overflow-auto rounded-md bg-muted p-3 text-xs">
						{JSON.stringify(user, null, 2)}
					</pre>
				</div>
			</div>
		</section>
	);
};

