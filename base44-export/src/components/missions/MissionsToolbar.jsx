import React, { useState } from 'react';
import { SlidersHorizontal, CalendarRange, AlertCircle, ChevronDown, LayoutGrid, List, Settings, Download, Trash2, XCircle, CalendarX, Receipt, Ban, CheckCheck, FileText, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuSeparator, DropdownMenuCheckboxItem, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';

const statusOptions = [
  { value: 'planifiee', label: 'Planifié' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'terminee', label: 'Terminé' },
  { value: 'non_realise', label: 'Non réalisé' },
  { value: 'annulee', label: 'Non planifié' },
];
const typeOptions = [
  { value: 'gardiennage', label: 'Gardiennage & Surveillance' },
  { value: 'surveillance', label: 'Surveillance' },
  { value: 'intervention', label: 'Intervention' },
  { value: 'ronde', label: 'Ronde' },
  { value: 'evenementiel', label: 'Événementiel' },
];

function SubFilter({ label, options, selected, onToggle, icon: Icon }) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="gap-2">
        {Icon && <Icon className="w-4 h-4" />}
        <span className="flex-1">{label}</span>
        {selected.length > 0 && <Badge variant="secondary" className="ml-auto h-5 px-1.5 text-xs">{selected.length}</Badge>}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-56 max-h-72 overflow-y-auto">
        {options.length === 0 && <div className="px-2 py-3 text-xs text-muted-foreground">Aucune option</div>}
        {options.map(opt => (
          <DropdownMenuCheckboxItem key={opt.value} checked={selected.includes(opt.value)} onCheckedChange={() => onToggle(opt.value)}>
            {opt.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

const toStr = (d) => (d ? format(d, 'yyyy-MM-dd') : '');
const fmt = (d) => (d ? format(new Date(d), 'dd MMM yyyy', { locale: fr }) : '');

export default function MissionsToolbar({
  selectedCount = 0,
  onBulkAction,
  dateRange, setDateRange,
  filters, setFilters,
  clients = [], agents = [],
  viewMode, setViewMode, onExportCsv, onExportPdf, onOpenSettings,
}) {
  const [rangeOpen, setRangeOpen] = useState(false);
  const [calRange, setCalRange] = useState({ from: undefined, to: undefined });

  const activeFilterCount =
    (filters.clientIds?.length || 0) +
    (filters.statuses?.length || 0) +
    (filters.types?.length || 0) +
    (filters.agentIds?.length || 0) +
    (dateRange.start || dateRange.end ? 1 : 0);

  const toggle = (key, value) => setFilters(f => {
    const arr = f[key] || [];
    return { ...f, [key]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value] };
  });

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
    setDateRange({ start: toStr(calRange.from), end: toStr(calRange.to) });
    setRangeOpen(false);
  };
  const resetRange = () => {
    setCalRange({ from: undefined, to: undefined });
    setDateRange({ start: '', end: '' });
    setRangeOpen(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4 p-3 bg-muted/40 rounded-xl border">
      {/* ACTIONS dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="default" className="bg-zinc-700 hover:bg-zinc-800 text-white gap-2">
            ACTIONS
            {selectedCount > 0 && <Badge className="bg-white/20 text-white ml-1 h-5 px-1.5">{selectedCount}</Badge>}
            <ChevronDown className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            {selectedCount > 0 ? `${selectedCount} ligne(s) sélectionnée(s)` : 'Sélectionnez des lignes'}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={!selectedCount} onClick={() => onBulkAction('deplanifier')}><CalendarX className="w-4 h-4 mr-2" />Déplanifier</DropdownMenuItem>
          <DropdownMenuItem disabled={!selectedCount} onClick={() => onBulkAction('non_realise')}><XCircle className="w-4 h-4 mr-2" />Marquer non réalisé</DropdownMenuItem>
          <DropdownMenuItem disabled={!selectedCount} onClick={() => onBulkAction('facture')}><Receipt className="w-4 h-4 mr-2" />Marquer facturé</DropdownMenuItem>
          <DropdownMenuItem disabled={!selectedCount} onClick={() => onBulkAction('hors_facturation')}><Ban className="w-4 h-4 mr-2" />Hors facturation</DropdownMenuItem>
          <DropdownMenuItem disabled={!selectedCount} onClick={() => onBulkAction('select_all')}><CheckCheck className="w-4 h-4 mr-2" />Tout sélectionner</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={!selectedCount} className="text-destructive" onClick={() => onBulkAction('supprimer')}><Trash2 className="w-4 h-4 mr-2" />Supprimer</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button variant="outline" size="icon" className="h-9 w-9 rounded-full" title="Alertes">
        <AlertCircle className="w-4 h-4 text-amber-500" />
      </Button>

      {/* Intervale (date range) - clean calendar picker */}
      <Popover open={rangeOpen} onOpenChange={setRangeOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="gap-2 h-9">
            <CalendarRange className="w-4 h-4" />
            <span className="text-muted-foreground text-xs">Intervale</span>
            <span className="text-sm font-medium">
              {(dateRange.start || dateRange.end) ? `${fmt(dateRange.start)}${dateRange.end ? ' - ' + fmt(dateRange.end) : ''}` : 'Sélectionner'}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-3 space-y-3">
            <Calendar
              mode="range"
              locale={fr}
              weekStartsOn={1}
              selected={calRange}
              onSelect={setCalRange}
              numberOfMonths={1}
            />
            <div className="flex flex-wrap gap-1.5 px-1">
              {[{ k: 'today', l: "Aujourd'hui" }, { k: 'week', l: 'Cette semaine' }, { k: 'month', l: 'Ce mois-ci' }, { k: '7d', l: '7 derniers j.' }, { k: '30d', l: '30 derniers j.' }].map(p => (
                <button key={p.k} onClick={() => applyPreset(p.k)} className="text-xs px-2.5 py-1 rounded-md border bg-card hover:bg-accent transition-colors">{p.l}</button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 px-1">
              <div className="rounded-lg border bg-card px-3 py-2">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Début</div>
                <div className="text-sm font-medium">{calRange.from ? format(calRange.from, 'dd MMM yyyy', { locale: fr }) : '—'}</div>
              </div>
              <div className="rounded-lg border bg-card px-3 py-2">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Fin</div>
                <div className="text-sm font-medium">{calRange.to ? format(calRange.to, 'dd MMM yyyy', { locale: fr }) : '—'}</div>
              </div>
            </div>
            <div className="flex justify-between items-center px-1">
              <Button variant="ghost" size="sm" onClick={resetRange}>Réinitialiser</Button>
              <Button size="sm" onClick={applyRange}>Appliquer</Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* FILTRES with submenus */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="default" className="bg-zinc-700 hover:bg-zinc-800 text-white gap-2">
            <SlidersHorizontal className="w-4 h-4" />
            FILTRES
            {activeFilterCount > 0 && <Badge className="bg-white/20 text-white h-5 px-1.5">{activeFilterCount}</Badge>}
            <ChevronDown className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel className="text-xs text-muted-foreground">Affiner la liste</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <SubFilter label="Site clients" icon={List} options={clients.map(c => ({ value: c.id, label: c.company_name }))} selected={filters.clientIds || []} onToggle={v => toggle('clientIds', v)} />
          <SubFilter label="Date de fin" icon={CalendarRange} options={[{ value: 'today', label: "Aujourd'hui" }, { value: 'week', label: 'Cette semaine' }, { value: 'month', label: 'Ce mois-ci' }, { value: 'overdue', label: 'En retard' }]} selected={filters.dateFin || []} onToggle={v => toggle('dateFin', v)} />
          <SubFilter label="Statut" icon={AlertCircle} options={statusOptions} selected={filters.statuses || []} onToggle={v => toggle('statuses', v)} />
          <SubFilter label="Spécialité" icon={LayoutGrid} options={typeOptions} selected={filters.types || []} onToggle={v => toggle('types', v)} />
          <SubFilter label="Collaborateur" icon={List} options={agents.map(a => ({ value: a.id, label: `${a.first_name} ${a.last_name}` }))} selected={filters.agentIds || []} onToggle={v => toggle('agentIds', v)} />
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => { setFilters({}); setDateRange({ start: '', end: '' }); }}>
            <Ban className="w-4 h-4 mr-2" />Réinitialiser les filtres
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="ml-auto flex items-center gap-2">
        <div className="flex rounded-lg border overflow-hidden">
          <Button size="icon" variant={viewMode === 'table' ? 'default' : 'ghost'} className={`h-9 w-9 rounded-none ${viewMode === 'table' ? 'bg-primary text-primary-foreground' : ''}`} onClick={() => setViewMode('table')} title="Vue tableau">
            <List className="w-4 h-4" />
          </Button>
          <Button size="icon" variant={viewMode === 'grid' ? 'default' : 'ghost'} className={`h-9 w-9 rounded-none ${viewMode === 'grid' ? 'bg-primary text-primary-foreground' : ''}`} onClick={() => setViewMode('grid')} title="Vue grille">
            <LayoutGrid className="w-4 h-4" />
          </Button>
        </div>
        <Button size="icon" variant="outline" className="h-9 w-9" onClick={onOpenSettings} title="Paramètres"><Settings className="w-4 h-4" /></Button>
        {/* Download dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="outline" className="h-9 w-9" title="Télécharger"><Download className="w-4 h-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="text-xs text-muted-foreground">Exporter</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onExportPdf}><FileText className="w-4 h-4 mr-2" />Télécharger en PDF</DropdownMenuItem>
            <DropdownMenuItem onClick={onExportCsv}><FileSpreadsheet className="w-4 h-4 mr-2" />Télécharger en CSV</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}