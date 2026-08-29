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

export function siteEmergencyNumber(site) {
  const raw = site?.urgences?.[0];
  if (!raw) return '';
  const text = typeof raw === 'string' ? raw : (raw.tel || raw.phone || raw.numero || raw.label || '');
  const m = String(text).match(/(\+?\d[\d\s./-]{6,}\d)/);
  return (m ? m[1] : String(text)).replace(/[^\d+]/g, '');
}
