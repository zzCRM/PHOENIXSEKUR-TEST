import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Filter, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import DateIntervalPicker from '@/components/shared/DateIntervalPicker';
import PageHeader from '@/components/shared/PageHeader';
import { useCompany } from '@/lib/useCompany';
import { computeAgentHours } from '@/lib/agentHoursCompute';

const COLS = [
  { key: 'count', label: 'Services', num: true },
  { key: 'total', label: 'Total h', num: true },
  { key: 'jour', label: 'Jour', num: true },
  { key: 'nuit', label: 'Nuit', num: true },
  { key: 'jour_ferie', label: 'Jour férié', num: true },
  { key: 'nuit_ferie', label: 'Nuit férié', num: true },
  { key: 'dimanche_jour', label: 'Dim. jour', num: true },
  { key: 'dimanche_nuit', label: 'Dim. nuit', num: true },
];

const PAGE_SIZE = 25;
const fmt = (n) => (Number.isFinite(n) ? Math.round(n * 10) / 10 : 0);

export default function HeuresCollaborateurs() {
  const { companyId } = useCompany();
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [agentsActifs, setAgentsActifs] = useState(true);
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

  const filteredMissions = useMemo(() => missions.filter((m) => {
    if (dateRange.start && (m.date || '') < dateRange.start) return false;
    if (dateRange.end && (m.date || '') > dateRange.end) return false;
    return true;
  }), [missions, dateRange]);

  const hoursByAgent = useMemo(
    () => computeAgentHours(filteredMissions),
    [filteredMissions],
  );

  const rows = useMemo(() => {
    let list = Object.values(hoursByAgent);
    if (agentsActifs) list = list.filter((r) => r.count > 0);
    list.sort((a, b) => (a.agent_name || '').localeCompare(b.agent_name || ''));
    return list;
  }, [hoursByAgent, agentsActifs]);

  const totals = useMemo(() => rows.reduce((acc, r) => {
    COLS.forEach((c) => { acc[c.key] = (acc[c.key] || 0) + (r[c.key] || 0); });
    return acc;
  }, {}), [rows]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const pageRows = rows.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Heures collaborateurs"
        subtitle="Ventilation des heures travaillées par agent (jour, nuit, férié, dimanche)"
      />

      <Card className="p-3">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
          <label className="flex items-center gap-2.5">
            <span className="text-sm font-medium">Agents avec services</span>
            <Switch checked={agentsActifs} onCheckedChange={setAgentsActifs} />
          </label>
          <DateIntervalPicker dateRange={dateRange} onDateRangeChange={(r) => { setDateRange(r); setPage(0); }} />
          <div className="text-sm text-muted-foreground lg:ml-auto">
            {rows.length} collaborateur(s) · {agents.length} fiche(s) agent
          </div>
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="text-left p-3 font-semibold sticky left-0 bg-muted/40">Collaborateur</th>
              {COLS.map((c) => (
                <th key={c.key} className="text-right p-3 font-semibold whitespace-nowrap">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={COLS.length + 1} className="p-12 text-center text-muted-foreground">
                  <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  Aucune heure sur la période sélectionnée
                </td>
              </tr>
            ) : pageRows.map((r) => (
              <tr key={r.agent_id} className="border-b hover:bg-muted/20">
                <td className="p-3 font-medium sticky left-0 bg-background">{r.agent_name || r.agent_id}</td>
                {COLS.map((c) => (
                  <td key={c.key} className="p-3 text-right tabular-nums">
                    {c.num ? fmt(r[c.key]) : r[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 bg-muted/30 font-semibold">
                <td className="p-3">Total</td>
                {COLS.map((c) => (
                  <td key={c.key} className="p-3 text-right tabular-nums">{fmt(totals[c.key])}</td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={currentPage === 0} onClick={() => setPage(0)}>
            <ChevronLeft className="w-4 h-4" /><ChevronLeft className="w-4 h-4 -ml-3" />
          </Button>
          <Button variant="outline" size="sm" disabled={currentPage === 0} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground px-2">{currentPage + 1} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={currentPage >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" disabled={currentPage >= totalPages - 1} onClick={() => setPage(totalPages - 1)}>
            <ChevronRight className="w-4 h-4" /><ChevronRight className="w-4 h-4 -ml-3" />
          </Button>
        </div>
      )}
    </div>
  );
}
