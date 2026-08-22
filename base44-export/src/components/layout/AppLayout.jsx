import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import CompanyHeader from './CompanyHeader';
import { cn } from '@/lib/utils';
import RGPDConsent from '@/components/rgpd/RGPDConsent';
import { Menu, Search, LogOut } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/AuthContext';

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { logout, user } = useAuth();

  return (
    <div className="min-h-[100dvh] bg-background">
      {/* Desktop sidebar — xl+ only (tablettes = tiroir mobile avec déconnexion visible) */}
      <aside className={cn(
        'fixed left-0 top-0 h-[100dvh] z-50 transition-all duration-300 hidden xl:block',
        collapsed ? 'w-[72px]' : 'w-[240px]',
      )}>
        <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      </aside>

      {/* Mobile / tablet overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 xl:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      {/* Mobile / tablet drawer */}
      <aside className={cn(
        'fixed left-0 top-0 h-[100dvh] w-[min(100vw-2.5rem,300px)] z-50 transition-transform duration-300 xl:hidden shadow-2xl',
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
      )}>
        <Sidebar
          collapsed={false}
          setCollapsed={() => {}}
          onMobileClose={() => setMobileOpen(false)}
        />
      </aside>

      <div className={cn(
        'min-h-[100dvh] transition-all duration-300',
        collapsed ? 'xl:ml-[72px]' : 'xl:ml-[240px]',
      )}>
        {/* Top bar mobile — hors Dynamic Island / status bar (safe-area) */}
        <header className="xl:hidden sticky top-0 z-30 bg-white border-b border-gray-200 safe-top">
          <div className="safe-x">
            <div className="flex items-center gap-2 py-2">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="p-2.5 -ml-1 rounded-lg hover:bg-gray-100 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0"
                aria-label="Ouvrir le menu"
              >
                <Menu className="w-5 h-5 text-gray-700" />
              </button>

              <img
                src="/phoenix-sekur-logo.png"
                alt="Phoenix Sekur"
                className="w-8 h-8 rounded-lg object-contain bg-black shrink-0"
              />

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate leading-tight">Phoenix Sekur</p>
                {user?.email && (
                  <p className="text-[11px] text-gray-500 truncate leading-tight">{user.email}</p>
                )}
              </div>

              <button
                type="button"
                onClick={() => logout()}
                className="p-2.5 rounded-lg hover:bg-red-50 text-gray-700 hover:text-red-600 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0"
                aria-label="Déconnexion"
                title={user?.email || 'Déconnexion'}
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>

            <div className="relative pb-2.5">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <Input
                type="search"
                placeholder="Rechercher..."
                className="w-full pl-9 pr-3 h-10 bg-gray-50 border-0 rounded-full text-sm focus-visible:ring-1"
              />
            </div>
          </div>
        </header>

        {/* Barre desktop : déconnexion toujours accessible */}
        <div className="hidden xl:flex items-center justify-end gap-2 px-6 py-2 border-b border-gray-100 bg-white/80">
          <span className="text-xs text-muted-foreground truncate max-w-[280px]">{user?.email}</span>
          <button
            type="button"
            onClick={() => logout()}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Déconnexion
          </button>
        </div>

        <CompanyHeader />

        <main className="p-3 sm:p-4 xl:p-8 max-w-[100vw] overflow-x-hidden">
          <Outlet />
        </main>
      </div>

      <RGPDConsent />
    </div>
  );
}
