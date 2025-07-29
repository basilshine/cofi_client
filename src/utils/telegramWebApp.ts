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
	if (typeof window !== "undefined" && window.Telegram?.WebApp) {
		const tgWebApp = window.Telegram.WebApp;
		return {
			initData: tgWebApp.initData || "",
			initDataUnsafe: tgWebApp.initDataUnsafe || {},
			startParam: (tgWebApp.initDataUnsafe as Record<string, unknown>)
				?.start_param as string,
		};
	}
	return null;
};

export const parseStartParam = (
	startParam: string,
): ParsedStartParam | null => {
	if (!startParam) return null;

	// Parse different parameter formats:
	// edit_expense_123 - edit expense with ID 123
	// view_analytics - go to analytics page
	// add_expense_food_25.50 - add expense for food category with amount 25.50

	const editExpenseMatch = startParam.match(/^edit_expense_(\d+)$/);
	if (editExpenseMatch) {
		return {
			action: "edit_expense",
			expenseId: editExpenseMatch[1],
		};
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
	const webAppData = getTelegramWebAppData();

	if (!webAppData?.startParam) {
		return false;
	}

	const parsed = parseStartParam(webAppData.startParam);

	if (!parsed) {
		return false;
	}

	switch (parsed.action) {
		case "edit_expense":
			if (parsed.expenseId) {
				navigate(`/expenses/${parsed.expenseId}/edit`);
				return true;
			}
			break;

		case "view_analytics":
			navigate("/dashboard/analytics");
			return true;

		case "add_expense":
			navigate("/expenses");
			// If we have pre-filled data, we could store it in sessionStorage
			// and have the AddExpenseForm component read it
			if (parsed.data) {
				sessionStorage.setItem(
					"telegram_expense_data",
					JSON.stringify(parsed.data),
				);
			}
			return true;
	}

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
}) => {
	if (typeof window !== "undefined" && window.Telegram?.WebApp) {
		// biome-ignore lint/suspicious/noExplicitAny: Telegram WebApp types are incomplete, need to access showAlert/close methods
		const webApp = window.Telegram.WebApp as any;
		const message = `✅ Expense saved successfully!\n\n💰 Total: $${expenseData.totalAmount.toFixed(2)}\n📝 Items: ${expenseData.itemsCount}\n📊 Status: ${expenseData.status}`;

		if (webApp.showAlert) {
			webApp.showAlert(message, () => {
				// Close the WebApp after user acknowledges the message
				if (webApp.close) {
					webApp.close();
				}
			});
		}
	}
};

// Show cancellation message and close WebApp
export const notifyCancelAndClose = () => {
	if (typeof window !== "undefined" && window.Telegram?.WebApp) {
		// biome-ignore lint/suspicious/noExplicitAny: Telegram WebApp types are incomplete, need to access showAlert/close methods
		const webApp = window.Telegram.WebApp as any;
		if (webApp.showAlert) {
			webApp.showAlert("❌ Changes cancelled", () => {
				if (webApp.close) {
					webApp.close();
				}
			});
		}
	}
};
