import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin, BookOpen, ClipboardList, ChevronDown, ChevronUp } from 'lucide-react';

const SECTIONS = [
  {
    icon: Calendar,
    color: 'bg-blue-100 text-blue-700',
    title: 'A. Planning & disponibilités',
    items: [
      'Voir son propre planning (web + appli mobile)',
      'Voir le planning des sites auxquels il a accès (si droit « accès au planning des sites »)',
      'Voir le planning des autres collaborateurs (si droit « accès au planning des collaborateurs »)',
      'Recevoir automatiquement son planning par email / PDF',
      'Recevoir les mises à jour de planning (si notifications activées)',
      'Soumettre des demandes de congés',
      'Soumettre des demandes de changement de planning',
      'Autres demandes RH (selon vos paramétrages)',
      'Déclarer ses indisponibilités via l\'application (si module Demandes activé)',
    ],
    required: [
      'Collaborateur planifiable',
      'Compte utilisateur actif',
      'Accès aux sites concernés',
    ],
  },
  {
    icon: MapPin,
    color: 'bg-green-100 text-green-700',
    title: 'B. Pointage & rondes',
    items: [
      'Pointer ses services (début / fin) via l\'appli',
      'Scanner des tags / QR codes / NFC pour les rondes',
      'Suivre un parcours de ronde défini sur un site',
      'Remonter des anomalies / événements pendant une ronde',
      'Être géolocalisé (si géolocalisation activée dans sa fiche)',
      'Voir la liste des rondes du site (si droit « lister les rondes du site »)',
    ],
    required: [
      'Collaborateur planifiable',
      'Compte utilisateur actif',
      'Accès aux rondes',
      'Pointage autorisé',
      'Géolocalisation activée (si applicable)',
    ],
  },
  {
    icon: BookOpen,
    color: 'bg-amber-100 text-amber-700',
    title: 'C. Main courante & terrain',
    items: [
      'Créer des événements depuis l\'appli (incidents, anomalies, interventions, etc.)',
      'Ajouter des photos, commentaires, pièces jointes',
      'Consulter l\'historique des événements (si droit de lecture)',
      'Rédiger des rapports de mission / fin de service (selon vos modèles)',
    ],
    required: [
      'Accès main courante',
      'Compte utilisateur actif',
    ],
  },
  {
    icon: ClipboardList,
    color: 'bg-purple-100 text-purple-700',
    title: 'D. Demandes & RH (côté collaborateur)',
    items: [
      'Créer des demandes collaborateurs : congés, arrêts maladie, changement de planning, autres motifs',
      'Suivre le statut de ses demandes : en attente / acceptée / refusée',
      'Consulter certains documents personnels partagés : contrat, consignes, procédures, etc.',
    ],
    required: [
      'Accès aux demandes',
      'Accès aux documents (si applicable)',
    ],
  },
];

export default function AgentCapabilitiesInfo() {
  const [openSection, setOpenSection] = useState(null);

  return (
    <div className="space-y-3">
      <div className="mb-4">
        <h3 className="font-semibold text-base">Possibilités des collaborateurs</h3>
        <p className="text-sm text-muted-foreground mt-0.5">Ce que chaque collaborateur peut faire selon ses droits configurés dans sa fiche.</p>
      </div>
      {SECTIONS.map((section, i) => {
        const Icon = section.icon;
        const isOpen = openSection === i;
        return (
          <Card key={i} className="overflow-hidden">
            <button
              className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/30 transition-colors"
              onClick={() => setOpenSection(isOpen ? null : i)}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${section.color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <span className="font-semibold text-sm flex-1">{section.title}</span>
              {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>

            {isOpen && (
              <div className="px-4 pb-4 space-y-3 border-t">
                <ul className="mt-3 space-y-1.5">
                  {section.items.map((item, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                {section.required.length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Droits nécessaires dans la fiche :</p>
                    <div className="flex flex-wrap gap-1.5">
                      {section.required.map((r, j) => (
                        <Badge key={j} variant="secondary" className="text-xs">{r}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}