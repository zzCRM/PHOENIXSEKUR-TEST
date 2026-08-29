/** Modules du portail agent autorisés par défaut (Compte Sekur). */
export const DEFAULT_DROITS_AGENT = {
  acces_espace_agent: true,
  acces_planning: true,
  acces_services: true,
  acces_service_non_planifie: true,
  acces_conges: true,
  acces_rondes: true,
  acces_points_controle: true,
  acces_consignes: true,
  acces_carte_pro: true,
  acces_contact_societe: true,
  acces_ecarts: false,
  acces_main_courante: false,
  acces_pti: true,
  acces_documents: false,
  acces_fiches_paie: false,
};

export const DROITS_AGENT_OPTIONS = [
  { key: 'acces_planning', label: 'Planning', description: 'Voir son planning et ses vacations actuelles et à venir' },
  { key: 'acces_services', label: 'Service / Pointage', description: 'Pointer les débuts et fins de service' },
  { key: 'acces_service_non_planifie', label: 'Service non planifié', description: 'Commencer un service hors planning' },
  { key: 'acces_conges', label: 'Demandes à la société', description: 'Soumettre des demandes RH, congés et messages' },
  { key: 'acces_rondes', label: 'Rondes', description: 'Rondes des sites sur lesquels il est affecté' },
  { key: 'acces_points_controle', label: 'Points de contrôle', description: 'Points de contrôle des sites affectés' },
  { key: 'acces_consignes', label: 'Cahier de consignes', description: 'Lire les consignes des sites affectés' },
  { key: 'acces_carte_pro', label: 'Carte professionnelle', description: 'Carte pro avec logo et infos de la société' },
  { key: 'acces_contact_societe', label: 'Contacter l’agence', description: 'Coordonnées de la société de sécurité' },
  { key: 'acces_ecarts', label: 'Écarts horaires', description: 'Consulter ses écarts horaires' },
  { key: 'acces_main_courante', label: 'Main courante', description: 'Consulter et saisir la main courante du site' },
  { key: 'acces_pti', label: 'DATI / PTI', description: 'Dispositif d’alarme pour travailleur isolé' },
  { key: 'acces_documents', label: 'Documents', description: 'Documents personnels et fiches de paie' },
];

export function mergeAgentDroits(agent) {
  const flat = {};
  if (agent) {
    for (const key of Object.keys(DEFAULT_DROITS_AGENT)) {
      if (agent[key] !== undefined) flat[key] = agent[key];
    }
  }
  return {
    ...DEFAULT_DROITS_AGENT,
    ...flat,
    ...(agent?.droits_portail || {}),
  };
}

function isPlaceholderName(part) {
  const s = String(part || '').trim();
  if (!s) return true;
  return /^(so|test|user|admin|n\/?a|xxx|\.+)$/i.test(s);
}

function formatNomPrenom(last, first) {
  const l = String(last || '').trim();
  const f = String(first || '').trim();
  if (!l && !f) return '';
  const prenom = f ? f.charAt(0).toUpperCase() + f.slice(1) : '';
  return [l.toUpperCase(), prenom].filter(Boolean).join(' ');
}

function pickNamePair(...pairs) {
  for (const [last, first] of pairs) {
    const l = String(last || '').trim();
    const f = String(first || '').trim();
    const useL = isPlaceholderName(l) ? '' : l;
    const useF = isPlaceholderName(f) ? '' : f;
    if (useL || useF) return formatNomPrenom(useL, useF);
  }
  return '';
}

/** Nom affiché : NOM Prénom du titulaire du compte / de la fiche. */
export function accountDisplayName(user, fiche) {
  const fromFields = pickNamePair(
    [fiche?.last_name, fiche?.first_name],
    [user?.last_name, user?.first_name],
  );
  if (fromFields) return fromFields;

  const full = String(user?.full_name || '').trim();
  if (full && !/^so(\s+so)?$/i.test(full)) {
    const parts = full.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return pickNamePair(['', parts[0]]);
    return pickNamePair([parts.slice(1).join(' '), parts[0]]);
  }

  const local = String(user?.email || '').split('@')[0] || '';
  const bits = local.split(/[._-]+/).filter((b) => b && !/^\d+$/.test(b));
  if (bits.length >= 2) return formatNomPrenom(bits.slice(1).join(' '), bits[0]);
  return '';
}

export function isFieldAgent(user) {
  if (!user || user.superadmin) return false;
  const role = String(user.role || '').toLowerCase();
  return role === 'user' || role === 'agent';
}

export function assignedSiteIds({ missions = [], sites = [], agentId } = {}) {
  const fromMissions = missions.map((m) => m.site_id).filter(Boolean);
  const fromSites = sites
    .filter((s) => Array.isArray(s.agent_ids) && agentId && s.agent_ids.includes(agentId))
    .map((s) => s.id);
  return [...new Set([...fromMissions, ...fromSites])];
}

export const UNPLANNED_SERVICE_TYPES = [
  { key: 'surveillance', label: 'Surveillance' },
  { key: 'intervention', label: 'Intervention' },
  { key: 'tournee', label: 'Tournée' },
  { key: 'ronde_mobile', label: 'Ronde mobile' },
  { key: 'rdl', label: 'Reconnaissance des lieux (RDL)' },
  { key: 'audit', label: 'Audit & contrôle' },
];
