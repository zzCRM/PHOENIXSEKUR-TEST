import React, { useState, useMemo } from 'react';
import { MapPin, Trash2, Sparkles, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getCategory } from '@/lib/mainCouranteEvents';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const SEVERITY_DOT = {
  normal: '',
  attention: 'border-l-2 border-l-amber-400',
  urgent: 'border-l-2 border-l-red-500',
};

const shortRef = (id) => (id || '').replace(/auto-/, '').slice(0, 8);

const fmtDateTime = (date, time) => {
  try {
    if (!date) return '';
    const d = new Date(`${date}T${time || '00:00'}`);
    return format(d, 'dd/MM/yyyy HH:mm', { locale: fr });
  } catch { return `${date || ''} ${time || ''}`; }
};

export default function MainCouranteTable({ entries, agentsMap = {}, onDelete }) {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [selected, setSelected] = useState(new Set());

  const pageCount = Math.max(1, Math.ceil(entries.length / rowsPerPage));
  const safePage = Math.min(page, pageCount - 1);
  const slice = entries.slice(safePage * rowsPerPage, (safePage + 1) * rowsPerPage);

  const toggleRow = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  return (
    <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{entries.length} entrée(s)</span>
          {selected.size > 0 && <Badge variant="secondary" className="text-xs">{selected.size} sélectionnée(s)</Badge>}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
              <th className="px-3 py-2.5 w-10"><Checkbox /></th>
              <th className="px-3 py-2.5 text-left font-medium">Date & référence</th>
              <th className="px-3 py-2.5 text-left font-medium">Site & client</th>
              <th className="px-3 py-2.5 text-left font-medium">Type</th>
              <th className="px-3 py-2.5 text-left font-medium">Informations</th>
              <th className="px-3 py-2.5 text-center font-medium w-12">Loc.</th>
              <th className="px-3 py-2.5 text-left font-medium">Service</th>
              <th className="px-3 py-2.5 text-left font-medium">Spécialité</th>
              <th className="px-3 py-2.5 text-left font-medium">Collaborateur</th>
              <th className="px-3 py-2.5 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {slice.length === 0 && (
              <tr>
                <td colSpan={10} className="text-center py-16 text-muted-foreground">
                  <MapPin className="w-10 h-10 mx-auto mb-3 opacity-20" />
                  <p>Aucune entrée pour cette sélection</p>
                </td>
              </tr>
            )}
            {slice.map((e) => {
              const cat = getCategory(e.category);
              const fonction = e.agent_id ? agentsMap[e.agent_id]?.fonction : null;
              const Icon = cat.icon;
              return (
                <tr key={e.id} className={`border-t hover:bg-muted/30 transition-colors ${SEVERITY_DOT[e.severity] || ''}`}>
                  <td className="px-3 py-2.5"><Checkbox checked={selected.has(e.id)} onCheckedChange={() => toggleRow(e.id)} /></td>
                  <td className="px-3 py-2.5 align-top whitespace-nowrap">
                    <div className="font-medium text-foreground">{fmtDateTime(e.date, e.time)}</div>
                    <div className="text-[11px] text-muted-foreground font-mono">#{shortRef(e.id)}</div>
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    <div className="font-medium text-foreground">{e.site_name || '—'}</div>
                    <div className="text-xs text-muted-foreground">{e.client_name || ''}</div>
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    <Badge variant="outline" className={`gap-1 ${cat.color}`}>
                      <Icon className="w-3 h-3" />
                      {e.event_label}
                    </Badge>
                    {e.auto && (
                      <span className="flex items-center gap-0.5 mt-1 text-[10px] text-slate-400"><Sparkles className="w-2.5 h-2.5" />Auto</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 align-top max-w-md">
                    <p className="text-foreground leading-snug whitespace-pre-wrap">{e.content || <span className="text-muted-foreground italic">Aucune description renseignée</span>}</p>
                  </td>
                  <td className="px-3 py-2.5 align-top text-center">
                    {(e.latitude != null && e.longitude != null) ? (
                      <a href={`https://www.openstreetmap.org/?mlat=${e.latitude}&mlon=${e.longitude}&zoom=17`} target="_blank" rel="noreferrer" className="inline-flex">
                        <MapPin className="w-4 h-4 text-primary" />
                      </a>
                    ) : <span className="text-muted-foreground/30">—</span>}
                  </td>
                  <td className="px-3 py-2.5 align-top font-mono text-xs text-muted-foreground">{e.mission_id ? shortRef(e.mission_id) : '—'}</td>
                  <td className="px-3 py-2.5 align-top">
                    {fonction ? <Badge variant="secondary" className="text-xs">{fonction}</Badge> : <span className="text-muted-foreground/30">—</span>}
                  </td>
                  <td className="px-3 py-2.5 align-top text-foreground">{e.agent_name || '—'}</td>
                  <td className="px-3 py-2.5 align-top">
                    {!e.auto && onDelete && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(e.id)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>Lignes par page :</span>
          <select
            value={rowsPerPage}
            onChange={e => { setRowsPerPage(Number(e.target.value)); setPage(0); }}
            className="border rounded px-1.5 py-1 bg-background"
          >
            {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span>{entries.length === 0 ? '0-0 sur 0' : `${safePage * rowsPerPage + 1}-${Math.min((safePage + 1) * rowsPerPage, entries.length)} sur ${entries.length}`}</span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-7 w-7" disabled={safePage === 0} onClick={() => setPage(0)}><ChevronsLeft className="w-3.5 h-3.5" /></Button>
            <Button variant="outline" size="icon" className="h-7 w-7" disabled={safePage === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft className="w-3.5 h-3.5" /></Button>
            <Button variant="outline" size="icon" className="h-7 w-7" disabled={safePage >= pageCount - 1} onClick={() => setPage(p => p + 1)}><ChevronRight className="w-3.5 h-3.5" /></Button>
            <Button variant="outline" size="icon" className="h-7 w-7" disabled={safePage >= pageCount - 1} onClick={() => setPage(pageCount - 1)}><ChevronsRight className="w-3.5 h-3.5" /></Button>
          </div>
        </div>
      </div>
    </div>
  );
}