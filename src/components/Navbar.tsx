import { Button } from "@components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@components/ui/dropdown-menu";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@components/ui/sheet";
import { useAuth } from "@contexts/AuthContext";
import {
	Bug,
	ChartLineUp,
	Gear,
	Globe,
	House,
	List,
	User,
	Wallet,
	X,
} from "@phosphor-icons/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";

export const Navbar = () => {
	const location = useLocation();
	const { t, i18n } = useTranslation();
	const { user } = useAuth();
	const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

	const navItems = [
		{ label: t("nav.home"), path: "/dashboard", icon: House },
		{ label: t("nav.expenses"), path: "/expenses", icon: Wallet },
		{ label: t("nav.debug"), path: "/dashboard/debug", icon: Bug },
		{
			label: t("nav.analytics"),
			path: "/dashboard/analytics",
			icon: ChartLineUp,
		},
		{ label: t("nav.settings"), path: "/dashboard/settings", icon: Gear },
	];

	const languages = [
		{ code: "en", label: t("common.language.en") },
		{ code: "ru", label: t("common.language.ru") },
	];

	const handleMobileNavClick = () => {
		setIsMobileMenuOpen(false);
	};

	return (
		<nav className="border-b bg-card">
			<div className="container mx-auto flex h-16 items-center justify-between px-4">
				{/* Logo/Brand */}
				<div className="flex items-center space-x-4">
					<h1 className="text-xl font-semibold">{t("app.name")}</h1>
				</div>

				{/* Desktop Navigation */}
				<div className="hidden md:flex items-center space-x-2">
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
				</div>

				{/* Desktop Right Side Menu */}
				<div className="hidden md:flex items-center space-x-2">
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
										alt={user.telegramUsername}
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
								<p className="text-sm font-medium">{user?.name}</p>
								{user?.telegramUsername && (
									<p className="text-xs text-muted-foreground">
										@{user.telegramUsername}
									</p>
								)}
							</div>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>

				{/* Mobile Menu */}
				<div className="md:hidden flex items-center space-x-2">
					{/* Language Selector for Mobile */}
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

					{/* Mobile Navigation Sheet */}
					<Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
						<SheetTrigger asChild>
							<Button variant="ghost" size="icon">
								<List className="h-6 w-6" />
								<span className="sr-only">Open menu</span>
							</Button>
						</SheetTrigger>
						<SheetContent side="right" className="w-[300px] sm:w-[400px]">
							<SheetHeader>
								<div className="flex items-center justify-between">
									<SheetTitle>{t("app.name")}</SheetTitle>
									<Button
										variant="ghost"
										size="icon"
										onClick={() => setIsMobileMenuOpen(false)}
									>
										<X className="h-5 w-5" />
									</Button>
								</div>
							</SheetHeader>

							{/* User Info */}
							<div className="mt-6 p-4 bg-muted rounded-lg">
								<div className="flex items-center space-x-3">
									{user?.telegramPhotoUrl ? (
										<img
											src={user.telegramPhotoUrl}
											alt={user.name}
											className="h-10 w-10 rounded-full"
										/>
									) : (
										<div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center">
											<User className="h-5 w-5 text-primary-foreground" />
										</div>
									)}
									<div>
										<p className="text-sm font-medium">{user?.name}</p>
										{user?.telegramUsername && (
											<p className="text-xs text-muted-foreground">
												@{user.telegramUsername}
											</p>
										)}
									</div>
								</div>
							</div>

							{/* Navigation Items */}
							<div className="mt-6 space-y-2">
								{navItems.map((item) => {
									const Icon = item.icon;
									const isActive = location.pathname === item.path;
									return (
										<Button
											key={item.path}
											variant={isActive ? "default" : "ghost"}
											className="w-full justify-start"
											asChild
											onClick={handleMobileNavClick}
										>
											<Link to={item.path}>
												<Icon className="mr-3 h-5 w-5" />
												{item.label}
											</Link>
										</Button>
									);
								})}
							</div>
						</SheetContent>
					</Sheet>
				</div>
			</div>
		</nav>
	);
};
