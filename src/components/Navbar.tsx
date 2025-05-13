import { Button } from "@components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@components/ui/dropdown-menu";
import { useAuth } from "@contexts/AuthContext";
import {
	ChartLineUp,
	Gear,
	Globe,
	House,
	User,
	Wallet,
} from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";

export const Navbar = () => {
	const location = useLocation();
	const { t, i18n } = useTranslation();
	const { user } = useAuth();

	const navItems = [
		{ label: t("nav.home"), path: "/", icon: House },
		{ label: t("nav.expenses"), path: "/expenses", icon: Wallet },
		{ label: t("nav.analytics"), path: "/analytics", icon: ChartLineUp },
		{ label: t("nav.settings"), path: "/settings", icon: Gear },
	];

	const languages = [
		{ code: "en", label: t("common.language.en") },
		{ code: "ru", label: t("common.language.ru") },
	];

	return (
		<nav className="border-b bg-card">
			<div className="container mx-auto flex h-16 items-center justify-between px-4">
				<div className="flex items-center space-x-4">
					<h1 className="text-xl font-semibold">{t("app.name")}</h1>
				</div>
				<div className="flex items-center space-x-2">
					{navItems.map((item) => {
						const Icon = item.icon;
						const isActive = location.pathname === item.path;
						return (
							<Button
								key={item.path}
								variant={isActive ? "default" : "ghost"}
								asChild
							>
								<Link to={item.path}>
									<Icon className="mr-2 h-5 w-5" />
									{item.label}
								</Link>
							</Button>
						);
					})}
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
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="icon">
								{user?.telegramPhotoUrl ? (
									<img
										src={user.telegramPhotoUrl}
										alt={user.firstName}
										className="h-6 w-6 rounded-full"
									/>
								) : (
									<User className="h-5 w-5" />
								)}
								<span className="sr-only">User menu</span>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<div className="px-2 py-1.5">
								<p className="text-sm font-medium">{user?.firstName}</p>
								{user?.telegramUsername && (
									<p className="text-xs text-muted-foreground">
										@{user.telegramUsername}
									</p>
								)}
							</div>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>
		</nav>
	);
};
