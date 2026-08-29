import React from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Pencil, UserX, CalendarX, Trash2, Plus, Receipt, MapPin, Clock, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { qualifyService, serviceDurationHours } from '@/lib/serviceQualification';
import { normalizeDateKey } from '@/lib/recurrenceExpand';

const ACTIONS = [
  { key: 'edit', label: 'Modifier', icon: Pencil },
  { key: 'unassign', label: 'Désaffecter', icon: UserX },
  { key: 'unplan', label: 'Déplanifier', icon: CalendarX },
  { key: 'delete', label: 'Déprogrammer', icon: Trash2 },
  { key: 'devis', label: 'Créer un devis', icon: Plus },
  { key: 'facture', label: 'Créer une facture', icon: Receipt },
];

export default function PlanningVacationSheet({
  open,
  onClose,
  missions = [],
  date,
  feriesMap = {},
  onAction,
}) {
  const day = date || (missions[0]?.date ? new Date(normalizeDateKey(missions[0].date)) : new Date());

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose?.(); }}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85dvh] overflow-y-auto pb-8">
        <SheetHeader className="text-left">
          <SheetTitle className="capitalize">
            {format(day, 'EEEE d MMMM yyyy', { locale: fr })}
          </SheetTitle>
          <SheetDescription>
            {missions.length} vacation{missions.length > 1 ? 's' : ''} — touchez une action
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {missions.map((m) => {
            const q = qualifyService(day, m.start_time, m.end_time, feriesMap);
            const hours = serviceDurationHours(m.start_time, m.end_time);
            return (
              <div key={m.id || `${m.site_id}-${m.start_time}`} className="rounded-xl border border-border p-4 space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  <Badge className="bg-emerald-500 text-white">
                    {m.status === 'en_cours' ? 'En cours' : m.status === 'terminee' ? 'Terminée' : 'Planifié'}
                  </Badge>
                  <Badge variant="outline">{q.label}</Badge>
                </div>
                <p className="font-semibold flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  {m.start_time || '—'} – {m.end_time || '—'}
                  <span className="text-xs text-muted-foreground font-normal">({hours.toFixed(1)} h)</span>
                </p>
                <p className="flex items-start gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                  <span>
                    <span className="font-medium">{m.site_name || 'Site'}</span>
                    {m.client_name && <span className="text-muted-foreground"> · {m.client_name}</span>}
                  </span>
                </p>
                <p className="flex items-center gap-2 text-sm">
                  <User className="w-4 h-4 text-muted-foreground" />
                  {m.agent_name || 'Non assigné'}
                </p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {ACTIONS.map((a) => {
                    const Icon = a.icon;
                    return (
                      <Button
                        key={a.key}
                        type="button"
                        variant={a.key === 'delete' ? 'destructive' : 'outline'}
                        size="sm"
                        className="justify-start gap-2 h-10"
                        onClick={() => onAction?.(a.key, [m])}
                      >
                        <Icon className="w-4 h-4" /> {a.label}
                      </Button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
