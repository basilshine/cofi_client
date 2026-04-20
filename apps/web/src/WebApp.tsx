import { useEffect } from "react";
import { AppRouter } from "./app/routes/AppRouter";
import { AuthProvider } from "./contexts/AuthContext";
import { useAuth } from "./contexts/AuthContext";
import {
	ThemeProvider,
	getThemeFromUserPreferences,
	hasStoredTheme,
	useTheme,
} from "./shared/theme/theme";

const ThemePreferenceSync = () => {
	const { user } = useAuth();
	const { setTheme } = useTheme();

	useEffect(() => {
		if (!user || hasStoredTheme()) return;
		const theme = getThemeFromUserPreferences(user.userPreferences);
		if (!theme) return;
		setTheme(theme);
	}, [user, setTheme]);

	return null;
};

export const WebApp = () => {
	return (
		<ThemeProvider>
			<AuthProvider>
				<ThemePreferenceSync />
				<AppRouter />
			</AuthProvider>
		</ThemeProvider>
	);
};
