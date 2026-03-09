import { lazy, Suspense } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import SidebarLayout from "@/components/SidebarLayout";
import AuthPage from "@/pages/AuthPage";
import PageTransition from "@/components/PageTransition";
import OfflineBanner from "@/components/OfflineBanner";
import { Loader2, ShieldAlert } from "lucide-react";

const MintNFT = lazy(() => import("@/pages/MintNFT"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Gallery = lazy(() => import("@/pages/Gallery"));
const Analytics = lazy(() => import("@/pages/Analytics"));
const Bridge = lazy(() => import("@/pages/Bridge"));
const YieldGenerator = lazy(() => import("@/pages/YieldGenerator"));
const IITConsciousness = lazy(() => import("@/pages/IITConsciousness"));
const Admin = lazy(() => import("@/pages/Admin"));
const Marketplace = lazy(() => import("@/pages/Marketplace"));
const OmegaSerpent = lazy(() => import("@/pages/OmegaSerpent"));
const WalletPage = lazy(() => import("@/pages/WalletPage"));
const StarshipLaunches = lazy(() => import("@/pages/StarshipLaunches"));
const PublicLab = lazy(() => import("@/pages/PublicLab"));
const NotFound = lazy(() => import("@/pages/not-found"));
const GenesisMiner = lazy(() => import("@/pages/GenesisMiner"));
const ZkWormhole = lazy(() => import("@/pages/ZkWormhole"));
const RarityProofEngine = lazy(() => import("@/pages/RarityProofEngine"));
const P2PNetworkPage = lazy(() => import("@/pages/P2PNetwork"));
const RocketBabesNFT = lazy(() => import("@/pages/RocketBabesNFT"));
const ContractDeployment = lazy(() => import("@/pages/ContractDeployment"));
const TreasuryVault = lazy(() => import("@/pages/TreasuryVault"));
const QuantumBerryPhase = lazy(() => import("@/pages/QuantumBerryPhase"));
const SphinxOracle = lazy(() => import("@/components/SphinxOracle"));
import { QuantumMiner } from "@/components/QuantumMiner";

function AdminGuard() {
  const { user } = useAuth();
  if (!user?.isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4" data-testid="admin-denied">
        <ShieldAlert className="w-12 h-12 text-red-400" />
        <h2 className="font-heading text-xl font-bold text-foreground">Access Restricted</h2>
        <p className="font-mono text-xs text-muted-foreground">Admin clearance required to access Mission Control.</p>
      </div>
    );
  }
  return <Admin />;
}

function TreasuryVaultGuard() {
  const { user } = useAuth();
  if (!user?.isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4" data-testid="treasury-denied">
        <ShieldAlert className="w-12 h-12 text-red-400" />
        <h2 className="font-heading text-xl font-bold text-foreground">Treasury Access Restricted</h2>
        <p className="font-mono text-xs text-muted-foreground">Admin clearance required to access Treasury Vault.</p>
      </div>
    );
  }
  return <TreasuryVault />;
}

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[30vh]">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );
}

function AppRouter() {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen cosmic-bg flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="font-mono text-xs text-muted-foreground">Initializing protocol...</p>
        </div>
      </div>
    );
  }

  if (location === "/lab") {
    return (
      <SidebarLayout>
        <PageTransition key={location}>
          <Suspense fallback={<PageLoader />}>
            <PublicLab />
          </Suspense>
        </PageTransition>
      </SidebarLayout>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <SidebarLayout>
      <PageTransition key={location}>
        <Suspense fallback={<PageLoader />}>
          <Switch>
            <Route path="/" component={MintNFT} />
            <Route path="/dashboard" component={Dashboard} />
            <Route path="/lab" component={PublicLab} />
            <Route path="/gallery" component={Gallery} />
            <Route path="/marketplace" component={Marketplace} />
            <Route path="/analytics" component={Analytics} />
            <Route path="/bridge" component={Bridge} />
            <Route path="/yield" component={YieldGenerator} />
            <Route path="/iit" component={IITConsciousness} />
            <Route path="/berry-phase" component={QuantumBerryPhase} />
            <Route path="/serpent" component={OmegaSerpent} />
            <Route path="/starship" component={StarshipLaunches} />
            <Route path="/genesis-miner" component={GenesisMiner} />
            <Route path="/wormhole" component={ZkWormhole} />
            <Route path="/rarity-proof" component={RarityProofEngine} />
            <Route path="/p2p-network" component={P2PNetworkPage} />
            <Route path="/rocket-babes" component={RocketBabesNFT} />
            <Route path="/contracts" component={ContractDeployment} />
            <Route path="/treasury" component={TreasuryVaultGuard} />
            <Route path="/wallet" component={WalletPage} />
            <Route path="/admin" component={AdminGuard} />
            <Route component={NotFound} />
          </Switch>
        </Suspense>
      </PageTransition>
      <Suspense fallback={null}>
        <SphinxOracle />
      </Suspense>
      <QuantumMiner minimized={location !== "/"} />
    </SidebarLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <OfflineBanner />
            <Toaster />
            <AppRouter />
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
