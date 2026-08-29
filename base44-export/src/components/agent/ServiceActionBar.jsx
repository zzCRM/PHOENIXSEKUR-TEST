import React, { useState } from 'react';
import { AlertTriangle, Lightbulb, LifeBuoy, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { EVENT_TYPES, getEventMeta, CATEGORY_LEGACY_TYPE } from '@/lib/mainCouranteEvents';
import { resolveEmergencyTel } from '@/lib/vacationStatus';
import { dialNumber } from '@/lib/ptiAlarm';
import { useTorch } from '@/lib/useTorch';
import { format } from 'date-fns';

const QUICK = [
  { key: 'incident', label: 'INCIDENT' },
  { key: 'presence', label: 'PRÉSENCE' },
  { key: 'controle', label: 'CONTRÔLE SPÉCIFIQUE' },
  { key: 'logistique', label: 'LOGISTIQUE' },
  { key: 'soin_secours', label: 'SOINS ET SECOURS' },
  { key: 'logistique', label: 'LIVRAISON', prefer: 'entree_marchandise' },
  { key: 'autre', label: 'OBSERVATIONS', prefer: 'observation' },
];

export default function ServiceActionBar({
  site,
  client,
  service,
  companyId,
  agentId,
  agentName,
  onCreateEvent,
}) {
  const { on: flashOn, toggle: toggleFlash } = useTorch();
  const [open, setOpen] = useState(null);
  const [note, setNote] = useState('');
  const [eventType, setEventType] = useState('');

  const tel = resolveEmergencyTel(client, site);
  const types = open?.category ? (EVENT_TYPES[open.category] || []).filter((e) => !e.auto) : [];

  const startQuick = (item, preset) => {
    const list = (EVENT_TYPES[item.key] || []).filter((e) => !e.auto);
    const prefer = preset || item.prefer;
    setEventType(prefer && list.some((e) => e.key === prefer) ? prefer : (list[0]?.key || ''));
    setNote('');
    setOpen({ category: item.key, title: item.label, kind: 'quick' });
  };

  const submit = async (kind) => {
    if (kind === 'renfort' && note.trim().length < 3) {
      toast.error('Indiquez pourquoi vous demandez du renfort.');
      return;
    }
    if (kind === 'quick' && !note.trim()) {
      toast.error('Décrivez l’événement.');
      return;
    }
    const now = format(new Date(), 'HH:mm');
    const today = format(new Date(), 'yyyy-MM-dd');
    if (kind === 'renfort') {
      await onCreateEvent({
        category: 'collaborateur',
        event_type: 'alerte_collaborateur_renfort',
        type: 'incident',
        content: `Demande de renfort — ${note.trim()}`,
        severity: 'urgent',
        date: today,
        time: now,
        alert: true,
        alert_type: 'renfort',
        alert_message: `Renfort demandé par ${agentName} sur ${service.site_name} : ${note.trim()}`,
      });
    } else {
      const meta = getEventMeta(open.category, eventType);
      await onCreateEvent({
        category: open.category,
        event_type: eventType,
        type: CATEGORY_LEGACY_TYPE[open.category] || 'autre',
        content: `${meta.label} — ${note.trim()}`,
        severity: meta.severity,
        date: today,
        time: now,
        alert: meta.severity === 'urgent',
        alert_type: open.category === 'incident' ? 'incident' : open.category,
        alert_message: `${meta.label} — ${agentName} sur ${service.site_name}`,
      });
    }
    setOpen(null);
    setNote('');
    toast.success('Signalement envoyé');
  };

  const callUrgence = () => {
    if (!tel) {
      toast.error('Aucun numéro d’urgence sur la fiche client.');
      return;
    }
    dialNumber(tel);
  };

  return (
    <>
      <div className="grid grid-cols-4 gap-2">
        <button
          type="button"
          onClick={async () => {
            const res = await toggleFlash();
            if (!res.ok) toast.error(res.reason);
          }}
          className={`rounded-xl border p-3 flex flex-col items-center gap-1 text-xs font-medium ${flashOn ? 'bg-amber-100 border-amber-400' : 'bg-card'}`}
        >
          <Lightbulb className={`w-6 h-6 ${flashOn ? 'text-amber-500' : 'text-muted-foreground'}`} />
          Flash
        </button>
        <button type="button" onClick={callUrgence} className="rounded-xl border p-3 flex flex-col items-center gap-1 text-xs font-medium bg-card">
          <Phone className="w-6 h-6 text-red-600" />
          Urgence
        </button>
        <button
          type="button"
          onClick={() => { setNote(''); setOpen({ kind: 'renfort', title: 'Demander du renfort' }); }}
          className="rounded-xl border p-3 flex flex-col items-center gap-1 text-xs font-medium bg-card"
        >
          <LifeBuoy className="w-6 h-6 text-red-500" />
          Renfort
        </button>
        <button type="button" onClick={() => startQuick({ key: 'incident', label: 'INCIDENT' })} className="rounded-xl border p-3 flex flex-col items-center gap-1 text-xs font-medium bg-card">
          <AlertTriangle className="w-6 h-6 text-amber-600" />
          Incident
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {QUICK.map((item) => (
          <Button
            key={`${item.label}-${item.key}`}
            type="button"
            variant="outline"
            className="h-12 justify-between font-semibold tracking-wide"
            onClick={() => startQuick(item)}
          >
            {item.label}
            <span className="text-muted-foreground">›</span>
          </Button>
        ))}
      </div>

      <Dialog open={!!open} onOpenChange={() => setOpen(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{open?.title}</DialogTitle></DialogHeader>
          {open?.kind === 'quick' && types.length > 0 && (
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={eventType} onValueChange={setEventType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {types.map((t) => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1">
            <Label>{open?.kind === 'renfort' ? 'Motif du renfort' : 'Description'}</Label>
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Obligatoire" />
          </div>
          <Button className="w-full h-12" disabled={!companyId || !agentId} onClick={() => submit(open?.kind)}>
            Envoyer
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
