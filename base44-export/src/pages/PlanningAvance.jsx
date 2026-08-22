import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Search, Plus, CalendarDays, Download, FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  addMonths, subMonths, getDay, isToday
} from 'date-fns';
import { fr } from 'date-fns/locale';
import AjoutServiceModal from '@/components/planning/AjoutServiceModal';
import { buildJoursFeriesMap } from '@/lib/joursFeries';
import { qualifyService, serviceDurationHours } from '@/lib/serviceQualification';
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

const BUCKET_STYLES = {
  jour: 'bg-emerald-500',
  nuit: 'bg-indigo-500',
  dimanche: 'bg-amber-500',
  ferie: 'bg-red-500',
};

function getDayOfWeekLabel(date) {
  return ['D', 'L', 'M', 'M', 'J', 'V', 'S'][getDay(date)];
}

/* ---------- Tooltip de vacation au survol ---------- */
function VacationTooltip({ missions, date, feriesMap, onClose }) {
  if (!missions || missions.length === 0) return null;
  const q = qualifyService(date, missions[0].start_time, missions[0].end_time, feriesMap);
  return (
    <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-gray-800 text-white rounded-lg shadow-xl p-3 text-xs pointer-events-auto">
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-sm">{format(date, 'EEEE d MMM', { locale: fr })}</span>
        <button onClick={onClose} className="text-white/60 hover:text-white"><X className="w-3.5 h-3.5" /></button>
      </div>
      <div className="space-y-2">
        {missions.map((m, i) => (
          <div key={i} className="border-t border-white/10 pt-2 first:border-0 first:pt-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={cn('w-2 h-2 rounded-full', STATUS_COLORS[m.status] || 'bg-emerald-500')} />
              <span className="font-medium">{m.start_time} - {m.end_time}</span>
              <span className="text-white/60 text-[10px]">({serviceDurationHours(m.start_time, m.end_time).toFixed(1)}h)</span>
            </div>
            <div className="text-white/90">{m.agent_name || 'Non assigné'}</div>
            <div className="text-white/60 text-[11px]">{m.site_name || '—'} • {m.client_name || '—'}</div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-white/10">
        <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium text-white', BUCKET_STYLES[q.bucket])}>
          {q.label}
        </span>
        {q.isFerie && <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-600 text-white">Férié</span>}
        {q.isSunday && !q.isFerie && <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-600 text-white">Dimanche</span>}
        {q.isNight && <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-600 text-white">Nuit</span>}
      </div>
    </div>
  );
}

export default function PlanningAvance() {
  const { companyId, isAdmin } = useCompany();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [search, setSearch] = useState('');
  const [showAjoutService, setShowAjoutService] = useState(false);
  const [hoveredCell, setHoveredCell] = useState(null); // { rowKey, dateKey }
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
    queryFn: () => base44.entities.Mission.filter({ company_id: companyId }, '-date', 500),
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

  const filteredGroups = useMemo(() => {
    if (!search) return grouped;
    const s = search.toLowerCase();
    const result = {};
    Object.entries(grouped).forEach(([key, group]) => {
      if (group.client_name.toLowerCase().includes(s)) result[key] = group;
    });
    return result;
  }, [grouped, search]);

  const visibleDays = days;

  const feriesDuMois = useMemo(() => {
    return visibleDays
      .map(d => ({ date: d, name: feriesMap[format(d, 'yyyy-MM-dd')] }))
      .filter(d => d.name);
  }, [visibleDays, feriesMap]);

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
    } catch (e) {
      toast.error('Échec : ' + (e.message || ''));
    }
  };

  return (
    <div className="space-y-5 relative">
      <AjoutServiceModal
        open={showAjoutService}
        onClose={() => { setShowAjoutService(false); setEditMission(null); }}
        defaultDate={format(currentDate, 'yyyy-MM-dd')}
        editMission={editMission}
      />

      {/* En-tête moderne */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
              <CalendarDays className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight capitalize">{format(currentDate, 'MMMM yyyy', { locale: fr })}</h1>
              <p className="text-sm text-muted-foreground">Planning par site et poste — survolez une vacation pour le détail</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Rechercher client..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-44 h-9" />
            </div>
            <div className="flex items-center bg-white border rounded-lg shadow-sm overflow-hidden">
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-none" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="ghost" className="h-9 px-3 rounded-none text-sm font-medium" onClick={() => setCurrentDate(new Date())}>
                Aujourd'hui
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-none" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            {/* Export PDF */}
            <div className="relative">
              <Button variant="outline" className="h-9 gap-2" onClick={() => setExportOpen(v => !v)}>
                <Download className="w-4 h-4" /> Export PDF
              </Button>
              {exportOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setExportOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 bg-white border rounded-lg shadow-lg w-56 py-1">
                    <button onClick={() => handleExport('site')} className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2">
                      <FileText className="w-4 h-4" /> Par site (paysage A4)
                    </button>
                    <button onClick={() => handleExport('collaborateur')} className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2">
                      <FileText className="w-4 h-4" /> Par collaborateur (paysage A4)
                    </button>
                  </div>
                </>
              )}
            </div>

            <Button onClick={() => setShowAjoutService(true)} className="bg-primary hover:bg-primary/90 gap-2 font-semibold h-9">
              <Plus className="w-4 h-4" /> Ajouter
            </Button>
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

      {/* Tableau */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
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
                          const isHovered = hoveredCell && hoveredCell.rowKey === `${siteKey}-${rowLabel}` && hoveredCell.dateKey === dateKey;
                          return (
                            <td
                              key={i}
                              className={cn(
                                "border-b border-r border-border text-center relative",
                                ferie ? 'bg-red-50' : isWeekend ? 'bg-muted/10' : '',
                                isHovered && 'ring-2 ring-primary ring-inset'
                              )}
                              onMouseEnter={() => assigned > 0 && setHoveredCell({ rowKey: `${siteKey}-${rowLabel}`, dateKey, missions: dayMissions, date: day })}
                              onMouseLeave={() => setHoveredCell(null)}
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
                              {isHovered && assigned > 0 && (
                                <VacationTooltip
                                  missions={hoveredCell.missions}
                                  date={hoveredCell.date}
                                  feriesMap={feriesMap}
                                  onClose={() => setHoveredCell(null)}
                                />
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

      {contextMenu && (
        <PlanningContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onAction={(action) => handleContextAction(action, contextMenu.missions)}
        />
      )}

      {/* Légende */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Cellule :</span>
        <div className="flex items-center gap-1.5"><span className="px-1.5 py-0.5 rounded bg-emerald-500 text-white text-[10px] font-bold">1</span><span className="w-px h-3 bg-gray-300" /><span className="px-1.5 py-0.5 rounded bg-emerald-500 text-white text-[10px] font-bold">1</span><span>assignés / requis</span></div>
        <div className="flex items-center gap-1.5"><div className="w-4 h-4 rounded-sm bg-emerald-500" /><span>Planifiée</span></div>
        <div className="flex items-center gap-1.5"><div className="w-4 h-4 rounded-sm bg-emerald-600" /><span>En cours</span></div>
        <div className="flex items-center gap-1.5"><div className="w-4 h-4 rounded-sm bg-teal-400" /><span>Terminée</span></div>
        <div className="flex items-center gap-1.5"><div className="w-4 h-4 rounded-sm bg-gray-400" /><span>Annulée</span></div>
        <div className="flex items-center gap-1.5"><div className="w-4 h-4 rounded-sm bg-red-100 border border-red-300" /><span>Jour férié</span></div>
        <div className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white shadow">!</span><span>Prise de service en retard</span></div>
      </div>

    </div>
  );
}