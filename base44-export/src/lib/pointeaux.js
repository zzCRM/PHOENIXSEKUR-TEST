export const POINTEAU_STATUTS = [
  { value: 'brouillon', label: 'Brouillon', hint: 'Tag pas encore posé : inutilisable' },
  { value: 'actif', label: 'Actif', hint: 'Utilisable dans les rondes' },
  { value: 'inactif', label: 'Inactif', hint: 'Désactivé temporairement, historique conservé' },
  { value: 'archive', label: 'Archivé', hint: 'Retiré, le tag est libéré' },
];

export const POINTEAU_BADGE = {
  brouillon: 'bg-amber-100 text-amber-800 border-amber-200',
  actif: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  inactif: 'bg-slate-100 text-slate-700 border-slate-200',
  archive: 'bg-slate-100 text-slate-500 border-slate-200',
};

export function normalizeNfcTag(value) {
  return String(value ?? '').replace(/[\s:-]/g, '').toUpperCase();
}

export function nfcTagsMatch(a, b) {
  const left = normalizeNfcTag(a);
  return left !== '' && left === normalizeNfcTag(b);
}

export function isPointeauUtilisable(pointeau) {
  return Boolean(pointeau) && pointeau.status === 'actif' && normalizeNfcTag(pointeau.nfc_tag_id) !== '';
}

export function statutLabel(value) {
  return POINTEAU_STATUTS.find((item) => item.value === value)?.label || value || 'Brouillon';
}

export function rondeUsesPoints(ronde) {
  return Array.isArray(ronde?.points);
}

export function rondePointCount(ronde) {
  return rondeUsesPoints(ronde) ? ronde.points.length : (ronde?.checkpoints || []).length;
}

export function rondesUsingPointeau(rondes, pointeauId) {
  return (rondes || []).filter((ronde) => (ronde.points || []).some((entry) => entry.pointeau_id === pointeauId));
}

export function legacyPointsToResolve(rondes, pointeaux) {
  const refs = new Set();
  for (const pointeau of pointeaux || []) {
    for (const ref of pointeau.legacy_refs || []) refs.add(`${ref.ronde_id}:${ref.checkpoint_id}`);
  }
  const tagsBySite = new Set(
    (pointeaux || [])
      .filter((p) => normalizeNfcTag(p.nfc_tag_id))
      .map((p) => `${p.site_id}:${normalizeNfcTag(p.nfc_tag_id)}`),
  );
  const list = [];
  for (const ronde of rondes || []) {
    if (rondeUsesPoints(ronde)) continue;
    for (const point of ronde.checkpoints || []) {
      const tag = normalizeNfcTag(point.nfc_tag_id);
      if (refs.has(`${ronde.id}:${point.id}`)) continue;
      if (tag && ronde.site_id && tagsBySite.has(`${ronde.site_id}:${tag}`)) continue;
      list.push({ ronde, point, sansTag: !tag, sansSite: !ronde.site_id });
    }
  }
  return list;
}

export function findPointeauForLegacyPoint(pointeaux, ronde, point) {
  const tag = normalizeNfcTag(point.nfc_tag_id);
  return (pointeaux || []).find((p) => (
    (p.legacy_refs || []).some((ref) => ref.ronde_id === ronde.id && ref.checkpoint_id === point.id)
    || (tag && p.site_id === ronde.site_id && normalizeNfcTag(p.nfc_tag_id) === tag)
  )) || null;
}
