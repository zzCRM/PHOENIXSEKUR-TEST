import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const EMPTY = {
  title: '', site_id: '', site_name: '', client_id: '', client_name: '',
  agent_id: '', agent_name: '', date: '', start_time: '', end_time: '',
  type: 'gardiennage', status: 'planifiee', notes: '', report: '',
};

export default function MissionForm({ open, onClose, onSubmit, mission, agents = [], sites = [], clients = [] }) {
  const [form, setForm] = useState(mission || { ...EMPTY });

  useEffect(() => {
    if (!open) return;
    setForm(mission ? { ...EMPTY, ...mission } : { ...EMPTY });
  }, [mission, open]);

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSiteChange = (siteId) => {
    const site = sites.find(s => s.id === siteId);
    setForm(prev => ({
      ...prev,
      site_id: siteId,
      site_name: site?.name || '',
      client_id: site?.client_id || prev.client_id,
      client_name: site?.client_name || prev.client_name,
    }));
  };

  const handleAgentChange = (agentId) => {
    const agent = agents.find(a => a.id === agentId);
    setForm(prev => ({
      ...prev,
      agent_id: agentId,
      agent_name: agent ? `${agent.first_name} ${agent.last_name}` : '',
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mission ? 'Modifier la mission' : 'Nouvelle mission'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Titre *</Label>
            <Input value={form.title} onChange={e => update('title', e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Site</Label>
              <Select value={form.site_id} onValueChange={handleSiteChange}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>
                  {sites.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Agent</Label>
              <Select value={form.agent_id} onValueChange={handleAgentChange}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>
                  {agents.map(a => <SelectItem key={a.id} value={a.id}>{a.first_name} {a.last_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Date *</Label>
              <Input type="date" value={form.date} onChange={e => update('date', e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Début</Label>
              <Input type="time" value={form.start_time} onChange={e => update('start_time', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Fin</Label>
              <Input type="time" value={form.end_time} onChange={e => update('end_time', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={v => update('type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gardiennage">Gardiennage</SelectItem>
                  <SelectItem value="surveillance">Surveillance</SelectItem>
                  <SelectItem value="intervention">Intervention</SelectItem>
                  <SelectItem value="ronde">Ronde</SelectItem>
                  <SelectItem value="evenementiel">Événementiel</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Statut</Label>
              <Select value={form.status} onValueChange={v => update('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="planifiee">Planifiée</SelectItem>
                  <SelectItem value="en_cours">En cours</SelectItem>
                  <SelectItem value="terminee">Terminée</SelectItem>
                  <SelectItem value="annulee">Annulée</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={e => update('notes', e.target.value)} rows={2} />
          </div>
          <div className="space-y-2">
            <Label>Rapport / Main courante</Label>
            <Textarea value={form.report} onChange={e => update('report', e.target.value)} rows={3} placeholder="Compte-rendu de la mission..." />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit">{mission ? 'Modifier' : 'Créer'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}