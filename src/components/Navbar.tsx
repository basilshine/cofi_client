import { Link, useLocation } from 'react-router-dom';
import { Button } from '@components/ui/button';
import { House, ChartLineUp, Wallet, Gear } from '@phosphor-icons/react';

export const Navbar = () => {
  const location = useLocation();

  const navItems = [
    { label: 'Home', path: '/', icon: House },
    { label: 'Expenses', path: '/expenses', icon: Wallet },
    { label: 'Analytics', path: '/analytics', icon: ChartLineUp },
    { label: 'Settings', path: '/settings', icon: Gear },
  ];

  return (
    <nav className="border-b bg-card">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-semibold">Cofilance</h1>
        </div>
        <div className="flex items-center space-x-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Button
                key={item.path}
                variant={isActive ? 'default' : 'ghost'}
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
      </div>
    </nav>
  );
}; 