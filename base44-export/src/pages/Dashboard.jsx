import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import {
  Clock, FileText, Users, Settings, Calendar, Search,
  AlertTriangle, ChevronDown, Plus, TrendingUp, ArrowRight
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import StatusBadge from '@/components/shared/StatusBadge';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useCompany } from '@/lib/useCompany';
import { accountDisplayName } from '@/lib/agentPortal';
import MonthPlanningHome from '@/components/planning/MonthPlanningHome';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts';

/* ---------- Section card avec en-tête gris foncé ---------- */
function SectionCard({ title, dateRange, onSettings, children, linkTo }) {
  return (
    <Card className="overflow-hidden border border-gray-200 shadow-sm p-0">
      {/* Header bar */}
      <div className="bg-[#6C757D] text-white px-4 py-3 flex items-center gap-3">
        <Link to={linkTo} className="flex items-center gap-2 flex-1 min-w-0 hover:underline">
          <h3 className="text-sm font-semibold truncate">{title}</h3>
        </Link>
        {onSettings && (
          <button className="text-green-400 hover:text-green-300 transition-colors">
            <Settings className="w-4 h-4" />
          </button>
        )}
        {dateRange && (
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-white/90 bg-white/10 px-2.5 py-1 rounded-md">
            <Calendar className="w-3.5 h-3.5" />
            <span>{dateRange}</span>
          </div>
        )}
      </div>
      {children}
    </Card>
  );
}

/* ---------- Bandeau d'actions d'une section ---------- */
function SectionControls({ search, setSearch, actionLabel = "ACTIONS" }) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50">
      <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#6C757D] text-white text-xs font-medium hover:bg-[#5a6268] transition-colors">
        {actionLabel}
        <ChevronDown className="w-3.5 h-3.5" />
      </button>
      <div className="relative flex-1 min-w-[180px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher..."
          className="pl-8 h-8 bg-white text-sm"
        />
      </div>
      <div className="hidden md:flex items-center gap-2 text-xs text-gray-500">
        <span className="w-9 h-5 bg-gray-300 rounded-full relative">
          <span className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow" />
        </span>
      </div>
    </div>
  );
}

/* ---------- Carte statistique du haut (style image) ---------- */
function TopStatCard({ icon: Icon, value, label, to, color = "bg-[#6C757D]" }) {
  return (
    <Link
      to={to}
      className={`${color} text-white rounded-xl p-5 flex items-center gap-4 hover:opacity-90 hover:scale-[1.02] transition-all shadow-sm`}
    >
      <div className="w-12 h-12 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
        <Icon className="w-6 h-6" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold leading-tight">{value}</p>
        <p className="text-xs text-white/80 truncate">{label}</p>
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const { companyId, isAdmin, user } = useCompany();
  const navigate = useNavigate();
  const [searchServices, setSearchServices] = useState("");
  const [searchMissions, setSearchMissions] = useState("");

  const { data: agents = [], isLoading: la } = useQuery({ queryKey: ['agents', companyId], queryFn: () => base44.entities.Agent.filter({ company_id: companyId }) });
  const { data: clients = [], isLoading: lc } = useQuery({ queryKey: ['clients', companyId], queryFn: () => base44.entities.Client.filter({ company_id: companyId }) });
  const { data: missions = [], isLoading: lm } = useQuery({ queryKey: ['missions', companyId], queryFn: () => base44.entities.Mission.filter({ company_id: companyId }, '-date', 800) });
  const { data: sites = [] } = useQuery({ queryKey: ['sites', companyId], queryFn: () => base44.entities.Site.filter({ company_id: companyId }), enabled: !!companyId });
  const { data: prises = [] } = useQuery({ queryKey: ['prises_service', companyId], queryFn: () => base44.entities.PriseDeService.filter({ company_id: companyId }, '-date', 200), enabled: !!companyId });
  const { data: invoices = [], isLoading: li } = useQuery({ queryKey: ['invoices', companyId], queryFn: () => base44.entities.Invoice.filter({ company_id: companyId }) });
  const { data: leads = [], isLoading: ll } = useQuery({ queryKey: ['leads', companyId], queryFn: () => base44.entities.Lead.filter({ company_id: companyId }) });

  const isLoading = la || lc || lm || li || ll;

  // Métriques reliées aux données réelles
  const servicesAFacturer = missions.filter(m => m.status === 'terminee').length;
  const devisEnAttente = leads.filter(l => ['nouveau', 'contacte', 'qualification', 'proposition', 'negociation'].includes(l.stage)).length;
  const agentsActifs = agents.filter(a => a.status === 'actif').length;
  const totalAgents = agents.length;

  // Services à venir (missions planifiées ou en cours)
  const upcomingServices = useMemo(() => {
    return missions
      .filter(m => m.status === 'planifiee' || m.status === 'en_cours')
      .filter(m => {
        if (!searchServices) return true;
        const q = searchServices.toLowerCase();
        return (
          (m.title || '').toLowerCase().includes(q) ||
          (m.site_name || '').toLowerCase().includes(q) ||
          (m.client_name || '').toLowerCase().includes(q) ||
          (m.agent_name || '').toLowerCase().includes(q)
        );
      })
      .slice(0, 8);
  }, [missions, searchServices]);

  // Dernières missions terminées
  const recentMissions = useMemo(() => {
    return missions
      .filter(m => {
        if (!searchMissions) return true;
        const q = searchMissions.toLowerCase();
        return (
          (m.title || '').toLowerCase().includes(q) ||
          (m.site_name || '').toLowerCase().includes(q) ||
          (m.client_name || '').toLowerCase().includes(q)
        );
      })
      .slice(0, 8);
  }, [missions, searchMissions]);

  // Données du graphique CA mensuel (depuis factures payées)
  const caData = useMemo(() => {
    const year = new Date().getFullYear();
    const months = Array.from({ length: 12 }, (_, i) => ({
      mois: format(new Date(year, i, 1), 'MMM', { locale: fr }),
      ca: 0,
    }));
    invoices
      .filter(i => i.status === 'payee' && i.date)
      .forEach(inv => {
        const d = new Date(inv.date);
        if (d.getFullYear() === year) {
          months[d.getMonth()].ca += inv.total_ttc || 0;
        }
      });
    return months;
  }, [invoices]);

  const totalCA = invoices.filter(i => i.status === 'payee').reduce((s, i) => s + (i.total_ttc || 0), 0);
  const unpaidInvoices = invoices.filter(i => i.status === 'envoyee' || i.status === 'en_retard');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const currentYear = new Date().getFullYear();
  const monthRange = `01/01/${currentYear} - 31/12/${currentYear}`;
  const monthRangeShort = `01/08/${currentYear} - 31/08/${currentYear}`;

  return (
    <div className="space-y-6 relative">
      {/* Titre */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Bonjour {accountDisplayName(user) || user?.email || 'la société'}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">Tableau de bord — planning du mois</p>
      </div>

      <MonthPlanningHome
        title="Planning du mois — vacations de la société"
        missions={missions}
        prises={prises}
        sites={sites}
        onOpenMission={() => navigate('/planning')}
      />

      {/* 3 cartes statistiques du haut — reliées aux pages */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <TopStatCard
          icon={Clock}
          value={servicesAFacturer}
          label="Service(s) à facturer"
          to="/facturation"
        />
        <TopStatCard
          icon={FileText}
          value={devisEnAttente}
          label="Devis en attente"
          to="/leads"
        />
        <TopStatCard
          icon={Users}
          value={`${agentsActifs}/${totalAgents}`}
          label="Collaborateur(s) actif(s)"
          to="/agents"
        />
      </div>

      {/* Section 1 : Services à venir */}
      <SectionCard
        title="Services à venir"
        dateRange={monthRangeShort}
        onSettings
        linkTo="/planning"
      >
        <SectionControls
          search={searchServices}
          setSearch={setSearchServices}
          actionLabel="ACTIONS"
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-600 uppercase tracking-wide">
                <th className="px-4 py-3 text-left font-semibold w-10"><input type="checkbox" className="rounded" /></th>
                <th className="px-4 py-3 text-left font-semibold">Date de début</th>
                <th className="px-4 py-3 text-left font-semibold">Site & client</th>
                <th className="px-4 py-3 text-left font-semibold hidden md:table-cell">Collaborateur</th>
                <th className="px-4 py-3 text-left font-semibold hidden lg:table-cell">Statut</th>
              </tr>
            </thead>
            <tbody>
              {upcomingServices.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <AlertTriangle className="w-8 h-8" />
                      <p className="text-sm">Aucune donnée à afficher</p>
                    </div>
                  </td>
                </tr>
              ) : (
                upcomingServices.map(m => (
                  <tr key={m.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3"><input type="checkbox" className="rounded" /></td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="font-medium text-gray-900">{m.date ? format(new Date(m.date), 'dd/MM/yyyy', { locale: fr }) : '—'}</p>
                      <p className="text-xs text-gray-500">{m.start_time}{m.end_time && ` - ${m.end_time}`}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Link to="/sites" className="font-medium text-gray-900 hover:text-primary block truncate max-w-[200px]">
                        {m.site_name || m.title}
                      </Link>
                      <p className="text-xs text-gray-500 truncate max-w-[200px]">{m.client_name || '—'}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <Link to="/agents" className="text-gray-700 hover:text-primary">
                        {m.agent_name || 'Non assigné'}
                      </Link>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <StatusBadge status={m.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Section 2 : Dernières missions */}
      <SectionCard
        title="Dernières missions réalisées"
        dateRange={monthRangeShort}
        onSettings
        linkTo="/missions"
      >
        <SectionControls
          search={searchMissions}
          setSearch={setSearchMissions}
          actionLabel="ACTIONS"
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-600 uppercase tracking-wide">
                <th className="px-4 py-3 text-left font-semibold w-10"><input type="checkbox" className="rounded" /></th>
                <th className="px-4 py-3 text-left font-semibold">Date</th>
                <th className="px-4 py-3 text-left font-semibold">Mission</th>
                <th className="px-4 py-3 text-left font-semibold hidden md:table-cell">Site</th>
                <th className="px-4 py-3 text-left font-semibold hidden md:table-cell">Collaborateur</th>
                <th className="px-4 py-3 text-left font-semibold hidden lg:table-cell">Statut</th>
              </tr>
            </thead>
            <tbody>
              {recentMissions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <AlertTriangle className="w-8 h-8" />
                      <p className="text-sm">Aucune donnée à afficher</p>
                    </div>
                  </td>
                </tr>
              ) : (
                recentMissions.map(m => (
                  <tr key={m.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3"><input type="checkbox" className="rounded" /></td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                      {m.date ? format(new Date(m.date), 'dd/MM/yyyy', { locale: fr }) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 truncate max-w-[200px]">{m.title}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <Link to="/sites" className="text-gray-700 hover:text-primary">
                        {m.site_name || '—'}
                      </Link>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <Link to="/agents" className="text-gray-700 hover:text-primary">
                        {m.agent_name || 'Non assigné'}
                      </Link>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <StatusBadge status={m.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Section 3 : Chiffre d'affaires validé & encaissé */}
      <SectionCard
        title="Chiffre d'affaires validé & encaissé"
        dateRange={monthRange}
        onSettings
        linkTo="/facturation"
      >
        <div className="p-6 bg-white">
          <div className="flex flex-wrap items-end justify-between gap-2 mb-6">
            <div>
              <h4 className="text-sm font-semibold text-gray-700">
                Chiffre d'affaires validé & encaissé {monthRange}
              </h4>
              <p className="text-xs text-gray-500 mt-0.5">
                Total : <span className="font-semibold text-gray-900">{totalCA.toLocaleString('fr-FR')} €</span>
                {unpaidInvoices.length > 0 && (
                  <span className="ml-3 text-amber-600">{unpaidInvoices.length} facture(s) en attente</span>
                )}
              </p>
            </div>
            <Link
              to="/facturation"
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Voir la facturation <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={caData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="caGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis
                  dataKey="mois"
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => `${v.toLocaleString('fr-FR')} €`}
                />
                <Tooltip
                  formatter={v => [`${(v || 0).toLocaleString('fr-FR')} €`, 'CA encaissé']}
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="ca"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#caGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </SectionCard>

      {/* FAB — menu d'ajout rapide (vert) */}
      <QuickAddFab isAdmin={isAdmin} />
    </div>
  );
}

/* ---------- FAB vert style image ---------- */
function QuickAddFab({ isAdmin }) {
  const [open, setOpen] = useState(false);
  const actions = [
    { label: 'Mission', to: '/missions' },
    { label: 'Service', to: '/planning' },
    { label: 'Client', to: '/clients' },
    { label: 'Collaborateur', to: '/agents' },
    { label: 'Lead', to: '/leads' },
  ];

  return (
    <div className="fixed bottom-6 right-6 z-30 flex flex-col items-end gap-3">
      {open && (
        <div className="flex flex-col gap-2 bg-white shadow-lg rounded-xl border border-gray-200 p-2 min-w-[180px] animate-in fade-in slide-in-from-bottom-2 duration-200">
          {actions.map(a => (
            <Link
              key={a.to}
              to={a.to}
              onClick={() => setOpen(false)}
              className="px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
            >
              {a.label}
            </Link>
          ))}
        </div>
      )}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-14 h-14 rounded-full bg-[#4CAF50] hover:bg-[#43a047] text-white shadow-lg flex items-center justify-center transition-all hover:scale-105"
        aria-label="Ajouter"
      >
        <Plus className={`w-7 h-7 transition-transform ${open ? 'rotate-45' : ''}`} />
      </button>
    </div>
  );
}