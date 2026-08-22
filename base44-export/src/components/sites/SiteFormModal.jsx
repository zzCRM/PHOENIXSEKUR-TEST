import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import {
  Pencil, Info, X, Maximize2, Palette, Plus, ChevronDown, Crosshair,
  MapPin, Camera, Upload, Trash2, Building2, Info as InfoIcon, Lock,
  Users, Package, FileText, Mountain, Settings, Construction
} from 'lucide-react';
import SiteMap from '@/components/sites/SiteMap';
import AddressAutocomplete from '@/components/shared/AddressAutocomplete';
import SpecialitesTab from '@/components/sites/tabs/SpecialitesTab';
import CollaborateursTab from '@/components/sites/tabs/CollaborateursTab';
import InstructionsTab from '@/components/sites/tabs/InstructionsTab';
import ClesAccesTab from '@/components/sites/tabs/ClesAccesTab';
import ParametresTab from '@/components/sites/tabs/ParametresTab';

const NAV = [
  { id: 'general', label: 'Général', icon: Info },
  { id: 'specialites', label: 'Spécialités & Tarifs', icon: Palette },
  { id: 'collaborateurs', label: 'Collaborateurs', icon: Users },
  { id: 'stock', label: 'Affectations de stock', icon: Package },
  { id: 'instructions', label: 'Instructions', icon: FileText },
  { id: 'cles', label: 'Clés et accès', icon: Lock },
  { id: 'terrain', label: 'Terrain', icon: Mountain },
  { id: 'parametres', label: 'Paramètres', icon: Settings },
];

const TYPES = [
  { value: 'gardiennage', label: 'Gardiennage' },
  { value: 'surveillance', label: 'Surveillance' },
  { value: 'intervention', label: 'Intervention' },
  { value: 'ronde', label: 'Ronde' },
  { value: 'evenementiel', label: 'Événementiel' },
];

function SectionHeader({ icon: Icon, title }) {
  return (
    <div className="flex items-center gap-2.5 mb-5">
      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
        <Icon className="w-3.5 h-3.5 text-primary" />
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
    </div>
  );
}

function ComingSoon({ icon: Icon, title, description }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
        <Construction className="w-6 h-6 text-muted-foreground" />
      </div>
      <p className="font-semibold text-foreground">{title}</p>
      <p className="text-sm text-muted-foreground mt-1 max-w-xs">{description}</p>
      <Badge variant="outline" className="mt-4 text-xs">Bientôt disponible</Badge>
    </div>
  );
}

export default function SiteFormModal({ open, onClose, onSubmit, site, clients = [] }) {
  const [activeTab, setActiveTab] = useState('general');
  const normalize = (s) => ({
    name: '', client_id: '', client_name: '', type: 'gardiennage', status: 'actif',
    address: '', address_complement: '', city: '', postal_code: '', country: 'FRANCE',
    latitude: null, longitude: null, photo_url: '', instructions: '', nfc_tag_id: '', geofence_radius: 200,
    specialites: [], agent_ids: [], pieces_jointes: [], urgences: [], checkpoints_service: [],
    cles: [], alarmes: [], consignes_droits: {}, parametres_envoi: {},
    ...s,
    specialites: s?.specialites || [],
    agent_ids: s?.agent_ids || [],
    pieces_jointes: s?.pieces_jointes || [],
    urgences: s?.urgences || [],
    checkpoints_service: s?.checkpoints_service || [],
    cles: s?.cles || [],
    alarmes: s?.alarmes || [],
    consignes_droits: s?.consignes_droits || {},
    parametres_envoi: s?.parametres_envoi || {},
  });
  const [form, setForm] = useState(() => normalize(site));
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleClientChange = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    update('client_id', clientId);
    if (client) update('client_name', client.company_name);
  };

  const fullAddress = [form.address, form.postal_code, form.city, form.country].filter(Boolean).join(', ');

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await base44.integrations.Core.UploadFile({ file });
      update('photo_url', res.file_url);
      toast.success('Photo ajoutée');
    } catch (err) {
      toast.error('Échec du téléversement');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!form.name) { toast.error('Le nom du site est obligatoire'); setActiveTab('general'); return; }
    if (!form.client_id) { toast.error('Le client est obligatoire : un site doit être rattaché à un client'); setActiveTab('general'); return; }
    onSubmit(form);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[calc(100vw-0.75rem)] max-w-5xl p-0 gap-0 max-h-[100dvh] sm:max-h-[92vh] overflow-hidden flex flex-col [&>button]:hidden">
        <DialogTitle className="sr-only">{site ? 'Modifier le site' : 'Ajout d\'un site'}</DialogTitle>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Pencil className="w-4 h-4 text-primary" />
            </div>
            <h2 className="text-lg font-semibold">{site ? 'Modifier le site' : 'Ajout d\'un site'}</h2>
            <Info className="w-4 h-4 text-muted-foreground ml-1" />
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8"><Maximize2 className="w-4 h-4" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="w-4 h-4" /></Button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">
          {/* Tabs mobiles */}
          <div className="md:hidden flex overflow-x-auto border-b bg-muted/30 shrink-0">
            {NAV.map(item => (
              <button key={item.id} type="button" onClick={() => setActiveTab(item.id)}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 ${activeTab === item.id ? 'border-primary text-primary bg-card' : 'border-transparent text-muted-foreground'}`}>
                <item.icon className="w-3.5 h-3.5" />
                {item.label}
              </button>
            ))}
          </div>

          {/* Sidebar nav desktop */}
          <aside className="hidden md:block w-56 shrink-0 border-r border-border bg-muted/30 overflow-y-auto py-3">
            {NAV.map(item => {
              const active = activeTab === item.id;
              return (
                <button key={item.id} type="button" onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-5 py-2.5 text-sm font-medium transition-all border-l-2 ${active ? 'bg-card border-l-primary text-foreground' : 'border-l-transparent text-muted-foreground hover:bg-card/50 hover:text-foreground'}`}>
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}
          </aside>

          {/* Content */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-3 sm:px-7 py-4 sm:py-6 min-w-0">
            {activeTab === 'general' && (
              <form onSubmit={handleSubmit} className="space-y-8">
                {/* Informations générales */}
                <section>
                  <SectionHeader icon={InfoIcon} title="Informations générales" />
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 sm:gap-6">
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Nom du site *</Label>
                        <div className="relative">
                          <Input value={form.name} onChange={e => update('name', e.target.value)} placeholder="Nom du site" className="pr-10" required />
                          <Palette className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Client *</Label>
                        <Select value={form.client_id} onValueChange={handleClientChange}>
                          <SelectTrigger className="w-full">
                            <div className="flex items-center justify-between w-full">
                              <SelectValue placeholder="Sélectionner un client" />
                            </div>
                          </SelectTrigger>
                          <SelectContent>
                            {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium">Type</Label>
                          <Select value={form.type} onValueChange={v => update('type', v)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium">Statut</Label>
                          <Select value={form.status} onValueChange={v => update('status', v)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="actif">Actif</SelectItem>
                              <SelectItem value="inactif">Inactif</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    {/* Photo upload */}
                    <div className="flex flex-col items-center gap-3 pt-1">
                      <div className="w-28 h-28 rounded-full bg-muted border-2 border-border overflow-hidden flex items-center justify-center">
                        {form.photo_url
                          ? <img src={form.photo_url} alt="site" className="w-full h-full object-cover" />
                          : <Building2 className="w-10 h-10 text-muted-foreground/50" />}
                      </div>
                      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => fileRef.current?.click()} disabled={uploading}>
                          <Camera className="w-3.5 h-3.5" />
                        </Button>
                        <Button type="button" variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => fileRef.current?.click()} disabled={uploading}>
                          <Upload className="w-3.5 h-3.5" />
                        </Button>
                        {form.photo_url && (
                          <Button type="button" variant="outline" size="icon" className="h-8 w-8 rounded-full text-red-500 hover:text-red-600" onClick={() => update('photo_url', '')}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </section>

                {/* Adresse */}
                <section>
                  <SectionHeader icon={MapPin} title="Adresse" />
                  <div className="grid grid-cols-[1fr_280px] gap-6">
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium">Pays</Label>
                          <Input value={form.country || 'FRANCE'} onChange={e => update('country', e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium">Code postal *</Label>
                          <Input value={form.postal_code} onChange={e => update('postal_code', e.target.value)} placeholder="Code postal" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium">Ville *</Label>
                          <Input value={form.city} onChange={e => update('city', e.target.value)} placeholder="Ville" />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Adresse *</Label>
                        <AddressAutocomplete
                          value={form.address}
                          onChange={v => update('address', v)}
                          onPlaceSelect={(p) => {
                            if (p.address) update('address', p.address);
                            if (p.postal_code) update('postal_code', p.postal_code);
                            if (p.city) update('city', p.city);
                            if (p.country) update('country', p.country);
                            if (p.latitude != null) update('latitude', p.latitude);
                            if (p.longitude != null) update('longitude', p.longitude);
                          }}
                          placeholder="Commencez à taper l'adresse..."
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Complément d'adresse</Label>
                        <Input value={form.address_complement} onChange={e => update('address_complement', e.target.value)} placeholder="Complément" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium">Latitude</Label>
                          <Input type="number" step="any" value={form.latitude ?? ''} onChange={e => update('latitude', e.target.value ? parseFloat(e.target.value) : null)} placeholder="Auto" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium">Longitude</Label>
                          <Input type="number" step="any" value={form.longitude ?? ''} onChange={e => update('longitude', e.target.value ? parseFloat(e.target.value) : null)} placeholder="Auto" />
                        </div>
                      </div>
                    </div>

                    <div className="h-64 rounded-lg overflow-hidden">
                      <SiteMap
                        address={fullAddress}
                        lat={form.latitude}
                        lng={form.longitude}
                        onLocate={(la, ln) => { update('latitude', la); update('longitude', ln); }}
                      />
                    </div>
                  </div>
                </section>
              </form>
            )}

            {activeTab === 'specialites' && <SpecialitesTab form={form} update={update} />}
            {activeTab === 'collaborateurs' && <CollaborateursTab form={form} update={update} />}
            {activeTab === 'stock' && (
              <ComingSoon icon={Package} title="Affectations de stock"
                description="Gérez le matériel et les équipements affectés à ce site." />
            )}

            {activeTab === 'instructions' && <InstructionsTab form={form} update={update} />}

            {activeTab === 'cles' && (
              <div className="space-y-6">
                <div className="space-y-1.5 max-w-md">
                  <Label className="text-xs font-medium">Tag NFC du site</Label>
                  <Input value={form.nfc_tag_id || ''} onChange={e => update('nfc_tag_id', e.target.value)} placeholder="ID du tag NFC" />
                  <p className="text-xs text-muted-foreground">Identifiant du tag NFC utilisé pour la prise de service sur ce site.</p>
                </div>
                <ClesAccesTab form={form} update={update} />
              </div>
            )}

            {activeTab === 'terrain' && (
              <section>
                <SectionHeader icon={Mountain} title="Terrain" />
                <div className="space-y-4 max-w-md">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Rayon de géofence (mètres)</Label>
                    <Input type="number" value={form.geofence_radius ?? 200} onChange={e => update('geofence_radius', parseInt(e.target.value) || 200)} />
                    <p className="text-xs text-muted-foreground">Rayon de contrôle géofence autour du site pour la prise de service.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Latitude</Label>
                      <Input type="number" step="any" value={form.latitude ?? ''} onChange={e => update('latitude', e.target.value ? parseFloat(e.target.value) : null)} placeholder="Auto" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Longitude</Label>
                      <Input type="number" step="any" value={form.longitude ?? ''} onChange={e => update('longitude', e.target.value ? parseFloat(e.target.value) : null)} placeholder="Auto" />
                    </div>
                  </div>
                </div>
              </section>
            )}

            {activeTab === 'parametres' && <ParametresTab form={form} update={update} />}
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-3 sm:px-6 py-3 border-t border-border bg-card shrink-0">
          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
            <Info className="w-3.5 h-3.5" />
            Les champs marqués * sont obligatoires
          </div>
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">Annuler</Button>
            <Button onClick={handleSubmit} className="bg-slate-700 hover:bg-slate-800 w-full sm:w-auto text-xs sm:text-sm">
              {site ? 'ENREGISTRER' : 'ENREGISTRER'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}