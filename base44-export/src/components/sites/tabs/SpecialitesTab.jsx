import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, GripVertical, DollarSign, ChevronDown, CornerDownLeft } from 'lucide-react';

const uid = () => Math.random().toString(36).slice(2, 10);

const SPECIALITE_PRESETS = [
  'Agent de sécurité incendie (SSIAP 1)',
  'Agent de sécurité incendie (SSIAP 2)',
  'Agent de sécurité incendie (SSIAP 3)',
  'Agent de prévention et de sécurité (APS)',
  'Agent cynophile',
  'Téléopérateur / PC supervision',
  'Rondier',
  'Agent événementiel',
];

export default function SpecialitesTab({ form, update }) {
  const [newName, setNewName] = useState('');

  const specialites = form.specialites || [];

  const addSpecialite = (name) => {
    const label = (name || newName).trim();
    if (!label) return;
    update('specialites', [...specialites, { id: uid(), name: label, instructions: '' }]);
    setNewName('');
  };

  const removeSpecialite = (id) => update('specialites', specialites.filter(s => s.id !== id));
  const updateSpec = (id, field, value) =>
    update('specialites', specialites.map(s => s.id === id ? { ...s, [field]: value } : s));

  const coef = (field, label) => (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-slate-600">{label}</Label>
      <Input
        type="number" step="0.1" min="0"
        value={form[field] ?? ''}
        onChange={e => update(field, e.target.value === '' ? null : parseFloat(e.target.value))}
        placeholder="1"
      />
    </div>
  );

  return (
    <div className="space-y-10">
      {/* Spécialités du site */}
      <section>
        <h3 className="text-base font-semibold text-slate-700 mb-4">Spécialités du site</h3>
        <div className="space-y-2 mb-4">
          <Label className="text-xs font-medium text-slate-600">Ajouter une spécialité</Label>
          <div className="relative">
            <Input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSpecialite())}
              placeholder="Saisir ou choisir une spécialité"
              className="pr-20"
            />
            <Button
              type="button" size="icon"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 w-7 rounded-md bg-primary hover:bg-primary/90"
              onClick={() => addSpecialite()}
            >
              <CornerDownLeft className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {SPECIALITE_PRESETS.map(p => (
              <button key={p} type="button" onClick={() => addSpecialite(p)}
                className="text-xs px-2 py-1 rounded-full border border-border bg-card hover:bg-accent hover:text-accent-foreground text-muted-foreground">
                + {p}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {specialites.map(s => (
            <div key={s.id} className="rounded-lg overflow-hidden border border-border">
              <div className="bg-slate-600 text-white px-4 py-2 flex items-center justify-between">
                <span className="text-sm font-semibold">Spécialités</span>
                <ChevronDown className="w-4 h-4" />
              </div>
              <div className="bg-card p-4 flex gap-3">
                <div className="flex-1">
                  <div className="font-semibold text-sm text-foreground mb-2">{s.name}</div>
                  <Textarea
                    value={s.instructions || ''}
                    onChange={e => updateSpec(s.id, 'instructions', e.target.value)}
                    rows={4}
                    placeholder="Instructions et consignes propres à cette spécialité"
                    maxLength={500000}
                  />
                  <div className="text-right text-xs text-muted-foreground mt-1">
                    {(s.instructions || '').length} / 500000
                  </div>
                </div>
                <div className="flex flex-col gap-2 pt-1">
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7"><GripVertical className="w-4 h-4 text-muted-foreground" /></Button>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600" onClick={() => removeSpecialite(s.id)}><Trash2 className="w-4 h-4" /></Button>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-sky-500"><DollarSign className="w-4 h-4" /></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Tarification des Services */}
      <section>
        <h3 className="text-base font-semibold text-slate-700 mb-4">Tarification des Services</h3>
        <div className="space-y-5">
          <div className="max-w-xs space-y-1.5">
            <Label className="text-xs font-medium text-slate-600">Tarif de jour (€/h)</Label>
            <div className="relative">
              <Input type="number" step="0.01" min="0"
                value={form.tarif_jour ?? ''}
                onChange={e => update('tarif_jour', e.target.value === '' ? null : parseFloat(e.target.value))}
                placeholder="21" />
              <DollarSign className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {coef('coef_nuit', 'Coefficient de nuit')}
            {coef('coef_ferie', 'Coefficient jour férié')}
            {coef('coef_ferie_nuit', 'Coefficient férié de nuit')}
            {coef('coef_dimanche', 'Coefficient dimanche')}
            {coef('coef_dimanche_ferie', 'Coefficient dimanche férié')}
            {coef('coef_dimanche_nuit', 'Coefficient dimanche nuit')}
            {coef('coef_dimanche_ferie_nuit', 'Coefficient dimanche férié nuit')}
          </div>
        </div>
      </section>

      {/* Tarification des Tournées */}
      <section>
        <h3 className="text-base font-semibold text-slate-700 mb-4">Tarification des Tournées</h3>
        <div className="space-y-5">
          <div className="max-w-xs space-y-1.5">
            <Label className="text-xs font-medium text-slate-600">Tarif de jour tournée (€/h)</Label>
            <Input type="number" step="0.01" min="0"
              value={form.tarif_tournee_jour ?? ''}
              onChange={e => update('tarif_tournee_jour', e.target.value === '' ? null : parseFloat(e.target.value))}
              placeholder="21" />
          </div>
          <div className="grid grid-cols-4 gap-3">
            {coef('coef_tournee_nuit', 'Coefficient de nuit')}
            {coef('coef_tournee_ferie', 'Coefficient jour férié')}
            {coef('coef_tournee_dimanche', 'Coefficient dimanche')}
          </div>
        </div>
      </section>
    </div>
  );
}