import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import CompanyHeader from './CompanyHeader';
import { cn } from '@/lib/utils';
import RGPDConsent from '@/components/rgpd/RGPDConsent';
import { Menu, Search, Bell, LogOut } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/AuthContext';

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { logout, user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className={cn(
        'fixed left-0 top-0 h-screen z-50 transition-all duration-300 hidden lg:block',
        collapsed ? 'w-[72px]' : 'w-[240px]',
      )}>
        <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      {/* Mobile drawer */}
      <aside className={cn(
        'fixed left-0 top-0 h-[100dvh] w-[min(100vw-3rem,300px)] z-50 transition-transform duration-300 lg:hidden shadow-2xl',
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
      )}>
        <Sidebar
          collapsed={false}
          setCollapsed={() => {}}
          onMobileClose={() => setMobileOpen(false)}
        />
      </aside>

      <div className={cn(
        'min-h-screen transition-all duration-300',
        collapsed ? 'lg:ml-[72px]' : 'lg:ml-[240px]',
      )}>
        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-30 bg-white border-b border-gray-200">
          <div className="flex items-center gap-2 px-3 py-2.5">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="p-2.5 -ml-1 rounded-lg hover:bg-gray-100 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Ouvrir le menu"
            >
              <Menu className="w-5 h-5 text-gray-700" />
            </button>

            <div className="flex-1 relative min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="search"
                placeholder="Rechercher..."
                className="w-full pl-9 pr-3 py-2 bg-gray-50 border-0 rounded-full text-sm focus-visible:ring-1"
              />
            </div>

            <button
              type="button"
              className="p-2.5 rounded-lg hover:bg-gray-100 transition-colors relative min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5 text-gray-700" />
            </button>

            <button
              type="button"
              onClick={() => logout()}
              className="p-2.5 rounded-lg hover:bg-red-50 text-gray-700 hover:text-red-600 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Déconnexion"
              title={user?.email || 'Déconnexion'}
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        <CompanyHeader />

        <main className="p-3 sm:p-4 lg:p-8 max-w-[100vw] overflow-x-hidden">
          <Outlet />
        </main>
      </div>

      <RGPDConsent />
    </div>
  );
}
