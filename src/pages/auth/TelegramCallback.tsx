import { useAuth } from "@contexts/AuthContext";
import { apiService } from "@services/api";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export const TelegramCallback = () => {
	const navigate = useNavigate();
	const { setUser, setToken } = useAuth(); // You may need to expose these setters
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		console.log("[TelegramCallback] Component mounted. Parsing URL params...");
		const params = new URLSearchParams(window.location.search);
		const telegramData: Record<string, string> = {};
		params.forEach((value, key) => {
			telegramData[key] = value;
		});
		console.log("[TelegramCallback] Parsed telegramData:", telegramData);

		if (telegramData.id && telegramData.hash) {
			console.log(
				"[TelegramCallback] Valid Telegram data found. Sending to backend...",
			);
			apiService.auth
				.telegramOAuthCallback(telegramData)
				.then((response) => {
					console.log("[TelegramCallback] Backend response:", response.data);
					setToken(response.data.token ?? null);
					const user = response.data.user
						? {
								id: response.data.user.id ?? "",
								email: response.data.user.email ?? "",
								firstName: response.data.user.firstName ?? "",
								lastName: response.data.user.lastName,
								telegramId: response.data.user.telegramId,
								telegramUsername: response.data.user.telegramUsername,
								telegramPhotoUrl: response.data.user.telegramPhotoUrl,
							}
						: null;
					console.log(
						"[TelegramCallback] Setting user and navigating to dashboard:",
						user,
					);
					setUser(user);
					navigate("/dashboard");
				})
				.catch((err) => {
					console.error("[TelegramCallback] Telegram login failed:", err);
					setError("Telegram login failed. Please try again.");
				});
		} else {
			console.error(
				"[TelegramCallback] Invalid Telegram callback data:",
				telegramData,
			);
			setError("Invalid Telegram callback data.");
		}
	}, [navigate, setUser, setToken]);

	if (error) {
		return <div className="text-red-500">{error}</div>;
	}
	return <div>Logging in with Telegram...</div>;
};
