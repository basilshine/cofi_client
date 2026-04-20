import {
	type ReactNode,
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import { type AuthUser, authApi } from "../features/auth/authApi";
import { tokenStorage } from "../shared/lib/tokenStorage";

type AuthContextValue = {
	user: AuthUser | null;
	isLoading: boolean;
	isAuthenticated: boolean;
	login: (payload: { email: string; password: string }) => Promise<void>;
	register: (payload: {
		email: string;
		password: string;
		name: string;
		country: string;
		language: string;
	}) => Promise<AuthUser>;
	requestEmailCode: (email: string) => Promise<void>;
	confirmEmailCode: (payload: { email: string; code: string }) => Promise<void>;
	logout: () => void;
	refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
	const [user, setUser] = useState<AuthUser | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	const refreshUser = useCallback(async () => {
		const token = tokenStorage.getToken();
		if (!token) {
			setUser(null);
			return;
		}
		try {
			const me = await authApi.me();
			setUser(me);
		} catch {
			setUser(null);
		}
	}, []);

	useEffect(() => {
		void (async () => {
			setIsLoading(true);
			await refreshUser();
			setIsLoading(false);
		})();
	}, [refreshUser]);

	const login = useCallback(
		async (payload: { email: string; password: string }) => {
			await authApi.login(payload);
			await refreshUser();
		},
		[refreshUser],
	);

	const register = useCallback(
		async (payload: {
			email: string;
			password: string;
			name: string;
			country: string;
			language: string;
		}) => {
			const res = await authApi.register(payload);
			return res.user;
		},
		[],
	);

	const requestEmailCode = useCallback(async (email: string) => {
		await authApi.requestEmailCode(email);
	}, []);

	const confirmEmailCode = useCallback(
		async (payload: { email: string; code: string }) => {
			await authApi.confirmEmailCode(payload);
		},
		[],
	);

	const logout = useCallback(() => {
		authApi.logout();
		setUser(null);
	}, []);

	const value = useMemo(
		(): AuthContextValue => ({
			user,
			isLoading,
			isAuthenticated: !!user,
			login,
			register,
			requestEmailCode,
			confirmEmailCode,
			logout,
			refreshUser,
		}),
		[
			user,
			isLoading,
			login,
			register,
			requestEmailCode,
			confirmEmailCode,
			logout,
			refreshUser,
		],
	);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
	const ctx = useContext(AuthContext);
	if (!ctx) {
		throw new Error("useAuth must be used within AuthProvider");
	}
	return ctx;
};
