import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Shield, Users, Building2, CreditCard, UserPlus,
  FileText, LayoutDashboard, Mail, KeyRound, ExternalLink,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useSuperAdmin } from '@/lib/useSuperAdmin';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

export default function SuperAdmin() {
  const { isSuperAdmin, user } = useSuperAdmin();
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('admin');
  const [createdPassword, setCreatedPassword] = useState(null);

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

  const createMut = useMutation({
    mutationFn: (data) => base44.admin.createUser(data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      setCreatedPassword(res.temporary_password);
      setEmail('');
      setPassword('');
      toast.success(`Compte créé : ${res.email}`);
    },
    onError: (e) => toast.error(e.message || 'Erreur création'),
  });

  const resetMut = useMutation({
    mutationFn: ({ id, password: pwd }) => base44.admin.updateUser(id, { password: pwd }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Mot de passe réinitialisé');
    },
    onError: (e) => toast.error(e.message || 'Erreur'),
  });

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <Shield className="w-12 h-12 mb-4 opacity-30" />
        <p className="text-lg font-semibold">Accès Super Admin requis</p>
        <p className="text-sm mt-2">Connectez-vous avec un compte administrateur plateforme.</p>
      </div>
    );
  }

  const handleCreate = (e) => {
    e.preventDefault();
    if (!email) return;
    createMut.mutate({
      email,
      password: password || undefined,
      role,
    });
  };

  const handleReset = (id) => {
    const pwd = window.prompt('Nouveau mot de passe (min. 8 caractères) :');
    if (!pwd || pwd.length < 8) return;
    resetMut.mutate({ id, password: pwd });
  };

  return (
    <div className="max-w-6xl space-y-8">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <Shield className="w-8 h-8 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Super Admin</h1>
          <Badge variant="secondary">Plateforme</Badge>
        </div>
        <p className="text-muted-foreground">
          Gérez utilisateurs, sociétés et accès — sans passer par le serveur (KVM/SSH).
        </p>
        <p className="text-xs text-muted-foreground mt-1">Connecté : {user?.email}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Utilisateurs', value: stats?.users ?? '—', icon: Users },
          { label: 'Sociétés', value: stats?.companies ?? '—', icon: Building2 },
          { label: 'Clients', value: stats?.clients ?? '—', icon: Building2 },
          { label: 'Missions', value: stats?.missions ?? '—', icon: LayoutDashboard },
          { label: 'Factures', value: stats?.invoices ?? '—', icon: FileText },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label} className="p-4">
            <Icon className="w-5 h-5 text-primary mb-2" />
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </Card>
        ))}
      </div>

      {/* Raccourcis SaaS */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Espace plateforme</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link to="/onboarding">
            <Button variant="outline" className="w-full gap-2 h-auto py-3 flex-col">
              <Building2 className="w-5 h-5" />
              <span>Nouvelle société</span>
            </Button>
          </Link>
          <Link to="/inviter">
            <Button variant="outline" className="w-full gap-2 h-auto py-3 flex-col">
              <UserPlus className="w-5 h-5" />
              <span>Invitations</span>
            </Button>
          </Link>
          <Link to="/facturation">
            <Button variant="outline" className="w-full gap-2 h-auto py-3 flex-col">
              <FileText className="w-5 h-5" />
              <span>Facturation</span>
            </Button>
          </Link>
          <Link to="/">
            <Button variant="outline" className="w-full gap-2 h-auto py-3 flex-col">
              <LayoutDashboard className="w-5 h-5" />
              <span>CRM Sekur</span>
            </Button>
          </Link>
        </div>
      </Card>

      {/* Abonnements — placeholder comme Stripe Billing */}
      <Card className="p-6 border-dashed">
        <div className="flex items-start gap-4">
          <CreditCard className="w-8 h-8 text-muted-foreground shrink-0" />
          <div>
            <h2 className="text-lg font-semibold">Abonnements</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Module à venir — gestion des plans, essais et renouvellements (type Stripe / Chargebee).
              En attendant, la facturation métier est dans <Link to="/facturation" className="text-primary underline">Facturation</Link>.
            </p>
          </div>
        </div>
      </Card>

      {/* Créer utilisateur */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <UserPlus className="w-5 h-5" />
          Créer un utilisateur
        </h2>
        <form onSubmit={handleCreate} className="grid md:grid-cols-4 gap-4 items-end">
          <div className="space-y-2 md:col-span-2">
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="serviceclient@ppsecurity.fr"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Rôle</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="superadmin">Super Admin</SelectItem>
                <SelectItem value="admin">Admin société</SelectItem>
                <SelectItem value="user">Agent / User</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Mot de passe (optionnel)</Label>
            <Input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Auto si vide"
            />
          </div>
          <Button type="submit" disabled={createMut.isPending} className="md:col-span-4 md:w-auto">
            Créer le compte
          </Button>
        </form>
        {createdPassword && (
          <div className="mt-4 p-4 bg-primary/5 border border-primary/20 rounded-lg text-sm">
            <p className="font-medium flex items-center gap-2">
              <KeyRound className="w-4 h-4" />
              Mot de passe à communiquer :
            </p>
            <code className="block mt-2 text-base font-mono">{createdPassword}</code>
          </div>
        )}
      </Card>

      {/* Liste utilisateurs */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Mail className="w-5 h-5" />
          Utilisateurs ({users.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 pr-4">Email</th>
                <th className="pb-2 pr-4">Rôle</th>
                <th className="pb-2 pr-4">Société</th>
                <th className="pb-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border/50">
                  <td className="py-3 pr-4 font-medium">{u.email}</td>
                  <td className="py-3 pr-4">
                    <Badge variant={u.role === 'superadmin' ? 'default' : 'secondary'}>{u.role}</Badge>
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground text-xs font-mono">{u.companyId?.slice(0, 12)}…</td>
                  <td className="py-3">
                    <Button size="sm" variant="ghost" onClick={() => handleReset(u.id)}>
                      Réinitialiser MDP
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Sociétés */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Building2 className="w-5 h-5" />
          Sociétés ({companies.length})
        </h2>
        {companies.length === 0 ? (
          <p className="text-muted-foreground text-sm">Aucune société — importez vos données ou créez-en une via Onboarding.</p>
        ) : (
          <ul className="space-y-2">
            {companies.map((c) => (
              <li key={c.id} className="flex justify-between items-center py-2 border-b border-border/50 text-sm">
                <span className="font-medium">{c.company_name || c.company_id}</span>
                <span className="text-muted-foreground">{c.email || c.city}</span>
              </li>
            ))}
          </ul>
        )}
        <Link to="/onboarding" className="inline-flex items-center gap-1 text-sm text-primary mt-4 hover:underline">
          <ExternalLink className="w-4 h-4" /> Ajouter une société
        </Link>
      </Card>
    </div>
  );
}
