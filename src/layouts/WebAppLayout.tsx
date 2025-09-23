import { ArrowLeft, ChartPie, UserCircle, Wallet } from "@phosphor-icons/react";
import { isTelegramWebApp } from "@utils/isTelegramWebApp";
import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";

interface WebAppLayoutProps {
	children: ReactNode;
	title?: string;
	showBackButton?: boolean;
}

export const WebAppLayout = ({
	children,
	title = "Cofilance",
	showBackButton = false,
}: WebAppLayoutProps) => {
	const navigate = useNavigate();
	const location = useLocation();

	// Detect if this is a Telegram edit mode (clean interface)
	const isWebApp = isTelegramWebApp();
	const startappParam = new URLSearchParams(window.location.search).get(
		"startapp",
	);
	const sessionStartapp = sessionStorage.getItem(
		"cofi_telegram_startapp_param",
	);
	const telegramEditFlow = sessionStorage.getItem("telegram_edit_flow");
	const isEditPath =
		location.pathname.includes("/edit") || location.pathname.includes("/add");

	const isTelegramEditMode =
		isWebApp &&
		isEditPath &&
		(startappParam || sessionStartapp || telegramEditFlow);

	// Debug logging for layout detection
	console.log("[WebAppLayout] Mode detection:", {
		isWebApp,
		isEditPath,
		startappParam,
		sessionStartapp,
		telegramEditFlow,
		pathname: location.pathname,
		isTelegramEditMode,
	});

	const handleBack = () => {
		navigate(-1);
	};

	const isActive = (path: string) => {
		return location.pathname.startsWith(path);
	};

	const navigationItems = [
		{
			path: "/expenses",
			icon: Wallet,
			label: "Expenses",
			isActive: isActive("/expenses"),
		},
		{
			path: "/dashboard/analytics",
			icon: ChartPie,
			label: "Analytics",
			isActive: isActive("/dashboard/analytics"),
		},
		{
			path: "/dashboard/settings",
			icon: UserCircle,
			label: "Profile",
			isActive: isActive("/dashboard/settings") || isActive("/profile"),
		},
	];

	// For Telegram edit mode, use clean interface without header/navigation
	if (isTelegramEditMode) {
		console.log("[WebAppLayout] Using clean Telegram edit mode layout");
		return (
			<div className="min-h-screen bg-[#f8fafc]">
				{/* Debug indicator for clean mode */}
				<div className="bg-green-100 border border-green-400 p-2 m-2 rounded text-xs">
					🎯 Clean Telegram Edit Mode Active
				</div>
				{children}
			</div>
		);
	}

	// Regular layout with header and navigation
	return (
		<div className="relative flex size-full min-h-screen flex-col justify-between overflow-x-hidden bg-[#f8fafc]">
			<div className="flex-grow">
				{/* Header */}
				<header className="flex items-center p-4 pb-2 justify-between">
					{showBackButton ? (
						<button
							type="button"
							onClick={handleBack}
							className="text-[#1e3a8a] flex size-12 shrink-0 items-center justify-center rounded-full hover:bg-[#e0f2f7]"
						>
							<ArrowLeft size={24} />
						</button>
					) : (
						<div className="size-12" /> // Spacer
					)}

					<h1 className="text-[#1e3a8a] text-xl font-bold leading-tight tracking-[-0.015em] flex-1 text-center pr-12">
						{title}
					</h1>
				</header>

				{/* Main Content */}
				<main className="px-4 py-6 space-y-8 pb-32">{children}</main>
			</div>

			{/* Bottom Navigation */}
			<nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-sm shadow-[0_-1px_4px_rgba(0,0,0,0.05)] rounded-t-3xl">
				<div className="flex justify-around items-center h-20 px-4">
					{navigationItems.map((item) => {
						const IconComponent = item.icon;
						return (
							<button
								type="button"
								key={item.path}
								onClick={() => navigate(item.path)}
								className={`flex flex-col items-center space-y-1 ${
									item.isActive ? "text-[#47c1ea]" : "text-[#64748b]"
								}`}
							>
								{item.isActive ? (
									<div className="bg-[#e0f2f7] p-3 rounded-full">
										<IconComponent size={28} weight="fill" />
									</div>
								) : (
									<IconComponent size={28} />
								)}
								<span
									className={`text-xs ${item.isActive ? "font-bold" : "font-medium"}`}
								>
									{item.label}
								</span>
							</button>
						);
					})}
				</div>
			</nav>
		</div>
	);
};
