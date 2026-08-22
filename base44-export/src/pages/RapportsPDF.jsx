import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { FileText, Download, Calendar, Mail, Settings, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import PageHeader from '@/components/shared/PageHeader';
import { useCompany } from '@/lib/useCompany';
import { toast } from 'sonner';
import { format, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { drawEntityHeader, drawLegalFooter } from '@/lib/pdfClientHeader';

const MODULES = [
  { key: 'main_courante', label: 'Main courante', icon: '📋', description: 'Événements, observations, incidents' },
  { key: 'rondes', label: 'Rondes', icon: '🔄', description: 'Exécutions, checkpoints, anomalies' },
  { key: 'incidents', label: 'Incidents', icon: '⚠️', description: 'Alertes urgentes, PTI, géofencing' },
  { key: 'planning', label: 'Planning', icon: '📅', description: 'Missions planifiées, présences' },
  { key: 'agents', label: 'Agents', icon: '👤', description: 'Liste des agents en service' },
];

const PERIODS = [
  { key: 'today', label: "Aujourd'hui" },
  { key: 'week', label: '7 derniers jours' },
  { key: 'month', label: '30 derniers jours' },
  { key: 'custom', label: 'Période personnalisée' },
];

export default function RapportsPDF() {
  const { companyId } = useCompany();
  const [selectedModules, setSelectedModules] = useState({ main_courante: true, rondes: true, incidents: true, planning: false, agents: false });
  const [period, setPeriod] = useState('week');
  const [dateStart, setDateStart] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [dateEnd, setDateEnd] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedClient, setSelectedClient] = useState('all');
  const [sendEmail, setSendEmail] = useState(false);
  const [emailClient, setEmailClient] = useState('');
  const [emailSociete, setEmailSociete] = useState('');
  const [autoSchedule, setAutoSchedule] = useState(false);
  const [scheduleFreq, setScheduleFreq] = useState('weekly');
  const [generating, setGenerating] = useState(false);
  const [lastGenerated, setLastGenerated] = useState(null);

  const { data: clients = [] } = useQuery({
    queryKey: ['clients', companyId],
    queryFn: () => base44.entities.Client.filter({ company_id: companyId }),
    enabled: !!companyId,
  });
  const { data: settings = [] } = useQuery({
    queryKey: ['settings', companyId],
    queryFn: () => base44.entities.CompanySettings.filter({ company_id: companyId }),
    enabled: !!companyId,
  });
  const companyEmail = settings[0]?.email || '';

  const getPeriodDates = () => {
    const today = new Date();
    if (period === 'today') return { start: format(today, 'yyyy-MM-dd'), end: format(today, 'yyyy-MM-dd') };
    if (period === 'week') return { start: format(subDays(today, 7), 'yyyy-MM-dd'), end: format(today, 'yyyy-MM-dd') };
    if (period === 'month') return { start: format(subDays(today, 30), 'yyyy-MM-dd'), end: format(today, 'yyyy-MM-dd') };
    return { start: dateStart, end: dateEnd };
  };

  const toggleModule = (key) => setSelectedModules(prev => ({ ...prev, [key]: !prev[key] }));

  const handleGenerate = async () => {
    const activeModules = Object.keys(selectedModules).filter(k => selectedModules[k]);
    if (activeModules.length === 0) { toast.error('Sélectionnez au moins un module'); return; }

    setGenerating(true);
    try {
      const { start, end } = getPeriodDates();
      const client = clients.find(c => c.id === selectedClient);

      // Fetch data for each selected module
      const data = {};

      if (selectedModules.rondes) {
        const executions = await base44.entities.RondeExecution.filter({ company_id: companyId });
        data.rondes = executions.filter(e => e.date >= start && e.date <= end && (selectedClient === 'all' || e.client_id === selectedClient));
      }
      if (selectedModules.main_courante) {
        const mc = await base44.entities.MainCourante.filter({ company_id: companyId });
        data.main_courante = mc.filter(e => e.date >= start && e.date <= end && (selectedClient === 'all' || e.client_id === selectedClient));
      }
      if (selectedModules.incidents) {
        const alerts = await base44.entities.Alerte.filter({ company_id: companyId });
        data.incidents = alerts.filter(e => e.date >= start && e.date <= end && (e.severity === 'urgent' || e.type === 'pti_alerte' || e.type === 'incident'));
      }
      if (selectedModules.planning) {
        const missions = await base44.entities.Mission.filter({ company_id: companyId });
        data.planning = missions.filter(e => e.date >= start && e.date <= end && (selectedClient === 'all' || e.client_id === selectedClient));
      }

      // Generate PDF via LLM-assisted content
      const reportContent = await base44.integrations.Core.InvokeLLM({
        prompt: `Génère un rapport de sécurité professionnel en français pour la période du ${start} au ${end}.
Société: ${settings[0]?.company_name || 'Non définie'}
Client: ${client?.company_name || 'Tous les clients'}
Modules inclus: ${activeModules.join(', ')}

Données:
- Rondes: ${data.rondes?.length || 0} exécutions
- Main courante: ${data.main_courante?.length || 0} entrées
- Incidents: ${data.incidents?.length || 0} alertes urgentes
- Missions: ${data.planning?.length || 0} missions

Détail des rondes: ${JSON.stringify((data.rondes || []).slice(0, 5))}
Détail main courante: ${JSON.stringify((data.main_courante || []).slice(0, 5))}
Incidents: ${JSON.stringify((data.incidents || []).slice(0, 5))}

Génère un rapport structuré avec: résumé exécutif, statistiques clés, détail par module, conclusion.`,
      });

      // Build PDF using jsPDF
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const margin = 15;
      let y = margin;

      // Header
      doc.setFillColor(30, 40, 60);
      doc.rect(0, 0, pageW, 30, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('RAPPORT DE SÉCURITÉ', margin, 13);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Période : ${start} → ${end}`, margin, 21);
      doc.text(`Généré le : ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, pageW - margin - 50, 21);
      y = 38;

      // En-tête client : logo + adresse + email + tél
      y = await drawEntityHeader(doc, client, { x: margin, y, pageW, maxLogoH: 14 });
      y += 4;

      // Stats row
      const stats = [
        { label: 'Rondes', value: data.rondes?.length || 0, color: [99, 102, 241] },
        { label: 'Main courante', value: data.main_courante?.length || 0, color: [34, 197, 94] },
        { label: 'Incidents', value: data.incidents?.length || 0, color: [239, 68, 68] },
        { label: 'Missions', value: data.planning?.length || 0, color: [59, 130, 246] },
      ];
      const boxW = (pageW - margin * 2 - 9) / 4;
      stats.forEach((s, i) => {
        const x = margin + i * (boxW + 3);
        doc.setFillColor(...s.color);
        doc.roundedRect(x, y, boxW, 18, 2, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(String(s.value), x + boxW / 2, y + 10, { align: 'center' });
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.text(s.label, x + boxW / 2, y + 15, { align: 'center' });
      });
      y += 26;

      // Report content
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(reportContent, pageW - margin * 2);
      lines.forEach(line => {
        if (y > 270) { doc.addPage(); y = margin; }
        doc.text(line, margin, y);
        y += 5;
      });

      // Details sections
      if (data.rondes?.length > 0) {
        if (y > 240) { doc.addPage(); y = margin; }
        y += 4;
        doc.setFillColor(99, 102, 241);
        doc.rect(margin, y, pageW - margin * 2, 7, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('DÉTAIL DES RONDES', margin + 3, y + 5);
        y += 10;
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        data.rondes.slice(0, 15).forEach(r => {
          if (y > 270) { doc.addPage(); y = margin; }
          const pts = (r.checkpoints_done || []).length;
          doc.text(`• ${r.date} | ${r.agent_name || '-'} | ${r.ronde_name || '-'} | ${pts} pts | ${r.status}`, margin + 2, y);
          y += 5;
        });
      }

      if (data.main_courante?.length > 0) {
        if (y > 240) { doc.addPage(); y = margin; }
        y += 4;
        doc.setFillColor(34, 197, 94);
        doc.rect(margin, y, pageW - margin * 2, 7, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('MAIN COURANTE', margin + 3, y + 5);
        y += 10;
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        data.main_courante.slice(0, 15).forEach(mc => {
          if (y > 270) { doc.addPage(); y = margin; }
          const txt = `• ${mc.date} ${mc.time || ''} | ${mc.type} | ${(mc.content || '').substring(0, 60)}`;
          doc.text(doc.splitTextToSize(txt, pageW - margin * 2 - 4), margin + 2, y);
          y += 5;
        });
      }

      // Footer on each page
      const totalPages = doc.internal.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFillColor(245, 247, 250);
        doc.rect(0, 285, pageW, 12, 'F');
        doc.setFontSize(7);
        doc.setTextColor(120, 120, 120);
        doc.setFont('helvetica', 'normal');
        doc.text(`${settings[0]?.company_name || 'Rapport'} — Confidentiel`, margin, 291);
        doc.text(`Page ${p} / ${totalPages}`, pageW - margin - 16, 291);
      }

      drawLegalFooter(doc, settings[0], { pageW, pageH: doc.internal.pageSize.getHeight(), baseY: 283 });

      const pdfBlob = doc.output('blob');
      const fileName = `rapport-securite-${start}-${end}.pdf`;

      // Send by email if requested
      if (sendEmail) {
        const pdfBase64 = doc.output('datauristring');
        const recipients = [emailClient, emailSociete || companyEmail].filter(Boolean);
        for (const email of recipients) {
          await base44.integrations.Core.SendEmail({
            to: email,
            subject: `Rapport de sécurité — ${start} au ${end}`,
            body: `Bonjour,\n\nVeuillez trouver ci-joint le rapport de sécurité pour la période du ${start} au ${end}.\n\nModules inclus : ${activeModules.join(', ')}\n\nCordialement,\n${settings[0]?.company_name || 'Votre société de sécurité'}`,
          });
        }
        toast.success(`Rapport envoyé à : ${recipients.join(', ')}`);
      }

      // Download
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);

      setLastGenerated(new Date().toISOString());
      toast.success('Rapport PDF généré avec succès');
    } catch (err) {
      toast.error('Erreur lors de la génération : ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div>
      <PageHeader title="Rapports PDF" subtitle="Génération et envoi automatique de rapports clients" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — config */}
        <div className="lg:col-span-2 space-y-5">

          {/* Période */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Calendar className="w-4 h-4 text-primary" /> Période</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PERIODS.map(p => (
                  <button
                    key={p.key}
                    onClick={() => setPeriod(p.key)}
                    className={`text-sm px-3 py-2 rounded-lg border transition-colors ${period === p.key ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted/50'}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              {period === 'custom' && (
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div>
                    <Label className="text-xs mb-1 block">Date début</Label>
                    <Input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs mb-1 block">Date fin</Label>
                    <Input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Client */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Settings className="w-4 h-4 text-primary" /> Client & Périmètre</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les clients</SelectItem>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Modules */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Données à inclure</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {MODULES.map(m => (
                  <div key={m.key} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/20 transition-colors">
                    <Checkbox
                      checked={selectedModules[m.key]}
                      onCheckedChange={() => toggleModule(m.key)}
                      id={m.key}
                    />
                    <span className="text-lg">{m.icon}</span>
                    <div className="flex-1">
                      <label htmlFor={m.key} className="text-sm font-medium cursor-pointer">{m.label}</label>
                      <p className="text-xs text-muted-foreground">{m.description}</p>
                    </div>
                    {selectedModules[m.key] && <Badge className="bg-primary/10 text-primary text-xs">Inclus</Badge>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Email */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary" /> Envoi par email
                <Switch checked={sendEmail} onCheckedChange={setSendEmail} className="ml-auto" />
              </CardTitle>
            </CardHeader>
            {sendEmail && (
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs mb-1 block">Email du client</Label>
                  <Input
                    type="email"
                    value={emailClient}
                    onChange={e => setEmailClient(e.target.value)}
                    placeholder="client@exemple.fr"
                  />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Email de la société de sécurité</Label>
                  <Input
                    type="email"
                    value={emailSociete || companyEmail}
                    onChange={e => setEmailSociete(e.target.value)}
                    placeholder={companyEmail || 'societe@securite.fr'}
                  />
                </div>
              </CardContent>
            )}
          </Card>

          {/* Planification automatique */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" /> Envoi automatique planifié
                <Switch checked={autoSchedule} onCheckedChange={setAutoSchedule} className="ml-auto" />
              </CardTitle>
            </CardHeader>
            {autoSchedule && (
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">Configurez la fréquence d'envoi automatique du rapport. Un email sera envoyé selon la planification.</p>
                <Select value={scheduleFreq} onValueChange={setScheduleFreq}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Quotidien (chaque matin à 7h)</SelectItem>
                    <SelectItem value="weekly">Hebdomadaire (lundi matin)</SelectItem>
                    <SelectItem value="monthly">Mensuel (1er du mois)</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  L'envoi automatique utilise la fonction sendDailyReport déjà configurée.
                </div>
              </CardContent>
            )}
          </Card>
        </div>

        {/* Right — preview & actions */}
        <div className="space-y-5">
          <Card className="sticky top-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Résumé du rapport</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Période</span>
                  <span className="font-medium">
                    {period === 'custom' ? `${dateStart} → ${dateEnd}` : PERIODS.find(p => p.key === period)?.label}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Client</span>
                  <span className="font-medium">{selectedClient === 'all' ? 'Tous' : clients.find(c => c.id === selectedClient)?.company_name || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Modules</span>
                  <span className="font-medium">{Object.values(selectedModules).filter(Boolean).length} sélectionné(s)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Envoi email</span>
                  <span className={sendEmail ? 'text-green-600 font-medium' : 'text-muted-foreground'}>{sendEmail ? 'Oui' : 'Non'}</span>
                </div>
              </div>

              <div className="border-t pt-3">
                <p className="text-xs text-muted-foreground mb-2">Modules inclus :</p>
                <div className="flex flex-wrap gap-1.5">
                  {MODULES.filter(m => selectedModules[m.key]).map(m => (
                    <Badge key={m.key} variant="outline" className="text-xs">{m.icon} {m.label}</Badge>
                  ))}
                </div>
              </div>

              {lastGenerated && (
                <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Dernier rapport : {format(new Date(lastGenerated), 'dd/MM/yyyy HH:mm')}
                </div>
              )}

              <Button
                className="w-full gap-2"
                onClick={handleGenerate}
                disabled={generating}
              >
                {generating ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Génération en cours...</>
                ) : (
                  <><Download className="w-4 h-4" /> Générer le PDF</>
                )}
              </Button>
              <p className="text-center text-xs text-muted-foreground">Le fichier sera téléchargé automatiquement</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}