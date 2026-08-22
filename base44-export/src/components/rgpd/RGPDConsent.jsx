import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Shield, X } from 'lucide-react';

const STORAGE_KEY = 'rgpd_consent_v1';

export default function RGPDConsent() {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(STORAGE_KEY);
    if (!consent) setVisible(true);
  }, []);

  const accept = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ accepted: true, date: new Date().toISOString() }));
    setVisible(false);
  };

  const refuse = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ accepted: false, date: new Date().toISOString() }));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] p-4">
      <div className="max-w-4xl mx-auto bg-card border border-border rounded-2xl shadow-2xl p-5">
        {showDetails ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold">
                <Shield className="w-5 h-5 text-primary" />
                Politique de confidentialité & RGPD
              </div>
              <button onClick={() => setShowDetails(false)}><X className="w-4 h-4" /></button>
            </div>
            <div className="text-sm text-muted-foreground space-y-2 max-h-64 overflow-y-auto pr-2">
              <p><strong>Responsable du traitement :</strong> La société de sécurité utilisant cette plateforme.</p>
              <p><strong>Données collectées :</strong> Données d'identification (nom, email), données de géolocalisation des agents en service, données opérationnelles (rondes, pointages NFC), données de gestion RH.</p>
              <p><strong>Finalités :</strong> Gestion des opérations de sécurité, suivi des agents, génération de rapports clients, facturation.</p>
              <p><strong>Base légale :</strong> Exécution du contrat de travail (art. 6.1.b RGPD) et intérêts légitimes de l'entreprise (art. 6.1.f RGPD).</p>
              <p><strong>Géolocalisation :</strong> Uniquement pendant les heures de service, avec information préalable des agents. Données conservées 3 mois.</p>
              <p><strong>Conservation :</strong> Données RH conservées pendant la durée légale (5 ans), données opérationnelles 1 an.</p>
              <p><strong>Vos droits :</strong> Accès, rectification, effacement, limitation, portabilité. Contactez votre responsable RH.</p>
              <p><strong>Sécurité :</strong> Données chiffrées en transit (TLS) et au repos. Accès restreint par rôle.</p>
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" size="sm" onClick={refuse}>Refuser</Button>
              <Button size="sm" onClick={accept}>Accepter</Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <Shield className="w-8 h-8 text-primary shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold">Ce logiciel traite des données personnelles</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Conformément au RGPD, des données personnelles (agents, clients, géolocalisation) sont traitées pour les besoins opérationnels de sécurité.{' '}
                <button onClick={() => setShowDetails(true)} className="text-primary underline">En savoir plus</button>
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={refuse}>Refuser</Button>
              <Button size="sm" onClick={accept}>J'ai compris</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}