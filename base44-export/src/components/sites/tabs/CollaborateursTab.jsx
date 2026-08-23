import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Search, Users } from 'lucide-react';
import { useCompany } from '@/lib/useCompany';

export default function CollaborateursTab({ form, update }) {
  const [search, setSearch] = useState('');
  const { companyId: sessionCompanyId } = useCompany();
  const companyId = form.company_id || sessionCompanyId;

  const { data: agents = [], isLoading } = useQuery({
    queryKey: ['site-agents', companyId],
    queryFn: () => base44.entities.Agent.filter({ company_id: companyId }, '-last_name', 200),
    enabled: !!companyId,
  });

  const selected = form.agent_ids || [];
  const toggle = (id) => {
    update('agent_ids', selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  };

  const filtered = agents.filter(a => {
    const full = `${a.first_name || ''} ${a.last_name || ''}`.toLowerCase();
    return full.includes(search.toLowerCase());
  });

  const initials = (a) => `${(a.first_name || '')[0] || ''}${(a.last_name || '')[0] || ''}`.toUpperCase() || '?';

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-slate-700 mb-1">Collaborateurs affectés au site</h3>
        <p className="text-sm text-muted-foreground">Sélectionnez les collaborateurs habilités à intervenir sur ce site.</p>
      </div>

      <div className="relative max-w-md">
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un collaborateur..." className="pl-9" />
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium">{selected.length} affecté(s)</span>
        <span className="text-muted-foreground">sur {agents.length} collaborateur(s)</span>
      </div>

      <div className="border border-border rounded-lg divide-y divide-border max-h-[50vh] overflow-y-auto">
        {isLoading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Chargement des collaborateurs…</div>
        ) : !companyId ? (
          <div className="p-6 flex flex-col items-center text-center text-muted-foreground">
            <Users className="w-8 h-8 mb-2 opacity-40" />
            <span className="text-sm">Société non identifiée — reconnectez-vous</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6 flex flex-col items-center text-center text-muted-foreground">
            <Users className="w-8 h-8 mb-2 opacity-40" />
            <span className="text-sm">Aucun collaborateur trouvé</span>
            <span className="text-xs mt-1">Créez des collaborateurs dans le menu Équipe, puis revenez ici.</span>
          </div>
        ) : filtered.map(a => {
          const checked = selected.includes(a.id);
          return (
            <label key={a.id} className="flex items-center gap-3 p-3 hover:bg-accent/40 cursor-pointer">
              <Checkbox checked={checked} onCheckedChange={() => toggle(a.id)} />
              <Avatar className="h-9 w-9"><AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{initials(a)}</AvatarFallback></Avatar>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{a.first_name} {a.last_name}</div>
                <div className="text-xs text-muted-foreground truncate">{a.fonction || a.role || 'Collaborateur'} · {a.status || 'actif'}</div>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
