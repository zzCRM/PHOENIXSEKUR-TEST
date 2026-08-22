import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Building2, MapPin,
  FileText, ChevronLeft, ChevronRight, LogOut,
  BookOpen, Route, BarChart3, MessageSquare,
  Navigation, UserPlus, CalendarDays,
  FileSignature, ClipboardCheck, Clock, ScanLine,
  ShieldCheck, FileDown, TrendingUp, Info, X, CalendarClock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/AuthContext';

const baseNavGroups = [
  {
    label: 'Général',
    items: [
      { icon: LayoutDashboard, label: 'Tableau de bord', path: '/' },
    ]
  },
  {
    label: 'Planification',
    items: [
      { icon: BarChart3, label: 'Planning', path: '/planning' },
      { icon: ClipboardCheck, label: 'Services', path: '/missions' },
      { icon: Clock, label: 'Écarts horaires', path: '/ecarts-horaires' },
    ]
  },
  {
    label: 'Terrain',
    items: [
      { icon: BookOpen, label: 'Main courante', path: '/main-courante' },
      { icon: Navigation, label: 'Supervision', path: '/carte' },
      { icon: FileDown, label: 'Bons d\'audit', path: '/bons-intervention' },
    ]
  },
  {
    label: 'Sites',
    items: [
      { icon: MapPin, label: 'Sites', path: '/sites' },
      { icon: CalendarClock, label: 'Heures de sites', path: '/heures-sites' },
      { icon: Route, label: 'Rondes', path: '/rondes' },
      { icon: ScanLine, label: 'Points de contrôle', path: '/points-controle' },
    ]
  },
  {
    label: 'Commercial',
    items: [
      { icon: TrendingUp, label: 'Leads', path: '/leads' },
    ]
  },
  {
    label: 'Clients',
    items: [
      { icon: Building2, label: 'Clients', path: '/clients' },
      { icon: MessageSquare, label: 'Demandes', path: '/demandes' },
      { icon: FileText, label: 'Documents', path: '/documents' },
      { icon: FileSignature, label: 'Contrats', path: '/contrats' },
      { icon: FileDown, label: 'Rapports PDF', path: '/rapports-pdf' },
    ]
  },
  {
    label: 'Collaborateurs',
    items: [
      { icon: Users, label: 'Collaborateurs', path: '/agents' },
      { icon: Clock, label: 'Heures', path: '/heures-collaborateurs' },
      { icon: CalendarDays, label: 'Demandes', path: '/conges' },
    ]
  },
  {
    label: 'Société',
    items: [
      { icon: Info, label: 'Informations', path: '/parametres-societe' },
    ]
  },
];

const getNavGroups = (isPlatformOwner, isAdmin, isSuperAdminUser) => {
  const groups = [];
  if (isSuperAdminUser) {
    groups.push({
      label: 'Plateforme',
      items: [
        { icon: ShieldCheck, label: 'Super Admin', path: '/super-admin' },
        { icon: UserPlus, label: 'Onboarding société', path: '/onboarding' },
      ],
    });
  }
  groups.push(...baseNavGroups);
  if (isAdmin) {
    groups.push({
      label: 'Administration',
      items: [
        { icon: UserPlus, label: 'Inviter utilisateurs', path: '/inviter' },
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

  const handleLinkClick = () => {
    if (onMobileClose) {
      onMobileClose();
    }
  };

  return (
    <div className="h-full bg-sidebar text-sidebar-foreground flex flex-col">
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border shrink-0">
        <div className="flex items-center gap-3">
          <img
            src="https://media.base44.com/images/public/69ebeeab8b7d7f109e7d5a6c/455c5c3f4_F4CA4781-90C4-416F-ADD8-E17BD4990AE2.PNG"
            alt="Phoenix Sekur"
            className="w-9 h-9 rounded-lg object-contain bg-black shrink-0"
          />
          {!collapsed && (
            <span className="text-sm font-bold text-white tracking-tight leading-tight">Phoenix<br/>Sekur</span>
          )}
        </div>
        {/* Close button mobile */}
        {onMobileClose && (
          <button
            onClick={onMobileClose}
            className="lg:hidden p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-4 overflow-y-auto">
        {getNavGroups(isPlatformOwner, isAdmin, isSuperAdminUser).map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p className="px-2 mb-1 text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/40">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = location.pathname === item.path ||
                  (item.path !== '/' && location.pathname.startsWith(item.path));
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={handleLinkClick}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                      isActive
                        ? "bg-primary/15 text-primary"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <item.icon className={cn("shrink-0", isActive && "text-primary")} style={{ width: '18px', height: '18px' }} />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-sidebar-border space-y-0.5">
        {/* Collapse button - desktop only */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent w-full transition-all"
        >
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          {!collapsed && <span>Réduire</span>}
        </button>
        <button
          onClick={() => logout()}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-destructive/10 hover:text-destructive w-full transition-all"
        >
          <LogOut className="w-5 h-5" />
          {!collapsed && <span>Déconnexion</span>}
        </button>
      </div>
    </div>
  );
}