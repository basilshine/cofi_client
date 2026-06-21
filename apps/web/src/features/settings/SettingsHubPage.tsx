import {
	NOTIFICATION_CHANNEL_KEYS,
	type NotificationChannelKey,
	type NotificationChannelsMap,
	type ProfileUpdateRequest,
	type UserPreferencesPayload,
	notificationChannelsMapFromResponse,
} from "@cofi/api";
import axios from "axios";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { apiClient } from "../../shared/lib/apiClient";
import { authApi } from "../../shared/lib/authApi";
import { authSessionStore } from "../../shared/lib/authSessionStore";
import { type AuthProfile, tokenStorage } from "../../shared/lib/tokenStorage";
import {
	type ThemeId,
	getThemeFromUserPreferences,
	themeRegistry,
	useTheme,
} from "../../shared/theme/theme";
import { SubscriptionTestPlanPanel } from "./SubscriptionTestPlanPanel";

const NOTIFICATION_CHANNEL_LABELS: Record<NotificationChannelKey, string> = {
	in_app: "In-app",
	telegram: "Telegram",
	email: "Email",
	push: "Push",
};

const DATE_FORMAT_OPTIONS = ["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"] as const;
const TIMEZONE_OPTIONS = [
	"UTC",
	"Europe/Paris",
	"Europe/Berlin",
	"Europe/London",
	"Europe/Warsaw",
	"Europe/Rome",
	"Europe/Madrid",
	"Europe/Kyiv",
	"Europe/Moscow",
	"Asia/Yerevan",
	"Asia/Baku",
	"Asia/Almaty",
	"Asia/Tbilisi",
	"America/New_York",
	"America/Chicago",
	"America/Los_Angeles",
	"America/Denver",
	"America/Toronto",
	"America/Sao_Paulo",
	"Asia/Dubai",
	"Asia/Bangkok",
	"Asia/Singapore",
	"Asia/Tokyo",
];
const COUNTRY_OPTIONS = [
	{ value: "RU", label: "Russia (RU)" },
	{ value: "US", label: "United States (US)" },
	{ value: "DE", label: "Germany (DE)" },
	{ value: "FR", label: "France (FR)" },
	{ value: "GB", label: "United Kingdom (GB)" },
	{ value: "IT", label: "Italy (IT)" },
	{ value: "ES", label: "Spain (ES)" },
	{ value: "PL", label: "Poland (PL)" },
	{ value: "TR", label: "Turkey (TR)" },
	{ value: "AE", label: "United Arab Emirates (AE)" },
	{ value: "TH", label: "Thailand (TH)" },
	{ value: "JP", label: "Japan (JP)" },
] as const;
const LANGUAGE_OPTIONS = [
	{ value: "ru", label: "Russian (ru)" },
	{ value: "en", label: "English (en)" },
	{ value: "de", label: "German (de)" },
	{ value: "fr", label: "French (fr)" },
	{ value: "es", label: "Spanish (es)" },
	{ value: "it", label: "Italian (it)" },
	{ value: "pl", label: "Polish (pl)" },
	{ value: "tr", label: "Turkish (tr)" },
	{ value: "th", label: "Thai (th)" },
	{ value: "ja", label: "Japanese (ja)" },
] as const;
const CURRENCY_OPTIONS = [
	{ value: "EUR", label: "Euro (EUR)" },
	{ value: "USD", label: "US Dollar (USD)" },
	{ value: "RUB", label: "Russian Ruble (RUB)" },
] as const;

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

const settingsSections = [
	{ key: "account", label: "Account" },
	{ key: "appearance", label: "Appearance" },
	{ key: "notifications", label: "Notifications" },
	{ key: "security", label: "Security" },
	{ key: "billing", label: "Billing" },
] as const;
export type SettingsSectionKey = (typeof settingsSections)[number]["key"];

const sectionCard =
	"rounded-2xl border border-border/70 bg-card text-card-foreground soft-shadow inner-glow";
const sectionHeading =
	"flex items-center justify-between gap-3 border-b border-border/50 px-6 py-4";
const sectionTitle =
	"font-display text-lg font-bold tracking-tight text-foreground sm:text-xl";
const sectionEyebrow = "eyebrow";
const buttonBase =
	"inline-flex h-10 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50";
const inputBase =
	"w-full rounded-md border border-border bg-background px-3 py-2 text-sm";

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

export const SettingsHubPage = ({
	section = "account",
}: {
	section?: SettingsSectionKey;
}) => {
	const { user, refreshUser, logout } = useAuth();
	const { theme, setTheme } = useTheme();

	const [profilesVersion, setProfilesVersion] = useState(0);
	const [isLoading, setIsLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [saveMessage, setSaveMessage] = useState<string | null>(null);
	const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

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

	useEffect(() => {
		if (!user) return;
		setEmail(user.email ?? "");
		setName(user.name ?? "");
		setCountry(user.country?.trim().toUpperCase() || "RU");
		setLanguage(user.language?.trim().toLowerCase() || "ru");
		setTimezone(user.timezone?.trim() || "UTC");
		setCurrency(user.currency?.trim().toUpperCase() || "EUR");
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

	const tokenPreview = useMemo(() => {
		void profilesVersion;
		const token = authSessionStore.getRequestAccessToken();
		if (!token) return null;
		if (token.length <= 18) return token;
		return `${token.slice(0, 10)}...${token.slice(-6)}`;
	}, [profilesVersion]);

	const profiles = useMemo(() => {
		void profilesVersion;
		return tokenStorage.listProfiles();
	}, [profilesVersion]);

	const activeProfileId = useMemo(() => {
		void profilesVersion;
		return tokenStorage.getActiveProfileId();
	}, [profilesVersion]);

	const formatProfileSubtitle = (profile: AuthProfile) => {
		const parts: string[] = [];
		if (profile.userId) parts.push(`id:${profile.userId}`);
		if (profile.email) parts.push(profile.email);
		return parts.join(" · ");
	};

	const touchSaved = (message: string) => {
		setSaveMessage(message);
		setLastSavedAt(new Date().toISOString());
	};

	const handleLoadMe = async () => {
		setIsLoading(true);
		setErrorMessage(null);
		try {
			await refreshUser();
			touchSaved("Session refreshed.");
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
			touchSaved("Switched profile.");
		} finally {
			setIsLoading(false);
		}
	};

	const handleRemoveProfile = (profileId: string) => {
		tokenStorage.removeProfile(profileId);
		setProfilesVersion((v) => v + 1);
		touchSaved("Profile removed.");
	};

	const handleSaveCurrentTokensAsProfile = async () => {
		setIsLoading(true);
		setErrorMessage(null);
		try {
			const me = await authApi.me();
			tokenStorage.upsertProfile({
				label: me.email ?? `user_${me.id}`,
				email: me.email,
				userId: me.id,
			});
			setProfilesVersion((v) => v + 1);
			await refreshUser();
			touchSaved("Current session saved as profile.");
		} catch (err) {
			setErrorMessage(
				err instanceof Error ? err.message : "Failed to save profile",
			);
		} finally {
			setIsLoading(false);
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
			touchSaved("Notification preferences saved.");
		} catch (err) {
			setNotifChannels(prev);
			setNotifError(getErrorMessage(err));
		} finally {
			setNotifSaving(false);
		}
	};

	const handleThemeChange = (nextTheme: ThemeId) => {
		setSelectedTheme(nextTheme);
		setTheme(nextTheme);
		touchSaved("Theme updated.");
	};

	const handleTaxCountryBlur = () => {
		const t = taxPrimaryCountry.trim().toUpperCase().slice(0, 2);
		setTaxPrimaryCountry(t);
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
			touchSaved("Profile settings saved.");
		} catch (err) {
			setErrorMessage(getErrorMessage(err));
		} finally {
			setIsLoading(false);
		}
	};

	const activeSectionLabel =
		settingsSections.find((s) => s.key === section)?.label ?? "Settings";
	const timezoneOptionsForSelect = useMemo(() => {
		const trimmedTimezone = timezone.trim();
		if (!trimmedTimezone || TIMEZONE_OPTIONS.includes(trimmedTimezone)) {
			return [...TIMEZONE_OPTIONS];
		}
		return [trimmedTimezone, ...TIMEZONE_OPTIONS];
	}, [timezone]);
	const currencyOptionsForSelect = useMemo(() => {
		const normalizedCurrency = currency.trim().toUpperCase();
		if (
			!normalizedCurrency ||
			CURRENCY_OPTIONS.some((option) => option.value === normalizedCurrency)
		) {
			return [...CURRENCY_OPTIONS];
		}
		return [
			{
				value: normalizedCurrency,
				label: `${normalizedCurrency} (current)`,
			},
			...CURRENCY_OPTIONS,
		];
	}, [currency]);
	const countryOptionsForSelect = useMemo(() => {
		const normalizedCountry = country.trim().toUpperCase();
		if (
			!normalizedCountry ||
			COUNTRY_OPTIONS.some((option) => option.value === normalizedCountry)
		) {
			return [...COUNTRY_OPTIONS];
		}
		return [
			{
				value: normalizedCountry,
				label: `${normalizedCountry} (current)`,
			},
			...COUNTRY_OPTIONS,
		];
	}, [country]);
	const languageOptionsForSelect = useMemo(() => {
		const normalizedLanguage = language.trim().toLowerCase();
		if (
			!normalizedLanguage ||
			LANGUAGE_OPTIONS.some((option) => option.value === normalizedLanguage)
		) {
			return [...LANGUAGE_OPTIONS];
		}
		return [
			{
				value: normalizedLanguage,
				label: `${normalizedLanguage} (current)`,
			},
			...LANGUAGE_OPTIONS,
		];
	}, [language]);
	const enabledNotificationLabels = useMemo(() => {
		if (!notifChannels) return "Loading...";
		const enabled = NOTIFICATION_CHANNEL_KEYS.filter(
			(key) => notifChannels[key],
		).map((key) => NOTIFICATION_CHANNEL_LABELS[key]);
		return enabled.length ? enabled.join(", ") : "None enabled";
	}, [notifChannels]);
	const activeThemeLabel = themeRegistry[selectedTheme]?.label ?? selectedTheme;

	return (
		<div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
			<div className="flex min-h-0 w-full min-w-0 flex-1 overflow-hidden">
				<div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
					<div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 lg:px-8 lg:py-8">
						<header className="space-y-2">
							<p className={sectionEyebrow}>Settings</p>
							<h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-[34px]">
								{activeSectionLabel}
							</h1>
							<p className="text-sm text-muted-foreground">
								Manage {activeSectionLabel.toLowerCase()} preferences in your
								console.
							</p>
						</header>

						{errorMessage ? (
							<div
								className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
								role="alert"
							>
								{errorMessage}
							</div>
						) : null}

						{saveMessage ? (
							<output
								aria-live="polite"
								className="block rounded-xl border border-border bg-muted/60 p-3 text-sm text-foreground"
							>
								{saveMessage}
							</output>
						) : null}

						<div className="space-y-6">
							{section === "account" ? (
								<section className={sectionCard} id="account">
									<div className={sectionHeading}>
										<div>
											<p className={sectionEyebrow}>Account</p>
											<h2 className={sectionTitle}>Profile and regional</h2>
										</div>
									</div>
									<form
										className="space-y-5 p-6"
										onSubmit={(e) => void handleProfileSubmit(e)}
									>
										<div className="grid gap-4 md:grid-cols-2">
											<label className="space-y-1 text-sm">
												<span className="text-muted-foreground">Email</span>
												<input
													className={inputBase}
													onChange={(e) => setEmail(e.target.value)}
													required
													type="email"
													value={email}
												/>
											</label>
											<label className="space-y-1 text-sm">
												<span className="text-muted-foreground">Name</span>
												<input
													className={inputBase}
													onChange={(e) => setName(e.target.value)}
													required
													type="text"
													value={name}
												/>
											</label>
											<label className="space-y-1 text-sm">
												<span className="text-muted-foreground">Country</span>
												<select
													className={inputBase}
													onChange={(e) => setCountry(e.target.value)}
													required
													value={country}
												>
													{countryOptionsForSelect.map((option) => (
														<option key={option.value} value={option.value}>
															{option.label}
														</option>
													))}
												</select>
											</label>
											<label className="space-y-1 text-sm">
												<span className="text-muted-foreground">Language</span>
												<select
													className={inputBase}
													onChange={(e) => setLanguage(e.target.value)}
													required
													value={language}
												>
													{languageOptionsForSelect.map((option) => (
														<option key={option.value} value={option.value}>
															{option.label}
														</option>
													))}
												</select>
											</label>
											<label className="space-y-1 text-sm">
												<span className="text-muted-foreground">
													Timezone (IANA)
												</span>
												<select
													className={inputBase}
													onChange={(e) => setTimezone(e.target.value)}
													required
													value={timezone}
												>
													{timezoneOptionsForSelect.map((tz) => (
														<option key={tz} value={tz}>
															{tz}
														</option>
													))}
												</select>
											</label>
											<label className="space-y-1 text-sm">
												<span className="text-muted-foreground">
													Currency (ISO 4217)
												</span>
												<select
													className={`${inputBase} uppercase`}
													onChange={(e) => setCurrency(e.target.value)}
													required
													value={currency}
												>
													{currencyOptionsForSelect.map((option) => (
														<option key={option.value} value={option.value}>
															{option.label}
														</option>
													))}
												</select>
											</label>
											<label className="space-y-1 text-sm md:col-span-2">
												<span className="text-muted-foreground">
													Date format
												</span>
												<select
													className={inputBase}
													onChange={(e) =>
														setDateFormat(
															e.target
																.value as (typeof DATE_FORMAT_OPTIONS)[number],
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
										<div className="grid gap-4 md:grid-cols-3">
											<label className="space-y-1 text-sm">
												<span className="text-muted-foreground">
													Week starts on
												</span>
												<select
													className={inputBase}
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
											<label className="space-y-1 text-sm">
												<span className="text-muted-foreground">
													Fiscal start month
												</span>
												<select
													className={inputBase}
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
											<label className="space-y-1 text-sm">
												<span className="text-muted-foreground">
													Reporting currency
												</span>
												<input
													className={`${inputBase} uppercase`}
													maxLength={3}
													onChange={(e) => setReportingCurrency(e.target.value)}
													type="text"
													value={reportingCurrency}
												/>
											</label>
										</div>
										<div className="grid gap-3">
											<label className="flex items-center gap-2 text-sm">
												<input
													checked={emailNotifications}
													onChange={(e) =>
														setEmailNotifications(e.target.checked)
													}
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
												<span>Dark mode flag</span>
											</label>
											<label className="flex items-center gap-2 text-sm">
												<input
													checked={taxPreferencesConsent}
													onChange={(e) =>
														setTaxPreferencesConsent(e.target.checked)
													}
													type="checkbox"
												/>
												<span>Store tax preference hints</span>
											</label>
											<div className="grid gap-3 md:grid-cols-2">
												<label className="space-y-1 text-sm">
													<span className="text-muted-foreground">
														Primary tax country
													</span>
													<input
														className={`${inputBase} uppercase`}
														maxLength={2}
														onBlur={handleTaxCountryBlur}
														onChange={(e) =>
															setTaxPrimaryCountry(e.target.value)
														}
														type="text"
														value={taxPrimaryCountry}
													/>
												</label>
												<label className="space-y-1 text-sm">
													<span className="text-muted-foreground">
														Filing intent
													</span>
													<select
														className={inputBase}
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
										<div className="flex justify-end border-t border-border/50 pt-4">
											<button
												className={`${buttonBase} bg-primary text-primary-foreground`}
												disabled={isLoading}
												type="submit"
											>
												Save profile
											</button>
										</div>
									</form>
								</section>
							) : null}

							{section === "appearance" ? (
								<section className={sectionCard} id="appearance">
									<div className={sectionHeading}>
										<div>
											<p className={sectionEyebrow}>Appearance</p>
											<h2 className={sectionTitle}>
												Theme and visual preferences
											</h2>
										</div>
									</div>
									<div className="grid gap-3 p-6 md:grid-cols-2">
										{(Object.keys(themeRegistry) as ThemeId[]).map(
											(themeId) => {
												const option = themeRegistry[themeId];
												const isSelected = selectedTheme === themeId;
												return (
													<label
														className={[
															"block cursor-pointer rounded-xl border p-4 text-sm transition-colors",
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
											},
										)}
									</div>
								</section>
							) : null}

							{section === "notifications" ? (
								<section className={sectionCard} id="notifications">
									<div className={sectionHeading}>
										<div>
											<p className={sectionEyebrow}>Notifications</p>
											<h2 className={sectionTitle}>Channel preferences</h2>
										</div>
									</div>
									<div className="space-y-3 p-6">
										{notifError ? (
											<div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
												{notifError}
											</div>
										) : null}
										{notifLoading && !notifChannels ? (
											<p className="text-sm text-muted-foreground">
												Loading preferences...
											</p>
										) : null}
										{notifChannels ? (
											<ul className="space-y-3">
												{NOTIFICATION_CHANNEL_KEYS.map((key) => (
													<li key={key}>
														<label className="flex cursor-pointer items-start gap-3 text-sm">
															<input
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
								</section>
							) : null}

							{section === "security" ? (
								<section className={sectionCard} id="security">
									<div className={sectionHeading}>
										<div>
											<p className={sectionEyebrow}>Security</p>
											<h2 className={sectionTitle}>Sessions and access</h2>
										</div>
									</div>
									<div className="space-y-4 p-6">
										<div className="flex flex-wrap gap-2">
											<button
												className={buttonBase}
												disabled={isLoading}
												onClick={() => void handleLoadMe()}
												type="button"
											>
												Refresh session
											</button>
											<button
												className={`${buttonBase} border-destructive/40 text-destructive hover:bg-destructive/10`}
												onClick={() => logout()}
												type="button"
											>
												Sign out
											</button>
										</div>
										<div className="rounded-lg border border-border bg-card p-4">
											<div className="flex items-center justify-between gap-3">
												<div>
													<div className="text-sm font-medium">
														Saved profiles
													</div>
													<div className="mt-1 text-xs text-muted-foreground">
														Switch between test accounts on this device.
													</div>
												</div>
												<button
													className={buttonBase}
													disabled={isLoading}
													onClick={() =>
														void handleSaveCurrentTokensAsProfile()
													}
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
																			className={`${buttonBase} bg-primary text-primary-foreground`}
																			disabled={isLoading || isActive}
																			onClick={() =>
																				void handleSwitchProfile(p.id)
																			}
																			type="button"
																		>
																			Switch
																		</button>
																		<button
																			className={buttonBase}
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
									</div>
								</section>
							) : null}

							{section === "billing" ? (
								<section className={sectionCard} id="billing">
									<div className={sectionHeading}>
										<div>
											<p className={sectionEyebrow}>Billing</p>
											<h2 className={sectionTitle}>Plan and capabilities</h2>
										</div>
									</div>
									<SubscriptionTestPlanPanel />
								</section>
							) : null}
						</div>
					</div>
				</div>

				<aside className="hidden shrink-0 self-stretch flex-col border-l border-border/60 bg-muted/30 xl:flex xl:w-[18rem]">
					<div className="min-h-0 flex-1 overflow-y-auto px-5 py-8">
						<div className="space-y-4">
							<div className={`${sectionCard} p-4`}>
								<p className={sectionEyebrow}>Settings overview</p>
								<div className="mt-3 space-y-3 text-xs">
									<div>
										<p className="text-muted-foreground">Account</p>
										<p className="truncate text-foreground">
											{name.trim() || "Unnamed"} · {email.trim() || "No email"}
										</p>
									</div>
									<div>
										<p className="text-muted-foreground">Appearance</p>
										<p className="text-foreground">{activeThemeLabel}</p>
									</div>
									<div>
										<p className="text-muted-foreground">Notifications</p>
										<p className="text-foreground">
											{enabledNotificationLabels}
										</p>
									</div>
									<div>
										<p className="text-muted-foreground">Security</p>
										<p className="text-foreground">
											{`Profiles: ${String(profiles.length)}`}
										</p>
									</div>
									<div>
										<p className="text-muted-foreground">Billing</p>
										<p className="text-foreground">Coming soon</p>
									</div>
								</div>
							</div>
							<div className={`${sectionCard} p-4`}>
								<p className={sectionEyebrow}>Status</p>
								<p className="mt-2 text-sm text-foreground">
									{saveMessage ?? "No recent changes in this session."}
								</p>
								<p className="mt-1 text-xs text-muted-foreground">
									{lastSavedAt
										? `Last update: ${new Date(lastSavedAt).toLocaleString()}`
										: "Updates appear here after you save a setting."}
								</p>
							</div>
							<div className={`${sectionCard} p-4`}>
								<p className={sectionEyebrow}>Security snapshot</p>
								<p className="mt-2 text-xs text-muted-foreground">
									Token preview
								</p>
								<p className="mt-1 break-all font-mono text-xs text-foreground">
									{tokenPreview ?? "—"}
								</p>
								<p className="mt-3 text-xs text-muted-foreground">
									Profiles stored: {String(profiles.length)}
								</p>
							</div>
						</div>
					</div>
				</aside>
			</div>
		</div>
	);
};
