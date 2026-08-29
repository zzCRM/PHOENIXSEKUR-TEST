/** Statut d’exécution d’une vacation (comme Sekur). */
export function vacationRunStatus(prise) {
  if (!prise) return 'en_attente';
  if (prise.status === 'termine' || prise.actual_end) return 'termine';
  if (prise.status === 'en_service') return 'en_cours';
  return 'en_attente';
}

export const RUN_STATUS_META = {
  en_attente: { label: 'En attente', className: 'bg-amber-400 text-amber-950' },
  en_cours: { label: 'En cours', className: 'bg-blue-600 text-white' },
  termine: { label: 'Terminé', className: 'bg-slate-600 text-white' },
};

export function extractPhone(value) {
  if (value == null || value === '') return '';
  const text = typeof value === 'string'
    ? value
    : (value.urgence_phone || value.tel || value.phone || value.numero || value.label || '');
  const m = String(text).match(/(\+?\d[\d\s./-]{6,}\d)/);
  return (m ? m[1] : '').replace(/[^\d+]/g, '');
}

export function siteEmergencyNumber(site) {
  return extractPhone(site?.urgences?.[0]);
}

/** Numéro d’urgence de la fiche client (champ dédié, sinon téléphone). */
export function clientEmergencyNumber(client) {
  return extractPhone(client?.urgence_phone) || extractPhone(client?.phone);
}

export function resolveEmergencyTel(client, site) {
  return clientEmergencyNumber(client) || siteEmergencyNumber(site);
}
