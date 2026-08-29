import {
  ShieldCheck, Route, Coffee, Footprints, MapPin, Users, AlertTriangle,
  Search, Package, HeartPulse, UserCheck, FileText
} from 'lucide-react';

// Couleurs Tailwind (littérales pour ne pas être purgées)
export const EVENT_CATEGORIES = [
  { key: 'service', label: 'Services', icon: ShieldCheck, color: 'bg-emerald-100 text-emerald-700 border-emerald-300', dot: 'bg-emerald-500', soft: 'bg-emerald-50' },
  { key: 'tournee', label: 'Tournées', icon: Route, color: 'bg-blue-100 text-blue-700 border-blue-300', dot: 'bg-blue-500', soft: 'bg-blue-50' },
  { key: 'pause', label: 'Pauses', icon: Coffee, color: 'bg-amber-100 text-amber-700 border-amber-300', dot: 'bg-amber-500', soft: 'bg-amber-50' },
  { key: 'ronde', label: 'Rondes', icon: Footprints, color: 'bg-violet-100 text-violet-700 border-violet-300', dot: 'bg-violet-500', soft: 'bg-violet-50' },
  { key: 'point_controle', label: 'Points de contrôle', icon: MapPin, color: 'bg-teal-100 text-teal-700 border-teal-300', dot: 'bg-teal-500', soft: 'bg-teal-50' },
  { key: 'collaborateur', label: 'Collaborateurs', icon: Users, color: 'bg-slate-100 text-slate-700 border-slate-300', dot: 'bg-slate-500', soft: 'bg-slate-50' },
  { key: 'incident', label: 'Incidents', icon: AlertTriangle, color: 'bg-red-100 text-red-700 border-red-300', dot: 'bg-red-500', soft: 'bg-red-50' },
  { key: 'controle', label: 'Contrôles', icon: Search, color: 'bg-indigo-100 text-indigo-700 border-indigo-300', dot: 'bg-indigo-500', soft: 'bg-indigo-50' },
  { key: 'logistique', label: 'Logistiques', icon: Package, color: 'bg-cyan-100 text-cyan-700 border-cyan-300', dot: 'bg-cyan-500', soft: 'bg-cyan-50' },
  { key: 'soin_secours', label: 'Soins et secours', icon: HeartPulse, color: 'bg-rose-100 text-rose-700 border-rose-300', dot: 'bg-rose-500', soft: 'bg-rose-50' },
  { key: 'presence', label: 'Présences', icon: UserCheck, color: 'bg-lime-100 text-lime-700 border-lime-300', dot: 'bg-lime-500', soft: 'bg-lime-50' },
  { key: 'autre', label: 'Autres', icon: FileText, color: 'bg-gray-100 text-gray-700 border-gray-300', dot: 'bg-gray-500', soft: 'bg-gray-50' },
];

export const EVENT_TYPES = {
  service: [
    { key: 'debut_service', label: 'Début de service', auto: true, severity: 'normal' },
    { key: 'debut_service_retard', label: 'Début de service en retard', auto: true, severity: 'attention' },
    { key: 'service_non_debute', label: 'Service non débuté', auto: true, severity: 'urgent' },
    { key: 'reprise_service', label: 'Reprise de service', auto: false, severity: 'normal' },
    { key: 'interruption_service', label: 'Interruption de service', auto: false, severity: 'attention' },
    { key: 'fin_service_anticipee', label: 'Fin de service anticipée', auto: true, severity: 'attention' },
    { key: 'fin_service', label: 'Fin de service', auto: true, severity: 'normal' },
    { key: 'prolongation_service', label: 'Prolongation de service', auto: true, severity: 'normal' },
    { key: 'fin_prolongation_service', label: 'Fin de prolongation de service', auto: false, severity: 'normal' },
  ],
  tournee: [
    { key: 'debut_tournee', label: 'Début de tournée', auto: true, severity: 'normal' },
    { key: 'retard_debut_tournee', label: 'Retard de début de tournée', auto: true, severity: 'attention' },
    { key: 'tournee_non_debutee', label: 'Tournée non débutée', auto: true, severity: 'urgent' },
    { key: 'reprise_tournee', label: 'Reprise de tournée', auto: false, severity: 'normal' },
    { key: 'interruption_tournee', label: 'Interruption de tournée', auto: false, severity: 'attention' },
    { key: 'fin_tournee_anticipee', label: 'Fin de tournée anticipée', auto: true, severity: 'attention' },
    { key: 'fin_tournee', label: 'Fin de tournée', auto: true, severity: 'normal' },
    { key: 'prolongation_tournee', label: 'Prolongation de tournée', auto: false, severity: 'normal' },
    { key: 'fin_prolongation_tournee', label: 'Fin de prolongation de tournée', auto: false, severity: 'normal' },
  ],
  pause: [
    { key: 'debut_pause', label: 'Début de pause', auto: true, severity: 'normal' },
    { key: 'reprise_pause', label: 'Reprise de pause', auto: true, severity: 'normal' },
    { key: 'interruption_pause', label: 'Interruption de pause', auto: false, severity: 'attention' },
    { key: 'fin_pause', label: 'Fin de pause', auto: true, severity: 'normal' },
  ],
  ronde: [
    { key: 'debut_ronde', label: 'Début de ronde', auto: true, severity: 'normal' },
    { key: 'reprise_ronde', label: 'Reprise de ronde', auto: false, severity: 'normal' },
    { key: 'interruption_ronde', label: 'Interruption de ronde', auto: false, severity: 'attention' },
    { key: 'fin_ronde', label: 'Fin de ronde', auto: true, severity: 'normal' },
    { key: 'ronde_non_realisee', label: 'Ronde non réalisée', auto: true, severity: 'urgent' },
  ],
  point_controle: [
    { key: 'validation_point_controle', label: 'Validation point de contrôle', auto: true, severity: 'normal' },
    { key: 'point_controle_geolocalise', label: 'Point de contrôle géolocalisé', auto: true, severity: 'normal' },
    { key: 'point_controle_saute', label: 'Point de contrôle sauté', auto: true, severity: 'attention' },
    { key: 'point_controle_deplace', label: 'Point de contrôle déplacé', auto: false, severity: 'attention' },
  ],
  collaborateur: [
    { key: 'appel_urgence', label: "Appel d'urgence", auto: false, severity: 'urgent' },
    { key: 'alerte_collaborateur_renfort', label: 'Alerte collaborateur renfort', auto: false, severity: 'attention' },
    { key: 'collaborateur_inactif', label: 'Collaborateur inactif', auto: true, severity: 'attention' },
    { key: 'chute_collaborateur', label: 'Chute du collaborateur', auto: true, severity: 'urgent' },
    { key: 'sortie_perimetre', label: 'Sortie de périmètre', auto: true, severity: 'attention' },
    { key: 'retour_perimetre', label: 'Retour dans le périmètre', auto: true, severity: 'normal' },
  ],
  incident: [
    { key: 'entree_libre', label: 'Entrée libre', auto: false, severity: 'attention' },
    { key: 'alarme_declenchee', label: 'Alarme déclenchée', auto: false, severity: 'urgent' },
    { key: 'jet_pierres', label: 'Jet de pierres', auto: false, severity: 'attention' },
    { key: 'intrusion', label: 'Intrusion', auto: false, severity: 'urgent' },
    { key: 'effraction', label: 'Effraction', auto: false, severity: 'urgent' },
    { key: 'probleme_informatique', label: 'Problème informatique', auto: false, severity: 'normal' },
    { key: 'attaque_collaborateur', label: 'Attaque sur collaborateur', auto: false, severity: 'urgent' },
    { key: 'agression_physique', label: 'Agression physique', auto: false, severity: 'urgent' },
    { key: 'vol', label: 'Vol', auto: false, severity: 'urgent' },
    { key: 'fraude', label: 'Fraude', auto: false, severity: 'attention' },
    { key: 'agression_verbale', label: 'Agression verbale', auto: false, severity: 'attention' },
    { key: 'incivite', label: 'Incivilité', auto: false, severity: 'normal' },
    { key: 'incendie', label: 'Incendie', auto: false, severity: 'urgent' },
    { key: 'materiel', label: 'Matériel', auto: false, severity: 'normal' },
    { key: 'degats_eaux', label: 'Dégâts des eaux', auto: false, severity: 'attention' },
    { key: 'accident', label: 'Accident', auto: false, severity: 'urgent' },
    { key: 'probleme_electrique', label: 'Problème électrique', auto: false, severity: 'attention' },
    { key: 'malaise_cardiaque', label: 'Malaise cardiaque', auto: false, severity: 'urgent' },
    { key: 'perte_connaissance', label: 'Perte de connaissance', auto: false, severity: 'urgent' },
    { key: 'brulure', label: 'Brûlure', auto: false, severity: 'attention' },
    { key: 'saignement', label: 'Saignement', auto: false, severity: 'urgent' },
    { key: 'chute', label: 'Chute', auto: false, severity: 'attention' },
    { key: 'etouffement', label: 'Etouffement', auto: false, severity: 'urgent' },
    { key: 'autre_incident', label: 'Autre incident', auto: false, severity: 'normal' },
  ],
  controle: [
    { key: 'controle_porte', label: 'Contrôle porte', auto: false, severity: 'normal' },
    { key: 'controle_portail', label: 'Contrôle portail', auto: false, severity: 'normal' },
    { key: 'controle_cloture', label: 'Contrôle clôture', auto: false, severity: 'normal' },
    { key: 'controle_fenetre', label: 'Contrôle fenêtre', auto: false, severity: 'normal' },
    { key: 'controle_temperature', label: 'Contrôle température', auto: false, severity: 'normal' },
    { key: 'controle_materiel', label: 'Contrôle matériel', auto: false, severity: 'normal' },
    { key: 'controle_electrique', label: 'Contrôle électrique', auto: false, severity: 'normal' },
    { key: 'controle_extincteur', label: 'Contrôle extincteur', auto: false, severity: 'normal' },
    { key: 'controle_machine', label: 'Contrôle machine', auto: false, severity: 'normal' },
    { key: 'controle_vitrine', label: 'Contrôle vitrine', auto: false, severity: 'normal' },
    { key: 'controle_vehicule', label: 'Contrôle véhicule', auto: false, severity: 'normal' },
    { key: 'controle_caisse', label: 'Contrôle caisse enregistreuse', auto: false, severity: 'normal' },
    { key: 'controle_personnes', label: 'Contrôle de personnes', auto: false, severity: 'normal' },
    { key: 'controle_piece', label: 'Contrôle pièce', auto: false, severity: 'normal' },
    { key: 'controle_sol', label: 'Contrôle sol', auto: false, severity: 'normal' },
    { key: 'controle_batiment', label: 'Contrôle bâtiment', auto: false, severity: 'normal' },
    { key: 'controle_exterieur', label: 'Contrôle extérieur', auto: false, severity: 'normal' },
    { key: 'controle_entree', label: 'Contrôle entrée', auto: false, severity: 'normal' },
    { key: 'controle_sortie', label: 'Contrôle sortie', auto: false, severity: 'normal' },
    { key: 'controle_stock', label: 'Contrôle stock', auto: false, severity: 'normal' },
    { key: 'autre_controle', label: 'Autre contrôle', auto: false, severity: 'normal' },
  ],
  logistique: [
    { key: 'entree_marchandise', label: 'Entrée de marchandise', auto: false, severity: 'normal' },
    { key: 'sortie_marchandise', label: 'Sortie de marchandise', auto: false, severity: 'normal' },
    { key: 'cle_logistique', label: 'Clé', auto: false, severity: 'normal' },
    { key: 'badge_logistique', label: 'Badge', auto: false, severity: 'normal' },
    { key: 'perte_logistique', label: 'Perte', auto: false, severity: 'attention' },
    { key: 'vol_logistique', label: 'Vol', auto: false, severity: 'urgent' },
    { key: 'vehicule_logistique', label: 'Véhicule', auto: false, severity: 'normal' },
    { key: 'vetements_logistique', label: 'Vêtements', auto: false, severity: 'normal' },
    { key: 'outils_logistique', label: 'Outils', auto: false, severity: 'normal' },
    { key: 'autre_logistique', label: 'Autre', auto: false, severity: 'normal' },
  ],
  soin_secours: [
    { key: 'police', label: 'Police', auto: false, severity: 'urgent' },
    { key: 'pompier', label: 'Pompier', auto: false, severity: 'urgent' },
    { key: 'gendarme', label: 'Gendarme', auto: false, severity: 'urgent' },
    { key: 'samu', label: 'SAMU', auto: false, severity: 'urgent' },
    { key: 'sos_medecins', label: 'SOS Medecins', auto: false, severity: 'attention' },
    { key: 'renforts', label: 'Renforts', auto: false, severity: 'attention' },
    { key: 'premiers_soins', label: 'Premiers soins', auto: false, severity: 'attention' },
    { key: 'autre_soin_secours', label: 'Autre soins et secours', auto: false, severity: 'normal' },
  ],
  presence: [
    { key: 'presence_sortie', label: 'Présence sortie', auto: false, severity: 'normal' },
    { key: 'presence_entree', label: 'Présence entrée', auto: false, severity: 'normal' },
    { key: 'presence_site', label: 'Présence site', auto: false, severity: 'normal' },
    { key: 'autre_presence', label: 'Autre présence', auto: false, severity: 'normal' },
  ],
  autre: [
    { key: 'arrivee', label: 'Arrivée', auto: false, severity: 'normal' },
    { key: 'depart', label: 'Départ', auto: false, severity: 'normal' },
    { key: 'observation', label: 'Observation', auto: false, severity: 'normal' },
    { key: 'pti_alerte', label: 'PTI Alerte', auto: false, severity: 'urgent' },
    { key: 'pti_ok', label: 'PTI OK', auto: false, severity: 'normal' },
    { key: 'autre', label: 'Autre', auto: false, severity: 'normal' },
  ],
};

// Mapping catégorie -> type legacy (pour compatibilité export PDF et anciennes vues)
export const CATEGORY_LEGACY_TYPE = {
  service: 'arrivee', tournee: 'arrivee', pause: 'observation', ronde: 'ronde',
  point_controle: 'observation', collaborateur: 'pti_alerte', incident: 'incident',
  controle: 'observation', logistique: 'observation', soin_secours: 'incident',
  presence: 'observation', autre: 'autre',
};

const LEGACY_LABELS = {
  arrivee: 'Arrivée', depart: 'Départ', incident: 'Incident', ronde: 'Ronde',
  observation: 'Observation', pti_alerte: 'PTI Alerte', pti_ok: 'PTI OK', autre: 'Autre',
};

const LEGACY_CATEGORY = {
  arrivee: 'service', depart: 'service', ronde: 'ronde', incident: 'incident',
  observation: 'autre', pti_alerte: 'collaborateur', pti_ok: 'collaborateur', autre: 'autre',
};

const CATEGORY_MAP = Object.fromEntries(EVENT_CATEGORIES.map(c => [c.key, c]));

export const getCategory = (key) => CATEGORY_MAP[key] || CATEGORY_MAP.autre;

export const getEventMeta = (category, eventTypeKey) => {
  const cat = getCategory(category);
  const list = EVENT_TYPES[category] || [];
  const ev = list.find(e => e.key === eventTypeKey) || list.find(e => e.key === 'autre') || { label: eventTypeKey, severity: 'normal' };
  return { category: cat, event: ev, label: ev.label || eventTypeKey, severity: ev.severity || 'normal', auto: !!ev.auto };
};

export const eventTypeCode = (category, key) => `${category}:${key}`;

// Normalise une entrée persistée (legacy ou nouveau format) vers une structure unifiée
export const normalizeEntry = (record) => {
  let category = record.category;
  let eventTypeKey = record.event_type;
  if (!category || !eventTypeKey) {
    // legacy
    category = LEGACY_CATEGORY[record.type] || 'autre';
    eventTypeKey = record.type || 'autre';
  }
  const meta = getEventMeta(category, eventTypeKey);
  return {
    ...record,
    category,
    event_type: eventTypeKey,
    event_label: meta.label,
    auto: !!record.auto,
    severity: record.severity || meta.severity,
    code: eventTypeCode(category, eventTypeKey),
  };
};

// --- Synthèse automatique depuis les prises de service et rondes réalisées ---
const RETARD_MIN = 10;
const ANTICIPATION_MIN = 10;
const PROLONGATION_MIN = 10;

const toMin = (hhmm) => {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
};

const nowMin = () => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};

const todayStr = () => new Date().toISOString().split('T')[0];

const fmtDur = (mins) => {
  if (mins == null || isNaN(mins)) return '';
  const s = Math.abs(mins);
  const h = Math.floor(s / 60);
  const m = s % 60;
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`;
};

export const synthesizeAutoEvents = ({ prises = [], rondeExecs = [] }) => {
  const events = [];

  // Depuis les prises de service
  prises.forEach((p) => {
    if (!p) return;
    const base = {
      auto: true,
      site_id: p.site_id, site_name: p.site_name, client_name: p.client_name,
      agent_id: p.agent_id, agent_name: p.agent_name, mission_id: p.mission_id,
      date: p.date, source_ref: p.id,
      latitude: p.start_latitude, longitude: p.start_longitude,
    };

    const ps = toMin(p.planned_start);
    const pe = toMin(p.planned_end);
    const as = toMin(p.actual_start);
    const ae = toMin(p.actual_end);
    const isToday = p.date === todayStr();
    const past = p.date < todayStr() || (isToday && ps != null && nowMin() >= ps);

    // Début de service
    if (as != null) {
      let key = 'debut_service';
      let content = `Pointage de début de service : ${p.nfc_validated ? 'Badge NFC' : 'Pointage manuel'} — ${p.site_name || ''}`;
      if (ps != null && as - ps > RETARD_MIN) {
        key = 'debut_service_retard';
        content = `Début de service en retard de ${fmtDur(as - ps)} (prévu ${p.planned_start}, pointé ${p.actual_start})`;
      }
      events.push({ ...base, category: 'service', event_type: key, event_label: getEventMeta('service', key).label, time: p.actual_start, content, code: eventTypeCode('service', key), severity: getEventMeta('service', key).severity, id: `auto-ps-start-${p.id}` });
    } else if (past && ps != null) {
      events.push({ ...base, category: 'service', event_type: 'service_non_debute', event_label: 'Service non débuté', time: p.planned_start, content: `Service non débuté (heure prévue ${p.planned_start})`, code: eventTypeCode('service', 'service_non_debute'), severity: 'urgent', id: `auto-ps-nostart-${p.id}` });
    }

    // Fin de service
    if (ae != null) {
      let key = 'fin_service';
      let content = `Pointage de fin de service : ${p.nfc_validated ? 'Badge NFC' : 'Pointage manuel'} — ${p.site_name || ''}`;
      if (pe != null && pe - ae > ANTICIPATION_MIN) {
        key = 'fin_service_anticipee';
        content = `Fin de service anticipée de ${fmtDur(pe - ae)} (prévue ${p.planned_end}, pointée ${p.actual_end})`;
      } else if (pe != null && ae - pe > PROLONGATION_MIN) {
        key = 'prolongation_service';
        content = `Prolongation de service de ${fmtDur(ae - pe)} (prévue ${p.planned_end}, pointée ${p.actual_end})`;
      }
      events.push({ ...base, category: 'service', event_type: key, event_label: getEventMeta('service', key).label, time: p.actual_end, content, code: eventTypeCode('service', key), severity: getEventMeta('service', key).severity, id: `auto-ps-end-${p.id}`, latitude: p.end_latitude, longitude: p.end_longitude });
    }

    (p.pauses || []).forEach((pause, i) => {
      events.push({
        ...base,
        category: 'pause',
        event_type: 'debut_pause',
        event_label: 'Début de pause',
        time: pause.start,
        content: `Début de pause à ${pause.start}`,
        code: eventTypeCode('pause', 'debut_pause'),
        severity: 'normal',
        id: `auto-pause-start-${p.id}-${i}`,
      });
      if (pause.end) {
        events.push({
          ...base,
          category: 'pause',
          event_type: 'fin_pause',
          event_label: 'Fin de pause',
          time: pause.end,
          content: `Fin de pause à ${pause.end} — ${pause.minutes || 0} min`,
          code: eventTypeCode('pause', 'fin_pause'),
          severity: 'normal',
          id: `auto-pause-end-${p.id}-${i}`,
        });
      }
    });
    if (p.pause_started_time && !p.actual_end) {
      events.push({
        ...base,
        category: 'pause',
        event_type: 'debut_pause',
        event_label: 'Début de pause',
        time: p.pause_started_time,
        content: `Pause en cours depuis ${p.pause_started_time}`,
        code: eventTypeCode('pause', 'debut_pause'),
        severity: 'normal',
        id: `auto-pause-open-${p.id}`,
      });
    }
  });

  // Depuis les rondes réalisées
  rondeExecs.forEach((r) => {
    if (!r) return;
    const base = {
      auto: true,
      site_id: r.site_id, site_name: r.site_name,
      agent_id: r.agent_id, agent_name: r.agent_name, mission_id: r.mission_id,
      date: r.date, source_ref: r.id,
    };

    if (r.start_time) {
      events.push({ ...base, category: 'ronde', event_type: 'debut_ronde', event_label: 'Début de ronde', time: r.start_time, content: `Début de ronde : ${r.ronde_name || ''}`, code: eventTypeCode('ronde', 'debut_ronde'), severity: 'normal', id: `auto-rd-start-${r.id}` });
    }
    if (r.end_time && r.status === 'terminee') {
      events.push({ ...base, category: 'ronde', event_type: 'fin_ronde', event_label: 'Fin de ronde', time: r.end_time, content: `Fin de ronde : ${r.ronde_name || ''}`, code: eventTypeCode('ronde', 'fin_ronde'), severity: 'normal', id: `auto-rd-end-${r.id}` });
    }
    if (r.status === 'incomplete') {
      events.push({ ...base, category: 'ronde', event_type: 'ronde_non_realisee', event_label: 'Ronde non réalisée', time: r.end_time || r.start_time, content: `Ronde non réalisée : ${r.ronde_name || ''}`, code: eventTypeCode('ronde', 'ronde_non_realisee'), severity: 'urgent', id: `auto-rd-no-${r.id}` });
    }

    // Points de contrôle validés
    (r.checkpoints_done || []).forEach((cp, i) => {
      const key = cp.nfc_validated ? 'validation_point_controle' : (cp.latitude ? 'point_controle_geolocalise' : 'validation_point_controle');
      const meta = getEventMeta('point_controle', key);
      let content = `Point de contrôle validé : ${cp.checkpoint_name || ''}`;
      if (cp.anomaly) content += ' — Anomalie signalée';
      if (cp.note) content += ` — ${cp.note}`;
      events.push({
        ...base, category: 'point_controle', event_type: key, event_label: meta.label,
        time: cp.time || r.start_time, content, code: eventTypeCode('point_controle', key),
        severity: cp.anomaly ? 'attention' : 'normal', id: `auto-cp-${r.id}-${i}`,
        latitude: cp.latitude, longitude: cp.longitude,
      });
    });
  });

  return events;
};

export const ALL_CODES = () => {
  const codes = [];
  Object.entries(EVENT_TYPES).forEach(([cat, list]) => list.forEach(e => codes.push(eventTypeCode(cat, e.key))));
  return codes;
};

export { LEGACY_LABELS };