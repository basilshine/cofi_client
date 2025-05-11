import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@components/ui/select';
import { expensesService } from '@services/api/expenses';

interface AddExpenseFormProps {
  onExpenseAdded: () => void;
}

export const AddExpenseForm = ({ onExpenseAdded }: AddExpenseFormProps) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    category: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await expensesService.createExpense({
        amount: parseFloat(formData.amount),
        description: formData.description,
        category: formData.category,
        date: new Date().toISOString(),
      });
      // Reset form
      setFormData({
        amount: '',
        description: '',
        category: '',
      });
      onExpenseAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create expense');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
      <div className="space-y-2">
        <Label htmlFor="amount">{t('expenses.amount')}</Label>
        <Input
          id="amount"
          name="amount"
          type="number"
          step="0.01"
          value={formData.amount}
          onChange={handleChange}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">{t('expenses.description')}</Label>
        <Input
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="category">{t('expenses.category')}</Label>
        <Select
          value={formData.category}
          onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
        >
          <SelectTrigger>
            <SelectValue placeholder={t('expenses.selectCategory')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="food">{t('expenses.categories.food')}</SelectItem>
            <SelectItem value="transport">{t('expenses.categories.transport')}</SelectItem>
            <SelectItem value="entertainment">{t('expenses.categories.entertainment')}</SelectItem>
            <SelectItem value="utilities">{t('expenses.categories.utilities')}</SelectItem>
            <SelectItem value="shopping">{t('expenses.categories.shopping')}</SelectItem>
            <SelectItem value="other">{t('expenses.categories.other')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? t('common.saving') : t('expenses.addExpense')}
      </Button>
    </form>
  );
}; 