import React, { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Search, Plus, CalendarDays, Download, FileText, LayoutGrid } from 'lucide-react';
import MonthPlanningHome from '@/components/planning/MonthPlanningHome';
import PlanningVacationSheet from '@/components/planning/PlanningVacationSheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  addMonths, subMonths, getDay, isToday, isSameMonth,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import AjoutServiceModal from '@/components/planning/AjoutServiceModal';
import { buildJoursFeriesMap } from '@/lib/joursFeries';
import { serviceDurationHours } from '@/lib/serviceQualification';
import { exportPlanningPdf } from '@/lib/planningPdfExport';
import { cn } from '@/lib/utils';
import { useCompany } from '@/lib/useCompany';
import { useNavigate } from 'react-router-dom';
import PlanningContextMenu from '@/components/planning/PlanningContextMenu';
import { toast } from 'sonner';

const STATUS_COLORS = {
  planifiee: 'bg-emerald-500',
  en_cours: 'bg-emerald-600',
  terminee: 'bg-teal-400',
  annulee: 'bg-gray-400',
};

function getDayOfWeekLabel(date) {
  return ['D', 'L', 'M', 'M', 'J', 'V', 'S'][getDay(date)];
}

export default function PlanningAvance() {
  const { companyId, isAdmin } = useCompany();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [view, setView] = useState('calendrier');
  const [search, setSearch] = useState('');
  const [showAjoutService, setShowAjoutService] = useState(false);
  const [sheet, setSheet] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const year = currentDate.getFullYear();

  const feriesMap = useMemo(() => ({
    ...buildJoursFeriesMap(year),
    ...buildJoursFeriesMap(year - 1),
    ...buildJoursFeriesMap(year + 1),
  }), [year]);

  const { data: missions = [] } = useQuery({
    queryKey: ['missions', companyId],
    queryFn: () => base44.entities.Mission.filter({ company_id: companyId }, '-date', 800),
    enabled: !!companyId,
  });
  const { data: companySettings } = useQuery({
    queryKey: ['companySettings', companyId],
    queryFn: () => base44.entities.CompanySettings.filter({ company_id: companyId }),
    enabled: !!companyId,
  });
  const companyName = companySettings?.[0]?.company_name || '';

  const { data: clients = [] } = useQuery({
    queryKey: ['clients', companyId],
    queryFn: () => base44.entities.Client.filter({ company_id: companyId }),
    enabled: !!companyId,
  });
  const { data: sites = [] } = useQuery({
    queryKey: ['sites', companyId],
    queryFn: () => base44.entities.Site.filter({ company_id: companyId }),
    enabled: !!companyId,
  });
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [contextMenu, setContextMenu] = useState(null);
  const [editMission, setEditMission] = useState(null);

  // Prises de service : détection des retards (début réel > début prévu de +5 min)
  const { data: prises = [] } = useQuery({
    queryKey: ['prisesDeService', companyId],
    queryFn: () => base44.entities.PriseDeService.filter({ company_id: companyId }, '-date', 500),
    enabled: !!companyId,
  });
  const retardByMissionId = useMemo(() => {
    const map = {};
    prises.forEach(p => {
      if (p.mission_id && p.actual_start && p.planned_start) {
        const [ph, pm] = p.planned_start.split(':').map(Number);
        const [ah, am] = p.actual_start.split(':').map(Number);
        const planned = ph * 60 + pm;
        const actual = ah * 60 + am;
        if (actual - planned > 5) map[p.mission_id] = true;
      }
    });
    return map;
  }, [prises]);

  const grouped = useMemo(() => {
    const monthMissions = missions.filter(m => {
      if (!m.date) return false;
      const d = new Date(m.date.split('T')[0]);
      return d >= monthStart && d <= monthEnd;
    });

    const map = {};
    monthMissions.forEach(m => {
      const clientKey = m.client_id || m.client_name || 'unknown';
      if (!map[clientKey]) map[clientKey] = { client_name: m.client_name || 'Client inconnu', client_id: m.client_id, sites: {} };
      const siteKey = m.site_id || m.site_name || 'unknown';
      if (!map[clientKey].sites[siteKey]) map[clientKey].sites[siteKey] = { site_name: m.site_name || 'Site inconnu', site_id: m.site_id, rows: {} };
      const rowLabel = m.start_time && m.end_time ? `${m.start_time}-${m.end_time}` : 'Non défini';
      if (!map[clientKey].sites[siteKey].rows[rowLabel]) {
        map[clientKey].sites[siteKey].rows[rowLabel] = { label: rowLabel, start_time: m.start_time, end_time: m.end_time, type: m.type, agent_name: m.agent_name, byDate: {} };
      }
      const dateKey = m.date.split('T')[0];
      if (!map[clientKey].sites[siteKey].rows[rowLabel].byDate[dateKey]) {
        map[clientKey].sites[siteKey].rows[rowLabel].byDate[dateKey] = [];
      }
      map[clientKey].sites[siteKey].rows[rowLabel].byDate[dateKey].push(m);
    });

    return map;
  }, [missions, monthStart, monthEnd]);

  const filteredMissions = useMemo(() => {
    if (!search) return missions;
    const s = search.toLowerCase();
    return missions.filter((m) =>
      [m.client_name, m.site_name, m.agent_name, m.title].some((v) => String(v || '').toLowerCase().includes(s)));
  }, [missions, search]);

  const filteredGroups = useMemo(() => {
    if (!search) return grouped;
    const s = search.toLowerCase();
    const result = {};
    Object.entries(grouped).forEach(([key, group]) => {
      const clientHit = group.client_name.toLowerCase().includes(s);
      const sites = {};
      Object.entries(group.sites).forEach(([sk, site]) => {
        if (clientHit || String(site.site_name || '').toLowerCase().includes(s)) sites[sk] = site;
      });
      if (Object.keys(sites).length) result[key] = { ...group, sites };
    });
    return result;
  }, [grouped, search]);

  const visibleDays = days;

  const feriesDuMois = useMemo(() => {
    return visibleDays
      .map(d => ({ date: d, name: feriesMap[format(d, 'yyyy-MM-dd')] }))
      .filter(d => d.name);
  }, [visibleDays, feriesMap]);

  useEffect(() => {
    if (!isSameMonth(selectedDay, currentDate)) {
      setSelectedDay(isSameMonth(new Date(), currentDate) ? new Date() : startOfMonth(currentDate));
    }
  }, [currentDate]);

  const handleExport = async (mode) => {
    if (missions.length === 0) { toast.error('Aucune mission à exporter'); return; }
    try {
      await exportPlanningPdf({ mode, monthDate: currentDate, missions, company: companySettings?.[0] });
      toast.success(`PDF ${mode === 'site' ? 'par site' : 'par collaborateur'} généré`);
    } catch (e) {
      toast.error('Échec export PDF : ' + (e.message || ''));
    }
    setExportOpen(false);
  };

  const handleContextAction = async (action, missions) => {
    const ids = missions.map(m => m.id).filter(Boolean);
    if (ids.length === 0 && action !== 'edit') return;
    try {
      if (action === 'edit') {
        setEditMission(missions[0]);
        setShowAjoutService(true);
        return;
      }
      if (action === 'unassign') {
        await Promise.all(ids.map(id => base44.entities.Mission.update(id, { agent_id: null, agent_name: null })));
        toast.success('Collaborateur désaffecté');
      } else if (action === 'unplan') {
        await Promise.all(ids.map(id => base44.entities.Mission.update(id, { status: 'annulee' })));
        toast.success('Service déplanifié');
      } else if (action === 'delete') {
        await Promise.all(ids.map(id => base44.entities.Mission.delete(id)));
        toast.success('Service déprogrammé');
      } else if (action === 'devis' || action === 'facture') {
        const m = missions[0];
        const hours = serviceDurationHours(m.start_time, m.end_time);
        const client = clients.find(c => c.id === m.client_id);
        const rate = client?.tarification?.taux_horaire_base || 0;
        const ht = +(hours * rate).toFixed(2);
        const isDevis = action === 'devis';
        await base44.entities.Invoice.create({
          invoice_number: `${isDevis ? 'DEV' : 'FAC'}-${Date.now()}`,
          client_id: m.client_id, client_name: m.client_name,
          date: m.date ? m.date.split('T')[0] : format(new Date(), 'yyyy-MM-dd'),
          items: [{ description: `${m.title || 'Service'} — ${m.site_name || ''} (${m.start_time || ''}-${m.end_time || ''})`, quantity: +hours.toFixed(2), unit_price: rate, total: ht }],
          total_ht: ht, tva_rate: 20, total_tva: +(ht * 0.2).toFixed(2), total_ttc: +(ht * 1.2).toFixed(2),
          status: 'brouillon',
          notes: isDevis ? 'Devis issu du planning' : 'Facture issue du planning',
        });
        toast.success(isDevis ? 'Devis créé' : 'Facture créée');
        navigate('/facturation');
      }
      qc.invalidateQueries({ queryKey: ['missions'] });
      setSheet(null);
    } catch (e) {
      toast.error('Échec : ' + (e.message || ''));
    }
  };

  const goToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDay(now);
  };

  return (
    <div className="space-y-4 relative">
      <AjoutServiceModal
        open={showAjoutService}
        onClose={() => { setShowAjoutService(false); setEditMission(null); }}
        defaultDate={format(selectedDay, 'yyyy-MM-dd')}
        editMission={editMission}
      />

      <PlanningVacationSheet
        open={!!sheet}
        onClose={() => setSheet(null)}
        missions={sheet?.missions || []}
        date={sheet?.date}
        feriesMap={feriesMap}
        onAction={(action, list) => handleContextAction(action, list)}
      />

      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight capitalize">
              {format(currentDate, 'MMMM yyyy', { locale: fr })}
            </h1>
            <p className="text-sm text-muted-foreground">Touchez un jour, puis une vacation</p>
          </div>
          <Button onClick={() => setShowAjoutService(true)} className="gap-1.5 h-10 shrink-0">
            <Plus className="w-4 h-4" /> Ajouter
          </Button>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto tabs-scroll pb-0.5">
          <div className="flex rounded-xl border border-border bg-muted/40 p-0.5 shrink-0">
            <button
              type="button"
              onClick={() => setView('calendrier')}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-sm font-medium',
                view === 'calendrier' ? 'bg-background shadow-sm' : 'text-muted-foreground',
              )}
            >
              <CalendarDays className="w-4 h-4" /> Calendrier
            </button>
            <button
              type="button"
              onClick={() => setView('grille')}
              className={cn(
                'hidden xl:inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-sm font-medium',
                view === 'grille' ? 'bg-background shadow-sm' : 'text-muted-foreground',
              )}
            >
              <LayoutGrid className="w-4 h-4" /> Tableau
            </button>
          </div>
          <div className="flex items-center border rounded-xl bg-card overflow-hidden shrink-0">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-none" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="ghost" className="h-9 px-2 rounded-none text-sm" onClick={goToday}>
              Aujourd'hui
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-none" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <div className="relative min-w-[9rem] flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Site, agent, client…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 rounded-xl" />
          </div>
          <div className="relative shrink-0">
            <Button variant="outline" className="h-9 gap-2 rounded-xl" onClick={() => setExportOpen((v) => !v)}>
              <Download className="w-4 h-4" /> <span className="hidden sm:inline">PDF</span>
            </Button>
            {exportOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setExportOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 bg-white border rounded-lg shadow-lg w-56 py-1">
                  <button type="button" onClick={() => handleExport('site')} className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Par site
                  </button>
                  <button type="button" onClick={() => handleExport('collaborateur')} className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Par collaborateur
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Bandeau jours fériés */}
        {feriesDuMois.length > 0 && (
          <div className="flex items-start gap-2 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <span className="font-semibold text-red-700 mt-0.5 shrink-0">Jours fériés :</span>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {feriesDuMois.map((f, i) => (
                <span key={i} className="text-red-700">
                  <span className="font-medium">{format(f.date, 'EEE d MMM', { locale: fr })}</span>
                  <span className="text-red-500/80"> — {f.name}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {view === 'calendrier' && (
        <MonthPlanningHome
          title="Vacations du mois"
          missions={filteredMissions}
          prises={prises}
          sites={sites}
          month={currentDate}
          onMonthChange={setCurrentDate}
          selected={selectedDay}
          onSelect={setSelectedDay}
          feriesMap={feriesMap}
          hideMonthNav
          onAdd={() => setShowAjoutService(true)}
          onOpenMission={(m) => setSheet({ missions: [m], date: selectedDay })}
        />
      )}

      {view === 'grille' && (
      <div className="hidden xl:block overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="text-xs border-collapse w-full">
          <thead>
            <tr className="bg-muted/60">
              <th className="sticky left-0 bg-muted/60 z-10 w-64 min-w-[16rem] px-3 py-2 text-left font-semibold border-b border-r border-border">
                Sites & postes
              </th>
              {visibleDays.map((day, i) => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const ferie = feriesMap[dateKey];
                const isWeekend = getDay(day) === 0 || getDay(day) === 6;
                const today = isToday(day);
                return (
                  <th
                    key={i}
                    className={cn(
                      "w-11 min-w-[2.75rem] text-center border-b border-r border-border py-1 font-medium relative",
                      today && 'bg-primary/20 text-primary',
                      !today && ferie && 'bg-red-50 text-red-700',
                      !today && !ferie && isWeekend && 'bg-muted/40 text-muted-foreground'
                    )}
                    title={ferie ? `${format(day, 'd MMMM', { locale: fr })} — ${ferie}` : ''}
                  >
                    <div className="font-semibold">{format(day, 'd')}</div>
                    <div className="text-[10px] opacity-70">{getDayOfWeekLabel(day)}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {Object.keys(filteredGroups).length === 0 && (
              <tr>
                <td colSpan={visibleDays.length + 1} className="text-center py-16 text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <CalendarDays className="w-10 h-10 text-muted-foreground/40" />
                    <p>Aucune mission ce mois-ci.</p>
                    <Button variant="outline" size="sm" onClick={() => setShowAjoutService(true)} className="mt-2">
                      <Plus className="w-4 h-4" /> Ajouter un service
                    </Button>
                  </div>
                </td>
              </tr>
            )}
            {Object.entries(filteredGroups).map(([clientKey, clientGroup]) => (
              <React.Fragment key={clientKey}>
                <tr className="bg-sidebar/30">
                  <td className="sticky left-0 bg-sidebar/40 z-10 px-3 py-2 font-bold text-foreground border-b border-r border-border">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                      {clientGroup.client_name}
                    </div>
                  </td>
                  {visibleDays.map((day, i) => {
                    const dateKey = format(day, 'yyyy-MM-dd');
                    const ferie = feriesMap[dateKey];
                    const isWeekend = getDay(day) === 0 || getDay(day) === 6;
                    return (
                      <td key={i} className={cn(
                        "border-b border-r border-border",
                        ferie ? 'bg-red-50' : isWeekend ? 'bg-muted/20' : ''
                      )} />
                    );
                  })}
                </tr>
                {Object.entries(clientGroup.sites).map(([siteKey, siteData]) => (
                  <React.Fragment key={siteKey}>
                    <tr className="bg-muted/20">
                      <td className="sticky left-0 bg-muted/30 z-10 px-4 py-1.5 font-semibold text-foreground border-b border-r border-border text-xs">
                        {siteData.site_name}
                      </td>
                      {visibleDays.map((day, i) => {
                        const dateKey = format(day, 'yyyy-MM-dd');
                        const ferie = feriesMap[dateKey];
                        const isWeekend = getDay(day) === 0 || getDay(day) === 6;
                        return (
                          <td key={i} className={cn(
                            "border-b border-r border-border",
                            ferie ? 'bg-red-50' : isWeekend ? 'bg-muted/20' : ''
                          )} />
                        );
                      })}
                    </tr>
                    {Object.entries(siteData.rows).map(([rowLabel, rowData]) => (
                      <tr key={rowLabel} className="hover:bg-muted/10 transition-colors">
                        <td className="sticky left-0 bg-card z-10 px-5 py-2.5 border-b border-r border-border">
                          <div className="font-medium text-foreground">{rowLabel}</div>
                          {rowData.agent_name && <div className="text-muted-foreground text-xs truncate max-w-[200px]">{rowData.agent_name}</div>}
                        </td>
                        {visibleDays.map((day, i) => {
                          const dateKey = format(day, 'yyyy-MM-dd');
                          const dayMissions = rowData.byDate[dateKey] || [];
                          const ferie = feriesMap[dateKey];
                          const isWeekend = getDay(day) === 0 || getDay(day) === 6;
                          const assigned = dayMissions.length;
                          const required = Math.max(1, ...dayMissions.map(m => m.agents_required || 1));
                          const hasRetard = dayMissions.some(m => retardByMissionId[m.id]);
                          return (
                            <td
                              key={i}
                              className={cn(
                                "border-b border-r border-border text-center relative",
                                ferie ? 'bg-red-50' : isWeekend ? 'bg-muted/10' : '',
                              )}
                              onClick={() => assigned > 0 && setSheet({ missions: dayMissions, date: day })}
                              onContextMenu={(e) => {
                                if (assigned > 0) {
                                  e.preventDefault();
                                  setContextMenu({ x: e.clientX, y: e.clientY, missions: dayMissions });
                                }
                              }}
                            >
                              {assigned > 0 && (
                                <div className="flex items-center justify-center h-full py-1.5">
                                  <div
                                    className={cn(
                                      "relative w-full mx-0.5 rounded-md h-10 flex flex-col items-center justify-center text-white font-bold text-[12px] leading-none shadow-sm cursor-pointer",
                                      STATUS_COLORS[dayMissions[0].status] || 'bg-emerald-500'
                                    )}
                                  >
                                    {hasRetard && (
                                      <span
                                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center shadow ring-2 ring-white"
                                        title="Prise de service en retard"
                                      >
                                        !
                                      </span>
                                    )}
                                    <span>{assigned}</span>
                                    <span className="w-4 h-px bg-white/40 my-1" />
                                    <span>{required}</span>
                                  </div>
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      )}

      {contextMenu && (
        <PlanningContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onAction={(action) => handleContextAction(action, contextMenu.missions)}
        />
      )}

      {view === 'grille' && (
      <div className="hidden xl:flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Cellule :</span>
        <div className="flex items-center gap-1.5"><span className="px-1.5 py-0.5 rounded bg-emerald-500 text-white text-[10px] font-bold">1</span><span className="w-px h-3 bg-gray-300" /><span className="px-1.5 py-0.5 rounded bg-emerald-500 text-white text-[10px] font-bold">1</span><span>assignés / requis</span></div>
        <div className="flex items-center gap-1.5"><div className="w-4 h-4 rounded-sm bg-emerald-500" /><span>Planifiée</span></div>
        <div className="flex items-center gap-1.5"><div className="w-4 h-4 rounded-sm bg-emerald-600" /><span>En cours</span></div>
        <div className="flex items-center gap-1.5"><div className="w-4 h-4 rounded-sm bg-teal-400" /><span>Terminée</span></div>
        <div className="flex items-center gap-1.5"><div className="w-4 h-4 rounded-sm bg-gray-400" /><span>Annulée</span></div>
        <div className="flex items-center gap-1.5"><div className="w-4 h-4 rounded-sm bg-red-100 border border-red-300" /><span>Jour férié</span></div>
        <div className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white shadow">!</span><span>Prise de service en retard</span></div>
      </div>
      )}

    </div>
  );
}