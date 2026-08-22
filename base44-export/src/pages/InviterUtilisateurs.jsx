import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';

import { UserPlus, Mail, Shield, User, Building2, CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useCompany } from '@/lib/useCompany';
import { useQuery } from '@tanstack/react-query';

const ROLE_CONFIG = {
  admin: { label: 'Administrateur', desc: 'Accès complet à toutes les fonctionnalités', icon: Shield, color: 'text-red-600 bg-red-50' },
  user: { label: 'Agent / Collaborateur', desc: 'Accès espace agent : missions, rondes, PTI, fiches de paie', icon: User, color: 'text-blue-600 bg-blue-50' },
};

export default function InviterUtilisateurs() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('user');
  const [inviteType, setInviteType] = useState('agent'); // 'agent' or 'client'
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [inviteLink, setInviteLink] = useState(null);
  const [error, setError] = useState(null);
  const { companyId, isAdmin } = useCompany();

  const { data: agents = [] } = useQuery({ queryKey: ['agents', companyId], queryFn: () => base44.entities.Agent.filter({ company_id: companyId }), enabled: !!companyId });
  const { data: clients = [] } = useQuery({ queryKey: ['clients', companyId], queryFn: () => base44.entities.Client.filter({ company_id: companyId }), enabled: !!companyId });

  const handleInvite = async () => {
    if (!email) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    setInviteLink(null);
    try {
      const result = await base44.users.inviteUser(email, role === 'admin' ? 'admin' : 'user');
      
      // If inviting a client, create client record automatically
      if (inviteType === 'client' && companyId) {
        const existingClients = await base44.entities.Client.filter({ email, company_id: companyId });
        if (existingClients.length === 0) {
          await base44.entities.Client.create({
            company_id: companyId,
            company_name: email.split('@')[0],
            email,
            status: 'actif',
          });
        }
      }
      
      if (result.email_sent) {
        setSuccess(`Invitation envoyée par email à ${email}`);
      } else if (result.message) {
        setSuccess(result.message);
        if (result.invite_url) setInviteLink(result.invite_url);
      } else {
        setSuccess(`Invitation créée pour ${email}`);
      }
      setEmail('');
    } catch (e) {
      setError(e.message || 'Erreur lors de l\'invitation');
    }
    setLoading(false);
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
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Inviter des utilisateurs</h1>
        <p className="text-muted-foreground mt-1">Gérez les accès à votre espace SEKUR</p>
      </div>

      <Card className="p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Envoyer une invitation</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div
              onClick={() => setInviteType('agent')}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${inviteType === 'agent' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}
            >
              <User className={`w-6 h-6 mb-2 ${inviteType === 'agent' ? 'text-primary' : 'text-muted-foreground'}`} />
              <p className="font-semibold text-sm">Agent / Salarié</p>
              <p className="text-xs text-muted-foreground">Accès espace agent</p>
            </div>
            <div
              onClick={() => setInviteType('client')}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${inviteType === 'client' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}
            >
              <Building2 className={`w-6 h-6 mb-2 ${inviteType === 'client' ? 'text-primary' : 'text-muted-foreground'}`} />
              <p className="font-semibold text-sm">Client</p>
              <p className="text-xs text-muted-foreground">Accès espace client</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Email *</Label>
            <Input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="exemple@email.com"
            />
          </div>

          <div className="space-y-2">
            <Label>Rôle</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">{inviteType === 'client' ? 'Client' : 'Agent / Collaborateur'}</SelectItem>
                <SelectItem value="admin">Administrateur</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className={`p-3 rounded-lg ${ROLE_CONFIG[role]?.color || 'bg-muted'}`}>
            <div className="flex items-start gap-2">
              {React.createElement(ROLE_CONFIG[role]?.icon || User, { className: 'w-4 h-4 mt-0.5 shrink-0' })}
              <div>
                <p className="text-sm font-medium">{ROLE_CONFIG[role]?.label}</p>
                <p className="text-xs mt-0.5">{ROLE_CONFIG[role]?.desc}</p>
              </div>
            </div>
          </div>

          {success && (
            <div className="flex flex-col gap-2 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {success}
              </div>
              {inviteLink && (
                <p className="text-xs break-all">
                  Lien à transmettre manuellement : {inviteLink}
                </p>
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

      {/* Users already in system */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Agents enregistrés ({agents.length})</h2>
        <div className="space-y-2">
          {agents.slice(0, 8).map(a => (
            <div key={a.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                {a.first_name?.[0]}{a.last_name?.[0]}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{a.first_name} {a.last_name}</p>
                {a.email && <p className="text-xs text-muted-foreground">{a.email}</p>}
              </div>
              <Badge variant="outline" className="text-xs">{a.status}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}