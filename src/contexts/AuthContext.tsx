import { TelegramLoadingScreen } from "@/components/TelegramLoadingScreen";
import { useTelegram } from "@/hooks/useTelegram";
import { changeLanguage } from "@/i18n/config";
import { type ProfileUpdateRequest, apiService } from "@/services/api";
import type { components } from "@/types/api-types";
import { isTelegramWebApp } from "@/utils/isTelegramWebApp";
import { handleTelegramNavigation } from "@/utils/telegramWebApp";
import { jwtDecode } from "jwt-decode";
import LogRocket from "logrocket";
import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

// Use only types from api-types.ts
export type User = components["schemas"]["User"];
export type AuthResponse = components["schemas"]["AuthResponse"];

// Type for Telegram Login Widget data
interface TelegramWidgetUser {
	id: number;
	username?: string;
	first_name?: string;
	last_name?: string;
	photo_url?: string;
	auth_date: number;
	hash: string;
}

interface AuthState {
	user: User | null;
	token: string | null;
	isAuthenticated: boolean;
	isLoading: boolean;
	error: string | null;
	isWebApp: boolean;
}

interface AuthContextType extends AuthState {
	login: (email: string, password: string) => Promise<void>;
	register: (
		email: string,
		password: string,
		firstName: string,
		lastName?: string,
	) => Promise<void>;
	logout: () => void;
	requestPasswordReset: (email: string) => Promise<void>;
	resetPassword: (token: string, newPassword: string) => Promise<void>;
	handleTelegramAuth: () => void;
	setUser: (user: User | null) => void;
	setToken: (token: string | null) => void;
	handleTelegramWidgetAuth: (tgUser: TelegramWidgetUser) => Promise<void>;
	updateUser: (profileData: ProfileUpdateRequest) => Promise<void>;
	deleteAllData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
	const [state, setState] = useState<AuthState>({
		user: null,
		token: localStorage.getItem("token"),
		isAuthenticated: false,
		isLoading: true,
		error: null,
		isWebApp: false, // Will be updated in useEffect
	});

	const navigate = useNavigate();

	// Helper function to set user language when user data is available
	const setUserLanguage = (user: User | null) => {
		if (user?.language && ["en", "ru"].includes(user.language)) {
			changeLanguage(user.language);
			LogRocket.log("[AuthContext] Set user language:", user.language);
		}
	};
	const { telegramUser, initData } = useTelegram();
	const hasAttemptedTelegramLogin = useRef(false);

	// Monitor WebApp state changes
	useEffect(() => {
		const checkWebAppState = () => {
			const isWebApp = isTelegramWebApp();
			setState((prev) => {
				if (prev.isWebApp !== isWebApp) {
					console.log("[AuthContext] WebApp state changed:", {
						from: prev.isWebApp,
						to: isWebApp,
					});
					LogRocket.log("[AuthContext] WebApp state changed:", {
						from: prev.isWebApp,
						to: isWebApp,
					});
					return { ...prev, isWebApp };
				}
				return prev;
			});
		};

		// Check immediately
		checkWebAppState();

		// Check periodically in case Telegram WebApp object loads later
		const interval = setInterval(checkWebAppState, 500);

		// Cleanup
		return () => clearInterval(interval);
	}, []);

	useEffect(() => {
		const token = localStorage.getItem("token");
		if (token) {
			try {
				const decoded = jwtDecode(token);
				if (decoded.exp && decoded.exp * 1000 < Date.now()) {
					logout();
				} else {
					// If user is not set, fetch from backend
					if (!state.user) {
						setState((prev) => ({ ...prev, isLoading: true }));
						apiService.auth
							.me()
							.then((response) => {
								setState((prev) => ({
									...prev,
									user: response.data,
									isAuthenticated: true,
									isLoading: false,
								}));
							})
							.catch((error) => {
								console.error("Failed to fetch user data:", error);

								// For Telegram WebApp, be more lenient with errors
								// since we might be in the middle of auto-login process
								if (state.isWebApp && !hasAttemptedTelegramLogin.current) {
									// Don't logout yet, let Telegram auto-login try first
									setState((prev) => ({
										...prev,
										isAuthenticated: false,
										isLoading: true, // Keep loading for Telegram auto-login
										error: null,
									}));
									return;
								}

								// Only logout if it's a 401 (unauthorized) error
								if (error?.response?.status === 401) {
									logout();
								} else {
									// For other errors (network, 500, etc.), assume user is still authenticated
									// but we couldn't fetch user data
									setState((prev) => ({
										...prev,
										isAuthenticated: true,
										isLoading: false,
										error:
											"Failed to load user data. You can continue using the app, but some features may not work properly.",
									}));
								}
							});
					} else {
						setState((prev) => ({
							...prev,
							isAuthenticated: true,
							isLoading: false,
						}));
					}
				}
			} catch (error) {
				// Only logout if token is malformed
				console.error("Invalid token:", error);
				logout();
			}
		} else {
			// No token - for WebApp, keep loading to allow Telegram auto-login
			if (state.isWebApp && !hasAttemptedTelegramLogin.current) {
				console.log(
					"[AuthContext] No token but WebApp detected, keeping loading state for auto-login",
				);
				setState((prev) => ({ ...prev, isLoading: true }));
			} else {
				console.log(
					"[AuthContext] No token and not WebApp (or already attempted), setting loading false",
				);
				setState((prev) => ({ ...prev, isLoading: false }));
			}
		}
	}, [state.user, state.isWebApp]);

	useEffect(() => {
		// Log window unload/reload events
		const handleBeforeUnload = (e: BeforeUnloadEvent) => {
			console.log(e);
			console.log("[AuthContext] Window beforeunload event triggered.");
		};
		const handleUnload = (e: Event) => {
			console.log(e);
			console.log("[AuthContext] Window unload event triggered.");
		};
		window.addEventListener("beforeunload", handleBeforeUnload);
		window.addEventListener("unload", handleUnload);
		return () => {
			window.removeEventListener("beforeunload", handleBeforeUnload);
			window.removeEventListener("unload", handleUnload);
		};
	}, []);

	// Ensure loading state is correct on mount
	useEffect(() => {
		if (state.isWebApp && !state.isAuthenticated) {
			LogRocket.log("[AuthContext] Setting isLoading: true for WebApp");
			setState((prev) => ({ ...prev, isLoading: true }));
		}
		if (!state.isWebApp && !state.isAuthenticated) {
			LogRocket.log("[AuthContext] Setting isLoading: false for non-WebApp");
			setState((prev) => ({ ...prev, isLoading: false }));
		}
		// eslint-disable-next-line
	}, [state.isWebApp, state.isAuthenticated]);

	// Improved Telegram WebApp auto-login
	useEffect(() => {
		LogRocket.log("[AuthContext] Telegram auto-login effect triggered", {
			isWebApp: state.isWebApp,
			telegramUser,
			initData,
			isAuthenticated: state.isAuthenticated,
			hasAttemptedTelegramLogin: hasAttemptedTelegramLogin.current,
		});
		console.log("[AuthContext] Telegram auto-login effect triggered", {
			isWebApp: state.isWebApp,
			telegramUser: telegramUser ? "present" : "missing",
			initData: initData ? "present" : "missing",
			isAuthenticated: state.isAuthenticated,
			hasAttemptedTelegramLogin: hasAttemptedTelegramLogin.current,
		});

		let shortWaitTimeout: NodeJS.Timeout | null = null;
		let longWaitTimeout: NodeJS.Timeout | null = null;

		if (state.isWebApp && state.isAuthenticated) {
			// User is already authenticated in WebApp, ensure loading is false
			LogRocket.log(
				"[AuthContext] User already authenticated in WebApp, setting isLoading: false",
			);
			setState((prev) => ({ ...prev, isLoading: false }));

			// Only check for navigation on initial load, not on every effect run
			if (!hasAttemptedTelegramLogin.current) {
				hasAttemptedTelegramLogin.current = true;

				// Check for Telegram navigation parameters first
				console.log(
					"[AuthContext] Already authenticated, checking Telegram navigation (initial load)",
				);

				// Small delay to ensure routing is ready
				setTimeout(() => {
					const hasNavigated = handleTelegramNavigation(navigate);
					console.log(
						"[AuthContext] Already authenticated navigation result:",
						hasNavigated,
					);

					if (!hasNavigated) {
						// Only navigate to dashboard if we're on the root path
						const currentPath = window.location.pathname;
						if (currentPath === "/" || currentPath === "") {
							console.log(
								"[AuthContext] On root path, no Telegram navigation, going to dashboard",
							);
							navigate("/dashboard");
						} else {
							console.log(
								"[AuthContext] Already on valid path, not redirecting:",
								currentPath,
							);
						}
					}
				}, 100);
			}
		} else if (
			state.isWebApp &&
			telegramUser &&
			initData &&
			!state.isAuthenticated &&
			!hasAttemptedTelegramLogin.current
		) {
			// We have all the data, proceed with login
			hasAttemptedTelegramLogin.current = true;
			LogRocket.log("[AuthContext] Attempting Telegram WebApp auto-login", {
				telegramUser,
				initData,
			});
			setState((prev) => ({ ...prev, isLoading: true, error: null }));
			apiService.auth
				.telegramLogin({ telegramInitData: initData, user: telegramUser })
				.then((response) => {
					const data: AuthResponse = response.data;
					LogRocket.log("[AuthContext] Telegram login response:", data);
					localStorage.setItem("token", data.token ?? "");
					let user: User | null = null;
					if (data.user) {
						// Split name into firstName/lastName if needed
						const [firstName = ""] = (data.user.name ?? "").split(" ");
						user = {
							...data.user,
							name: firstName || telegramUser.first_name || "",
							// Optionally, you can add a custom lastName field if needed, but User type does not have it
						};
					}
					if (user?.id) {
						LogRocket.identify(user.id.toString(), {
							name: user.name || "",
							email: user.email || "",
							telegramUsername: user.telegramUsername || "",
						});
					}
					setState((prev) => ({
						...prev,
						token: data.token ?? null,
						isAuthenticated: true,
						isLoading: true,
						error: null,
					}));
					// Handle navigation after user data is loaded
					const handleNavigationAfterLogin = () => {
						LogRocket.log(
							"[AuthContext] Telegram login success, checking for navigation parameters",
						);
						console.log("[AuthContext] About to check Telegram navigation");
						console.log(
							"[AuthContext] Current URL before navigation check:",
							window.location.href,
						);
						console.log(
							"[AuthContext] SessionStorage startapp:",
							sessionStorage.getItem("cofi_telegram_startapp_param"),
						);

						// Small delay to ensure routing is ready
						setTimeout(() => {
							// Check for Telegram navigation parameters
							const hasNavigated = handleTelegramNavigation(navigate);
							console.log(
								"[AuthContext] Telegram navigation result:",
								hasNavigated,
							);

							if (!hasNavigated) {
								// Default navigation if no specific parameters
								console.log(
									"[AuthContext] No Telegram navigation, going to dashboard",
								);
								navigate("/dashboard");
							}
						}, 100);
					};

					apiService.auth
						.me()
						.then((response) => {
							setState((prev) => ({
								...prev,
								user: response.data,
								isLoading: false,
							}));
							// Navigate after user data is fully loaded
							handleNavigationAfterLogin();
						})
						.catch((error) => {
							console.error(
								"Failed to fetch user data after Telegram login:",
								error,
							);
							// Don't logout after successful Telegram login - just use the user data we got
							// from the login response and set loading to false
							setState((prev) => ({
								...prev,
								isLoading: false,
								error:
									"Failed to refresh user data, but you're still logged in.",
							}));
							// Still navigate even if user data fetch failed
							handleNavigationAfterLogin();
						});
				})
				.catch((error) => {
					LogRocket.captureException(error);
					LogRocket.log("[AuthContext] Telegram login error", error);
					setState((prev) => ({
						...prev,
						isLoading: false,
						error:
							error instanceof Error ? error.message : "Telegram login failed",
					}));
				});
		} else if (
			state.isWebApp &&
			!state.isAuthenticated &&
			!hasAttemptedTelegramLogin.current &&
			(!telegramUser || !initData)
		) {
			// We're in a WebApp but don't have the data yet
			LogRocket.log(
				"[AuthContext] Telegram WebApp detected but user/initData missing, waiting 200ms",
			);

			// Wait a short time for useTelegram to update
			shortWaitTimeout = setTimeout(() => {
				// Check again after short wait
				if (!telegramUser || !initData) {
					LogRocket.log(
						"[AuthContext] Telegram user/initData still missing after 200ms, setting 3s timeout",
					);
					// Still no data, set longer timeout
					longWaitTimeout = setTimeout(() => {
						LogRocket.log(
							"[AuthContext] Telegram user/initData still missing after 3s, disabling loading",
						);
						setState((prev) => ({
							...prev,
							isLoading: false,
							error: "Could not detect Telegram user.",
						}));
					}, 3000);
				} else {
					LogRocket.log(
						"[AuthContext] Telegram data arrived during short wait, will process on next effect run",
					);
				}
			}, 200);
		}

		// Cleanup function to clear timeouts
		return () => {
			if (shortWaitTimeout) {
				clearTimeout(shortWaitTimeout);
				LogRocket.log("[AuthContext] Cleared short wait timeout");
			}
			if (longWaitTimeout) {
				clearTimeout(longWaitTimeout);
				LogRocket.log("[AuthContext] Cleared long wait timeout");
			}
		};
	}, [state.isWebApp, telegramUser, initData, state.isAuthenticated, navigate]);

	const login = async (email: string, password: string) => {
		try {
			setState((prev) => ({ ...prev, isLoading: true, error: null }));
			const response = await apiService.auth.login({ email, password });

			localStorage.setItem("token", response.data.token ?? "");
			const user = response.data.user ?? null;

			// Set user language
			setUserLanguage(user);

			setState((prev: AuthState) => ({
				...prev,
				user: user as User,
				token: response.data.token ?? null,
				isAuthenticated: true,
				isLoading: false,
				error: null,
			}));
			navigate("/dashboard");
		} catch (error) {
			setState((prev: AuthState) => ({
				...prev,
				isLoading: false,
				error: error instanceof Error ? error.message : "Login failed",
			}));
		}
	};

	const register = async (
		email: string,
		password: string,
		firstName: string,
		lastName?: string,
	) => {
		try {
			setState((prev) => ({ ...prev, isLoading: true, error: null }));
			const response = await apiService.auth.register({
				email,
				password,
				name: `${firstName} ${lastName ?? ""}`,
			});

			localStorage.setItem("token", response.data.token ?? "");
			const user = response.data.user ?? null;

			// Set user language
			setUserLanguage(user);

			setState({
				...state,
				user: user as User,
				token: response.data.token ?? null,
				isAuthenticated: true,
				isLoading: false,
				error: null,
			});
			navigate("/dashboard");
		} catch (error) {
			setState((prev) => ({
				...prev,
				isLoading: false,
				error: error instanceof Error ? error.message : "Registration failed",
			}));
		}
	};

	const logout = () => {
		localStorage.removeItem("token");
		setState({
			user: null,
			token: null,
			isAuthenticated: false,
			isLoading: false,
			error: null,
			isWebApp: state.isWebApp,
		});
		navigate("/");
	};

	const requestPasswordReset = async (email: string) => {
		try {
			setState((prev) => ({ ...prev, isLoading: true, error: null }));
			const response = await apiService.auth.passwordReset({ email });
			if (response.status !== 200) {
				throw new Error("Failed to request password reset");
			}
		} catch (error) {
			setState((prev) => ({
				...prev,
				isLoading: false,
				error: error instanceof Error ? error.message : "Request failed",
			}));
		}
	};

	const resetPassword = async (token: string, newPassword: string) => {
		try {
			setState((prev) => ({ ...prev, isLoading: true, error: null }));
			const response = await apiService.auth.passwordResetConfirm({
				token,
				password: newPassword,
			});
			if (response.status !== 200) {
				throw new Error("Failed to reset password");
			}
		} catch (error) {
			setState((prev) => ({
				...prev,
				isLoading: false,
				error: error instanceof Error ? error.message : "Reset failed",
			}));
		}
	};

	const handleTelegramAuth = () => {
		if (state.isWebApp) {
			if (window.Telegram?.WebApp) {
				window.Telegram.WebApp.expand();
				window.Telegram.WebApp.ready();
			}
		} else {
			const botId = "7148755509"; // Your bot ID
			const redirectUrl = window.location.href;
			window.location.href = `https://oauth.telegram.org/auth?bot_id=${botId}&origin=${encodeURIComponent(
				redirectUrl,
			)}`;
		}
	};

	const setUser = (user: User | null) => {
		setState((prev) => ({ ...prev, user }));
	};

	const setToken = (token: string | null) => {
		setState((prev) => ({ ...prev, token }));
		if (token) {
			localStorage.setItem("token", token);
		} else {
			localStorage.removeItem("token");
		}
	};

	// Update user profile
	const updateUser = async (profileData: ProfileUpdateRequest) => {
		try {
			setState((prev) => ({ ...prev, isLoading: true, error: null }));
			console.log("[AuthContext] Updating profile with data:", profileData);
			const response = await apiService.auth.updateProfile(profileData);
			console.log("[AuthContext] Profile update response:", response.data);
			setState((prev) => ({
				...prev,
				user: response.data,
				isLoading: false,
				error: null,
			}));
		} catch (error) {
			console.error("[AuthContext] Profile update error:", error);
			setState((prev) => ({
				...prev,
				isLoading: false,
				error: error instanceof Error ? error.message : "Profile update failed",
			}));
			throw error;
		}
	};

	// Delete all user data
	const deleteAllData = async () => {
		try {
			setState((prev) => ({ ...prev, isLoading: true, error: null }));
			console.log("[AuthContext] Deleting all user data");
			await apiService.auth.deleteAllData();
			console.log("[AuthContext] All user data deleted successfully");
			setState((prev) => ({
				...prev,
				isLoading: false,
				error: null,
			}));
		} catch (error) {
			console.error("[AuthContext] Delete all data error:", error);
			setState((prev) => ({
				...prev,
				isLoading: false,
				error: error instanceof Error ? error.message : "Data deletion failed",
			}));
			throw error;
		}
	};

	// Handle Telegram Login Widget (browser)
	const handleTelegramWidgetAuth = async (tgUser: TelegramWidgetUser) => {
		setState((prev) => ({ ...prev, isLoading: true, error: null }));
		try {
			// Validate required fields from Telegram widget
			if (!tgUser.id) {
				throw new Error("Missing Telegram user ID");
			}
			if (!tgUser.username) {
				throw new Error("Missing Telegram username");
			}
			if (!tgUser.hash) {
				throw new Error("Missing Telegram authentication hash");
			}

			console.log("Telegram widget data received:", {
				id: tgUser.id,
				username: tgUser.username,
				first_name: tgUser.first_name,
				hash: tgUser.hash ? "present" : "missing",
				auth_date: tgUser.auth_date,
			});

			// Map Telegram widget data to backend API format (snake_case)
			// Note: TypeScript types use camelCase but backend expects snake_case
			const loginData = {
				telegram_id: tgUser.id, // Required: Telegram widget uses 'id'
				username: tgUser.username, // Required field
				first_name: tgUser.first_name || "",
				last_name: tgUser.last_name || "",
				photo_url: tgUser.photo_url || "",
				auth_date: tgUser.auth_date || Math.floor(Date.now() / 1000),
				hash: tgUser.hash, // Required field from Telegram widget
				language: "en", // Default language, could be detected from browser
				country: "", // Not provided by widget
				// biome-ignore lint/suspicious/noExplicitAny: Backend expects snake_case but TypeScript types are camelCase
			} as any;

			console.log("Sending Telegram login data:", loginData);
			console.log("Expected backend format:", {
				telegram_id: "number (required)",
				username: "string (required)",
				hash: "string (required)",
				first_name: "string (optional)",
				last_name: "string (optional)",
				photo_url: "string (optional)",
				auth_date: "number (optional)",
				language: "string (optional)",
				country: "string (optional)",
			});

			const response = await apiService.auth.telegramLoginWidget(loginData);
			const { token, user } = response.data;
			localStorage.setItem("token", token ?? "");

			// Set user language
			setUserLanguage(user ?? null);

			setState((prev: AuthState) => ({
				...prev,
				user: user ?? null,
				token: token ?? null,
				isAuthenticated: true,
				isLoading: false,
				error: null,
			}));
			navigate("/dashboard");
		} catch (error) {
			console.error("Telegram widget login error:", error);
			setState((prev) => ({
				...prev,
				isLoading: false,
				error: error instanceof Error ? error.message : "Telegram login failed",
			}));
		}
	};

	return (
		<AuthContext.Provider
			value={{
				...state,
				login,
				register,
				logout,
				requestPasswordReset,
				resetPassword,
				handleTelegramAuth,
				setUser,
				setToken,
				handleTelegramWidgetAuth,
				updateUser,
				deleteAllData,
			}}
		>
			{state.isWebApp && state.isLoading && !state.isAuthenticated ? (
				<TelegramLoadingScreen error={state.error} />
			) : (
				children
			)}
		</AuthContext.Provider>
	);
};

export const useAuth = () => {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return context;
};
