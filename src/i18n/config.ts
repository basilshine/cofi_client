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

			// Navigation
			"nav.home": "Home",
			"nav.expenses": "Expenses",
			"nav.analytics": "Analytics",
			"nav.settings": "Settings",
			"nav.debug": "Debug",
			"nav.login": "Login",

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
			"expenses.category": "Category",
			"expenses.amount": "Amount",
			"expenses.total": "Total",
			"expenses.monthlyAverage": "Monthly Average",

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

			// Navigation
			"nav.home": "Главная",
			"nav.expenses": "Расходы",
			"nav.analytics": "Аналитика",
			"nav.settings": "Настройки",
			"nav.debug": "Отладка",

			// Expenses
			"expenses.title": "Последние расходы",
			"expenses.date": "Дата",
			"expenses.description": "Описание",
			"expenses.category": "Категория",
			"expenses.amount": "Сумма",
			"expenses.total": "Всего",
			"expenses.monthlyAverage": "Среднемесячные",

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

// Initialize i18n with browser language
i18n.use(initReactI18next).init({
	resources,
	lng: getBrowserLanguage(),
	fallbackLng: "en",
	supportedLngs: ["en", "ru"],
	interpolation: {
		escapeValue: false,
	},
});

export default i18n;
