import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Search, MoreHorizontal, Pencil, Trash2, Building2, Euro, Download } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import StatCard from '@/components/shared/StatCard';
import EmptyState from '@/components/shared/EmptyState';
import InvoiceForm from '@/components/invoices/InvoiceForm';
import { useCompany } from '@/lib/useCompany';
import { toast } from 'sonner';
import { exportInvoicePdf } from '@/lib/invoicePdfExport';

export default function Facturation() {
  const { companyId } = useCompany();
  const [showForm, setShowForm] = useState(false);
  const [editInvoice, setEditInvoice] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const qc = useQueryClient();

  const { data: invoices = [], isLoading } = useQuery({ queryKey: ['invoices', companyId], queryFn: () => base44.entities.Invoice.filter({ company_id: companyId }, '-date', 100), enabled: !!companyId });
  const { data: clients = [] } = useQuery({ queryKey: ['clients', companyId], queryFn: () => base44.entities.Client.filter({ company_id: companyId }), enabled: !!companyId });

  const createMut = useMutation({
    mutationFn: (data) => base44.entities.Invoice.create({ ...data, company_id: companyId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices', companyId] }); setShowForm(false); toast.success('Facture créée avec succès'); },
    onError: (error) => { toast.error('Échec de la création : ' + (error.message || 'Erreur inconnue')); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Invoice.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices', companyId] }); setEditInvoice(null); toast.success('Facture modifiée avec succès'); },
    onError: (error) => { toast.error('Échec de la modification : ' + (error.message || 'Erreur inconnue')); },
  });
  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.Invoice.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices', companyId] }); toast.success('Facture supprimée avec succès'); },
    onError: (error) => { toast.error('Échec de la suppression : ' + (error.message || 'Erreur inconnue')); },
  });

  const filtered = invoices
    .filter(i => statusFilter === 'all' || i.status === statusFilter)
    .filter(i => `${i.invoice_number} ${i.client_name}`.toLowerCase().includes(search.toLowerCase()));

  const totalPaid = invoices.filter(i => i.status === 'payee').reduce((s, i) => s + (i.total_ttc || 0), 0);
  const totalPending = invoices.filter(i => i.status === 'envoyee').reduce((s, i) => s + (i.total_ttc || 0), 0);
  const totalOverdue = invoices.filter(i => i.status === 'en_retard').reduce((s, i) => s + (i.total_ttc || 0), 0);

  return (
    <div>
      <PageHeader title="Facturation" subtitle={`${invoices.length} factures`} actionLabel="Nouvelle facture" onAction={() => setShowForm(true)} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard title="Encaissé" value={`${totalPaid.toLocaleString('fr-FR')} €`} icon={Euro} />
        <StatCard title="En attente" value={`${totalPending.toLocaleString('fr-FR')} €`} icon={FileText} />
        <StatCard title="En retard" value={`${totalOverdue.toLocaleString('fr-FR')} €`} icon={FileText} />
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList>
            <TabsTrigger value="all">Toutes</TabsTrigger>
            <TabsTrigger value="brouillon">Brouillon</TabsTrigger>
            <TabsTrigger value="envoyee">Envoyées</TabsTrigger>
            <TabsTrigger value="payee">Payées</TabsTrigger>
            <TabsTrigger value="en_retard">En retard</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {filtered.length === 0 && !isLoading ? (
        <EmptyState icon={FileText} title="Aucune facture" description="Créez votre première facture." actionLabel="Nouvelle facture" onAction={() => setShowForm(true)} />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N° Facture</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Échéance</TableHead>
                <TableHead className="text-right">Total TTC</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(invoice => (
                <TableRow key={invoice.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setEditInvoice(invoice)}>
                  <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                  <TableCell>{invoice.client_name}</TableCell>
                  <TableCell>{invoice.date && format(new Date(invoice.date), 'd MMM yyyy', { locale: fr })}</TableCell>
                  <TableCell>{invoice.due_date && format(new Date(invoice.due_date), 'd MMM yyyy', { locale: fr })}</TableCell>
                  <TableCell className="text-right font-semibold">{(invoice.total_ttc || 0).toLocaleString('fr-FR')} €</TableCell>
                  <TableCell><StatusBadge status={invoice.status} /></TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={e => e.stopPropagation()}>
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={async (e) => { e.stopPropagation(); try { const s = await base44.entities.CompanySettings.filter({ company_id: companyId }); await exportInvoicePdf(invoice, clients.find(c => c.id === invoice.client_id), s[0]); toast.success('Facture exportée en PDF'); } catch (err) { toast.error('Échec export : ' + (err.message || '')); } }}>
                          <Download className="w-4 h-4 mr-2" />Télécharger PDF
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditInvoice(invoice); }}>
                          <Pencil className="w-4 h-4 mr-2" />Modifier
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); deleteMut.mutate(invoice.id); }} className="text-destructive">
                          <Trash2 className="w-4 h-4 mr-2" />Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <InvoiceForm
        open={showForm || !!editInvoice}
        onClose={() => { setShowForm(false); setEditInvoice(null); }}
        onSubmit={(data) => editInvoice ? updateMut.mutate({ id: editInvoice.id, data }) : createMut.mutate(data)}
        invoice={editInvoice}
        clients={clients}
      />
    </div>
  );
}