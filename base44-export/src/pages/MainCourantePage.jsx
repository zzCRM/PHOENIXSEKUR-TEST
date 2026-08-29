import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Download, Search } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { exportMainCourantePdf } from '@/lib/mainCourantePdf';
import { useCompany } from '@/lib/useCompany';
import EventTypeFilter from '@/components/main-courante/EventTypeFilter';
import MainCouranteTable from '@/components/main-courante/MainCouranteTable';
import MainCouranteFormDialog from '@/components/main-courante/MainCouranteFormDialog';
import { normalizeEntry, synthesizeAutoEvents } from '@/lib/mainCouranteEvents';

export default function MainCourantePage() {
  const { companyId } = useCompany();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedSites, setSelectedSites] = useState(new Set());
  const [search, setSearch] = useState('');
  const [selectedCodes, setSelectedCodes] = useState(new Set());

  const { data: entries = [] } = useQuery({
    queryKey: ['main_courante', companyId],
    queryFn: () => base44.entities.MainCourante.filter({ company_id: companyId }, '-date', 1000),
    enabled: !!companyId,
  });
  const { data: prises = [] } = useQuery({
    queryKey: ['prises_service', companyId],
    queryFn: () => base44.entities.PriseDeService.filter({ company_id: companyId }, '-date', 1000),
    enabled: !!companyId,
  });
  const { data: rondeExecs = [] } = useQuery({
    queryKey: ['ronde_execs', companyId],
    queryFn: () => base44.entities.RondeExecution.filter({ company_id: companyId }, '-date', 1000),
    enabled: !!companyId,
  });
  const { data: sites = [] } = useQuery({ queryKey: ['sites', companyId], queryFn: () => base44.entities.Site.filter({ company_id: companyId }), enabled: !!companyId });
  const { data: agents = [] } = useQuery({ queryKey: ['agents', companyId], queryFn: () => base44.entities.Agent.filter({ company_id: companyId }), enabled: !!companyId });

  const agentsMap = useMemo(() => Object.fromEntries(agents.map(a => [a.id, a])), [agents]);

  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.MainCourante.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['main_courante'] }),
  });

  // Fusion entrées manuelles (persistées) + événements auto (synthétisés)
  const merged = useMemo(() => {
    const manual = entries.map(normalizeEntry);
    const auto = synthesizeAutoEvents({ prises, rondeExecs });
    return [...manual, ...auto];
  }, [entries, prises, rondeExecs]);

  // Filtrage
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return merged
      .filter(e => selectedSites.size === 0 || selectedSites.has(e.site_id))
      .filter(e => (!dateRange.start || (e.date || '') >= dateRange.start) && (!dateRange.end || (e.date || '') <= dateRange.end))
      .filter(e => selectedCodes.size === 0 || selectedCodes.has(e.code))
      .filter(e => !q ||
        (e.agent_name || '').toLowerCase().includes(q) ||
        (e.site_name || '').toLowerCase().includes(q) ||
        (e.client_name || '').toLowerCase().includes(q) ||
        (e.content || '').toLowerCase().includes(q) ||
        (e.event_label || '').toLowerCase().includes(q) ||
        (e.mission_id || '').toLowerCase().includes(q)
      )
      .sort((a, b) => {
        const da = `${a.date || ''} ${a.time || ''}`;
        const db = `${b.date || ''} ${b.time || ''}`;
        return db.localeCompare(da);
      });
  }, [merged, selectedSites, dateRange, selectedCodes, search]);

  const exportPDF = async () => {
    let firstClient = null;
    if (filtered[0]?.client_id) {
      try { firstClient = await base44.entities.Client.get(filtered[0].client_id); } catch { /* ignore */ }
    }
    await exportMainCourantePdf({
      entries: filtered,
      companyId,
      title: 'Main courante',
      subtitle: `Période : ${dateRange.start || '—'} → ${dateRange.end || '—'} — Sites : ${selectedSites.size === 0 ? 'Tous' : sites.filter((s) => selectedSites.has(s.id)).map((s) => s.name).join(', ')}`,
      filename: 'main-courante-export.pdf',
      client: firstClient,
    });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Main courante</h1>
          <p className="text-muted-foreground mt-1">Journal électronique des événements — alimentation automatique selon l'heure et le site</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportPDF} className="gap-2"><Download className="w-4 h-4" /> Export PDF</Button>
          <Button onClick={() => setShowForm(true)} className="gap-2"><Plus className="w-4 h-4" /> Ajouter</Button>
        </div>
      </div>

      {/* Toolbar */}
      <Card className="p-3">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <EventTypeFilter
            selected={selectedCodes} onChange={setSelectedCodes}
            dateRange={dateRange} onDateRangeChange={setDateRange}
            selectedSites={selectedSites} onSelectedSitesChange={setSelectedSites}
            sites={sites}
          />
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher collaborateur, site, contenu..." className="pl-9" />
          </div>
        </div>
      </Card>

      {/* Table */}
      <MainCouranteTable entries={filtered} agentsMap={agentsMap} onDelete={(id) => deleteMut.mutate(id)} />

      {/* Form dialog */}
      <MainCouranteFormDialog open={showForm} onOpenChange={setShowForm} sites={sites} agents={agents} />
    </div>
  );
}