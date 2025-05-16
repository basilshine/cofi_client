import { Button } from "@components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@components/ui/dropdown-menu";
import { useAuth } from "@contexts/AuthContext";
import { Globe } from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

export const Promo = () => {
	const { t, i18n } = useTranslation();
	const { isAuthenticated } = useAuth();
	const languages = [
		{ code: "en", label: t("common.language.en") },
		{ code: "ru", label: t("common.language.ru") },
	];

	return (
		<div className="min-h-screen bg-background">
			<header className="border-b bg-card">
				<div className="container mx-auto flex h-16 items-center justify-between px-4">
					<h1 className="text-xl font-semibold">{t("app.name")}</h1>
					<div className="flex items-center space-x-2">
						{isAuthenticated ? (
							<Button asChild>
								<Link to="/dashboard">{t("nav.dashboard")}</Link>
							</Button>
						) : (
							<Button asChild>
								<Link to="/auth/login">{t("nav.login")}</Link>
							</Button>
						)}

						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="ghost" size="icon">
									<Globe className="h-5 w-5" />
									<span className="sr-only">{t("common.language")}</span>
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								{languages.map((lang) => (
									<DropdownMenuItem
										key={lang.code}
										onClick={() => i18n.changeLanguage(lang.code)}
										className={i18n.language === lang.code ? "bg-accent" : ""}
									>
										{lang.label}
									</DropdownMenuItem>
								))}
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>
			</header>

			<main className="container mx-auto px-4 py-8">
				<section className="mb-16 text-center">
					<h2 className="mb-4 text-4xl font-bold">{t("promo.title")}</h2>
					<p className="mx-auto max-w-2xl text-lg text-muted-foreground">
						{t("promo.description")}
					</p>
				</section>

				<section className="mb-16">
					<div className="grid gap-6 md:grid-cols-3">
						<div className="rounded-lg border bg-card p-6">
							<h3 className="mb-2 text-xl font-semibold">
								{t("promo.features.1.title")}
							</h3>
							<p className="text-muted-foreground">
								{t("promo.features.1.description")}
							</p>
						</div>
						<div className="rounded-lg border bg-card p-6">
							<h3 className="mb-2 text-xl font-semibold">
								{t("promo.features.2.title")}
							</h3>
							<p className="text-muted-foreground">
								{t("promo.features.2.description")}
							</p>
						</div>
						<div className="rounded-lg border bg-card p-6">
							<h3 className="mb-2 text-xl font-semibold">
								{t("promo.features.3.title")}
							</h3>
							<p className="text-muted-foreground">
								{t("promo.features.3.description")}
							</p>
						</div>
					</div>
				</section>

				<section className="text-center">
					{isAuthenticated ? (
						<Button asChild size="lg">
							<Link to="/dashboard">{t("promo.cta.dashboard")}</Link>
						</Button>
					) : (
						<div className="space-y-4 gap-4">
							<Button asChild size="lg" className="w-full md:w-auto">
								<Link to="/auth/login">{t("promo.cta.login")}</Link>
							</Button>
						</div>
					)}
				</section>
			</main>
		</div>
	);
};
