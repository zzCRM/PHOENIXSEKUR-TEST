import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Clock, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowDown, ArrowUp, Search } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import { useCompany } from '@/lib/useCompany';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { format, parseISO, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';

// Types d'écart
const ECART_TYPES = {
  retard: { label: 'Retard', className: 'bg-[#E6B852] text-white' },
  depart_anticipe: { label: 'Départ anticipé non autorisé', className: 'bg-[#A12D2D] text-white' },
  depassement: { label: 'Dépassement d\'horaires', className: 'bg-[#2563eb] text-white' },
  absence: { label: 'Absence de pointage', className: 'bg-[#4b5563] text-white' },
};

const toMinutes = (t) => {
  if (!t || typeof t !== 'string') return null;
  const [h, m] = t.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
};

const fmtDur = (mins) => {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
};

const fmtDateTime = (dateStr, mins) => {
  if (mins == null) return '';
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  return `${format(parseISO(dateStr), 'dd/MM/yyyy')} ${time}`;
};

// Calcule les écarts d'une prise de service → tableau de lignes
const computeEcarts = (p) => {
  const rows = [];
  const ps = toMinutes(p.planned_start);
  const pe = toMinutes(p.planned_end);
  const as = toMinutes(p.actual_start);
  const ae = toMinutes(p.actual_end);
  const ref = (p.id || '').slice(0, 8);
  const crossesMidnight = pe != null && ps != null && pe <= ps;
  const endDateStr = crossesMidnight ? format(addDays(parseISO(p.date), 1), 'yyyy-MM-dd') : p.date;

  const base = {
    id: p.id,
    agent_name: p.agent_name || '—',
    ref,
    client_site: [p.client_name, p.site_name].filter(Boolean).join(' ') || '—',
    date: p.date,
    dateSort: `${p.date} ${p.planned_start || ''}`,
    plannedStartStr: fmtDateTime(p.date, ps),
    plannedEndStr: fmtDateTime(endDateStr, pe),
    commentaire: p.notes || '',
  };

  // Retard (arrivée après l'heure prévue)
  if (as != null && ps != null && as - ps > 0) {
    rows.push({
      ...base,
      key: `${p.id}-retard`,
      type: 'retard',
      ecartStart: ps,
      ecartEnd: as,
      duration: as - ps,
      horaires: `${fmtDurToTime(ps)} - ${fmtDurToTime(as)} (${fmtDur(as - ps)})`,
    });
  }

  // Départ anticipé non autorisé (fin avant l'heure prévue)
  if (ae != null && pe != null && pe - ae > 0) {
    rows.push({
      ...base,
      key: `${p.id}-depart`,
      type: 'depart_anticipe',
      ecartStart: ae,
      ecartEnd: pe,
      duration: pe - ae,
      horaires: `${fmtDurToTime(ae)} - ${fmtDurToTime(pe)} (${fmtDur(pe - ae)})`,
    });
  }

  // Dépassement d'horaires (fin après l'heure prévue)
  if (ae != null && pe != null && ae - pe > 0) {
    rows.push({
      ...base,
      key: `${p.id}-depassement`,
      type: 'depassement',
      ecartStart: pe,
      ecartEnd: ae,
      duration: ae - pe,
      horaires: `${fmtDurToTime(pe)} - ${fmtDurToTime(ae)} (${fmtDur(ae - pe)})`,
    });
  }

  // Absence de pointage : service terminé/dépassé sans pointage de début
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  if (as == null && p.date < todayStr && p.status !== 'planifie') {
    rows.push({
      ...base,
      key: `${p.id}-absence`,
      type: 'absence',
      ecartStart: ps,
      ecartEnd: pe,
      duration: 0,
      horaires: 'Non pointé',
    });
  }

  return rows;
};

const fmtDurToTime = (mins, dateStr) => {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

export default function EcartsHoraires() {
  const { companyId } = useCompany();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [sortDir, setSortDir] = useState('desc');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const { data: prises = [], isLoading } = useQuery({
    queryKey: ['ecarts_prises', companyId],
    queryFn: () => base44.entities.PriseDeService.filter({ company_id: companyId }, '-date', 1000),
    enabled: !!companyId,
  });

  const allRows = useMemo(() => {
    const rows = [];
    prises.forEach(p => rows.push(...computeEcarts(p)));
    return rows;
  }, [prises]);

  const filtered = useMemo(() => {
    let r = allRows;
    if (typeFilter !== 'all') r = r.filter(x => x.type === typeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(x =>
        x.agent_name.toLowerCase().includes(q) ||
        x.ref.toLowerCase().includes(q) ||
        x.client_site.toLowerCase().includes(q));
    }
    r = [...r].sort((a, b) => sortDir === 'desc'
      ? b.dateSort.localeCompare(a.dateSort)
      : a.dateSort.localeCompare(b.dateSort));
    return r;
  }, [allRows, typeFilter, search, sortDir]);

  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / rowsPerPage));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * rowsPerPage, safePage * rowsPerPage + rowsPerPage);
  const startIdx = total === 0 ? 0 : safePage * rowsPerPage + 1;
  const endIdx = Math.min((safePage + 1) * rowsPerPage, total);

  const counts = useMemo(() => {
    const c = { retard: 0, depart_anticipe: 0, depassement: 0, absence: 0 };
    allRows.forEach(r => { c[r.type] = (c[r.type] || 0) + 1; });
    return c;
  }, [allRows]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader
        title="Écarts horaires"
        subtitle="Suivi des retards, départs anticipés, dépassements et absences de pointage"
      />

      {/* Filtres par type */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setTypeFilter('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${typeFilter === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border hover:bg-muted'}`}
        >
          Tous ({allRows.length})
        </button>
        {Object.entries(ECART_TYPES).map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => setTypeFilter(key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${typeFilter === key ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border hover:bg-muted'}`}
          >
            {cfg.label} ({counts[key] || 0})
          </button>
        ))}
      </div>

      <Card className="p-0 overflow-hidden">
        {/* Recherche */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              placeholder="Rechercher collaborateur, site…"
              className="pl-8"
            />
          </div>
          <span className="text-xs text-muted-foreground hidden sm:block">{total} écart(s)</span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground bg-muted/40">
                <th className="px-4 py-2.5 font-medium">Collaborateur</th>
                <th className="px-4 py-2.5 font-medium">Référence du service</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th
                  className="px-4 py-2.5 font-medium cursor-pointer select-none"
                  onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
                >
                  <span className="inline-flex items-center gap-1">
                    Dates du service
                    {sortDir === 'desc' ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />}
                  </span>
                </th>
                <th className="px-4 py-2.5 font-medium">Horaires / Durée</th>
                <th className="px-4 py-2.5 font-medium">Commentaire</th>
                <th className="px-4 py-2.5 font-medium">Client & Site</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">Chargement…</td></tr>
              )}
              {!isLoading && pageRows.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  <Clock className="w-10 h-10 mx-auto mb-2 opacity-20" />
                  Aucun écart horaire détecté.
                </td></tr>
              )}
              {pageRows.map((r) => (
                <tr key={r.key} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-medium">{r.agent_name}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{r.ref}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${ECART_TYPES[r.type].className}`}>
                      {ECART_TYPES[r.type].label}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">{r.plannedStartStr} - {r.plannedEndStr}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">{r.horaires}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{r.commentaire || '—'}</td>
                  <td className="px-4 py-2.5">{r.client_site}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Lignes par page :</span>
            <select
              value={rowsPerPage}
              onChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(0); }}
              className="border border-border rounded px-1.5 py-1 bg-card"
            >
              {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <span>{total === 0 ? '0-0 sur 0' : `${startIdx}-${endIdx} sur ${total}`}</span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={safePage === 0} onClick={() => setPage(0)}><ChevronsLeft className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={safePage === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={safePage >= pageCount - 1} onClick={() => setPage(p => p + 1)}><ChevronRight className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={safePage >= pageCount - 1} onClick={() => setPage(pageCount - 1)}><ChevronsRight className="w-4 h-4" /></Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}