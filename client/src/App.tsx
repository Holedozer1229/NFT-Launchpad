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
import Admin from "@/pages/Admin";
import AuthPage from "@/pages/AuthPage";
import NotFound from "@/pages/not-found";
import { Loader2 } from "lucide-react";

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
        <Route path="/" component={Dashboard} />
        <Route path="/mint" component={MintNFT} />
        <Route path="/gallery" component={Gallery} />
        <Route path="/analytics" component={Analytics} />
        <Route path="/bridge" component={Bridge} />
        <Route path="/admin" component={Admin} />
        <Route component={NotFound} />
      </Switch>
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
