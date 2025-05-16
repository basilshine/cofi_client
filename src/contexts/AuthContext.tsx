import { useTelegram } from "@/hooks/useTelegram";
import { isTelegramWebApp } from "@/utils/isTelegramWebApp";
import { apiService } from "@services/api";
import WebApp from "@twa-dev/sdk";
import type { AxiosResponse } from "axios";
import { jwtDecode } from "jwt-decode";
import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useState } from "react";
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
	handleTelegramWidgetAuth: (tgUser: any) => Promise<void>;
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
	const { isWebApp: hookIsWebApp, telegramUser, initData } = useTelegram();

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

	useEffect(() => {
		// Auto-login/register with Telegram if in WebApp and not already authenticated
		if (
			isWebApp &&
			telegramUser &&
			initData &&
			!state.isAuthenticated &&
			!state.isLoading
		) {
			console.log("[AuthContext] Attempting Telegram WebApp login:", {
				telegramUser,
				initData,
			});
			setState((prev) => ({ ...prev, isLoading: true, error: null }));
			apiService.auth
				.telegramLogin({ telegramInitData: initData, user: telegramUser })
				.then((response: AxiosResponse<TelegramLoginResponse>) => {
					const data = response.data;
					console.log("[AuthContext] Telegram login response:", data);
					localStorage.setItem("token", data.token ?? "");
					const user = data.user
						? {
								id: data.user.id ?? "",
								email: data.user.email ?? "",
								firstName: data.user.firstName ?? telegramUser.first_name ?? "",
								lastName: data.user.lastName ?? telegramUser.last_name,
								telegramId: data.user.telegramId ?? telegramUser.id,
								telegramUsername:
									data.user.telegramUsername ?? telegramUser.username,
								telegramPhotoUrl: data.user.telegramPhotoUrl,
							}
						: null;
					console.log(
						"[AuthContext] Setting user and navigating to dashboard:",
						user,
					);
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
					console.error("[AuthContext] Telegram login error:", error);
					setState((prev) => ({
						...prev,
						isLoading: false,
						error:
							error instanceof Error ? error.message : "Telegram login failed",
					}));
				});
		}
	}, [
		isWebApp,
		telegramUser,
		initData,
		state.isAuthenticated,
		state.isLoading,
		navigate,
	]);

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
	const handleTelegramWidgetAuth = async (tgUser: any) => {
		setState((prev) => ({ ...prev, isLoading: true, error: null }));
		try {
			const response = await apiService.auth.telegramLoginWidget(tgUser);
			const { token, user } = response.data;
			localStorage.setItem("token", token ?? "");
			setState((prev) => ({
				...prev,
				user,
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
			{children}
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
