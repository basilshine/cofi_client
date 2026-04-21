import {
	NOTIFICATION_CHANNEL_KEYS,
	type NotificationChannelKey,
	type NotificationChannelsMap,
	notificationChannelsMapFromResponse,
} from "@cofi/api";
import type { TenantInviteRow, TenantMember } from "@cofi/api";
import axios from "axios";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type {
	ProfileUpdateRequest,
	UserPreferencesPayload,
} from "../../../../../packages/api/src/types";
import { useAuth } from "../../contexts/AuthContext";
import { apiClient, readActiveOrgTenantId } from "../../shared/lib/apiClient";
import { type AuthProfile, tokenStorage } from "../../shared/lib/tokenStorage";
import {
	type ThemeId,
	getThemeFromUserPreferences,
	themeRegistry,
	useTheme,
} from "../../shared/theme/theme";
import { authApi } from "./authApi";

const NOTIFICATION_CHANNEL_LABELS: Record<NotificationChannelKey, string> = {
	in_app: "In-app",
	telegram: "Telegram",
	email: "Email",
	push: "Push",
};

const DATE_FORMAT_OPTIONS = ["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"] as const;

const WEEK_START_OPTIONS: { value: number; label: string }[] = [
	{ value: 0, label: "Sunday" },
	{ value: 1, label: "Monday" },
	{ value: 2, label: "Tuesday" },
	{ value: 3, label: "Wednesday" },
	{ value: 4, label: "Thursday" },
	{ value: 5, label: "Friday" },
	{ value: 6, label: "Saturday" },
];

const MONTH_OPTIONS = [
	{ value: 1, label: "January" },
	{ value: 2, label: "February" },
	{ value: 3, label: "March" },
	{ value: 4, label: "April" },
	{ value: 5, label: "May" },
	{ value: 6, label: "June" },
	{ value: 7, label: "July" },
	{ value: 8, label: "August" },
	{ value: 9, label: "September" },
	{ value: 10, label: "October" },
	{ value: 11, label: "November" },
	{ value: 12, label: "December" },
];

const FILING_INTENTS = [
	{ value: "unspecified", label: "Unspecified" },
	{ value: "personal", label: "Personal" },
	{ value: "business", label: "Business" },
] as const;

const TENANT_INVITE_ROLES = [
	{ value: "member", label: "Member" },
	{ value: "viewer", label: "Viewer" },
	{ value: "editor", label: "Editor" },
	{ value: "admin", label: "Admin" },
] as const;

const isHttp403 = (err: unknown): boolean =>
	err instanceof Error && /\b403\b/.test(err.message);

const getErrorMessage = (err: unknown): string => {
	if (axios.isAxiosError(err)) {
		const data = err.response?.data as { error?: string } | undefined;
		if (data?.error) return data.error;
		return err.message;
	}
	if (err instanceof Error) return err.message;
	return "Something went wrong";
};

const isPrefsObject = (v: unknown): v is UserPreferencesPayload => {
	return typeof v === "object" && v !== null && !Array.isArray(v);
};

export const AccountPage = () => {
	const { user, refreshUser, logout } = useAuth();
	const [profilesVersion, setProfilesVersion] = useState(0);
	const [isLoading, setIsLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [saveMessage, setSaveMessage] = useState<string | null>(null);

	const [email, setEmail] = useState("");
	const [name, setName] = useState("");
	const [country, setCountry] = useState("");
	const [language, setLanguage] = useState("");
	const [timezone, setTimezone] = useState("");
	const [currency, setCurrency] = useState("");
	const [dateFormat, setDateFormat] =
		useState<(typeof DATE_FORMAT_OPTIONS)[number]>("YYYY-MM-DD");
	const [emailNotifications, setEmailNotifications] = useState(false);
	const [darkMode, setDarkMode] = useState(false);
	const { theme, setTheme } = useTheme();
	const [selectedTheme, setSelectedTheme] = useState<ThemeId>(theme);

	const [weekStartsOn, setWeekStartsOn] = useState(1);
	const [fiscalYearStartMonth, setFiscalYearStartMonth] = useState(1);
	const [reportingCurrency, setReportingCurrency] = useState("");

	const [taxPreferencesConsent, setTaxPreferencesConsent] = useState(false);
	const [taxPrimaryCountry, setTaxPrimaryCountry] = useState("");
	const [taxFilingIntent, setTaxFilingIntent] =
		useState<(typeof FILING_INTENTS)[number]["value"]>("unspecified");

	const [notifChannels, setNotifChannels] =
		useState<NotificationChannelsMap | null>(null);
	const [notifLoading, setNotifLoading] = useState(false);
	const [notifSaving, setNotifSaving] = useState(false);
	const [notifError, setNotifError] = useState<string | null>(null);

	const [tenantInvitesPersonal, setTenantInvitesPersonal] = useState<
		TenantInviteRow[] | null
	>(null);
	const [tenantInvitesOrg, setTenantInvitesOrg] = useState<
		TenantInviteRow[] | null
	>(null);
	const [invitesError, setInvitesError] = useState<string | null>(null);
	const [tenantMembersPersonal, setTenantMembersPersonal] = useState<
		TenantMember[] | null
	>(null);
	const [tenantMembersOrg, setTenantMembersOrg] = useState<
		TenantMember[] | null
	>(null);
	const [membersError, setMembersError] = useState<string | null>(null);
	const [personalTenantAdmin, setPersonalTenantAdmin] = useState<
		boolean | null
	>(null);
	const [orgTenantAdmin, setOrgTenantAdmin] = useState<boolean | null>(null);
	const [personalTenantId, setPersonalTenantId] = useState<number | null>(null);
	const [sessionOrgTenantId, setSessionOrgTenantId] = useState<number | null>(
		null,
	);
	const [inviteEmailPersonal, setInviteEmailPersonal] = useState("");
	const [inviteRolePersonal, setInviteRolePersonal] = useState("member");
	const [inviteBusyPersonal, setInviteBusyPersonal] = useState(false);
	const [inviteEmailOrg, setInviteEmailOrg] = useState("");
	const [inviteRoleOrg, setInviteRoleOrg] = useState("member");
	const [inviteBusyOrg, setInviteBusyOrg] = useState(false);

	useEffect(() => {
		if (!user) return;
		setEmail(user.email ?? "");
		setName(user.name ?? "");
		setCountry(user.country ?? "");
		setLanguage(user.language ?? "");
		setTimezone(user.timezone ?? "");
		setCurrency(user.currency ?? "");
		const df = user.dateFormat;
		setDateFormat(
			df === "MM/DD/YYYY" || df === "DD/MM/YYYY" || df === "YYYY-MM-DD"
				? df
				: "YYYY-MM-DD",
		);
		setEmailNotifications(Boolean(user.emailNotifications));
		setDarkMode(Boolean(user.darkMode));
		setTaxPreferencesConsent(Boolean(user.taxPreferencesConsent));
		const userTheme = getThemeFromUserPreferences(user.userPreferences);
		setSelectedTheme(userTheme ?? theme);

		const prefs = user.userPreferences;
		if (isPrefsObject(prefs)) {
			const fin = prefs.financial;
			if (fin && typeof fin === "object") {
				if (typeof fin.weekStartsOn === "number") {
					setWeekStartsOn(
						fin.weekStartsOn >= 0 && fin.weekStartsOn <= 6
							? fin.weekStartsOn
							: 1,
					);
				}
				if (typeof fin.fiscalYearStartMonth === "number") {
					const m = fin.fiscalYearStartMonth;
					setFiscalYearStartMonth(m >= 1 && m <= 12 ? m : 1);
				}
				if (typeof fin.reportingCurrency === "string") {
					setReportingCurrency(fin.reportingCurrency);
				}
			}
			const tax = prefs.tax;
			if (tax && typeof tax === "object") {
				if (typeof tax.primaryCountry === "string") {
					setTaxPrimaryCountry(tax.primaryCountry);
				}
				if (
					tax.filingIntent === "personal" ||
					tax.filingIntent === "business" ||
					tax.filingIntent === "unspecified"
				) {
					setTaxFilingIntent(tax.filingIntent);
				}
			}
		} else {
			setWeekStartsOn(1);
			setFiscalYearStartMonth(1);
			setReportingCurrency("");
			setTaxPrimaryCountry("");
			setTaxFilingIntent("unspecified");
		}
	}, [user, theme]);

	useEffect(() => {
		if (!user) {
			setNotifChannels(null);
			return;
		}
		let cancelled = false;
		void (async () => {
			setNotifLoading(true);
			setNotifError(null);
			try {
				const res = await apiClient.me.getNotificationChannels();
				if (!cancelled) {
					setNotifChannels(notificationChannelsMapFromResponse(res));
				}
			} catch (err) {
				if (!cancelled) setNotifError(getErrorMessage(err));
			} finally {
				if (!cancelled) setNotifLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [user]);

	useEffect(() => {
		if (!user) {
			setTenantInvitesPersonal(null);
			setTenantInvitesOrg(null);
			setTenantMembersPersonal(null);
			setTenantMembersOrg(null);
			setPersonalTenantAdmin(null);
			setOrgTenantAdmin(null);
			setPersonalTenantId(null);
			setSessionOrgTenantId(null);
			return;
		}
		let cancelled = false;
		setInvitesError(null);
		setMembersError(null);
		void (async () => {
			try {
				const dash = await apiClient.dashboard.get({ variant: "personal" });
				const tid = dash.context.tenant_id;
				if (!cancelled) setPersonalTenantId(tid);
				const mem = await apiClient.tenants.listMembers(tid, {
					tenantIdHeader: tid,
				});
				if (!cancelled) setTenantMembersPersonal(mem.members);
				try {
					const res = await apiClient.tenants.listInvites(tid, {
						tenantIdHeader: tid,
					});
					if (!cancelled) {
						setTenantInvitesPersonal(res.invites);
						setPersonalTenantAdmin(true);
					}
				} catch (e) {
					if (!cancelled) {
						if (isHttp403(e)) {
							setTenantInvitesPersonal([]);
							setPersonalTenantAdmin(false);
						} else {
							setTenantInvitesPersonal(null);
							setPersonalTenantAdmin(null);
							setInvitesError(
								"Could not load personal workspace invites (tenant admin only for full list).",
							);
						}
					}
				}
			} catch (e) {
				if (!cancelled) {
					setTenantMembersPersonal(null);
					setMembersError(
						e instanceof Error
							? e.message
							: "Could not load personal workspace members.",
					);
				}
			}
			const orgId = readActiveOrgTenantId();
			if (!cancelled) setSessionOrgTenantId(orgId);
			if (orgId == null) {
				if (!cancelled) {
					setTenantInvitesOrg(null);
					setTenantMembersOrg(null);
					setOrgTenantAdmin(null);
				}
				return;
			}
			try {
				const mem = await apiClient.tenants.listMembers(orgId, {
					tenantIdHeader: orgId,
				});
				if (!cancelled) setTenantMembersOrg(mem.members);
				try {
					const res = await apiClient.tenants.listInvites(orgId, {
						tenantIdHeader: orgId,
					});
					if (!cancelled) {
						setTenantInvitesOrg(res.invites);
						setOrgTenantAdmin(true);
					}
				} catch (e) {
					if (!cancelled) {
						if (isHttp403(e)) {
							setTenantInvitesOrg([]);
							setOrgTenantAdmin(false);
						} else {
							setTenantInvitesOrg(null);
							setOrgTenantAdmin(null);
						}
					}
				}
			} catch {
				if (!cancelled) setTenantMembersOrg(null);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [user]);

	const handleInvitePersonal = async (e: FormEvent) => {
		e.preventDefault();
		if (!personalTenantId || !inviteEmailPersonal.trim()) return;
		setInviteBusyPersonal(true);
		setInvitesError(null);
		try {
			await apiClient.tenants.createInvite(personalTenantId, {
				email: inviteEmailPersonal.trim(),
				invited_tenant_role: inviteRolePersonal,
				channel: "email",
			});
			setInviteEmailPersonal("");
			const inv = await apiClient.tenants.listInvites(personalTenantId, {
				tenantIdHeader: personalTenantId,
			});
			setTenantInvitesPersonal(inv.invites);
		} catch (err) {
			setInvitesError(getErrorMessage(err));
		} finally {
			setInviteBusyPersonal(false);
		}
	};

	const handleInviteOrg = async (e: FormEvent) => {
		e.preventDefault();
		const oid = sessionOrgTenantId ?? readActiveOrgTenantId();
		if (oid == null || !inviteEmailOrg.trim()) return;
		setInviteBusyOrg(true);
		setInvitesError(null);
		try {
			await apiClient.tenants.createInvite(oid, {
				email: inviteEmailOrg.trim(),
				invited_tenant_role: inviteRoleOrg,
				channel: "email",
			});
			setInviteEmailOrg("");
			const inv = await apiClient.tenants.listInvites(oid, {
				tenantIdHeader: oid,
			});
			setTenantInvitesOrg(inv.invites);
		} catch (err) {
			setInvitesError(getErrorMessage(err));
		} finally {
			setInviteBusyOrg(false);
		}
	};

	const handleRemovePersonalMember = async (targetUserId: number) => {
		if (!personalTenantId) return;
		if (
			!window.confirm(
				"Remove this person from your personal workspace? They will lose tenant access.",
			)
		) {
			return;
		}
		setMembersError(null);
		try {
			await apiClient.tenants.removeMember(personalTenantId, targetUserId, {
				tenantIdHeader: personalTenantId,
			});
			const mem = await apiClient.tenants.listMembers(personalTenantId, {
				tenantIdHeader: personalTenantId,
			});
			setTenantMembersPersonal(mem.members);
		} catch (err) {
			setMembersError(getErrorMessage(err));
		}
	};

	const handleRemoveOrgMember = async (targetUserId: number) => {
		const oid = sessionOrgTenantId ?? readActiveOrgTenantId();
		if (oid == null) return;
		if (
			!window.confirm(
				"Remove this person from the organization workspace? They will lose tenant access.",
			)
		) {
			return;
		}
		setMembersError(null);
		try {
			await apiClient.tenants.removeMember(oid, targetUserId, {
				tenantIdHeader: oid,
			});
			const mem = await apiClient.tenants.listMembers(oid, {
				tenantIdHeader: oid,
			});
			setTenantMembersOrg(mem.members);
		} catch (err) {
			setMembersError(getErrorMessage(err));
		}
	};

	const handleCancelPersonalInvite = async (inviteId: number) => {
		if (!personalTenantId) return;
		setInvitesError(null);
		try {
			await apiClient.tenants.cancelInvite(personalTenantId, inviteId, {
				tenantIdHeader: personalTenantId,
			});
			const inv = await apiClient.tenants.listInvites(personalTenantId, {
				tenantIdHeader: personalTenantId,
			});
			setTenantInvitesPersonal(inv.invites);
		} catch (err) {
			setInvitesError(getErrorMessage(err));
		}
	};

	const handleCancelOrgInvite = async (inviteId: number) => {
		const oid = sessionOrgTenantId ?? readActiveOrgTenantId();
		if (oid == null) return;
		setInvitesError(null);
		try {
			await apiClient.tenants.cancelInvite(oid, inviteId, {
				tenantIdHeader: oid,
			});
			const inv = await apiClient.tenants.listInvites(oid, {
				tenantIdHeader: oid,
			});
			setTenantInvitesOrg(inv.invites);
		} catch (err) {
			setInvitesError(getErrorMessage(err));
		}
	};

	const handleNotificationChannelToggle = async (
		key: NotificationChannelKey,
		enabled: boolean,
	) => {
		if (!notifChannels) return;
		const prev = notifChannels;
		const next: NotificationChannelsMap = { ...notifChannels, [key]: enabled };
		setNotifChannels(next);
		setNotifError(null);
		setNotifSaving(true);
		try {
			await apiClient.me.putNotificationChannels({ channels: next });
		} catch (err) {
			setNotifChannels(prev);
			setNotifError(getErrorMessage(err));
		} finally {
			setNotifSaving(false);
		}
	};

	const tokenPreview = useMemo(() => {
		void profilesVersion;
		const token = tokenStorage.getToken();
		if (!token) return null;
		if (token.length <= 18) return token;
		return `${token.slice(0, 10)}…${token.slice(-6)}`;
	}, [profilesVersion]);

	const profiles = useMemo(() => {
		void profilesVersion;
		return tokenStorage.listProfiles();
	}, [profilesVersion]);
	const activeProfileId = useMemo(() => {
		void profilesVersion;
		return tokenStorage.getActiveProfileId();
	}, [profilesVersion]);

	const handleLoadMe = async () => {
		setIsLoading(true);
		setErrorMessage(null);
		try {
			await refreshUser();
		} catch (err) {
			setErrorMessage(
				err instanceof Error ? err.message : "Failed to refresh session",
			);
		} finally {
			setIsLoading(false);
		}
	};

	const handleSwitchProfile = async (profileId: string) => {
		tokenStorage.activateProfile(profileId);
		setProfilesVersion((v) => v + 1);
		setIsLoading(true);
		try {
			await refreshUser();
		} finally {
			setIsLoading(false);
		}
	};

	const handleRemoveProfile = (profileId: string) => {
		tokenStorage.removeProfile(profileId);
		setProfilesVersion((v) => v + 1);
	};

	const handleSaveCurrentTokensAsProfile = async () => {
		const accessToken = tokenStorage.getToken();
		if (!accessToken) {
			setErrorMessage("No token found. Sign in first.");
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
			await refreshUser();
		} catch (err) {
			setErrorMessage(
				err instanceof Error ? err.message : "Failed to save profile",
			);
		} finally {
			setIsLoading(false);
		}
	};

	const formatProfileSubtitle = (profile: AuthProfile) => {
		const parts: string[] = [];
		if (profile.userId) parts.push(`id:${profile.userId}`);
		if (profile.email) parts.push(profile.email);
		return parts.join(" · ");
	};

	const handleCurrencyBlur = () => {
		const t = currency.trim().toUpperCase();
		if (t.length === 3) setCurrency(t);
	};

	const handleTaxCountryBlur = () => {
		const t = taxPrimaryCountry.trim().toUpperCase().slice(0, 2);
		setTaxPrimaryCountry(t);
	};

	const handleThemeChange = (nextTheme: ThemeId) => {
		setSelectedTheme(nextTheme);
		setTheme(nextTheme);
	};

	const handleProfileSubmit = async (e: FormEvent) => {
		e.preventDefault();
		if (!user) return;
		setSaveMessage(null);
		setErrorMessage(null);
		const cur = currency.trim().toUpperCase();
		if (cur.length !== 3 || !/^[A-Z]{3}$/.test(cur)) {
			setErrorMessage("Currency must be a 3-letter ISO code (e.g. USD).");
			return;
		}
		if (!timezone.trim()) {
			setErrorMessage("Timezone is required (IANA, e.g. Europe/London).");
			return;
		}

		const reporting = reportingCurrency.trim().toUpperCase();
		if (reporting !== "" && !/^[A-Z]{3}$/.test(reporting)) {
			setErrorMessage(
				"Reporting currency must be empty or a 3-letter ISO code.",
			);
			return;
		}

		const userPreferences: UserPreferencesPayload = {
			version: 1,
			financial: {
				weekStartsOn,
				fiscalYearStartMonth,
				reportingCurrency: reporting === "" ? "" : reporting,
			},
			appearance: {
				theme: selectedTheme,
			},
		};

		if (taxPreferencesConsent) {
			const pc = taxPrimaryCountry.trim().toUpperCase();
			if (pc !== "" && !/^[A-Z]{2}$/.test(pc)) {
				setErrorMessage(
					"Primary tax country must be empty or a 2-letter ISO country code.",
				);
				return;
			}
			userPreferences.tax = {
				primaryCountry: pc,
				filingIntent: taxFilingIntent,
			};
		}

		const body: ProfileUpdateRequest = {
			email: email.trim(),
			name: name.trim(),
			country: country.trim(),
			language: language.trim(),
			timezone: timezone.trim(),
			currency: cur,
			dateFormat,
			emailNotifications,
			darkMode,
			userPreferences,
			taxPreferencesConsent,
		};

		setIsLoading(true);
		try {
			await authApi.updateProfile(body);
			await refreshUser();
			setSaveMessage("Profile saved.");
		} catch (err) {
			setErrorMessage(getErrorMessage(err));
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<section className="mx-auto w-full max-w-3xl space-y-6">
			<div className="space-y-2">
				<h1 className="text-xl font-semibold">Account</h1>
				<p className="text-sm text-muted-foreground">
					Session and optional multi-profile storage (same device).{" "}
					<Link className="underline" to="/">
						Home
					</Link>
				</p>
			</div>

			<div className="flex flex-wrap gap-2">
				<button
					className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium hover:bg-accent disabled:opacity-50"
					disabled={isLoading}
					onClick={() => void handleLoadMe()}
					type="button"
				>
					Refresh session
				</button>
				<button
					className="inline-flex h-10 items-center rounded-md border border-destructive/40 px-4 text-sm font-medium text-destructive hover:bg-destructive/10"
					onClick={() => logout()}
					type="button"
				>
					Sign out
				</button>
			</div>

			{errorMessage ? (
				<div
					className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
					role="alert"
				>
					{errorMessage}
				</div>
			) : null}

			{saveMessage ? (
				<output
					aria-live="polite"
					className="block rounded-md border border-border bg-muted/60 p-3 text-sm text-foreground"
				>
					{saveMessage}
				</output>
			) : null}

			<div className="rounded-lg border border-border bg-card p-4">
				<div className="flex items-center justify-between gap-3">
					<div>
						<div className="text-sm font-medium">Saved profiles</div>
						<div className="mt-1 text-xs text-muted-foreground">
							Switch to test multiple accounts on this browser.
						</div>
					</div>
					<button
						className="inline-flex h-9 items-center rounded-md border border-border px-3 text-xs font-medium hover:bg-accent disabled:opacity-50"
						disabled={isLoading}
						onClick={() => void handleSaveCurrentTokensAsProfile()}
						type="button"
					>
						Save current session
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
												<div className="truncate text-sm font-medium">
													{p.label}
												</div>
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
						No saved profiles yet.
					</div>
				)}
			</div>

			{user ? (
				<>
					<form
						className="space-y-6 rounded-lg border border-border bg-card p-4"
						onSubmit={(e) => void handleProfileSubmit(e)}
					>
						<div>
							<h2 className="text-sm font-semibold">Profile and regional</h2>
							<p className="mt-1 text-xs text-muted-foreground">
								Currency, timezone, and date format affect how amounts and dates
								are shown. Values are validated on the server (IANA timezone,
								ISO 4217 currency).
							</p>
						</div>

						<div className="grid gap-4 md:grid-cols-2">
							<label className="block space-y-1 text-sm">
								<span className="text-muted-foreground">Email</span>
								<input
									autoComplete="email"
									className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
									onChange={(e) => setEmail(e.target.value)}
									required
									type="email"
									value={email}
								/>
							</label>
							<label className="block space-y-1 text-sm">
								<span className="text-muted-foreground">Name</span>
								<input
									autoComplete="name"
									className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
									onChange={(e) => setName(e.target.value)}
									required
									type="text"
									value={name}
								/>
							</label>
							<label className="block space-y-1 text-sm">
								<span className="text-muted-foreground">Country</span>
								<input
									autoComplete="country-name"
									className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
									onChange={(e) => setCountry(e.target.value)}
									required
									type="text"
									value={country}
								/>
							</label>
							<label className="block space-y-1 text-sm">
								<span className="text-muted-foreground">Language</span>
								<input
									autoComplete="language"
									className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
									onChange={(e) => setLanguage(e.target.value)}
									required
									type="text"
									value={language}
								/>
							</label>
							<label className="block space-y-1 text-sm">
								<span className="text-muted-foreground">Timezone (IANA)</span>
								<input
									aria-describedby="timezone-hint"
									autoComplete="timezone"
									className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
									onChange={(e) => setTimezone(e.target.value)}
									placeholder="e.g. Europe/London"
									required
									type="text"
									value={timezone}
								/>
								<span
									className="text-xs text-muted-foreground"
									id="timezone-hint"
								>
									Use a valid IANA time zone name.
								</span>
							</label>
							<label className="block space-y-1 text-sm">
								<span className="text-muted-foreground">
									Currency (ISO 4217)
								</span>
								<input
									aria-describedby="currency-hint"
									className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm uppercase"
									maxLength={3}
									onBlur={handleCurrencyBlur}
									onChange={(e) => setCurrency(e.target.value)}
									placeholder="USD"
									required
									type="text"
									value={currency}
								/>
								<span
									className="text-xs text-muted-foreground"
									id="currency-hint"
								>
									Three letters, e.g. USD or EUR.
								</span>
							</label>
							<label className="block space-y-1 text-sm md:col-span-2">
								<span className="text-muted-foreground">Date format</span>
								<select
									className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
									onChange={(e) =>
										setDateFormat(
											e.target.value as (typeof DATE_FORMAT_OPTIONS)[number],
										)
									}
									value={dateFormat}
								>
									{DATE_FORMAT_OPTIONS.map((df) => (
										<option key={df} value={df}>
											{df}
										</option>
									))}
								</select>
							</label>
						</div>

						<div className="flex flex-wrap gap-6">
							<label className="flex items-center gap-2 text-sm">
								<input
									checked={emailNotifications}
									onChange={(e) => setEmailNotifications(e.target.checked)}
									type="checkbox"
								/>
								<span>Email notifications</span>
							</label>
							<label className="flex items-center gap-2 text-sm">
								<input
									checked={darkMode}
									onChange={(e) => setDarkMode(e.target.checked)}
									type="checkbox"
								/>
								<span>Dark mode</span>
							</label>
						</div>

						<div className="space-y-3 rounded-md border border-border bg-background p-4">
							<div>
								<h3 className="text-sm font-semibold">Visual theme</h3>
								<p className="mt-1 text-xs text-muted-foreground">
									Choose how Ceits looks on this device. Selection applies
									immediately and is saved for future sessions.
								</p>
							</div>
							<fieldset
								aria-label="Theme selection"
								className="grid gap-3 md:grid-cols-2"
							>
								{(Object.keys(themeRegistry) as ThemeId[]).map((themeId) => {
									const option = themeRegistry[themeId];
									const isSelected = selectedTheme === themeId;
									return (
										<label
											className={[
												"block cursor-pointer rounded-md border p-3 text-sm transition-colors",
												isSelected
													? "border-primary bg-primary/10"
													: "border-border bg-card hover:bg-accent/30",
											].join(" ")}
											key={themeId}
										>
											<input
												aria-label={option.label}
												checked={isSelected}
												className="sr-only"
												name="theme"
												onChange={() => handleThemeChange(themeId)}
												type="radio"
												value={themeId}
											/>
											<div className="font-medium text-foreground">
												{option.label}
											</div>
											<div className="mt-1 text-xs text-muted-foreground">
												{option.description}
											</div>
										</label>
									);
								})}
							</fieldset>
						</div>

						<div className="border-t border-border pt-4">
							<h3 className="text-sm font-semibold">Financial preferences</h3>
							<p className="mt-1 text-xs text-muted-foreground">
								Used for reporting and calendar defaults. Not tax advice.
							</p>
							<div className="mt-4 grid gap-4 md:grid-cols-3">
								<label className="block space-y-1 text-sm">
									<span className="text-muted-foreground">Week starts on</span>
									<select
										className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
										onChange={(e) =>
											setWeekStartsOn(Number.parseInt(e.target.value, 10))
										}
										value={weekStartsOn}
									>
										{WEEK_START_OPTIONS.map((o) => (
											<option key={o.value} value={o.value}>
												{o.label}
											</option>
										))}
									</select>
								</label>
								<label className="block space-y-1 text-sm">
									<span className="text-muted-foreground">
										Fiscal year starts (month)
									</span>
									<select
										className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
										onChange={(e) =>
											setFiscalYearStartMonth(
												Number.parseInt(e.target.value, 10),
											)
										}
										value={fiscalYearStartMonth}
									>
										{MONTH_OPTIONS.map((m) => (
											<option key={m.value} value={m.value}>
												{m.label}
											</option>
										))}
									</select>
								</label>
								<label className="block space-y-1 text-sm">
									<span className="text-muted-foreground">
										Reporting currency (optional)
									</span>
									<input
										className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm uppercase"
										maxLength={3}
										onChange={(e) => setReportingCurrency(e.target.value)}
										placeholder="Leave empty to use account currency"
										type="text"
										value={reportingCurrency}
									/>
								</label>
							</div>
						</div>

						<div className="border-t border-border pt-4">
							<h3 className="text-sm font-semibold">
								Tax-related hints (optional)
							</h3>
							<p
								className="mt-1 text-xs text-muted-foreground"
								id="tax-consent-desc"
							>
								Optional. Ceits does not provide tax or legal advice. If you opt
								in, we store minimal hints to tailor in-app views.
							</p>
							<label className="mt-3 flex items-start gap-2 text-sm">
								<input
									aria-describedby="tax-consent-desc"
									checked={taxPreferencesConsent}
									onChange={(e) => setTaxPreferencesConsent(e.target.checked)}
									type="checkbox"
								/>
								<span>I consent to storing tax-oriented preference hints</span>
							</label>
							<div
								className={[
									"mt-4 grid gap-4 md:grid-cols-2",
									taxPreferencesConsent ? "" : "opacity-50 pointer-events-none",
								].join(" ")}
							>
								<label className="block space-y-1 text-sm">
									<span className="text-muted-foreground">
										Primary tax country (ISO 3166-1 alpha-2)
									</span>
									<input
										className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm uppercase"
										maxLength={2}
										onBlur={handleTaxCountryBlur}
										onChange={(e) => setTaxPrimaryCountry(e.target.value)}
										placeholder="e.g. US"
										type="text"
										value={taxPrimaryCountry}
									/>
								</label>
								<label className="block space-y-1 text-sm">
									<span className="text-muted-foreground">Filing intent</span>
									<select
										className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
										onChange={(e) =>
											setTaxFilingIntent(
												e.target
													.value as (typeof FILING_INTENTS)[number]["value"],
											)
										}
										value={taxFilingIntent}
									>
										{FILING_INTENTS.map((f) => (
											<option key={f.value} value={f.value}>
												{f.label}
											</option>
										))}
									</select>
								</label>
							</div>
						</div>

						<div className="flex flex-wrap gap-2 border-t border-border pt-4">
							<button
								className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
								disabled={isLoading}
								type="submit"
							>
								Save profile
							</button>
						</div>
					</form>

					<div className="mt-6 space-y-4 rounded-lg border border-border bg-card p-4">
						<div>
							<h2 className="text-sm font-semibold">Notification channels</h2>
							<p
								className="mt-1 text-xs text-muted-foreground"
								id="notif-channels-desc"
							>
								Choose where you want to receive notifications. Preferences are
								stored on the server; routing every alert through Telegram,
								email, and push is still being completed in later milestones.
							</p>
						</div>
						{notifError ? (
							<div
								className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
								role="alert"
							>
								{notifError}
							</div>
						) : null}
						{notifLoading && !notifChannels ? (
							<p className="text-sm text-muted-foreground">
								Loading preferences…
							</p>
						) : null}
						{notifChannels ? (
							<ul className="space-y-3">
								{NOTIFICATION_CHANNEL_KEYS.map((key) => (
									<li key={key}>
										<label className="flex cursor-pointer items-start gap-3 text-sm">
											<input
												aria-describedby="notif-channels-desc"
												checked={notifChannels[key]}
												className="mt-1 h-4 w-4 shrink-0 rounded border border-border"
												disabled={notifLoading || notifSaving}
												onChange={(e) =>
													void handleNotificationChannelToggle(
														key,
														e.target.checked,
													)
												}
												type="checkbox"
											/>
											<span>
												<span className="font-medium text-foreground">
													{NOTIFICATION_CHANNEL_LABELS[key]}
												</span>
												<span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">
													{key}
												</span>
											</span>
										</label>
									</li>
								))}
							</ul>
						) : null}
					</div>

					<div className="mt-6 space-y-6 rounded-lg border border-border bg-card p-4">
						<div>
							<h2 className="text-sm font-semibold">People &amp; access</h2>
							<p className="mt-1 text-xs text-muted-foreground">
								Everyone in your Ceits workspaces: members, email verification
								status, and pending invites. Tenant admins can invite, cancel
								pending invites, and remove members (not the workspace owner).
								Space-specific invites still originate from each space in Chat.
							</p>
						</div>
						{invitesError ? (
							<p className="text-xs text-destructive">{invitesError}</p>
						) : null}
						{membersError ? (
							<p className="text-xs text-destructive">{membersError}</p>
						) : null}

						<div className="space-y-3">
							<h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
								Personal workspace
							</h3>
							{tenantMembersPersonal == null ? (
								<p className="text-sm text-muted-foreground">
									Loading members…
								</p>
							) : (
								<ul className="max-h-52 space-y-2 overflow-y-auto text-sm">
									{tenantMembersPersonal.map((m) => (
										<li
											className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/80 bg-muted/20 px-3 py-2"
											key={m.user_id}
										>
											<div>
												<span className="font-medium text-foreground">
													{m.name?.trim() || `User #${m.user_id}`}
													{user?.id === m.user_id ? (
														<span className="ml-1 text-muted-foreground">
															(you)
														</span>
													) : null}
												</span>
												<span className="ml-2 text-xs text-muted-foreground">
													{m.role}
												</span>
												{m.email ? (
													<span className="ml-2 font-mono text-[11px] text-muted-foreground">
														{m.email}
													</span>
												) : null}
											</div>
											<div className="flex flex-wrap items-center gap-2">
												{m.identity_verified ? (
													<span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-800 dark:text-emerald-300">
														Email verified
													</span>
												) : (
													<span className="rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-900 dark:text-amber-200">
														Not verified
													</span>
												)}
												{personalTenantAdmin &&
												m.role !== "owner" &&
												m.user_id !== user?.id ? (
													<button
														className="rounded border border-destructive/40 px-2 py-1 text-[11px] text-destructive hover:bg-destructive/10"
														onClick={() =>
															void handleRemovePersonalMember(m.user_id)
														}
														type="button"
													>
														Remove
													</button>
												) : null}
											</div>
										</li>
									))}
								</ul>
							)}
							{personalTenantAdmin ? (
								<form
									className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-end"
									onSubmit={(e) => void handleInvitePersonal(e)}
								>
									<label className="block min-w-0 flex-1 text-xs">
										<span className="text-muted-foreground">
											Invite by email
										</span>
										<input
											autoComplete="email"
											className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
											onChange={(e) => setInviteEmailPersonal(e.target.value)}
											placeholder="name@example.com"
											type="email"
											value={inviteEmailPersonal}
										/>
									</label>
									<label className="block text-xs sm:w-36">
										<span className="text-muted-foreground">Role</span>
										<select
											className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
											onChange={(e) => setInviteRolePersonal(e.target.value)}
											value={inviteRolePersonal}
										>
											{TENANT_INVITE_ROLES.map((r) => (
												<option key={r.value} value={r.value}>
													{r.label}
												</option>
											))}
										</select>
									</label>
									<button
										className="inline-flex h-10 shrink-0 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
										disabled={inviteBusyPersonal || !inviteEmailPersonal.trim()}
										type="submit"
									>
										{inviteBusyPersonal ? "Sending…" : "Invite"}
									</button>
								</form>
							) : null}
							{personalTenantAdmin === true &&
							tenantInvitesPersonal === null ? (
								<p className="text-sm text-muted-foreground">
									Loading invites…
								</p>
							) : tenantInvitesPersonal != null &&
								tenantInvitesPersonal.length > 0 ? (
								<div>
									<p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
										Invites (audit)
									</p>
									<ul className="mt-2 max-h-40 space-y-2 overflow-y-auto text-sm">
										{tenantInvitesPersonal.map((row) => (
											<li
												className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/80 bg-muted/20 px-2 py-1.5 font-mono text-[11px]"
												key={row.id}
											>
												<div>
													<span className="text-foreground">
														{row.invitee_email}
													</span>
													<span className="ml-2 text-muted-foreground">
														{row.accepted_at
															? "accepted"
															: `expires ${row.expires_at.slice(0, 10)}`}
													</span>
													{row.space_id != null ? (
														<span className="ml-2 text-muted-foreground">
															space #{row.space_id}
														</span>
													) : (
														<span className="ml-2 text-muted-foreground">
															tenant-only
														</span>
													)}
												</div>
												{personalTenantAdmin && !row.accepted_at ? (
													<button
														className="rounded border border-border px-2 py-0.5 text-[10px] hover:bg-muted"
														onClick={() =>
															void handleCancelPersonalInvite(row.id)
														}
														type="button"
													>
														Cancel
													</button>
												) : null}
											</li>
										))}
									</ul>
								</div>
							) : personalTenantAdmin ? (
								<p className="text-xs text-muted-foreground">
									No invite rows yet.
								</p>
							) : null}
						</div>

						<div className="space-y-3 border-t border-border pt-4">
							<h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
								Active organization (session)
							</h3>
							{readActiveOrgTenantId() == null ? (
								<p className="text-sm text-muted-foreground">
									No organization selected in this browser session — open the
									business dashboard and pick an org to manage people here.
								</p>
							) : tenantMembersOrg == null ? (
								<p className="text-sm text-muted-foreground">
									Loading members…
								</p>
							) : (
								<ul className="max-h-52 space-y-2 overflow-y-auto text-sm">
									{tenantMembersOrg.map((m) => (
										<li
											className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/80 bg-muted/20 px-3 py-2"
											key={m.user_id}
										>
											<div>
												<span className="font-medium text-foreground">
													{m.name?.trim() || `User #${m.user_id}`}
													{user?.id === m.user_id ? (
														<span className="ml-1 text-muted-foreground">
															(you)
														</span>
													) : null}
												</span>
												<span className="ml-2 text-xs text-muted-foreground">
													{m.role}
												</span>
												{m.email ? (
													<span className="ml-2 font-mono text-[11px] text-muted-foreground">
														{m.email}
													</span>
												) : null}
											</div>
											<div className="flex flex-wrap items-center gap-2">
												{m.identity_verified ? (
													<span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-800 dark:text-emerald-300">
														Email verified
													</span>
												) : (
													<span className="rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-900 dark:text-amber-200">
														Not verified
													</span>
												)}
												{orgTenantAdmin &&
												m.role !== "owner" &&
												m.user_id !== user?.id ? (
													<button
														className="rounded border border-destructive/40 px-2 py-1 text-[11px] text-destructive hover:bg-destructive/10"
														onClick={() =>
															void handleRemoveOrgMember(m.user_id)
														}
														type="button"
													>
														Remove
													</button>
												) : null}
											</div>
										</li>
									))}
								</ul>
							)}
							{readActiveOrgTenantId() != null && orgTenantAdmin ? (
								<form
									className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-end"
									onSubmit={(e) => void handleInviteOrg(e)}
								>
									<label className="block min-w-0 flex-1 text-xs">
										<span className="text-muted-foreground">
											Invite by email
										</span>
										<input
											autoComplete="email"
											className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
											onChange={(e) => setInviteEmailOrg(e.target.value)}
											placeholder="name@example.com"
											type="email"
											value={inviteEmailOrg}
										/>
									</label>
									<label className="block text-xs sm:w-36">
										<span className="text-muted-foreground">Role</span>
										<select
											className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
											onChange={(e) => setInviteRoleOrg(e.target.value)}
											value={inviteRoleOrg}
										>
											{TENANT_INVITE_ROLES.map((r) => (
												<option key={r.value} value={r.value}>
													{r.label}
												</option>
											))}
										</select>
									</label>
									<button
										className="inline-flex h-10 shrink-0 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
										disabled={inviteBusyOrg || !inviteEmailOrg.trim()}
										type="submit"
									>
										{inviteBusyOrg ? "Sending…" : "Invite"}
									</button>
								</form>
							) : null}
							{readActiveOrgTenantId() != null &&
							orgTenantAdmin === true &&
							tenantInvitesOrg === null ? (
								<p className="text-sm text-muted-foreground">
									Loading invites…
								</p>
							) : tenantInvitesOrg != null && tenantInvitesOrg.length > 0 ? (
								<div>
									<p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
										Invites (audit)
									</p>
									<ul className="mt-2 max-h-40 space-y-2 overflow-y-auto text-sm">
										{tenantInvitesOrg.map((row) => (
											<li
												className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/80 bg-muted/20 px-2 py-1.5 font-mono text-[11px]"
												key={row.id}
											>
												<div>
													<span className="text-foreground">
														{row.invitee_email}
													</span>
													<span className="ml-2 text-muted-foreground">
														{row.accepted_at
															? "accepted"
															: `expires ${row.expires_at.slice(0, 10)}`}
													</span>
													{row.space_id != null ? (
														<span className="ml-2 text-muted-foreground">
															space #{row.space_id}
														</span>
													) : (
														<span className="ml-2 text-muted-foreground">
															tenant-only
														</span>
													)}
												</div>
												{orgTenantAdmin && !row.accepted_at ? (
													<button
														className="rounded border border-border px-2 py-0.5 text-[10px] hover:bg-muted"
														onClick={() => void handleCancelOrgInvite(row.id)}
														type="button"
													>
														Cancel
													</button>
												) : null}
											</li>
										))}
									</ul>
								</div>
							) : readActiveOrgTenantId() != null && orgTenantAdmin ? (
								<p className="text-xs text-muted-foreground">
									No invite rows yet.
								</p>
							) : null}
						</div>
					</div>
				</>
			) : (
				<div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
					Sign in to edit profile and regional settings.
				</div>
			)}

			<div className="grid gap-3 md:grid-cols-2">
				<div className="rounded-lg border border-border bg-card p-4">
					<div className="text-xs font-medium text-muted-foreground">
						Access token (preview)
					</div>
					<div className="mt-1 break-all font-mono text-xs">
						{tokenPreview ?? "—"}
					</div>
				</div>
				<div className="rounded-lg border border-border bg-card p-4">
					<div className="text-xs font-medium text-muted-foreground">User</div>
					<pre className="mt-2 max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs">
						{user ? JSON.stringify(user, null, 2) : "null"}
					</pre>
				</div>
			</div>
		</section>
	);
};
