import { useTelegram } from "@/hooks/useTelegram";
import type { components } from "@/types/api-types";
import { isTelegramWebApp } from "@/utils/isTelegramWebApp";
import { handleTelegramNavigation } from "@/utils/telegramWebApp";
import { apiService } from "@/services/api";
import { jwtDecode } from "jwt-decode";
import LogRocket from "logrocket";
import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

// Use only types from api-types.ts
export type User = components["schemas"]["User"];
export type AuthResponse = components["schemas"]["AuthResponse"];

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
	handleTelegramWidgetAuth: (
		tgUser: components["schemas"]["User"],
	) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
	const isWebApp = isTelegramWebApp();
	const [state, setState] = useState<AuthState>({
		user: null,
		token: localStorage.getItem("token"),
		isAuthenticated: false,
		isLoading: true,
		error: null,
		isWebApp: isWebApp,
	});

	const navigate = useNavigate();
	const { telegramUser, initData } = useTelegram();
	const hasAttemptedTelegramLogin = useRef(false);

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
						apiService.auth.me()
							.then((response) => {
								setState((prev) => ({
									...prev,
									user: response.data,
									isAuthenticated: true,
									isLoading: false,
								}));
							})
							.catch(() => {
								logout();
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
				logout();
			}
		} else {
			setState((prev) => ({ ...prev, isLoading: false }));
		}
	}, [state.user]);

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
		if (isWebApp && !state.isAuthenticated) {
			LogRocket.log("[AuthContext] Setting isLoading: true for WebApp");
			setState((prev) => ({ ...prev, isLoading: true }));
		}
		if (!isWebApp && !state.isAuthenticated) {
			LogRocket.log("[AuthContext] Setting isLoading: false for non-WebApp");
			setState((prev) => ({ ...prev, isLoading: false }));
		}
		// eslint-disable-next-line
	}, [isWebApp, state.isAuthenticated]);

	// Improved Telegram WebApp auto-login
	useEffect(() => {
		LogRocket.log("[AuthContext] Telegram auto-login effect triggered", {
			isWebApp,
			telegramUser,
			initData,
			isAuthenticated: state.isAuthenticated,
			hasAttemptedTelegramLogin: hasAttemptedTelegramLogin.current,
		});

		let shortWaitTimeout: NodeJS.Timeout | null = null;
		let longWaitTimeout: NodeJS.Timeout | null = null;

		if (isWebApp && state.isAuthenticated) {
			// User is already authenticated in WebApp, ensure loading is false and navigate
			LogRocket.log(
				"[AuthContext] User already authenticated in WebApp, setting isLoading: false and navigating",
			);
			setState((prev) => ({ ...prev, isLoading: false }));
			navigate("/dashboard");
		} else if (
			isWebApp &&
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
						const [firstName = "", ...rest] = (data.user.name ?? "").split(" ");
						const lastName = rest.join(" ") || undefined;
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
					apiService.auth.me()
						.then((response) => {
							setState((prev) => ({
								...prev,
								user: response.data,
								isLoading: false,
							}));
						})
						.catch(() => {
							logout();
						});
					LogRocket.log(
						"[AuthContext] Telegram login success, checking for navigation parameters",
					);

					// Check for Telegram navigation parameters
					const hasNavigated = handleTelegramNavigation(navigate);
					if (!hasNavigated) {
						// Default navigation if no specific parameters
						navigate("/dashboard");
					}
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
			isWebApp &&
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
	}, [isWebApp, telegramUser, initData, state.isAuthenticated, navigate]);

	const login = async (email: string, password: string) => {
		try {
			setState((prev) => ({ ...prev, isLoading: true, error: null }));
			const response = await apiService.auth.login({ email, password });

			localStorage.setItem("token", response.data.token ?? "");
			const user = response.data.user ?? null;
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

	// Handle Telegram Login Widget (browser)
	const handleTelegramWidgetAuth = async (
		tgUser: components["schemas"]["User"],
	) => {
		setState((prev) => ({ ...prev, isLoading: true, error: null }));
		try {
			const response = await apiService.auth.telegramLoginWidget({
				telegramId: tgUser.telegramId ?? 0,
				username: tgUser.telegramUsername ?? "",
				photoUrl: tgUser.telegramPhotoUrl ?? "",
				country: tgUser.country,
				language: tgUser.language,
				// authDate and hash are not available from User, so omit them
			});
			const { token, user } = response.data;
			localStorage.setItem("token", token ?? "");
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
			}}
		>
			{isWebApp && state.isLoading && !state.isAuthenticated ? (
				<div className="flex min-h-screen items-center justify-center">
					<div className="text-center">
						<p className="text-lg font-semibold">Logging in with Telegram...</p>
						{state.error && <p className="text-red-500 mt-2">{state.error}</p>}
					</div>
				</div>
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
