import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const statusStyles = {
  actif: 'bg-primary/10 text-primary border-primary/20',
  inactif: 'bg-muted text-muted-foreground border-border',
  en_mission: 'bg-blue-500/10 text-blue-600 border-blue-200',
  prospect: 'bg-amber-500/10 text-amber-600 border-amber-200',
  planifiee: 'bg-blue-500/10 text-blue-600 border-blue-200',
  en_cours: 'bg-amber-500/10 text-amber-600 border-amber-200',
  terminee: 'bg-primary/10 text-primary border-primary/20',
  annulee: 'bg-destructive/10 text-destructive border-destructive/20',
  non_realise: 'bg-red-500/10 text-red-600 border-red-200',
  brouillon: 'bg-muted text-muted-foreground border-border',
  envoyee: 'bg-blue-500/10 text-blue-600 border-blue-200',
  payee: 'bg-primary/10 text-primary border-primary/20',
  en_retard: 'bg-destructive/10 text-destructive border-destructive/20',
};

const statusLabels = {
  actif: 'Actif',
  inactif: 'Inactif',
  en_mission: 'En mission',
  prospect: 'Prospect',
  planifiee: 'Planifiée',
  en_cours: 'En cours',
  terminee: 'Terminée',
  annulee: 'Annulée',
  non_realise: 'Non réalisé',
  brouillon: 'Brouillon',
  envoyee: 'Envoyée',
  payee: 'Payée',
  en_retard: 'En retard',
};

export default function StatusBadge({ status }) {
  return (
    <Badge variant="outline" className={cn('font-medium', statusStyles[status] || 'bg-muted text-muted-foreground')}>
      {statusLabels[status] || status}
    </Badge>
  );
}