import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GripVertical, ArrowUp, ArrowDown, Pencil } from 'lucide-react';

export default function MissionsSettingsDialog({ open, onClose, columns, onColumnsChange, pageSize, onPageSizeChange }) {
  const toggle = (key) => onColumnsChange(cols => cols.map(c => c.key === key ? { ...c, visible: !c.visible } : c));
  const move = (idx, dir) => onColumnsChange(cols => {
    const next = [...cols];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return cols;
    [next[idx], next[j]] = [next[j], next[idx]];
    return next;
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-4 h-4" /> Paramètres du tableau
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-2">
          <div>
            <p className="text-sm font-semibold text-muted-foreground mb-3">Colonnes</p>
            <div className="border rounded-lg max-h-80 overflow-y-auto divide-y">
              {columns.map((col, idx) => (
                <div key={col.key} className="flex items-center gap-2 px-3 py-2 hover:bg-muted/40">
                  <Checkbox checked={col.visible} onCheckedChange={() => toggle(col.key)} />
                  <span className="flex-1 text-sm">{col.label}</span>
                  <button onClick={() => move(idx, -1)} disabled={idx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button onClick={() => move(idx, 1)} disabled={idx === columns.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                    <ArrowDown className="w-4 h-4" />
                  </button>
                  <GripVertical className="w-4 h-4 text-muted-foreground/50" />
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-muted-foreground mb-3">Tableau</p>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm">Nombre de résultats par pages</label>
                <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 25, 50, 100].map(n => (
                      <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                Cochez les colonnes à afficher et réorganisez-les avec les flèches.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}