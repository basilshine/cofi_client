export interface Expense {
  id: string;
  amount: number;
  category: string;
  description: string;
  date: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
}

export interface MonthlySummary {
  month: string;
  total: number;
  categories: {
    [key: string]: number;
  };
}

export interface AnalyticsData {
  monthly: MonthlySummary[];
  categories: {
    name: string;
    total: number;
    percentage: number;
  }[];
  trends: {
    date: string;
    total: number;
  }[];
}

export interface AuthResponse {
  user: {
    id: string;
    name: string;
    email: string;
  };
  token: string;
} 