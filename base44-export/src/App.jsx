import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

import AppLayout from '@/components/layout/AppLayout';
import Dashboard from '@/pages/Dashboard';
import PlanningAvance from '@/pages/PlanningAvance';
import Missions from '@/pages/Missions';
import Agents from '@/pages/Agents';
import Clients from '@/pages/Clients';
import Sites from '@/pages/Sites';
import HeuresSites from '@/pages/HeuresSites';
import Facturation from '@/pages/Facturation';
import MainCourantePage from '@/pages/MainCourantePage';
import Rondes from '@/pages/Rondes.jsx';
import EspaceAgent from '@/pages/EspaceAgent';
import EspaceClient from '@/pages/EspaceClient';
import Alertes from '@/pages/Alertes';
import Demandes from '@/pages/Demandes';
import Documents from '@/pages/Documents';
import CarteTempsReel from '@/pages/CarteTempsReel';
import InviterUtilisateurs from '@/pages/InviterUtilisateurs';
import Conges from '@/pages/Conges';
import ParametresSociete from '@/pages/ParametresSociete';
import CahierConsignesPage from '@/pages/CahierConsignesPage';
import OnboardingSociete from '@/pages/OnboardingSociete';
import Contrats from '@/pages/Contrats';
import BonsIntervention from '@/pages/BonsIntervention';
import GestionRH from '@/pages/GestionRH';
import EcartsHoraires from '@/pages/EcartsHoraires';
import PointsControle from '@/pages/PointsControle';
import HeuresCollaborateurs from '@/pages/HeuresCollaborateurs';
import RapportsPDF from '@/pages/RapportsPDF';
import Leads from '@/pages/Leads';
import Login from '@/pages/Login';
import AcceptInvitation from '@/pages/AcceptInvitation';
import SuperAdmin from '@/pages/SuperAdmin';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') return <UserNotRegisteredError />;
    if (authError.type === 'auth_required') { navigateToLogin(); return null; }
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/planning" element={<PlanningAvance />} />
        <Route path="/missions" element={<Missions />} />
        <Route path="/agents" element={<Agents />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/sites" element={<Sites />} />
        <Route path="/heures-sites" element={<HeuresSites />} />
        <Route path="/facturation" element={<Facturation />} />
        <Route path="/main-courante" element={<MainCourantePage />} />
        <Route path="/rondes" element={<Rondes />} />
        <Route path="/espace-agent" element={<EspaceAgent />} />
        <Route path="/espace-client" element={<EspaceClient />} />
        <Route path="/alertes" element={<Alertes />} />
        <Route path="/demandes" element={<Demandes />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/carte" element={<CarteTempsReel />} />
        <Route path="/inviter" element={<InviterUtilisateurs />} />
        <Route path="/conges" element={<Conges />} />
        <Route path="/parametres-societe" element={<ParametresSociete />} />
        <Route path="/cahier-consignes" element={<CahierConsignesPage />} />
        <Route path="/onboarding" element={<OnboardingSociete />} />
        <Route path="/contrats" element={<Contrats />} />
        <Route path="/bons-intervention" element={<BonsIntervention />} />
        <Route path="/gestion-rh" element={<GestionRH />} />
        <Route path="/ecarts-horaires" element={<EcartsHoraires />} />
        <Route path="/points-controle" element={<PointsControle />} />
        <Route path="/heures-collaborateurs" element={<HeuresCollaborateurs />} />
        <Route path="/rapports-pdf" element={<RapportsPDF />} />
        <Route path="/leads" element={<Leads />} />
        <Route path="/super-admin" element={<SuperAdmin />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/invitation/:token" element={<AcceptInvitation />} />
            <Route path="/*" element={<AuthenticatedApp />} />
          </Routes>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App