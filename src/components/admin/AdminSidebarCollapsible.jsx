import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import * as authService from '@/services/authService';
import { Button } from '@/components/ui/button';
import { ADMIN_NAV_ITEMS, isNavigationItemActive } from '@/lib/navigationConfig';
import BrandLogo from '@/components/BrandLogo';
import {
  LogOut,
  ArrowLeft,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export default function AdminSidebarCollapsible() {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleLogout = async () => {
    // AuthContext's onAuthStateChange subscription clears shared user state.
    await authService.signOut('/');
  };

  return (
    <div className={`h-screen shrink-0 bg-sidebar overflow-y-auto flex flex-col sticky top-0 transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-20 sm:w-64'} border-r border-sidebar-border`}>
      {/* Logo & Toggle */}
      <div className={`border-b border-sidebar-border flex items-center justify-between ${isCollapsed ? 'p-2.5' : 'p-4'}`}>
        {!isCollapsed && (
          <Link to="/admin" className="hidden sm:block" aria-label="FindIt admin overview">
            <BrandLogo markClassName="h-8 w-8" wordmarkClassName="text-lg" />
          </Link>
        )}
        <Link to="/admin" className={isCollapsed ? 'hidden sm:block' : 'sm:hidden'} aria-label="FindIt admin overview">
          <BrandLogo showWordmark={false} markClassName="h-7 w-7" />
        </Link>
        <button type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden p-1 hover:bg-sidebar-accent rounded-lg transition-colors sm:block"
          aria-label={isCollapsed ? 'Expand admin navigation' : 'Collapse admin navigation'}
        >
          {isCollapsed ? (
            <ChevronRight className="w-5 h-5 text-sidebar-foreground" />
          ) : (
            <ChevronLeft className="w-5 h-5 text-sidebar-foreground" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3">
        <div className="space-y-1">
              {ADMIN_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = isNavigationItemActive(location.pathname, item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    title={item.label}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                      isActive
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      {!isCollapsed && <span className="hidden truncate sm:inline">{item.label}</span>}
                    </div>
                  </Link>
                );
              })}
        </div>
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border space-y-1">
        <Button
          asChild
          variant="ghost"
          className="w-full justify-start text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          title={isCollapsed ? "Back to App" : undefined}
        >
          <Link to="/">
            <ArrowLeft className="w-4 h-4 mr-2 flex-shrink-0" />
            {!isCollapsed && <span className="hidden sm:inline">Back to App</span>}
          </Link>
        </Button>
        <Button
          onClick={handleLogout}
          variant="ghost"
          className="w-full justify-start text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          title={isCollapsed ? "Logout" : undefined}
        >
          <LogOut className="w-4 h-4 mr-2 flex-shrink-0" />
          {!isCollapsed && <span className="hidden sm:inline">Logout</span>}
        </Button>
      </div>
    </div>
  );
}
