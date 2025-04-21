import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@contexts/AuthContext';
import { AuthForm } from '@components/auth/AuthForm';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';

export const Register = () => {
  const { t } = useTranslation();
  const { register, isLoading, error } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      return;
    }
    await register(
      formData.email,
      formData.password,
      formData.firstName,
      formData.lastName
    );
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <AuthForm
      title={t('auth.register.title')}
      description={t('auth.register.description')}
      onSubmit={handleSubmit}
      submitText={t('auth.register.submit')}
      isLoading={isLoading}
      error={error}
    >
      <div className="space-y-2">
        <Label htmlFor="email">{t('auth.register.email')}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="firstName">{t('auth.register.firstName')}</Label>
        <Input
          id="firstName"
          name="firstName"
          value={formData.firstName}
          onChange={handleChange}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="lastName">{t('auth.register.lastName')}</Label>
        <Input
          id="lastName"
          name="lastName"
          value={formData.lastName}
          onChange={handleChange}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">{t('auth.register.password')}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          value={formData.password}
          onChange={handleChange}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">{t('auth.register.confirmPassword')}</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          value={formData.confirmPassword}
          onChange={handleChange}
          required
        />
      </div>
      <div className="text-sm text-center">
        {t('auth.haveAccount')}{' '}
        <Link to="/auth/login" className="text-primary hover:underline">
          {t('auth.login')}
        </Link>
      </div>
    </AuthForm>
  );
}; 