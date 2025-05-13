import { Button } from "@components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@components/ui/card";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

interface AuthFormProps {
	title: string;
	description: string;
	children: ReactNode;
	onSubmit: (e: React.FormEvent) => void;
	submitText: string;
	isLoading?: boolean;
	error?: string | null;
}

export const AuthForm = ({
	title,
	description,
	children,
	onSubmit,
	submitText,
	isLoading = false,
	error = null,
}: AuthFormProps) => {
	const { t } = useTranslation();

	return (
		<div className="flex min-h-screen items-center justify-center p-4">
			<Card className="w-full max-w-md">
				<CardHeader className="space-y-1">
					<CardTitle className="text-2xl font-bold">{title}</CardTitle>
					<CardDescription>{description}</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={onSubmit} className="space-y-4">
						{children}
						{error && <div className="text-sm text-red-500">{error}</div>}
						<Button type="submit" className="w-full" disabled={isLoading}>
							{isLoading ? t("common.loading") : submitText}
						</Button>
					</form>
					<div className="flex justify-center">
						<Button variant="link" asChild>
							<Link to="/">{t("promo.return")}</Link>
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
};
