import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { UserPlus, Shield, User, Building2, CheckCircle2, Copy, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useCompany } from '@/lib/useCompany';
import { useQuery } from '@tanstack/react-query';
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

export default function InviterUtilisateurs() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('user');
  const [inviteType, setInviteType] = useState('agent');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [inviteLink, setInviteLink] = useState(null);
  const [emailSent, setEmailSent] = useState(null);
  const [error, setError] = useState(null);
  const { companyId, isAdmin } = useCompany();

  const { data: agents = [] } = useQuery({
    queryKey: ['agents', companyId],
    queryFn: () => base44.entities.Agent.filter({ company_id: companyId }),
    enabled: !!companyId,
  });

  const roleKey = inviteType === 'client' ? 'client' : role;
  const roleInfo = ROLE_CONFIG[roleKey] || ROLE_CONFIG.user;
  const RoleIcon = roleInfo.icon;

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

      if (result.email_sent) {
        toast.success(`Email envoyé à ${email}`);
      } else if (result.invite_url) {
        toast.warning('Email non envoyé — copiez le lien d\'invitation');
      }
      setEmail('');
    } catch (e) {
      setError(e.message || 'Erreur lors de l\'invitation');
      toast.error(e.message || 'Erreur invitation');
    }
    setLoading(false);
  };

  const copyLink = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
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
    <div className="max-w-2xl mx-auto">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Inviter des utilisateurs</h1>
        <p className="text-muted-foreground mt-1 text-sm">Gérez les accès à votre espace SEKUR</p>
      </div>

      <Card className="p-4 sm:p-6 mb-6">
        <h2 className="text-base sm:text-lg font-semibold mb-4">Envoyer une invitation</h2>
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
                    <Button type="button" variant="outline" size="icon" onClick={copyLink} title="Copier">
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
        <h2 className="text-base sm:text-lg font-semibold mb-4">Agents enregistrés ({agents.length})</h2>
        <div className="space-y-2">
          {agents.slice(0, 8).map((a) => (
            <div key={a.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                {a.first_name?.[0]}{a.last_name?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{a.first_name} {a.last_name}</p>
                {a.email && <p className="text-xs text-muted-foreground truncate">{a.email}</p>}
              </div>
              <Badge variant="outline" className="text-xs shrink-0">{a.status}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
