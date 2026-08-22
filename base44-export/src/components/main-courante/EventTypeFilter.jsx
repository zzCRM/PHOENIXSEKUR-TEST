import React, { useEffect, useMemo, useState } from 'react';
import { Filter, Search, X, Info, Calendar, MapPin, Building2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar as RangeCalendar } from '@/components/ui/calendar';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { EVENT_CATEGORIES, EVENT_TYPES, eventTypeCode } from '@/lib/mainCouranteEvents';

const toStr = (d) => (d ? format(d, 'yyyy-MM-dd') : '');
const parse = (s) => (s ? new Date(s) : undefined);

export default function EventTypeFilter({
  selected, onChange,
  dateRange, onDateRangeChange,
  selectedSites, onSelectedSitesChange,
  sites = [],
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [siteQuery, setSiteQuery] = useState('');
  const sel = selected || new Set();
  const dr = dateRange || { start: '', end: '' };
  const siteSel = selectedSites || new Set();

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
  const applyRange = () => onDateRangeChange({ start: toStr(calRange.from), end: toStr(calRange.to) });
  const resetRange = () => { setCalRange({ from: undefined, to: undefined }); onDateRangeChange({ start: '', end: '' }); };

  const toggle = (code) => {
    const next = new Set(sel);
    if (next.has(code)) next.delete(code); else next.add(code);
    onChange(next);
  };

  const toggleCategory = (catKey) => {
    const next = new Set(sel);
    const codes = EVENT_TYPES[catKey].map(e => eventTypeCode(catKey, e.key));
    const allSelected = codes.every(c => next.has(c));
    if (allSelected) codes.forEach(c => next.delete(c));
    else codes.forEach(c => next.add(c));
    onChange(next);
  };

  const toggleSite = (id) => {
    const next = new Set(siteSel);
    if (next.has(id)) next.delete(id); else next.add(id);
    onSelectedSitesChange(next);
  };

  const allSites = () => onSelectedSitesChange(new Set());

  const selectAll = () => {
    const next = new Set();
    Object.entries(EVENT_TYPES).forEach(([cat, list]) => list.forEach(e => next.add(eventTypeCode(cat, e.key))));
    onChange(next);
  };

  const clearAll = () => {
    onChange(new Set());
    onDateRangeChange({ start: '', end: '' });
    onSelectedSitesChange(new Set());
  };

  const counts = useMemo(() => {
    const byCat = {};
    EVENT_CATEGORIES.forEach(c => {
      const codes = EVENT_TYPES[c.key].map(e => eventTypeCode(c.key, e.key));
      byCat[c.key] = codes.filter(c => sel.has(c)).length;
    });
    return byCat;
  }, [sel]);

  const activeCount = sel.size + (dr.start || dr.end ? 1 : 0) + siteSel.size;

  const filteredSites = useMemo(() => {
    const q = siteQuery.toLowerCase().trim();
    if (!q) return sites;
    return sites.filter(s => (s.name || '').toLowerCase().includes(q) || (s.client_name || '').toLowerCase().includes(q));
  }, [sites, siteQuery]);

  const q = query.toLowerCase().trim();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2 relative h-9">
          <Filter className="w-4 h-4" />
          <span className="hidden sm:inline">FILTRES</span>
          {activeCount > 0 && (
            <span className="ml-1 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold">
              {activeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[440px] max-w-[94vw] p-0 rounded-xl shadow-2xl border-border/70">
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b bg-gradient-to-b from-slate-50 to-white rounded-t-xl">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-700">Filtres</span>
              <Info className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <span className="text-xs font-medium text-slate-500">{activeCount} actif(s)</span>
          </div>
        </div>

        <div className="max-h-[72vh] overflow-y-auto">
          {/* Section : Période */}
          <div className="px-4 py-3 border-b">
            <div className="flex items-center gap-2 mb-2.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Période</span>
            </div>
            <div className="flex justify-center mb-2">
              <RangeCalendar
                mode="range"
                locale={fr}
                weekStartsOn={1}
                selected={calRange}
                onSelect={setCalRange}
                numberOfMonths={1}
              />
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

          {/* Section : Sites */}
          <div className="px-4 py-3 border-b">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Sites</span>
              </div>
              <span className="text-[11px] font-medium text-slate-400">
                {siteSel.size === 0 ? 'Tous' : `${siteSel.size} sélectionné(s)`}
              </span>
            </div>
            <div className="relative mb-2">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input value={siteQuery} onChange={e => setSiteQuery(e.target.value)} placeholder="Rechercher un site..." className="h-8 pl-8 text-sm" />
            </div>
            <div className="max-h-44 overflow-y-auto space-y-0.5">
              <button type="button" onClick={allSites} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left ${siteSel.size === 0 ? 'bg-primary/5' : 'hover:bg-slate-50'}`}>
                <Checkbox checked={siteSel.size === 0} className="pointer-events-none" />
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span className={`text-[13px] ${siteSel.size === 0 ? 'text-primary font-medium' : 'text-slate-600'}`}>Tous les sites</span>
              </button>
              {filteredSites.map(s => {
                const checked = siteSel.has(s.id);
                return (
                  <button key={s.id} type="button" onClick={() => toggleSite(s.id)} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left ${checked ? 'bg-primary/5' : 'hover:bg-slate-50'}`}>
                    <Checkbox checked={checked} className="pointer-events-none" />
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className={`text-[13px] truncate ${checked ? 'text-primary font-medium' : 'text-slate-600'}`}>{s.name}</span>
                    {s.client_name && <span className="text-[10px] text-slate-400 truncate ml-auto">{s.client_name}</span>}
                  </button>
                );
              })}
              {filteredSites.length === 0 && <p className="text-xs text-muted-foreground py-2 text-center">Aucun site</p>}
            </div>
          </div>

          {/* Section : Types d'événements */}
          <div className="px-4 pt-3 pb-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Types de mains courantes</span>
              <span className="text-[11px] font-medium text-slate-400">{sel.size} sélectionné(s)</span>
            </div>
            <div className="relative mb-2">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher un type..." className="h-8 pl-8 pr-8 text-sm" />
              {query && <X className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer" onClick={() => setQuery('')} />}
            </div>
            <div className="flex gap-2 mb-2">
              <Button size="sm" variant="ghost" className="h-7 text-xs text-primary" onClick={selectAll}>Tout sélectionner</Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={clearAll} disabled={activeCount === 0}>Tout effacer</Button>
            </div>
          </div>

          <div className="px-2 pb-2 space-y-1">
            {EVENT_CATEGORIES.map((cat) => {
              const list = (EVENT_TYPES[cat.key] || []).filter(e =>
                !q || e.label.toLowerCase().includes(q) || cat.label.toLowerCase().includes(q)
              );
              if (q && list.length === 0) return null;
              const codes = EVENT_TYPES[cat.key].map(e => eventTypeCode(cat.key, e.key));
              const allSelected = codes.every(c => sel.has(c));
              const someSelected = counts[cat.key] > 0;
              const Icon = cat.icon;
              return (
                <div key={cat.key} className="rounded-lg">
                  <button type="button" onClick={() => toggleCategory(cat.key)} className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-slate-50 transition-colors ${allSelected ? 'bg-slate-50' : ''}`}>
                    <Checkbox checked={allSelected || (someSelected ? 'indeterminate' : false)} className="pointer-events-none" />
                    <span className={`p-1.5 rounded-md border ${cat.color}`}><Icon className="w-3.5 h-3.5" /></span>
                    <span className="text-sm font-medium text-slate-700 flex-1 text-left">{cat.label}</span>
                    <span className="text-[11px] font-medium text-slate-400">{counts[cat.key]}/{codes.length}</span>
                  </button>
                  <div className="pl-9 pt-0.5 pb-1.5 space-y-0.5">
                    {list.map(e => {
                      const code = eventTypeCode(cat.key, e.key);
                      const checked = sel.has(code);
                      return (
                        <button key={code} type="button" onClick={() => toggle(code)} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors ${checked ? 'bg-primary/5' : 'hover:bg-slate-50'}`}>
                          <Checkbox checked={checked} className="pointer-events-none" />
                          <span className={`text-[13px] ${checked ? 'text-primary font-medium' : 'text-slate-600'}`}>{e.label}</span>
                          {e.auto && <span className="ml-auto text-[9px] uppercase tracking-wide font-semibold text-slate-400 border border-slate-200 rounded px-1 py-0.5">Auto</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t bg-slate-50 rounded-b-xl">
          <span className="text-xs text-muted-foreground">{activeCount} filtre(s) actif(s)</span>
          <Button size="sm" className="h-8" onClick={() => setOpen(false)}>Appliquer</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}