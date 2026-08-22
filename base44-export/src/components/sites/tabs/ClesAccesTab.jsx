import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Key, Bell } from 'lucide-react';

const uid = () => Math.random().toString(36).slice(2, 10);

function ListCard({ icon: Icon, title, items, onAdd, onRemove, onUpdate, fields }) {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-slate-600" />
          <h3 className="text-base font-semibold text-slate-700">{title}</h3>
        </div>
        <Button type="button" size="icon" className="rounded-full bg-primary hover:bg-primary/90 h-8 w-8" onClick={onAdd}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      <div className="px-4 py-3">
        <div className="text-xs text-muted-foreground mb-2">{items.length} élément(s)</div>
        <div className="border-t border-border pt-3">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">La liste est vide</p>
          ) : (
            <div className="space-y-2">
              {items.map((it) => (
                <div key={it.id} className="flex items-center gap-2">
                  {fields.map(f => (
                    <Input key={f.key} value={it[f.key] ?? ''} onChange={e => onUpdate(it.id, f.key, e.target.value)}
                      placeholder={f.placeholder} className="flex-1 h-8" type={f.type || 'text'} />
                  ))}
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => onRemove(it.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ClesAccesTab({ form, update }) {
  const cles = form.cles || [];
  const alarmes = form.alarmes || [];

  const addCle = () => update('cles', [...cles, { id: uid(), name: '', quantite: 1, detenteur: '' }]);
  const updateCle = (id, field, val) => update('cles', cles.map(c => c.id === id ? { ...c, [field]: val } : c));
  const removeCle = (id) => update('cles', cles.filter(c => c.id !== id));

  const addAlarme = () => update('alarmes', [...alarmes, { id: uid(), name: '', code: '' }]);
  const updateAlarme = (id, field, val) => update('alarmes', alarmes.map(a => a.id === id ? { ...a, [field]: val } : a));
  const removeAlarme = (id) => update('alarmes', alarmes.filter(a => a.id !== id));

  return (
    <div className="space-y-6 max-w-2xl">
      <ListCard icon={Key} title="Clés" items={cles}
        onAdd={addCle} onRemove={removeCle} onUpdate={updateCle}
        fields={[
          { key: 'name', placeholder: 'Désignation de la clé' },
          { key: 'detenteur', placeholder: 'Détenteur' },
          { key: 'quantite', placeholder: 'Qté', type: 'number' },
        ]} />
      <ListCard icon={Bell} title="Alarmes" items={alarmes}
        onAdd={addAlarme} onRemove={removeAlarme} onUpdate={updateAlarme}
        fields={[
          { key: 'name', placeholder: 'Désignation de l\'alarme' },
          { key: 'code', placeholder: 'Code' },
        ]} />
    </div>
  );
}