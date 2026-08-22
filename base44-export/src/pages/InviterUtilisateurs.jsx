import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import {
  UserPlus, Shield, User, Building2, CheckCircle2, Copy, AlertTriangle,
  Trash2, RefreshCw, Mail, Search,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useCompany } from '@/lib/useCompany';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const ROLE_CONFIG = {
  admin: {
    label: 'Administrateur',
    desc: 'Accès complet à toutes les fonctionnalités',
    icon: Shield,
    color: 'text-red-600 bg-red-50',
  },
  user: {
    label: 'Agent / Collaborateur',
    desc: 'Accès espace agent : missions, rondes, PTI',
    icon: User,
    color: 'text-blue-600 bg-blue-50',
  },
  client: {
    label: 'Client',
    desc: 'Accès espace client : planning, main courante, documents',
    icon: Building2,
    color: 'text-emerald-600 bg-emerald-50',
  },
};

function statusBadge(status) {
  if (status === 'actif') return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Actif</Badge>;
  if (status === 'inactif') return <Badge variant="secondary">Inactif</Badge>;
  if (status === 'en_attente') return <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">Invitation en attente</Badge>;
  if (status === 'expirée') return <Badge variant="destructive">Invitation expirée</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

export default function InviterUtilisateurs() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('user');
  const [inviteType, setInviteType] = useState('agent');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [inviteLink, setInviteLink] = useState(null);
  const [emailSent, setEmailSent] = useState(null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const { companyId, isAdmin } = useCompany();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['company-users', companyId],
    queryFn: () => base44.users.list(),
    enabled: !!companyId && isAdmin,
  });

  const users = data?.users || [];
  const invitations = data?.invitations || [];
  const smtp = data?.smtp;

  const rows = useMemo(() => {
    const merged = [
      ...users.map((u) => ({ ...u, sortKey: u.email })),
      ...invitations.map((i) => ({ ...i, sortKey: i.email })),
    ];
    return merged
      .filter((row) => {
        if (filter === 'collaborateurs') return row.role === 'user' || row.role === 'admin';
        if (filter === 'clients') return row.role === 'client';
        if (filter === 'pending') return row.type === 'invitation';
        return true;
      })
      .filter((row) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
          row.email?.toLowerCase().includes(q)
          || row.first_name?.toLowerCase().includes(q)
          || row.last_name?.toLowerCase().includes(q)
          || row.role_label?.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => String(a.sortKey).localeCompare(String(b.sortKey)));
  }, [users, invitations, filter, search]);

  const roleKey = inviteType === 'client' ? 'client' : role;
  const roleInfo = ROLE_CONFIG[roleKey] || ROLE_CONFIG.user;
  const RoleIcon = roleInfo.icon;

  const deleteUserMut = useMutation({
    mutationFn: (id) => base44.users.deleteUser(id),
    onSuccess: () => {
      toast.success('Utilisateur supprimé');
      queryClient.invalidateQueries({ queryKey: ['company-users'] });
    },
    onError: (e) => toast.error(e.message || 'Suppression impossible'),
  });

  const deleteInviteMut = useMutation({
    mutationFn: (id) => base44.users.deleteInvitation(id),
    onSuccess: () => {
      toast.success('Invitation annulée');
      queryClient.invalidateQueries({ queryKey: ['company-users'] });
    },
    onError: (e) => toast.error(e.message || 'Suppression impossible'),
  });

  const resendMut = useMutation({
    mutationFn: (id) => base44.users.resendInvitation(id),
    onSuccess: async (result) => {
      queryClient.invalidateQueries({ queryKey: ['company-users'] });
      if (result.email_sent) {
        toast.success('Invitation renvoyée par email');
      } else if (result.invite_url) {
        toast.warning(result.message || 'Email non envoyé — lien copié');
        try { await navigator.clipboard.writeText(result.invite_url); } catch { /* ignore */ }
      } else {
        toast.warning(result.message || 'Invitation régénérée');
      }
    },
    onError: (e) => toast.error(e.message || 'Renvoi impossible'),
  });

  const toggleActiveMut = useMutation({
    mutationFn: ({ id, is_active }) => base44.users.updateUser(id, { is_active }),
    onSuccess: () => {
      toast.success('Statut mis à jour');
      queryClient.invalidateQueries({ queryKey: ['company-users'] });
    },
    onError: (e) => toast.error(e.message || 'Mise à jour impossible'),
  });

  const handleInvite = async () => {
    if (!email) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    setInviteLink(null);
    setEmailSent(null);
    try {
      const inviteRole = inviteType === 'client' ? 'client' : (role === 'admin' ? 'admin' : 'user');
      const result = await base44.users.inviteUser(email, inviteRole);

      if (inviteType === 'client' && companyId && !result.already_registered) {
        const existing = await base44.entities.Client.filter({ email, company_id: companyId });
        if (existing.length === 0) {
          await base44.entities.Client.create({
            company_id: companyId,
            company_name: email.split('@')[0],
            email,
            status: 'actif',
          });
        }
      }

      setEmailSent(!!result.email_sent);
      setInviteLink(result.invite_url || null);
      setSuccess(result.message || (result.email_sent
        ? `Invitation envoyée à ${email}`
        : `Invitation créée pour ${email}`));

      if (result.email_sent) toast.success(`Email envoyé à ${email}`);
      else if (result.invite_url) toast.warning('Email non envoyé — copiez le lien d\'invitation');

      setEmail('');
      queryClient.invalidateQueries({ queryKey: ['company-users'] });
    } catch (e) {
      setError(e.message || 'Erreur lors de l\'invitation');
      toast.error(e.message || 'Erreur invitation');
    }
    setLoading(false);
  };

  const copyLink = async (link) => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Lien copié');
    } catch {
      toast.error('Impossible de copier');
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <Shield className="w-12 h-12 mb-4 opacity-30" />
        <p className="text-lg font-semibold">Accès réservé aux administrateurs</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Utilisateurs</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Invitez, suivez et gérez les accès collaborateurs et clients
        </p>
      </div>

      {smtp && !smtp.configured && (
        <div className="flex items-start gap-2 p-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Envoi d&apos;emails indisponible sur le serveur</p>
            <p className="text-xs mt-0.5">
              Les invitations peuvent quand même être créées — copiez le lien pour l&apos;envoyer manuellement.
              Le mot de passe SMTP GitHub est déjà prévu ; un redéploiement est nécessaire pour le charger.
            </p>
          </div>
        </div>
      )}

      <Card className="p-4 sm:p-6">
        <h2 className="text-base sm:text-lg font-semibold mb-4">Inviter un utilisateur</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => { setInviteType('agent'); setRole('user'); }}
              className={`p-3 sm:p-4 rounded-xl border-2 text-left transition-all ${inviteType === 'agent' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}
            >
              <User className={`w-5 h-5 sm:w-6 sm:h-6 mb-2 ${inviteType === 'agent' ? 'text-primary' : 'text-muted-foreground'}`} />
              <p className="font-semibold text-sm">Agent / Salarié</p>
              <p className="text-xs text-muted-foreground hidden sm:block">Accès espace agent</p>
            </button>
            <button
              type="button"
              onClick={() => { setInviteType('client'); setRole('client'); }}
              className={`p-3 sm:p-4 rounded-xl border-2 text-left transition-all ${inviteType === 'client' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}
            >
              <Building2 className={`w-5 h-5 sm:w-6 sm:h-6 mb-2 ${inviteType === 'client' ? 'text-primary' : 'text-muted-foreground'}`} />
              <p className="font-semibold text-sm">Client</p>
              <p className="text-xs text-muted-foreground hidden sm:block">Accès espace client</p>
            </button>
          </div>

          <div className="space-y-2">
            <Label>Email *</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="exemple@email.com"
              autoComplete="email"
            />
          </div>

          {inviteType === 'agent' && (
            <div className="space-y-2">
              <Label>Rôle</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Agent / Collaborateur</SelectItem>
                  <SelectItem value="admin">Administrateur</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className={`p-3 rounded-lg ${roleInfo.color}`}>
            <div className="flex items-start gap-2">
              <RoleIcon className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">{roleInfo.label}</p>
                <p className="text-xs mt-0.5">{roleInfo.desc}</p>
              </div>
            </div>
          </div>

          {success && (
            <div className={`flex flex-col gap-2 p-3 rounded-lg border text-sm ${emailSent ? 'bg-green-50 border-green-200 text-green-800' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
              <div className="flex items-start gap-2">
                {emailSent
                  ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  : <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
                <span>{success}</span>
              </div>
              {inviteLink && (
                <div className="space-y-2 mt-1">
                  <p className="text-xs font-medium">Lien d&apos;invitation :</p>
                  <div className="flex gap-2">
                    <Input readOnly value={inviteLink} className="text-xs bg-white/80" />
                    <Button type="button" variant="outline" size="icon" onClick={() => copyLink(inviteLink)} title="Copier">
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          <Button onClick={handleInvite} disabled={!email || loading} className="w-full gap-2">
            <UserPlus className="w-4 h-4" />
            {loading ? 'Envoi...' : 'Envoyer l\'invitation'}
          </Button>
        </div>
      </Card>

      <Card className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <div className="flex-1">
            <h2 className="text-base sm:text-lg font-semibold">
              Comptes & invitations ({rows.length})
            </h2>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5 self-start">
            <RefreshCw className="w-3.5 h-3.5" /> Actualiser
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un email ou un nom..."
              className="pl-9"
            />
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="sm:w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="collaborateurs">Collaborateurs</SelectItem>
              <SelectItem value="clients">Clients</SelectItem>
              <SelectItem value="pending">Invitations en attente</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Chargement...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Aucun utilisateur pour ce filtre</p>
        ) : (
          <div className="space-y-2">
            {rows.map((row) => (
              <div
                key={`${row.type}-${row.id}`}
                className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl border border-border/80 hover:bg-muted/30"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                    {(row.first_name?.[0] || row.email?.[0] || '?').toUpperCase()}
                    {(row.last_name?.[0] || '').toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {row.first_name || row.last_name
                        ? `${row.first_name || ''} ${row.last_name || ''}`.trim()
                        : row.email}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{row.email}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {row.role_label || row.role}
                      {row.type === 'invitation' && row.expires_at
                        ? ` · expire le ${new Date(row.expires_at).toLocaleDateString('fr-FR')}`
                        : ''}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  {statusBadge(row.status)}

                  {row.type === 'user' && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => toggleActiveMut.mutate({ id: row.id, is_active: !row.is_active })}
                    >
                      {row.is_active ? 'Désactiver' : 'Activer'}
                    </Button>
                  )}

                  {row.type === 'invitation' && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => resendMut.mutate(row.id)}
                      disabled={resendMut.isPending}
                    >
                      <Mail className="w-3.5 h-3.5" />
                      Renvoyer
                    </Button>
                  )}

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive gap-1"
                    onClick={() => {
                      const label = row.type === 'invitation' ? 'cette invitation' : 'cet utilisateur';
                      if (!window.confirm(`Supprimer ${label} (${row.email}) ?`)) return;
                      if (row.type === 'invitation') deleteInviteMut.mutate(row.id);
                      else deleteUserMut.mutate(row.id);
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Supprimer
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
