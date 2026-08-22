import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Upload, Download, Trash2, Plus, FolderOpen, FileDown } from 'lucide-react';
import jsPDF from 'jspdf';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import PageHeader from '@/components/shared/PageHeader';
import { useCompany } from '@/lib/useCompany';

const TYPE_LABELS = { contrat: 'Contrat', procedure: 'Procédure', rapport: 'Rapport', fiche_paie: 'Fiche de paie', autre: 'Autre' };
const TARGET_LABELS = { client: 'Client', agent: 'Agent/Salarié', tous: 'Tous' };

export default function Documents() {
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [filterTarget, setFilterTarget] = useState('all');
  const { companyId } = useCompany();
  const qc = useQueryClient();

  const [form, setForm] = useState({ name: '', type: 'autre', target_type: 'tous', target_id: '', target_name: '', description: '', date: format(new Date(), 'yyyy-MM-dd') });
  const [file, setFile] = useState(null);

  const { data: docs = [] } = useQuery({
    queryKey: ['documents', companyId],
    queryFn: () => base44.entities.Document.filter({ company_id: companyId }, '-created_date', 100),
    enabled: !!companyId,
  });
  const { data: clients = [] } = useQuery({ queryKey: ['clients', companyId], queryFn: () => base44.entities.Client.filter({ company_id: companyId }), enabled: !!companyId });
  const { data: agents = [] } = useQuery({ queryKey: ['agents', companyId], queryFn: () => base44.entities.Agent.filter({ company_id: companyId }), enabled: !!companyId });

  const createMut = useMutation({
    mutationFn: (data) => base44.entities.Document.create({ ...data, company_id: companyId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['documents'] }); setShowForm(false); resetForm(); },
  });

  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.Document.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  });

  const resetForm = () => {
    setForm({ name: '', type: 'autre', target_type: 'tous', target_id: '', target_name: '', description: '', date: format(new Date(), 'yyyy-MM-dd') });
    setFile(null);
  };

  const handleUpload = async () => {
    if (!file || !form.name) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    await createMut.mutateAsync({ ...form, file_url });
    setUploading(false);
  };

  const filtered = docs
    .filter(d => filterType === 'all' || d.type === filterType)
    .filter(d => filterTarget === 'all' || d.target_type === filterTarget);

  const exportListePDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Liste des Documents - Phoenix Sekur', 14, 18);
    doc.setFontSize(10);
    doc.text(`Exporté le : ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: fr })}`, 14, 27);
    let y = 40;
    filtered.forEach((d, i) => {
      if (y > 265) { doc.addPage(); y = 20; }
      doc.setFont(undefined, 'bold');
      doc.text(`${i + 1}. ${d.name}`, 14, y);
      doc.setFont(undefined, 'normal');
      y += 5;
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(`Type: ${TYPE_LABELS[d.type] || d.type} | Destinataire: ${TARGET_LABELS[d.target_type] || d.target_type}${d.target_name ? ` (${d.target_name})` : ''} | Date: ${d.date || ''}`, 14, y);
      doc.setTextColor(0);
      doc.setFontSize(10);
      y += 10;
    });
    doc.save('liste-documents.pdf');
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
          <p className="text-muted-foreground mt-1">Gestion des documents partagés</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportListePDF} className="gap-2">
            <FileDown className="w-4 h-4" /> Export liste PDF
          </Button>
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Ajouter un document
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterTarget} onValueChange={setFilterTarget}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Destinataire" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous destinataires</SelectItem>
            <SelectItem value="client">Clients</SelectItem>
            <SelectItem value="agent">Agents</SelectItem>
            <SelectItem value="tous">Tous</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Aucun document</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(doc => (
            <Card key={doc.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{doc.name}</p>
                    <p className="text-xs text-muted-foreground">{doc.date && format(new Date(doc.date), 'dd/MM/yyyy', { locale: fr })}</p>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                <Badge variant="outline" className="text-xs">{TYPE_LABELS[doc.type] || doc.type}</Badge>
                <Badge variant="outline" className="text-xs">{TARGET_LABELS[doc.target_type] || doc.target_type}</Badge>
                {doc.target_name && <Badge variant="outline" className="text-xs">{doc.target_name}</Badge>}
              </div>
              {doc.description && <p className="text-xs text-muted-foreground mb-3">{doc.description}</p>}
              <div className="flex gap-2">
                <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="flex-1">
                  <Button variant="outline" size="sm" className="w-full gap-2"><Download className="w-3.5 h-3.5" />Télécharger</Button>
                </a>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => deleteMut.mutate(doc.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={() => { setShowForm(false); resetForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Ajouter un document</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nom du document *</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Destinataire</Label>
                <Select value={form.target_type} onValueChange={v => setForm(p => ({ ...p, target_type: v, target_id: '', target_name: '' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tous">Tous</SelectItem>
                    <SelectItem value="client">Client spécifique</SelectItem>
                    <SelectItem value="agent">Agent spécifique</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.target_type === 'client' && (
              <div className="space-y-2">
                <Label>Client</Label>
                <Select value={form.target_id} onValueChange={v => { const c = clients.find(c => c.id === v); setForm(p => ({ ...p, target_id: v, target_name: c?.company_name || '' })); }}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {form.target_type === 'agent' && (
              <div className="space-y-2">
                <Label>Agent</Label>
                <Select value={form.target_id} onValueChange={v => { const a = agents.find(a => a.id === v); setForm(p => ({ ...p, target_id: v, target_name: a ? `${a.first_name} ${a.last_name}` : '' })); }}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>{agents.map(a => <SelectItem key={a.id} value={a.id}>{a.first_name} {a.last_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Fichier *</Label>
              <Input type="file" onChange={e => setFile(e.target.files[0])} />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => { setShowForm(false); resetForm(); }}>Annuler</Button>
              <Button onClick={handleUpload} disabled={!file || !form.name || uploading}>
                {uploading ? 'Envoi...' : 'Téléverser'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}