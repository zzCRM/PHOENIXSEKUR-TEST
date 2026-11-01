/**
 * Catalogue des autorisations Phoenix Sekur.
 * Partagé entre l'interface et l'API : un droit refusé ici est aussi refusé côté serveur.
 */

export const ROLES_KIND = 'roles_acces';

export const PALETTE = [
  { name: 'Bleu nuit', value: '#10192b' },
  { name: 'Or', value: '#c9a227' },
  { name: 'Vert', value: '#0f766e' },
  { name: 'Ardoise', value: '#475569' },
  { name: 'Ambre', value: '#b45309' },
];

export const PERIMETRES = [
  ['personnel', 'Données personnelles'],
  ['equipe', 'Équipe'],
  ['site', 'Site'],
  ['sites', 'Plusieurs sites'],
  ['tous_sites', 'Tous les sites'],
  ['entreprise', 'Entreprise entière'],
];

const crud = (consulter = 'Consulter') => [
  ['consulter', consulter],
  ['creer', 'Créer'],
  ['modifier', 'Modifier'],
  ['supprimer', 'Supprimer'],
];

export const PERMISSION_MODULES = [
  {
    key: 'planning',
    label: 'Planning',
    actions: [
      ['consulter', 'Consulter son planning'],
      ['consulter_tous', 'Consulter tous les plannings'],
      ['creer', 'Créer une vacation'],
      ['modifier', 'Modifier une vacation'],
      ['supprimer', 'Supprimer une vacation'],
      ['affecter', 'Affecter un collaborateur'],
      ['remplacer', 'Remplacer un collaborateur'],
      ['horaires', 'Modifier les horaires'],
      ['valider', 'Valider une vacation'],
      ['exporter', 'Exporter le planning'],
    ],
  },
  {
    key: 'rondes',
    label: 'Rondes',
    actions: [
      ['consulter', 'Consulter les rondes'],
      ['creer', 'Créer une ronde'],
      ['modifier', 'Modifier une ronde'],
      ['supprimer', 'Supprimer une ronde'],
      ['sens', 'Changer le sens d’une ronde'],
      ['parcours', 'Modifier un parcours'],
      ['points_ajouter', 'Ajouter des points de contrôle'],
      ['points_supprimer', 'Supprimer des points de contrôle'],
      ['frequences', 'Modifier les fréquences'],
      ['valider', 'Valider une ronde'],
    ],
  },
  {
    key: 'audits',
    label: 'Audits',
    actions: [
      ['consulter', 'Consulter'],
      ['creer', 'Créer'],
      ['modifier', 'Modifier'],
      ['supprimer', 'Supprimer'],
      ['realiser', 'Réaliser'],
      ['valider', 'Valider'],
      ['exporter', 'Exporter'],
    ],
  },
  {
    key: 'main_courante',
    label: 'Main courante',
    actions: [
      ['consulter', 'Consulter'],
      ['creer', 'Créer'],
      ['modifier', 'Modifier'],
      ['cloturer', 'Clôturer'],
      ['reouvrir', 'Réouvrir'],
      ['pieces', 'Ajouter des pièces jointes'],
    ],
  },
  { key: 'points_controle', label: 'Points de contrôle', actions: [...crud(), ['valider', 'Valider un point']] },
  { key: 'services', label: 'Services', actions: [['consulter', 'Consulter les services'], ['pointer', 'Accéder à la prise de poste'], ['service_non_planifie', 'Service non planifié'], ['cloturer', 'Clôturer un service']] },
  { key: 'pti', label: 'Protection PTI', actions: [['consulter', 'Consulter'], ['declencher', 'Déclencher une alerte'], ['lever_doute', 'Lever un doute'], ['parametrer', 'Paramétrer le PTI']] },
  { key: 'collaborateurs', label: 'Collaborateurs', actions: [...crud('Consulter les fiches'), ['gerer_acces', 'Gérer les accès'], ['inviter', 'Inviter un compte']] },
  { key: 'sites', label: 'Sites', actions: crud('Consulter les sites') },
  { key: 'clients', label: 'Clients', actions: [...crud('Consulter les clients'), ['voir_tarif', 'Consulter les tarifs']] },
  { key: 'contrats', label: 'Contrats', actions: crud('Consulter les contrats') },
  { key: 'conges', label: 'Congés', actions: [['consulter', 'Consulter'], ['demander', 'Faire une demande'], ['valider', 'Valider'], ['refuser', 'Refuser']] },
  { key: 'documents', label: 'Documents', actions: [['consulter', 'Consulter ses documents'], ['ajouter', 'Ajouter'], ['supprimer', 'Supprimer']] },
  { key: 'facturation', label: 'Facturation', actions: [...crud('Consulter les factures'), ['exporter', 'Exporter']] },
  { key: 'prepaie', label: 'Prépaie', actions: [['consulter', 'Consulter'], ['exporter', 'Exporter']] },
  { key: 'ecarts', label: 'Écarts horaires', actions: [['consulter', 'Consulter'], ['exporter', 'Exporter']] },
  { key: 'rapports', label: 'Rapports', actions: [['consulter', 'Consulter'], ['exporter', 'Exporter']] },
  { key: 'statistiques', label: 'Statistiques', actions: [['consulter', 'Consulter']] },
  { key: 'consignes', label: 'Consignes', actions: [['consulter', 'Consulter'], ['modifier', 'Modifier']] },
  { key: 'demandes', label: 'Demandes', actions: [['consulter', 'Consulter'], ['repondre', 'Répondre']] },
  { key: 'parametres', label: 'Paramètres', actions: [['consulter', 'Consulter'], ['modifier', 'Modifier']] },
];

export const ENTITY_PERMISSION = {
  Mission: { read: 'planning.consulter', create: 'planning.creer', update: 'planning.modifier', delete: 'planning.supprimer' },
  Ronde: { read: 'rondes.consulter', create: 'rondes.creer', update: 'rondes.modifier', delete: 'rondes.supprimer' },
  RondeExecution: { read: 'rondes.consulter', create: 'rondes.valider', update: 'rondes.valider', delete: 'rondes.supprimer' },
  BonIntervention: { read: 'audits.consulter', create: 'audits.creer', update: 'audits.modifier', delete: 'audits.supprimer' },
  MainCourante: { read: 'main_courante.consulter', create: 'main_courante.creer', update: 'main_courante.modifier', delete: 'main_courante.cloturer' },
  Agent: { read: 'collaborateurs.consulter', create: 'collaborateurs.creer', update: 'collaborateurs.modifier', delete: 'collaborateurs.supprimer' },
  Site: { read: 'sites.consulter', create: 'sites.creer', update: 'sites.modifier', delete: 'sites.supprimer' },
  Client: { read: 'clients.consulter', create: 'clients.creer', update: 'clients.modifier', delete: 'clients.supprimer' },
  Contrat: { read: 'contrats.consulter', create: 'contrats.creer', update: 'contrats.modifier', delete: 'contrats.supprimer' },
  Conge: { read: 'conges.consulter', create: 'conges.demander', update: 'conges.valider', delete: 'conges.refuser' },
  Document: { read: 'documents.consulter', create: 'documents.ajouter', update: 'documents.ajouter', delete: 'documents.supprimer' },
  Invoice: { read: 'facturation.consulter', create: 'facturation.creer', update: 'facturation.modifier', delete: 'facturation.modifier' },
  FicheDePaie: { read: 'prepaie.consulter', create: 'prepaie.consulter', update: 'prepaie.consulter', delete: 'prepaie.consulter' },
  PriseDeService: { read: 'services.consulter', create: 'services.pointer', update: 'services.pointer', delete: 'services.cloturer' },
  Demande: { read: 'demandes.consulter', create: 'demandes.consulter', update: 'demandes.repondre', delete: 'demandes.repondre' },
  CahierConsignes: { read: 'consignes.consulter', create: 'consignes.modifier', update: 'consignes.modifier', delete: 'consignes.modifier' },
  Alerte: { read: 'pti.consulter', create: 'pti.declencher', update: 'pti.lever_doute', delete: 'pti.parametrer' },
};

const PORTAL_LOCK = {
  'planning.consulter': 'acces_planning',
  'planning.consulter_tous': 'acces_planning',
  'planning.creer': 'acces_planning',
  'planning.modifier': 'acces_planning',
  'services.consulter': 'acces_services',
  'services.pointer': 'acces_services',
  'services.service_non_planifie': 'acces_service_non_planifie',
  'rondes.consulter': 'acces_rondes',
  'rondes.valider': 'acces_rondes',
  'points_controle.consulter': 'acces_points_controle',
  'main_courante.consulter': 'acces_main_courante',
  'main_courante.creer': 'acces_main_courante',
  'documents.consulter': 'acces_documents',
  'conges.consulter': 'acces_conges',
  'conges.demander': 'acces_conges',
  'pti.consulter': 'acces_pti',
  'pti.declencher': 'acces_pti',
  'consignes.consulter': 'acces_consignes',
  'ecarts.consulter': 'acces_ecarts',
};

export function permissionId(moduleKey, action) {
  return `${moduleKey}.${action}`;
}

export function allPermissionIds() {
  const ids = [];
  for (const module of PERMISSION_MODULES) {
    for (const [action] of module.actions) ids.push(permissionId(module.key, action));
  }
  return ids;
}

export function permissionLabel(id) {
  const [moduleKey, action] = String(id || '').split('.');
  const module = PERMISSION_MODULES.find((item) => item.key === moduleKey);
  const found = module?.actions.find((item) => item[0] === action);
  return found ? `${module.label} — ${found[1]}` : id;
}

function allow(grants, moduleKey, actions) {
  for (const action of actions) grants[permissionId(moduleKey, action)] = true;
  return grants;
}

function templateGrants(partial) {
  const grants = {};
  for (const [moduleKey, actions] of Object.entries(partial)) allow(grants, moduleKey, actions);
  return grants;
}

export const ROLE_TEMPLATES = [
  {
    key: 'agent',
    label: 'Agent de sécurité',
    color: '#10192b',
    icon: 'Shield',
    perimetre: 'site',
    grants: templateGrants({
      planning: ['consulter'],
      rondes: ['consulter', 'valider'],
      points_controle: ['consulter', 'valider'],
      services: ['consulter', 'pointer', 'service_non_planifie', 'cloturer'],
      pti: ['consulter', 'declencher'],
      main_courante: ['consulter', 'creer'],
      conges: ['consulter', 'demander'],
      documents: ['consulter'],
      consignes: ['consulter'],
      ecarts: ['consulter'],
    }),
  },
  {
    key: 'chef_poste',
    label: 'Chef de poste',
    color: '#0f766e',
    icon: 'ShieldCheck',
    perimetre: 'site',
    grants: templateGrants({
      planning: ['consulter', 'consulter_tous', 'creer', 'modifier', 'affecter', 'remplacer', 'horaires', 'valider'],
      rondes: ['consulter', 'modifier', 'valider', 'frequences'],
      services: ['consulter', 'pointer', 'cloturer'],
      main_courante: ['consulter', 'creer', 'modifier', 'cloturer'],
      collaborateurs: ['consulter'],
      conges: ['consulter'],
    }),
  },
  {
    key: 'chef_equipe',
    label: 'Chef d’équipe',
    color: '#0f766e',
    icon: 'Users',
    perimetre: 'equipe',
    grants: templateGrants({
      planning: ['consulter', 'consulter_tous', 'modifier', 'affecter', 'remplacer'],
      collaborateurs: ['consulter'],
      conges: ['consulter', 'valider', 'refuser'],
      services: ['consulter'],
      ecarts: ['consulter'],
    }),
  },
  {
    key: 'responsable_site',
    label: 'Responsable de site',
    color: '#10192b',
    icon: 'MapPin',
    perimetre: 'site',
    grants: templateGrants({
      planning: ['consulter_tous', 'creer', 'modifier', 'affecter', 'valider', 'exporter'],
      rondes: ['consulter', 'creer', 'modifier', 'parcours', 'points_ajouter', 'frequences', 'valider'],
      sites: ['consulter', 'modifier'],
      main_courante: ['consulter', 'creer', 'modifier', 'cloturer', 'reouvrir', 'pieces'],
      audits: ['consulter', 'realiser'],
      collaborateurs: ['consulter'],
    }),
  },
  {
    key: 'superviseur',
    label: 'Superviseur',
    color: '#475569',
    icon: 'ScanLine',
    perimetre: 'sites',
    grants: templateGrants({
      planning: ['consulter_tous', 'modifier', 'affecter', 'remplacer', 'valider'],
      rondes: ['consulter', 'valider'],
      services: ['consulter', 'cloturer'],
      pti: ['consulter', 'lever_doute'],
      main_courante: ['consulter', 'cloturer'],
      audits: ['consulter', 'valider'],
      collaborateurs: ['consulter'],
      ecarts: ['consulter'],
    }),
  },
  {
    key: 'responsable_planning',
    label: 'Responsable planning',
    color: '#c9a227',
    icon: 'Calendar',
    perimetre: 'tous_sites',
    grants: templateGrants({
      planning: ['consulter', 'consulter_tous', 'creer', 'modifier', 'supprimer', 'affecter', 'remplacer', 'horaires', 'valider', 'exporter'],
      collaborateurs: ['consulter'],
      sites: ['consulter'],
      conges: ['consulter'],
    }),
  },
  {
    key: 'gestionnaire_rh',
    label: 'Gestionnaire RH',
    color: '#b45309',
    icon: 'Wallet',
    perimetre: 'entreprise',
    grants: templateGrants({
      collaborateurs: ['consulter', 'creer', 'modifier', 'inviter'],
      conges: ['consulter', 'valider', 'refuser'],
      documents: ['consulter', 'ajouter'],
      prepaie: ['consulter', 'exporter'],
      ecarts: ['consulter', 'exporter'],
      demandes: ['consulter', 'repondre'],
    }),
  },
  {
    key: 'auditeur',
    label: 'Auditeur',
    color: '#475569',
    icon: 'ClipboardCheck',
    perimetre: 'tous_sites',
    grants: templateGrants({
      audits: ['consulter', 'creer', 'realiser', 'valider', 'exporter'],
      rondes: ['consulter'],
      main_courante: ['consulter'],
      rapports: ['consulter', 'exporter'],
      statistiques: ['consulter'],
    }),
  },
  {
    key: 'administrateur',
    label: 'Administrateur',
    color: '#10192b',
    icon: 'ShieldCheck',
    perimetre: 'entreprise',
    grants: Object.fromEntries(allPermissionIds().map((id) => [id, true])),
  },
  {
    key: 'personnalise',
    label: 'Personnalisé',
    color: '#c9a227',
    icon: 'Shield',
    perimetre: 'site',
    grants: {},
  },
];

export function templateByKey(key) {
  return ROLE_TEMPLATES.find((item) => item.key === key) || ROLE_TEMPLATES[ROLE_TEMPLATES.length - 1];
}

export function entityPermission(entity, operation) {
  return ENTITY_PERMISSION[entity]?.[operation] || null;
}

export function explicitPortalFalse(agent, portalKey) {
  if (!agent || !portalKey) return false;
  if (agent.droits_portail && agent.droits_portail[portalKey] === false) return true;
  return agent[portalKey] === false;
}

export function portalDenies(agent, permissionKey) {
  const portalKey = PORTAL_LOCK[permissionKey];
  return explicitPortalFalse(agent, portalKey);
}

export function resolveEffective(agent, roles = []) {
  const roleIds = Array.isArray(agent?.role_ids) ? agent.role_ids : [];
  const selected = roles.filter((role) => roleIds.includes(role.id) && role.status !== 'inactif');
  const grants = {};
  if (selected.length) {
    for (const id of allPermissionIds()) grants[id] = false;
    for (const role of selected) {
      for (const [key, value] of Object.entries(role.grants || {})) {
        if (value) grants[key] = true;
      }
    }
  }
  for (const [key, value] of Object.entries(agent?.exceptions || {})) {
    if (allPermissionIds().includes(key)) grants[key] = value === true;
  }
  for (const id of Object.keys(grants)) {
    if (portalDenies(agent, id)) grants[id] = false;
  }
  const perimetre = agent?.perimetre || selected[0]?.perimetre || '';
  return { grants, perimetre, roles: selected };
}

export function blockedByPermissions(user, entity, operation, scope = {}) {
  const role = user?.role;
  if (!user || role === 'superadmin' || role === 'admin' || role === 'client') return false;
  const key = entityPermission(entity, operation);
  if (!key) return false;
  const fiche = scope.ficheAgent;
  if (!fiche) return false;
  if (portalDenies(fiche, key)) return true;
  const roleIds = Array.isArray(fiche.role_ids) ? fiche.role_ids : [];
  if (!roleIds.length) return false;
  const { grants } = resolveEffective(fiche, scope.roles || []);
  return grants[key] !== true;
}

export function outsidePerimetre(user, record, scope = {}) {
  const role = user?.role;
  if (!user || !record || role === 'superadmin' || role === 'admin' || role === 'client') return false;
  const fiche = scope.ficheAgent;
  if (!fiche || !Array.isArray(fiche.role_ids) || !fiche.role_ids.length) return false;
  const { perimetre } = resolveEffective(fiche, scope.roles || []);
  if (!perimetre || perimetre === 'entreprise' || perimetre === 'tous_sites') return false;
  if (perimetre === 'personnel') {
    if (record.agent_id && record.agent_id !== fiche.id && record.id !== fiche.id) return true;
    return false;
  }
  if (!record.site_id) return false;
  const allowed = new Set([...(fiche.site_ids || []), ...(scope.siteIds || [])]);
  if (!allowed.size) return false;
  return !allowed.has(record.site_id);
}

export function countPermissions() {
  return allPermissionIds().length;
}

export function rolesConfigId(companyId) {
  return `roles-acces-${companyId}`;
}
