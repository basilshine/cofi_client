import {
	type ReactNode,
	createContext,
	useCallback,
	useContext,
	useMemo,
	useState,
} from "react";

export const THEME_STORAGE_KEY = "ceits.web.theme";

export const themeIds = ["legacy-technical", "ceits-editorial"] as const;
export type ThemeId = (typeof themeIds)[number];

export const themeRegistry: Record<
	ThemeId,
	{ label: string; description: string }
> = {
	"legacy-technical": {
		label: "Theme 1 — Legacy technical",
		description:
			"Current Ceits interface with technical density and strong contrast.",
	},
	"ceits-editorial": {
		label: "Theme 2 — Ceits editorial",
		description:
			"Premium editorial styling with softer surfaces and refined hierarchy.",
	},
};

export const DEFAULT_THEME_ID: ThemeId = "legacy-technical";

const isThemeId = (value: unknown): value is ThemeId =>
	typeof value === "string" && (themeIds as readonly string[]).includes(value);

export const getStoredTheme = (): ThemeId | null => {
	if (typeof window === "undefined") return null;
	const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
	return isThemeId(raw) ? raw : null;
};

export const hasStoredTheme = (): boolean => getStoredTheme() !== null;

const applyThemeToDom = (theme: ThemeId) => {
	if (typeof document === "undefined") return;
	document.documentElement.setAttribute("data-theme", theme);
};

export const initTheme = (): ThemeId => {
	const stored = getStoredTheme();
	const theme = stored ?? DEFAULT_THEME_ID;
	applyThemeToDom(theme);
	return theme;
};

export const getThemeFromUserPreferences = (value: unknown): ThemeId | null => {
	if (typeof value !== "object" || value === null || Array.isArray(value))
		return null;
	const appearance = (value as Record<string, unknown>).appearance;
	if (
		typeof appearance !== "object" ||
		appearance === null ||
		Array.isArray(appearance)
	) {
		return null;
	}
	const theme = (appearance as Record<string, unknown>).theme;
	return isThemeId(theme) ? theme : null;
};

type ThemeContextValue = {
	theme: ThemeId;
	setTheme: (theme: ThemeId) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
	const [theme, setThemeState] = useState<ThemeId>(() => initTheme());

	const setTheme = useCallback((nextTheme: ThemeId) => {
		setThemeState(nextTheme);
		applyThemeToDom(nextTheme);
		if (typeof window !== "undefined") {
			window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
		}
	}, []);

	const value = useMemo<ThemeContextValue>(
		() => ({
			theme,
			setTheme,
		}),
		[theme, setTheme],
	);

	return (
		<ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
	);
};

export const useTheme = (): ThemeContextValue => {
	const context = useContext(ThemeContext);
	if (!context) {
		throw new Error("useTheme must be used within ThemeProvider");
	}
	return context;
};
