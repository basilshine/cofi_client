import { useMemo } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface User {
	id: string;
	name: string;
	email?: string;
	auth_type?: string; // Добавлено для поддержки Telegram/email auth
}

interface AuthState {
	user: User | null;
	token: string | null;
	isAuthenticated: boolean;
	setUser: (user: User | null) => void;
	setToken: (token: string | null) => void;
	logout: () => void;
}

export const useAuthStore = create<AuthState>()(
	persist(
		(set) => ({
			user: null,
			token: null,
			isAuthenticated: false,
			setUser: (user) => set({ user, isAuthenticated: !!user }),
			setToken: (token) => set({ token }),
			logout: () => set({ user: null, token: null, isAuthenticated: false }),
		}),
		{
			name: "auth-storage",
		},
	),
);

// Universal hook to check if user is authorized (token + user + user.id + user.auth_type)
export const useIsAuthorized = () => {
	const { token, user } = useAuthStore();
	return useMemo(
		() => !!token && !!user && !!user.id && !!user.auth_type,
		[token, user],
	);
};
