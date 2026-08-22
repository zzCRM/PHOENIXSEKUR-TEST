import React, { useEffect } from 'react';
import { Pencil, UserX, CalendarX, Trash2, Plus, Receipt } from 'lucide-react';

const ITEMS = [
  { key: 'edit', label: 'Modifier', icon: Pencil },
  { key: 'unassign', label: 'Désaffecter le collaborateur', icon: UserX },
  { key: 'unplan', label: 'Déplanifier le service', icon: CalendarX },
  { key: 'delete', label: 'Déprogrammer le service', icon: Trash2 },
  { key: 'devis', label: 'Créer le devis', icon: Plus },
  { key: 'facture', label: 'Créer la facture', icon: Receipt },
];

export default function PlanningContextMenu({ x, y, onAction, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const menuW = 240;
  const menuH = ITEMS.length * 38 + 8;
  const left = Math.min(x, window.innerWidth - menuW - 8);
  const top = Math.min(y, window.innerHeight - menuH - 8);

  return (
    <>
      <div className="fixed inset-0 z-50" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      <div
        className="fixed z-50 bg-white rounded-lg shadow-xl border border-slate-200 py-1 w-60"
        style={{ left, top }}
      >
        {ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              onClick={() => { onAction(item.key); onClose(); }}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 transition-colors text-left"
            >
              <Icon className="w-4 h-4 text-slate-500 shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}