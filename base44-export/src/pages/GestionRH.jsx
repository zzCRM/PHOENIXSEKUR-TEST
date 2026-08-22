import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, AlertTriangle, Package, Plus, Trash2, CheckCircle2, Clock, MoreHorizontal, Upload } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { format, differenceInDays, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useCompany } from '@/lib/useCompany';
import { toast } from 'sonner';

const TYPE_FICHE = { contrat: 'Contrat', procedure: 'Procédure', rapport: 'Rapport', fiche_paie: 'Fiche de paie', autre: 'Autre' };

export default function GestionRH() {
  const { companyId, isAdmin } = useCompany();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState('expirations');
  const [showPretForm, setShowPretForm] = useState(false);
  const [showFicheForm, setShowFicheForm] = useState(false);
  const [pretForm, setPretForm] = useState({ agent_id: '', agent_name: '', materiel: '', quantite: 1, date_pret: format(new Date(), 'yyyy-MM-dd'), date_retour_prevue: '', notes: '' });
  const [ficheForm, setFicheForm] = useState({ agent_id: '', agent_name: '', period: '', month: '', year: new Date().getFullYear(), gross_amount: '', net_amount: '', hours_worked: '' });
  const [ficheFile, setFicheFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const { data: agents = [] } = useQuery({ queryKey: ['agents', companyId], queryFn: () => base44.entities.Agent.filter({ company_id: companyId }), enabled: !!companyId });
  const { data: prets = [] } = useQuery({ queryKey: ['prets', companyId], queryFn: () => base44.entities.PretMateriel.filter({ company_id: companyId }, '-date_pret', 100), enabled: !!companyId });
  const { data: fiches = [] } = useQuery({ queryKey: ['fiches_paie_rh', companyId], queryFn: () => base44.entities.FicheDePaie.filter({ company_id: companyId }, '-year', 100), enabled: !!companyId });

  const createPretMut = useMutation({
    mutationFn: (data) => base44.entities.PretMateriel.create({ ...data, company_id: companyId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['prets'] }); setShowPretForm(false); setPretForm({ agent_id: '', agent_name: '', materiel: '', quantite: 1, date_pret: format(new Date(), 'yyyy-MM-dd'), date_retour_prevue: '', notes: '' }); toast.success('Prêt enregistré'); },
  });
  const updatePretMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PretMateriel.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['prets'] }); toast.success('Mise à jour effectuée'); },
  });
  const deletePretMut = useMutation({
    mutationFn: (id) => base44.entities.PretMateriel.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['prets'] }); toast.success('Prêt supprimé'); },
  });
  const createFicheMut = useMutation({
    mutationFn: (data) => base44.entities.FicheDePaie.create({ ...data, company_id: companyId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fiches_paie_rh'] }); setShowFicheForm(false); toast.success('Fiche de paie ajoutée'); },
  });

  // Alertes expirations cartes pro
  const today = new Date();
  const expirations = agents
    .filter(a => a.card_expiry)
    .map(a => {
      const exp = new Date(a.card_expiry);
      const daysLeft = differenceInDays(exp, today);
      return { ...a, daysLeft, expDate: exp };
    })
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const expiring30 = expirations.filter(a => a.daysLeft <= 30 && a.daysLeft >= 0);
  const expired = expirations.filter(a => a.daysLeft < 0);
  const expiring90 = expirations.filter(a => a.daysLeft > 30 && a.daysLeft <= 90);

  const pretsEnCours = prets.filter(p => p.status === 'en_cours');
  const pretsEnRetard = pretsEnCours.filter(p => p.date_retour_prevue && new Date(p.date_retour_prevue) < today);

  const handleFicheSubmit = async () => {
    let file_url = undefined;
    if (ficheFile) {
      setUploading(true);
      const res = await base44.integrations.Core.UploadFile({ file: ficheFile });
      file_url = res.file_url;
      setUploading(false);
    }
    const a = agents.find(ag => ag.id === ficheForm.agent_id);
    createFicheMut.mutate({ ...ficheForm, agent_name: a ? `${a.first_name} ${a.last_name}` : ficheForm.agent_name, file_url, gross_amount: ficheForm.gross_amount ? Number(ficheForm.gross_amount) : undefined, net_amount: ficheForm.net_amount ? Number(ficheForm.net_amount) : undefined, hours_worked: ficheForm.hours_worked ? Number(ficheForm.hours_worked) : undefined });
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Users className="w-6 h-6 text-primary" /> Gestion RH
        </h1>
        <p className="text-muted-foreground mt-1">Expirations réglementaires, fiches de paie, prêts de matériel</p>
      </div>

      {/* Alertes expirations rapides */}
      {(expired.length > 0 || expiring30.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {expired.length > 0 && (
            <Card className="p-4 border-red-300 bg-red-50">
              <div className="flex items-center gap-2 text-red-700 font-semibold mb-2">
                <AlertTriangle className="w-5 h-5" /> {expired.length} carte(s) expirée(s)
              </div>
              {expired.slice(0, 3).map(a => (
                <p key={a.id} className="text-sm text-red-700">• {a.first_name} {a.last_name} — expirée depuis {Math.abs(a.daysLeft)} j</p>
              ))}
            </Card>
          )}
          {expiring30.length > 0 && (
            <Card className="p-4 border-amber-300 bg-amber-50">
              <div className="flex items-center gap-2 text-amber-700 font-semibold mb-2">
                <Clock className="w-5 h-5" /> {expiring30.length} carte(s) expire dans -30j
              </div>
              {expiring30.slice(0, 3).map(a => (
                <p key={a.id} className="text-sm text-amber-700">• {a.first_name} {a.last_name} — dans {a.daysLeft} j</p>
              ))}
            </Card>
          )}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="expirations" className="relative">
            Cartes pro
            {(expired.length + expiring30.length) > 0 && (
              <span className="ml-2 px-1.5 py-0.5 bg-red-500 text-white rounded-full text-[10px]">{expired.length + expiring30.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="fiches">Fiches de paie</TabsTrigger>
          <TabsTrigger value="prets" className="relative">
            Prêts matériel
            {pretsEnRetard.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 bg-amber-500 text-white rounded-full text-[10px]">{pretsEnRetard.length}</span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ===== EXPIRATIONS ===== */}
        <TabsContent value="expirations" className="space-y-3">
          <h2 className="text-base font-semibold">Suivi des cartes professionnelles CNAPS</h2>
          {expirations.length === 0 ? (
            <p className="text-muted-foreground text-sm">Aucune carte professionnelle enregistrée. Renseignez la date d'expiration dans la fiche agent.</p>
          ) : (
            <div className="space-y-2">
              {expirations.map(a => {
                const isExpired = a.daysLeft < 0;
                const isUrgent = a.daysLeft >= 0 && a.daysLeft <= 30;
                const isWarning = a.daysLeft > 30 && a.daysLeft <= 90;
                return (
                  <div key={a.id} className={`flex items-center justify-between p-3 rounded-lg border ${isExpired ? 'bg-red-50 border-red-200' : isUrgent ? 'bg-amber-50 border-amber-200' : isWarning ? 'bg-yellow-50 border-yellow-200' : 'bg-muted/30 border-border'}`}>
                    <div>
                      <p className="font-medium text-sm">{a.first_name} {a.last_name}</p>
                      <p className="text-xs text-muted-foreground">
                        Carte : {a.card_number || 'N/A'} • Expire le {format(a.expDate, 'dd/MM/yyyy', { locale: fr })}
                      </p>
                    </div>
                    <Badge variant="outline" className={isExpired ? 'text-red-700 border-red-300 bg-red-50' : isUrgent ? 'text-amber-700 border-amber-300 bg-amber-50' : isWarning ? 'text-yellow-700 border-yellow-300' : 'text-green-700 border-green-300'}>
                      {isExpired ? `Expirée (${Math.abs(a.daysLeft)}j)` : `Dans ${a.daysLeft}j`}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ===== FICHES DE PAIE ===== */}
        <TabsContent value="fiches">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold">Fiches de paie</h2>
            {isAdmin && <Button size="sm" onClick={() => setShowFicheForm(true)} className="gap-2"><Plus className="w-4 h-4" />Ajouter</Button>}
          </div>
          {fiches.length === 0 ? (
            <p className="text-muted-foreground text-sm">Aucune fiche de paie enregistrée.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {fiches.map(f => (
                <Card key={f.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">{f.agent_name}</p>
                      <p className="text-xs text-muted-foreground">Période : {f.period}</p>
                      {f.net_amount && <p className="text-xs text-green-700 font-medium mt-1">Net : {f.net_amount.toLocaleString('fr-FR')} €</p>}
                      {f.hours_worked && <p className="text-xs text-muted-foreground">Heures : {f.hours_worked}h</p>}
                    </div>
                    {f.file_url && (
                      <a href={f.file_url} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm">PDF</Button>
                      </a>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ===== PRÊTS MATÉRIEL ===== */}
        <TabsContent value="prets">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold">Prêts de matériel</h2>
            {isAdmin && <Button size="sm" onClick={() => setShowPretForm(true)} className="gap-2"><Plus className="w-4 h-4" />Nouveau prêt</Button>}
          </div>
          {prets.length === 0 ? (
            <p className="text-muted-foreground text-sm">Aucun prêt de matériel enregistré.</p>
          ) : (
            <div className="space-y-2">
              {prets.map(p => {
                const isEnRetard = p.status === 'en_cours' && p.date_retour_prevue && new Date(p.date_retour_prevue) < today;
                return (
                  <Card key={p.id} className={`p-4 ${isEnRetard ? 'border-amber-300 bg-amber-50' : ''}`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-sm">{p.materiel} {p.quantite > 1 && `(x${p.quantite})`}</p>
                        <p className="text-xs text-muted-foreground">{p.agent_name} • Prêté le {p.date_pret && format(new Date(p.date_pret), 'dd/MM/yyyy', { locale: fr })}</p>
                        {p.date_retour_prevue && <p className="text-xs text-muted-foreground">Retour prévu : {format(new Date(p.date_retour_prevue), 'dd/MM/yyyy', { locale: fr })}</p>}
                        {p.notes && <p className="text-xs text-muted-foreground italic">{p.notes}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={p.status === 'rendu' ? 'text-green-700 border-green-300' : isEnRetard ? 'text-amber-700 border-amber-300' : 'text-blue-600 border-blue-300'}>
                          {p.status === 'rendu' ? 'Rendu' : isEnRetard ? 'En retard' : 'En cours'}
                        </Badge>
                        {p.status === 'en_cours' && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="w-3.5 h-3.5" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => updatePretMut.mutate({ id: p.id, data: { status: 'rendu', date_retour_effective: format(new Date(), 'yyyy-MM-dd') } })}>
                                <CheckCircle2 className="w-4 h-4 mr-2" />Marquer rendu
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => deletePretMut.mutate(p.id)}>
                                <Trash2 className="w-4 h-4 mr-2" />Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Prêt form */}
      <Dialog open={showPretForm} onOpenChange={() => setShowPretForm(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nouveau prêt de matériel</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Agent</Label>
              <Select value={pretForm.agent_id} onValueChange={v => { const a = agents.find(ag => ag.id === v); setPretForm(p => ({ ...p, agent_id: v, agent_name: a ? `${a.first_name} ${a.last_name}` : '' })); }}>
                <SelectTrigger><SelectValue placeholder="Sélectionner l'agent" /></SelectTrigger>
                <SelectContent>{agents.map(a => <SelectItem key={a.id} value={a.id}>{a.first_name} {a.last_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Matériel *</Label>
              <Input value={pretForm.materiel} onChange={e => setPretForm(p => ({ ...p, materiel: e.target.value }))} placeholder="ex: Radio Motorola DP2400" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantité</Label>
                <Input type="number" min="1" value={pretForm.quantite} onChange={e => setPretForm(p => ({ ...p, quantite: Number(e.target.value) }))} />
              </div>
              <div className="space-y-2">
                <Label>Date de prêt</Label>
                <Input type="date" value={pretForm.date_pret} onChange={e => setPretForm(p => ({ ...p, date_pret: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Date de retour prévue</Label>
              <Input type="date" value={pretForm.date_retour_prevue} onChange={e => setPretForm(p => ({ ...p, date_retour_prevue: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input value={pretForm.notes} onChange={e => setPretForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowPretForm(false)}>Annuler</Button>
              <Button onClick={() => createPretMut.mutate(pretForm)} disabled={!pretForm.materiel || !pretForm.agent_id || createPretMut.isPending}>Enregistrer</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Fiche de paie form */}
      <Dialog open={showFicheForm} onOpenChange={() => { setShowFicheForm(false); setFicheFile(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Ajouter une fiche de paie</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Agent</Label>
              <Select value={ficheForm.agent_id} onValueChange={v => setFicheForm(p => ({ ...p, agent_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>{agents.map(a => <SelectItem key={a.id} value={a.id}>{a.first_name} {a.last_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Période (ex: Janvier 2025)</Label>
                <Input value={ficheForm.period} onChange={e => setFicheForm(p => ({ ...p, period: e.target.value }))} placeholder="Janvier 2025" />
              </div>
              <div className="space-y-2">
                <Label>Année</Label>
                <Input type="number" value={ficheForm.year} onChange={e => setFicheForm(p => ({ ...p, year: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Brut (€)</Label>
                <Input type="number" value={ficheForm.gross_amount} onChange={e => setFicheForm(p => ({ ...p, gross_amount: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Net (€)</Label>
                <Input type="number" value={ficheForm.net_amount} onChange={e => setFicheForm(p => ({ ...p, net_amount: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Heures</Label>
                <Input type="number" value={ficheForm.hours_worked} onChange={e => setFicheForm(p => ({ ...p, hours_worked: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Fichier PDF</Label>
              <Input type="file" accept=".pdf" onChange={e => setFicheFile(e.target.files[0])} />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => { setShowFicheForm(false); setFicheFile(null); }}>Annuler</Button>
              <Button onClick={handleFicheSubmit} disabled={!ficheForm.agent_id || !ficheForm.period || uploading || createFicheMut.isPending}>
                {uploading || createFicheMut.isPending ? 'Envoi...' : 'Enregistrer'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}