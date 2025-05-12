import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@contexts/AuthContext';
import { AuthForm } from '@components/auth/AuthForm';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Button } from '@components/ui/button';
import { Separator } from '@components/ui/separator';

export const Login = () => {
	const { t } = useTranslation();
	const { login, isLoading, error, isWebApp, handleTelegramAuth } = useAuth();
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		await login(email, password);
	};

	return (
		<AuthForm
			title={t('auth.login.title')}
			description={t('auth.login.description')}
			onSubmit={handleSubmit}
			submitText={t('auth.login.submit')}
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
			<div className="space-y-2">
				<Label htmlFor="password">{t('auth.password')}</Label>
				<Input
					id="password"
					type="password"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					required
				/>
			</div>
			<div className="text-sm text-right">
				<Link
					to="/auth/forgot-password"
					className="text-primary hover:underline"
				>
					{t('auth.forgotPassword')}
				</Link>
			</div>
			<Separator className="my-4" />
			<Button
				type="button"
				variant="outline"
				className="w-full"
				onClick={handleTelegramAuth}
			>
				{t('auth.loginWithTelegram')}
			</Button>
			<div className="text-sm text-center">
				{t('auth.noAccount')}{' '}
				<Link to="/auth/register" className="text-primary hover:underline">
					{t('auth.register')}
				</Link>
			</div>
		</AuthForm>
	);
};
