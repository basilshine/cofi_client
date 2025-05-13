import { AuthForm } from "@components/auth/AuthForm";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { useAuth } from "@contexts/AuthContext";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";

export const ResetPassword = () => {
	const { t } = useTranslation();
	const { resetPassword, isLoading, error } = useAuth();
	const [searchParams] = useSearchParams();
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [isSubmitted, setIsSubmitted] = useState(false);

	const token = searchParams.get("token");

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!token || password !== confirmPassword) {
			return;
		}
		await resetPassword(token, password);
		setIsSubmitted(true);
	};

	if (!token) {
		return (
			<AuthForm
				title={t("auth.resetPassword.title")}
				description={t("auth.resetPassword.invalidToken")}
				onSubmit={() => {}}
				submitText=""
				isLoading={false}
			>
				<div className="text-center">
					<Link
						to="/auth/forgot-password"
						className="text-sm text-primary hover:underline"
					>
						{t("auth.requestNewReset")}
					</Link>
				</div>
			</AuthForm>
		);
	}

	if (isSubmitted) {
		return (
			<AuthForm
				title={t("auth.resetPassword.title")}
				description={t("auth.resetPassword.success")}
				onSubmit={() => {}}
				submitText=""
				isLoading={false}
			>
				<div className="text-center">
					<Link
						to="/auth/login"
						className="text-sm text-primary hover:underline"
					>
						{t("auth.backToLogin")}
					</Link>
				</div>
			</AuthForm>
		);
	}

	return (
		<AuthForm
			title={t("auth.resetPassword.title")}
			description={t("auth.resetPassword.description")}
			onSubmit={handleSubmit}
			submitText={t("auth.resetPassword.submit")}
			isLoading={isLoading}
			error={error}
		>
			<div className="space-y-2">
				<Label htmlFor="password">{t("auth.newPassword")}</Label>
				<Input
					id="password"
					type="password"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					required
				/>
			</div>
			<div className="space-y-2">
				<Label htmlFor="confirmPassword">{t("auth.confirmPassword")}</Label>
				<Input
					id="confirmPassword"
					type="password"
					value={confirmPassword}
					onChange={(e) => setConfirmPassword(e.target.value)}
					required
				/>
			</div>
		</AuthForm>
	);
};
