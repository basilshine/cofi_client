import { Outlet } from 'react-router-dom';
import { Navbar } from '@components/Navbar';

interface LayoutProps {
  children?: React.ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto p-4">
        {children || <Outlet />}
      </main>
    </div>
  );
}; 