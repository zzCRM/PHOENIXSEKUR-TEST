import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { UserPlus, Shield, CheckCircle2, Mail, Info, Lock } from 'lucide-react';
import AddressAutocomplete from '@/components/shared/AddressAutocomplete';
import { toast } from 'sonner';

const ROLE_OPTIONS = [
  { value: 'agent', label: 'Agent', description: 'Accès espace agent uniquement' },
  { value: 'superviseur', label: 'Superviseur', description: 'Accès agent + supervision équipe' },
  { value: 'admin', label: 'Administrateur', description: 'Accès complet à l\'application' },
];

const DROITS_AGENT = [
  { key: 'acces_planning', label: 'Planning', description: 'Voir son planning et ses vacations à venir' },
  { key: 'acces_services', label: 'Services / Pointage', description: 'Pointer les débuts et fins de service' },
  { key: 'acces_ecarts', label: 'Écarts horaires', description: 'Consulter ses écarts horaires' },
  { key: 'acces_rondes', label: 'Rondes', description: 'Effectuer des rondes sur ses sites' },
  { key: 'acces_main_courante', label: 'Main courante', description: 'Consulter et saisir la main courante du site' },
  { key: 'acces_pti', label: 'PTI', description: 'Accès au module Protection Travailleur Isolé' },
  { key: 'acces_conges', label: 'Demandes RH / Congés', description: 'Soumettre des demandes de congés et RH' },
  { key: 'acces_documents', label: 'Documents', description: 'Consulter ses documents personnels et fiches de paie' },
  { key: 'acces_consignes', label: 'Cahier de consignes', description: 'Lire les consignes des sites' },
];

const DEFAULT_DROITS = {
  acces_planning: true,
  acces_services: true,
  acces_ecarts: false,
  acces_rondes: true,
  acces_main_courante: false,
  acces_pti: true,
  acces_conges: true,
  acces_documents: true,
  acces_consignes: true,
};

export default function AgentForm({ open, onClose, onSubmit, agent }) {
  const [tab, setTab] = useState('infos');
  const [inviteSent, setInviteSent] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [agentRole, setAgentRole] = useState('agent');
  const [droits, setDroits] = useState({ ...DEFAULT_DROITS });

  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '',
    card_number: '', card_expiry: '', status: 'actif',
    address: '', hire_date: '', hourly_rate: '', notes: '', role: 'agent'
  });

  useEffect(() => {
    if (agent) {
      setForm({ ...agent, hourly_rate: agent.hourly_rate || '' });
      setInviteEmail(agent.email || '');
      setAgentRole(agent.role || 'agent');
      setDroits({ ...DEFAULT_DROITS, ...agent.droits_portail });
    } else {
      setForm({ first_name: '', last_name: '', email: '', phone: '', card_number: '', card_expiry: '', status: 'actif', address: '', hire_date: '', hourly_rate: '', notes: '', role: 'agent' });
      setInviteEmail('');
      setAgentRole('agent');
      setDroits({ ...DEFAULT_DROITS });
    }
    setInviteSent(false);
    setTab('infos');
  }, [agent, open]);

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));
  const toggleDroit = (key) => setDroits(prev => ({ ...prev, [key]: !prev[key] }));

  const handleSubmit = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    onSubmit({ ...form, hourly_rate: form.hourly_rate ? Number(form.hourly_rate) : undefined, role: agentRole, droits_portail: droits });
  };

  const handleInvite = async () => {
    const email = inviteEmail || form.email;
    if (!email) { toast.error('Veuillez saisir un email'); return; }
    setInviting(true);
    try {
      const appRole = (agentRole === 'admin' || agentRole === 'superviseur') ? 'admin' : 'user';
      await base44.users.inviteUser(email, appRole);
      setInviteSent(true);
      toast.success(`Invitation envoyée à ${email}`);
    } catch (err) {
      toast.error("Erreur lors de l'invitation : " + (err.message || 'Erreur inconnue'));
    }
    setInviting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{agent ? 'Modifier l\'agent' : 'Nouvel agent'}</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full mb-4">
            <TabsTrigger value="infos" className="flex-1">Informations</TabsTrigger>
            <TabsTrigger value="droits" className="flex-1 gap-1.5">
              <Lock className="w-3.5 h-3.5" /> Droits portail
            </TabsTrigger>
            <TabsTrigger value="compte" className="flex-1 gap-1.5">
              <Shield className="w-3.5 h-3.5" /> Compte
            </TabsTrigger>
          </TabsList>

          {/* ===== INFOS ===== */}
          <TabsContent value="infos">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Prénom *</Label>
                  <Input value={form.first_name} onChange={e => update('first_name', e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Nom *</Label>
                  <Input value={form.last_name} onChange={e => update('last_name', e.target.value)} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={e => { update('email', e.target.value); setInviteEmail(e.target.value); }} />
                </div>
                <div className="space-y-2">
                  <Label>Téléphone</Label>
                  <Input value={form.phone} onChange={e => update('phone', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>N° carte pro CNAPS</Label>
                  <Input value={form.card_number} onChange={e => update('card_number', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Expiration carte</Label>
                  <Input type="date" value={form.card_expiry} onChange={e => update('card_expiry', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date d'embauche</Label>
                  <Input type="date" value={form.hire_date} onChange={e => update('hire_date', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Taux horaire (€)</Label>
                  <Input type="number" step="0.01" value={form.hourly_rate} onChange={e => update('hourly_rate', e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Statut</Label>
                <Select value={form.status} onValueChange={v => update('status', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="actif">Actif</SelectItem>
                    <SelectItem value="inactif">Inactif</SelectItem>
                    <SelectItem value="en_mission">En mission</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
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
                />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={e => update('notes', e.target.value)} rows={3} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
                <Button type="submit">{agent ? 'Modifier' : 'Créer'}</Button>
              </div>
            </form>
          </TabsContent>

          {/* ===== DROITS PORTAIL ===== */}
          <TabsContent value="droits" className="space-y-4">
            <div className="p-3 rounded-xl bg-muted/50 text-xs text-muted-foreground flex items-start gap-2">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>Ces droits définissent ce que l'agent peut voir dans son portail. Les modifications sont effectives immédiatement après enregistrement.</span>
            </div>
            <div className="space-y-2">
              {DROITS_AGENT.map(d => (
                <div key={d.key} className="flex items-center justify-between p-3 rounded-xl border border-border hover:bg-muted/20 transition-colors">
                  <div className="flex-1 mr-4">
                    <p className="text-sm font-medium">{d.label}</p>
                    <p className="text-xs text-muted-foreground">{d.description}</p>
                  </div>
                  <Switch
                    checked={droits[d.key] ?? false}
                    onCheckedChange={() => toggleDroit(d.key)}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3 pt-2 border-t">
              <Button variant="outline" onClick={onClose}>Annuler</Button>
              <Button onClick={handleSubmit}>{agent ? 'Enregistrer' : 'Créer'}</Button>
            </div>
          </TabsContent>

          {/* ===== COMPTE & ACCÈS ===== */}
          <TabsContent value="compte" className="space-y-5">
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Rôle de l'agent</Label>
              <div className="space-y-2">
                {ROLE_OPTIONS.map(r => (
                  <div
                    key={r.value}
                    onClick={() => setAgentRole(r.value)}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${agentRole === r.value ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}
                  >
                    <div>
                      <p className="font-medium text-sm">{r.label}</p>
                      <p className="text-xs text-muted-foreground">{r.description}</p>
                    </div>
                    {agentRole === r.value && <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />}
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-primary" />
                <Label className="text-sm font-semibold">Créer un compte portail</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Envoie un email d'invitation à l'agent pour qu'il accède à son espace personnel.
              </p>
              <div className="space-y-2">
                <Label>Email d'invitation</Label>
                <Input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="email@agent.fr" />
              </div>
              {inviteSent ? (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-green-50 border border-green-200 text-green-700">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <p className="text-sm font-medium">Invitation envoyée à {inviteEmail}</p>
                </div>
              ) : (
                <Button className="w-full gap-2" onClick={handleInvite} disabled={inviting || !inviteEmail}>
                  <Mail className="w-4 h-4" />
                  {inviting ? 'Envoi en cours...' : 'Envoyer l\'invitation'}
                </Button>
              )}
              <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/50 text-xs text-muted-foreground">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>Niveau d'accès : <strong>{agentRole === 'admin' ? 'Administrateur' : agentRole === 'superviseur' ? 'Admin (superviseur)' : 'Utilisateur standard'}</strong>.</span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={onClose}>Fermer</Button>
              <Button onClick={handleSubmit}>{agent ? 'Enregistrer les modifications' : 'Créer l\'agent'}</Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}