import { LaunchChecklist } from "@/components/LaunchChecklist";
import { MintTimeline } from "@/components/MintTimeline";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Settings, Download, Rocket } from "lucide-react";
import { Link } from "wouter";

export default function Admin() {
  return (
    <div className="min-h-screen bg-muted/10">
       <nav className="border-b bg-background">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
             <Link href="/">
               <Button variant="ghost" size="icon">
                 <ArrowLeft className="w-4 h-4" />
               </Button>
             </Link>
             <h1 className="font-heading font-bold text-xl flex items-center gap-2">
               <Rocket className="w-5 h-5" /> Mission Control
             </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
               <Download className="w-4 h-4 mr-2" />
               Flight Log
            </Button>
            <Button variant="ghost" size="icon">
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="overview" className="space-y-8">
          <TabsList>
            <TabsTrigger value="overview">Flight Status</TabsTrigger>
            <TabsTrigger value="mint">Mission Config</TabsTrigger>
            <TabsTrigger value="metadata">Payload (Metadata)</TabsTrigger>
            <TabsTrigger value="cross-chain">Mining (StarLord 2)</TabsTrigger>
            <TabsTrigger value="legal">Legal Telemetry</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid md:grid-cols-4 gap-6">
               <Card>
                 <CardHeader className="pb-2">
                   <CardDescription>Total Fuel (Revenue)</CardDescription>
                   <CardTitle className="text-3xl font-heading">34.56 ETH</CardTitle>
                 </CardHeader>
                 <CardContent>
                   <div className="text-xs text-muted-foreground">+12% from last hour</div>
                 </CardContent>
               </Card>
               <Card>
                 <CardHeader className="pb-2">
                   <CardDescription>Patches Deployed</CardDescription>
                   <CardTitle className="text-3xl font-heading">2,100 / 2,500</CardTitle>
                 </CardHeader>
                 <CardContent>
                   <div className="text-xs text-muted-foreground">Unified Mainnet Live</div>
                 </CardContent>
               </Card>
               <Card>
                 <CardHeader className="pb-2">
                   <CardDescription>Crew Size (Holders)</CardDescription>
                   <CardTitle className="text-3xl font-heading">1,842</CardTitle>
                 </CardHeader>
                 <CardContent>
                   <div className="text-xs text-muted-foreground">StarLord 2 Distributed</div>
                 </CardContent>
               </Card>
               <Card>
                 <CardHeader className="pb-2">
                   <CardDescription>ZK-Proof Chain</CardDescription>
                   <CardTitle className="text-3xl font-heading">VERIFIED</CardTitle>
                 </CardHeader>
                 <CardContent>
                   <div className="text-xs text-green-500 font-mono">State Root Valid</div>
                 </CardContent>
               </Card>
            </div>

            <div className="grid md:grid-cols-3 gap-6 h-[400px]">
              <div className="md:col-span-2 h-full">
                <MintTimeline />
              </div>
              <div className="h-full">
                <LaunchChecklist />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="mint">
             <Card>
               <CardHeader>
                 <CardTitle>Launch Parameters</CardTitle>
                 <CardDescription>Configure mission details, pricing, and orbital supply.</CardDescription>
               </CardHeader>
               <CardContent>
                 <div className="h-40 flex items-center justify-center text-muted-foreground border border-dashed rounded-lg">
                   Mock Mission Config Panel
                 </div>
               </CardContent>
             </Card>
          </TabsContent>
          
          <TabsContent value="metadata">
             <Card>
               <CardHeader>
                 <CardTitle>Payload Integration</CardTitle>
                 <CardDescription>Verify IPFS pinning status and reveal timestamps.</CardDescription>
               </CardHeader>
               <CardContent>
                 <div className="h-40 flex items-center justify-center text-muted-foreground border border-dashed rounded-lg">
                   Mock Metadata Panel
                 </div>
               </CardContent>
             </Card>
          </TabsContent>
          
           <TabsContent value="cross-chain">
             <Card>
               <CardHeader>
                 <CardTitle>Unified Mining Analytics</CardTitle>
                 <CardDescription>Cross-chain contribution weight and rewards reconciliation.</CardDescription>
               </CardHeader>
               <CardContent className="space-y-4">
                 <div className="grid grid-cols-2 gap-4">
                   <div className="p-4 border rounded-lg bg-black/40 font-mono text-xs space-y-1">
                     <span className="text-muted-foreground">EMISSION_RATE (Eₜ):</span>
                     <span className="text-primary block">α·Gₜ + β·Sₜ</span>
                   </div>
                   <div className="p-4 border rounded-lg bg-black/40 font-mono text-xs space-y-1">
                     <span className="text-muted-foreground">CHAIN_STATE (S_c,t):</span>
                     <span className="text-primary block">Σ 1_chain(i)=c · aᵢ(t)</span>
                   </div>
                 </div>
                 <div className="h-40 flex items-center justify-center text-muted-foreground border border-dashed rounded-lg bg-primary/5">
                   <Activity className="w-8 h-8 animate-pulse text-primary/20" />
                 </div>
               </CardContent>
             </Card>
          </TabsContent>
          
          <TabsContent value="legal">
             <Card>
               <CardHeader>
                 <CardTitle>Compliance Telemetry</CardTitle>
                 <CardDescription>Review disclaimers and royalty enforcement settings.</CardDescription>
               </CardHeader>
               <CardContent>
                 <div className="h-40 flex items-center justify-center text-muted-foreground border border-dashed rounded-lg">
                   Mock Legal Panel
                 </div>
               </CardContent>
             </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
