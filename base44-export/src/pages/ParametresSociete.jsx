import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Save, Upload, Shield, Phone, Mail, MapPin, FileText, CreditCard } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AddressAutocomplete from '@/components/shared/AddressAutocomplete';
import { LEGAL_FORMS } from '@/lib/legalForms';
import { useCompany } from '@/lib/useCompany';
import { toast } from 'sonner';

export default function ParametresSociete() {
  const { companyId, isAdmin } = useCompany();
  const qc = useQueryClient();
  const [form, setForm] = useState({});
  const [uploading, setUploading] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['company_settings', companyId],
    queryFn: () => base44.entities.CompanySettings.filter({ company_id: companyId }),
    enabled: !!companyId,
  });

  useEffect(() => {
    if (settings && settings.length > 0) {
      setForm(settings[0]);
    } else if (companyId) {
      setForm({ company_id: companyId });
    }
  }, [settings, companyId]);

  const saveMut = useMutation({
    mutationFn: async (data) => {
      if (data.id) {
        return base44.entities.CompanySettings.update(data.id, data);
      } else {
        return base44.entities.CompanySettings.create(data);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company_settings'] });
      toast.success('Paramètres sauvegardés');
    },
    onError: (error) => {
      toast.error('Échec de la sauvegarde : ' + (error.message || 'Erreur inconnue'));
    },
  });

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(prev => ({ ...prev, logo_url: file_url }));
    setUploading(false);
  };

  const update = (field, val) => setForm(prev => ({ ...prev, [field]: val }));



  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Paramètres société</h1>
          <p className="text-muted-foreground mt-1">Informations légales et coordonnées de votre société</p>
        </div>
        <Button onClick={() => saveMut.mutate(form)} disabled={saveMut.isPending} className="gap-2">
          <Save className="w-4 h-4" />
          {saveMut.isPending ? 'Sauvegarde...' : 'Sauvegarder'}
        </Button>
      </div>

      <Tabs defaultValue="identite">
        <TabsList className="mb-6">
          <TabsTrigger value="identite">Identité</TabsTrigger>
          <TabsTrigger value="coordonnees">Coordonnées</TabsTrigger>
          <TabsTrigger value="legal">Informations légales</TabsTrigger>
          <TabsTrigger value="bancaire">Banque & Assurance</TabsTrigger>
        </TabsList>

        {/* IDENTITÉ */}
        <TabsContent value="identite">
          <Card className="p-6 space-y-6">
            {/* Logo */}
            <div className="flex items-start gap-6">
              <div className="shrink-0">
                {form.logo_url ? (
                  <img src={form.logo_url} alt="Logo" className="w-24 h-24 rounded-xl object-contain border border-border bg-white p-2" />
                ) : (
                  <div className="w-24 h-24 rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-muted/30">
                    <Building2 className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Logo de la société</Label>
                <label className="cursor-pointer">
                  <Button variant="outline" size="sm" className="gap-2" asChild>
                    <span><Upload className="w-4 h-4" />{uploading ? 'Envoi...' : 'Choisir un logo'}</span>
                  </Button>
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploading} />
                </label>
                <p className="text-xs text-muted-foreground">PNG, JPG recommandé. Apparaîtra sur les rapports PDF.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nom de la société *</Label>
                <Input value={form.company_name || ''} onChange={e => update('company_name', e.target.value)} placeholder="Ma Société de Sécurité" />
              </div>
              <div className="space-y-2">
                <Label>Forme juridique</Label>
                <Select value={form.legal_form || ''} onValueChange={v => update('legal_form', v)}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                  <SelectContent>
                    {LEGAL_FORMS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nom du dirigeant</Label>
                <Input value={form.director_name || ''} onChange={e => update('director_name', e.target.value)} placeholder="Prénom NOM" />
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* COORDONNÉES */}
        <TabsContent value="coordonnees">
          <Card className="p-6 space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><MapPin className="w-4 h-4" />Adresse</Label>
              <AddressAutocomplete
                value={form.address || ''}
                onChange={v => update('address', v)}
                onPlaceSelect={(p) => {
                  if (p.address) update('address', p.address);
                  if (p.postal_code) update('postal_code', p.postal_code);
                  if (p.city) update('city', p.city);
                  if (p.country) update('country', p.country);
                }}
                placeholder="Commencez à taper l'adresse..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ville</Label>
                <Input value={form.city || ''} onChange={e => update('city', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Code postal</Label>
                <Input value={form.postal_code || ''} onChange={e => update('postal_code', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Phone className="w-4 h-4" />Téléphone</Label>
                <Input value={form.phone || ''} onChange={e => update('phone', e.target.value)} placeholder="01 23 45 67 89" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Mail className="w-4 h-4" />Email</Label>
                <Input type="email" value={form.email || ''} onChange={e => update('email', e.target.value)} placeholder="contact@masociete.fr" />
              </div>
              <div className="space-y-2">
                <Label>Site web</Label>
                <Input value={form.website || ''} onChange={e => update('website', e.target.value)} placeholder="https://masociete.fr" />
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* LÉGAL */}
        <TabsContent value="legal">
          <Card className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><FileText className="w-4 h-4" />SIRET</Label>
                <Input value={form.siret || ''} onChange={e => update('siret', e.target.value)} placeholder="123 456 789 00012" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Shield className="w-4 h-4" />N° Autorisation CNAPS</Label>
                <Input value={form.cnaps_number || ''} onChange={e => update('cnaps_number', e.target.value)} placeholder="AUT-000-0000-00-00-00000000000" />
              </div>
              <div className="space-y-2">
                <Label>N° TVA Intracommunautaire</Label>
                <Input value={form.tva_number || ''} onChange={e => update('tva_number', e.target.value)} placeholder="FR 00 123456789" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes / Informations complémentaires</Label>
              <Textarea value={form.notes || ''} onChange={e => update('notes', e.target.value)} rows={4} placeholder="Informations complémentaires..." />
            </div>
          </Card>
        </TabsContent>

        {/* BANCAIRE */}
        <TabsContent value="bancaire">
          <Card className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><CreditCard className="w-4 h-4" />IBAN</Label>
                <Input value={form.iban || ''} onChange={e => update('iban', e.target.value)} placeholder="FR76 0000 0000 0000 0000 0000 000" />
              </div>
              <div className="space-y-2">
                <Label>BIC / SWIFT</Label>
                <Input value={form.bic || ''} onChange={e => update('bic', e.target.value)} placeholder="BNPAFRPP" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label><Shield className="w-4 h-4 inline mr-1" />N° Assurance RC Pro</Label>
                <Input value={form.insurance_number || ''} onChange={e => update('insurance_number', e.target.value)} placeholder="Police n° 0000000" />
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}