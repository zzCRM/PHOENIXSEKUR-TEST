import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Shield, Calendar, FileText, Receipt, ClipboardList, BookOpen, MapPin } from 'lucide-react';

export const DEFAULT_PORTAL_PERMS = {
  access_planning: true,
  access_documents: true,
  access_factures: false,
  access_main_courante: true,
  access_rapports_rondes: true,
  access_rapports_mission: true,
  access_cahier_consignes: false,
  // Notifications email
  notif_rapport_rondes: false,
  notif_main_courante: false,
  notif_rapport_auto: false,
  notif_documents: true,
  // Sites accessibles (empty = tous)
  sites_accessibles: [],
};

const MODULES = [
  {
    key: 'access_planning',
    label: 'Planning',
    description: 'Consultation du planning des sites',
    icon: Calendar,
    color: 'text-blue-600',
  },
  {
    key: 'access_documents',
    label: 'Documents',
    description: 'Consultation et téléchargement des documents partagés',
    icon: FileText,
    color: 'text-purple-600',
  },
  {
    key: 'access_factures',
    label: 'Factures / Devis',
    description: 'Consultation et téléchargement des factures',
    icon: Receipt,
    color: 'text-green-600',
  },
  {
    key: 'access_main_courante',
    label: 'Main courante',
    description: 'Consultation des rapports de main courante',
    icon: ClipboardList,
    color: 'text-orange-600',
  },
  {
    key: 'access_rapports_rondes',
    label: 'Rapports rondes',
    description: 'Consultation des rapports de rondes et tags pointés',
    icon: MapPin,
    color: 'text-red-600',
  },
  {
    key: 'access_rapports_mission',
    label: 'Rapports mission',
    description: 'Consultation des rapports de mission / service',
    icon: ClipboardList,
    color: 'text-teal-600',
  },
  {
    key: 'access_cahier_consignes',
    label: 'Cahier de consignes',
    description: 'Consultation du cahier de consignes des sites',
    icon: BookOpen,
    color: 'text-indigo-600',
  },
];

const NOTIFS = [
  { key: 'notif_rapport_rondes', label: 'Rapports de rondes par email' },
  { key: 'notif_main_courante', label: 'Rapports de main courante par email' },
  { key: 'notif_rapport_auto', label: 'Recevoir les rapports de sécurité automatiques par email' },
  { key: 'notif_documents', label: 'Documents envoyés par email' },
];

export default function ClientPortalPermissions({ perms, onChange, sites = [] }) {
  const toggle = (key) => onChange({ ...perms, [key]: !perms[key] });

  const toggleSite = (siteId) => {
    const current = perms.sites_accessibles || [];
    const updated = current.includes(siteId)
      ? current.filter(id => id !== siteId)
      : [...current, siteId];
    onChange({ ...perms, sites_accessibles: updated });
  };

  const allSites = !perms.sites_accessibles || perms.sites_accessibles.length === 0;

  return (
    <div className="space-y-6">
      {/* Modules */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-primary" />
          <Label className="text-sm font-semibold">Modules accessibles</Label>
        </div>
        <div className="space-y-2">
          {MODULES.map(mod => {
            const Icon = mod.icon;
            return (
              <div key={mod.key} className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/20">
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${mod.color}`} />
                  <div>
                    <p className="font-medium text-sm">{mod.label}</p>
                    <p className="text-xs text-muted-foreground">{mod.description}</p>
                  </div>
                </div>
                <Switch checked={!!perms[mod.key]} onCheckedChange={() => toggle(mod.key)} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Sites accessibles */}
      {sites.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="w-4 h-4 text-primary" />
            <Label className="text-sm font-semibold">Sites accessibles</Label>
          </div>
          <div className="p-3 rounded-xl border border-border bg-muted/20 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">Tous les sites du client</span>
              <Switch checked={allSites} onCheckedChange={() => onChange({ ...perms, sites_accessibles: allSites ? ['__none__'] : [] })} />
            </div>
            {!allSites && (
              <div className="space-y-1.5 pt-2 border-t">
                {sites.map(site => (
                  <label key={site.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(perms.sites_accessibles || []).includes(site.id)}
                      onChange={() => toggleSite(site.id)}
                      className="rounded"
                    />
                    <span className="text-sm">{site.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notifications email */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Label className="text-sm font-semibold">Notifications par email</Label>
        </div>
        <div className="space-y-2">
          {NOTIFS.map(n => (
            <div key={n.key} className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-muted/10">
              <span className="text-sm">{n.label}</span>
              <Switch checked={!!perms[n.key]} onCheckedChange={() => toggle(n.key)} />
            </div>
          ))}
        </div>
      </div>

      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
        <strong>Rappel :</strong> Le client ne peut jamais modifier le planning, créer/supprimer des documents, ni accéder aux données RH ou aux tarifs.
      </div>
    </div>
  );
}