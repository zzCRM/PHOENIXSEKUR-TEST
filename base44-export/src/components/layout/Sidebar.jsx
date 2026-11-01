import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Building2, MapPin,
  FileText, ChevronLeft, ChevronRight, LogOut,
  BookOpen, Route, BarChart3, MessageSquare,
  Navigation, UserPlus, CalendarDays,
  FileSignature, ClipboardCheck, Clock, ScanLine,
  ShieldCheck, FileDown, TrendingUp, Info, X, CalendarClock, Wallet,
  Calendar, Shield, Bookmark, CreditCard, Phone, AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { isFieldAgent, mergeAgentDroits } from '@/lib/agentPortal';

const agentNavGroups = [
  {
    label: 'Mon portail',
    items: [
      { icon: LayoutDashboard, label: 'Accueil', path: '/espace-agent' },
      { icon: Calendar, label: 'Mon planning', path: '/espace-agent?tab=planning', droit: 'acces_planning' },
      { icon: Shield, label: 'Service', path: '/espace-agent?tab=service', droit: 'acces_services' },
      { icon: Clock, label: 'Service non planifié', shortLabel: 'Non planifié', path: '/espace-agent?tab=nonplanifie', droit: 'acces_service_non_planifie' },
      { icon: Bookmark, label: 'Demandes à la société', shortLabel: 'Demandes', path: '/espace-agent?tab=demandes', droit: 'acces_conges' },
      { icon: Route, label: 'Rondes', path: '/espace-agent?tab=rondes', droit: 'acces_rondes' },
      { icon: ScanLine, label: 'Points de contrôle', shortLabel: 'Contrôles', path: '/espace-agent?tab=checkpoints', droit: 'acces_points_controle' },
      { icon: BookOpen, label: 'Cahier de consignes', shortLabel: 'Consignes', path: '/espace-agent?tab=consignes', droit: 'acces_consignes' },
      { icon: CreditCard, label: 'Ma carte professionnelle', shortLabel: 'Carte pro', path: '/espace-agent?tab=carte', droit: 'acces_carte_pro' },
      { icon: Phone, label: 'Contacter l’agence', shortLabel: 'Agence', path: '/espace-agent?tab=contact', droit: 'acces_contact_societe' },
      { icon: AlertTriangle, label: 'Protection PTI', shortLabel: 'PTI', path: '/espace-agent?tab=pti', droit: 'acces_pti' },
    ],
  },
];

const baseNavGroups = [
  {
    label: '',
    items: [
      { icon: LayoutDashboard, label: 'Tableau de bord', shortLabel: 'Accueil', path: '/', home: true },
    ],
  },
  {
    label: 'Exploitation',
    items: [
      { icon: Calendar, label: 'Planning', path: '/planning' },
      { icon: ClipboardCheck, label: 'Services', path: '/missions' },
      { icon: Navigation, label: 'Supervision', path: '/carte', live: true },
      { icon: BookOpen, label: 'Main courante', shortLabel: 'Courante', path: '/main-courante' },
      { icon: Route, label: 'Rondes', path: '/rondes' },
      { icon: ScanLine, label: 'Points de contrôle', shortLabel: 'Contrôles', path: '/points-controle' },
      { icon: AlertTriangle, label: 'Protection PTI', shortLabel: 'PTI', path: '/pti' },
    ],
  },
  {
    label: 'Ressources',
    items: [
      { icon: Users, label: 'Agents', path: '/agents' },
      { icon: MapPin, label: 'Sites', path: '/sites' },
      { icon: Clock, label: 'Écarts horaires', shortLabel: 'Écarts', path: '/ecarts-horaires' },
      { icon: FileDown, label: 'Bons d\'audit', shortLabel: 'Audits', path: '/bons-intervention' },
      { icon: Building2, label: 'Clients', path: '/clients' },
      { icon: Wallet, label: 'Prépaie', path: '/prepaie' },
      { icon: CalendarDays, label: 'Congés', path: '/conges' },
    ],
  },
  {
    label: 'Analyses',
    items: [
      { icon: BarChart3, label: 'Statistiques', path: '/heures-sites' },
      { icon: CalendarClock, label: 'Heures', path: '/heures-collaborateurs' },
      { icon: FileText, label: 'Rapports', path: '/rapports-pdf' },
      { icon: TrendingUp, label: 'Leads', path: '/leads' },
    ],
  },
  {
    label: 'Paramètres',
    items: [
      { icon: Info, label: 'Paramètres', path: '/parametres-societe' },
      { icon: MessageSquare, label: 'Demandes', path: '/demandes' },
      { icon: FileSignature, label: 'Contrats', path: '/contrats' },
      { icon: FileText, label: 'Documents', path: '/documents' },
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
  const isAgent = isFieldAgent(user);
  const isMobileDrawer = !!onMobileClose;
  const companyId = user?.company_id || user?.companyId;
  const { data: agentFiche } = useQuery({
    queryKey: ['ma_fiche_agent', user?.email, companyId],
    queryFn: async () => {
      const agents = await base44.entities.Agent.filter({ company_id: companyId });
      return agents.find((a) => String(a.email || '').toLowerCase() === String(user?.email || '').toLowerCase()) || null;
    },
    enabled: isAgent && !!companyId && !!user?.email,
  });
  const droits = mergeAgentDroits(agentFiche);
  const navGroups = isAgent
    ? agentNavGroups.map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.droit || droits[item.droit]),
    }))
    : getNavGroups(isPlatformOwner, isAdmin, isSuperAdminUser);

  const handleLinkClick = () => {
    onMobileClose?.();
  };

  const handleLogout = () => {
    onMobileClose?.();
    logout();
  };

  return (
    <div className="h-full max-h-[100dvh] bg-[#06101c] text-white/80 flex flex-col overflow-hidden">
      {/* Header */}
      <div className={cn(
        'flex items-center justify-between px-3 sm:px-4 border-b border-sidebar-border shrink-0',
        isMobileDrawer ? 'safe-top pb-3 min-h-14' : 'h-14 sm:h-16',
      )}>
        <div className="flex items-center gap-2.5 min-w-0">
          <img
            src="/phoenix-sekur-logo.png"
            alt="Phoenix Sekur"
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg object-contain bg-black shrink-0"
          />
          {(!collapsed || isMobileDrawer) && (
            <span className="min-w-0 leading-tight truncate">
              <span className="block text-[13px] font-extrabold tracking-[0.14em] text-white">PHOENIX SEKUR</span>
              <span className="block text-[9px] tracking-[0.18em] text-amber-200/70">SECURITY MANAGEMENT</span>
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
        {navGroups.map((group) => (
          <div key={group.label}>
            {(!collapsed || isMobileDrawer) && (
              <p className="px-2 mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const itemUrl = new URL(item.path, 'https://app.local');
                const itemTab = itemUrl.searchParams.get('tab');
                const currentTab = new URLSearchParams(location.search).get('tab');
                const isActive = item.path === '/espace-agent'
                  ? location.pathname === '/espace-agent' && !currentTab
                  : itemTab
                    ? location.pathname === '/espace-agent' && currentTab === itemTab
                    : location.pathname === item.path
                      || (item.path !== '/' && location.pathname.startsWith(item.path));
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={handleLinkClick}
                    title={item.label}
                    className={cn(
                      'flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-200',
                      isMobileDrawer ? 'px-3 py-3 min-h-[44px]' : 'px-3 py-2.5',
                      isActive
                        ? 'bg-[#e4b54a] text-[#1c1403]'
                        : 'text-white/75 hover:bg-white/5 hover:text-white',
                    )}
                  >
                    <item.icon
                      className="shrink-0"
                      style={{ width: 18, height: 18 }}
                    />
                    {(!collapsed || isMobileDrawer) && (
                      <span className="truncate flex items-center gap-2">
                        {isMobileDrawer && item.shortLabel ? item.shortLabel : item.label}
                        {item.live && !isActive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
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
      <div className="shrink-0 p-2 border-t border-white/10 bg-[#06101c] space-y-0.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
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
