export const POINTEAU_STATUTS = ['brouillon', 'actif', 'inactif', 'archive'];
export const POINTEAU_STATUTS_AVEC_TAG = new Set(['actif', 'inactif']);

export function normalizeNfcTag(value) {
  return String(value ?? '').replace(/[\s:-]/g, '').toUpperCase();
}

export function nfcTagsMatch(a, b) {
  const left = normalizeNfcTag(a);
  return left !== '' && left === normalizeNfcTag(b);
}

export function pointeauTagKey(data) {
  if (!data || !POINTEAU_STATUTS_AVEC_TAG.has(data.status)) return null;
  return normalizeNfcTag(data.nfc_tag_id) || null;
}

export function isPointeauUtilisable(pointeau) {
  return Boolean(pointeau) && pointeau.status === 'actif' && normalizeNfcTag(pointeau.nfc_tag_id) !== '';
}

export class IntegrityError extends Error {
  constructor(code, message, status = 400, details = undefined) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const str = (value) => (typeof value === 'string' ? value.trim() : '');

function sameSite(record, siteId) {
  return Boolean(record?.site_id) && record.site_id === siteId;
}

export function siteReservedTags(site) {
  const tags = [site?.nfc_tag_id];
  for (const point of site?.checkpoints_service || []) tags.push(point?.nfc_tag_id);
  return tags.map(normalizeNfcTag).filter(Boolean);
}

export function checkPointeau({ next, previous, site, sites = [] }) {
  const siteId = str(next.site_id);
  if (!siteId) throw new IntegrityError('site_requis', 'Un pointeau doit être rattaché à un site.');
  if (!site || site.id !== siteId) throw new IntegrityError('site_inconnu', 'Le site du pointeau est introuvable dans votre société.');
  if (previous?.site_id && previous.site_id !== siteId) {
    throw new IntegrityError(
      'site_immuable',
      'Un pointeau ne peut pas changer de site. Créez un nouveau pointeau sur l’autre site et archivez celui-ci.',
      409,
    );
  }
  if (!str(next.name)) throw new IntegrityError('nom_requis', 'Le nom du pointeau est obligatoire.');
  const status = next.status || 'brouillon';
  if (!POINTEAU_STATUTS.includes(status)) throw new IntegrityError('statut_invalide', `Statut de pointeau invalide : ${status}.`);

  const tag = normalizeNfcTag(next.nfc_tag_id);
  if (previous?.status === 'actif' && !tag) {
    throw new IntegrityError('tag_retire', 'Un pointeau actif ne peut pas perdre son tag NFC. Désactivez-le d’abord.', 409);
  }
  if (status === 'actif' && !tag) {
    throw new IntegrityError('tag_requis', 'Un pointeau actif doit avoir un tag NFC. Enregistrez-le en brouillon tant que le tag n’est pas posé.');
  }
  if (tag) {
    for (const other of sites) {
      if (siteReservedTags(other).includes(tag)) {
        throw new IntegrityError(
          'tag_reserve_service',
          `Ce tag NFC est déjà utilisé comme badge de début ou de fin de service du site « ${other.name || other.id} ».`,
          409,
        );
      }
    }
  }

  return {
    data: {
      ...next,
      status,
      name: str(next.name),
      nfc_tag_id: str(next.nfc_tag_id),
      site_id: site.id,
      site_name: site.name || '',
      client_id: site.client_id || '',
      client_name: site.client_name || '',
    },
    columns: { siteId: site.id, status, tagKey: pointeauTagKey({ status, nfc_tag_id: tag }) },
  };
}

export function pointeauToCheckpoint(pointeau, order) {
  return {
    id: pointeau.id,
    pointeau_id: pointeau.id,
    name: pointeau.name,
    description: pointeau.description || '',
    order,
    nfc_tag_id: pointeau.nfc_tag_id || '',
    latitude: pointeau.latitude ?? null,
    longitude: pointeau.longitude ?? null,
    photo_url: pointeau.photo_url || '',
  };
}

export function rondePoints(ronde) {
  if (Array.isArray(ronde?.points)) {
    return [...ronde.points].sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
  }
  return null;
}

export function checkRonde({ next: clean, previous, changedKeys = [], site, pointeauxById = new Map(), operation }) {
  const touchesStructure = operation === 'create'
    || ['site_id', 'points', 'checkpoints'].some((key) => changedKeys.includes(key));
  const legacyWithoutSite = operation === 'update' && !str(previous?.site_id);
  if (legacyWithoutSite && !touchesStructure) return { data: clean };

  const siteId = str(clean.site_id);
  if (!siteId) throw new IntegrityError('site_requis', 'Une ronde doit être rattachée à un site.');
  if (!site || site.id !== siteId) throw new IntegrityError('site_inconnu', 'Le site de la ronde est introuvable dans votre société.');
  if (!str(clean.name)) throw new IntegrityError('nom_requis', 'Le nom de la ronde est obligatoire.');

  const base = {
    ...clean,
    name: str(clean.name),
    site_id: site.id,
    site_name: site.name || '',
    client_id: site.client_id || '',
    client_name: site.client_name || '',
  };

  if (!Array.isArray(clean.points)) return { data: base };

  const seen = new Set();
  const points = [];
  for (const [index, entry] of clean.points.entries()) {
    const pointeauId = str(entry?.pointeau_id);
    const pointeau = pointeauxById.get(pointeauId);
    if (!pointeau) throw new IntegrityError('pointeau_inconnu', `Le point n°${index + 1} n’existe pas.`);
    if (!sameSite(pointeau, site.id)) {
      throw new IntegrityError(
        'pointeau_autre_site',
        `Le pointeau « ${pointeau.name} » appartient à un autre site : une ronde ne peut utiliser que les pointeaux de son site.`,
        409,
      );
    }
    if (!isPointeauUtilisable(pointeau)) {
      throw new IntegrityError(
        'pointeau_inutilisable',
        `Le pointeau « ${pointeau.name} » n’est pas actif ou n’a pas de tag NFC : il ne peut pas être ajouté à une ronde.`,
        409,
      );
    }
    if (seen.has(pointeauId)) {
      throw new IntegrityError('pointeau_doublon', `Le pointeau « ${pointeau.name} » est présent deux fois dans la ronde.`);
    }
    seen.add(pointeauId);
    points.push({ pointeau_id: pointeauId, ordre: points.length + 1 });
  }

  const checkpoints = points.map((entry, index) => pointeauToCheckpoint(pointeauxById.get(entry.pointeau_id), index + 1));
  return { data: { ...base, points, checkpoints } };
}

export function checkRondeExecution({ next, ronde, site, pointeauxById = new Map() }) {
  const libre = next.type === 'libre' || next.ronde_libre === true;
  if (libre) {
    if (next.site_id && (!site || site.id !== next.site_id)) {
      throw new IntegrityError('site_inconnu', 'Le site de la ronde libre est introuvable dans votre société.');
    }
    return { data: next };
  }

  const strict = Array.isArray(ronde?.points);
  if (ronde && next.site_id && ronde.site_id && ronde.site_id !== next.site_id) {
    throw new IntegrityError('ronde_autre_site', 'La ronde exécutée n’appartient pas au site indiqué.', 409);
  }
  if (!strict) return { data: next };

  const done = Array.isArray(next.checkpoints_done) ? next.checkpoints_done : [];
  const allowed = new Set(ronde.points.map((entry) => entry.pointeau_id));
  const seen = new Set();
  for (const entry of done) {
    const pointeauId = str(entry?.pointeau_id) || str(entry?.checkpoint_id);
    if (!allowed.has(pointeauId)) {
      throw new IntegrityError('point_hors_ronde', `Le point « ${entry?.checkpoint_name || pointeauId} » ne fait pas partie de cette ronde.`, 409);
    }
    if (seen.has(pointeauId)) {
      throw new IntegrityError('point_double', `Le point « ${entry?.checkpoint_name || pointeauId} » est enregistré deux fois.`, 409);
    }
    seen.add(pointeauId);
    const pointeau = pointeauxById.get(pointeauId);
    if (!pointeau || !sameSite(pointeau, ronde.site_id) || !isPointeauUtilisable(pointeau)) {
      throw new IntegrityError('pointeau_inutilisable', `Le pointeau « ${entry?.checkpoint_name || pointeauId} » n’est pas utilisable pour valider un contrôle.`, 409);
    }
    if (entry.nfc_validated !== true || !nfcTagsMatch(entry.nfc_serial, pointeau.nfc_tag_id)) {
      throw new IntegrityError('tag_different', `Le badge lu ne correspond pas au pointeau « ${pointeau.name} ».`, 409);
    }
  }
  return { data: next };
}
