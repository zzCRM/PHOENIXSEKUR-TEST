import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Save, Upload, Shield, Phone, Mail, MapPin, FileText, CreditCard, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import AddressAutocomplete from '@/components/shared/AddressAutocomplete';
import { LEGAL_FORMS } from '@/lib/legalForms';
import { useCompany } from '@/lib/useCompany';
import { toast } from 'sonner';

const REPORT_MODULES = [
  { key: 'main_courante', label: 'Main courante' },
  { key: 'rondes', label: 'Rondes' },
  { key: 'incidents', label: 'Incidents / PTI' },
  { key: 'planning', label: 'Planning' },
];

export default function ParametresSociete() {
  const { companyId, isAdmin } = useCompany();
  const qc = useQueryClient();
  const [form, setForm] = useState({});
  const [uploading, setUploading] = useState(false);
  const [testingReport, setTestingReport] = useState(false);

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

  const schedule = form.report_schedule || {};
  const updateSchedule = (field, val) => {
    setForm((prev) => ({
      ...prev,
      report_schedule: {
        enabled: false,
        frequency: 'weekly',
        send_to_clients: true,
        send_to_company: true,
        only_opt_in_clients: true,
        modules: ['main_courante', 'rondes', 'incidents'],
        ...(prev.report_schedule || {}),
        [field]: val,
      },
    }));
  };

  const toggleModule = (key) => {
    const current = schedule.modules || ['main_courante', 'rondes', 'incidents'];
    const next = current.includes(key)
      ? current.filter((k) => k !== key)
      : [...current, key];
    updateSchedule('modules', next);
  };

  const handleTestReport = async () => {
    setTestingReport(true);
    try {
      // Sauvegarder d'abord les paramètres
      await saveMut.mutateAsync(form);
      const res = await base44.reports.runScheduled();
      toast.success(res.message || 'Test d\'envoi lancé');
    } catch (err) {
      toast.error(err.message || 'Échec du test');
    } finally {
      setTestingReport(false);
    }
  };

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
        <TabsList className="mb-6 flex-wrap h-auto">
          <TabsTrigger value="identite">Identité</TabsTrigger>
          <TabsTrigger value="coordonnees">Coordonnées</TabsTrigger>
          <TabsTrigger value="legal">Informations légales</TabsTrigger>
          <TabsTrigger value="bancaire">Banque & Assurance</TabsTrigger>
          <TabsTrigger value="rapports">Rapports clients</TabsTrigger>
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

        {/* RAPPORTS CLIENTS AUTO */}
        <TabsContent value="rapports">
          <Card className="p-6 space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Mail className="w-5 h-5 text-primary" />
                  Envoi automatique des rapports aux clients
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Les clients reçoivent par email un rapport de sécurité selon la fréquence choisie.
                </p>
              </div>
              <Switch
                checked={!!schedule.enabled}
                onCheckedChange={(v) => updateSchedule('enabled', v)}
              />
            </div>

            {schedule.enabled && (
              <div className="space-y-5 border-t pt-5">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><Clock className="w-4 h-4" />Fréquence</Label>
                  <Select
                    value={schedule.frequency || 'weekly'}
                    onValueChange={(v) => updateSchedule('frequency', v)}
                  >
                    <SelectTrigger className="max-w-md">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Quotidien (chaque matin à 7h)</SelectItem>
                      <SelectItem value="weekly">Hebdomadaire (lundi à 7h)</SelectItem>
                      <SelectItem value="monthly">Mensuel (1er du mois à 7h)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label>Contenu du rapport</Label>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {REPORT_MODULES.map((m) => {
                      const checked = (schedule.modules || ['main_courante', 'rondes', 'incidents']).includes(m.key);
                      return (
                        <label key={m.key} className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-muted/30">
                          <Checkbox checked={checked} onCheckedChange={() => toggleModule(m.key)} />
                          <span className="text-sm">{m.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="flex items-center justify-between gap-4 p-3 border rounded-lg">
                    <div>
                      <p className="text-sm font-medium">Envoyer à chaque client</p>
                      <p className="text-xs text-muted-foreground">Email principal + contacts du client</p>
                    </div>
                    <Switch
                      checked={schedule.send_to_clients !== false}
                      onCheckedChange={(v) => updateSchedule('send_to_clients', v)}
                    />
                  </label>

                  <label className="flex items-center justify-between gap-4 p-3 border rounded-lg">
                    <div>
                      <p className="text-sm font-medium">Uniquement clients ayant activé la réception</p>
                      <p className="text-xs text-muted-foreground">
                        Option « Recevoir le rapport auto » dans la fiche client
                      </p>
                    </div>
                    <Switch
                      checked={schedule.only_opt_in_clients !== false}
                      onCheckedChange={(v) => updateSchedule('only_opt_in_clients', v)}
                    />
                  </label>

                  <label className="flex items-center justify-between gap-4 p-3 border rounded-lg">
                    <div>
                      <p className="text-sm font-medium">Copie à la société</p>
                      <p className="text-xs text-muted-foreground">Recevoir aussi le rapport global</p>
                    </div>
                    <Switch
                      checked={!!schedule.send_to_company}
                      onCheckedChange={(v) => updateSchedule('send_to_company', v)}
                    />
                  </label>
                </div>

                {schedule.send_to_company && (
                  <div className="space-y-2">
                    <Label>Email copie société</Label>
                    <Input
                      type="email"
                      value={schedule.company_copy_email || form.email || ''}
                      onChange={(e) => updateSchedule('company_copy_email', e.target.value)}
                      placeholder={form.email || 'contact@societe.fr'}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Emails additionnels (optionnel)</Label>
                  <Input
                    value={schedule.recipients || ''}
                    onChange={(e) => updateSchedule('recipients', e.target.value)}
                    placeholder="responsable@societe.fr, direction@societe.fr"
                  />
                  <p className="text-xs text-muted-foreground">Séparés par des virgules</p>
                </div>

                {schedule.last_sent_date && (
                  <p className="text-xs text-muted-foreground">
                    Dernier envoi automatique : {schedule.last_sent_date}
                  </p>
                )}

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={handleTestReport} disabled={testingReport || saveMut.isPending}>
                    {testingReport ? 'Envoi…' : 'Tester l\'envoi maintenant'}
                  </Button>
                  <p className="text-xs text-muted-foreground self-center">
                    Sauvegarde les paramètres puis envoie immédiatement aux clients éligibles.
                  </p>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}