import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useCompany } from '@/lib/useCompany';
import { toast } from 'sonner';
import PtiTestBench from '@/components/pti/PtiTestBench';
import { dialNumber } from '@/lib/ptiAlarm';
import {
  ACTION_LABELS,
  CAPABILITY_CATALOG,
  PROFILE_KEYS,
  PROFILE_LABELS,
  PTI_DISCLAIMER,
  TIMING_FIELDS,
  defaultPtiConfig,
} from '@/lib/ptiRules';

const SECTIONS = [
  ['general', 'Paramètres généraux'],
  ['profiles', 'Profils de protection'],
  ['chute', 'Détection de chute'],
  ['immobilite', 'Détection d’immobilité'],
  ['verticalite', 'Perte de verticalité'],
  ['zone', 'Zones GPS'],
  ['sos', 'Bouton SOS'],
  ['delais', 'Délais'],
  ['doute', 'Levée de doute'],
  ['notifications', 'Notifications et escalades'],
  ['compatibilite', 'Android et iPhone'],
  ['telephone', 'État du téléphone'],
  ['historique', 'Historique'],
  ['essais', 'Essais sans envoi'],
];

const TYPE_LABELS = {
  sos: 'SOS',
  chute: 'Chute',
  immobilite: 'Immobilité',
  perte_verticalite: 'Perte de verticalité',
  sortie_zone: 'Sortie de zone',
  batterie_faible: 'Batterie faible',
  batterie_critique: 'Batterie critique',
};

function patchProfile(config, key, patch) {
  return {
    ...config,
    profiles: {
      ...config.profiles,
      [key]: { ...config.profiles[key], ...patch },
    },
  };
}

export default function PtiParametres() {
  const { user, companyId } = useCompany();
  const role = user?.role;
  const allowed = role === 'admin' || role === 'supervisor' || role === 'superadmin' || user?.superadmin;
  const qc = useQueryClient();
  const [section, setSection] = useState('general');
  const [config, setConfig] = useState(null);
  const [canEdit, setCanEdit] = useState(false);
  const [profileKey, setProfileKey] = useState('poste_fixe');
  const [saving, setSaving] = useState(false);
  const [assign, setAssign] = useState({ kind: 'agents', id: '', profile: 'poste_fixe' });
  const [overrideId, setOverrideId] = useState('');
  const [overrideRadius, setOverrideRadius] = useState('');
  const [alerts, setAlerts] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [doubt, setDoubt] = useState('');
  const [motif, setMotif] = useState('');

  useEffect(() => {
    if (!allowed || !companyId) return undefined;
    let stopped = false;
    base44.pti.getConfig().then((res) => {
      if (stopped) return;
      setConfig(res.config || defaultPtiConfig());
      setCanEdit(Boolean(res.can_edit));
    }).catch((err) => toast.error(err.message || 'Paramétrage PTI indisponible'));
    return () => { stopped = true; };
  }, [allowed, companyId]);

  const { data: agents = [] } = useQuery({
    queryKey: ['pti-agents', companyId],
    queryFn: () => base44.entities.Agent.filter({ company_id: companyId }),
    enabled: !!companyId && allowed,
  });
  const { data: sites = [] } = useQuery({
    queryKey: ['pti-sites', companyId],
    queryFn: () => base44.entities.Site.filter({ company_id: companyId }),
    enabled: !!companyId && allowed,
  });
  const { data: missions = [] } = useQuery({
    queryKey: ['pti-missions', companyId],
    queryFn: () => base44.entities.Mission.filter({ company_id: companyId }, '-date', 200),
    enabled: !!companyId && allowed,
  });

  useEffect(() => {
    if (section !== 'historique' || !allowed) return undefined;
    let stopped = false;
    base44.pti.applyDue()
      .catch(() => null)
      .finally(() => base44.pti.listAlerts().then((rows) => { if (!stopped) setAlerts(rows || []); }).catch((err) => toast.error(err.message)));
    return () => { stopped = true; };
  }, [section, allowed]);

  const profile = config?.profiles?.[profileKey];
  const selected = useMemo(() => alerts.find((item) => item.id === selectedId) || null, [alerts, selectedId]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await base44.pti.saveConfig(config);
      setConfig(res.config);
      toast.success('Paramétrage PTI enregistré');
    } catch (err) {
      toast.error(err.message || 'Enregistrement refusé');
    } finally {
      setSaving(false);
    }
  };

  const refreshAlerts = async () => {
    const rows = await base44.pti.listAlerts();
    setAlerts(rows || []);
    qc.invalidateQueries({ queryKey: ['alertes'] });
  };

  const act = async (action, extra = {}) => {
    if (!selected) return;
    try {
      await base44.pti.act(selected.id, { action, ...extra });
      if (action === 'contact') {
        const phone = agents.find((agent) => agent.id === selected.agent_id)?.phone;
        if (phone) dialNumber(phone);
        else toast.error('Pas de numéro sur la fiche agent');
      }
      await refreshAlerts();
      toast.success(ACTION_LABELS[action] || 'Action enregistrée');
    } catch (err) {
      toast.error(err.message || 'Action refusée');
    }
  };

  if (!allowed) {
    return <Card className="p-6">Le paramétrage PTI est réservé à l’administrateur et au superviseur.</Card>;
  }
  if (!config || !profile) {
    return <p className="text-sm text-muted-foreground">Chargement du paramétrage PTI…</p>;
  }

  const setField = (field, value) => setConfig(patchProfile(config, profileKey, { [field]: value }));
  const setDetection = (key, value) => setConfig(patchProfile(config, profileKey, {
    detections: { ...profile.detections, [key]: value },
  }));

  const addAssignment = () => {
    if (!assign.id) return;
    setConfig({
      ...config,
      assignments: {
        ...config.assignments,
        [assign.kind]: { ...config.assignments[assign.kind], [assign.id]: assign.profile },
      },
    });
  };

  const addOverride = () => {
    if (!overrideId || overrideRadius === '') return;
    setConfig({
      ...config,
      mission_overrides: {
        ...config.mission_overrides,
        [overrideId]: { ...(config.mission_overrides[overrideId] || {}), gps_radius_m: Number(overrideRadius) },
      },
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Protection PTI</h1>
        <p className="text-sm text-muted-foreground mt-1">Smartphone de l’agent, sans boîtier externe. {PTI_DISCLAIMER}</p>
      </div>
      {!canEdit && <Card className="p-3 text-sm">Lecture seule. Seul un administrateur enregistre les paramètres.</Card>}
      <div className="grid lg:grid-cols-[240px_1fr] gap-4">
        <div className="flex lg:flex-col gap-1 overflow-x-auto">
          {SECTIONS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSection(key)}
              className={`text-left text-sm px-3 py-2 rounded-md whitespace-nowrap ${section === key ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="space-y-4">
          {section !== 'general' && section !== 'compatibilite' && section !== 'telephone' && section !== 'historique' && section !== 'essais' && section !== 'notifications' && section !== 'doute' && (
            <ProfileSelect profileKey={profileKey} setProfileKey={setProfileKey} />
          )}

          {section === 'general' && (
            <Card className="p-4 space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={config.protection_imposed} disabled={!canEdit} onChange={(e) => setConfig({ ...config, protection_imposed: e.target.checked })} />
                Protection imposée : l’agent ne peut pas la couper ni modifier les seuils
              </label>
              <div>
                <Label>Profil par défaut</Label>
                <ProfileSelect profileKey={config.default_profile} setProfileKey={(key) => setConfig({ ...config, default_profile: key })} />
              </div>
              <p className="text-sm text-muted-foreground">Priorité : réglage de mission, puis profil de mission, puis profil de site, puis profil d’agent, puis profil par défaut. Un réglage de mission ne change pas le profil des autres agents.</p>
            </Card>
          )}

          {section === 'profiles' && (
            <Card className="p-4 space-y-4">
              {PROFILE_KEYS.map((key) => (
                <div key={key} className="flex items-center justify-between gap-3 text-sm">
                  <span>{PROFILE_LABELS[key]}</span>
                  <Badge variant="outline">{config.profiles[key].enabled ? 'actif' : 'inactif'}</Badge>
                </div>
              ))}
              <ProfileSelect profileKey={profileKey} setProfileKey={setProfileKey} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={profile.enabled} disabled={!canEdit} onChange={(e) => setField('enabled', e.target.checked)} />
                Profil actif
              </label>
              <div className="grid sm:grid-cols-3 gap-2">
                <div>
                  <Label>Attribuer à</Label>
                  <select className="w-full h-9 rounded-md border px-2 text-sm" value={assign.kind} onChange={(e) => setAssign({ ...assign, kind: e.target.value, id: '' })}>
                    <option value="agents">Agent</option>
                    <option value="sites">Site</option>
                    <option value="missions">Mission</option>
                  </select>
                </div>
                <div>
                  <Label>Cible</Label>
                  <select className="w-full h-9 rounded-md border px-2 text-sm" value={assign.id} onChange={(e) => setAssign({ ...assign, id: e.target.value })}>
                    <option value="">Choisir</option>
                    {(assign.kind === 'agents' ? agents : assign.kind === 'sites' ? sites : missions).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.first_name || item.name || item.title || item.site_name || item.id}
                        {item.last_name ? ` ${item.last_name}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Profil</Label>
                  <select className="w-full h-9 rounded-md border px-2 text-sm" value={assign.profile} onChange={(e) => setAssign({ ...assign, profile: e.target.value })}>
                    {PROFILE_KEYS.map((key) => <option key={key} value={key}>{PROFILE_LABELS[key]}</option>)}
                  </select>
                </div>
              </div>
              <Button type="button" variant="outline" disabled={!canEdit} onClick={addAssignment}>Ajouter l’attribution</Button>
              <AssignmentList config={config} agents={agents} sites={sites} missions={missions} canEdit={canEdit} onRemove={(kind, id) => {
                const next = { ...config.assignments[kind] };
                delete next[id];
                setConfig({ ...config, assignments: { ...config.assignments, [kind]: next } });
              }} />
              <div className="border-t pt-3 space-y-2">
                <p className="font-medium text-sm">Réglage propre à une mission</p>
                <p className="text-xs text-muted-foreground">Ce rayon remplace celui du profil pour cette mission seulement.</p>
                <div className="grid sm:grid-cols-2 gap-2">
                  <select className="h-9 rounded-md border px-2 text-sm" value={overrideId} onChange={(e) => setOverrideId(e.target.value)}>
                    <option value="">Mission</option>
                    {missions.map((mission) => <option key={mission.id} value={mission.id}>{mission.title || mission.site_name || mission.id}</option>)}
                  </select>
                  <Input type="number" placeholder="Rayon en mètres" value={overrideRadius} onChange={(e) => setOverrideRadius(e.target.value)} />
                </div>
                <Button type="button" variant="outline" disabled={!canEdit} onClick={addOverride}>Enregistrer le réglage de mission</Button>
                {Object.entries(config.mission_overrides).map(([id, value]) => (
                  <p key={id} className="text-sm">Mission {missions.find((mission) => mission.id === id)?.title || id} · rayon {value.gps_radius_m || 'hérité'} m</p>
                ))}
              </div>
            </Card>
          )}

          {section === 'chute' && (
            <DetectionCard
              title="Chute"
              checked={profile.detections.chute}
              disabled={!canEdit}
              onToggle={(value) => setDetection('chute', value)}
              text="La chute n’est envoyée qu’après un choc et un maintien hors verticalité, puis le délai d’annulation. Un pic isolé ne suffit pas. Non testé sur un appareil réel dans cette version."
            >
              <TimingFields fields={['chute_confirmation_sec', 'chute_annulation_sec']} profile={profile} disabled={!canEdit} onChange={setField} />
            </DetectionCard>
          )}
          {section === 'immobilite' && (
            <DetectionCard
              title="Immobilité"
              checked={profile.detections.immobilite}
              disabled={!canEdit}
              onToggle={(value) => setDetection('immobilite', value)}
              text="Il faut une série de mesures de mouvement, puis la préalerte et la confirmation. Sans capteur, la fonction reste indisponible et ne sonne pas."
            >
              <TimingFields fields={['immobilite_prealerte_sec', 'immobilite_confirmation_sec']} profile={profile} disabled={!canEdit} onChange={setField} />
            </DetectionCard>
          )}
          {section === 'verticalite' && (
            <DetectionCard
              title="Perte de verticalité"
              checked={profile.detections.perte_verticalite}
              disabled={!canEdit}
              onToggle={(value) => setDetection('perte_verticalite', value)}
              text="Déduite de l’accéléromètre du téléphone s’il envoie des mesures. Il n’y a pas de capteur de verticalité séparé. Si aucune mesure n’arrive, la fonction est indisponible."
            >
              <TimingFields fields={['chute_confirmation_sec', 'chute_annulation_sec']} profile={profile} disabled={!canEdit} onChange={setField} />
            </DetectionCard>
          )}
          {section === 'zone' && (
            <DetectionCard
              title="Zone GPS"
              checked={profile.detections.zone_gps}
              disabled={!canEdit}
              onToggle={(value) => setDetection('zone_gps', value)}
              text="La sortie de zone attend la préalerte avant d’alerter le centre. Le suivi arrière-plan n’est pas garanti dans l’application web."
            >
              <TimingFields fields={['gps_radius_m', 'zone_prealerte_sec']} profile={profile} disabled={!canEdit} onChange={setField} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={profile.gps_use_site_radius} disabled={!canEdit} onChange={(e) => setField('gps_use_site_radius', e.target.checked)} />
                Utiliser le rayon déjà saisi sur le site, s’il existe
              </label>
            </DetectionCard>
          )}
          {section === 'sos' && (
            <DetectionCard title="SOS" checked={profile.detections.sos} disabled={!canEdit} onToggle={(value) => setDetection('sos', value)} text="L’agent maintient le bouton le temps réglé. Le SOS part seulement après cet appui, depuis la page ouverte.">
              <TimingFields fields={['sos_hold_sec']} profile={profile} disabled={!canEdit} onChange={setField} />
            </DetectionCard>
          )}
          {section === 'delais' && (
            <Card className="p-4 space-y-3">
              <TimingFields fields={TIMING_FIELDS.map(([field]) => field)} profile={profile} disabled={!canEdit} onChange={setField} />
            </Card>
          )}
          {section === 'doute' && (
            <Card className="p-4 space-y-2 text-sm">
              <p>Le superviseur acquitte l’alerte, joint l’agent, note la levée de doute, peut escalader, puis clôture avec un motif.</p>
              <p>Chaque action garde la date, l’heure et l’auteur. Les délais de relance et d’escalade se règlent dans le profil.</p>
              <TimingFields fields={['relance_superviseur_sec', 'escalade_apres_relance_sec']} profile={profile} disabled={!canEdit} onChange={setField} />
            </Card>
          )}
          {section === 'notifications' && (
            <Card className="p-4 space-y-3 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={config.notifications.centre} disabled={!canEdit} onChange={(e) => setConfig({ ...config, notifications: { ...config.notifications, centre: e.target.checked } })} />
                Afficher l’alerte au centre de supervision
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={config.notifications.sms} disabled={!canEdit} onChange={(e) => setConfig({ ...config, notifications: { ...config.notifications, sms: e.target.checked } })} />
                SMS souhaité — envoi non disponible dans cette version
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={config.notifications.push} disabled={!canEdit} onChange={(e) => setConfig({ ...config, notifications: { ...config.notifications, push: e.target.checked } })} />
                Notification push souhaitée — envoi non disponible dans cette version
              </label>
              <TimingFields fields={['relance_superviseur_sec', 'escalade_apres_relance_sec', 'batterie_faible_pct', 'batterie_critique_pct']} profile={profile} disabled={!canEdit} onChange={setField} />
            </Card>
          )}
          {section === 'compatibilite' && (
            <Card className="p-4 space-y-3 text-sm">
              <p>Application web actuelle. Aucune ligne ci-dessous n’a été validée sur un téléphone physique pendant ce développement.</p>
              {CAPABILITY_CATALOG.map((item) => (
                <div key={item.key} className="border-b pb-2">
                  <p className="font-medium">{item.label}</p>
                  <p className="text-muted-foreground">{item.note}</p>
                  <p>Android : {item.android} · iPhone : {item.ios}{item.native_required ? ' · application native encore nécessaire pour une surveillance fiable' : ''}</p>
                </div>
              ))}
            </Card>
          )}
          {section === 'telephone' && <PtiTestBench />}
          {section === 'essais' && <PtiTestBench />}
          {section === 'historique' && (
            <Card className="p-4 space-y-3">
              {alerts.length === 0 && <p className="text-sm text-muted-foreground">Aucune alerte PTI reçue par le serveur. Les essais du navigateur ne sont pas enregistrés ici.</p>}
              {alerts.map((alert) => (
                <button key={alert.id} type="button" onClick={() => setSelectedId(alert.id)} className={`block w-full text-left border rounded-md p-3 text-sm ${selectedId === alert.id ? 'border-primary' : ''}`}>
                  <span className="font-medium">{TYPE_LABELS[alert.pti_type] || alert.type}</span>
                  <span className="text-muted-foreground"> · {alert.agent_name || alert.agent_id} · {alert.date} {alert.time}</span>
                  <span className="block">{alert.transmission_status === 'received' ? 'Reçue par le serveur' : 'Pas d’accusé serveur'} · {alert.ack_status}</span>
                </button>
              ))}
              {selected && (
                <div className="space-y-2 text-sm border-t pt-3">
                  <p>Identifiant {selected.id}</p>
                  <p>Agent {selected.agent_name} · mission {selected.mission_id || '—'} · site {selected.site_name || selected.site_id || '—'}</p>
                  <p>Position {selected.latitude ?? '—'}, {selected.longitude ?? '—'} · précision {selected.accuracy_m ?? '—'} m</p>
                  <p>Batterie {selected.battery_level ?? 'inconnue'} % · connexion {selected.connection_state}</p>
                  <p>Transmission {selected.transmission_status} · reçu {selected.received_at}</p>
                  {selected.latitude != null && (
                    <a className="text-primary underline" href={`https://maps.google.com/?q=${selected.latitude},${selected.longitude}`} target="_blank" rel="noreferrer">Dernière position</a>
                  )}
                  <div className="space-y-1">
                    {(selected.history || []).map((item, index) => (
                      <p key={`${item.at}-${index}`}>{item.at} · {ACTION_LABELS[item.action] || item.action} · {item.by_name} · {item.detail}</p>
                    ))}
                  </div>
                  {selected.ack_status !== 'closed' && (
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" onClick={() => act('acknowledge')}>Acquitter</Button>
                        <Button type="button" variant="outline" onClick={() => act('contact', { detail: 'Contact depuis le centre' })}>Contacter</Button>
                        <Button type="button" variant="outline" onClick={() => act('escalate')}>Escalader</Button>
                      </div>
                      <Textarea placeholder="Résultat de la levée de doute" value={doubt} onChange={(e) => setDoubt(e.target.value)} />
                      <Button type="button" variant="outline" onClick={() => act('doubt', { result: doubt })}>Enregistrer la levée de doute</Button>
                      <Textarea placeholder="Motif de clôture" value={motif} onChange={(e) => setMotif(e.target.value)} />
                      <Button type="button" onClick={() => act('close', { motif })}>Clôturer</Button>
                    </div>
                  )}
                </div>
              )}
            </Card>
          )}

          {canEdit && section !== 'historique' && section !== 'essais' && section !== 'telephone' && section !== 'compatibilite' && (
            <Button type="button" onClick={save} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer le paramétrage'}</Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ProfileSelect({ profileKey, setProfileKey }) {
  return (
    <select className="h-9 rounded-md border px-2 text-sm" value={profileKey} onChange={(e) => setProfileKey(e.target.value)}>
      {PROFILE_KEYS.map((key) => <option key={key} value={key}>{PROFILE_LABELS[key]}</option>)}
    </select>
  );
}

function TimingFields({ fields, profile, disabled, onChange }) {
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {fields.map((field) => {
        const meta = TIMING_FIELDS.find(([name]) => name === field);
        if (!meta) return null;
        const [, label] = meta;
        return (
          <div key={field}>
            <Label>{label}</Label>
            <Input type="number" disabled={disabled} value={profile[field]} onChange={(e) => onChange(field, e.target.value === '' ? '' : Number(e.target.value))} />
          </div>
        );
      })}
    </div>
  );
}

function DetectionCard({ title, checked, disabled, onToggle, text, children }) {
  return (
    <Card className="p-4 space-y-3">
      <label className="flex items-center gap-2 font-medium">
        <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onToggle(e.target.checked)} />
        {title}
      </label>
      <p className="text-sm text-muted-foreground">{text}</p>
      {children}
    </Card>
  );
}

function AssignmentList({ config, agents, sites, missions, canEdit, onRemove }) {
  const names = {
    agents: Object.fromEntries(agents.map((item) => [item.id, `${item.first_name || ''} ${item.last_name || ''}`.trim() || item.id])),
    sites: Object.fromEntries(sites.map((item) => [item.id, item.name || item.id])),
    missions: Object.fromEntries(missions.map((item) => [item.id, item.title || item.site_name || item.id])),
  };
  const rows = ['agents', 'sites', 'missions'].flatMap((kind) => Object.entries(config.assignments[kind] || {}).map(([id, profile]) => ({ kind, id, profile })));
  if (!rows.length) return <p className="text-sm text-muted-foreground">Aucune attribution. Le profil par défaut s’applique.</p>;
  return (
    <div className="space-y-1 text-sm">
      {rows.map((row) => (
        <div key={`${row.kind}-${row.id}`} className="flex items-center justify-between gap-2">
          <span>{row.kind} · {names[row.kind][row.id] || row.id} · {PROFILE_LABELS[row.profile]}</span>
          {canEdit && <button type="button" className="text-red-600" onClick={() => onRemove(row.kind, row.id)}>Retirer</button>}
        </div>
      ))}
    </div>
  );
}
