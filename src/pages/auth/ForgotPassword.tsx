import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@contexts/AuthContext';
import { AuthForm } from '@components/auth/AuthForm';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';

export const ForgotPassword = () => {
  const { t } = useTranslation();
  const { requestPasswordReset, isLoading, error } = useAuth();
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await requestPasswordReset(email);
    setIsSubmitted(true);
  };

  if (isSubmitted) {
    return (
      <AuthForm
        title={t('auth.forgotPassword.title')}
        description={t('auth.forgotPassword.success')}
        onSubmit={() => {}}
        submitText=""
        isLoading={false}
      >
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            {t('auth.forgotPassword.checkEmail')}
          </p>
          <Link
            to="/auth/login"
            className="mt-4 inline-block text-sm text-primary hover:underline"
          >
            {t('auth.backToLogin')}
          </Link>
        </div>
      </AuthForm>
    );
  }

  return (
    <AuthForm
      title={t('auth.forgotPassword.title')}
      description={t('auth.forgotPassword.description')}
      onSubmit={handleSubmit}
      submitText={t('auth.forgotPassword.submit')}
      isLoading={isLoading}
      error={error}
    >
      <div className="space-y-2">
        <Label htmlFor="email">{t('auth.email')}</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="text-sm text-center">
        <Link to="/auth/login" className="text-primary hover:underline">
          {t('auth.backToLogin')}
        </Link>
      </div>
    </AuthForm>
  );
}; 