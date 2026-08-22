import React, { useEffect, useState } from 'react';
import { Calendar, Info, ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar as RangeCalendar } from '@/components/ui/calendar';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';

const toStr = (d) => (d ? format(d, 'yyyy-MM-dd') : '');
const parse = (s) => (s ? new Date(s) : undefined);

/**
 * Sélecteur d'intervalle de dates — même modèle que Main Courante :
 * déclencheur "Intervalle dd/MM/yyyy - dd/MM/yyyy" + calendrier range + presets.
 */
export default function DateIntervalPicker({ dateRange, onDateRangeChange, className = '' }) {
  const [open, setOpen] = useState(false);
  const dr = dateRange || { start: '', end: '' };
  const [calRange, setCalRange] = useState({ from: undefined, to: undefined });

  useEffect(() => {
    setCalRange({ from: parse(dr.start), to: parse(dr.end) });
  }, [dr.start, dr.end]);

  const applyPreset = (preset) => {
    const today = new Date();
    let from, to;
    switch (preset) {
      case 'today': from = to = today; break;
      case 'week': from = startOfWeek(today, { weekStartsOn: 1 }); to = endOfWeek(today, { weekStartsOn: 1 }); break;
      case 'month': from = startOfMonth(today); to = endOfMonth(today); break;
      case '7d': to = today; from = subDays(today, 7); break;
      case '30d': to = today; from = subDays(today, 30); break;
      default: return;
    }
    setCalRange({ from, to });
  };

  const applyRange = () => {
    onDateRangeChange({ start: toStr(calRange.from), end: toStr(calRange.to) });
    setOpen(false);
  };
  const resetRange = () => {
    setCalRange({ from: undefined, to: undefined });
    onDateRangeChange({ start: '', end: '' });
  };

  const label = dr.start && dr.end
    ? `${format(parse(dr.start), 'dd/MM/yyyy')} - ${format(parse(dr.end), 'dd/MM/yyyy')}`
    : dr.start ? `${format(parse(dr.start), 'dd/MM/yyyy')} - ...` : 'Intervalle';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={`gap-2 h-9 ${className}`}>
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">{label}</span>
          <Info className="w-3.5 h-3.5 text-slate-400" />
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[380px] max-w-[94vw] p-0 rounded-xl shadow-2xl border-border/70">
        <div className="px-4 pt-4 pb-3 border-b bg-gradient-to-b from-slate-50 to-white rounded-t-xl">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-sm font-semibold text-slate-700">Période</span>
            <Info className="w-3.5 h-3.5 text-slate-400 ml-auto" />
          </div>
        </div>
        <div className="px-4 py-3">
          <div className="flex justify-center mb-2">
            <RangeCalendar mode="range" locale={fr} weekStartsOn={1} selected={calRange} onSelect={setCalRange} numberOfMonths={1} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[{ k: 'today', l: "Aujourd'hui" }, { k: 'week', l: 'Cette semaine' }, { k: 'month', l: 'Ce mois-ci' }, { k: '7d', l: '7 derniers j.' }, { k: '30d', l: '30 derniers j.' }].map(p => (
              <button key={p.k} type="button" onClick={() => applyPreset(p.k)} className="text-xs px-2.5 py-1 rounded-md border bg-card hover:bg-accent transition-colors">{p.l}</button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div className="rounded-lg border bg-card px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Début</div>
              <div className="text-sm font-medium">{calRange.from ? format(calRange.from, 'dd MMM yyyy', { locale: fr }) : '—'}</div>
            </div>
            <div className="rounded-lg border bg-card px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Fin</div>
              <div className="text-sm font-medium">{calRange.to ? format(calRange.to, 'dd MMM yyyy', { locale: fr }) : '—'}</div>
            </div>
          </div>
          <div className="flex justify-between items-center mt-2">
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={resetRange}>Réinitialiser</Button>
            <Button size="sm" className="h-8" onClick={applyRange}>Appliquer</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}