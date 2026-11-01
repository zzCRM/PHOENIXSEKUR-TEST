import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Loader2, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import NfcScanner from '@/components/nfc/NfcScanner';
import { POINTEAU_STATUTS, normalizeNfcTag } from '@/lib/pointeaux';

const emptyForm = (defaults = {}) => ({
  name: '',
  description: '',
  site_id: '',
  nfc_tag_id: '',
  status: 'brouillon',
  latitude: '',
  longitude: '',
  ...defaults,
});

export default function PointeauFormDialog({ open, onClose, onSave, pointeau, defaults, sites, saving }) {
  const [form, setForm] = useState(emptyForm());
  const [geo, setGeo] = useState('idle');
  const editing = Boolean(pointeau?.id);

  useEffect(() => {
    if (!open) return;
    setForm(pointeau ? emptyForm(pointeau) : emptyForm(defaults));
    setGeo('idle');
  }, [open, pointeau, defaults]);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const hasTag = normalizeNfcTag(form.nfc_tag_id) !== '';
  const statusAllowed = (value) => (value === 'actif' ? hasTag : true);
  const canSave = form.name.trim() && form.site_id && (form.status !== 'actif' || hasTag) && !saving;

  const captureGeo = () => {
    if (!navigator.geolocation) { setGeo('error'); return; }
    setGeo('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        update('latitude', pos.coords.latitude.toFixed(6));
        update('longitude', pos.coords.longitude.toFixed(6));
        setGeo('success');
      },
      () => setGeo('error'),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  };

  const submit = () => {
    const toNumber = (value) => (value === '' || value === null || value === undefined ? null : Number(value));
    onSave({
      name: form.name.trim(),
      description: form.description,
      site_id: form.site_id,
      nfc_tag_id: form.nfc_tag_id.trim(),
      status: form.status,
      latitude: toNumber(form.latitude),
      longitude: toNumber(form.longitude),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) onClose(); }}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-lg max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Modifier le pointeau' : 'Nouveau pointeau NFC'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs mb-1.5 block">Site *</Label>
            <Select value={form.site_id} onValueChange={(value) => update('site_id', value)} disabled={editing}>
              <SelectTrigger data-testid="pointeau-site"><SelectValue placeholder="Sélectionner un site" /></SelectTrigger>
              <SelectContent>
                {sites.map((site) => (
                  <SelectItem key={site.id} value={site.id}>{site.name}{site.client_name ? ` — ${site.client_name}` : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {editing && <p className="text-[11px] text-muted-foreground mt-1">Un pointeau ne peut pas changer de site : créez-en un nouveau et archivez celui-ci.</p>}
          </div>

          <div>
            <Label className="text-xs mb-1.5 block">Nom *</Label>
            <Input data-testid="pointeau-name" value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="Ex : Hall d'entrée" />
          </div>

          <div>
            <Label className="text-xs mb-1.5 block">Description</Label>
            <Textarea rows={2} value={form.description} onChange={(e) => update('description', e.target.value)} placeholder="Où se trouve le tag, consignes de contrôle" />
          </div>

          <div>
            <Label className="text-xs mb-1.5 block">Tag NFC {form.status === 'actif' ? '*' : ''}</Label>
            <NfcScanner value={form.nfc_tag_id} onChange={(id) => setForm((prev) => ({ ...prev, nfc_tag_id: id, status: !editing && prev.status === 'brouillon' ? 'actif' : prev.status }))} compact />
            <Input
              data-testid="pointeau-tag"
              className="mt-2 font-mono text-xs"
              value={form.nfc_tag_id}
              onChange={(e) => setForm((prev) => ({ ...prev, nfc_tag_id: e.target.value, status: !editing && prev.status === 'brouillon' && e.target.value.trim() ? 'actif' : prev.status }))}
              placeholder="Ou saisir l'identifiant du tag (ex : 04:A2:1F:…)"
            />
            {hasTag && <p className="text-[11px] text-muted-foreground mt-1">Les séparateurs « : » et « - » et la casse sont ignorés : le tag doit être unique dans votre société.</p>}
          </div>

          <div className={`border rounded-lg p-3 flex items-center gap-3 ${geo === 'success' ? 'border-green-200 bg-green-50' : geo === 'error' ? 'border-amber-200 bg-amber-50' : 'bg-muted/10'}`}>
            {geo === 'loading' ? <Loader2 className="w-5 h-5 animate-spin text-primary shrink-0" />
              : geo === 'success' ? <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                : geo === 'error' ? <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                  : <MapPin className="w-5 h-5 text-muted-foreground shrink-0" />}
            <div className="flex-1 min-w-0 text-xs">
              {form.latitude !== '' && form.latitude !== null && form.longitude !== '' && form.longitude !== null
                ? <span className="font-mono">{form.latitude}, {form.longitude}</span>
                : <span className="text-muted-foreground">Position GPS de référence (facultative, utile pour contrôler la présence)</span>}
              {geo === 'error' && <p className="text-amber-700 mt-0.5">Position indisponible. Autorisez la localisation du navigateur.</p>}
            </div>
            <Button type="button" size="sm" variant="outline" onClick={captureGeo}>Ma position</Button>
          </div>

          <div>
            <Label className="text-xs mb-1.5 block">Statut</Label>
            <Select value={form.status} onValueChange={(value) => update('status', value)}>
              <SelectTrigger data-testid="pointeau-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                {POINTEAU_STATUTS.map((item) => (
                  <SelectItem key={item.value} value={item.value} disabled={!statusAllowed(item.value)}>
                    {item.label} — {item.hint}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!hasTag && <p className="text-[11px] text-muted-foreground mt-1">Sans tag NFC, le pointeau reste en brouillon : il ne peut être ni ajouté à une ronde ni servir à valider un contrôle.</p>}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="button" data-testid="pointeau-save" disabled={!canSave} onClick={submit}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
