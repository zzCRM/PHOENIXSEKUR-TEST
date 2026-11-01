import React, { useMemo, useState } from 'react';
import { X, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { PERIMETRES, PERMISSION_MODULES, permissionId, permissionLabel, resolveEffective, ROLE_TEMPLATES } from '@/lib/rolePermissions';
import { cn } from '@/lib/utils';

const TABS = ['Informations', 'Rôles', 'Permissions effectives', 'Exceptions individuelles', 'Historique'];

export default function AccessSheet({ agent, roles, sites, history, onClose, onSave, onSimulate }) {
  const [tab, setTab] = useState('Rôles');
  const [roleIds, setRoleIds] = useState(agent.role_ids || []);
  const [exceptions, setExceptions] = useState({ ...(agent.exceptions || {}) });
  const [perimetre, setPerimetre] = useState(agent.perimetre || '');
  const [siteIds, setSiteIds] = useState(agent.site_ids || []);
  const preview = useMemo(() => resolveEffective({ ...agent, role_ids: roleIds, exceptions, perimetre }, roles), [agent, roleIds, exceptions, perimetre, roles]);
  const baseGrants = useMemo(() => resolveEffective({ ...agent, role_ids: roleIds, exceptions: {}, perimetre }, roles).grants, [agent, roleIds, perimetre, roles]);
  const shownExceptions = { ...baseGrants, ...exceptions };
  const setException = (id, value) => setExceptions((current) => {
    const next = { ...current };
    if (value === (baseGrants[id] === true)) delete next[id];
    else next[id] = value;
    return next;
  });
  const setExceptionMany = (ids, value) => setExceptions((current) => {
    const next = { ...current };
    for (const id of ids) {
      if (value === (baseGrants[id] === true)) delete next[id];
      else next[id] = value;
    }
    return next;
  });
  const ownHistory = history.filter((item) => item.agent_id === agent.id);

  const toggleRole = (id) => setRoleIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/45 sm:py-4 px-0 sm:px-4 overflow-y-auto">
      <div className="bg-[#f7f8fb] sm:rounded-3xl shadow-2xl w-full max-w-4xl flex flex-col h-[100dvh] sm:h-auto sm:max-h-[94vh] overflow-hidden">
        <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-4 bg-[#10192b] text-white">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center overflow-hidden shrink-0">
              {agent.photo_url ? <img src={agent.photo_url} alt="" className="w-full h-full object-cover" /> : <User className="w-5 h-5" />}
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-bold truncate">{agent.first_name} {agent.last_name}</h2>
              <p className="text-xs text-white/60 truncate">{agent.fonction || 'Fonction non renseignée'} · {agent.status === 'inactif' ? 'Compte inactif' : 'Compte actif'}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center"><X className="w-5 h-5" /></button>
        </div>
        <div className="shrink-0 flex overflow-x-auto bg-white border-b">
          {TABS.map((item) => (
            <button key={item} type="button" onClick={() => setTab(item)} className={cn('shrink-0 px-3 py-2 text-sm border-b-2', tab === item ? 'border-[#e4b54a] font-semibold' : 'border-transparent text-slate-500')}>{item}</button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {tab === 'Informations' && (
            <div className="rounded-2xl border bg-white p-4 text-sm space-y-2">
              <Line label="Email" value={agent.email} />
              <Line label="Téléphone" value={agent.phone} />
              <Line label="Fonction" value={agent.fonction} />
              <Line label="Compte" value={agent.acces_espace_agent === false || agent.status === 'inactif' ? 'Inactif' : 'Actif'} />
              <Line label="Sites autorisés" value={sites.filter((site) => siteIds.includes(site.id)).map((site) => site.name).join(', ')} />
            </div>
          )}
          {tab === 'Rôles' && (
            <div className="space-y-2">
              {roles.filter((item) => item.status !== 'inactif').map((item) => (
                <label key={item.id} className={cn('flex items-center gap-3 rounded-xl border bg-white px-3 py-2', roleIds.includes(item.id) && 'border-[#e4b54a]')}>
                  <input type="checkbox" checked={roleIds.includes(item.id)} onChange={() => toggleRole(item.id)} />
                  <span className="w-3 h-3 rounded-full" style={{ background: item.color || '#10192b' }} />
                  <span className="flex-1 text-sm font-medium">{item.name}</span>
                  <span className="text-xs text-slate-400">{ROLE_TEMPLATES.find((template) => template.key === item.template)?.label || 'Personnalisé'}</span>
                </label>
              ))}
              {roles.length === 0 && <p className="text-sm text-slate-500">Aucun rôle n’est encore créé.</p>}
              <label className="block text-xs text-slate-500">Périmètre d’accès
                <select className="mt-1 w-full h-9 rounded-md border px-3 text-sm bg-white" value={perimetre} onChange={(event) => setPerimetre(event.target.value)}>
                  <option value="">Reprendre le périmètre du rôle</option>
                  {PERIMETRES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <div className="rounded-2xl border bg-white p-3 space-y-1">
                <p className="text-xs font-medium text-slate-500">Sites autorisés</p>
                {sites.map((site) => (
                  <label key={site.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={siteIds.includes(site.id)} onChange={() => setSiteIds((current) => current.includes(site.id) ? current.filter((id) => id !== site.id) : [...current, site.id])} />
                    {site.name}
                  </label>
                ))}
                {sites.length === 0 && <p className="text-sm text-slate-400">Aucun site enregistré.</p>}
              </div>
            </div>
          )}
          {tab === 'Permissions effectives' && <Matrix grants={preview.grants} readOnly />}
          {tab === 'Exceptions individuelles' && (
            <div className="space-y-2">
              <p className="text-xs text-slate-500">Une exception ne change que ce collaborateur. Les autres personnes du même rôle restent inchangées.</p>
              <Matrix grants={shownExceptions} onToggle={setException} onToggleMany={setExceptionMany} />
            </div>
          )}
          {tab === 'Historique' && (
            <div className="space-y-2">
              {ownHistory.length === 0 && <p className="text-sm text-slate-500">Aucune modification enregistrée pour ce collaborateur.</p>}
              {ownHistory.map((item) => (
                <article key={item.id} className="rounded-xl border bg-white px-3 py-2 text-sm">
                  <p className="font-medium">{permissionLabel(item.permission)}</p>
                  <p className="text-xs text-slate-500">{item.before} → {item.after} · {item.admin_name || item.admin_email || 'Administrateur'}</p>
                  <p className="text-xs text-slate-400">{new Date(item.at).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })} (heure de Paris)</p>
                </article>
              ))}
            </div>
          )}
        </div>
        <div className="shrink-0 flex flex-col sm:flex-row gap-2 px-4 py-3 border-t bg-white">
          <Button type="button" className="bg-[#e4b54a] hover:bg-[#d7a63a] text-[#1c1403] sm:mr-auto" onClick={() => onSimulate({ ...agent, role_ids: roleIds, exceptions, perimetre })}>Simuler les accès</Button>
          <Button type="button" variant="outline" onClick={onClose}>Fermer</Button>
          <Button type="button" onClick={() => onSave({ role_ids: roleIds, exceptions, perimetre, site_ids: siteIds })}>Enregistrer</Button>
        </div>
      </div>
    </div>
  );
}

function Line({ label, value }) {
  return <p className="flex justify-between gap-3"><span className="text-slate-500">{label}</span><span className="font-medium text-right">{value || 'Non renseigné'}</span></p>;
}

export function Matrix({ grants, onToggle, onToggleMany, readOnly, exception }) {
  return (
    <div className="space-y-2">
      {PERMISSION_MODULES.map((module) => {
        const ids = module.actions.map(([action]) => permissionId(module.key, action));
        const enabled = ids.filter((id) => grants[id] === true).length;
        return (
          <details key={module.key} className="rounded-2xl border bg-white" open={module.key === 'planning'}>
            <summary className="flex items-center gap-3 px-3 py-3 cursor-pointer list-none">
              <span className="w-8 h-8 rounded-full bg-[#f6e7c3] text-[#1c1403] text-xs font-semibold flex items-center justify-center">{enabled}</span>
              <span className="flex-1 font-medium text-[#10192b]">{module.label}</span>
              {!readOnly && !exception && (
                <Switch checked={enabled === ids.length && ids.length > 0} onClick={(event) => event.stopPropagation()} onCheckedChange={(value) => (onToggleMany ? onToggleMany(ids, value) : ids.forEach((id) => onToggle(id, value)))} className="data-[state=checked]:bg-emerald-500" />
              )}
            </summary>
            <div className="px-3 pb-3 space-y-1">
              {module.actions.map(([action, label]) => {
                const id = permissionId(module.key, action);
                const on = grants[id] === true;
                return (
                  <div key={id} className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm">
                    <span>{label}</span>
                    {readOnly ? <span className={on ? 'text-emerald-700' : 'text-slate-400'}>{on ? 'Autorisé' : 'Refusé'}</span> : (
                      <Switch checked={on} onCheckedChange={(value) => onToggle(id, value)} className="data-[state=checked]:bg-emerald-500" />
                    )}
                  </div>
                );
              })}
            </div>
          </details>
        );
      })}
    </div>
  );
}
