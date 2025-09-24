import type { components } from "@/types/api-types";
import LogRocket from "logrocket";

type User = components["schemas"]["User"];

interface TelegramWebAppData {
	initData: string;
	initDataUnsafe: Record<string, unknown>;
	startParam?: string;
}

interface ParsedStartParam {
	action: "edit_expense" | "view_analytics" | "add_expense";
	expenseId?: string;
	data?: Record<string, unknown>;
}

export const getTelegramWebAppData = (): TelegramWebAppData | null => {
	if (typeof window === "undefined") return null;

	// Minimal debug logging to avoid performance issues
	console.log("[getTelegramWebAppData] Current URL:", window.location.href);
	console.log("[getTelegramWebAppData] URL search:", window.location.search);
	console.log(
		"[getTelegramWebAppData] Has Telegram WebApp:",
		!!window.Telegram?.WebApp,
	);

	// LogRocket logging for production debugging (minimal)
	LogRocket.log("[getTelegramWebAppData] WebApp Check", {
		currentURL: window.location.href,
		urlSearch: window.location.search,
		hasTelegramWebApp: !!window.Telegram?.WebApp,
	});

	let startParam = "";
	let initData = "";
	let initDataUnsafe = {};

	// Method 1: Try to get from Telegram WebApp object (if available)
	if (window.Telegram?.WebApp) {
		const tgWebApp = window.Telegram.WebApp;
		startParam =
			((tgWebApp.initDataUnsafe as Record<string, unknown>)
				?.start_param as string) || "";
		initData = tgWebApp.initData || "";
		initDataUnsafe = tgWebApp.initDataUnsafe || {};

		console.log(
			"[getTelegramWebAppData] From WebApp object - start_param:",
			startParam,
		);
		console.log(
			"[getTelegramWebAppData] From WebApp object - initDataUnsafe:",
			initDataUnsafe,
		);
	}

	// Method 2: Check URL search parameters (for ?startapp=edit_expense_100)
	if (!startParam) {
		const urlParams = new URLSearchParams(window.location.search);
		startParam = urlParams.get("startapp") || "";
		console.log(
			"[getTelegramWebAppData] From URL search params - startapp:",
			startParam,
		);
		console.log(
			"[getTelegramWebAppData] All URL params:",
			Array.from(urlParams.entries()),
		);
		console.log("[getTelegramWebAppData] Current URL:", window.location.href);

		// Persist startapp parameter if found
		if (startParam) {
			sessionStorage.setItem("cofi_telegram_startapp_param", startParam);
			console.log(
				"[getTelegramWebAppData] Persisted startapp parameter:",
				startParam,
			);
		}
	}

	// Method 2.5: Check for persisted startapp parameter if not found in URL
	if (!startParam) {
		const persistedStartParam = sessionStorage.getItem(
			"cofi_telegram_startapp_param",
		);
		if (persistedStartParam) {
			startParam = persistedStartParam;
			console.log(
				"[getTelegramWebAppData] Using persisted startapp parameter:",
				startParam,
			);
		}
	}

	// Method 3: Check URL hash for tgWebAppData (fallback method)
	if (!startParam && window.location.hash.includes("tgWebAppData=")) {
		try {
			const hashParams = new URLSearchParams(window.location.hash.substring(1));
			const tgWebAppData = hashParams.get("tgWebAppData");
			if (tgWebAppData) {
				const decoded = decodeURIComponent(tgWebAppData);
				const params = new URLSearchParams(decoded);
				startParam = params.get("start_param") || "";
				console.log(
					"[getTelegramWebAppData] From hash - start_param:",
					startParam,
				);

				// Persist the start_param from hash if found
				if (startParam) {
					sessionStorage.setItem("cofi_telegram_startapp_param", startParam);
					console.log(
						"[getTelegramWebAppData] Persisted start_param from hash:",
						startParam,
					);
				}
			}
		} catch (error) {
			console.error("[getTelegramWebAppData] Error parsing hash:", error);
		}
	}

	// Method 4: Check if we're in a Telegram WebApp environment at all
	// Enhanced detection: check for Telegram WebApp object, hash data, or URL params
	const isWebApp =
		window.Telegram?.WebApp ||
		window.location.hash.includes("tgWebAppData=") ||
		window.location.search.includes("startapp=");

	// Method 5: Check session storage for persisted WebApp state (for navigation)
	const persistedWebAppState = sessionStorage.getItem(
		"cofi_telegram_webapp_detected",
	);
	const isPersistedWebApp = !!persistedWebAppState;

	// If we have a startParam, ensure we're marked as a WebApp
	if (startParam) {
		sessionStorage.setItem("cofi_telegram_webapp_detected", "hash_data");
		console.log(
			"[getTelegramWebAppData] Marked as WebApp due to startParam:",
			startParam,
		);
	}

	console.log("[getTelegramWebAppData] Final startParam:", startParam);
	console.log(
		"[getTelegramWebAppData] Is WebApp:",
		isWebApp || isPersistedWebApp,
	);

	// Return data if we're in a WebApp environment (current or persisted)
	if (isWebApp || isPersistedWebApp) {
		const result = {
			initData: initData,
			initDataUnsafe: initDataUnsafe,
			startParam: startParam,
		};
		LogRocket.log("[getTelegramWebAppData] WebApp data found", { startParam });
		return result;
	}

	return null;
};

export const parseStartParam = (
	startParam: string,
): ParsedStartParam | null => {
	if (!startParam) return null;

	console.log("[parseStartParam] Parsing start param:", startParam);

	// Parse different parameter formats:
	// edit_expense_123 - edit expense with ID 123
	// view_analytics - go to analytics page
	// add_expense_food_25.50 - add expense for food category with amount 25.50

	const editExpenseMatch = startParam.match(/^edit_expense_(\d+)$/);
	console.log("[parseStartParam] Edit expense match:", editExpenseMatch);
	if (editExpenseMatch) {
		const result = {
			action: "edit_expense" as const,
			expenseId: editExpenseMatch[1],
		};
		console.log("[parseStartParam] Returning edit expense result:", result);
		return result;
	}

	if (startParam === "view_analytics") {
		return {
			action: "view_analytics",
		};
	}

	const addExpenseMatch = startParam.match(/^add_expense_([^_]+)_([0-9.]+)$/);
	if (addExpenseMatch) {
		return {
			action: "add_expense",
			data: {
				category: addExpenseMatch[1],
				amount: Number.parseFloat(addExpenseMatch[2]),
			},
		};
	}

	const addExpenseSimpleMatch = startParam.match(/^add_expense$/);
	if (addExpenseSimpleMatch) {
		return {
			action: "add_expense",
		};
	}

	return null;
};

export const handleTelegramNavigation = (
	navigate: (path: string) => void,
): boolean => {
	console.log("[TelegramNavigation] === STARTING NAVIGATION CHECK ===");
	console.log("[TelegramNavigation] Current URL:", window.location.href);
	console.log(
		"[TelegramNavigation] URL search params:",
		window.location.search,
	);
	console.log("[TelegramNavigation] URL hash:", window.location.hash);
	console.log(
		"[TelegramNavigation] SessionStorage startapp:",
		sessionStorage.getItem("cofi_telegram_startapp_param"),
	);

	// Direct check for startapp parameter
	const directStartApp = new URLSearchParams(window.location.search).get(
		"startapp",
	);
	console.log("[TelegramNavigation] Direct startapp check:", directStartApp);

	const webAppData = getTelegramWebAppData();
	console.log("[TelegramNavigation] WebApp data:", webAppData);
	console.log(
		"[TelegramNavigation] Start param from WebApp data:",
		webAppData?.startParam,
	);

	// If no WebApp data at all, we're not in a Telegram environment
	if (!webAppData) {
		console.log("[TelegramNavigation] Not in Telegram WebApp environment");
		return false;
	}

	// If no start param, check if we can extract it from URL directly
	let startParam = webAppData.startParam;
	if (!startParam) {
		// Try to extract from URL search params as fallback
		const urlParams = new URLSearchParams(window.location.search);
		startParam = urlParams.get("startapp") || "";
		console.log(
			"[TelegramNavigation] Fallback start param from URL search:",
			startParam,
		);
	}

	// Additional fallback: check URL hash for start_param
	if (!startParam && window.location.hash) {
		try {
			const hashParams = new URLSearchParams(window.location.hash.substring(1));
			const tgWebAppData = hashParams.get("tgWebAppData");
			if (tgWebAppData) {
				const decoded = decodeURIComponent(tgWebAppData);
				const params = new URLSearchParams(decoded);
				startParam = params.get("start_param") || "";
				console.log(
					"[TelegramNavigation] Fallback start param from hash:",
					startParam,
				);
			}
		} catch (error) {
			console.error(
				"[TelegramNavigation] Error parsing hash for start param:",
				error,
			);
		}
	}

	if (!startParam) {
		console.log("[TelegramNavigation] No start param found anywhere");
		console.log(
			"[TelegramNavigation] Available URL params:",
			Array.from(new URLSearchParams(window.location.search).entries()),
		);
		console.log(
			"[TelegramNavigation] Available hash params:",
			window.location.hash
				? Array.from(
						new URLSearchParams(window.location.hash.substring(1)).entries(),
					)
				: "none",
		);
		return false;
	}

	console.log("[TelegramNavigation] Found start param:", startParam);
	const parsed = parseStartParam(startParam);
	console.log("[TelegramNavigation] Parsed start param:", parsed);

	if (!parsed) {
		console.log(
			"[TelegramNavigation] Failed to parse start param:",
			startParam,
		);
		return false;
	}

	console.log(
		"[TelegramNavigation] Successfully parsed action:",
		parsed.action,
	);

	// Store the target path before navigation to ensure it's preserved
	let targetPath = "";

	switch (parsed.action) {
		case "edit_expense":
			if (parsed.expenseId) {
				targetPath = `/expenses/${parsed.expenseId}/edit`;
				console.log(
					"[TelegramNavigation] Navigating to expense edit:",
					targetPath,
				);

				// Set marker for telegram edit flow
				sessionStorage.setItem("telegram_edit_flow", "true");

				// Clear the startapp parameter only after successful navigation
				setTimeout(() => {
					if (typeof window !== "undefined") {
						sessionStorage.removeItem("cofi_telegram_startapp_param");
						console.log(
							"[TelegramNavigation] Startapp parameter cleared after navigation to:",
							targetPath,
						);
					}
				}, 100);
				navigate(targetPath);
				return true;
			}
			console.log("[TelegramNavigation] Edit expense action but no expense ID");
			break;

		case "view_analytics":
			targetPath = "/dashboard/analytics";
			console.log("[TelegramNavigation] Navigating to analytics:", targetPath);
			// Clear the startapp parameter only after successful navigation
			setTimeout(() => {
				if (typeof window !== "undefined") {
					sessionStorage.removeItem("cofi_telegram_startapp_param");
					console.log(
						"[TelegramNavigation] Startapp parameter cleared after navigation to:",
						targetPath,
					);
				}
			}, 100);
			navigate(targetPath);
			return true;

		case "add_expense":
			targetPath = "/expenses/add";
			console.log(
				"[TelegramNavigation] Navigating to add expense:",
				targetPath,
			);
			// If we have pre-filled data, we could store it in sessionStorage
			// and have the ExpenseEdit component read it
			if (parsed.data) {
				sessionStorage.setItem(
					"telegram_expense_data",
					JSON.stringify(parsed.data),
				);
			}
			// Clear the startapp parameter only after successful navigation
			setTimeout(() => {
				if (typeof window !== "undefined") {
					sessionStorage.removeItem("cofi_telegram_startapp_param");
					console.log(
						"[TelegramNavigation] Startapp parameter cleared after navigation to:",
						targetPath,
					);
				}
			}, 100);
			navigate(targetPath);
			return true;
	}

	console.log(
		"[TelegramNavigation] No matching action found for:",
		parsed.action,
	);
	return false;
};

export const getTelegramExpenseData = (): Record<string, unknown> | null => {
	const data = sessionStorage.getItem("telegram_expense_data");
	if (data) {
		sessionStorage.removeItem("telegram_expense_data");
		return JSON.parse(data) as Record<string, unknown>;
	}
	return null;
};

// Telegram WebApp helper functions
export const notifyTelegramWebApp = (
	event: string,
	data?: Record<string, unknown>,
) => {
	if (typeof window !== "undefined" && window.Telegram?.WebApp) {
		// biome-ignore lint/suspicious/noExplicitAny: Telegram WebApp types are incomplete, need to access showAlert method
		const webApp = window.Telegram.WebApp as any;
		switch (event) {
			case "expense_created":
				if (webApp.showAlert) {
					webApp.showAlert("Expense created successfully!");
				}
				break;
			case "expense_updated":
				if (webApp.showAlert) {
					webApp.showAlert(
						(data?.message as string) || "Expense updated successfully!",
					);
				}
				break;
			case "expense_deleted":
				if (webApp.showAlert) {
					webApp.showAlert("Expense deleted successfully!");
				}
				break;
			default:
				if (data?.message && webApp.showAlert) {
					webApp.showAlert(data.message as string);
				}
		}
	}
};

// Close the Telegram WebApp
export const closeTelegramWebApp = () => {
	if (typeof window !== "undefined" && window.Telegram?.WebApp) {
		// biome-ignore lint/suspicious/noExplicitAny: Telegram WebApp types are incomplete, need to access close method
		const webApp = window.Telegram.WebApp as any;
		if (webApp.close) {
			webApp.close();
		}
	}
};

// Show expense saved notification and close WebApp
export const notifyExpenseSavedAndClose = (expenseData: {
	totalAmount: number;
	itemsCount: number;
	status: string;
	user?: User | null; // User data for currency formatting
}) => {
	console.log("[notifyExpenseSavedAndClose] Called with:", expenseData);
	if (typeof window !== "undefined" && window.Telegram?.WebApp) {
		// biome-ignore lint/suspicious/noExplicitAny: Telegram WebApp types are incomplete, need to access showAlert/close methods
		const webApp = window.Telegram.WebApp as any;

		// Import currency service dynamically to avoid circular dependencies
		import("../services/currency")
			.then(({ currencyService }) => {
				const formattedAmount = currencyService.formatCurrency(
					expenseData.totalAmount,
					expenseData.user,
				);

				// Create appropriate message based on status
				let message: string;
				if (expenseData.status === "approved") {
					message = `✅ Expense approved and saved to database!\n\n💰 Total: ${formattedAmount}\n📝 Items: ${expenseData.itemsCount}\n📊 Status: Approved`;
				} else {
					message = `✅ Expense ${expenseData.status} successfully!\n\n💰 Total: ${formattedAmount}\n📝 Items: ${expenseData.itemsCount}\n📊 Status: ${expenseData.status}`;
				}

				console.log(
					"[notifyExpenseSavedAndClose] Sending data to bot:",
					message,
				);

				// Since sendData() doesn't work with InlineKeyboardButton-launched WebApps,
				// we'll use Backend → Bot communication instead
				console.log(
					"[notifyExpenseSavedAndClose] Using Backend → Bot communication",
				);

				// Send the message to the bot via backend API
				if (expenseData.user?.telegramId) {
					console.log(
						"[notifyExpenseSavedAndClose] Sending message via backend API to chat:",
						expenseData.user.telegramId,
					);

					// Use the same API endpoint we use in Profile page
					fetch(`${import.meta.env.VITE_API_URL}/api/v1/notify/test-message`, {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
						},
						body: JSON.stringify({
							chat_id: expenseData.user.telegramId,
							message: message,
						}),
					})
						.then((response) => {
							if (response.ok) {
								console.log(
									"[notifyExpenseSavedAndClose] ✅ Message sent to bot via backend",
								);
							} else {
								console.error(
									"[notifyExpenseSavedAndClose] ❌ Failed to send message to bot:",
									response.status,
								);
							}
						})
						.catch((error) => {
							console.error(
								"[notifyExpenseSavedAndClose] ❌ Error sending message to bot:",
								error,
							);
						});
				} else {
					console.log(
						"[notifyExpenseSavedAndClose] No telegramId found for user",
					);
				}

				// Show alert and close WebApp
				if (webApp.showAlert) {
					console.log(
						"[notifyExpenseSavedAndClose] Showing alert and closing WebApp",
					);
					webApp.showAlert(message, () => {
						console.log(
							"[notifyExpenseSavedAndClose] Alert acknowledged, closing WebApp",
						);
						// Close the WebApp after user acknowledges the message
						if (webApp.close) {
							console.log("[notifyExpenseSavedAndClose] Closing WebApp...");
							webApp.close();
						}
					});
				} else {
					console.log(
						"[notifyExpenseSavedAndClose] showAlert not available, trying direct close",
					);
					// If showAlert is not available, try direct close
					if (webApp.close) {
						console.log("[notifyExpenseSavedAndClose] Direct close WebApp...");
						webApp.close();
					}
				}
			})
			.catch((error) => {
				console.error(
					"[notifyExpenseSavedAndClose] Failed to import currency service:",
					error,
				);
				// Fallback without currency formatting
				const message = `✅ Expense ${expenseData.status} successfully!\n\n💰 Total: $${expenseData.totalAmount.toFixed(2)}\n📝 Items: ${expenseData.itemsCount}\n📊 Status: ${expenseData.status}`;

				// Send the message to the bot via backend API
				if (expenseData.user?.telegramId) {
					console.log(
						"[notifyExpenseSavedAndClose] Sending fallback message via backend API to chat:",
						expenseData.user.telegramId,
					);

					fetch(`${import.meta.env.VITE_API_URL}/api/v1/notify/test-message`, {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
						},
						body: JSON.stringify({
							chat_id: expenseData.user.telegramId,
							message: message,
						}),
					})
						.then((response) => {
							if (response.ok) {
								console.log(
									"[notifyExpenseSavedAndClose] ✅ Fallback message sent to bot via backend",
								);
							} else {
								console.error(
									"[notifyExpenseSavedAndClose] ❌ Failed to send fallback message to bot:",
									response.status,
								);
							}
						})
						.catch((error) => {
							console.error(
								"[notifyExpenseSavedAndClose] ❌ Error sending fallback message to bot:",
								error,
							);
						});
				}

				if (webApp.showAlert) {
					webApp.showAlert(message, () => {
						if (webApp.close) {
							webApp.close();
						}
					});
				}
			});
	} else {
		console.log("[notifyExpenseSavedAndClose] Telegram WebApp not available");
	}
};

// Show cancellation message and close WebApp
export const notifyCancelAndClose = () => {
	console.log("[notifyCancelAndClose] Called");
	if (typeof window !== "undefined" && window.Telegram?.WebApp) {
		// biome-ignore lint/suspicious/noExplicitAny: Telegram WebApp types are incomplete, need to access showAlert/close methods
		const webApp = window.Telegram.WebApp as any;
		console.log(
			"[notifyCancelAndClose] Telegram WebApp available, showing alert",
		);
		if (webApp.showAlert) {
			webApp.showAlert("❌ Changes cancelled", () => {
				console.log(
					"[notifyCancelAndClose] Alert acknowledged, closing WebApp",
				);
				if (webApp.close) {
					webApp.close();
				}
			});
		} else {
			console.log("[notifyCancelAndClose] showAlert not available");
		}
	} else {
		console.log("[notifyCancelAndClose] Telegram WebApp not available");
	}
};
