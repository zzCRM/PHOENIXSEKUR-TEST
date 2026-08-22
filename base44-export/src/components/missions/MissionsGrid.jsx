import React from 'react';
import { MapPin, User } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Eye, Pencil, ClipboardList, CalendarX, XCircle, Trash2, UserX, Receipt, Ban, FilePlus, FileText, ShoppingCart, MoreVertical } from 'lucide-react';
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

export default function MissionsGrid({ missions = [], sites = [], selected = {}, onToggleRow, onAction }) {
  const siteMap = React.useMemo(() => Object.fromEntries(sites.map(s => [s.id, s])), [sites]);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {missions.map(m => {
        const site = siteMap[m.site_id];
        const addr = site ? `${site.address || ''} ${site.postal_code || ''} ${site.city || ''}`.trim() : '';
        const dur = hoursBetween(m.start_time, m.end_time);
        return (
          <div key={m.id} className="bg-card rounded-xl border p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Checkbox checked={!!selected[m.id]} onCheckedChange={() => onToggleRow(m.id)} />
                <div>
                  <div className="font-semibold leading-tight">{m.client_name || '—'}</div>
                  <div className="text-xs text-muted-foreground">{m.date ? format(new Date(m.date), 'dd MMM yyyy', { locale: fr }) : '—'} {m.start_time || ''}</div>
                </div>
              </div>
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
            </div>
            <div className="text-sm font-medium">{m.title || m.site_name || '—'}</div>
            {addr && <div className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" />{addr}</div>}
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <User className="w-3 h-3" />{m.agent_name || 'Non affecté'}
            </div>
            <div className="flex items-center justify-between gap-2 pt-1 border-t">
              <Badge variant="secondary" className="font-normal">{typeLabels[m.type] || m.type || '—'}</Badge>
              <div className="flex items-center gap-2">
                {dur > 0 && <span className="text-xs font-medium">{String(Math.floor(dur)).padStart(2, '0')}h{String(Math.round((dur % 1) * 60)).padStart(2, '0')}</span>}
                <StatusBadge status={m.status} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}