import React, { useState } from 'react';
import { MoreVertical, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, MapPin } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Eye, Pencil, ClipboardList, CalendarX, XCircle, Trash2, UserX, Receipt, Ban, FilePlus, FileText, ShoppingCart } from 'lucide-react';
import StatusBadge from '@/components/shared/StatusBadge';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const typeLabels = { gardiennage: 'Gardiennage & Surveillance', surveillance: 'Surveillance', intervention: 'Intervention', ronde: 'Ronde', evenementiel: 'Événementiel' };
const fnLabel = { non_facture: 'Non facturé', facture: 'Facturé', hors_facturation: 'Hors facturation' };

const hoursBetween = (s, e) => {
  if (!s || !e) return 0;
  const [h1, m1] = s.split(':').map(Number);
  const [h2, m2] = e.split(':').map(Number);
  let d = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (d < 0) d += 1440;
  return d / 60;
};

const renderCell = (m, key, siteMap) => {
  const site = siteMap[m.site_id];
  const addr = site ? `${site.address || ''} ${site.postal_code || ''} ${site.city || ''}`.trim() : '';
  const dur = hoursBetween(m.start_time, m.end_time);
  switch (key) {
    case 'date_start':
      return (
        <div className="whitespace-nowrap">
          <div className="font-medium">{m.date ? format(new Date(m.date), 'dd/MM/yyyy', { locale: fr }) : '—'}</div>
          <div className="text-muted-foreground text-xs">{m.start_time || '00:00'}</div>
        </div>
      );
    case 'date_end':
      return <span className="text-muted-foreground whitespace-nowrap">{m.date ? format(new Date(m.date), 'dd/MM/yyyy', { locale: fr }) : '—'} {m.end_time || ''}</span>;
    case 'site_client':
      return (
        <div>
          <div className="font-semibold leading-tight">{m.client_name || '—'}</div>
          <div className="text-muted-foreground text-xs">{m.site_name || '—'}</div>
        </div>
      );
    case 'site_address':
      return addr ? <span className="text-muted-foreground underline decoration-dotted whitespace-nowrap">{addr}</span> : <span className="text-muted-foreground">—</span>;
    case 'agent':
      return <span className="whitespace-nowrap">{m.agent_name || <span className="text-muted-foreground italic">Non affecté</span>}</span>;
    case 'agent_phone':
      return <span className="text-muted-foreground whitespace-nowrap">{(site && site.client_id) ? '' : '—'}</span>;
    case 'specialite':
      return (
        <div className="flex flex-col gap-1">
          <Badge variant="secondary" className="font-normal w-fit">{typeLabels[m.type] || m.type || '—'}</Badge>
          {m.facturation_statut && m.facturation_statut !== 'non_facture' && <Badge variant="outline" className="font-normal w-fit text-xs">{fnLabel[m.facturation_statut]}</Badge>}
        </div>
      );
    case 'poste_title':
      return <span className="text-muted-foreground">{m.title || '—'}</span>;
    case 'status':
      return (
        <div className="flex flex-col gap-1 items-start">
          <StatusBadge status={m.status} />
          {m.facturation_statut === 'facture' && <Badge className="bg-emerald-600 text-white font-normal">Facturé</Badge>}
        </div>
      );
    case 'duration':
      return <span className="whitespace-nowrap font-medium">{dur ? `${String(Math.floor(dur)).padStart(2, '0')}h${String(Math.round((dur % 1) * 60)).padStart(2, '0')}` : '—'}</span>;
    case 'errors':
      return <span className="text-muted-foreground">—</span>;
    case 'pauses_detail':
    case 'retards':
    case 'pauses_total':
    case 'deference':
      return <span className="text-muted-foreground">—</span>;
    default:
      return null;
  }
};

export default function MissionsTable({ missions = [], sites = [], columns = [], allSelected, onToggleAll, selected = {}, onToggleRow, onAction, pageSize = 25, page, onPageChange }) {
  const siteMap = React.useMemo(() => Object.fromEntries(sites.map(s => [s.id, s])), [sites]);
  const visibleCols = columns.filter(c => c.visible);
  const totalPages = Math.max(1, Math.ceil(missions.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * pageSize;
  const pageRows = missions.slice(startIdx, startIdx + pageSize);

  return (
    <div className="bg-card rounded-xl border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 text-muted-foreground">
              <th className="w-10 px-3 py-3 text-left"><Checkbox checked={allSelected} onCheckedChange={onToggleAll} /></th>
              {visibleCols.map(col => (
                <th key={col.key} className="px-3 py-3 text-left font-medium whitespace-nowrap">{col.label}</th>
              ))}
              <th className="w-10 px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 && (
              <tr><td colSpan={visibleCols.length + 2} className="text-center text-muted-foreground py-12">Aucune mission sur cette période.</td></tr>
            )}
            {pageRows.map(m => (
              <tr key={m.id} className="border-t hover:bg-muted/30 transition-colors">
                <td className="px-3 py-3 align-top"><Checkbox checked={!!selected[m.id]} onCheckedChange={() => onToggleRow(m.id)} /></td>
                {visibleCols.map(col => (
                  <td key={col.key} className="px-3 py-3 align-top">{renderCell(m, col.key, siteMap)}</td>
                ))}
                <td className="px-3 py-3 align-top">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem onClick={() => onAction('voir', m)}><Eye className="w-4 h-4 mr-2" />Voir</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onAction('modifier', m)}><Pencil className="w-4 h-4 mr-2" />Modifier</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onAction('mains_courantes', m)}><ClipboardList className="w-4 h-4 mr-2" />Voir mains courantes</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => onAction('deplanifier', m)}><CalendarX className="w-4 h-4 mr-2" />Déplanifier</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onAction('non_realise', m)}><XCircle className="w-4 h-4 mr-2" />Marquer non réalisé</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onAction('deprogrammer', m)}><Trash2 className="w-4 h-4 mr-2" />Déprogrammer</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onAction('desaffecter', m)}><UserX className="w-4 h-4 mr-2" />Désaffecter collaborateur(s)</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => onAction('facture', m)}><Receipt className="w-4 h-4 mr-2" />Marquer facturé</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onAction('hors_facturation', m)}><Ban className="w-4 h-4 mr-2" />Hors facturation</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => onAction('devis', m)}><FilePlus className="w-4 h-4 mr-2" />Générer devis</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onAction('facture_gen', m)}><FileText className="w-4 h-4 mr-2" />Générer factures</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onAction('bon_commande', m)}><ShoppingCart className="w-4 h-4 mr-2" />Bon de commande</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onClick={() => onAction('supprimer', m)}><Trash2 className="w-4 h-4 mr-2" />Supprimer</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination total={missions.length} pageSize={pageSize} page={safePage} totalPages={totalPages} onPageChange={onPageChange} />
    </div>
  );
}

function Pagination({ total, pageSize, page, totalPages, onPageChange }) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-t text-sm text-muted-foreground flex-wrap">
      <div className="flex items-center gap-2">
        <span>Lignes par page :</span>
        <Badge variant="outline" className="font-medium text-foreground">{pageSize}</Badge>
      </div>
      <div className="flex items-center gap-4">
        <span>{from}-{to} sur {total}</span>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 1} onClick={() => onPageChange(1)}><ChevronsLeft className="w-4 h-4" /></Button>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 1} onClick={() => onPageChange(page - 1)}><ChevronLeft className="w-4 h-4" /></Button>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === totalPages} onClick={() => onPageChange(page + 1)}><ChevronRight className="w-4 h-4" /></Button>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === totalPages} onClick={() => onPageChange(totalPages)}><ChevronsRight className="w-4 h-4" /></Button>
        </div>
      </div>
    </div>
  );
}