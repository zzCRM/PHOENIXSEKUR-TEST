import React, { useMemo, useState } from 'react';
import { Filter, ChevronRight, ChevronDown, Check, X } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/**
 * Panneau de filtres latéral — Clients, Sites, Collaborateurs, Spécialités.
 * Reproduit le modèle du Screen 3 : 4 dropdowns multi-sélection + RÉINITIALISER / APPLIQUER.
 */
function MultiSelectDropdown({ label, placeholder, options, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const sel = selected || new Set();

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return options;
    return options.filter(o => (o.label || '').toLowerCase().includes(q));
  }, [options, query]);

  const toggle = (id) => {
    const next = new Set(sel);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange(next);
  };

  const summary = sel.size === 0 ? placeholder : `${sel.size} sélectionné(s)`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-600">{label}</label>
        <PopoverTrigger asChild>
          <button type="button" className="w-full flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left hover:border-slate-300 transition-colors">
            <span className={`text-sm truncate ${sel.size === 0 ? 'text-slate-400' : 'text-slate-700 font-medium'}`}>{summary}</span>
            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
          </button>
        </PopoverTrigger>
      </div>
      <PopoverContent align="start" className="w-[260px] p-0 rounded-xl shadow-xl">
        <div className="p-2 border-b">
          <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher..." className="h-8 text-sm" />
        </div>
        <div className="max-h-56 overflow-y-auto py-1">
          <button type="button" onClick={() => onChange(new Set())} className={`w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-50 ${sel.size === 0 ? 'bg-primary/5' : ''}`}>
            <Checkbox checked={sel.size === 0} className="pointer-events-none" />
            <span className={`text-[13px] ${sel.size === 0 ? 'text-primary font-medium' : 'text-slate-600'}`}>{placeholder}</span>
          </button>
          {filtered.map(o => {
            const checked = sel.has(o.id);
            return (
              <button key={o.id} type="button" onClick={() => toggle(o.id)} className={`w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-50 ${checked ? 'bg-primary/5' : ''}`}>
                <Checkbox checked={checked} className="pointer-events-none" />
                <span className={`text-[13px] truncate ${checked ? 'text-primary font-medium' : 'text-slate-600'}`}>{o.label}</span>
              </button>
            );
          })}
          {filtered.length === 0 && <p className="text-xs text-muted-foreground py-2 text-center">Aucun résultat</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function HeuresSitesFilter({ open, onOpenChange, filters, onApply, onReset,
  clients = [], sites = [], agents = [] }) {
  const sel = {
    clients: filters.clients || new Set(),
    sites: filters.sites || new Set(),
    agents: filters.agents || new Set(),
    specialites: filters.specialites || new Set(),
  };
  const [draft, setDraft] = useState(sel);

  React.useEffect(() => { if (open) setDraft(sel); /* eslint-disable-next-line */ }, [open]);

  const clientOptions = useMemo(() => clients.map(c => ({ id: c.id, label: c.company_name || c.contact_name || '—' })), [clients]);
  const siteOptions = useMemo(() => sites.map(s => ({ id: s.id, label: s.name })), [sites]);
  const agentOptions = useMemo(() => agents.map(a => ({ id: a.id, label: `${a.first_name || ''} ${a.last_name || ''}`.trim() || '—' })), [agents]);
  const specialiteOptions = useMemo(() => {
    const set = new Set();
    sites.forEach(s => (s.specialites || []).forEach(sp => set.add(sp.name)));
    return [...set].map(name => ({ id: name, label: name }));
  }, [sites]);

  const activeCount = draft.clients.size + draft.sites.size + draft.agents.size + draft.specialites.size;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[360px] p-0 flex flex-col">
        <SheetHeader className="px-5 pt-5 pb-4 border-b">
          <SheetTitle className="flex items-center gap-2 text-slate-600">
            <ChevronRight className="w-4 h-4" />
            <Filter className="w-4 h-4" />
            <span className="text-base font-semibold">Filtres</span>
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          <MultiSelectDropdown label="Clients" placeholder="Tous les clients" options={clientOptions} selected={draft.clients} onChange={v => setDraft(d => ({ ...d, clients: v }))} />
          <MultiSelectDropdown label="Sites" placeholder="Tous les sites" options={siteOptions} selected={draft.sites} onChange={v => setDraft(d => ({ ...d, sites: v }))} />
          <MultiSelectDropdown label="Collaborateurs" placeholder="Tous les collaborateurs" options={agentOptions} selected={draft.agents} onChange={v => setDraft(d => ({ ...d, agents: v }))} />
          <MultiSelectDropdown label="Spécialités" placeholder="Toutes les spécialités" options={specialiteOptions} selected={draft.specialites} onChange={v => setDraft(d => ({ ...d, specialites: v }))} />
        </div>

        <div className="px-5 py-4 border-t flex gap-3 bg-slate-50">
          <Button
            variant="outline"
            className="flex-1 border-red-800 text-red-800 hover:bg-red-50 hover:text-red-900"
            onClick={() => { onReset(); onApply(new Set(), new Set(), new Set(), new Set()); onOpenChange(false); }}
            disabled={activeCount === 0}
          >
            RÉINITIALISER
          </Button>
          <Button
            className="flex-1 bg-slate-600 hover:bg-slate-700"
            onClick={() => { onApply(draft.clients, draft.sites, draft.agents, draft.specialites); onOpenChange(false); }}
          >
            APPLIQUER
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}