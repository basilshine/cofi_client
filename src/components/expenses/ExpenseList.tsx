import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@components/ui/table';
import { expensesService, Expense } from '@services/api/expenses';

export const ExpenseList = () => {
  const { t } = useTranslation();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchExpenses = async () => {
      try {
        const data = await expensesService.getExpenses();
        setExpenses(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch expenses');
      } finally {
        setIsLoading(false);
      }
    };

    fetchExpenses();
  }, []);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('expenses.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading expenses...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('expenses.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-500">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('expenses.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('expenses.date')}</TableHead>
              <TableHead>{t('expenses.description')}</TableHead>
              <TableHead>{t('expenses.category')}</TableHead>
              <TableHead className="text-right">{t('expenses.amount')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center">
                  <p className="text-sm text-muted-foreground">
                    {t('expenses.noExpenses')}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              expenses.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell>{format(new Date(expense.date), 'MMM dd, yyyy')}</TableCell>
                  <TableCell>{expense.description}</TableCell>
                  <TableCell>{expense.category}</TableCell>
                  <TableCell className="text-right">
                    ${expense.amount.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}; 