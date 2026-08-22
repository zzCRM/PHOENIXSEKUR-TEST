import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Check } from 'lucide-react';
import { EVENT_CATEGORIES, EVENT_TYPES, CATEGORY_LEGACY_TYPE, getEventMeta } from '@/lib/mainCouranteEvents';
import { format } from 'date-fns';

export default function MainCouranteFormDialog({ open, onOpenChange, sites, agents }) {
  const qc = useQueryClient();
  const [category, setCategory] = useState('service');
  const [eventType, setEventType] = useState('debut_service');
  const [form, setForm] = useState({
    site_id: '', site_name: '', client_id: '', client_name: '',
    agent_id: '', agent_name: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: format(new Date(), 'HH:mm'),
    severity: 'normal', content: '',
  });

  const createMut = useMutation({
    mutationFn: (data) => base44.entities.MainCourante.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['main_courante'] }); onOpenChange(false); reset(); },
  });

  const reset = () => {
    setCategory('service'); setEventType('debut_service');
    setForm({ site_id: '', site_name: '', client_id: '', client_name: '', agent_id: '', agent_name: '', date: format(new Date(), 'yyyy-MM-dd'), time: format(new Date(), 'HH:mm'), severity: 'normal', content: '' });
  };

  const update = (f, v) => setForm(prev => ({ ...prev, [f]: v }));

  const handleSite = (id) => {
    const s = sites.find(x => x.id === id);
    setForm(prev => ({ ...prev, site_id: id, site_name: s?.name || '', client_id: s?.client_id || '', client_name: s?.client_name || '' }));
  };
  const handleAgent = (id) => {
    const a = agents.find(x => x.id === id);
    setForm(prev => ({ ...prev, agent_id: id, agent_name: a ? `${a.first_name} ${a.last_name}` : '' }));
  };

  const meta = useMemo(() => getEventMeta(category, eventType), [category, eventType]);

  const submit = () => {
    if (!form.site_id || !form.content) return;
    const payload = {
      ...form,
      category,
      event_type: eventType,
      auto: false,
      type: CATEGORY_LEGACY_TYPE[category] || 'autre',
    };
    createMut.mutate(payload);
  };

  const events = EVENT_TYPES[category] || [];

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-primary/10 text-primary"><Sparkles className="w-4 h-4" /></span>
            Nouvelle entrée main courante
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {/* Catégorie */}
          <div className="space-y-2">
            <Label>Catégorie d'événement</Label>
            <div className="flex flex-wrap gap-2">
              {EVENT_CATEGORIES.filter(c => c.key !== 'autre').map(c => {
                const Icon = c.icon;
                const active = category === c.key;
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => { setCategory(c.key); setEventType(EVENT_TYPES[c.key][0]?.key); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-all ${active ? `${c.color} border-transparent shadow-sm ring-2 ring-primary/20` : 'bg-background hover:bg-muted border-border text-muted-foreground'}`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Type d'événement */}
          <div className="space-y-2">
            <Label>Type d'événement</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {events.map(e => {
                const active = eventType === e.key;
                return (
                  <button
                    key={e.key}
                    type="button"
                    onClick={() => setEventType(e.key)}
                    className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm text-left transition-all ${active ? 'bg-primary text-primary-foreground border-transparent shadow-sm' : 'bg-background hover:bg-muted border-border text-foreground'}`}
                  >
                    <span className="flex items-center gap-1.5">
                      {active && <Check className="w-3.5 h-3.5" />}
                      {e.label}
                    </span>
                    {e.auto && <span className={`text-[9px] uppercase font-semibold px-1 py-0.5 rounded ${active ? 'bg-primary-foreground/20' : 'bg-muted'}`}>Auto</span>}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">Gravité suggérée : <span className="font-medium">{meta.severity}</span></p>
          </div>

          {/* Site + Agent */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Site *</Label>
              <Select value={form.site_id} onValueChange={handleSite}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>{sites.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Collaborateur</Label>
              <Select value={form.agent_id} onValueChange={handleAgent}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>{agents.map(a => <SelectItem key={a.id} value={a.id}>{a.first_name} {a.last_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          {/* Date / Heure / Gravité */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={form.date} onChange={e => update('date', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Heure</Label>
              <Input type="time" value={form.time} onChange={e => update('time', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Gravité</Label>
              <Select value={form.severity} onValueChange={v => update('severity', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="attention">Attention</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Contenu *</Label>
            <Textarea rows={3} value={form.content} onChange={e => update('content', e.target.value)} placeholder="Décrivez l'événement..." />
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button onClick={submit} disabled={!form.site_id || !form.content || createMut.isPending}>
              {createMut.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}