import { Switch, Route } from "wouter";
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
import AuthPage from "@/pages/AuthPage";
import NotFound from "@/pages/not-found";
import SphinxOracle from "@/components/SphinxOracle";
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

  if (!user) {
    return <AuthPage />;
  }

  return (
    <SidebarLayout>
      <Switch>
        <Route path="/" component={MintNFT} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/gallery" component={Gallery} />
        <Route path="/marketplace" component={Marketplace} />
        <Route path="/analytics" component={Analytics} />
        <Route path="/bridge" component={Bridge} />
        <Route path="/yield" component={YieldGenerator} />
        <Route path="/iit" component={IITConsciousness} />
        <Route path="/serpent" component={OmegaSerpent} />
        <Route path="/wallet" component={WalletPage} />
        <Route path="/admin" component={AdminGuard} />
        <Route component={NotFound} />
      </Switch>
      <SphinxOracle />
    </SidebarLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <AppRouter />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
