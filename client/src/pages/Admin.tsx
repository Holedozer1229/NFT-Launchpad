import { LaunchChecklist } from "@/components/LaunchChecklist";
import { MintTimeline } from "@/components/MintTimeline";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Settings, Download, Rocket, Activity } from "lucide-react";

export default function Admin() {
  return (
    <div data-testid="admin-page">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-heading font-bold text-2xl flex items-center gap-3 text-primary neon-glow-cyan">
            <Rocket className="w-6 h-6" /> Mission Control
          </h1>
          <p className="font-mono text-xs text-muted-foreground mt-1">System administration & configuration</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="border-border/50 text-muted-foreground hover:text-foreground" data-testid="button-flight-log">
            <Download className="w-4 h-4 mr-2" />
            Flight Log
          </Button>
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" data-testid="button-settings">
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-8">
        <TabsList className="bg-muted/30 border border-border/50">
          <TabsTrigger value="overview" data-testid="tab-flight-status">Flight Status</TabsTrigger>
          <TabsTrigger value="mint" data-testid="tab-mission-config">Mission Config</TabsTrigger>
          <TabsTrigger value="metadata" data-testid="tab-payload">Payload (Metadata)</TabsTrigger>
          <TabsTrigger value="cross-chain" data-testid="tab-mining">Mining (StarLord 2)</TabsTrigger>
          <TabsTrigger value="legal" data-testid="tab-legal">Legal Telemetry</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid md:grid-cols-4 gap-6">
            <div className="cosmic-card cosmic-card-cyan p-5" data-testid="stat-revenue">
              <p className="stat-label">Total Fuel (Revenue)</p>
              <p className="stat-value text-neon-cyan mt-1">34.56 ETH</p>
              <p className="stat-change positive mt-2">+12% from last hour</p>
            </div>
            <div className="cosmic-card cosmic-card-green p-5" data-testid="stat-deployed">
              <p className="stat-label">Patches Deployed</p>
              <p className="stat-value text-neon-green mt-1">2,100 / 2,500</p>
              <p className="text-xs text-muted-foreground mt-2">Unified Mainnet Live</p>
            </div>
            <div className="cosmic-card cosmic-card-orange p-5" data-testid="stat-holders">
              <p className="stat-label">Crew Size (Holders)</p>
              <p className="stat-value text-neon-orange mt-1">1,842</p>
              <p className="text-xs text-muted-foreground mt-2">StarLord 2 Distributed</p>
            </div>
            <div className="cosmic-card cosmic-card-magenta p-5" data-testid="stat-zk">
              <p className="stat-label">ZK-Proof Chain</p>
              <p className="stat-value text-neon-green mt-1">VERIFIED</p>
              <p className="text-xs text-neon-green font-mono mt-2">State Root Valid</p>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6 h-[400px]">
            <div className="md:col-span-2 h-full cosmic-card p-0 overflow-hidden">
              <MintTimeline />
            </div>
            <div className="h-full cosmic-card p-0 overflow-hidden">
              <LaunchChecklist />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="mint">
          <div className="cosmic-card p-6">
            <h3 className="font-heading text-lg text-primary mb-2">Launch Parameters</h3>
            <p className="text-xs text-muted-foreground font-mono mb-6">Configure mission details, pricing, and orbital supply.</p>
            <div className="h-40 flex items-center justify-center text-muted-foreground border border-dashed border-border/50 rounded-lg">
              <div className="text-center space-y-2">
                <Settings className="w-8 h-8 mx-auto text-primary/20" />
                <p className="text-xs">Mission configuration panel — connect to deploy</p>
              </div>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="metadata">
          <div className="cosmic-card p-6">
            <h3 className="font-heading text-lg text-primary mb-2">Payload Integration</h3>
            <p className="text-xs text-muted-foreground font-mono mb-6">Verify IPFS pinning status and reveal timestamps.</p>
            <div className="h-40 flex items-center justify-center text-muted-foreground border border-dashed border-border/50 rounded-lg">
              <div className="text-center space-y-2">
                <Download className="w-8 h-8 mx-auto text-primary/20" />
                <p className="text-xs">IPFS metadata verification — awaiting pin</p>
              </div>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="cross-chain">
          <div className="cosmic-card p-6">
            <h3 className="font-heading text-lg text-primary mb-2">Unified Mining Analytics</h3>
            <p className="text-xs text-muted-foreground font-mono mb-6">Cross-chain contribution weight and rewards reconciliation.</p>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 border border-border/50 rounded-lg bg-black/40 font-mono text-xs space-y-1">
                <span className="text-muted-foreground">EMISSION_RATE (Et):</span>
                <span className="text-primary block">a*Gt + b*St</span>
              </div>
              <div className="p-4 border border-border/50 rounded-lg bg-black/40 font-mono text-xs space-y-1">
                <span className="text-muted-foreground">CHAIN_STATE (S_c,t):</span>
                <span className="text-primary block">Sum 1_chain(i)=c * ai(t)</span>
              </div>
            </div>
            <div className="h-40 flex items-center justify-center text-muted-foreground border border-dashed border-border/50 rounded-lg bg-primary/5">
              <Activity className="w-8 h-8 animate-pulse text-primary/20" />
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="legal">
          <div className="cosmic-card p-6">
            <h3 className="font-heading text-lg text-primary mb-2">Compliance Telemetry</h3>
            <p className="text-xs text-muted-foreground font-mono mb-6">Review disclaimers and royalty enforcement settings.</p>
            <div className="h-40 flex items-center justify-center text-muted-foreground border border-dashed border-border/50 rounded-lg">
              <div className="text-center space-y-2">
                <Activity className="w-8 h-8 mx-auto text-primary/20" />
                <p className="text-xs">Compliance telemetry — monitoring active</p>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
