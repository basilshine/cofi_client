import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      // Common
      'app.name': 'Cofilance',
      'common.loading': 'Loading...',
      'common.error': 'Error',
      'common.language': 'Language',
      'common.language.en': 'English',
      'common.language.ru': 'Russian',
      
      // Navigation
      'nav.home': 'Home',
      'nav.expenses': 'Expenses',
      'nav.analytics': 'Analytics',
      'nav.settings': 'Settings',
      
      // Expenses
      'expenses.title': 'Recent Expenses',
      'expenses.date': 'Date',
      'expenses.description': 'Description',
      'expenses.category': 'Category',
      'expenses.amount': 'Amount',
      
      // Analytics
      'analytics.title': 'Analytics',
      'analytics.description': 'Track your spending patterns and financial insights',
      'analytics.spending_trends': 'Spending Trends',
      'analytics.spending_trends_desc': 'Visualize your spending patterns over time',
      'analytics.category_breakdown': 'Category Breakdown',
      'analytics.category_breakdown_desc': 'See how your expenses are distributed across categories',
      'analytics.budget_analysis': 'Budget Analysis',
      'analytics.budget_analysis_desc': 'Compare your spending against budget limits',
    }
  },
  ru: {
    translation: {
      // Common
      'app.name': 'Cofilance',
      'common.loading': 'Загрузка...',
      'common.error': 'Ошибка',
      'common.language': 'Язык',
      'common.language.en': 'Английский',
      'common.language.ru': 'Русский',
      
      // Navigation
      'nav.home': 'Главная',
      'nav.expenses': 'Расходы',
      'nav.analytics': 'Аналитика',
      'nav.settings': 'Настройки',
      
      // Expenses
      'expenses.title': 'Последние расходы',
      'expenses.date': 'Дата',
      'expenses.description': 'Описание',
      'expenses.category': 'Категория',
      'expenses.amount': 'Сумма',
      
      // Analytics
      'analytics.title': 'Аналитика',
      'analytics.description': 'Отслеживайте свои расходы и финансовые показатели',
      'analytics.spending_trends': 'Тренды расходов',
      'analytics.spending_trends_desc': 'Визуализируйте свои расходы во времени',
      'analytics.category_breakdown': 'Распределение по категориям',
      'analytics.category_breakdown_desc': 'Смотрите, как распределяются ваши расходы по категориям',
      'analytics.budget_analysis': 'Анализ бюджета',
      'analytics.budget_analysis_desc': 'Сравните свои расходы с бюджетными лимитами',
    }
  }
};

// Get browser language and normalize it
const getBrowserLanguage = () => {
  const browserLang = navigator.language || (navigator as any).userLanguage;
  return browserLang.toLowerCase().split('-')[0];
};

// Initialize i18n with browser language
i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: getBrowserLanguage(),
    fallbackLng: 'en',
    supportedLngs: ['en', 'ru'],
    interpolation: {
      escapeValue: false
    }
  });

export default i18n; 