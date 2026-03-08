import { lazy, Suspense } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
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
const SphinxOracle = lazy(() => import("@/components/SphinxOracle"));
import { QuantumMiner } from "@/components/QuantumMiner";

function BridgeGate() {
  const { data: nfts, isLoading } = useQuery<any[]>({ queryKey: ["/api/nfts"] });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const mintedCount = nfts?.length ?? 0;
  if (mintedCount < 10) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-4">
        <div className="max-w-md w-full border border-red-500/20 bg-red-500/5 backdrop-blur-sm rounded-lg p-8 text-center space-y-6">
          <div className="mx-auto w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
            <ShieldAlert className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h2 className="text-2xl font-bold font-heading text-foreground">Bridge Locked</h2>
            <p className="text-muted-foreground mt-2 text-sm">
              Mint at least 10 NFTs to unlock the SphinxBridge.
            </p>
          </div>
          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <p className="text-xs font-mono uppercase tracking-widest text-primary mb-2">Progress</p>
            <p className="text-2xl font-heading font-bold text-foreground">{mintedCount} / 10 NFTs</p>
          </div>
          <a href="/">
            <button className="w-full mt-2 py-2.5 rounded-sm font-heading text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors" data-testid="button-mint-to-unlock">
              Mint NFTs to Unlock
            </button>
          </a>
        </div>
      </div>
    );
  }

  return <Bridge />;
}

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
            <Route path="/bridge">
              <BridgeGate />
            </Route>
            <Route path="/yield" component={YieldGenerator} />
            <Route path="/iit" component={IITConsciousness} />
            <Route path="/serpent" component={OmegaSerpent} />
            <Route path="/starship" component={StarshipLaunches} />
            <Route path="/genesis-miner" component={GenesisMiner} />
            <Route path="/wormhole" component={ZkWormhole} />
            <Route path="/rarity-proof" component={RarityProofEngine} />
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
