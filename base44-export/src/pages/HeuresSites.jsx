import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Filter, Building2, Table as TableIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import DateIntervalPicker from '@/components/shared/DateIntervalPicker';
import HeuresSitesFilter from '@/components/sites/HeuresSitesFilter';
import { useCompany } from '@/lib/useCompany';
import { computeSiteHours } from '@/lib/siteHoursCompute';

const COLS = [
  { key: 'count', label: 'Nombre de services', num: true },
  { key: 'total', label: 'Heures (total)', num: true },
  { key: 'jour', label: 'Heures de jour', num: true },
  { key: 'jour_ferie', label: 'Heures de jour férié', num: true },
  { key: 'nuit', label: 'Heures de nuit', num: true },
  { key: 'nuit_ferie', label: 'Heures de nuit férié', num: true },
  { key: 'dimanche_jour', label: 'Heures dimanche de jour', num: true },
  { key: 'dimanche_jour_ferie', label: 'Heures dimanche de jour férié', num: true },
  { key: 'dimanche_nuit', label: 'Heures dimanche de nuit', num: true },
  { key: 'dimanche_nuit_ferie', label: 'Heures dimanche de nuit férié', num: true },
];

const PAGE_SIZE = 25;
const fmt = (n) => (Number.isFinite(n) ? Math.round(n) : 0);

export default function HeuresSites() {
  const { companyId } = useCompany();
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [sitesPlanifies, setSitesPlanifies] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(0);

  // Filtres appliqués
  const [filters, setFilters] = useState({ clients: new Set(), sites: new Set(), agents: new Set(), specialites: new Set() });

  const { data: missions = [] } = useQuery({
    queryKey: ['missions', companyId],
    queryFn: () => base44.entities.Mission.filter({ company_id: companyId }, '-date', 5000),
    enabled: !!companyId,
  });
  const { data: sites = [] } = useQuery({ queryKey: ['sites', companyId], queryFn: () => base44.entities.Site.filter({ company_id: companyId }), enabled: !!companyId });
  const { data: clients = [] } = useQuery({ queryKey: ['clients', companyId], queryFn: () => base44.entities.Client.filter({ company_id: companyId }), enabled: !!companyId });
  const { data: agents = [] } = useQuery({ queryKey: ['agents', companyId], queryFn: () => base44.entities.Agent.filter({ company_id: companyId }), enabled: !!companyId });

  const sitesMap = useMemo(() => Object.fromEntries(sites.map(s => [s.id, s])), [sites]);

  // Missions filtrées par période + agent + spécialité site
  const filteredMissions = useMemo(() => {
    return missions.filter(m => {
      if (dateRange.start && (m.date || '') < dateRange.start) return false;
      if (dateRange.end && (m.date || '') > dateRange.end) return false;
      if (filters.agents.size && !(m.agent_id && filters.agents.has(m.agent_id))) return false;
      if (filters.specialites.size) {
        const sp = sitesMap[m.site_id]?.specialites || [];
        const names = sp.map(x => x.name);
        if (!names.some(n => filters.specialites.has(n))) return false;
      }
      return true;
    });
  }, [missions, dateRange, filters, sitesMap]);

  const hoursBySite = useMemo(() => computeSiteHours(filteredMissions), [filteredMissions]);

  // Lignes finales (site) avec filtres clients/sites + toggle sites planifiés
  const rows = useMemo(() => {
    let list = Object.values(hoursBySite);
    if (filters.clients.size) list = list.filter(r => r.client_id && filters.clients.has(r.client_id));
    if (filters.sites.size) list = list.filter(r => r.site_id && filters.sites.has(r.site_id));
    if (sitesPlanifies) list = list.filter(r => r.count > 0);
    // Tri par client puis site
    list.sort((a, b) => (a.client_name || '').localeCompare(b.client_name || '') || (a.site_name || '').localeCompare(b.site_name || ''));
    return list;
  }, [hoursBySite, filters, sitesPlanifies]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const pageRows = rows.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);

  // Regroupement par client pour l'affichage
  const grouped = useMemo(() => {
    const g = {};
    pageRows.forEach(r => {
      const k = r.client_id || r.client_name || '—';
      if (!g[k]) g[k] = { client_name: r.client_name || 'Client inconnu', sites: [] };
      g[k].sites.push(r);
    });
    return g;
  }, [pageRows]);

  const activeFilterCount = filters.clients.size + filters.sites.size + filters.agents.size + filters.specialites.size;

  const handleApply = (clients, sitesF, agentsF, specialitesF) => {
    setFilters({ clients, sites: sitesF, agents: agentsF, specialites: specialitesF });
    setPage(0);
  };
  const handleReset = () => { setFilters({ clients: new Set(), sites: new Set(), agents: new Set(), specialites: new Set() }); setPage(0); };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Heures de sites</h1>
          <p className="text-muted-foreground mt-1">Ventilation des heures par site et par type (jour, nuit, férié, dimanche)</p>
        </div>
      </div>

      {/* Toolbar */}
      <Card className="p-3">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
          <label className="flex items-center gap-2.5">
            <span className="text-sm font-medium text-slate-700">Sites planifiés</span>
            <Switch checked={sitesPlanifies} onCheckedChange={setSitesPlanifies} className="data-[state=checked]:bg-emerald-500" />
          </label>
          <DateIntervalPicker dateRange={dateRange} onDateRangeChange={setDateRange} />
          <Button variant="outline" className="gap-2 h-9 relative" onClick={() => setShowFilters(true)}>
            <Filter className="w-4 h-4" />
            <span>FILTRES</span>
            {activeFilterCount > 0 && (
              <span className="ml-1 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-slate-500 text-white text-[11px] font-semibold">{activeFilterCount}</span>
            )}
          </Button>
          <div className="ml-auto flex items-center gap-1 text-slate-400">
            <Button variant="ghost" size="icon" className="h-9 w-9"><TableIcon className="w-4 h-4" /></Button>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1100px]">
            <thead>
              <tr className="bg-slate-50 text-slate-500 border-b">
                <th className="text-left font-semibold px-4 py-3 sticky left-0 bg-slate-50 z-10">Site</th>
                <th className="text-left font-semibold px-4 py-3">Client</th>
                {COLS.map(c => (
                  <th key={c.key} className={`font-semibold px-4 py-3 whitespace-nowrap ${c.num ? 'text-right' : 'text-left'}`}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.keys(grouped).length === 0 ? (
                <tr>
                  <td colSpan={COLS.length + 2} className="px-4 py-16 text-center text-muted-foreground">Aucune donnée pour les filtres sélectionnés.</td>
                </tr>
              ) : Object.entries(grouped).map(([clientId, group]) => (
                <React.Fragment key={clientId}>
                  <tr className="bg-slate-100/70">
                    <td colSpan={COLS.length + 2} className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-slate-500" />
                        <span className="font-semibold text-slate-700">{group.client_name}</span>
                        <span className="text-xs text-slate-400">— {group.sites.length} site(s)</span>
                      </div>
                    </td>
                  </tr>
                  {group.sites.map(r => (
                    <tr key={r.site_id} className="border-b last:border-0 hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-medium text-slate-700 sticky left-0 bg-card z-10">{r.site_name || sitesMap[r.site_id]?.name || '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{r.client_name || '—'}</td>
                      {COLS.map(c => (
                        <td key={c.key} className={`px-4 py-3 ${c.num ? 'text-right tabular-nums text-slate-700' : 'text-slate-600'}`}>{fmt(r[c.key])}</td>
                      ))}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer / pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-3 border-t bg-slate-50">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span>Lignes par page :</span>
            <Select value={String(PAGE_SIZE)} onValueChange={() => {}}>
              <SelectTrigger className="h-8 w-[80px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span>{rows.length === 0 ? '0-0' : `${currentPage * PAGE_SIZE + 1}-${Math.min((currentPage + 1) * PAGE_SIZE, rows.length)}`} sur {rows.length}</span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ChevronLeft className="w-4 h-4" /></Button>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage >= totalPages - 1} onClick={() => setPage(currentPage + 1)}><ChevronRight className="w-4 h-4" /></Button>
            </div>
          </div>
        </div>
      </Card>

      <HeuresSitesFilter
        open={showFilters}
        onOpenChange={setShowFilters}
        filters={filters}
        onApply={handleApply}
        onReset={handleReset}
        clients={clients}
        sites={sites}
        agents={agents}
      />
    </div>
  );
}