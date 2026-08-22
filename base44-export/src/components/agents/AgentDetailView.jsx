import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X, User, Briefcase, MapPin, Image as ImageIcon, Shield,
  Star, AlertTriangle, FileText, Package, Euro, Clock, CheckCircle2, Mail, Copy
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const SECTIONS = [
  { id: 'general', label: 'Général' },
  { id: 'professionnel', label: 'Informations professionnelles' },
  { id: 'compte', label: 'Compte Sekur®' },
  { id: 'expirations', label: 'Expirations' },
  { id: 'documents', label: 'Documents' },
  { id: 'salaire', label: 'Éléments de salaire' },
];

const ACCES_OPTIONS = [
  { key: 'acces_espace_agent', label: 'Espace Agent', description: 'Accès à l\'espace agent mobile' },
  { key: 'acces_planning', label: 'Planning', description: 'Consulter son planning de missions' },
  { key: 'acces_conges', label: 'Congés & Absences', description: 'Faire des demandes de congé' },
  { key: 'acces_documents', label: 'Documents', description: 'Consulter les documents partagés' },
  { key: 'acces_fiches_paie', label: 'Fiches de paie', description: 'Télécharger ses fiches de paie' },
  { key: 'acces_rondes', label: 'Rondes', description: 'Effectuer les rondes de surveillance' },
  { key: 'acces_pti', label: 'PTI', description: 'Accès au module Protection Travailleur Isolé' },
  { key: 'acces_main_courante', label: 'Main courante', description: 'Consulter la main courante' },
];

function StarRating({ value, onChange }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(i => (
        <button key={i} type="button" onClick={() => onChange(i)}>
          <Star className={cn('w-5 h-5 transition-colors', i <= value ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground')} />
        </button>
      ))}
    </div>
  );
}

export default function AgentDetailView({ agent, onClose }) {
  const [activeSection, setActiveSection] = useState('general');
  const [formData, setFormData] = useState({ ...agent });
  const [photoFile, setPhotoFile] = useState(null);
  const [inviting, setInviting] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);
  const [inviteEmailSent, setInviteEmailSent] = useState(false);
  const [inviteLink, setInviteLink] = useState(null);
  const qc = useQueryClient();

  const updateMut = useMutation({
    mutationFn: async (data) => {
      if (photoFile) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file: photoFile });
        data.photo_url = file_url;
      }
      return base44.entities.Agent.update(agent.id, data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agents'] });
      toast.success('Fiche enregistrée');
      onClose();
    },
    onError: (err) => toast.error('Erreur : ' + err.message),
  });

  const update = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => update('photo_url', ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleInvite = async () => {
    const email = formData.email;
    if (!email) { toast.error('Ajoutez un email d\'abord'); return; }
    setInviting(true);
    try {
      const appRole = (formData.role === 'admin' || formData.role === 'superviseur') ? 'admin' : 'user';
      const result = await base44.users.inviteUser(email, appRole);
      setInviteSent(true);
      setInviteEmailSent(!!result.email_sent);
      setInviteLink(result.invite_url || null);
      if (result.email_sent) {
        toast.success(`Invitation envoyée par email à ${email}`);
      } else if (result.invite_url) {
        toast.warning('Email non envoyé — copiez le lien ci-dessous');
      } else {
        toast.success(result.message || `Invitation créée pour ${email}`);
      }
    } catch (err) {
      toast.error('Erreur invitation : ' + err.message);
    }
    setInviting(false);
  };

  const renderSection = () => {
    switch (activeSection) {

      case 'general':
        return (
          <div className="space-y-6">
            <div className="flex items-start gap-4 pb-4 border-b">
              <div className="shrink-0">
                {formData.photo_url ? (
                  <img src={formData.photo_url} alt="" className="w-24 h-24 rounded-full object-cover border-2 border-border shadow" />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center border-2 border-border">
                    <User className="w-10 h-10 text-muted-foreground" />
                  </div>
                )}
                <label className="mt-2 block cursor-pointer">
                  <span className="text-xs text-primary underline">Changer la photo</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                </label>
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-xl font-bold">{formData.last_name} {formData.first_name}</p>
                <p className="text-sm text-muted-foreground">{formData.fonction || 'Fonction non définie'}</p>
                <Badge variant="outline" className="text-xs">{formData.type_employe || 'Employé'}</Badge>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground mb-1">Évaluation</p>
                <StarRating value={formData.note_evaluation || 0} onChange={v => update('note_evaluation', v)} />
              </div>
            </div>

            {/* Infos générales */}
            <div>
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">Informations générales</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={formData.type_employe || 'Employé'} onValueChange={v => update('type_employe', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Employé">Employé</SelectItem>
                      <SelectItem value="Intérimaire">Intérimaire</SelectItem>
                      <SelectItem value="Sous-traitant">Sous-traitant</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Fonction</Label>
                  <Input value={formData.fonction || ''} onChange={e => update('fonction', e.target.value)} placeholder="SSIAP1, ADS, SSIAP2..." />
                </div>
              </div>
              <div className="flex items-center gap-3 mt-4 p-3 rounded-xl border border-border bg-muted/20">
                <Switch checked={!!formData.planifiable} onCheckedChange={v => update('planifiable', v)} />
                <div>
                  <p className="text-sm font-medium">Collaborateur planifiable</p>
                  <p className="text-xs text-muted-foreground">Peut être assigné aux missions</p>
                </div>
              </div>
            </div>

            {/* Infos personnelles */}
            <div>
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">Informations personnelles</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nom *</Label>
                  <Input value={formData.last_name || ''} onChange={e => update('last_name', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Prénom *</Label>
                  <Input value={formData.first_name || ''} onChange={e => update('first_name', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="space-y-2">
                  <Label>Civilité</Label>
                  <Select value={formData.civilite || ''} onValueChange={v => update('civilite', v)}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M.">Monsieur</SelectItem>
                      <SelectItem value="Mme">Madame</SelectItem>
                      <SelectItem value="Autre">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Genre</Label>
                  <Select value={formData.genre || ''} onValueChange={v => update('genre', v)}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Homme">Homme</SelectItem>
                      <SelectItem value="Femme">Femme</SelectItem>
                      <SelectItem value="Autre">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="space-y-2">
                  <Label>Groupe sanguin</Label>
                  <Select value={formData.groupe_sanguin || ''} onValueChange={v => update('groupe_sanguin', v)}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                    <SelectContent>
                      {['A+','A-','B+','B-','AB+','AB-','O+','O-','Inconnu'].map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Date de naissance</Label>
                  <Input type="date" value={formData.date_naissance || ''} onChange={e => update('date_naissance', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="space-y-2">
                  <Label>Nationalité</Label>
                  <Input value={formData.nationalite || ''} onChange={e => update('nationalite', e.target.value)} placeholder="Française..." />
                </div>
                <div className="space-y-2">
                  <Label>Ville de naissance</Label>
                  <Input value={formData.lieu_naissance || ''} onChange={e => update('lieu_naissance', e.target.value)} />
                </div>
              </div>
            </div>

            {/* Contacts */}
            <div>
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">Informations de contact</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={formData.email || ''} onChange={e => update('email', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Téléphone</Label>
                  <Input value={formData.phone || ''} onChange={e => update('phone', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="space-y-2">
                  <Label>Téléphone 2</Label>
                  <Input value={formData.phone2 || ''} onChange={e => update('phone2', e.target.value)} />
                </div>
              </div>
              <div className="space-y-2 mt-4">
                <Label>Adresse</Label>
                <Input value={formData.address || ''} onChange={e => update('address', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="space-y-2">
                  <Label>Ville</Label>
                  <Input value={formData.city || ''} onChange={e => update('city', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Code postal</Label>
                  <Input value={formData.postal_code || ''} onChange={e => update('postal_code', e.target.value)} />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={formData.notes || ''} onChange={e => update('notes', e.target.value)} rows={3} />
            </div>
          </div>
        );

      case 'professionnel':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">Statut & Rôle</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Statut</Label>
                  <Select value={formData.status || 'actif'} onValueChange={v => update('status', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="actif">Actif</SelectItem>
                      <SelectItem value="inactif">Inactif</SelectItem>
                      <SelectItem value="en_mission">En mission</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Rôle</Label>
                  <Select value={formData.role || 'agent'} onValueChange={v => update('role', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="agent">Agent</SelectItem>
                      <SelectItem value="superviseur">Superviseur</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">Carte professionnelle CNAPS</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Numéro de carte</Label>
                  <Input value={formData.card_number || ''} onChange={e => update('card_number', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Date d'expiration</Label>
                  <Input type="date" value={formData.card_expiry || ''} onChange={e => update('card_expiry', e.target.value)} />
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">Contrat</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date d'embauche</Label>
                  <Input type="date" value={formData.hire_date || ''} onChange={e => update('hire_date', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Date de fin de contrat</Label>
                  <Input type="date" value={formData.date_fin_contrat || ''} onChange={e => update('date_fin_contrat', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="space-y-2">
                  <Label>Taux horaire (€)</Label>
                  <Input type="number" step="0.01" value={formData.hourly_rate || ''} onChange={e => update('hourly_rate', e.target.value)} />
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">Coordonnées bancaires</h3>
              <div className="space-y-2">
                <Label>IBAN</Label>
                <Input value={formData.iban || ''} onChange={e => update('iban', e.target.value)} placeholder="FR76 XXXX XXXX XXXX" />
              </div>
              <div className="space-y-2 mt-4">
                <Label>N° Sécurité sociale</Label>
                <Input value={formData.numero_securite_sociale || ''} onChange={e => update('numero_securite_sociale', e.target.value)} />
              </div>
            </div>
          </div>
        );

      case 'compte':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-1">Compte portail agent</h3>
              <p className="text-xs text-muted-foreground mb-4">Définissez les modules accessibles depuis l'espace agent.</p>

              <div className="space-y-2">
                {ACCES_OPTIONS.map(opt => (
                  <div key={opt.key} className="flex items-start sm:items-center justify-between gap-3 p-3 rounded-xl border border-border bg-muted/20">
                    <div>
                      <p className="text-sm font-medium">{opt.label}</p>
                      <p className="text-xs text-muted-foreground">{opt.description}</p>
                    </div>
                    <Switch
                      checked={formData[opt.key] !== false}
                      onCheckedChange={v => update(opt.key, v)}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t pt-4 space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Invitation</h3>
              <p className="text-xs text-muted-foreground">Envoie un email d'invitation à l'agent pour créer son mot de passe.</p>
              <div className="p-3 rounded-xl bg-muted/30 text-sm">
                Email : <strong>{formData.email || <span className="text-destructive">Non renseigné</span>}</strong>
              </div>
              {inviteSent ? (
                <div className={`space-y-2 p-3 rounded-xl border ${inviteEmailSent ? 'bg-green-50 border-green-200 text-green-700' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
                  <div className="flex items-center gap-2">
                    {inviteEmailSent ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                    <p className="text-sm font-medium">
                      {inviteEmailSent ? 'Invitation envoyée par email' : 'Invitation créée — email non envoyé'}
                    </p>
                  </div>
                  {inviteLink && (
                    <div className="flex gap-2">
                      <Input readOnly value={inviteLink} className="text-xs bg-white/80" />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(inviteLink);
                            toast.success('Lien copié');
                          } catch {
                            toast.error('Impossible de copier');
                          }
                        }}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <Button className="w-full gap-2" onClick={handleInvite} disabled={inviting || !formData.email}>
                  <Mail className="w-4 h-4" />
                  {inviting ? 'Envoi...' : 'Envoyer l\'invitation par email'}
                </Button>
              )}
            </div>
          </div>
        );

      case 'expirations':
        return (
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">Suivi des expirations</h3>
            {[
              { label: 'Carte professionnelle CNAPS', date: formData.card_expiry },
              { label: 'Fin de contrat', date: formData.date_fin_contrat },
            ].map(({ label, date }) => {
              if (!date) return (
                <div key={label} className="p-3 rounded-xl border border-border bg-muted/20 flex justify-between items-center">
                  <span className="text-sm">{label}</span>
                  <Badge variant="outline" className="text-xs text-muted-foreground">Non renseigné</Badge>
                </div>
              );
              const d = new Date(date);
              const daysLeft = Math.ceil((d - new Date()) / 86400000);
              const isExpired = daysLeft < 0;
              const isUrgent = daysLeft >= 0 && daysLeft <= 30;
              return (
                <div key={label} className={`p-3 rounded-xl border flex justify-between items-center ${isExpired ? 'bg-red-50 border-red-200' : isUrgent ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{format(d, 'dd/MM/yyyy', { locale: fr })}</p>
                  </div>
                  <Badge variant="outline" className={isExpired ? 'text-red-700 border-red-300' : isUrgent ? 'text-amber-700 border-amber-300' : 'text-green-700 border-green-300'}>
                    {isExpired ? `Expirée (${Math.abs(daysLeft)}j)` : `Dans ${daysLeft}j`}
                  </Badge>
                </div>
              );
            })}
          </div>
        );

      case 'documents':
        return (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Les documents de cet agent sont accessibles</p>
            <p className="text-xs mt-1">depuis le module Documents → filtrer par agent.</p>
          </div>
        );

      case 'salaire':
        return (
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">Éléments de salaire</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Taux horaire (€/h)</Label>
                <Input type="number" step="0.01" value={formData.hourly_rate || ''} onChange={e => update('hourly_rate', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>IBAN</Label>
                <Input value={formData.iban || ''} onChange={e => update('iban', e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>N° Sécurité sociale</Label>
              <Input value={formData.numero_securite_sociale || ''} onChange={e => update('numero_securite_sociale', e.target.value)} />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={!!agent} onOpenChange={onClose}>
      <DialogContent className="w-[calc(100vw-0.75rem)] max-w-4xl max-h-[100dvh] sm:max-h-[92vh] p-0 overflow-hidden flex flex-col gap-0">
        {/* Header */}
        <div className="bg-primary text-primary-foreground px-3 sm:px-6 py-3 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-sm truncate">
              Fiche collaborateur — {formData.last_name} {formData.first_name}
            </span>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-primary-foreground hover:bg-white/20 h-8 w-8 shrink-0">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">
          {/* Tabs mobiles — scroll horizontal */}
          <div className="md:hidden flex overflow-x-auto border-b border-border bg-muted/30 shrink-0 scrollbar-none">
            {SECTIONS.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveSection(s.id)}
                className={cn(
                  'shrink-0 px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors',
                  activeSection === s.id
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-transparent text-muted-foreground',
                )}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Sidebar desktop */}
          <div className="hidden md:block w-56 shrink-0 border-r border-border bg-muted/20 overflow-y-auto">
            {SECTIONS.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveSection(s.id)}
                className={cn(
                  'w-full text-left px-4 py-3 text-sm border-b border-border/50 transition-colors',
                  activeSection === s.id
                    ? 'bg-primary/10 text-primary font-semibold border-l-4 border-l-primary'
                    : 'hover:bg-muted/50 text-foreground',
                )}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            <div className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-6">
              {renderSection()}
            </div>
            <div className="border-t border-border p-3 sm:p-4 flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 sm:justify-end bg-background shrink-0">
              <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">Annuler</Button>
              <Button onClick={() => updateMut.mutate(formData)} disabled={updateMut.isPending} className="w-full sm:w-auto">
                {updateMut.isPending ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}