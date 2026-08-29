import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default function PageHeader({ title, subtitle, actionLabel, onAction, icon: Icon }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-8">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight truncate">{title}</h1>
        {subtitle && <p className="text-muted-foreground mt-1 text-sm leading-snug">{subtitle}</p>}
      </div>
      {actionLabel && (
        <Button onClick={onAction} className="bg-primary hover:bg-primary/90 gap-2 w-full sm:w-auto shrink-0">
          {Icon ? <Icon className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {actionLabel}
        </Button>
      )}
    </div>
  );
}