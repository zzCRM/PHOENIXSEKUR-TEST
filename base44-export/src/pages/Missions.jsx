import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import AjoutServiceModal from '@/components/planning/AjoutServiceModal';
import MissionsToolbar from '@/components/missions/MissionsToolbar';
import MissionsTable from '@/components/missions/MissionsTable';
import MissionsGrid from '@/components/missions/MissionsGrid';
import MissionsSettingsDialog from '@/components/missions/MissionsSettingsDialog';
import { exportMissionsCsv, exportMissionsPdf } from '@/lib/missionsExport';
import { useCompany } from '@/lib/useCompany';
import { toast } from 'sonner';

const DEFAULT_COLUMNS = [
  { key: 'date_start', label: 'Date de début', visible: true },
  { key: 'site_client', label: 'Site & client', visible: true },
  { key: 'site_address', label: 'Adresse du site', visible: true },
  { key: 'agent', label: 'Collaborateur', visible: true },
  { key: 'agent_phone', label: 'Téléphone du collaborateur', visible: false },
  { key: 'specialite', label: 'Spécialité', visible: true },
  { key: 'date_end', label: 'Date de fin', visible: false },
  { key: 'poste_title', label: 'Intitulé du poste', visible: true },
  { key: 'status', label: 'Statut', visible: true },
  { key: 'duration', label: 'Durée', visible: true },
  { key: 'errors', label: 'Erreurs', visible: false },
  { key: 'pauses_detail', label: 'Détail des pauses', visible: false },
  { key: 'retards', label: 'Retards et départs', visible: false },
  { key: 'pauses_total', label: 'Durée totale des pauses', visible: false },
  { key: 'deference', label: 'Déférence', visible: false },
];

export default function Missions() {
  const { companyId } = useCompany();
  const [showForm, setShowForm] = useState(false);
  const [editMission, setEditMission] = useState(null);
  const [viewMode, setViewMode] = useState('table');
  const [selected, setSelected] = useState({});
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [filters, setFilters] = useState({ clientIds: [], statuses: [], types: [], agentIds: [], dateFin: [] });
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: missions = [], isLoading } = useQuery({ queryKey: ['missions', companyId], queryFn: () => base44.entities.Mission.filter({ company_id: companyId }, '-date', 800), enabled: !!companyId });
  const { data: agents = [] } = useQuery({ queryKey: ['agents', companyId], queryFn: () => base44.entities.Agent.filter({ company_id: companyId }), enabled: !!companyId });
  const { data: sites = [] } = useQuery({ queryKey: ['sites', companyId], queryFn: () => base44.entities.Site.filter({ company_id: companyId }), enabled: !!companyId });
  const { data: clients = [] } = useQuery({ queryKey: ['clients', companyId], queryFn: () => base44.entities.Client.filter({ company_id: companyId }), enabled: !!companyId });

  const createMut = useMutation({
    mutationFn: (data) => base44.entities.Mission.create({ ...data, company_id: companyId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['missions', companyId] }); setShowForm(false); toast.success('Mission créée avec succès'); },
    onError: (error) => { toast.error('Échec de la création : ' + (error.message || 'Erreur inconnue')); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Mission.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['missions', companyId] }); setEditMission(null); toast.success('Mission modifiée avec succès'); },
    onError: (error) => { toast.error('Échec de la modification : ' + (error.message || 'Erreur inconnue')); },
  });
  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.Mission.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['missions', companyId] }); toast.success('Mission supprimée avec succès'); },
    onError: (error) => { toast.error('Échec de la suppression : ' + (error.message || 'Erreur inconnue')); },
  });

  const inRange = (d) => {
    if (!d) return true;
    const day = d.split('T')[0];
    if (dateRange.start && day < dateRange.start) return false;
    if (dateRange.end && day > dateRange.end) return false;
    return true;
  };
  const dateFinMatch = (m) => {
    const df = filters.dateFin || [];
    if (df.length === 0) return true;
    const today = format(new Date(), 'yyyy-MM-dd');
    if (df.includes('overdue')) return m.date && m.date < today && m.status !== 'terminee';
    return true; // today/week/month shortcuts handled by dateRange primarily
  };
  const filtered = useMemo(() => missions.filter(m => inRange(m.date) && dateFinMatch(m))
    .filter(m => (filters.clientIds || []).length === 0 || (filters.clientIds || []).includes(m.client_id))
    .filter(m => (filters.statuses || []).length === 0 || (filters.statuses || []).includes(m.status))
    .filter(m => (filters.types || []).length === 0 || (filters.types || []).includes(m.type))
    .filter(m => (filters.agentIds || []).length === 0 || (filters.agentIds || []).includes(m.agent_id)),
    [missions, filters, dateRange]);

  const selectedIds = Object.keys(selected).filter(k => selected[k]);
  const allSelected = filtered.length > 0 && filtered.every(m => selected[m.id]);
  const toggleRow = (id) => setSelected(s => ({ ...s, [id]: !s[id] }));
  const toggleAll = () => setSelected(s => {
    const next = { ...s };
    const on = !allSelected;
    filtered.forEach(m => { next[m.id] = on; });
    return next;
  });

  const bulkAction = async (action) => {
    const rows = filtered.filter(m => selected[m.id]);
    if (action === 'select_all') { toggleAll(); return; }
    if (rows.length === 0) { toast.error('Aucune ligne sélectionnée'); return; }
    for (const m of rows) { await handleAction(action, m); }
    setSelected({});
  };

  const hoursBetween = (s, e) => {
    if (!s || !e) return 0;
    const [h1, m1] = s.split(':').map(Number);
    const [h2, m2] = e.split(':').map(Number);
    let d = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (d < 0) d += 1440;
    return d / 60;
  };

  const generateDoc = async (mission, prefix, label) => {
    const hours = hoursBetween(mission.start_time, mission.end_time);
    const client = clients.find(c => c.id === mission.client_id);
    const rate = client?.tarification?.taux_horaire_base || 0;
    const ht = +(hours * rate).toFixed(2);
    await base44.entities.Invoice.create({
      invoice_number: `${prefix}-${Date.now()}`,
      client_id: mission.client_id, client_name: mission.client_name,
      date: mission.date ? mission.date.split('T')[0] : format(new Date(), 'yyyy-MM-dd'),
      items: [{ description: `${mission.title || 'Service'} — ${mission.site_name || ''} (${mission.start_time || ''}-${mission.end_time || ''})`, quantity: +hours.toFixed(2), unit_price: rate, total: ht }],
      total_ht: ht, tva_rate: 20, total_tva: +(ht * 0.2).toFixed(2), total_ttc: +(ht * 1.2).toFixed(2),
      status: 'brouillon',
      notes: `${label} issu de la mission`,
    });
    toast.success(`${label} généré`);
    qc.invalidateQueries({ queryKey: ['invoices'] });
  };

  const handleAction = async (action, mission) => {
    try {
      switch (action) {
        case 'voir':
        case 'modifier':
          setEditMission(mission); break;
        case 'mains_courantes':
          navigate('/main-courante'); break;
        case 'deplanifier':
          await base44.entities.Mission.update(mission.id, { status: 'annulee' });
          toast.success('Service déplanifié'); break;
        case 'non_realise':
          await base44.entities.Mission.update(mission.id, { status: 'non_realise' });
          toast.success('Marqué non réalisé'); break;
        case 'deprogrammer':
          deleteMut.mutate(mission.id); return;
        case 'desaffecter':
          await base44.entities.Mission.update(mission.id, { agent_id: null, agent_name: null });
          toast.success('Collaborateur(s) désaffecté(s)'); break;
        case 'facture':
          await base44.entities.Mission.update(mission.id, { facturation_statut: 'facture' });
          toast.success('Marqué facturé'); break;
        case 'hors_facturation':
          await base44.entities.Mission.update(mission.id, { facturation_statut: 'hors_facturation' });
          toast.success('Marqué hors facturation'); break;
        case 'devis':
          await generateDoc(mission, 'DEV', 'Devis'); navigate('/facturation'); return;
        case 'facture_gen':
          await generateDoc(mission, 'FAC', 'Facture'); navigate('/facturation'); return;
        case 'bon_commande':
          await generateDoc(mission, 'BC', 'Bon de commande'); navigate('/facturation'); return;
        case 'supprimer':
          deleteMut.mutate(mission.id); return;
      }
      qc.invalidateQueries({ queryKey: ['missions', companyId] });
    } catch (e) {
      toast.error('Échec : ' + (e.message || ''));
    }
  };

  return (
    <div>
      <PageHeader title="Missions" subtitle={`${filtered.length} mission(s)`} actionLabel="Nouvelle mission" onAction={() => setShowForm(true)} />

      <MissionsToolbar
        selectedCount={selectedIds.length}
        onBulkAction={bulkAction}
        dateRange={dateRange} setDateRange={setDateRange}
        filters={filters} setFilters={setFilters}
        clients={clients} agents={agents}
        viewMode={viewMode} setViewMode={setViewMode}
        onExportCsv={() => exportMissionsCsv(filtered, sites)}
        onExportPdf={() => exportMissionsPdf(filtered, sites)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {filtered.length === 0 && !isLoading ? (
        <EmptyState icon={Shield} title="Aucune mission" description="Créez votre première mission ou ajustez vos filtres." actionLabel="Nouvelle mission" onAction={() => setShowForm(true)} />
      ) : viewMode === 'grid' ? (
        <MissionsGrid missions={filtered} sites={sites} selected={selected} onToggleRow={toggleRow} onAction={handleAction} />
      ) : (
        <MissionsTable
          missions={filtered}
          sites={sites}
          columns={columns}
          allSelected={allSelected}
          onToggleAll={toggleAll}
          selected={selected}
          onToggleRow={toggleRow}
          onAction={handleAction}
          pageSize={pageSize}
          page={page}
          onPageChange={setPage}
        />
      )}

      <MissionsSettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        columns={columns}
        onColumnsChange={setColumns}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
      />

      <AjoutServiceModal
        open={showForm || !!editMission}
        onClose={() => { setShowForm(false); setEditMission(null); }}
        editMission={editMission}
      />
    </div>
  );
}