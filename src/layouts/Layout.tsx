import { Navbar } from "@components/Navbar";
import { Outlet } from "react-router-dom";

interface LayoutProps {
	children?: React.ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
	return (
		<div className="min-h-screen bg-background">
			<Navbar />
			<main className="container mx-auto p-4 md:p-6 lg:p-8">
				{children || <Outlet />}
			</main>
		</div>
	);
};
