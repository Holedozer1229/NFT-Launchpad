import { LaunchChecklist } from "@/components/LaunchChecklist";
import { MintTimeline } from "@/components/MintTimeline";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Settings, Download } from "lucide-react";
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
             <h1 className="font-heading font-bold text-xl">Creator Dashboard</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
               <Download className="w-4 h-4 mr-2" />
               Export Snapshot
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
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="mint">Mint Configuration</TabsTrigger>
            <TabsTrigger value="metadata">Metadata & IPFS</TabsTrigger>
            <TabsTrigger value="legal">Legal & Royalties</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid md:grid-cols-3 gap-6">
               <Card>
                 <CardHeader className="pb-2">
                   <CardDescription>Total Revenue</CardDescription>
                   <CardTitle className="text-3xl font-heading">34.56 ETH</CardTitle>
                 </CardHeader>
                 <CardContent>
                   <div className="text-xs text-muted-foreground">+12% from last hour</div>
                 </CardContent>
               </Card>
               <Card>
                 <CardHeader className="pb-2">
                   <CardDescription>Minted Supply</CardDescription>
                   <CardTitle className="text-3xl font-heading">432 / 1000</CardTitle>
                 </CardHeader>
                 <CardContent>
                   <div className="text-xs text-muted-foreground">43.2% sold out</div>
                 </CardContent>
               </Card>
               <Card>
                 <CardHeader className="pb-2">
                   <CardDescription>Unique Holders</CardDescription>
                   <CardTitle className="text-3xl font-heading">312</CardTitle>
                 </CardHeader>
                 <CardContent>
                   <div className="text-xs text-muted-foreground">High distribution</div>
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
                 <CardTitle>Mint Phases</CardTitle>
                 <CardDescription>Manage your mint schedule and pricing</CardDescription>
               </CardHeader>
               <CardContent>
                 <div className="h-40 flex items-center justify-center text-muted-foreground border border-dashed rounded-lg">
                   Mock Mint Configuration Panel
                 </div>
               </CardContent>
             </Card>
          </TabsContent>
          
          <TabsContent value="metadata">
             <Card>
               <CardHeader>
                 <CardTitle>IPFS Status</CardTitle>
                 <CardDescription>View content availability</CardDescription>
               </CardHeader>
               <CardContent>
                 <div className="h-40 flex items-center justify-center text-muted-foreground border border-dashed rounded-lg">
                   Mock Metadata Panel
                 </div>
               </CardContent>
             </Card>
          </TabsContent>
          
           <TabsContent value="legal">
             <Card>
               <CardHeader>
                 <CardTitle>Compliance Settings</CardTitle>
                 <CardDescription>Update Terms of Service and Royalty enforcement</CardDescription>
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
