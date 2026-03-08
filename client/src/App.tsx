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
import { AccessGate } from "@/components/AccessGate";
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
const SphinxOracle = lazy(() => import("@/components/SphinxOracle"));

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
            <Route path="/dashboard">
              <AccessGate requiredTier={1}>
                <Dashboard />
              </AccessGate>
            </Route>
            <Route path="/lab" component={PublicLab} />
            <Route path="/gallery">
              <AccessGate requiredTier={1}>
                <Gallery />
              </AccessGate>
            </Route>
            <Route path="/marketplace">
              <AccessGate requiredTier={2}>
                <Marketplace />
              </AccessGate>
            </Route>
            <Route path="/analytics">
              <AccessGate requiredTier={1}>
                <Analytics />
              </AccessGate>
            </Route>
            <Route path="/bridge">
              <AccessGate requiredTier={2}>
                <Bridge />
              </AccessGate>
            </Route>
            <Route path="/yield">
              <AccessGate requiredTier={3}>
                <YieldGenerator />
              </AccessGate>
            </Route>
            <Route path="/iit">
              <AccessGate requiredTier={3}>
                <IITConsciousness />
              </AccessGate>
            </Route>
            <Route path="/serpent">
              <AccessGate requiredTier={2}>
                <OmegaSerpent />
              </AccessGate>
            </Route>
            <Route path="/starship">
              <AccessGate requiredTier={4}>
                <StarshipLaunches />
              </AccessGate>
            </Route>
            <Route path="/genesis-miner">
              <AccessGate requiredTier={2}>
                <GenesisMiner />
              </AccessGate>
            </Route>
            <Route path="/wallet" component={WalletPage} />
            <Route path="/admin" component={AdminGuard} />
            <Route component={NotFound} />
          </Switch>
        </Suspense>
      </PageTransition>
      <Suspense fallback={null}>
        <SphinxOracle />
      </Suspense>
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
