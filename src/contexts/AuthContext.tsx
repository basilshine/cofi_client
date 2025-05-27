import { useTelegram } from "@/hooks/useTelegram";
import type { TelegramWidgetUser } from "@/types/TelegramWidgetUser";
import { isTelegramWebApp } from "@/utils/isTelegramWebApp";
import { apiService } from "@services/api";
import type { AxiosResponse } from "axios";
import { jwtDecode } from "jwt-decode";
import LogRocket from "logrocket";
import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

interface User {
	id: string;
	email: string;
	firstName: string;
	lastName?: string;
	telegramId?: number;
	telegramUsername?: string;
	telegramPhotoUrl?: string;
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
}

interface TelegramLoginResponse {
	token?: string;
	user?: {
		id?: string;
		email?: string;
		firstName?: string;
		lastName?: string;
		telegramId?: number;
		telegramUsername?: string;
		telegramPhotoUrl?: string;
	};
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
					setState((prev) => ({
						...prev,
						isAuthenticated: true,
						isLoading: false,
					}));
				}
			} catch (error) {
				logout();
			}
		} else {
			setState((prev) => ({ ...prev, isLoading: false }));
		}
	}, []);

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
			setState((prev) => ({ ...prev, isLoading: true }));
		}
		if (!isWebApp && !state.isAuthenticated) {
			setState((prev) => ({ ...prev, isLoading: false }));
		}
		// eslint-disable-next-line
	}, [isWebApp, state.isAuthenticated]);

	// Improved Telegram WebApp auto-login
	useEffect(() => {
		if (
			isWebApp &&
			telegramUser &&
			initData &&
			!state.isAuthenticated &&
			!hasAttemptedTelegramLogin.current
		) {
			hasAttemptedTelegramLogin.current = true;
			LogRocket.log("[AuthContext] Attempting Telegram WebApp auto-login", {
				telegramUser,
				initData,
			});
			setState((prev) => ({ ...prev, isLoading: true, error: null }));
			apiService.auth
				.telegramLogin({ telegramInitData: initData, user: telegramUser })
				.then((response: AxiosResponse<TelegramLoginResponse>) => {
					const data = response.data;
					LogRocket.log("[AuthContext] Telegram login response:", data);
					localStorage.setItem("token", data.token ?? "");
					const user = data.user
						? {
								id: typeof data.user.id === "string" ? data.user.id : "",
								email:
									typeof data.user.email === "string" ? data.user.email : "",
								firstName: data.user.firstName ?? telegramUser.first_name ?? "",
								lastName: data.user.lastName ?? telegramUser.last_name,
								telegramId: data.user.telegramId ?? telegramUser.id,
								telegramUsername:
									data.user.telegramUsername ?? telegramUser.username,
								telegramPhotoUrl: data.user.telegramPhotoUrl,
							}
						: null;
					// Optionally identify user in LogRocket
					if (user?.id) {
						LogRocket.identify(user.id, {
							name: user.firstName + (user.lastName ? ` ${user.lastName}` : ""),
							email: user.email || "",
							telegramUsername: user.telegramUsername || "",
						});
					}
					setState((prev) => ({
						...prev,
						user,
						token: data.token ?? null,
						isAuthenticated: true,
						isLoading: false,
						error: null,
					}));
					navigate("/dashboard");
				})
				.catch((error) => {
					LogRocket.captureException(error);
					setState((prev) => ({
						...prev,
						isLoading: false,
						error:
							error instanceof Error ? error.message : "Telegram login failed",
					}));
				});
		}
	}, [isWebApp, telegramUser, initData, state.isAuthenticated, navigate]);

	const login = async (email: string, password: string) => {
		try {
			setState((prev) => ({ ...prev, isLoading: true, error: null }));
			const response = await apiService.auth.login({ email, password });

			localStorage.setItem("token", response.data.token ?? "");
			const user = response.data.user
				? (() => {
						const [firstName = "", ...rest] = (
							response.data.user.name ?? ""
						).split(" ");
						const lastName = rest.join(" ") || undefined;
						return {
							id: response.data.user.id ?? "",
							email: response.data.user.email ?? "",
							firstName,
							lastName,
							telegramId: response.data.user.telegramId,
							telegramUsername: response.data.user.telegramUsername,
							telegramPhotoUrl: response.data.user.telegramPhotoUrl,
						};
					})()
				: null;
			setState((prev) => ({
				...prev,
				user,
				token: response.data.token ?? null,
				isAuthenticated: true,
				isLoading: false,
				error: null,
			}));
			navigate("/dashboard");
		} catch (error) {
			setState((prev) => ({
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
			const user = response.data.user
				? (() => {
						const [first = "", ...rest] = (response.data.user.name ?? "").split(
							" ",
						);
						const last = rest.join(" ") || undefined;
						return {
							id: response.data.user.id ?? "",
							email: response.data.user.email ?? "",
							firstName: first,
							lastName: last,
							telegramId: response.data.user.telegramId,
							telegramUsername: response.data.user.telegramUsername,
							telegramPhotoUrl: response.data.user.telegramPhotoUrl,
						};
					})()
				: null;
			setState({
				...state,
				user,
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
			const response = await apiService.auth.requestPasswordReset({
				email: email ?? "",
			});

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
			const response = await apiService.auth.resetPassword({
				token,
				newPassword,
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
	const handleTelegramWidgetAuth = async (tgUser: TelegramWidgetUser) => {
		setState((prev) => ({ ...prev, isLoading: true, error: null }));
		try {
			const response = await apiService.auth.telegramLoginWidget({
				telegram_id: tgUser.id,
				username: tgUser.username,
				first_name: tgUser.first_name,
				last_name: tgUser.last_name,
				photo_url: tgUser.photo_url,
				auth_date: tgUser.auth_date,
				hash: tgUser.hash,
				language: tgUser.language_code,
				country: tgUser.country,
			});
			const { token, user } = response.data;
			localStorage.setItem("token", token ?? "");
			setState((prev) => ({
				...prev,
				user: user
					? {
							id: typeof user.id === "string" ? user.id : "",
							email: typeof user.email === "string" ? user.email : "",
							firstName: user.firstName ?? "",
							lastName: user.lastName,
							telegramId: user.telegramId,
							telegramUsername: user.telegramUsername,
							telegramPhotoUrl: user.telegramPhotoUrl,
						}
					: null,
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
