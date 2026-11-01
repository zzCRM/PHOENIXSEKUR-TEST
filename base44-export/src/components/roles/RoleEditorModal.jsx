import React, { useEffect, useState } from 'react';
import { X, Shield, ShieldCheck, Users, MapPin, Calendar, Wallet, ClipboardCheck, ScanLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { PALETTE, PERIMETRES, ROLE_TEMPLATES, templateByKey } from '@/lib/rolePermissions';
import { cn } from '@/lib/utils';

const ICONS = { Shield, ShieldCheck, Users, MapPin, Calendar, Wallet, ClipboardCheck, ScanLine };

export default function RoleEditorModal({ open, role, onClose, onSave }) {
  const [form, setForm] = useState(blank());
  useEffect(() => {
    if (!open) return;
    setForm(role ? {
      name: role.name || '',
      description: role.description || '',
      color: role.color || PALETTE[0].value,
      icon: role.icon || 'Shield',
      status: role.status || 'actif',
      template: role.template || 'personnalise',
      perimetre: role.perimetre || 'site',
      grants: { ...(role.grants || {}) },
    } : blank());
  }, [open, role]);

  if (!open) return null;
  const applyTemplate = (key) => {
    const template = templateByKey(key);
    setForm((current) => ({
      ...current,
      template: key,
      color: template.color,
      icon: template.icon,
      perimetre: template.perimetre,
      grants: { ...template.grants },
      name: current.name || (key === 'personnalise' ? '' : template.label),
    }));
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/45 sm:py-6 px-0 sm:px-4 overflow-y-auto">
      <div className="bg-[#f7f8fb] sm:rounded-3xl shadow-2xl w-full max-w-3xl flex flex-col h-[100dvh] sm:h-auto sm:max-h-[90vh] overflow-hidden">
        <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-4 bg-[#10192b] text-white">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-[#e4b54a] text-[#1c1403] flex items-center justify-center"><Shield className="w-5 h-5" /></span>
            <div>
              <h2 className="text-lg font-bold">{role ? 'Modifier le rôle' : 'Créer un rôle'}</h2>
              <p className="text-xs text-white/60">Le modèle reste modifiable après sélection.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center" aria-label="Fermer"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <section className="rounded-2xl border bg-white p-4 space-y-3">
            <h3 className="font-semibold text-[#10192b]">Informations du rôle</h3>
            <label className="block text-xs text-slate-500">Nom du rôle
              <Input className="mt-1" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </label>
            <label className="block text-xs text-slate-500">Description
              <Textarea className="mt-1" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
            </label>
            <div>
              <p className="text-xs text-slate-500 mb-2">Couleur</p>
              <div className="flex flex-wrap gap-2">
                {PALETTE.map((item) => (
                  <button key={item.value} type="button" onClick={() => setForm({ ...form, color: item.value })} className={cn('h-8 px-3 rounded-full text-xs text-white', form.color === item.value && 'ring-2 ring-offset-2 ring-[#e4b54a]')} style={{ background: item.value }}>{item.name}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-2">Icône</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(ICONS).map(([name, Icon]) => (
                  <button key={name} type="button" onClick={() => setForm({ ...form, icon: name })} className={cn('w-9 h-9 rounded-xl border flex items-center justify-center', form.icon === name ? 'border-[#e4b54a] bg-[#fffaf0]' : 'border-slate-200')} aria-label={name}><Icon className="w-4 h-4" /></button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Statut actif</span>
              <Switch checked={form.status !== 'inactif'} onCheckedChange={(value) => setForm({ ...form, status: value ? 'actif' : 'inactif' })} className="data-[state=checked]:bg-emerald-500" />
            </div>
          </section>
          <section className="rounded-2xl border bg-white p-4 space-y-3">
            <h3 className="font-semibold text-[#10192b]">Modèle</h3>
            <div className="grid sm:grid-cols-2 gap-2">
              {ROLE_TEMPLATES.map((item) => (
                <button key={item.key} type="button" onClick={() => applyTemplate(item.key)} className={cn('text-left rounded-xl border px-3 py-2 text-sm', form.template === item.key ? 'border-[#e4b54a] bg-[#fffaf0]' : 'border-slate-200')}>
                  {item.label}
                </button>
              ))}
            </div>
            <label className="block text-xs text-slate-500">Périmètre
              <select className="mt-1 w-full h-9 rounded-md border px-3 text-sm" value={form.perimetre} onChange={(event) => setForm({ ...form, perimetre: event.target.value })}>
                {PERIMETRES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </section>
        </div>
        <div className="shrink-0 flex justify-end gap-2 px-4 py-3 border-t bg-white">
          <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
          <Button type="button" className="bg-[#e4b54a] hover:bg-[#d7a63a] text-[#1c1403]" onClick={() => onSave(form)}>Enregistrer le rôle</Button>
        </div>
      </div>
    </div>
  );
}

function blank() {
  return { name: '', description: '', color: PALETTE[1].value, icon: 'Shield', status: 'actif', template: 'personnalise', perimetre: 'site', grants: {} };
}
