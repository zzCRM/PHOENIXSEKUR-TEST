import React, { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import CompanyHeader from './CompanyHeader';
import { cn } from '@/lib/utils';
import RGPDConsent from '@/components/rgpd/RGPDConsent';
import { Menu, LogOut, Home, Calendar, MapPin, Plus, LayoutGrid, Bell } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { accountDisplayName, isFieldAgent } from '@/lib/agentPortal';

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const { logout, user } = useAuth();
  const location = useLocation();
  const agentPortal = isFieldAgent(user);
  const displayName = accountDisplayName(user);
  const commandHome = !agentPortal && location.pathname === '/';

  return (
    <div className={cn('min-h-[100dvh]', commandHome ? 'bg-[#070e1a]' : 'bg-background')}>
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
        commandHome ? 'bg-[#070e1a]' : 'bg-background',
        collapsed ? 'xl:ml-[72px]' : 'xl:ml-[240px]',
      )}>
        {/* Top bar mobile — hors Dynamic Island / status bar (safe-area) */}
        <header className={cn(
          'xl:hidden sticky top-0 z-30 border-b safe-top',
          agentPortal ? 'bg-white border-gray-200' : 'bg-[#06101c] border-white/10',
        )}>
          <div className="safe-x">
            <div className="flex items-center gap-2 py-2">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className={cn(
                  'p-2.5 -ml-1 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0',
                  agentPortal ? 'hover:bg-gray-100' : 'hover:bg-white/10',
                )}
                aria-label="Ouvrir le menu"
              >
                <Menu className={cn('w-5 h-5', agentPortal ? 'text-gray-700' : 'text-white')} />
              </button>

              {commandHome ? (
                <div className="flex-1 min-w-0 flex items-center justify-center gap-2 pr-2">
                  <img src="/phoenix-sekur-logo.png" alt="" className="w-8 h-8 object-contain shrink-0" />
                  <span className="min-w-0 leading-tight text-center">
                    <span className="block text-[12px] font-extrabold tracking-[0.14em] text-white truncate">PHOENIX SEKUR</span>
                    <span className="block text-[8px] tracking-[0.16em] text-amber-200/70 truncate">SECURITY MANAGEMENT</span>
                  </span>
                </div>
              ) : (
                <>
                  <img
                    src="/phoenix-sekur-logo.png"
                    alt="Phoenix Sekur"
                    className="w-8 h-8 rounded-lg object-contain bg-black shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm font-semibold truncate leading-tight', agentPortal ? 'text-gray-900' : 'text-white')}>
                      {agentPortal ? 'Espace Agent' : 'Phoenix Sekur'}
                    </p>
                    <p className={cn('text-[11px] truncate leading-tight', agentPortal ? 'text-gray-500' : 'text-white/50')}>
                      {displayName || user?.email || ''}
                    </p>
                  </div>
                </>
              )}

              {commandHome ? (
                <Link
                  to="/alertes"
                  className="relative p-2.5 rounded-lg hover:bg-white/10 min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0 text-white"
                  aria-label="Alertes"
                >
                  <Bell className="w-5 h-5" />
                </Link>
              ) : (
              <button
                type="button"
                onClick={() => logout()}
                className={cn(
                  'p-2.5 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0',
                  agentPortal ? 'hover:bg-red-50 text-gray-700 hover:text-red-600' : 'text-white/80 hover:bg-white/10 hover:text-rose-300',
                )}
                aria-label="Déconnexion"
                title={user?.email || 'Déconnexion'}
              >
                <LogOut className="w-5 h-5" />
              </button>
              )}
            </div>
          </div>
        </header>

        {/* Barre desktop : déconnexion toujours accessible, hors tableau de bord */}
        {!commandHome && (
        <div className="hidden xl:flex items-center justify-end gap-2 px-6 py-2 border-b border-gray-100 bg-white/80">
          <span className="text-xs text-muted-foreground truncate max-w-[280px]">
            {displayName || user?.email}
          </span>
          <button
            type="button"
            onClick={() => logout()}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Déconnexion
          </button>
        </div>
        )}

        {!agentPortal && !commandHome && <CompanyHeader />}

        <main className={cn(
          'p-3 sm:p-4 xl:p-8 max-w-[100vw] overflow-x-hidden',
          !agentPortal && 'pb-24 xl:pb-8',
          commandHome && 'bg-[#070e1a]',
        )}>
          <Outlet />
        </main>

        {!agentPortal && (
          <nav className="xl:hidden fixed bottom-0 inset-x-0 z-30 bg-[#06101c] border-t border-white/10 safe-bottom">
            <div className="grid grid-cols-5 items-end px-2 pt-2 pb-1">
              <MobileTab to="/" icon={Home} label="Accueil" active={location.pathname === '/'} />
              <MobileTab to="/planning" icon={Calendar} label="Planning" active={location.pathname.startsWith('/planning')} />
              <div className="flex justify-center -mt-5">
                <button
                  type="button"
                  onClick={() => setCreateOpen((v) => !v)}
                  className="w-14 h-14 rounded-full bg-[#e4b54a] text-[#1c1403] shadow-lg flex items-center justify-center"
                  aria-label="Créer"
                >
                  <Plus className={cn('w-7 h-7 transition-transform', createOpen && 'rotate-45')} />
                </button>
              </div>
              <MobileTab to="/sites" icon={MapPin} label="Sites" active={location.pathname.startsWith('/sites')} />
              <button type="button" onClick={() => setMobileOpen(true)} className="flex flex-col items-center gap-1 text-[11px] text-white/55 py-1">
                <LayoutGrid className="w-5 h-5" />
                Plus
              </button>
            </div>
            {createOpen && (
              <div className="absolute bottom-[4.5rem] left-1/2 -translate-x-1/2 w-48 rounded-xl border border-white/10 bg-[#101a2b] p-1 shadow-xl">
                {[
                  ['Mission', '/missions'],
                  ['Agent', '/agents'],
                  ['Site', '/sites'],
                  ['Client', '/clients'],
                ].map(([label, to]) => (
                  <Link key={to} to={to} onClick={() => setCreateOpen(false)} className="block px-3 py-2 text-sm text-white/85 rounded-lg hover:bg-white/5">
                    {label}
                  </Link>
                ))}
              </div>
            )}
          </nav>
        )}
      </div>

      <RGPDConsent />
    </div>
  );
}

function MobileTab({ to, icon: Icon, label, active }) {
  return (
    <Link to={to} className={cn('flex flex-col items-center gap-1 text-[11px] py-1', active ? 'text-[#e4b54a]' : 'text-white/55')}>
      <Icon className="w-5 h-5" />
      {label}
    </Link>
  );
}
