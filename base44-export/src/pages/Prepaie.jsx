import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Wallet, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import DateIntervalPicker from '@/components/shared/DateIntervalPicker';
import PageHeader from '@/components/shared/PageHeader';
import { useCompany } from '@/lib/useCompany';
import { computeAgentHours } from '@/lib/agentHoursCompute';
import { toast } from 'sonner';

const fmt = (n) => (Number.isFinite(n) ? Math.round(n * 100) / 100 : 0);
const PAGE_SIZE = 30;

export default function Prepaie() {
  const { companyId } = useCompany();
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [page, setPage] = useState(0);

  const { data: missions = [] } = useQuery({
    queryKey: ['missions', companyId],
    queryFn: () => base44.entities.Mission.filter({ company_id: companyId }, '-date', 5000),
    enabled: !!companyId,
  });
  const { data: agents = [] } = useQuery({
    queryKey: ['agents', companyId],
    queryFn: () => base44.entities.Agent.filter({ company_id: companyId }),
    enabled: !!companyId,
  });
  const { data: services = [] } = useQuery({
    queryKey: ['prises_service', companyId],
    queryFn: () => base44.entities.PriseDeService.filter({ company_id: companyId }, '-date', 5000),
    enabled: !!companyId,
  });

  const agentsMap = useMemo(
    () => Object.fromEntries(agents.map((a) => [a.id, a])),
    [agents],
  );

  const filteredMissions = useMemo(() => missions.filter((m) => {
    if (m.status === 'annulee') return false;
    if (dateRange.start && (m.date || '') < dateRange.start) return false;
    if (dateRange.end && (m.date || '') > dateRange.end) return false;
    return true;
  }), [missions, dateRange]);

  const hoursByAgent = useMemo(
    () => computeAgentHours(filteredMissions),
    [filteredMissions],
  );

  const rows = useMemo(() => {
    return Object.values(hoursByAgent).map((h) => {
      const agent = agentsMap[h.agent_id] || {};
      const rate = Number(agent.hourly_rate) || 0;
      const nightCoef = 1.25;
      const sundayCoef = 1.5;
      const ferieCoef = 2;

      const base = (h.jour || 0) * rate;
      const night = (h.nuit || 0) * rate * nightCoef;
      const sunday = ((h.dimanche_jour || 0) + (h.dimanche_nuit || 0)) * rate * sundayCoef;
      const ferie = ((h.jour_ferie || 0) + (h.nuit_ferie || 0)
        + (h.dimanche_jour_ferie || 0) + (h.dimanche_nuit_ferie || 0)) * rate * ferieCoef;

      // Éviter double comptage dimanche/férié déjà dans buckets spécifiques
      const estimated = base + night
        + ((h.dimanche_jour || 0) * rate * (sundayCoef - 1))
        + ((h.dimanche_nuit || 0) * rate * (sundayCoef - nightCoef))
        + ((h.jour_ferie || 0) * rate * (ferieCoef - 1))
        + ((h.nuit_ferie || 0) * rate * (ferieCoef - nightCoef));

      const pointed = services.filter((s) => {
        if (s.agent_id !== h.agent_id) return false;
        if (dateRange.start && (s.date || '') < dateRange.start) return false;
        if (dateRange.end && (s.date || '') > dateRange.end) return false;
        return s.status === 'termine' || s.status === 'en_service';
      }).length;

      return {
        ...h,
        agent_name: h.agent_name || `${agent.first_name || ''} ${agent.last_name || ''}`.trim() || h.agent_id,
        hourly_rate: rate,
        estimated_gross: Math.max(0, estimated),
        pointed_services: pointed,
        email: agent.email || '',
      };
    }).sort((a, b) => a.agent_name.localeCompare(b.agent_name));
  }, [hoursByAgent, agentsMap, services, dateRange]);

  const totals = useMemo(() => rows.reduce((acc, r) => {
    acc.total += r.total || 0;
    acc.gross += r.estimated_gross || 0;
    return acc;
  }, { total: 0, gross: 0 }), [rows]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const exportCsv = () => {
    if (!rows.length) {
      toast.error('Aucune donnée à exporter');
      return;
    }
    const header = [
      'Collaborateur', 'Email', 'Services', 'Heures total', 'Heures jour', 'Heures nuit',
      'Dimanche', 'Férié', 'Taux horaire', 'Estimation brute (€)', 'Pointages',
    ];
    const lines = rows.map((r) => [
      r.agent_name,
      r.email,
      r.count,
      fmt(r.total),
      fmt(r.jour),
      fmt(r.nuit),
      fmt((r.dimanche_jour || 0) + (r.dimanche_nuit || 0)),
      fmt((r.jour_ferie || 0) + (r.nuit_ferie || 0)),
      fmt(r.hourly_rate),
      fmt(r.estimated_gross),
      r.pointed_services,
    ].join(';'));
    const bom = '\uFEFF';
    const blob = new Blob([bom + header.join(';') + '\n' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prepaie-${dateRange.start || 'debut'}-${dateRange.end || 'fin'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Export CSV téléchargé');
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Prépaie"
        subtitle="Éléments variables de paie à partir du planning — export CSV pour votre logiciel de paie"
      />

      <Card className="p-3">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
          <DateIntervalPicker dateRange={dateRange} onDateRangeChange={(r) => { setDateRange(r); setPage(0); }} />
          <Button className="gap-2 lg:ml-auto" onClick={exportCsv}>
            <Download className="w-4 h-4" /> Exporter CSV paie
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Coefficients indicatifs : nuit ×1,25 · dimanche ×1,5 · férié ×2 — ajustez dans votre logiciel de paie.
          Renseignez le taux horaire sur chaque fiche collaborateur.
        </p>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Collaborateurs</p>
          <p className="text-2xl font-bold">{rows.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Heures totales</p>
          <p className="text-2xl font-bold">{fmt(totals.total)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Estimation brute</p>
          <p className="text-2xl font-bold">{fmt(totals.gross)} €</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Sans taux horaire</p>
          <p className="text-2xl font-bold">{rows.filter((r) => !r.hourly_rate).length}</p>
        </Card>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="text-left p-3">Collaborateur</th>
              <th className="text-right p-3">Services</th>
              <th className="text-right p-3">H. total</th>
              <th className="text-right p-3">Jour</th>
              <th className="text-right p-3">Nuit</th>
              <th className="text-right p-3">Taux €</th>
              <th className="text-right p-3">Est. brute €</th>
              <th className="text-right p-3">Pointages</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-12 text-center text-muted-foreground">
                  <Wallet className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  Aucune heure sur la période — sélectionnez des dates avec du planning
                </td>
              </tr>
            ) : pageRows.map((r) => (
              <tr key={r.agent_id} className="border-b hover:bg-muted/20">
                <td className="p-3 font-medium">
                  {r.agent_name}
                  {!r.hourly_rate && (
                    <span className="ml-2 text-xs text-amber-600">taux manquant</span>
                  )}
                </td>
                <td className="p-3 text-right tabular-nums">{r.count}</td>
                <td className="p-3 text-right tabular-nums">{fmt(r.total)}</td>
                <td className="p-3 text-right tabular-nums">{fmt(r.jour)}</td>
                <td className="p-3 text-right tabular-nums">{fmt(r.nuit)}</td>
                <td className="p-3 text-right tabular-nums">{fmt(r.hourly_rate)}</td>
                <td className="p-3 text-right tabular-nums font-semibold">{fmt(r.estimated_gross)}</td>
                <td className="p-3 text-right tabular-nums">{r.pointed_services}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground">{page + 1} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
