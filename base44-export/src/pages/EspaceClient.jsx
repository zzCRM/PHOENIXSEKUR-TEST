import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Download, Plus, AlertTriangle, Building2, Lock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useCompany } from '@/lib/useCompany';
import { toast } from 'sonner';
import { exportMainCourantePdf } from '@/lib/mainCourantePdf';

const TYPE_CONFIG = {
  arrivee: { label: 'Arrivée', color: 'text-green-600' },
  depart: { label: 'Départ', color: 'text-blue-600' },
  incident: { label: 'Incident', color: 'text-red-600' },
  ronde: { label: 'Ronde', color: 'text-purple-600' },
  observation: { label: 'Observation', color: 'text-gray-600' },
  pti_alerte: { label: 'Alerte PTI', color: 'text-red-700' },
  pti_ok: { label: 'PTI OK', color: 'text-green-700' },
  debut_pause: { label: 'Début de pause', color: 'text-amber-700' },
  fin_pause: { label: 'Fin de pause', color: 'text-amber-700' },
  debut_ronde: { label: 'Début de ronde', color: 'text-purple-600' },
  fin_ronde: { label: 'Fin de ronde', color: 'text-purple-600' },
  debut_service: { label: 'Début de service', color: 'text-green-600' },
  debut_service_retard: { label: 'Début en retard', color: 'text-amber-700' },
  fin_service: { label: 'Fin de service', color: 'text-blue-600' },
  autre: { label: 'Autre', color: 'text-gray-600' },
};

function AccessDenied({ label }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <Lock className="w-12 h-12 text-muted-foreground/40 mb-3" />
      <p className="font-semibold text-muted-foreground">Accès non autorisé</p>
      <p className="text-sm text-muted-foreground/70 mt-1">Vous n'avez pas accès au module <strong>{label}</strong>. Contactez votre responsable.</p>
    </div>
  );
}

export default function EspaceClient() {
  const [selectedSite, setSelectedSite] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [showDemandeForm, setShowDemandeForm] = useState(false);
  const [demandeForm, setDemandeForm] = useState({ subject: '', message: '', priority: 'normale' });
  const { user, companyId } = useCompany();
  const qc = useQueryClient();

  const { data: myClient } = useQuery({
    queryKey: ['mon_client', user?.email],
    queryFn: async () => {
      const clients = await base44.entities.Client.filter({ company_id: companyId });
      return clients.find(c =>
        c.user_id === user?.id ||
        c.email === user?.email ||
        (c.comptes_clients || []).some(cc => cc.email === user?.email)
      );
    },
    enabled: !!companyId && !!user,
  });

  // Droits portail client depuis la fiche
  const perms = myClient?.portal_perms || {};
  const droits = myClient?.portal_droits || {};

  const canPlanning = perms.access_planning !== false;
  const canMainCourante = droits.access_main_courante !== false;
  const canDocuments = perms.access_documents !== false;
  const canDemandes = droits.access_demandes !== false;
  const canInfos = true; // toujours accessible

  const { data: sites = [] } = useQuery({ queryKey: ['sites', companyId], queryFn: () => base44.entities.Site.filter({ company_id: companyId }), enabled: !!companyId });
  const { data: missions = [] } = useQuery({
    queryKey: ['missions', companyId],
    queryFn: () => base44.entities.Mission.filter({ company_id: companyId }, '-date', 200),
    enabled: !!companyId && canPlanning,
  });
  const { data: mainCourante = [] } = useQuery({
    queryKey: ['main_courante', companyId],
    queryFn: () => base44.entities.MainCourante.filter({ company_id: companyId }, '-date', 500),
    enabled: !!companyId && canMainCourante,
  });
  const { data: docs = [] } = useQuery({
    queryKey: ['documents', companyId],
    queryFn: () => base44.entities.Document.filter({ company_id: companyId }, '-created_date', 50),
    enabled: !!companyId && canDocuments,
  });
  const { data: demandes = [] } = useQuery({
    queryKey: ['demandes_client'],
    queryFn: () => base44.entities.Demande.filter({ from_type: 'client', company_id: companyId }, '-created_date', 30),
    enabled: !!companyId && canDemandes,
  });

  const demandeMut = useMutation({
    mutationFn: (data) => base44.entities.Demande.create({ ...data, company_id: companyId, from_type: 'client', from_name: user?.full_name || user?.email || '' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['demandes_client'] }); setShowDemandeForm(false); setDemandeForm({ subject: '', message: '', priority: 'normale' }); },
  });
  const clientUpdateMut = useMutation({
    mutationFn: (data) => base44.entities.Client.update(data.id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['mon_client'] }); toast.success('Informations mises à jour'); },
  });

  // Filtrer les sites accessibles selon portal_perms
  const accessibleSiteIds = perms.sites_accessibles?.length ? perms.sites_accessibles : null;
  const visibleSites = accessibleSiteIds
    ? sites.filter(s => s.client_id === myClient?.id && accessibleSiteIds.includes(s.id))
    : sites.filter(s => s.client_id === myClient?.id);

  const currentDate = new Date(selectedMonth + '-01');
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const filteredMissions = missions.filter(m => (selectedSite === 'all' || m.site_id === selectedSite) && visibleSites.some(s => s.id === m.site_id));
  const filteredMC = mainCourante.filter(e => (selectedSite === 'all' || e.site_id === selectedSite) && visibleSites.some(s => s.id === e.site_id));
  const clientDocs = docs.filter(d => d.target_type === 'tous' || d.target_type === 'client');

  const getMissionForDay = (day, siteId) => {
    const dateKey = format(day, 'yyyy-MM-dd');
    return filteredMissions.filter(m => (m.date === dateKey || m.date?.startsWith(dateKey)) && m.site_id === siteId);
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Espace Client</h1>
        <p className="text-muted-foreground mt-1">Suivi de vos prestations de sécurité</p>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <Select value={selectedSite} onValueChange={setSelectedSite}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Tous les sites" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les sites</SelectItem>
            {visibleSites.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="border border-input rounded-md px-3 py-2 text-sm bg-background" />
      </div>

      <Tabs defaultValue={canPlanning ? "planning" : canMainCourante ? "maincourante" : "infos"}>
        <TabsList className="mb-6 flex-wrap h-auto gap-1">
          {canPlanning && <TabsTrigger value="planning">Planning</TabsTrigger>}
          {canMainCourante && <TabsTrigger value="maincourante">Main courante</TabsTrigger>}
          {canDocuments && <TabsTrigger value="documents">Mes documents</TabsTrigger>}
          {canDemandes && <TabsTrigger value="demandes">Demandes</TabsTrigger>}
          <TabsTrigger value="infos">Informations légales</TabsTrigger>
        </TabsList>

        {/* PLANNING */}
        <TabsContent value="planning">
          {!canPlanning ? <AccessDenied label="Planning" /> : (
            <div className="overflow-x-auto rounded-xl border bg-card">
              <table className="text-xs w-full border-collapse">
                <thead>
                  <tr className="bg-muted/60">
                    <th className="sticky left-0 bg-muted/60 z-10 px-3 py-2 text-left border-b border-r border-border font-semibold w-36">
                      {format(currentDate, 'MMMM yyyy', { locale: fr })}
                    </th>
                    {days.map((day, i) => (
                      <th key={i} className={`w-9 min-w-[2.25rem] text-center border-b border-r border-border py-1 font-medium
                        ${isSameDay(day, new Date()) ? 'bg-primary/20 text-primary' : ''}
                        ${getDay(day) === 0 || getDay(day) === 6 ? 'bg-muted/40' : ''}`}>
                        <div>{format(day, 'd')}</div>
                        <div className="text-muted-foreground font-normal">{['D','L','M','M','J','V','S'][getDay(day)]}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleSites.filter(s => selectedSite === 'all' || s.id === selectedSite).map(site => (
                    <tr key={site.id} className="hover:bg-muted/10">
                      <td className="sticky left-0 bg-card z-10 px-3 py-2 border-b border-r border-border font-medium text-sm">{site.name}</td>
                      {days.map((day, i) => {
                        const dayMissions = getMissionForDay(day, site.id);
                        const isWeekend = getDay(day) === 0 || getDay(day) === 6;
                        return (
                          <td key={i} className={`border-b border-r border-border text-center ${isWeekend ? 'bg-muted/10' : ''}`}>
                            {dayMissions.length > 0 && (
                              <div className="mx-0.5 my-0.5 rounded-sm h-6 bg-green-500 flex items-center justify-center text-white text-xs font-bold" title={dayMissions.map(m => `${m.start_time}-${m.end_time}`).join('\n')}>
                                ✓
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* MAIN COURANTE */}
        <TabsContent value="maincourante">
          {!canMainCourante ? <AccessDenied label="Main courante" /> : (
            <>
              <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
                <h2 className="text-lg font-semibold">Historique main courante</h2>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{filteredMC.length} entrées</Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    disabled={filteredMC.length === 0}
                    onClick={() => exportMainCourantePdf({
                      entries: filteredMC.map((e) => ({ ...e, event_label: (TYPE_CONFIG[e.type] || TYPE_CONFIG.autre).label })),
                      companyId,
                      title: 'Main courante client',
                      filename: 'main-courante-client.pdf',
                    })}
                  >
                    <Download className="w-3.5 h-3.5" /> PDF
                  </Button>
                </div>
              </div>
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                {filteredMC.length === 0 && (
                  <div className="text-center py-16 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Aucune entrée de main courante</p>
                  </div>
                )}
                {filteredMC.map(entry => {
                  const config = TYPE_CONFIG[entry.type] || TYPE_CONFIG.autre;
                  return (
                    <Card key={entry.id} className={`p-3 ${entry.severity === 'urgent' ? 'border-l-4 border-l-red-500' : entry.severity === 'attention' ? 'border-l-4 border-l-amber-400' : ''}`}>
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <Badge variant="outline" className={`${config.color} text-xs`}>{config.label}</Badge>
                            <span className="text-xs text-muted-foreground">{entry.site_name}</span>
                            {entry.agent_name && <span className="text-xs text-muted-foreground">• {entry.agent_name}</span>}
                          </div>
                          <p className="text-sm">{entry.content}</p>
                          <p className="text-xs text-muted-foreground mt-1">{entry.date && format(new Date(entry.date), 'dd/MM/yyyy', { locale: fr })} {entry.time && `à ${entry.time}`}</p>
                        </div>
                        {entry.severity === 'urgent' && <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </TabsContent>

        {/* DOCUMENTS */}
        <TabsContent value="documents">
          {!canDocuments ? <AccessDenied label="Documents" /> : (
            <>
              <h2 className="text-lg font-semibold mb-4">Mes documents</h2>
              {clientDocs.length === 0 && <p className="text-muted-foreground text-sm">Aucun document disponible.</p>}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {clientDocs.map(doc => (
                  <Card key={doc.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-sm">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">{doc.type} • {doc.date}</p>
                        {doc.description && <p className="text-xs text-muted-foreground">{doc.description}</p>}
                      </div>
                      <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm" className="gap-2"><Download className="w-3.5 h-3.5" />Ouvrir</Button>
                      </a>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>

        {/* DEMANDES */}
        <TabsContent value="demandes">
          {!canDemandes ? <AccessDenied label="Demandes" /> : (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Mes demandes</h2>
                <Button size="sm" onClick={() => setShowDemandeForm(true)} className="gap-2"><Plus className="w-4 h-4" />Nouvelle demande</Button>
              </div>
              <div className="space-y-3">
                {demandes.map(d => (
                  <Card key={d.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{d.subject}</p>
                        <p className="text-xs text-muted-foreground mt-1">{d.message?.slice(0, 100)}</p>
                        {d.response && (
                          <div className="mt-2 p-2 rounded bg-primary/5 border border-primary/20">
                            <p className="text-xs font-semibold text-primary">Réponse :</p>
                            <p className="text-xs mt-1">{d.response}</p>
                          </div>
                        )}
                      </div>
                      <Badge variant="outline" className="text-xs ml-3 shrink-0">{d.status}</Badge>
                    </div>
                  </Card>
                ))}
                {demandes.length === 0 && <p className="text-muted-foreground text-sm">Aucune demande.</p>}
              </div>
            </>
          )}
        </TabsContent>

        {/* INFORMATIONS LÉGALES */}
        <TabsContent value="infos">
          <div className="mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2"><Building2 className="w-5 h-5" />Informations légales de votre société</h2>
          </div>
          {!myClient ? (
            <Card className="p-6 text-center">
              <p className="text-muted-foreground">Aucune fiche client trouvée. Contactez votre société de sécurité.</p>
            </Card>
          ) : (
            <Card className="p-6">
              <form onSubmit={(e) => { e.preventDefault(); clientUpdateMut.mutate(myClient); }} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Raison sociale *</Label>
                    <Input value={myClient.company_name || ''} disabled />
                  </div>
                  <div className="space-y-2">
                    <Label>Forme juridique</Label>
                    <Input value={myClient.legal_form || ''} onChange={e => clientUpdateMut.mutate({...myClient, legal_form: e.target.value})} placeholder="SARL, SAS, EURL..." />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nom du dirigeant</Label>
                    <Input value={myClient.director_name || ''} onChange={e => clientUpdateMut.mutate({...myClient, director_name: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Contact</Label>
                    <Input value={myClient.contact_name || ''} onChange={e => clientUpdateMut.mutate({...myClient, contact_name: e.target.value})} />
                  </div>
                </div>
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3 text-sm">Identifiants fiscaux</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>SIRET *</Label>
                      <Input value={myClient.siret || ''} onChange={e => clientUpdateMut.mutate({...myClient, siret: e.target.value})} placeholder="123 456 789 00012" />
                    </div>
                    <div className="space-y-2">
                      <Label>SIREN</Label>
                      <Input value={myClient.siren || ''} onChange={e => clientUpdateMut.mutate({...myClient, siren: e.target.value})} placeholder="123 456 789" />
                    </div>
                  </div>
                  <div className="space-y-2 mt-4">
                    <Label>N° TVA intracommunautaire</Label>
                    <Input value={myClient.tva_number || ''} onChange={e => clientUpdateMut.mutate({...myClient, tva_number: e.target.value})} placeholder="FR 00 123456789" />
                  </div>
                </div>
                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={clientUpdateMut.isPending}>
                    {clientUpdateMut.isPending ? 'Mise à jour...' : 'Mettre à jour'}
                  </Button>
                </div>
              </form>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={showDemandeForm} onOpenChange={setShowDemandeForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nouvelle demande</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Sujet *</Label>
              <Input value={demandeForm.subject} onChange={e => setDemandeForm(p => ({ ...p, subject: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Priorité</Label>
              <Select value={demandeForm.priority} onValueChange={v => setDemandeForm(p => ({ ...p, priority: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="basse">Basse</SelectItem>
                  <SelectItem value="normale">Normale</SelectItem>
                  <SelectItem value="haute">Haute</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Message *</Label>
              <Textarea rows={4} value={demandeForm.message} onChange={e => setDemandeForm(p => ({ ...p, message: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowDemandeForm(false)}>Annuler</Button>
              <Button onClick={() => demandeForm.subject && demandeForm.message && demandeMut.mutate(demandeForm)} disabled={!demandeForm.subject || !demandeForm.message}>Envoyer</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}