import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Info } from 'lucide-react';

const TOGGLES = [
  { key: 'envoi_main_courante_veille', label: "Activer l'envoi des rapports de mains courantes de la veille", info: false },
  { key: 'envoi_bon_intervention_veille', label: "Activer l'envoi des bons d'interventions de la veille, le lendemain matin", info: true },
  { key: 'envoi_auto_bon_intervention', label: "Envoyer automatiquement les bons d'interventions", info: true },
  { key: 'envoi_bon_rondes_veille', label: "Activer l'envoi des bons de rondes de la veille, le lendemain matin", info: true },
  { key: 'envoi_bon_rdl_veille', label: "Activer l'envoi des bons de RDL de la veille, le lendemain matin", info: true },
  { key: 'envoi_bon_audits_controles_veille', label: "Activer l'envoi des Bons d'audits & contrôles de la veille, le lendemain matin", info: true },
  { key: 'event_service_non_debute', label: "Activer l'événement « Service non débuté »", info: false },
];

export default function ParametresTab({ form, update }) {
  const params = form.parametres_envoi || {};
  const setParam = (key, val) => update('parametres_envoi', { ...params, [key]: val });

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="text-base font-semibold text-slate-700 mb-1">Paramètres des envois et des notifications</h3>
        <p className="text-sm text-muted-foreground">Configurez les envois automatiques et alertes liés à ce site.</p>
      </div>

      <div className="rounded-lg border border-border bg-card divide-y divide-border">
        {TOGGLES.map(t => (
          <div key={t.key} className="flex items-center justify-between gap-4 p-4">
            <div className="flex items-start gap-2">
              <span className="text-sm text-slate-700">{t.label}</span>
              {t.info && <Info className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />}
            </div>
            <Switch checked={params[t.key] ?? false} onCheckedChange={v => setParam(t.key, v)} />
          </div>
        ))}
      </div>
    </div>
  );
}