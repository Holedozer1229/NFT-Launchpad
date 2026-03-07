import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import SidebarLayout from "@/components/SidebarLayout";
import Dashboard from "@/pages/Dashboard";
import MintNFT from "@/pages/MintNFT";
import Gallery from "@/pages/Gallery";
import Analytics from "@/pages/Analytics";
import Bridge from "@/pages/Bridge";
import YieldGenerator from "@/pages/YieldGenerator";
import IITConsciousness from "@/pages/IITConsciousness";
import Admin from "@/pages/Admin";
import Marketplace from "@/pages/Marketplace";
import OmegaSerpent from "@/pages/OmegaSerpent";
import WalletPage from "@/pages/WalletPage";
import StarshipLaunches from "@/pages/StarshipLaunches";
import PublicLab from "@/pages/PublicLab";
import AuthPage from "@/pages/AuthPage";
import NotFound from "@/pages/not-found";
import SphinxOracle from "@/components/SphinxOracle";
import PageTransition from "@/components/PageTransition";
import OfflineBanner from "@/components/OfflineBanner";
import { AccessGate } from "@/components/AccessGate";
import { Loader2, ShieldAlert } from "lucide-react";

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

  // Public Routes (Accessible without login)
  if (location === "/lab") {
    return (
      <SidebarLayout>
        <PageTransition key={location}>
          <PublicLab />
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
          <Route path="/wallet" component={WalletPage} />
          <Route path="/admin" component={AdminGuard} />
          <Route component={NotFound} />
        </Switch>
      </PageTransition>
      <SphinxOracle />
    </SidebarLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <OfflineBanner />
          <Toaster />
          <AppRouter />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
