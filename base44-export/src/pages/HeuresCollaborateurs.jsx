import React from 'react';
import { Clock } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';

export default function HeuresCollaborateurs() {
  return (
    <div>
      <PageHeader
        title="Heures collaborateurs"
        subtitle="Suivi des heures travaillées par collaborateur"
      />
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <Clock className="w-16 h-16 mb-4 opacity-20" />
        <p className="text-lg font-medium">Module en cours de développement</p>
        <p className="text-sm mt-1">Le suivi des heures collaborateurs sera disponible prochainement.</p>
      </div>
    </div>
  );
}