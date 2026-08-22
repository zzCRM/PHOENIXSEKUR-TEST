import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Building2, UserPlus, Mail, Phone, MapPin, FileText, Shield, CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/AuthContext';

export default function OnboardingSociete() {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [companyData, setCompanyData] = useState({
    company_name: '',
    siret: '',
    address: '',
    city: '',
    postal_code: '',
    phone: '',
    email: '',
    website: '',
    cnaps_number: '',
    insurance_number: '',
    director_name: '',
    legal_form: '',
    notes: '',
  });
  const [adminData, setAdminData] = useState({
    email: '',
    full_name: '',
    phone: '',
  });

  const createCompanyMut = useMutation({
    mutationFn: async (data) => {
      // Step 1: Create company settings
      const companySettings = await base44.entities.CompanySettings.create({
        company_id: data.company_id,
        company_name: data.company_name,
        siret: data.siret,
        address: data.address,
        city: data.city,
        postal_code: data.postal_code,
        phone: data.phone,
        email: data.email,
        website: data.website,
        cnaps_number: data.cnaps_number,
        insurance_number: data.insurance_number,
        director_name: data.director_name,
        legal_form: data.legal_form,
        notes: data.notes,
      });

      // Step 2: Invite the admin user
      await base44.users.inviteUser(data.admin_email, 'admin');

      // Step 3: Create agent record for the admin
      const [firstName, ...lastNameParts] = data.admin_full_name.split(' ');
      const lastName = lastNameParts.join(' ') || firstName;
      
      await base44.entities.Agent.create({
        company_id: data.company_id,
        first_name: firstName,
        last_name: lastName,
        email: data.admin_email,
        phone: data.admin_phone,
        role: 'admin',
        status: 'actif',
      });

      return companySettings;
    },
    onSuccess: () => {
      toast.success('Société créée avec succès !');
      setStep(1);
      setCompanyData({
        company_name: '', siret: '', address: '', city: '', postal_code: '',
        phone: '', email: '', website: '', cnaps_number: '', insurance_number: '',
        director_name: '', legal_form: '', notes: '',
      });
      setAdminData({ email: '', full_name: '', phone: '' });
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const handleSubmit = () => {
    const company_id = `company_${Date.now()}`;
    createCompanyMut.mutate({
      ...companyData,
      company_id,
      admin_email: adminData.email,
      admin_full_name: adminData.full_name,
      admin_phone: adminData.phone,
    });
  };

  const isStep1Valid = companyData.company_name && companyData.email;
  const isStep2Valid = adminData.email && adminData.full_name;

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Building2 className="w-8 h-8 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Onboarding Société</h1>
        </div>
        <p className="text-muted-foreground">Créer une nouvelle société de sécurité et son premier administrateur</p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-4 mb-8">
        <div className={`flex items-center gap-2 ${step >= 1 ? 'text-primary' : 'text-muted-foreground'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 1 ? 'bg-primary text-white' : 'bg-muted'}`}>
            1
          </div>
          <span className="text-sm font-medium">Informations société</span>
        </div>
        <div className={`w-12 h-px ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
        <div className={`flex items-center gap-2 ${step >= 2 ? 'text-primary' : 'text-muted-foreground'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 2 ? 'bg-primary text-white' : 'bg-muted'}`}>
            2
          </div>
          <span className="text-sm font-medium">Administrateur</span>
        </div>
      </div>

      <Card className="p-6">
        <Tabs value={step === 1 ? 'company' : 'admin'}>
          <TabsList className="mb-6">
            <TabsTrigger value="company">Société</TabsTrigger>
            <TabsTrigger value="admin">Admin</TabsTrigger>
          </TabsList>

          {/* STEP 1: Company Info */}
          <TabsContent value="company">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nom de la société *</Label>
                  <Input
                    value={companyData.company_name}
                    onChange={e => setCompanyData({...companyData, company_name: e.target.value})}
                    placeholder="PP Security"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Forme juridique</Label>
                  <Input
                    value={companyData.legal_form}
                    onChange={e => setCompanyData({...companyData, legal_form: e.target.value})}
                    placeholder="SARL, SAS, EURL..."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>SIRET</Label>
                <Input
                  value={companyData.siret}
                  onChange={e => setCompanyData({...companyData, siret: e.target.value})}
                  placeholder="123 456 789 00012"
                />
              </div>

              <div className="space-y-2">
                <Label>Numéro CNAPS</Label>
                <Input
                  value={companyData.cnaps_number}
                  onChange={e => setCompanyData({...companyData, cnaps_number: e.target.value})}
                  placeholder="N° d'autorisation"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Adresse</Label>
                  <Input
                    value={companyData.address}
                    onChange={e => setCompanyData({...companyData, address: e.target.value})}
                    placeholder="123 Rue de la Paix"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ville</Label>
                  <Input
                    value={companyData.city}
                    onChange={e => setCompanyData({...companyData, city: e.target.value})}
                    placeholder="Paris"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Code postal</Label>
                  <Input
                    value={companyData.postal_code}
                    onChange={e => setCompanyData({...companyData, postal_code: e.target.value})}
                    placeholder="75001"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Téléphone</Label>
                  <Input
                    value={companyData.phone}
                    onChange={e => setCompanyData({...companyData, phone: e.target.value})}
                    placeholder="01 23 45 67 89"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={companyData.email}
                    onChange={e => setCompanyData({...companyData, email: e.target.value})}
                    placeholder="contact@ppsecurity.fr"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Site web</Label>
                  <Input
                    value={companyData.website}
                    onChange={e => setCompanyData({...companyData, website: e.target.value})}
                    placeholder="https://ppsecurity.fr"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nom du dirigeant</Label>
                  <Input
                    value={companyData.director_name}
                    onChange={e => setCompanyData({...companyData, director_name: e.target.value})}
                    placeholder="Jean Dupont"
                  />
                </div>
                <div className="space-y-2">
                  <Label>N° Assurance RC Pro</Label>
                  <Input
                    value={companyData.insurance_number}
                    onChange={e => setCompanyData({...companyData, insurance_number: e.target.value})}
                    placeholder="N° de police"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  rows={3}
                  value={companyData.notes}
                  onChange={e => setCompanyData({...companyData, notes: e.target.value})}
                  placeholder="Informations complémentaires..."
                />
              </div>

              <div className="flex justify-end pt-4">
                <Button
                  onClick={() => setStep(2)}
                  disabled={!isStep1Valid || createCompanyMut.isPending}
                  className="gap-2"
                >
                  Suivant
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* STEP 2: Admin User */}
          <TabsContent value="admin">
            <div className="space-y-4">
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg mb-4">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-primary">Premier administrateur</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Cet utilisateur sera l'administrateur principal de la société. Il pourra ensuite inviter d'autres utilisateurs.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Nom complet *</Label>
                <Input
                  value={adminData.full_name}
                  onChange={e => setAdminData({...adminData, full_name: e.target.value})}
                  placeholder="Jean Dupont"
                />
              </div>

              <div className="space-y-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={adminData.email}
                  onChange={e => setAdminData({...adminData, email: e.target.value})}
                  placeholder="jean@ppsecurity.fr"
                />
              </div>

              <div className="space-y-2">
                <Label>Téléphone</Label>
                <Input
                  value={adminData.phone}
                  onChange={e => setAdminData({...adminData, phone: e.target.value})}
                  placeholder="06 12 34 56 78"
                />
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep(1)}>
                  Retour
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!isStep2Valid || createCompanyMut.isPending}
                  className="gap-2"
                >
                  {createCompanyMut.isPending ? 'Création...' : 'Créer la société'}
                  {!createCompanyMut.isPending && <CheckCircle2 className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </Card>

      {/* Summary */}
      {step === 2 && (
        <Card className="p-6 mt-6 bg-muted/50">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Récapitulatif
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Société :</span>
              <span className="font-medium">{companyData.company_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">SIRET :</span>
              <span className="font-medium">{companyData.siret || 'Non renseigné'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email :</span>
              <span className="font-medium">{companyData.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Admin :</span>
              <span className="font-medium">{adminData.full_name} ({adminData.email})</span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}