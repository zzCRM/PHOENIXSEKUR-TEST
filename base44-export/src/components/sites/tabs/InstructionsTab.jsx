import React, { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Paperclip, AlertTriangle, MapPin, Plus, Trash2, Info, FileText } from 'lucide-react';
import { toast } from 'sonner';

const uid = () => Math.random().toString(36).slice(2, 10);

function ToggleRow({ label, checked, onChange }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="text-sm text-slate-700">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export default function InstructionsTab({ form, update }) {
  const fileRef = useRef(null);
  const [newUrgence, setNewUrgence] = useState('');
  const [newCheckpoint, setNewCheckpoint] = useState('');
  const companyId = form.company_id;

  const { data: checkpointsDb = [] } = useQuery({
    queryKey: ['site-checkpoints', companyId, form.id],
    queryFn: () => base44.entities.Ronde.filter({ company_id: companyId, site_id: form.id }, '-updated_date', 100),
    enabled: !!companyId && !!form.id,
  });

  const droits = form.consignes_droits || {};
  const setDroit = (key, val) => update('consignes_droits', { ...droits, [key]: val });
  const pieces = form.pieces_jointes || [];
  const urgences = form.urgences || [];
  const cps = form.checkpoints_service || [];

  const addUrgence = () => {
    const v = newUrgence.trim();
    if (!v) return;
    update('urgences', [...urgences, v]);
    setNewUrgence('');
  };
  const removeUrgence = (i) => update('urgences', urgences.filter((_, idx) => idx !== i));

  const addCheckpoint = () => {
    const v = newCheckpoint.trim();
    if (!v) return;
    update('checkpoints_service', [...cps, { id: uid(), name: v, photo_url: '', actif: true }]);
    setNewCheckpoint('');
  };
  const updateCp = (id, field, val) => update('checkpoints_service', cps.map(c => c.id === id ? { ...c, [field]: val } : c));
  const removeCp = (id) => update('checkpoints_service', cps.filter(c => c.id !== id));

  const handleFile = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    try {
      const urls = [];
      for (const f of files) {
        const res = await base44.integrations.Core.UploadFile({ file: f });
        urls.push(res.file_url);
      }
      update('pieces_jointes', [...pieces, ...urls]);
      toast.success(`${urls.length} fichier(s) ajouté(s)`);
    } catch { toast.error('Échec du téléversement'); }
    finally { if (fileRef.current) fileRef.current.value = ''; }
  };

  return (
    <div className="space-y-8">
      {/* Droits du cahier de consigne */}
      <section>
        <h3 className="text-base font-semibold text-slate-700 mb-4">Droits du cahier de consigne</h3>

        <div className="rounded-lg border border-border bg-card p-4 mb-4">
          <div className="text-sm font-semibold text-slate-700 mb-2">Droits des collaborateurs</div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1">
            <ToggleRow label="Lire le cahier de consigne" checked={droits.collab_lire ?? true} onChange={v => setDroit('collab_lire', v)} />
            <ToggleRow label="Écrire dans le cahier de consigne" checked={droits.collab_ecrire ?? true} onChange={v => setDroit('collab_ecrire', v)} />
            <ToggleRow label="Modifier un message du cahier de consigne" checked={droits.collab_modifier ?? false} onChange={v => setDroit('collab_modifier', v)} />
            <ToggleRow label="Supprimer un message du cahier de consigne" checked={droits.collab_supprimer ?? false} onChange={v => setDroit('collab_supprimer', v)} />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 mb-4">
          <div className="text-sm font-semibold text-slate-700 mb-2">Droits des clients</div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1">
            <ToggleRow label="Lire le cahier de consigne" checked={droits.client_lire ?? true} onChange={v => setDroit('client_lire', v)} />
            <ToggleRow label="Écrire dans le cahier de consigne" checked={droits.client_ecrire ?? false} onChange={v => setDroit('client_ecrire', v)} />
            <ToggleRow label="Modifier un message du cahier de consigne" checked={droits.client_modifier ?? false} onChange={v => setDroit('client_modifier', v)} />
            <ToggleRow label="Supprimer un message du cahier de consigne" checked={droits.client_supprimer ?? false} onChange={v => setDroit('client_supprimer', v)} />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-sm font-semibold text-slate-700 mb-2">Notification des consignes</div>
          <div className="grid grid-cols-1 gap-y-1">
            <ToggleRow label="Notifier les collaborateurs sur site" checked={droits.notif_site ?? true} onChange={v => setDroit('notif_site', v)} />
            <ToggleRow label="Notifier les collaborateurs non planifiables" checked={droits.notif_non_plannable ?? false} onChange={v => setDroit('notif_non_plannable', v)} />
            <ToggleRow label="Notifier les clients" checked={droits.notif_client ?? false} onChange={v => setDroit('notif_client', v)} />
          </div>
        </div>
      </section>

      {/* Pièces jointes */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-slate-700">Pièces jointes</h3>
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <Paperclip className="w-4 h-4" /> Joindre
          </Button>
          <input ref={fileRef} type="file" multiple className="hidden" onChange={handleFile} />
        </div>
        {pieces.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {pieces.map((url, i) => (
              <div key={i} className="flex items-center gap-2 rounded-md border border-border bg-card p-2">
                <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                <a href={url} target="_blank" rel="noreferrer" className="text-xs truncate flex-1 hover:underline">{url.split('/').pop()}</a>
                <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => update('pieces_jointes', pieces.filter((_, idx) => idx !== i))}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Aucune pièce jointe.</p>
        )}
      </section>

      {/* Urgence */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-slate-600" />
          <h3 className="text-base font-semibold text-slate-700">Urgence</h3>
        </div>
        <div className="flex items-center gap-2 mb-3">
          <Input value={newUrgence} onChange={e => setNewUrgence(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addUrgence())}
            placeholder="Numéro(s) d'urgence du site" />
          <Button type="button" size="icon" className="rounded-full bg-primary hover:bg-primary/90 shrink-0" onClick={addUrgence}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        {urgences.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {urgences.map((u, i) => (
              <Badge key={i} variant="outline" className="gap-1.5 py-1 pl-3 pr-1.5">
                {u}
                <button type="button" onClick={() => removeUrgence(i)} className="text-red-500 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
              </Badge>
            ))}
          </div>
        )}
      </section>

      {/* Points de contrôle de début et fin de service */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <MapPin className="w-4 h-4 text-slate-600" />
          <h3 className="text-base font-semibold text-slate-700">Points de contrôle de début et fin de service</h3>
        </div>
        <div className="rounded-lg bg-sky-100 text-sky-900 text-xs p-3 mb-4 flex gap-2">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <span>L'option pointage impose au collaborateur de badger un point de contrôle NFC pour assurer sa prise ou sa fin de service. L'intérêt du pointage est d'imposer une prise/fin de service à un endroit précis du site.</span>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <ToggleRow label="Pointage à l'arrivée sur site" checked={form.pointage_arrivee ?? false} onChange={v => update('pointage_arrivee', v)} />
          <ToggleRow label="Pointage au départ du site" checked={form.pointage_depart ?? false} onChange={v => update('pointage_depart', v)} />
        </div>

        <div className="flex items-center gap-2 mb-3">
          <Input value={newCheckpoint} onChange={e => setNewCheckpoint(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCheckpoint())}
            placeholder="Nom du point de contrôle" />
          <Button type="button" size="icon" className="rounded-full bg-primary hover:bg-primary/90 shrink-0" onClick={addCheckpoint}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        <div className="space-y-2">
          {cps.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun point de contrôle de service défini.</p>
          ) : cps.map(c => (
            <div key={c.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-2.5">
              <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center overflow-hidden">
                {c.photo_url ? <img src={c.photo_url} alt="" className="w-full h-full object-cover" /> : <MapPin className="w-4 h-4 text-muted-foreground" />}
              </div>
              <Input value={c.name} onChange={e => updateCp(c.id, 'name', e.target.value)} className="flex-1 h-8" />
              <Switch checked={c.actif ?? true} onCheckedChange={v => updateCp(c.id, 'actif', v)} />
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => removeCp(c.id)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* Consignes libres (legacy) */}
      <section>
        <h3 className="text-base font-semibold text-slate-700 mb-3">Consignes générales</h3>
        <Textarea value={form.instructions || ''} onChange={e => update('instructions', e.target.value)}
          rows={6} placeholder="Consignes et instructions générales propres à ce site..." />
      </section>
    </div>
  );
}