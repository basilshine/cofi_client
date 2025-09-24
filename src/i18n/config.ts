import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
	en: {
		translation: {
			// Common
			"app.name": "Cofilance",
			"common.loading": "Loading...",
			"common.error": "Error",
			"common.language": "Language",
			"common.language.en": "English",
			"common.language.ru": "Russian",
			"common.loginRequired": "Please log in to access your financial data.",
			"common.goHome": "Go to Home",
			"common.actions": "Actions",
			"common.saving": "Saving...",
			"common.back": "Back",
			"common.delete": "Delete",

			// Navigation
			"nav.home": "Home",
			"nav.expenses": "Expenses",
			"nav.analytics": "Analytics",
			"nav.settings": "Settings",
			"nav.debug": "Debug",
			"nav.login": "Login",
			"nav.dashboard": "Dashboard",

			// Promo
			promo: "Promo",
			"promo.title": "Welcome to Cofilance",
			"promo.description": "Cofilance is a platform for managing your finances",
			"promo.features.1.title": "Easy to use",
			"promo.features.1.description": "Cofilance is easy to use and navigate",
			"promo.features.2.title": "Secure",
			"promo.features.2.description":
				"Cofilance is secure and your data is protected",
			"promo.features.3.title": "Free",
			"promo.features.3.description": "Cofilance is free to use",
			"promo.features.4.title": "Fast",
			"promo.features.4.description": "Cofilance is fast and responsive",
			"promo.features.5.title": "Reliable",
			"promo.features.5.description":
				"Cofilance is reliable and your data is safe",
			"promo.return": "Return to the main page",
			"promo.cta.dashboard": "Go to Dashboard",
			"promo.cta.login": "Login",
			"promo.cta.telegram": "Login with Telegram",

			// Expenses
			"expenses.title": "Recent Expenses",
			"expenses.date": "Date",
			"expenses.description": "Description",
			"expenses.expenseDescription": "Expense description (optional)",
			"expenses.category": "Category",
			"expenses.amount": "Amount",
			"expenses.total": "Total",
			"expenses.monthlyAverage": "Monthly Average",
			"expenses.noExpenses": "No expenses",
			"expenses.addExpense": "Add Expense",
			"expenses.createSchedules": "Create Schedules",
			"expenses.createSchedulesDescription":
				"Create schedules to automatically track recurring payments like rent, subscriptions, etc.",
			"expenses.recentExpenses": "Recent Expenses",
			"expenses.monthlySummary": "Monthly Summary",
			"expenses.mostUsedCategories": "Most Used Categories",
			"expenses.noCategories": "No categories found",
			"expenses.items": "Items",
			"expenses.addItem": "Add Item",
			"expenses.item": "Item",
			"expenses.itemName": "Item Name",
			"expenses.itemNamePlaceholder": "What did you buy?",
			"expenses.totalItems": "Total Items",
			"expenses.moreItems": "more items",
			"expenses.status": "Status",
			"expenses.noDescription": "No description",
			"expenses.confirmDelete":
				"Are you sure you want to delete '{{description}}'?",
			"expenses.selectCategory": "Select category",
			"expenses.categories.food": "Food & Dining",
			"expenses.categories.transport": "Transportation",
			"expenses.categories.entertainment": "Entertainment",
			"expenses.categories.utilities": "Bills & Utilities",
			"expenses.categories.shopping": "Shopping",
			"expenses.categories.other": "Other",

			// Analytics
			"analytics.title": "Analytics",
			"analytics.description":
				"Track your spending patterns and financial insights",
			"analytics.spending_trends": "Spending Trends",
			"analytics.spending_trends_desc":
				"Visualize your spending patterns over time",
			"analytics.category_breakdown": "Category Breakdown",
			"analytics.category_breakdown_desc":
				"See how your expenses are distributed across categories",
			"analytics.budget_analysis": "Budget Analysis",
			"analytics.budget_analysis_desc":
				"Compare your spending against budget limits",
			"analytics.totalTransactions": "Total Transactions",
			"analytics.averageExpense": "Average Expense",
			"analytics.topCategory": "Top Category",
			"analytics.transactions": "transactions",
			"analytics.noData": "No data available",
			"analytics.noCategories": "No categories found",
			"analytics.andMore": "and {{count}} more...",

			// New Analytics translations
			"analytics.totalSpent": "Total Spent",
			"analytics.dailyAverage": "Daily Average",
			"analytics.topCategories": "Top Categories",
			"analytics.spendingMood": "Spending Mood",
			"analytics.insightsAndTips": "Insights & Tips",
			"analytics.quickActions": "Quick Actions",
			"analytics.viewExpenses": "View Expenses",
			"analytics.addExpense": "Add Expense",
			"analytics.noAnalyticsData": "No Analytics Data Available",
			"analytics.startTracking":
				"Start tracking expenses to see your analytics and insights",
			"analytics.errorLoading": "Error loading analytics data",
			"analytics.tryAgain": "Try Again",
			"analytics.thisWeek": "This Week",
			"analytics.thisMonth": "This Month",
			"analytics.vsLast": "vs last",
			"analytics.max": "Max",
			"analytics.positive": "Positive",
			"analytics.neutral": "Neutral",
			"analytics.negative": "Negative",
			"analytics.regretfulSpending": "Regretful spending",
			"analytics.mostCommonFeeling": "Most common feeling",
			"analytics.items": "items",

			// Auth
			"auth.login": "Login",
			"auth.register": "Register",
			"auth.forgotPassword": "Forgot Password?",
			"auth.loginWithTelegram": "Login with Telegram",
			"auth.noAccount": "Don't have an account?",
			"auth.login.title": "Login to Your Account",
			"auth.login.description": "Enter your details to login",
			"auth.requestNewReset": "Request a new reset",
			"auth.backToLogin": "Back to Login",
			"auth.checkEmail": "Check your email for a reset link",
			"auth.resetPassword": "Reset Password",
			"auth.password": "Password",
			"auth.confirmPassword": "Confirm Password",
			"auth.login.submit": "Login",
			"auth.haveAccount": "Already have an account?",
			"auth.email": "Email",
			"auth.forgotPassword.title": "Forgot Password?",
			"auth.forgotPassword.description":
				"Enter your email to reset your password",
			"auth.forgotPassword.submit": "Reset Password",
			"auth.login.invalidCredentials": "Invalid credentials",
			"auth.register.title": "Create an Account",
			"auth.register.description": "Sign up to get started",
			"auth.register.submit": "Create Account",
			"auth.register.firstName": "First Name",
			"auth.register.lastName": "Last Name",
			"auth.register.email": "Email",
			"auth.register.password": "Password",
			"auth.register.confirmPassword": "Confirm Password",
		},
	},
	ru: {
		translation: {
			// Common
			"app.name": "Cofilance",
			"common.loading": "Загрузка...",
			"common.error": "Ошибка",
			"common.language": "Язык",
			"common.language.en": "Английский",
			"common.language.ru": "Русский",
			"common.loginRequired":
				"Пожалуйста, войдите в систему, чтобы получить доступ к финансовым данным.",
			"common.goHome": "Перейти на главную",
			"common.actions": "Действия",
			"common.saving": "Сохранение...",
			"common.back": "Назад",
			"common.delete": "Удалить",

			// Navigation
			"nav.home": "Главная",
			"nav.expenses": "Расходы",
			"nav.analytics": "Аналитика",
			"nav.settings": "Настройки",
			"nav.debug": "Отладка",
			"nav.dashboard": "Панель управления",

			// Expenses
			"expenses.title": "Последние расходы",
			"expenses.date": "Дата",
			"expenses.description": "Описание",
			"expenses.expenseDescription": "Описание расхода (необязательно)",
			"expenses.category": "Категория",
			"expenses.amount": "Сумма",
			"expenses.total": "Всего",
			"expenses.monthlyAverage": "Среднемесячные",
			"expenses.noExpenses": "Нет расходов",
			"expenses.addExpense": "Добавить расход",
			"expenses.createSchedules": "Создать расписания",
			"expenses.createSchedulesDescription":
				"Создайте расписания для автоматического отслеживания регулярных платежей, таких как аренда, подписки и т.д.",
			"expenses.recentExpenses": "Последние расходы",
			"expenses.monthlySummary": "Месячный итог",
			"expenses.mostUsedCategories": "Часто используемые категории",
			"expenses.noCategories": "Категории не найдены",
			"expenses.items": "Позиции",
			"expenses.addItem": "Добавить позицию",
			"expenses.item": "Позиция",
			"expenses.itemName": "Название позиции",
			"expenses.itemNamePlaceholder": "Что вы купили?",
			"expenses.totalItems": "Всего позиций",
			"expenses.moreItems": "еще позиций",
			"expenses.status": "Статус",
			"expenses.noDescription": "Без описания",
			"expenses.confirmDelete":
				"Вы уверены, что хотите удалить '{{description}}'?",
			"expenses.selectCategory": "Выберите категорию",
			"expenses.categories.food": "Еда и рестораны",
			"expenses.categories.transport": "Транспорт",
			"expenses.categories.entertainment": "Развлечения",
			"expenses.categories.utilities": "Коммунальные услуги",
			"expenses.categories.shopping": "Покупки",
			"expenses.categories.other": "Прочее",

			// Analytics
			"analytics.title": "Аналитика",
			"analytics.description":
				"Отслеживайте свои расходы и финансовые показатели",
			"analytics.spending_trends": "Тренды расходов",
			"analytics.spending_trends_desc":
				"Визуализируйте свои расходы во времени",
			"analytics.category_breakdown": "Распределение по категориям",
			"analytics.category_breakdown_desc":
				"Смотрите, как распределяются ваши расходы по категориям",
			"analytics.budget_analysis": "Анализ бюджета",
			"analytics.budget_analysis_desc":
				"Сравните свои расходы с бюджетными лимитами",
			"analytics.totalTransactions": "Всего транзакций",
			"analytics.averageExpense": "Средний расход",
			"analytics.topCategory": "Топ категория",
			"analytics.transactions": "транзакций",
			"analytics.noData": "Нет данных",
			"analytics.noCategories": "Категории не найдены",
			"analytics.andMore": "и еще {{count}}...",

			// New Analytics translations
			"analytics.totalSpent": "Всего потрачено",
			"analytics.dailyAverage": "Средний в день",
			"analytics.topCategories": "Топ категории",
			"analytics.spendingMood": "Настроение трат",
			"analytics.insightsAndTips": "Аналитика и советы",
			"analytics.quickActions": "Быстрые действия",
			"analytics.viewExpenses": "Посмотреть расходы",
			"analytics.addExpense": "Добавить расход",
			"analytics.noAnalyticsData": "Нет данных для аналитики",
			"analytics.startTracking":
				"Начните отслеживать расходы, чтобы увидеть аналитику и советы",
			"analytics.errorLoading": "Ошибка загрузки аналитики",
			"analytics.tryAgain": "Попробовать снова",
			"analytics.thisWeek": "На этой неделе",
			"analytics.thisMonth": "В этом месяце",
			"analytics.vsLast": "по сравнению с прошлым",
			"analytics.max": "Макс",
			"analytics.positive": "Позитивные",
			"analytics.neutral": "Нейтральные",
			"analytics.negative": "Негативные",
			"analytics.regretfulSpending": "Сожаления о тратах",
			"analytics.mostCommonFeeling": "Самое частое чувство",
			"analytics.items": "позиций",

			// Auth
			"auth.login": "Вход",
			"auth.register": "Регистрация",
			"auth.forgotPassword": "Забыли пароль?",
			"auth.loginWithTelegram": "Войти через Telegram",
			"auth.noAccount": "Нет аккаунта?",
			"auth.login.title": "Войти в аккаунт",
			"auth.login.description": "Введите данные для входа",
			"auth.requestNewReset": "Запросить новый сброс",
			"auth.backToLogin": "Вернуться к входу",
			"auth.checkEmail": "Проверьте email для сброса пароля",
			"auth.resetPassword": "Сбросить пароль",
			"auth.password": "Пароль",
			"auth.confirmPassword": "Подтвердите пароль",
			"auth.login.submit": "Войти",
			"auth.haveAccount": "Уже есть аккаунт?",
			"auth.email": "Email",
			"auth.forgotPassword.title": "Забыли пароль?",
			"auth.forgotPassword.description": "Введите email для сброса пароля",
			"auth.forgotPassword.submit": "Сбросить пароль",
			"auth.login.invalidCredentials": "Неверные данные",
			"auth.register.title": "Создать аккаунт",
			"auth.register.description": "Зарегистрируйтесь для начала",
			"auth.register.submit": "Создать аккаунт",
			"auth.register.firstName": "Имя",
			"auth.register.lastName": "Фамилия",
			"auth.register.email": "Email",
			"auth.register.password": "Пароль",
			"auth.register.confirmPassword": "Подтвердите пароль",
		},
	},
};

// Get browser language and normalize it
const getBrowserLanguage = () => {
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	const browserLang = navigator.language || (navigator as any).userLanguage;
	return browserLang.toLowerCase().split("-")[0];
};

// Get user language from localStorage or browser
const getUserLanguage = () => {
	// Try to get from localStorage first (set by auth context)
	const storedLang = localStorage.getItem("userLanguage");
	if (storedLang && ["en", "ru"].includes(storedLang)) {
		return storedLang;
	}

	// Fallback to browser language
	const browserLang = getBrowserLanguage();
	if (["en", "ru"].includes(browserLang)) {
		return browserLang;
	}

	// Final fallback
	return "en";
};

// Initialize i18n with user language
i18n.use(initReactI18next).init({
	resources,
	lng: getUserLanguage(),
	fallbackLng: "en",
	supportedLngs: ["en", "ru"],
	interpolation: {
		escapeValue: false,
	},
});

// Function to change language dynamically
export const changeLanguage = (language: string) => {
	if (["en", "ru"].includes(language)) {
		i18n.changeLanguage(language);
		localStorage.setItem("userLanguage", language);
	}
};

export default i18n;
