import { useEffect, useState } from 'react';
import { Plus } from '@phosphor-icons/react';
import { Button } from '@components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@components/ui/dialog';
import { ExpenseList } from '@components/expenses/ExpenseList';
import { AddExpenseForm } from '@components/expenses/AddExpenseForm';
import { expensesService, ExpenseSummary, MostUsedCategories } from '@services/api/expenses';
import { useTranslation } from 'react-i18next';

export const Expenses = () => {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [categories, setCategories] = useState<MostUsedCategories[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const fetchData = async () => {
    try {
      const [summaryData, categoriesData] = await Promise.all([
        expensesService.getSummary(),
        expensesService.getMostUsedCategories(),
      ]);
      setSummary(summaryData);
      setCategories(categoriesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleExpenseAdded = () => {
    setIsDialogOpen(false);
    fetchData(); // Refresh the data
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">{t('expenses.title')}</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {t('expenses.addExpense')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('expenses.addExpense')}</DialogTitle>
            </DialogHeader>
            <AddExpenseForm onExpenseAdded={handleExpenseAdded} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>{t('expenses.recentExpenses')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ExpenseList />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('expenses.monthlySummary')}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
            ) : error ? (
              <p className="text-sm text-red-500">{error}</p>
            ) : summary ? (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">{t('expenses.total')}</span>
                  <span className="font-medium">${summary.total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">{t('expenses.monthlyAverage')}</span>
                  <span className="font-medium">${summary.monthlyAverage.toFixed(2)}</span>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('expenses.mostUsedCategories')}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
            ) : error ? (
              <p className="text-sm text-red-500">{error}</p>
            ) : categories.length > 0 ? (
              <div className="space-y-2">
                {categories.map((category) => (
                  <div key={category.category} className="flex justify-between">
                    <span className="text-sm text-muted-foreground">{category.category}</span>
                    <span className="font-medium">{category.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('expenses.noCategories')}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}; 