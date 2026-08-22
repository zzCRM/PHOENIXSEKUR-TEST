import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Building2, MapPin,
  FileText, ChevronLeft, ChevronRight, LogOut,
  BookOpen, Route, BarChart3, MessageSquare,
  Navigation, UserPlus, CalendarDays,
  FileSignature, ClipboardCheck, Clock, ScanLine,
  ShieldCheck, FileDown, TrendingUp, Info, X, CalendarClock, Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/AuthContext';

const baseNavGroups = [
  {
    label: 'Général',
    items: [
      { icon: LayoutDashboard, label: 'Tableau de bord', shortLabel: 'Accueil', path: '/' },
    ],
  },
  {
    label: 'Planification',
    items: [
      { icon: BarChart3, label: 'Planning', path: '/planning' },
      { icon: ClipboardCheck, label: 'Services', path: '/missions' },
      { icon: Clock, label: 'Écarts horaires', shortLabel: 'Écarts', path: '/ecarts-horaires' },
    ],
  },
  {
    label: 'Terrain',
    items: [
      { icon: BookOpen, label: 'Main courante', shortLabel: 'Courante', path: '/main-courante' },
      { icon: Navigation, label: 'Supervision', path: '/carte' },
      { icon: FileDown, label: 'Bons d\'audit', shortLabel: 'Audits', path: '/bons-intervention' },
    ],
  },
  {
    label: 'Sites',
    items: [
      { icon: MapPin, label: 'Sites', path: '/sites' },
      { icon: CalendarClock, label: 'Heures de sites', shortLabel: 'H. sites', path: '/heures-sites' },
      { icon: Route, label: 'Rondes', path: '/rondes' },
      { icon: ScanLine, label: 'Points de contrôle', shortLabel: 'Contrôles', path: '/points-controle' },
    ],
  },
  {
    label: 'Commercial',
    items: [
      { icon: TrendingUp, label: 'Leads', path: '/leads' },
    ],
  },
  {
    label: 'Clients',
    items: [
      { icon: Building2, label: 'Clients', path: '/clients' },
      { icon: MessageSquare, label: 'Demandes', path: '/demandes' },
      { icon: FileText, label: 'Documents', path: '/documents' },
      { icon: FileSignature, label: 'Contrats', path: '/contrats' },
      { icon: FileDown, label: 'Rapports PDF', shortLabel: 'Rapports', path: '/rapports-pdf' },
    ],
  },
  {
    label: 'Collaborateurs',
    items: [
      { icon: Users, label: 'Collaborateurs', shortLabel: 'Équipe', path: '/agents' },
      { icon: Clock, label: 'Heures', path: '/heures-collaborateurs' },
      { icon: Wallet, label: 'Prépaie', path: '/prepaie' },
      { icon: CalendarDays, label: 'Congés', path: '/conges' },
    ],
  },
  {
    label: 'Société',
    items: [
      { icon: Info, label: 'Paramètres', path: '/parametres-societe' },
    ],
  },
];

const getNavGroups = (isPlatformOwner, isAdmin, isSuperAdminUser) => {
  const groups = [];
  if (isSuperAdminUser) {
    groups.push({
      label: 'Plateforme',
      items: [
        { icon: ShieldCheck, label: 'Super Admin', path: '/super-admin' },
        { icon: UserPlus, label: 'Onboarding', path: '/onboarding' },
      ],
    });
  }
  groups.push(...baseNavGroups);
  if (isAdmin) {
    groups.push({
      label: 'Administration',
      items: [
        { icon: Users, label: 'Utilisateurs', shortLabel: 'Comptes', path: '/inviter' },
        { icon: ShieldCheck, label: 'Facturation', path: '/facturation' },
      ],
    });
  }
  if (isPlatformOwner && !isSuperAdminUser) {
    groups.push({
      label: 'Admin',
      items: [
        { icon: UserPlus, label: 'Onboarding', path: '/onboarding' },
      ],
    });
  }
  return groups;
};

export default function Sidebar({ collapsed, setCollapsed, onMobileClose }) {
  const location = useLocation();
  const { user, logout } = useAuth();

  const PLATFORM_OWNER_EMAIL = 'contact@ppsecurity.fr';
  const isPlatformOwner = user?.email === PLATFORM_OWNER_EMAIL;
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const isSuperAdminUser = !!user?.superadmin;
  const isMobileDrawer = !!onMobileClose;

  const handleLinkClick = () => {
    onMobileClose?.();
  };

  const handleLogout = () => {
    onMobileClose?.();
    logout();
  };

  return (
    <div className="h-full max-h-[100dvh] bg-sidebar text-sidebar-foreground flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-14 sm:h-16 flex items-center justify-between px-3 sm:px-4 border-b border-sidebar-border shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <img
            src="/phoenix-sekur-logo.png"
            alt="Phoenix Sekur"
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg object-contain bg-black shrink-0"
          />
          {(!collapsed || isMobileDrawer) && (
            <span className="text-sm font-bold text-white tracking-tight leading-tight truncate">
              Phoenix<br />Sekur
            </span>
          )}
        </div>
        {isMobileDrawer && (
          <button
            type="button"
            onClick={onMobileClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Fermer le menu"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        )}
      </div>

      {/* Navigation — scrollable */}
      <nav className="flex-1 min-h-0 py-2 px-2 space-y-3 overflow-y-auto overscroll-contain">
        {getNavGroups(isPlatformOwner, isAdmin, isSuperAdminUser).map((group) => (
          <div key={group.label}>
            {(!collapsed || isMobileDrawer) && (
              <p className="px-2 mb-1 text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/40">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = location.pathname === item.path
                  || (item.path !== '/' && location.pathname.startsWith(item.path));
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={handleLinkClick}
                    title={item.label}
                    className={cn(
                      'flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-200',
                      isMobileDrawer ? 'px-3 py-3 min-h-[44px]' : 'px-3 py-2.5',
                      isActive
                        ? 'bg-primary/15 text-primary'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                    )}
                  >
                    <item.icon
                      className={cn('shrink-0', isActive && 'text-primary')}
                      style={{ width: 18, height: 18 }}
                    />
                    {(!collapsed || isMobileDrawer) && (
                      <span className="truncate">
                        {isMobileDrawer && item.shortLabel ? item.shortLabel : item.label}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer sticky — déconnexion toujours visible */}
      <div className="shrink-0 p-2 border-t border-sidebar-border bg-sidebar space-y-0.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {!isMobileDrawer && (
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent w-full transition-all"
          >
            {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            {!collapsed && <span>Réduire</span>}
          </button>
        )}
        {(!collapsed || isMobileDrawer) && user?.email && (
          <p className="px-3 py-1 text-[11px] text-sidebar-foreground/50 truncate">
            {user.email}
          </p>
        )}
        <button
          type="button"
          onClick={handleLogout}
          className={cn(
            'flex items-center gap-3 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-destructive/15 hover:text-red-400 w-full transition-all',
            isMobileDrawer ? 'px-3 py-3.5 min-h-[48px]' : 'px-3 py-2.5',
          )}
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {(!collapsed || isMobileDrawer) && <span>Déconnexion</span>}
        </button>
      </div>
    </div>
  );
}
