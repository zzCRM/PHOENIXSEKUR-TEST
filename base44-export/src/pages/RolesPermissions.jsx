import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Shield, Users, KeyRound, Sparkles } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { useCompany } from '@/lib/useCompany';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  ROLES_KIND, allPermissionIds, countPermissions, resolveEffective, rolesConfigId, templateByKey,
} from '@/lib/rolePermissions';
import RoleEditorModal from '@/components/roles/RoleEditorModal';
import AccessSheet, { Matrix } from '@/components/roles/AccessSheet';

const TABS = ['Rôles', 'Matrice des permissions', 'Collaborateurs'];

export default function RolesPermissions() {
  const { companyId, isAdmin, user } = useCompany();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState('Rôles');
  const [editor, setEditor] = useState(null);
  const [matrixRoleId, setMatrixRoleId] = useState('');
  const [copyFrom, setCopyFrom] = useState('');
  const [draftGrants, setDraftGrants] = useState(null);
  const [accessAgent, setAccessAgent] = useState(null);
  const [simulation, setSimulation] = useState(null);

  const { data: settings = [] } = useQuery({
    queryKey: ['companySettings', companyId],
    queryFn: () => base44.entities.CompanySettings.filter({ company_id: companyId }),
    enabled: !!companyId && isAdmin,
  });
  const { data: agents = [] } = useQuery({
    queryKey: ['agents', companyId],
    queryFn: () => base44.entities.Agent.filter({ company_id: companyId }),
    enabled: !!companyId && isAdmin,
  });
  const { data: sites = [] } = useQuery({
    queryKey: ['sites', companyId],
    queryFn: () => base44.entities.Site.filter({ company_id: companyId }),
    enabled: !!companyId && isAdmin,
  });

  const config = settings.find((item) => item.kind === ROLES_KIND || String(item.id || '').startsWith('roles-acces-'));
  const roles = config?.roles || [];
  const history = config?.historique || [];
  const selectedId = matrixRoleId || roles[0]?.id || '';
  const selected = roles.find((item) => item.id === selectedId);
  const grants = draftGrants || selected?.grants || {};
  const linkedAgent = agents.find((item) => item.id === params.get('agent'));

  React.useEffect(() => {
    if (linkedAgent) setAccessAgent(linkedAgent);
  }, [linkedAgent]);

  const stats = useMemo(() => ({
    roles: roles.length,
    agents: agents.length,
    permissions: countPermissions(),
    custom: roles.filter((item) => !item.template || item.template === 'personnalise').length,
  }), [roles, agents]);

  const persist = async (nextRoles, nextHistory = history) => {
    const payload = { kind: ROLES_KIND, roles: nextRoles, historique: nextHistory.slice(0, 200), company_id: companyId };
    if (config?.id) await base44.entities.CompanySettings.update(config.id, payload);
    else await base44.entities.CompanySettings.create({ ...payload, id: rolesConfigId(companyId) });
    await qc.invalidateQueries({ queryKey: ['companySettings', companyId] });
  };

  const saveRole = async (form) => {
    if (!form.name.trim()) { toast.error('Indiquez le nom du rôle'); return; }
    const id = editor?.id || `role-${Date.now()}`;
    const next = { id, ...form, name: form.name.trim(), updated_at: new Date().toISOString() };
    const list = editor?.id ? roles.map((item) => item.id === id ? { ...item, ...next } : item) : [...roles, next];
    const entries = editor?.id ? changed(editor.grants || {}, next.grants).map((item) => entry(user, null, item, next.name)) : [];
    await persist(list, [...entries, ...history]);
    setEditor(null);
    setMatrixRoleId(id);
    setDraftGrants(null);
    toast.success('Rôle enregistré');
  };

  const saveMatrix = async () => {
    if (!selected) return;
    const entries = changed(selected.grants || {}, grants).map((item) => entry(user, null, item, selected.name));
    const list = roles.map((item) => item.id === selected.id ? { ...item, grants } : item);
    await persist(list, [...entries, ...history]);
    setDraftGrants(null);
    toast.success('Permissions enregistrées');
  };

  const saveAccess = async (partial) => {
    const before = resolveEffective(accessAgent, roles).grants;
    const after = resolveEffective({ ...accessAgent, ...partial }, roles).grants;
    const entries = changed(before, after).map((item) => entry(user, accessAgent, item, ''));
    await base44.entities.Agent.update(accessAgent.id, partial);
    if (entries.length) await persist(roles, [...entries, ...history]);
    await qc.invalidateQueries({ queryKey: ['agents', companyId] });
    setAccessAgent(null);
    setParams({});
    toast.success('Accès du collaborateur enregistrés');
  };

  if (!isAdmin) {
    return <p className="text-sm text-slate-500">La gestion des rôles est réservée aux administrateurs de la société.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#10192b]">Rôles & Permissions</h1>
          <p className="text-sm text-slate-500 mt-1">Gérez les autorisations et les accès de vos collaborateurs.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button type="button" variant="outline" onClick={() => setTab('Matrice des permissions')}>Gérer les permissions</Button>
          <Button type="button" className="bg-[#e4b54a] hover:bg-[#d7a63a] text-[#1c1403]" onClick={() => setEditor({})}>Créer un rôle</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <Stat icon={Shield} label="Rôles" value={stats.roles} />
        <Stat icon={Users} label="Collaborateurs" value={stats.agents} />
        <Stat icon={KeyRound} label="Permissions" value={stats.permissions} />
        <Stat icon={Sparkles} label="Rôles personnalisés" value={stats.custom} />
      </div>

      <div className="flex overflow-x-auto bg-white rounded-2xl border">
        {TABS.map((item) => (
          <button key={item} type="button" onClick={() => setTab(item)} className={cn('shrink-0 px-4 py-3 text-sm border-b-2', tab === item ? 'border-[#e4b54a] font-semibold text-[#1c1403]' : 'border-transparent text-slate-500')}>{item}</button>
        ))}
      </div>

      {tab === 'Rôles' && (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {roles.map((item) => (
            <article key={item.id} className="rounded-2xl border bg-white shadow-sm p-4">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-full" style={{ background: item.color || '#10192b' }} />
                <div className="min-w-0">
                  <h2 className="font-semibold text-[#10192b] truncate">{item.name}</h2>
                  <p className="text-xs text-slate-500">{templateByKey(item.template).label} · {item.status === 'inactif' ? 'Inactif' : 'Actif'}</p>
                </div>
              </div>
              <p className="text-sm text-slate-600 mt-2 min-h-10">{item.description || 'Sans description'}</p>
              <div className="flex gap-2 mt-3">
                <Button type="button" variant="outline" onClick={() => { setEditor(item); }}>Modifier</Button>
                <Button type="button" variant="outline" onClick={() => { setTab('Matrice des permissions'); setMatrixRoleId(item.id); setDraftGrants(null); }}>Permissions</Button>
              </div>
            </article>
          ))}
          {roles.length === 0 && <p className="text-sm text-slate-500">Aucun rôle. Les modèles proposés restent modifiables une fois créés.</p>}
        </div>
      )}

      {tab === 'Matrice des permissions' && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <select className="h-9 rounded-md border bg-white px-3 text-sm" value={selectedId} onChange={(event) => { setMatrixRoleId(event.target.value); setDraftGrants(null); }}>
              {roles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <select className="h-9 rounded-md border bg-white px-3 text-sm" value={copyFrom} onChange={(event) => setCopyFrom(event.target.value)}>
              <option value="">Copier les droits d’un rôle</option>
              {roles.filter((item) => item.id !== selectedId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <Button type="button" variant="outline" disabled={!copyFrom} onClick={() => setDraftGrants({ ...(roles.find((item) => item.id === copyFrom)?.grants || {}) })}>Copier</Button>
            <Button type="button" className="bg-[#e4b54a] hover:bg-[#d7a63a] text-[#1c1403]" disabled={!selected} onClick={saveMatrix}>Enregistrer</Button>
          </div>
          {!selected && <p className="text-sm text-slate-500">Créez un rôle pour régler sa matrice.</p>}
          {selected && (
            <Matrix
              grants={grants}
              onToggle={(id, value) => setDraftGrants((current) => ({ ...(current || selected.grants || {}), [id]: value }))}
              onToggleMany={(ids, value) => setDraftGrants((current) => ({ ...(current || selected.grants || {}), ...Object.fromEntries(ids.map((id) => [id, value])) }))}
            />
          )}
        </div>
      )}

      {tab === 'Collaborateurs' && (
        <div className="grid md:grid-cols-2 gap-3">
          {agents.map((agent) => {
            const names = roles.filter((item) => (agent.role_ids || []).includes(item.id)).map((item) => item.name);
            return (
              <button key={agent.id} type="button" onClick={() => setAccessAgent(agent)} className="text-left rounded-2xl border bg-white shadow-sm p-4 hover:border-[#e4b54a]">
                <p className="font-semibold text-[#10192b]">{agent.first_name} {agent.last_name}</p>
                <p className="text-xs text-slate-500">{agent.fonction || 'Fonction non renseignée'} · {agent.status === 'inactif' ? 'Inactif' : 'Actif'}</p>
                <p className="text-sm mt-2">{names.length ? names.join(', ') : 'Aucun rôle métier'}</p>
              </button>
            );
          })}
        </div>
      )}

      <RoleEditorModal open={!!editor} role={editor?.id ? editor : null} onClose={() => setEditor(null)} onSave={saveRole} />
      {accessAgent && (
        <AccessSheet
          agent={accessAgent}
          roles={roles}
          sites={sites}
          history={history}
          onClose={() => { setAccessAgent(null); setParams({}); }}
          onSave={saveAccess}
          onSimulate={(agent) => setSimulation(agent)}
        />
      )}
      {simulation && <Simulation agent={simulation} roles={roles} onClose={() => setSimulation(null)} />}
    </div>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border bg-white shadow-sm p-4 flex items-center gap-3">
      <span className="w-10 h-10 rounded-full bg-[#f6e7c3] text-[#1c1403] flex items-center justify-center"><Icon className="w-4 h-4" /></span>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-xl font-bold text-[#10192b]">{value}</p>
      </div>
    </div>
  );
}

function changed(before, after) {
  const ids = new Set([...Object.keys(before || {}), ...Object.keys(after || {}), ...allPermissionIds()]);
  const rows = [];
  for (const id of ids) {
    const previous = before?.[id] === true;
    const next = after?.[id] === true;
    if (previous !== next) rows.push({ permission: id, before: previous, after: next });
  }
  return rows.slice(0, 30);
}

function entry(user, agent, change, roleName) {
  return {
    id: `${Date.now()}-${change.permission}`,
    at: new Date().toISOString(),
    admin_email: user?.email || '',
    admin_name: [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.email || 'Administrateur',
    agent_id: agent?.id || '',
    agent_name: agent ? `${agent.first_name || ''} ${agent.last_name || ''}`.trim() : '',
    role_name: roleName,
    permission: change.permission,
    before: change.before ? 'autorisé' : 'refusé',
    after: change.after ? 'autorisé' : 'refusé',
  };
}

const MENUS = [
  ['Planning', 'planning.consulter'],
  ['Créer une vacation', 'planning.creer'],
  ['Rondes', 'rondes.consulter'],
  ['Audits', 'audits.consulter'],
  ['Main courante', 'main_courante.consulter'],
  ['Points de contrôle', 'points_controle.consulter'],
  ['Prise de poste', 'services.pointer'],
  ['PTI', 'pti.consulter'],
  ['Congés', 'conges.consulter'],
  ['Documents', 'documents.consulter'],
  ['Facturation', 'facturation.consulter'],
  ['Paramètres', 'parametres.consulter'],
];

function Simulation({ agent, roles, onClose }) {
  const { grants, perimetre } = resolveEffective(agent, roles);
  const label = PERIMETRES_LABEL[perimetre] || 'périmètre du rôle';
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-y-auto p-4">
        <h2 className="font-semibold text-[#10192b]">Simulation — {agent.first_name} {agent.last_name}</h2>
        <p className="text-xs text-slate-500 mb-3">Aperçu des menus autorisés. Aucune action n’est faite en son nom. Périmètre : {label}. {(agent.role_ids || []).length ? '' : 'Aucun rôle métier n’est coché : ces menus restent refusés tant qu’un rôle n’est pas attribué.'}</p>
        <ul className="space-y-1">
          {MENUS.map(([name, key]) => (
            <li key={key} className={cn('rounded-xl px-3 py-2 text-sm', grants[key] ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-700')}>
              {grants[key] ? 'Autorisé' : 'Interdit'} · {name}
            </li>
          ))}
        </ul>
        <Button type="button" className="mt-3" variant="outline" onClick={onClose}>Fermer</Button>
      </div>
    </div>
  );
}

const PERIMETRES_LABEL = Object.fromEntries([
  ['personnel', 'données personnelles'],
  ['equipe', 'équipe'],
  ['site', 'site'],
  ['sites', 'plusieurs sites'],
  ['tous_sites', 'tous les sites'],
  ['entreprise', 'entreprise entière'],
]);
