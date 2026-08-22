import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2 } from 'lucide-react';

export default function InvoiceForm({ open, onClose, onSubmit, invoice, clients = [] }) {
  const [form, setForm] = useState(invoice || {
    invoice_number: '', client_id: '', client_name: '', date: '',
    due_date: '', items: [{ description: '', quantity: 1, unit_price: 0, total: 0 }],
    tva_rate: 20, status: 'brouillon', notes: ''
  });

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleClientChange = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    setForm(prev => ({ ...prev, client_id: clientId, client_name: client?.company_name || '' }));
  };

  const updateItem = (index, field, value) => {
    const items = [...form.items];
    items[index] = { ...items[index], [field]: value };
    if (field === 'quantity' || field === 'unit_price') {
      items[index].total = (items[index].quantity || 0) * (items[index].unit_price || 0);
    }
    setForm(prev => ({ ...prev, items }));
  };

  const addItem = () => {
    setForm(prev => ({ ...prev, items: [...prev.items, { description: '', quantity: 1, unit_price: 0, total: 0 }] }));
  };

  const removeItem = (index) => {
    setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
  };

  const totalHT = form.items.reduce((sum, item) => sum + (item.total || 0), 0);
  const totalTVA = totalHT * (form.tva_rate || 0) / 100;
  const totalTTC = totalHT + totalTVA;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ ...form, total_ht: totalHT, total_tva: totalTVA, total_ttc: totalTTC });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{invoice ? 'Modifier la facture' : 'Nouvelle facture'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>N° Facture *</Label>
              <Input value={form.invoice_number} onChange={e => update('invoice_number', e.target.value)} required placeholder="FAC-001" />
            </div>
            <div className="space-y-2">
              <Label>Client</Label>
              <Select value={form.client_id} onValueChange={handleClientChange}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={form.date} onChange={e => update('date', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Échéance</Label>
              <Input type="date" value={form.due_date} onChange={e => update('due_date', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Statut</Label>
              <Select value={form.status} onValueChange={v => update('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="brouillon">Brouillon</SelectItem>
                  <SelectItem value="envoyee">Envoyée</SelectItem>
                  <SelectItem value="payee">Payée</SelectItem>
                  <SelectItem value="en_retard">En retard</SelectItem>
                  <SelectItem value="annulee">Annulée</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Lignes de facturation</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem} className="gap-1">
                <Plus className="w-3.5 h-3.5" /> Ajouter
              </Button>
            </div>
            <div className="space-y-2">
              {form.items.map((item, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
                    <Input placeholder="Description" value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <Input type="number" placeholder="Qté" value={item.quantity} onChange={e => updateItem(i, 'quantity', Number(e.target.value))} />
                  </div>
                  <div className="col-span-2">
                    <Input type="number" step="0.01" placeholder="P.U." value={item.unit_price} onChange={e => updateItem(i, 'unit_price', Number(e.target.value))} />
                  </div>
                  <div className="col-span-2 text-right font-medium text-sm pt-2">
                    {(item.total || 0).toFixed(2)} €
                  </div>
                  <div className="col-span-1">
                    <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={() => removeItem(i)} disabled={form.items.length === 1}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="bg-muted rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Total HT</span>
              <span className="font-medium">{totalHT.toFixed(2)} €</span>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span>TVA</span>
                <Input type="number" className="w-16 h-7 text-xs" value={form.tva_rate} onChange={e => update('tva_rate', Number(e.target.value))} />
                <span>%</span>
              </div>
              <span className="font-medium">{totalTVA.toFixed(2)} €</span>
            </div>
            <div className="flex justify-between text-base font-bold border-t pt-2">
              <span>Total TTC</span>
              <span>{totalTTC.toFixed(2)} €</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={e => update('notes', e.target.value)} rows={2} />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit">{invoice ? 'Modifier' : 'Créer'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}