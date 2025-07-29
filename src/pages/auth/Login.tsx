import { isTelegramWebApp } from "@/utils/isTelegramWebApp";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Separator } from "@components/ui/separator";
import { useAuth } from "@contexts/AuthContext";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

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

export const Login = () => {
	const { t } = useTranslation();
	const { login, isLoading, error, handleTelegramWidgetAuth } = useAuth();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const isWebApp = isTelegramWebApp();
	const widgetRef = useRef<HTMLDivElement>(null);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		await login(email, password);
	};

	useEffect(() => {
		if (isWebApp) return;
		// Define the global callback
		// Telegram widget provides: id, first_name, last_name, username, photo_url, auth_date, hash
		(
			window as unknown as {
				onTelegramAuth: (user: TelegramWidgetUser) => void;
			}
		).onTelegramAuth = (user: TelegramWidgetUser) => {
			console.log("Telegram widget data:", user); // Debug log
			handleTelegramWidgetAuth(user);
		};
		// Inject the Telegram widget script
		const script = document.createElement("script");
		script.src = "https://telegram.org/js/telegram-widget.js?7";
		script.async = true;
		script.setAttribute("data-telegram-login", "cofilance_bot"); // <-- Replace with your bot username
		script.setAttribute("data-size", "large");
		script.setAttribute("data-userpic", "false");
		script.setAttribute("data-request-access", "write");
		script.setAttribute("data-onauth", "onTelegramAuth(user)");
		if (widgetRef.current) {
			widgetRef.current.innerHTML = "";
			widgetRef.current.appendChild(script);
		}
		return () => {
			if (widgetRef.current) widgetRef.current.innerHTML = "";
		};
	}, [isWebApp, handleTelegramWidgetAuth]);

	if (isWebApp) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<div className="text-center">
					<p className="text-lg font-semibold">Logging in with Telegram...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="flex min-h-screen items-center justify-center">
			<div className="w-full max-w-md p-8 bg-white rounded shadow">
				<div ref={widgetRef} className="flex justify-center mb-4" />
				<Separator className="my-4">or</Separator>
				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="email">{t("auth.email")}</Label>
						<Input
							id="email"
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							required
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="password">{t("auth.password")}</Label>
						<Input
							id="password"
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							required
						/>
					</div>
					<Button type="submit" className="w-full" disabled={isLoading}>
						{t("auth.login.submit")}
					</Button>
				</form>
				{error && <div className="mt-4 text-red-500">{error}</div>}
				<div className="text-sm text-right mt-2">
					<Link
						to="/auth/forgot-password"
						className="text-primary hover:underline"
					>
						{t("auth.forgotPassword")}
					</Link>
				</div>
				<div className="text-sm text-center mt-2">
					{t("auth.noAccount")}{" "}
					<Link to="/auth/register" className="text-primary hover:underline">
						{t("auth.register")}
					</Link>
				</div>
			</div>
		</div>
	);
};
