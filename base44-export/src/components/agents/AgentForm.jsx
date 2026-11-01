import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  X, User, UserPlus, Shield, Briefcase, Monitor, Settings, Mail, CreditCard, Bell,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import AddressAutocomplete from '@/components/shared/AddressAutocomplete';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useCompany } from '@/lib/useCompany';
import { DEFAULT_DROITS_AGENT, DROITS_AGENT_OPTIONS, mergeAgentDroits } from '@/lib/agentPortal';

const TABS = [
  { key: 'infos', label: 'Informations générales', icon: User },
  { key: 'documents', label: 'Documents & habilitations', icon: Shield },
  { key: 'emploi', label: 'Emploi & contrat', icon: Briefcase },
  { key: 'acces', label: 'Accès & compte', icon: Monitor },
  { key: 'prefs', label: 'Préférences', icon: Settings },
];

const FONCTIONS = ['Agent de sécurité (APS)', 'SSIAP 1', 'SSIAP 2', 'SSIAP 3', 'Chef de poste', 'SST'];
const NATIONALITES = ['Française', 'Union européenne', 'Autre'];
const GOLD = 'bg-[#e4b54a] hover:bg-[#d7a63a] text-[#1c1403]';

const empty = {
  civilite: 'M.',
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  address: '',
  date_naissance: '',
  lieu_naissance: '',
  nationalite: 'Française',
  card_number: '',
  card_expiry: '',
  status: 'actif',
  hire_date: '',
  date_fin_contrat: '',
  fonction: '',
  site_id_defaut: '',
  hourly_rate: '',
  type_employe: 'Employé',
  notes: '',
  photo_url: '',
  acces_espace_agent: true,
};

function daysUntil(value) {
  if (!value) return null;
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return Math.round((date.getTime() - Date.now()) / 86400000);
}

export default function AgentForm({ open, onClose, onSubmit, agent }) {
  const { companyId } = useCompany();
  const [tab, setTab] = useState('infos');
  const [form, setForm] = useState(empty);
  const [droits, setDroits] = useState({ ...DEFAULT_DROITS_AGENT });
  const [agentRole, setAgentRole] = useState('agent');
  const [notifications, setNotifications] = useState({ expiration: true, rappels: true });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (agent) {
      setForm({
        ...empty,
        ...agent,
        hourly_rate: agent.hourly_rate || '',
        civilite: agent.civilite || 'M.',
        nationalite: agent.nationalite || 'Française',
        status: agent.status || 'actif',
        acces_espace_agent: agent.acces_espace_agent !== false,
      });
      setDroits(mergeAgentDroits(agent));
      setAgentRole(agent.role || 'agent');
      setNotifications({ expiration: true, rappels: true, ...(agent.notifications || {}) });
    } else {
      setForm({ ...empty });
      setDroits({ ...DEFAULT_DROITS_AGENT });
      setAgentRole('agent');
      setNotifications({ expiration: true, rappels: true });
    }
    setTab('infos');
  }, [agent, open]);

  const { data: sites = [] } = useQuery({
    queryKey: ['sites', companyId],
    queryFn: () => base44.entities.Site.filter({ company_id: companyId }),
    enabled: !!companyId && open,
  });
  const { data: documents = [] } = useQuery({
    queryKey: ['documents', companyId],
    queryFn: () => base44.entities.Document.filter({ company_id: companyId }),
    enabled: !!companyId && open && !!agent?.id,
  });

  const patch = (partial) => setForm((current) => ({ ...current, ...partial }));
  const agentDocs = documents.filter((item) => item.target_id === agent?.id);
  const cardDays = daysUntil(form.card_expiry);
  const initials = `${form.first_name?.[0] || ''}${form.last_name?.[0] || ''}`.toUpperCase() || '—';
  const fonctionOptions = form.fonction && !FONCTIONS.includes(form.fonction) ? [form.fonction, ...FONCTIONS] : FONCTIONS;
  const habilitations = useMemo(() => {
    const text = `${form.fonction || ''} ${form.notes || ''}`;
    return ['SSIAP 1', 'SSIAP 2', 'SSIAP 3', 'APS', 'SST'].filter((label) => text.toUpperCase().includes(label.replace(' ', '')));
  }, [form.fonction, form.notes]);

  const uploadPhoto = async (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La photo dépasse 5 Mo');
      return;
    }
    setUploading(true);
    try {
      const { file_url: url } = await base44.integrations.Core.UploadFile({ file });
      patch({ photo_url: url });
    } catch (error) {
      toast.error(error.message || 'La photo n’a pas pu être envoyée');
    } finally {
      setUploading(false);
    }
  };

  const save = (draft, forceAccount = false) => {
    const withAccount = !draft && forceAccount;
    if (!form.first_name || !form.last_name) {
      toast.error('Le prénom et le nom sont requis');
      setTab('infos');
      return;
    }
    if (withAccount && !form.email) {
      toast.error('Indiquez l’email professionnel pour créer le compte');
      setTab('infos');
      return;
    }
    onSubmit({
      ...form,
      ...droits,
      hourly_rate: form.hourly_rate ? Number(form.hourly_rate) : undefined,
      role: agentRole,
      droits_portail: droits,
      notifications,
      creer_compte_phoenix: withAccount,
      draft: !!draft,
      acces_espace_agent: form.acces_espace_agent !== false,
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center bg-black/45 p-0 sm:p-4">
      <div className="bg-[#f7f8fb] sm:rounded-3xl shadow-2xl w-full max-w-6xl flex flex-col h-[100dvh] sm:h-[min(940px,calc(100dvh-2rem))] overflow-hidden">
        <div className="shrink-0 flex items-center justify-between gap-3 px-4 sm:px-5 py-4 bg-[#10192b] text-white">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 rounded-xl bg-[#e4b54a] text-[#1c1403] flex items-center justify-center shrink-0">
              <User className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-bold truncate">{agent ? 'Modifier le collaborateur' : 'Nouveau collaborateur'}</h2>
              <p className="text-xs text-white/60">Créer la fiche d’un agent et gérer ses habilitations, documents et accès.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center" aria-label="Fermer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="shrink-0 flex overflow-x-auto bg-white border-b">
          {TABS.map((item) => {
            const Icon = item.icon;
            const active = tab === item.key;
            return (
              <button key={item.key} type="button" onClick={() => setTab(item.key)} className={cn('shrink-0 inline-flex items-center gap-2 px-4 py-3 text-sm border-b-2', active ? 'border-[#e4b54a] text-[#1c1403] font-semibold bg-[#fffaf0]' : 'border-transparent text-slate-500')}>
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5">
          <div className="grid xl:grid-cols-[1fr_280px] gap-4">
            <div className="space-y-4 min-w-0">
              {tab === 'infos' && (
                <>
                  <Card icon={User} title="Identité">
                    <div className="flex flex-col sm:flex-row gap-4 min-w-0">
                      <label className="w-full sm:w-28 h-28 shrink-0 rounded-2xl border border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center text-center text-[11px] text-slate-500 cursor-pointer overflow-hidden">
                        {form.photo_url ? <img src={form.photo_url} alt="" className="w-full h-full object-cover" /> : <><User className="w-6 h-6 mb-1" />{uploading ? 'Envoi…' : 'Ajouter une photo'}<span>JPG, PNG (max. 5 Mo)</span></>}
                        <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => uploadPhoto(event.target.files?.[0])} />
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 min-w-0">
                        <Field label="Civilité">
                          <Select value={form.civilite} onValueChange={(value) => patch({ civilite: value })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="M.">M.</SelectItem>
                              <SelectItem value="Mme">Mme</SelectItem>
                              <SelectItem value="Autre">Autre</SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field label="Prénom *"><Input value={form.first_name} onChange={(event) => patch({ first_name: event.target.value })} /></Field>
                        <Field label="Nom *"><Input value={form.last_name} onChange={(event) => patch({ last_name: event.target.value })} /></Field>
                        <Field label="Date de naissance"><Input type="date" className="min-w-0 max-w-full" value={String(form.date_naissance || '').slice(0, 10)} onChange={(event) => patch({ date_naissance: event.target.value })} /></Field>
                        <Field label="Lieu de naissance"><Input value={form.lieu_naissance || ''} onChange={(event) => patch({ lieu_naissance: event.target.value })} placeholder="Ville, pays" /></Field>
                        <Field label="Nationalité">
                          <Select value={form.nationalite || 'Française'} onValueChange={(value) => patch({ nationalite: value })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {(form.nationalite && !NATIONALITES.includes(form.nationalite) ? [form.nationalite, ...NATIONALITES] : NATIONALITES).map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </Field>
                      </div>
                    </div>
                  </Card>
                  <Card icon={Mail} title="Coordonnées">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
                      <Field label="Email professionnel"><Input type="email" value={form.email || ''} onChange={(event) => patch({ email: event.target.value })} placeholder="email@phoenixsekur.fr" /></Field>
                      <Field label="Téléphone"><Input value={form.phone || ''} onChange={(event) => patch({ phone: event.target.value })} placeholder="06 00 00 00 00" /></Field>
                      <Field label="Adresse">
                        <AddressAutocomplete value={form.address || ''} onChange={(value) => patch({ address: value })} onPlaceSelect={(place) => patch({ address: place.address || form.address, postal_code: place.postal_code, city: place.city })} />
                      </Field>
                    </div>
                    <div className="rounded-xl border border-[#e4b54a]/50 bg-[#fffaf0] p-3 flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[#1c1403]">Compte du collaborateur</p>
                        <p className="text-xs text-slate-600 mt-0.5">Envoie un lien d’invitation à l’email professionnel. La personne ouvre ce lien et appuie sur « Créer mon compte ».</p>
                      </div>
                      <Button type="button" onClick={() => save(false, true)} className={cn(GOLD, 'shrink-0')}>
                        <UserPlus className="w-4 h-4 mr-2" />
                        Créer le compte
                      </Button>
                    </div>
                  </Card>
                  <Card icon={CreditCard} title="Identifiants professionnels">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
                      <Field label="N° carte professionnelle CNAPS"><Input value={form.card_number || ''} onChange={(event) => patch({ card_number: event.target.value })} placeholder="CARTE-123456" /></Field>
                      <Field label="Date d’expiration"><Input type="date" className="min-w-0 max-w-full" value={String(form.card_expiry || '').slice(0, 10)} onChange={(event) => patch({ card_expiry: event.target.value })} /></Field>
                    </div>
                  </Card>
                  <Card icon={Briefcase} title="Statut et poste principal">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
                      <Field label="Statut">
                        <Select value={form.status || 'actif'} onValueChange={(value) => patch({ status: value })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="actif">Actif</SelectItem>
                            <SelectItem value="inactif">Inactif</SelectItem>
                            <SelectItem value="en_mission">En mission</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="Fonction / poste">
                        <Select value={form.fonction || ''} onValueChange={(value) => patch({ fonction: value })}>
                          <SelectTrigger><SelectValue placeholder="Agent de sécurité (APS)" /></SelectTrigger>
                          <SelectContent>{fonctionOptions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                        </Select>
                      </Field>
                      <Field label="Affectation par défaut">
                        <Select value={form.site_id_defaut || 'none'} onValueChange={(value) => patch({ site_id_defaut: value === 'none' ? '' : value })}>
                          <SelectTrigger><SelectValue placeholder="Non définie" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Non définie</SelectItem>
                            {sites.map((site) => <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                  </Card>
                </>
              )}

              {tab === 'documents' && (
                <Card icon={Shield} title="Documents & habilitations" text="Seules les pièces déjà enregistrées sont affichées.">
                  <DocLine title="Carte pro CNAPS" detail={form.card_number || 'Numéro non renseigné'} expiry={form.card_expiry} days={cardDays} />
                  {habilitations.map((label) => <DocLine key={label} title={label} detail="Mentionné sur la fonction. Aucune date d’expiration n’est enregistrée." />)}
                  {agentDocs.map((item) => <DocLine key={item.id} title={item.name || 'Document'} detail={item.type || 'Pièce jointe'} expiry={item.date} href={item.file_url} />)}
                  {!form.card_number && habilitations.length === 0 && agentDocs.length === 0 && (
                    <p className="text-sm text-slate-500">Aucune habilitation datée sur cette fiche.</p>
                  )}
                  {cardDays != null && cardDays >= 0 && cardDays <= 30 && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">Alerte : la carte professionnelle expire dans {cardDays} jour{cardDays > 1 ? 's' : ''}.</div>
                  )}
                </Card>
              )}

              {tab === 'emploi' && (
                <Card icon={Briefcase} title="Emploi & contrat">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
                    <Field label="Date d’embauche"><Input type="date" className="min-w-0 max-w-full" value={String(form.hire_date || '').slice(0, 10)} onChange={(event) => patch({ hire_date: event.target.value })} /></Field>
                    <Field label="Fin de contrat"><Input type="date" className="min-w-0 max-w-full" value={String(form.date_fin_contrat || '').slice(0, 10)} onChange={(event) => patch({ date_fin_contrat: event.target.value })} /></Field>
                    <Field label="Type">
                      <Select value={form.type_employe || 'Employé'} onValueChange={(value) => patch({ type_employe: value })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Employé">Employé</SelectItem>
                          <SelectItem value="Intérimaire">Intérimaire</SelectItem>
                          <SelectItem value="Sous-traitant">Sous-traitant</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Taux horaire (€)"><Input type="number" step="0.01" value={form.hourly_rate} onChange={(event) => patch({ hourly_rate: event.target.value })} /></Field>
                  </div>
                  <Field label="Notes"><Textarea value={form.notes || ''} onChange={(event) => patch({ notes: event.target.value })} rows={4} /></Field>
                </Card>
              )}

              {tab === 'acces' && (
                <>
                  <Card icon={Monitor} title="Compte collaborateur">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-slate-600">Autoriser le collaborateur à se connecter à son espace.</p>
                      <Switch checked={form.acces_espace_agent !== false} onCheckedChange={(value) => patch({ acces_espace_agent: value })} className="data-[state=checked]:bg-emerald-500" />
                    </div>
                    <ul className="mt-3 space-y-1 text-sm text-emerald-800 bg-emerald-50 rounded-xl p-3">
                      <li>Consulter son planning et ses vacations</li>
                      <li>Accéder à sa prise de poste</li>
                      <li>Faire des demandes (congé, absence…)</li>
                      <li>Recevoir des notifications</li>
                    </ul>
                    <div className="mt-3 rounded-xl border border-[#e4b54a]/50 bg-[#fffaf0] p-3 flex flex-col sm:flex-row sm:items-center gap-3">
                      <p className="text-sm text-[#1c1403] flex-1">Le compte se crée quand la personne invitée ouvre son lien et choisit un mot de passe.</p>
                      <Button type="button" onClick={() => save(false, true)} className={cn(GOLD, 'shrink-0')}>
                        <UserPlus className="w-4 h-4 mr-2" />
                        Créer le compte
                      </Button>
                    </div>
                  </Card>
                  <Card icon={Shield} title="Rôle du compte">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-0">
                      {[
                        ['agent', 'Collaborateur (agent)', 'Espace collaborateur'],
                        ['superviseur', 'Superviseur', 'Espace collaborateur et suivi d’équipe'],
                      ].map(([value, label, text]) => (
                        <button key={value} type="button" onClick={() => setAgentRole(value)} className={cn('text-left rounded-xl border px-3 py-2', agentRole === value ? 'border-[#e4b54a] bg-[#fffaf0]' : 'border-slate-200')}>
                          <span className="block text-sm font-medium">{label}</span>
                          <span className="block text-xs text-slate-500">{text}</span>
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-slate-500">Les rôles métier détaillés se règlent dans Rôles & permissions, sans changer ceux des autres collaborateurs.</p>
                  </Card>
                  <Card icon={Shield} title="Droits du portail">
                    <div className="space-y-2">
                      {DROITS_AGENT_OPTIONS.map((item) => (
                        <div key={item.key} className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2">
                          <div>
                            <p className="text-sm font-medium">{item.label}</p>
                            <p className="text-xs text-slate-500">{item.description}</p>
                          </div>
                          <Switch checked={!!droits[item.key]} onCheckedChange={() => setDroits((current) => ({ ...current, [item.key]: !current[item.key] }))} className="data-[state=checked]:bg-emerald-500" />
                        </div>
                      ))}
                    </div>
                  </Card>
                </>
              )}

              {tab === 'prefs' && (
                <Card icon={Bell} title="Notifications">
                  <Toggle label="Alertes d’expiration des documents" checked={notifications.expiration !== false} onChange={(value) => setNotifications((current) => ({ ...current, expiration: value }))} />
                  <Toggle label="Rappels administratifs (renouvellement, visite…)" checked={notifications.rappels !== false} onChange={(value) => setNotifications((current) => ({ ...current, rappels: value }))} />
                </Card>
              )}
            </div>

            <aside className="hidden xl:block">
              <div className="rounded-2xl bg-[#10192b] text-white p-4 sticky top-0">
                <p className="text-sm font-semibold mb-3">Aperçu collaborateur</p>
                <div className="w-16 h-16 rounded-full bg-white/10 mx-auto flex items-center justify-center text-lg font-bold overflow-hidden">
                  {form.photo_url ? <img src={form.photo_url} alt="" className="w-full h-full object-cover" /> : initials}
                </div>
                <p className="text-center font-semibold mt-3">{form.first_name || 'Prénom'} {form.last_name || 'Nom'}</p>
                <p className="text-center text-xs text-white/60">{form.fonction || 'Fonction non renseignée'}</p>
                <p className="mt-3 text-center text-xs"><span className={cn('px-2 py-1 rounded-full', form.status === 'inactif' ? 'bg-rose-500/20 text-rose-100' : 'bg-emerald-500/20 text-emerald-100')}>{form.status === 'inactif' ? 'Inactif' : 'Actif'}</span></p>
              </div>
            </aside>
          </div>
        </div>

        <div className="shrink-0 flex flex-wrap items-center gap-2 px-4 py-3 border-t bg-white">
          <Button type="button" variant="outline" onClick={onClose} className="w-full sm:w-auto sm:mr-auto">Annuler</Button>
          <Button type="button" variant="outline" onClick={() => save(true)} className="w-full sm:w-auto">Enregistrer en brouillon</Button>
          <Button type="button" variant="outline" onClick={() => save(false)} className="w-full sm:w-auto">{agent ? 'Enregistrer' : 'Créer le collaborateur'}</Button>
          <Button type="button" onClick={() => save(false, true)} className={cn(GOLD, 'w-full sm:w-auto')}>
            <UserPlus className="w-4 h-4 mr-2" />
            Créer le compte
          </Button>
        </div>
      </div>
    </div>
  );
}

function Card({ icon: Icon, title, text, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="w-8 h-8 rounded-full bg-[#f6e7c3] text-[#1c1403] flex items-center justify-center"><Icon className="w-4 h-4" /></span>
        <div>
          <h3 className="font-semibold text-[#10192b]">{title}</h3>
          {text && <p className="text-xs text-slate-500">{text}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }) {
  return (
    <label className="block min-w-0 space-y-1.5">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} className="data-[state=checked]:bg-emerald-500" />
    </div>
  );
}

function DocLine({ title, detail, expiry, days, href }) {
  const soon = days != null && days >= 0 && days <= 30;
  return (
    <div className={cn('flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm', soon && 'border-rose-200 bg-rose-50')}>
      <div className="min-w-0">
        <p className="font-medium truncate">{title}</p>
        <p className="text-xs text-slate-500 truncate">{detail}{expiry ? ` · ${String(expiry).slice(0, 10)}` : ''}</p>
      </div>
      {href && <a href={href} target="_blank" rel="noreferrer" className="text-xs text-amber-700 shrink-0">Ouvrir</a>}
    </div>
  );
}
