import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { CheckCircle2, Info, Shield, Plus, Trash2, Users, Building2, MapPin, CreditCard, FileText, User } from 'lucide-react';
import { toast } from 'sonner';
import ClientPortalPermissions, { DEFAULT_PORTAL_PERMS } from '@/components/clients/ClientPortalPermissions';
import AddressAutocomplete from '@/components/shared/AddressAutocomplete';
import { LEGAL_FORMS } from '@/lib/legalForms';
import { useCompany } from '@/lib/useCompany';

const TABS = [
  { key: 'general', label: 'Général', icon: Building2 },
  { key: 'contacts', label: 'Contacts', icon: Users },
  { key: 'adresse', label: 'Adresse', icon: MapPin },
  { key: 'facturation', label: 'Facturation', icon: CreditCard },
  { key: 'acces', label: 'Accès portail', icon: Shield },
];

const PORTAL_DROITS = [
  { key: 'access_planning', label: 'Accès au planning des sites' },
  { key: 'access_factures', label: 'Lister les factures ou les avoirs' },
  { key: 'access_rapports_mission', label: 'Lister les rapports d\'interventions' },
  { key: 'access_main_courante', label: 'Lister les mains courantes' },
  { key: 'access_documents', label: 'Lister mes documents' },
  { key: 'access_demandes', label: 'Créer une demande' },
  { key: 'access_demandes_list', label: 'Lister les demandes de clients' },
  { key: 'access_stock', label: 'Lister les références de stock' },
  { key: 'access_cahier_consignes', label: 'Accès aux cahiers des consignes' },
  { key: 'access_rapports_rondes', label: 'Lister les bons de ronde' },
  { key: 'access_rdl', label: 'Lister les bons de RDL' },
  { key: 'access_audits', label: 'Lister les bons d\'audits et contrôles' },
  { key: 'access_phone', label: 'Accéder au numéro de téléphone des collaborateurs' },
];

const PORTAL_NOTIFS = [
  { key: 'notif_rapport_rondes', label: 'Recevoir les rapports de mains courantes par email' },
  { key: 'notif_bons_intervention', label: 'Recevoir les bons d\'interventions par email' },
  { key: 'notif_rondes_email', label: 'Recevoir les bons de rondes par email' },
  { key: 'notif_rdl_email', label: 'Recevoir les bons de RDL par email' },
  { key: 'notif_audits_email', label: 'Recevoir les bons d\'audits & contrôles par email' },
  { key: 'notif_devis_email', label: 'Recevoir les devis par email' },
  { key: 'notif_factures', label: 'Recevoir les factures par email' },
  { key: 'notif_planning', label: 'Recevoir les plannings par email' },
];

export default function ClientForm({ open, onClose, onSubmit, client }) {
  const { companyId } = useCompany();
  const [tab, setTab] = useState('general');
  const [compteClients, setCompteClients] = useState([{ email: '', role: 'client', has_account: false, invite_sent: false, first_name: '', last_name: '', phone: '', fonction: '' }]);
  const [portalPerms, setPortalPerms] = useState({ ...DEFAULT_PORTAL_PERMS });
  const [portalDroits, setPortalDroits] = useState({});
  const [portalNotifs, setPortalNotifs] = useState({});
  const [creerComptePrincipal, setCreerComptePrincipal] = useState(false);

  const { data: sites = [] } = useQuery({
    queryKey: ['sites', companyId],
    queryFn: () => base44.entities.Site.filter({ company_id: companyId }),
    enabled: !!companyId && open,
  });

  const clientSites = client ? sites.filter(s => s.client_id === client.id) : [];

  const [form, setForm] = useState({
    company_name: '', contact_name: '', email: '', phone: '',
    address: '', city: '', postal_code: '', country: 'FRANCE',
    status: 'actif', notes: '',
    legal_form: '', siret: '', tva_number: '', siren: '', director_name: '',
    payment_delay: '', payment_days: '', iban: '', bic: '',
    identifier: '',
  });

  useEffect(() => {
    if (client) {
      setForm({ country: 'FRANCE', ...client });
      setPortalPerms({ ...DEFAULT_PORTAL_PERMS, ...(client.portal_perms || {}) });
      setCompteClients(client.comptes_clients?.length
        ? client.comptes_clients
        : [{ email: '', role: 'client', has_account: false, invite_sent: false, first_name: '', last_name: '', phone: '', fonction: '' }]);
      setPortalDroits(client.portal_droits || {});
      setPortalNotifs(client.portal_notifs || {});
      setCreerComptePrincipal(false);
    } else {
      setForm({ company_name: '', contact_name: '', email: '', phone: '', address: '', city: '', postal_code: '', country: 'FRANCE', status: 'actif', notes: '', legal_form: '', siret: '', tva_number: '', siren: '', director_name: '', payment_delay: '', payment_days: '', iban: '', bic: '', identifier: '' });
      setPortalPerms({ ...DEFAULT_PORTAL_PERMS });
      setCompteClients([{ email: '', role: 'client', has_account: false, invite_sent: false, first_name: '', last_name: '', phone: '', fonction: '' }]);
      setPortalDroits({});
      setPortalNotifs({});
      setCreerComptePrincipal(false);
    }
    setTab('general');
  }, [client, open]);

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleLogoUpload = async (file) => {
    if (!file) return;
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      update('logo_url', file_url);
      toast.success('Logo téléversé');
    } catch (err) {
      toast.error("Échec du téléversement : " + (err.message || 'Erreur inconnue'));
    }
  };

  const handleSubmit = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const needsAccount = creerComptePrincipal || compteClients.some((c) => c.has_account);
    if (needsAccount) {
      const emails = [
        ...(creerComptePrincipal && form.email ? [form.email] : []),
        ...compteClients.filter((c) => c.has_account && c.email).map((c) => c.email),
      ];
      if (emails.length === 0) {
        toast.error('Indiquez un email pour créer un compte Phoenix Sekur');
        return;
      }
    }
    onSubmit({
      ...form,
      portal_perms: portalPerms,
      comptes_clients: compteClients,
      portal_droits: portalDroits,
      portal_notifs: portalNotifs,
      creer_compte_phoenix: creerComptePrincipal,
    });
  };

  const addCompte = () => setCompteClients(prev => [...prev, { email: '', role: 'client', has_account: false, invite_sent: false, first_name: '', last_name: '', phone: '', fonction: '' }]);
  const removeCompte = (i) => setCompteClients(prev => prev.filter((_, idx) => idx !== i));
  const updateCompte = (i, field, val) => setCompteClients(prev => prev.map((c, idx) => idx === i ? { ...c, [field]: val } : c));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[calc(100vw-0.75rem)] max-w-3xl max-h-[100dvh] sm:max-h-[92vh] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b shrink-0">
          <DialogTitle className="text-base">{client ? `Consultation d'un client — ${client.company_name}` : 'Nouveau client'}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col md:flex-row flex-1 overflow-hidden min-h-0">
          {/* Tabs mobiles */}
          <div className="md:hidden flex overflow-x-auto border-b bg-muted/20 shrink-0">
            {TABS.map(t => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 ${tab === t.key ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-muted-foreground'}`}
              >
                <t.icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            ))}
          </div>

          {/* Left sidebar tabs desktop */}
          <div className="hidden md:block w-44 shrink-0 border-r bg-muted/20 py-3 overflow-y-auto">
            {TABS.map(t => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors text-left ${tab === t.key ? 'bg-primary/10 text-primary font-medium border-r-2 border-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
              >
                <t.icon className="w-4 h-4 shrink-0" />
                {t.label}
                {t.key === 'contacts' && compteClients.filter(c => c.email).length > 0 && (
                  <span className="ml-auto text-xs bg-muted text-muted-foreground rounded-full px-1.5">
                    {compteClients.filter(c => c.email).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-3 sm:px-6 py-4 sm:py-5 min-w-0">

            {/* GÉNÉRAL */}
            {tab === 'general' && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-1.5">
                    <Label>Société *</Label>
                    <Input value={form.company_name} onChange={e => update('company_name', e.target.value)} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>N° identifiant client</Label>
                    <Input value={form.identifier || ''} onChange={e => update('identifier', e.target.value)} placeholder="411-X" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Téléphone</Label>
                    <Input value={form.phone} onChange={e => update('phone', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email</Label>
                    <Input type="email" value={form.email} onChange={e => { update('email', e.target.value); setInviteEmail(e.target.value); }} />
                  </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 items-end">
                  <div className="space-y-1.5">
                    <Label>Logo client</Label>
                    <div className="flex items-center gap-3">
                      {form.logo_url
                        ? <img src={form.logo_url} alt="logo" className="w-12 h-12 rounded-lg object-contain border bg-muted/30" />
                        : <div className="w-12 h-12 rounded-lg border-2 border-dashed flex items-center justify-center text-muted-foreground"><Building2 className="w-5 h-5" /></div>}
                      <div className="flex flex-col gap-1">
                        <label className="text-xs cursor-pointer text-primary font-medium">
                          {form.logo_url ? 'Changer' : 'Téléverser'}
                          <input type="file" accept="image/*" className="hidden" onChange={e => handleLogoUpload(e.target.files?.[0])} />
                        </label>
                        {form.logo_url && (
                          <button type="button" onClick={() => update('logo_url', '')} className="text-xs text-destructive">Retirer</button>
                        )}
                      </div>
                    </div>
                  </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-1.5">
                    <Label>Statut</Label>
                    <Select value={form.status} onValueChange={v => update('status', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="actif">Actif</SelectItem>
                        <SelectItem value="inactif">Inactif</SelectItem>
                        <SelectItem value="prospect">Prospect</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Contact principal</Label>
                    <Input value={form.contact_name} onChange={e => update('contact_name', e.target.value)} />
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3 text-sm flex items-center gap-2"><FileText className="w-4 h-4 text-muted-foreground" /> Informations légales</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-1.5">
                      <Label>Forme juridique</Label>
                      <Select value={form.legal_form || ''} onValueChange={v => update('legal_form', v)}>
                        <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                        <SelectContent>
                          {LEGAL_FORMS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Nom dirigeant</Label>
                      <Input value={form.director_name || ''} onChange={e => update('director_name', e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>SIRET</Label>
                      <Input value={form.siret || ''} onChange={e => update('siret', e.target.value)} placeholder="123 456 789 00012" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>SIREN</Label>
                      <Input value={form.siren || ''} onChange={e => update('siren', e.target.value)} placeholder="123 456 789" />
                    </div>
                    <div className="col-span-2 space-y-1.5">
                      <Label>N° TVA intracommunautaire</Label>
                      <Input value={form.tva_number || ''} onChange={e => update('tva_number', e.target.value)} placeholder="FR 00 123456789" />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Notes</Label>
                  <Textarea value={form.notes} onChange={e => update('notes', e.target.value)} rows={3} />
                </div>

                <div className="flex justify-end gap-3 pt-2 border-t">
                  <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
                  <Button type="submit">{client ? 'Enregistrer' : 'Créer le client'}</Button>
                </div>
              </form>
            )}

            {/* CONTACTS */}
            {tab === 'contacts' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">{compteClients.filter(c => c.email).length} élément(s)</h3>
                  <Button type="button" size="sm" variant="outline" onClick={addCompte} className="gap-1.5">
                    <Plus className="w-3.5 h-3.5" /> Ajouter
                  </Button>
                </div>

                {compteClients.map((compte, i) => (
                  <div key={i} className="border rounded-xl overflow-hidden">
                    {/* Informations générales */}
                    <div className="p-4 space-y-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                          <User className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <span className="font-semibold text-sm">Informations générales</span>
                        {compteClients.length > 1 && (
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive ml-auto" onClick={() => removeCompte(i)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Prénom</Label>
                          <Input value={compte.first_name || ''} onChange={e => updateCompte(i, 'first_name', e.target.value)} placeholder="Prénom" className="h-8" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Nom *</Label>
                          <Input value={compte.last_name || ''} onChange={e => updateCompte(i, 'last_name', e.target.value)} placeholder="Nom" className="h-8" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Fonction</Label>
                          <Input value={compte.fonction || ''} onChange={e => updateCompte(i, 'fonction', e.target.value)} placeholder="Fonction" className="h-8" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Adresse email</Label>
                          <Input type="email" value={compte.email} onChange={e => updateCompte(i, 'email', e.target.value)} placeholder="email@client.fr" className="h-8" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Numéro de téléphone</Label>
                          <Input value={compte.phone || ''} onChange={e => updateCompte(i, 'phone', e.target.value)} placeholder="06..." className="h-8" />
                        </div>
                      </div>
                    </div>

                    {/* Compte portail */}
                    <div className="border-t bg-muted/20 p-4 space-y-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                          <User className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <span className="font-semibold text-sm">Compte</span>
                      </div>
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id={`creer-compte-client-${i}`}
                          checked={!!compte.has_account}
                          onCheckedChange={v => updateCompte(i, 'has_account', !!v)}
                          className="mt-0.5"
                        />
                        <div>
                          <Label htmlFor={`creer-compte-client-${i}`} className="text-sm font-medium cursor-pointer">
                            Créer un compte Phoenix Sekur
                          </Label>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Invitation automatique par email à l&apos;enregistrement (au nom de votre société).
                          </p>
                        </div>
                      </div>
                      {compte.has_account && (
                        <div className="space-y-3">
                          <div>
                            <Label className="text-xs text-muted-foreground mb-1.5 block">Compte Phoenix Sekur®</Label>
                            <div className="flex items-center gap-2 p-2 rounded-lg border bg-background text-sm text-muted-foreground">
                              <span>{compte.email || '—'}</span>
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground mb-1.5 block">Site(s) accessible(s)</Label>
                            <Select value={compte.site_access || 'tous'} onValueChange={v => updateCompte(i, 'site_access', v)}>
                              <SelectTrigger className="h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="tous">Tous les sites</SelectItem>
                                {clientSites.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Droits */}
                          <div className="border rounded-xl p-3 bg-background">
                            <p className="font-semibold text-sm mb-1">Droits</p>
                            <p className="text-xs text-muted-foreground mb-3">Le client aura uniquement accès à ses informations et à celles de ses sites. Il n'aura pas accès aux autres données.</p>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                              {PORTAL_DROITS.map(d => (
                                <div key={d.key} className="flex items-center gap-2">
                                  <Switch
                                    checked={portalDroits[d.key] || false}
                                    onCheckedChange={v => setPortalDroits(prev => ({ ...prev, [d.key]: v }))}
                                    className="scale-75"
                                  />
                                  <span className="text-xs">{d.label}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Mails */}
                          <div className="border rounded-xl p-3 bg-background">
                            <p className="font-semibold text-sm mb-3">Mails</p>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                              {PORTAL_NOTIFS.map(n => (
                                <div key={n.key} className="flex items-center gap-2">
                                  <Switch
                                    checked={portalNotifs[n.key] || false}
                                    onCheckedChange={v => setPortalNotifs(prev => ({ ...prev, [n.key]: v }))}
                                    className="scale-75"
                                  />
                                  <span className="text-xs">{n.label}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {compte.invite_sent && (
                            <div className="flex items-center gap-2 text-green-600 text-xs">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Invitation déjà envoyée à {compte.email}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                <div className="flex justify-end gap-3 pt-2 border-t">
                  <Button variant="outline" onClick={onClose}>Fermer</Button>
                  <Button onClick={handleSubmit}>{client ? 'Enregistrer' : 'Créer le client'}</Button>
                </div>
              </div>
            )}

            {/* ADRESSE */}
            {tab === 'adresse' && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <h3 className="font-semibold text-sm flex items-center gap-2"><MapPin className="w-4 h-4 text-muted-foreground" /> Adresse</h3>
                <div className="space-y-1.5">
                  <Label>Pays</Label>
                  <Input value={form.country || 'FRANCE'} onChange={e => update('country', e.target.value)} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-1.5">
                    <Label>Code postal</Label>
                    <Input value={form.postal_code} onChange={e => update('postal_code', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Ville</Label>
                    <Input value={form.city} onChange={e => update('city', e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Adresse</Label>
                  <AddressAutocomplete
                    value={form.address}
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
                <div className="space-y-1.5">
                  <Label>Complément d'adresse</Label>
                  <Input value={form.address2 || ''} onChange={e => update('address2', e.target.value)} />
                </div>
                <div className="flex justify-end gap-3 pt-2 border-t">
                  <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
                  <Button type="submit">{client ? 'Enregistrer' : 'Créer le client'}</Button>
                </div>
              </form>
            )}

            {/* FACTURATION */}
            {tab === 'facturation' && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <h3 className="font-semibold text-sm flex items-center gap-2"><CreditCard className="w-4 h-4 text-muted-foreground" /> Facturation</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-1.5">
                    <Label>Délai de paiement (jours)</Label>
                    <Input type="number" value={form.payment_delay || ''} onChange={e => update('payment_delay', e.target.value)} placeholder="30" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Nombre de jours du délai de paiement</Label>
                    <Input type="number" value={form.payment_days || ''} onChange={e => update('payment_days', e.target.value)} placeholder="30" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>IBAN</Label>
                    <Input value={form.iban || ''} onChange={e => update('iban', e.target.value)} placeholder="FR76..." />
                  </div>
                  <div className="space-y-1.5">
                    <Label>BIC / SWIFT</Label>
                    <Input value={form.bic || ''} onChange={e => update('bic', e.target.value)} />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-2 border-t">
                  <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
                  <Button type="submit">{client ? 'Enregistrer' : 'Créer le client'}</Button>
                </div>
              </form>
            )}

            {/* ACCÈS PORTAIL */}
            {tab === 'acces' && (
              <div className="space-y-5">
                <ClientPortalPermissions perms={portalPerms} onChange={setPortalPerms} sites={clientSites} />
                <div className="border-t pt-4 space-y-3">
                  <div className="flex items-start gap-3 rounded-xl border border-border p-4 bg-muted/20">
                    <Checkbox
                      id="creer-compte-phoenix-client-principal"
                      checked={creerComptePrincipal}
                      onCheckedChange={(v) => setCreerComptePrincipal(!!v)}
                      className="mt-0.5"
                    />
                    <div className="space-y-1">
                      <Label htmlFor="creer-compte-phoenix-client-principal" className="text-sm font-semibold cursor-pointer">
                        Créer un compte Phoenix Sekur
                      </Label>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Utilise l&apos;email principal de la fiche ({form.email || 'non renseigné'}) et envoie
                        l&apos;invitation automatiquement à l&apos;enregistrement, au nom de votre société.
                        Vous pouvez aussi cocher la case sur chaque contact.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/50 text-xs text-muted-foreground">
                    <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>Le client recevra un lien pour créer son mot de passe et accéder aux modules autorisés.</span>
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-2 border-t">
                  <Button variant="outline" onClick={onClose}>Fermer</Button>
                  <Button onClick={handleSubmit}>{client ? 'Enregistrer' : 'Créer le client'}</Button>
                </div>
              </div>
            )}

          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}