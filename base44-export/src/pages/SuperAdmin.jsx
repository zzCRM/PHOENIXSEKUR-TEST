import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Shield, Users, Building2, CreditCard, UserPlus, Mail, KeyRound,
  Trash2, PauseCircle, PlayCircle, RefreshCw, Clock, Settings,
  FileText, LayoutDashboard, Inbox, Send, CheckCircle2, XCircle,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useSuperAdmin } from '@/lib/useSuperAdmin';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function StatusBadge({ active, reason }) {
  if (active === false) {
    return <Badge variant="destructive">{reason || 'Suspendu'}</Badge>;
  }
  return <Badge variant="outline" className="text-green-700 border-green-300">Actif</Badge>;
}

function SubBadge({ sub }) {
  if (!sub) return <Badge variant="secondary">Non configuré</Badge>;
  const map = {
    trial: { label: 'Essai', variant: 'secondary' },
    active: { label: 'Actif', variant: 'default' },
    suspended: { label: 'Suspendu', variant: 'destructive' },
  };
  const cfg = map[sub.status] || { label: sub.status, variant: 'outline' };
  return (
    <div className="flex flex-col gap-1">
      <Badge variant={cfg.variant}>{cfg.label}</Badge>
      {sub.trial_ends_at && sub.status === 'trial' && (
        <span className="text-xs text-muted-foreground">Fin essai : {fmtDate(sub.trial_ends_at)}</span>
      )}
    </div>
  );
}

export default function SuperAdmin() {
  const { isSuperAdmin, user } = useSuperAdmin();
  const qc = useQueryClient();
  const [tab, setTab] = useState('overview');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('admin');

  const [emailSubject, setEmailSubject] = useState('');
  const [emailHtml, setEmailHtml] = useState('');
  const [emailText, setEmailText] = useState('');
  const [trialDays, setTrialDays] = useState('14');
  const [notifyEmails, setNotifyEmails] = useState('');

  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => base44.admin.stats(),
    enabled: isSuperAdmin,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => base44.admin.listUsers(),
    enabled: isSuperAdmin,
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['admin-companies'],
    queryFn: () => base44.admin.listCompanies(),
    enabled: isSuperAdmin,
  });

  const { data: invitations = [] } = useQuery({
    queryKey: ['admin-invitations'],
    queryFn: () => base44.admin.listInvitations(),
    enabled: isSuperAdmin,
  });

  const { data: signupRequests = [] } = useQuery({
    queryKey: ['admin-signups'],
    queryFn: () => base44.admin.listSignupRequests(),
    enabled: isSuperAdmin,
  });

  useQuery({
    queryKey: ['admin-settings'],
    queryFn: async () => {
      const s = await base44.admin.getSettings();
      setEmailSubject(s.invitation_subject || '');
      setEmailHtml(s.invitation_body_html || '');
      setEmailText(s.invitation_body_text || '');
      setTrialDays(String(s.default_trial_days ?? 14));
      setNotifyEmails(s.signup_notify_emails || '');
      return s;
    },
    enabled: isSuperAdmin,
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['admin-stats'] });
    qc.invalidateQueries({ queryKey: ['admin-users'] });
    qc.invalidateQueries({ queryKey: ['admin-companies'] });
    qc.invalidateQueries({ queryKey: ['admin-invitations'] });
    qc.invalidateQueries({ queryKey: ['admin-signups'] });
  };

  const createMut = useMutation({
    mutationFn: (data) => base44.admin.createUser(data),
    onSuccess: (res) => {
      invalidateAll();
      setEmail('');
      setPassword('');
      toast.success(res.message || `Compte créé : ${res.email}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => base44.admin.deleteUser(id),
    onSuccess: () => { invalidateAll(); toast.success('Utilisateur supprimé'); },
    onError: (e) => toast.error(e.message),
  });

  const toggleUserMut = useMutation({
    mutationFn: ({ id, is_active, suspend_reason }) =>
      base44.admin.updateUser(id, { is_active, suspend_reason }),
    onSuccess: () => { invalidateAll(); toast.success('Statut mis à jour'); },
    onError: (e) => toast.error(e.message),
  });

  const resendMut = useMutation({
    mutationFn: (id) => base44.admin.resendInvitation(id),
    onSuccess: (res) => {
      invalidateAll();
      toast.success(res.message || 'Invitation renvoyée');
    },
    onError: (e) => toast.error(e.message),
  });

  const approveMut = useMutation({
    mutationFn: ({ id, trial_days }) => base44.admin.approveSignupRequest(id, trial_days),
    onSuccess: (res) => {
      invalidateAll();
      toast.success(res.message || 'Demande approuvée');
    },
    onError: (e) => toast.error(e.message),
  });

  const rejectMut = useMutation({
    mutationFn: (id) => base44.admin.rejectSignupRequest(id),
    onSuccess: () => { invalidateAll(); toast.success('Demande refusée'); },
    onError: (e) => toast.error(e.message),
  });

  const companySubMut = useMutation({
    mutationFn: ({ companyId, ...data }) =>
      base44.admin.updateCompanySubscription(companyId, data),
    onSuccess: () => { invalidateAll(); toast.success('Abonnement mis à jour'); },
    onError: (e) => toast.error(e.message),
  });

  const settingsMut = useMutation({
    mutationFn: (data) => base44.admin.updateSettings(data),
    onSuccess: () => toast.success('Paramètres email enregistrés'),
    onError: (e) => toast.error(e.message),
  });

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <Shield className="w-12 h-12 mb-4 opacity-30" />
        <p className="text-lg font-semibold">Accès Super Admin requis</p>
      </div>
    );
  }

  const pendingSignups = signupRequests.filter((s) => s.status === 'pending');

  return (
    <div className="max-w-7xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Shield className="w-8 h-8 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Super Admin</h1>
            <Badge>Plateforme SaaS</Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            Gestion complète : utilisateurs, essais, impayés, invitations et inscriptions vitrine.
          </p>
          <p className="text-xs text-muted-foreground mt-1">Connecté : {user?.email}</p>
        </div>
        <div className="flex gap-2">
          <Link to="/inviter">
            <Button variant="outline" size="sm" className="gap-2">
              <UserPlus className="w-4 h-4" /> Inviter
            </Button>
          </Link>
          <Link to="/onboarding">
            <Button variant="outline" size="sm" className="gap-2">
              <Building2 className="w-4 h-4" /> Nouvelle société
            </Button>
          </Link>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="users">Utilisateurs</TabsTrigger>
          <TabsTrigger value="invitations">
            Invitations
            {stats?.pending_invitations > 0 && (
              <Badge className="ml-2 h-5 px-1.5">{stats.pending_invitations}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="signups">
            Inscriptions vitrine
            {pendingSignups.length > 0 && (
              <Badge className="ml-2 h-5 px-1.5">{pendingSignups.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="companies">Sociétés</TabsTrigger>
          <TabsTrigger value="email">Email invitation</TabsTrigger>
        </TabsList>

        {/* ── Vue d'ensemble ── */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            {[
              { label: 'Utilisateurs', value: stats?.users, icon: Users },
              { label: 'Sociétés', value: stats?.companies, icon: Building2 },
              { label: 'Invitations', value: stats?.pending_invitations, icon: Mail },
              { label: 'Inscriptions', value: stats?.pending_signups, icon: Inbox },
              { label: 'Suspendues', value: stats?.suspended_companies, icon: PauseCircle },
              { label: 'Clients', value: stats?.clients, icon: Building2 },
              { label: 'Missions', value: stats?.missions, icon: LayoutDashboard },
              { label: 'Factures', value: stats?.invoices, icon: FileText },
            ].map(({ label, value, icon: Icon }) => (
              <Card key={label} className="p-3">
                <Icon className="w-4 h-4 text-primary mb-1" />
                <p className="text-xl font-bold">{value ?? '—'}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </Card>
            ))}
          </div>

          {pendingSignups.length > 0 && (
            <Card className="p-4 border-amber-300 bg-amber-50/50">
              <p className="font-medium flex items-center gap-2 text-amber-900">
                <Inbox className="w-4 h-4" />
                {pendingSignups.length} demande(s) d'inscription en attente
              </p>
              <Button size="sm" className="mt-2" onClick={() => setTab('signups')}>
                Traiter les demandes
              </Button>
            </Card>
          )}

          <Card className="p-4 border-dashed">
            <p className="text-sm text-muted-foreground">
              <strong>API site vitrine :</strong>{' '}
              <code className="text-xs bg-muted px-1 rounded">POST /api/public/signup-request</code>
              {' '}— connectez votre site phoenixsekur.com pour recevoir les demandes ici.
            </p>
          </Card>
        </TabsContent>

        {/* ── Utilisateurs ── */}
        <TabsContent value="users" className="space-y-4 mt-4">
          <Card className="p-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <UserPlus className="w-5 h-5" /> Créer / inviter un utilisateur
            </h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMut.mutate({ email, password: password || undefined, role });
              }}
              className="grid md:grid-cols-4 gap-3 items-end"
            >
              <div className="md:col-span-2 space-y-1">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label>Rôle</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="superadmin">Super Admin</SelectItem>
                    <SelectItem value="admin">Admin société</SelectItem>
                    <SelectItem value="user">Agent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>MDP (vide = email)</Label>
                <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Auto" />
              </div>
              <Button type="submit" disabled={createMut.isPending}>Créer</Button>
            </form>
          </Card>

          <Card className="p-6">
            <h2 className="font-semibold mb-4">Utilisateurs ({users.length})</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-3">Email</th>
                    <th className="pb-2 pr-3">Rôle</th>
                    <th className="pb-2 pr-3">Statut</th>
                    <th className="pb-2 pr-3">Créé</th>
                    <th className="pb-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-border/40">
                      <td className="py-3 pr-3 font-medium">{u.email}</td>
                      <td className="py-3 pr-3">
                        <Badge variant={u.role === 'superadmin' ? 'default' : 'secondary'}>{u.role}</Badge>
                      </td>
                      <td className="py-3 pr-3">
                        <StatusBadge active={u.isActive} reason={u.suspendReason} />
                      </td>
                      <td className="py-3 pr-3 text-muted-foreground text-xs">{fmtDate(u.createdAt)}</td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-1">
                          {u.isActive ? (
                            <Button
                              size="sm" variant="ghost"
                              className="text-amber-700"
                              onClick={() => toggleUserMut.mutate({
                                id: u.id, is_active: false,
                                suspend_reason: 'Suspendu par Super Admin',
                              })}
                            >
                              <PauseCircle className="w-3 h-3 mr-1" /> Pause
                            </Button>
                          ) : (
                            <Button
                              size="sm" variant="ghost"
                              className="text-green-700"
                              onClick={() => toggleUserMut.mutate({ id: u.id, is_active: true })}
                            >
                              <PlayCircle className="w-3 h-3 mr-1" /> Activer
                            </Button>
                          )}
                          <Button
                            size="sm" variant="ghost"
                            className="text-destructive"
                            onClick={() => {
                              if (window.confirm(`Supprimer ${u.email} ?`)) deleteMut.mutate(u.id);
                            }}
                          >
                            <Trash2 className="w-3 h-3 mr-1" /> Supprimer
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* ── Invitations ── */}
        <TabsContent value="invitations" className="mt-4">
          <Card className="p-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Send className="w-5 h-5" /> Invitations en attente ({invitations.length})
            </h2>
            {invitations.length === 0 ? (
              <p className="text-muted-foreground text-sm">Aucune invitation en cours.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 pr-3">Email</th>
                      <th className="pb-2 pr-3">Rôle</th>
                      <th className="pb-2 pr-3">Expire</th>
                      <th className="pb-2 pr-3">Invité par</th>
                      <th className="pb-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invitations.map((inv) => (
                      <tr key={inv.id} className="border-b border-border/40">
                        <td className="py-3 pr-3 font-medium">{inv.email}</td>
                        <td className="py-3 pr-3"><Badge variant="secondary">{inv.role}</Badge></td>
                        <td className="py-3 pr-3">
                          {inv.expired ? (
                            <Badge variant="destructive">Expirée</Badge>
                          ) : (
                            <span className="text-xs">{fmtDate(inv.expires_at)}</span>
                          )}
                        </td>
                        <td className="py-3 pr-3 text-xs text-muted-foreground">{inv.invited_by || '—'}</td>
                        <td className="py-3">
                          <Button
                            size="sm" variant="outline" className="gap-1"
                            disabled={resendMut.isPending}
                            onClick={() => resendMut.mutate(inv.id)}
                          >
                            <RefreshCw className="w-3 h-3" /> Renvoyer
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ── Inscriptions vitrine ── */}
        <TabsContent value="signups" className="mt-4">
          <Card className="p-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Inbox className="w-5 h-5" /> Demandes d'inscription site vitrine
            </h2>
            {signupRequests.length === 0 ? (
              <p className="text-muted-foreground text-sm">Aucune demande pour le moment.</p>
            ) : (
              <div className="space-y-4">
                {signupRequests.map((s) => (
                  <div key={s.id} className="border rounded-lg p-4 flex flex-wrap gap-4 justify-between">
                    <div className="space-y-1 min-w-[200px]">
                      <p className="font-semibold">{s.companyName}</p>
                      <p className="text-sm">{s.firstName} {s.lastName}</p>
                      <p className="text-sm text-muted-foreground">{s.email}</p>
                      {s.phone && <p className="text-xs">{s.phone}</p>}
                      {s.message && <p className="text-xs italic mt-2">{s.message}</p>}
                      <p className="text-xs text-muted-foreground mt-1">
                        Reçu le {fmtDate(s.createdAt)} · Essai proposé : {s.trialDays} jours
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant={
                        s.status === 'pending' ? 'secondary'
                          : s.status === 'approved' ? 'default' : 'destructive'
                      }>
                        {s.status === 'pending' ? 'En attente'
                          : s.status === 'approved' ? 'Approuvé' : 'Refusé'}
                      </Badge>
                      {s.trialEndsAt && (
                        <span className="text-xs flex items-center gap-1 text-muted-foreground">
                          <Clock className="w-3 h-3" /> Fin essai : {fmtDate(s.trialEndsAt)}
                        </span>
                      )}
                      {s.status === 'pending' && (
                        <div className="flex gap-2">
                          <Button
                            size="sm" className="gap-1"
                            onClick={() => approveMut.mutate({ id: s.id, trial_days: Number(trialDays) || 14 })}
                          >
                            <CheckCircle2 className="w-3 h-3" /> Approuver ({trialDays}j)
                          </Button>
                          <Button
                            size="sm" variant="outline" className="gap-1 text-destructive"
                            onClick={() => rejectMut.mutate(s.id)}
                          >
                            <XCircle className="w-3 h-3" /> Refuser
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ── Sociétés ── */}
        <TabsContent value="companies" className="mt-4">
          <Card className="p-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5" /> Sociétés & abonnements ({companies.length})
            </h2>
            {companies.length === 0 ? (
              <p className="text-muted-foreground text-sm">Aucune société.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 pr-3">Société</th>
                      <th className="pb-2 pr-3">Email</th>
                      <th className="pb-2 pr-3">Abonnement</th>
                      <th className="pb-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {companies.map((c) => (
                      <tr key={c.id} className="border-b border-border/40">
                        <td className="py-3 pr-3 font-medium">{c.company_name || c.company_id}</td>
                        <td className="py-3 pr-3 text-muted-foreground">{c.email || '—'}</td>
                        <td className="py-3 pr-3"><SubBadge sub={c.subscription} /></td>
                        <td className="py-3">
                          <div className="flex flex-wrap gap-1">
                            {c.subscription?.status === 'suspended' ? (
                              <Button
                                size="sm" variant="outline" className="gap-1 text-green-700"
                                onClick={() => companySubMut.mutate({
                                  companyId: c.company_id, status: 'active',
                                })}
                              >
                                <PlayCircle className="w-3 h-3" /> Réactiver
                              </Button>
                            ) : (
                              <Button
                                size="sm" variant="outline" className="gap-1 text-amber-700"
                                onClick={() => companySubMut.mutate({
                                  companyId: c.company_id,
                                  status: 'suspended',
                                  suspend_reason: 'Impayé — compte suspendu',
                                })}
                              >
                                <PauseCircle className="w-3 h-3" /> Suspendre (impayé)
                              </Button>
                            )}
                            <Button
                              size="sm" variant="ghost"
                              onClick={() => {
                                const d = window.prompt('Date fin essai (AAAA-MM-JJ) :');
                                if (!d) return;
                                companySubMut.mutate({
                                  companyId: c.company_id,
                                  status: 'trial',
                                  trial_ends_at: new Date(d).toISOString(),
                                });
                              }}
                            >
                              <Clock className="w-3 h-3 mr-1" /> Essai
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ── Email invitation ── */}
        <TabsContent value="email" className="space-y-4 mt-4">
          <Card className="p-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5" /> Personnaliser l'email d'invitation
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Variables disponibles :{' '}
              <code className="text-xs bg-muted px-1 rounded">{'{{invite_url}}'}</code>{' '}
              <code className="text-xs bg-muted px-1 rounded">{'{{role_label}}'}</code>{' '}
              <code className="text-xs bg-muted px-1 rounded">{'{{invited_by}}'}</code>{' '}
              <code className="text-xs bg-muted px-1 rounded">{'{{invited_by_line}}'}</code>{' '}
              <code className="text-xs bg-muted px-1 rounded">{'{{company_name}}'}</code>
            </p>
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Jours d'essai par défaut (vitrine)</Label>
                  <Input
                    type="number" min={1} max={90}
                    value={trialDays}
                    onChange={(e) => setTrialDays(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Emails alerte nouvelles inscriptions</Label>
                  <Input
                    value={notifyEmails}
                    onChange={(e) => setNotifyEmails(e.target.value)}
                    placeholder="contact@phoenixsekur.com, serviceclient@..."
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Objet de l'email</Label>
                <Input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Corps HTML</Label>
                <Textarea
                  rows={8} className="font-mono text-xs"
                  value={emailHtml} onChange={(e) => setEmailHtml(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Corps texte (fallback)</Label>
                <Textarea
                  rows={5} className="font-mono text-xs"
                  value={emailText} onChange={(e) => setEmailText(e.target.value)}
                />
              </div>
              <Button
                onClick={() => settingsMut.mutate({
                  invitation_subject: emailSubject,
                  invitation_body_html: emailHtml,
                  invitation_body_text: emailText,
                  default_trial_days: Number(trialDays) || 14,
                  signup_notify_emails: notifyEmails,
                })}
                disabled={settingsMut.isPending}
              >
                Enregistrer les paramètres
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
