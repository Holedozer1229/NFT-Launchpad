import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { MetaMaskSDK } from "@metamask/sdk";
import { 
  Vault, Shield, Wallet, CreditCard, Activity, 
  Settings, CheckCircle2, AlertCircle, Loader2,
  Lock, ArrowRight, Zap, RefreshCw, Layers, FileCode2,
  ExternalLink, Copy, Fuel, TrendingUp, TrendingDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const NEON = {
  cyan: "#00e5ff",
  green: "#39ff14",
  orange: "#ff6d00",
  purple: "#b388ff",
  pink: "#ff4081",
  gold: "#ffd740",
};

const keyFormSchema = z.object({
  privateKey: z.string().min(64, "Private key must be at least 64 characters (hex)").max(66, "Invalid private key length"),
});

export default function TreasuryVault() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [sdk, setSdk] = useState<any>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const { data: walletInfo, isLoading: isLoadingWallet } = useQuery({
    queryKey: ["/api/treasury/wallet"],
  });

  const { data: yieldStats } = useQuery({
    queryKey: ["/api/treasury/yield"],
  });

  const { data: contractsInfo } = useQuery({
    queryKey: ["/api/deployments/contracts"],
  });

  const { data: transactions } = useQuery({
    queryKey: ["/api/treasury/wallet/transactions"],
    enabled: !!walletInfo?.isConfigured,
  });

  const form = useForm<z.infer<typeof keyFormSchema>>({
    resolver: zodResolver(keyFormSchema),
    defaultValues: {
      privateKey: "",
    },
  });

  const setKeyMutation = useMutation({
    mutationFn: async (values: z.infer<typeof keyFormSchema>) => {
      const res = await apiRequest("POST", "/api/treasury/wallet/set-key", values);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/treasury/wallet"] });
      toast({ title: "Treasury Key Configured", description: "The treasury wallet is now active for this session." });
      form.reset();
    },
    onError: (err: Error) => {
      toast({ title: "Configuration Failed", description: err.message, variant: "destructive" });
    },
  });

  const sweepGasMutation = useMutation({
    mutationFn: async (force: boolean) => {
      const res = await apiRequest("POST", "/api/treasury/sweep-gas", { force });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/treasury/wallet"] });
      toast({ title: "Gas Swept", description: data.message });
    },
    onError: (err: Error) => {
      toast({ title: "Sweep Failed", description: err.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    const MMSDK = new MetaMaskSDK({
      dappMetadata: {
        name: "SKYNT Treasury Vault",
        url: window.location.href,
      },
    });
    setSdk(MMSDK);
  }, []);

  const connectMetaMask = async () => {
    if (!sdk) return;
    setIsConnecting(true);
    try {
      const accounts = await sdk.connect();
      if (accounts && accounts.length > 0) {
        setAccount(accounts[0]);
        toast({ title: "MetaMask Connected", description: `Vault session linked to ${accounts[0].slice(0, 6)}...${accounts[0].slice(-4)}` });
      }
    } catch (err: any) {
      toast({ title: "Connection Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsConnecting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: "Address copied to clipboard" });
  };

  const treasuryAddress = walletInfo?.address || "0x7Fbe68677e63272ECB55355a6778fCee974d4895";

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12" data-testid="treasury-vault-page">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading font-bold text-3xl flex items-center gap-3 text-primary neon-glow-cyan">
            <Vault className="w-8 h-8" /> TREASURY VAULT
          </h1>
          <p className="font-mono text-xs text-muted-foreground mt-1 uppercase tracking-widest">Autonomous Financial Oversight & Control</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant={account ? "outline" : "default"} 
            onClick={connectMetaMask} 
            disabled={isConnecting}
            className={!account ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border-primary/50 text-primary"}
            data-testid="button-metamask-connect"
          >
            {isConnecting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : account ? (
              <Shield className="w-4 h-4 mr-2" />
            ) : (
              <Wallet className="w-4 h-4 mr-2" />
            )}
            {account ? `${account.slice(0, 6)}...${account.slice(-4)}` : "CONNECT VAULT OWNER"}
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="cosmic-card cosmic-card-cyan border-none" data-testid="card-treasury-status">
          <CardHeader className="pb-2">
            <CardDescription className="font-mono text-[10px] uppercase text-cyan-400/70">Vault Status</CardDescription>
            <CardTitle className="flex items-center justify-between text-foreground">
              Core Engine
              {walletInfo?.isConfigured ? (
                <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30 gap-1 no-default-hover-elevate">
                  <CheckCircle2 className="w-3 h-3" /> ACTIVE
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-orange-500/10 text-orange-400 border-orange-500/30 gap-1 no-default-hover-elevate">
                  <AlertCircle className="w-3 h-3" /> STANDBY
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <p className="text-[10px] font-mono text-muted-foreground uppercase">Treasury Address</p>
              <div className="flex items-center justify-between bg-black/40 p-2 rounded border border-white/5">
                <code className="text-[11px] text-cyan-400 truncate">{treasuryAddress}</code>
                <button onClick={() => copyToClipboard(treasuryAddress)} className="text-muted-foreground hover:text-cyan-400 ml-2">
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-black/40 p-3 rounded border border-white/5">
                <p className="text-[9px] font-mono text-muted-foreground uppercase">ETH Balance</p>
                <p className="text-xl font-heading text-foreground mt-1">
                  {walletInfo?.balance ? (parseFloat(walletInfo.balance) / 1e18).toFixed(4) : "0.0000"}
                </p>
              </div>
              <div className="bg-black/40 p-3 rounded border border-white/5">
                <p className="text-[9px] font-mono text-muted-foreground uppercase">SKYNT Fuel</p>
                <p className="text-xl font-heading text-neon-green mt-1">
                  {yieldStats?.treasuryBalance || "0.00"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cosmic-card cosmic-card-purple border-none md:col-span-2" data-testid="card-yield-stats">
          <CardHeader className="pb-2">
            <CardDescription className="font-mono text-[10px] uppercase text-purple-400/70">Yield Telemetry</CardDescription>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Activity className="w-5 h-5 text-purple-400" /> Treasury Growth Engine
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="space-y-1">
                <p className="text-[10px] font-mono text-muted-foreground uppercase">Total Yield</p>
                <p className="text-2xl font-heading text-foreground">{yieldStats?.totalYieldGenerated || "0.00"} <span className="text-xs text-muted-foreground">SKYNT</span></p>
                <p className="text-[10px] text-green-400 flex items-center gap-1 font-mono">
                  <Zap className="w-3 h-3" /> +12.4% APY
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-mono text-muted-foreground uppercase">Phi Boost</p>
                <p className="text-2xl font-heading text-purple-400">{yieldStats?.phiBoost || "1.00"}x</p>
                <p className="text-[10px] text-muted-foreground font-mono">Consciousness Multiplier</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-mono text-muted-foreground uppercase">Staked Stacks</p>
                <p className="text-2xl font-heading text-foreground">12.5k <span className="text-xs text-muted-foreground">STX</span></p>
                <p className="text-[10px] text-muted-foreground font-mono">PoX Delegation Active</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-mono text-muted-foreground uppercase">Engine Cycles</p>
                <p className="text-2xl font-heading text-foreground">8,442</p>
                <p className="text-[10px] text-muted-foreground font-mono">Uptime: 99.9%</p>
              </div>
            </div>
            
            <div className="mt-6 h-1 w-full bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-purple-500 to-cyan-500 w-[72%]" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <Tabs defaultValue="operations" className="w-full">
            <TabsList className="bg-black/40 border border-white/10 w-full justify-start p-1 h-auto mb-4">
              <TabsTrigger value="operations" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary px-4 py-2 text-xs font-mono uppercase tracking-widest">Vault Ops</TabsTrigger>
              <TabsTrigger value="history" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary px-4 py-2 text-xs font-mono uppercase tracking-widest">Transaction Log</TabsTrigger>
              <TabsTrigger value="deployment" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary px-4 py-2 text-xs font-mono uppercase tracking-widest">Contract Registry</TabsTrigger>
            </TabsList>
            
            <TabsContent value="operations" className="space-y-6 mt-0">
              <Card className="bg-black/40 border-white/10" data-testid="card-key-configuration">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Lock className="w-4 h-4 text-orange-400" /> Private Key Authorization
                  </CardTitle>
                  <CardDescription className="text-xs font-mono">Secure session key enabling on-chain autonomous minting and reward payouts.</CardDescription>
                </CardHeader>
                <CardContent>
                  {walletInfo?.isConfigured ? (
                    <div className="space-y-4" data-testid="vault-auto-initialized">
                      <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                        <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
                        <div>
                          <p className="font-heading text-sm text-green-400 font-bold tracking-wider">ENGINE AUTO-INITIALIZED</p>
                          <p className="font-mono text-[10px] text-muted-foreground mt-0.5">Treasury key loaded from environment — on-chain transactions active.</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg bg-black/40 border border-white/5">
                          <p className="font-mono text-[9px] text-muted-foreground uppercase mb-1">Mode</p>
                          <p className="font-mono text-xs text-green-400 font-bold">MAINNET LIVE</p>
                        </div>
                        <div className="p-3 rounded-lg bg-black/40 border border-white/5">
                          <p className="font-mono text-[9px] text-muted-foreground uppercase mb-1">Chain</p>
                          <p className="font-mono text-xs text-cyan-400 font-bold">Ethereum Mainnet</p>
                        </div>
                        <div className="p-3 rounded-lg bg-black/40 border border-white/5">
                          <p className="font-mono text-[9px] text-muted-foreground uppercase mb-1">Auto-Payout</p>
                          <p className="font-mono text-xs text-neon-green font-bold">ENABLED</p>
                        </div>
                        <div className="p-3 rounded-lg bg-black/40 border border-white/5">
                          <p className="font-mono text-[9px] text-muted-foreground uppercase mb-1">Session</p>
                          <p className="font-mono text-xs text-foreground font-bold">PERSISTENT</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                  <>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit((v) => setKeyMutation.mutate(v))} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="privateKey"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] uppercase font-mono text-muted-foreground">Admin Secret Key (0x...)</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input 
                                  type="password" 
                                  placeholder="0x..." 
                                  className="bg-black/60 border-white/10 font-mono text-xs pr-10" 
                                  data-testid="input-private-key"
                                  {...field} 
                                />
                                <Lock className="absolute right-3 top-2.5 w-4 h-4 text-muted-foreground/50" />
                              </div>
                            </FormControl>
                            <FormMessage className="text-[10px]" />
                          </FormItem>
                        )}
                      />
                      <Button 
                        type="submit" 
                        className="w-full bg-orange-600 hover:bg-orange-500 text-white font-heading text-xs tracking-widest uppercase py-6"
                        disabled={setKeyMutation.isPending}
                        data-testid="button-save-key"
                      >
                        {setKeyMutation.isPending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Shield className="w-4 h-4 mr-2" />
                        )}
                        AUTHORIZE VAULT ENGINE
                      </Button>
                    </form>
                  </Form>
                  <div className="mt-4 p-3 rounded bg-orange-500/5 border border-orange-500/20 flex gap-3">
                    <AlertCircle className="w-5 h-5 text-orange-400 shrink-0" />
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      <span className="text-orange-400 font-bold">TIP:</span> Set TREASURY_PRIVATE_KEY as an environment secret to auto-initialize the vault engine on every startup.
                    </p>
                  </div>
                  </>
                  )}
                </CardContent>
              </Card>

              {/* Gas Tank */}
              <Card className="bg-black/40 border-white/10" data-testid="card-gas-tank">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Fuel className="w-4 h-4 text-yellow-400" /> Gas Tank
                  </CardTitle>
                  <CardDescription className="text-xs font-mono">Self-funding ETH reserve for on-chain transactions.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(() => {
                    const gas = walletInfo?.gasStatus;
                    if (!gas) return (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                        <Loader2 className="w-3 h-3 animate-spin" /> Checking gas balance…
                      </div>
                    );
                    const isHealthy = gas.isHealthy;
                    const isCritical = gas.isCritical;
                    const pct = Math.min(100, (gas.ethBalanceFloat / (gas.reserveThreshold * 2)) * 100);
                    return (
                      <>
                        <div className={`flex items-center gap-3 p-3 rounded-lg border ${isCritical ? "bg-red-500/10 border-red-500/30" : isHealthy ? "bg-green-500/10 border-green-500/30" : "bg-yellow-500/10 border-yellow-500/30"}`}>
                          {isCritical ? (
                            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                          ) : isHealthy ? (
                            <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-yellow-400 shrink-0" />
                          )}
                          <p className={`font-mono text-[10px] leading-relaxed ${isCritical ? "text-red-300" : isHealthy ? "text-green-300" : "text-yellow-300"}`}>
                            {gas.message}
                          </p>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div className="p-3 rounded-lg bg-black/40 border border-white/5 col-span-1">
                            <p className="font-mono text-[9px] text-muted-foreground uppercase mb-1">ETH Balance</p>
                            <p className={`font-mono text-sm font-bold ${isCritical ? "text-red-400" : isHealthy ? "text-green-400" : "text-yellow-400"}`}>
                              {gas.ethBalance}
                            </p>
                            <p className="font-mono text-[8px] text-muted-foreground mt-0.5">ETH</p>
                          </div>
                          <div className="p-3 rounded-lg bg-black/40 border border-white/5 col-span-1">
                            <p className="font-mono text-[9px] text-muted-foreground uppercase mb-1">Min Reserve</p>
                            <p className="font-mono text-sm font-bold text-cyan-400">{gas.reserveThreshold}</p>
                            <p className="font-mono text-[8px] text-muted-foreground mt-0.5">ETH</p>
                          </div>
                          <div className="p-3 rounded-lg bg-black/40 border border-white/5 col-span-1">
                            <p className="font-mono text-[9px] text-muted-foreground uppercase mb-1">Critical</p>
                            <p className="font-mono text-sm font-bold text-orange-400">{gas.criticalThreshold}</p>
                            <p className="font-mono text-[8px] text-muted-foreground mt-0.5">ETH</p>
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="font-mono text-[9px] text-muted-foreground uppercase">Gas Reserve Level</span>
                            <span className="font-mono text-[9px] text-muted-foreground">{pct.toFixed(0)}%</span>
                          </div>
                          <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-700 ${isCritical ? "bg-red-500" : pct > 60 ? "bg-green-500" : "bg-yellow-500"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>

                        <div className="p-3 rounded-lg bg-black/40 border border-white/5">
                          <p className="font-mono text-[9px] text-muted-foreground uppercase mb-1">Treasury Address</p>
                          <div className="flex items-center gap-2">
                            <p className="font-mono text-[10px] text-foreground truncate flex-1">{gas.treasuryAddress}</p>
                            <a
                              href={`https://etherscan.io/address/${gas.treasuryAddress}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0"
                              data-testid="link-treasury-etherscan"
                            >
                              <ExternalLink className="w-3 h-3 text-cyan-400 hover:text-cyan-300" />
                            </a>
                          </div>
                          {isCritical && (
                            <p className="font-mono text-[9px] text-red-400 mt-2 leading-relaxed">
                              Send ETH to this address or sweep mining pool to restore gas funding.
                            </p>
                          )}
                        </div>

                        {/* Mining Gas Refill Pool */}
                        {walletInfo?.refillPool && (
                          <div className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20 space-y-2">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-mono text-[9px] text-yellow-400 uppercase font-bold">Mining Gas Pool</p>
                                <p className="font-mono text-xs text-foreground font-bold mt-0.5">
                                  {walletInfo.refillPool.poolEth.toFixed(6)} ETH accumulated
                                </p>
                                <p className="font-mono text-[8px] text-muted-foreground mt-0.5">
                                  Sweep threshold: {walletInfo.refillPool.threshold} ETH
                                </p>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10 font-mono text-[9px] uppercase shrink-0"
                                onClick={() => sweepGasMutation.mutate(walletInfo.refillPool!.poolEth >= walletInfo.refillPool!.threshold)}
                                disabled={sweepGasMutation.isPending || walletInfo.refillPool.poolEth <= 0}
                                data-testid="button-sweep-mining-gas"
                              >
                                {sweepGasMutation.isPending ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Fuel className="w-3 h-3 mr-1" />
                                )}
                                Sweep
                              </Button>
                            </div>
                            <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-yellow-500 rounded-full transition-all duration-700"
                                style={{ width: `${Math.min(100, (walletInfo.refillPool.poolEth / walletInfo.refillPool.threshold) * 100)}%` }}
                              />
                            </div>
                            <p className="font-mono text-[8px] text-muted-foreground">
                              ETH auto-accumulates every mining cycle — auto-sweeps when gas is critical.
                            </p>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  className="h-auto py-4 flex flex-col gap-2 items-center border-white/10 hover:bg-cyan-500/10 hover:text-cyan-400"
                  data-testid="button-sweep-eth"
                  disabled={sweepGasMutation.isPending}
                  onClick={() => sweepGasMutation.mutate(true)}
                >
                  {sweepGasMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                  <span className="text-[10px] font-mono uppercase">Sweep ETH Fees</span>
                </Button>
                <Button variant="outline" className="h-auto py-4 flex flex-col gap-2 items-center border-white/10 hover:bg-purple-500/10 hover:text-purple-400" data-testid="button-rebalance">
                  <Layers className="w-5 h-5" />
                  <span className="text-[10px] font-mono uppercase">Rebalance Yield</span>
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="history" className="mt-0">
              <Card className="bg-black/40 border-white/10 overflow-hidden" data-testid="card-tx-history">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Financial Audit Trail</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left font-mono text-[10px]">
                      <thead>
                        <tr className="bg-white/5 text-muted-foreground uppercase tracking-wider">
                          <th className="px-4 py-3 font-medium">Type</th>
                          <th className="px-4 py-3 font-medium">Value</th>
                          <th className="px-4 py-3 font-medium">Asset</th>
                          <th className="px-4 py-3 font-medium">Counterparty</th>
                          <th className="px-4 py-3 font-medium text-right">Block</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {transactions && transactions.length > 0 ? (
                          transactions.map((tx: any, i: number) => (
                            <tr key={tx.hash || i} className="hover:bg-white/5 transition-colors group">
                              <td className="px-4 py-3">
                                <span className="flex items-center gap-2">
                                  <ArrowRight className="w-3 h-3 text-cyan-400" />
                                  {tx.category?.toUpperCase() || "EXTERNAL"}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-foreground font-bold">{tx.value?.toFixed(4) || "0.0000"}</td>
                              <td className="px-4 py-3 text-cyan-400">{tx.asset || "ETH"}</td>
                              <td className="px-4 py-3 text-muted-foreground truncate max-w-[120px]">
                                {tx.to?.slice(0, 10)}...
                              </td>
                              <td className="px-4 py-3 text-right text-muted-foreground">
                                <div className="flex items-center justify-end gap-2">
                                  {tx.blockNum}
                                  <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-primary cursor-pointer" />
                                </div>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground italic">
                              {walletInfo?.isConfigured ? "No recent transactions found" : "Authorize engine to view transaction audit"}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="deployment" className="mt-0">
              <div className="grid sm:grid-cols-2 gap-4">
                {contractsInfo?.contracts?.map((contract: any) => (
                  <Card key={contract.id} className="bg-black/40 border-white/10 hover:border-cyan-500/30 transition-all group" data-testid={`card-contract-${contract.id}`}>
                    <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded bg-cyan-500/10 text-cyan-400">
                          <FileCode2 className="w-4 h-4" />
                        </div>
                        <div>
                          <CardTitle className="text-xs font-heading tracking-widest">{contract.name}</CardTitle>
                          <p className="text-[9px] font-mono text-muted-foreground truncate max-w-[150px]">{contract.description}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[8px] bg-green-500/10 text-green-400 border-green-500/20 no-default-hover-elevate">VERIFIED</Badge>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="flex items-center justify-between font-mono text-[9px] text-muted-foreground">
                        <span>Compiler: 0.8.20</span>
                        <span>Gas: {Math.round(contract.estimatedGas.min / 1000)}k-{(contract.estimatedGas.max / 1000).toFixed(0)}k</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-black/40 border-white/10" data-testid="card-governance-summary">
            <CardHeader>
              <CardTitle className="text-lg">Governance Thresholds</CardTitle>
              <CardDescription className="text-xs font-mono">Multi-sig requirements and spending limits.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">Authorization Quorum</span>
                  <span className="text-xs font-bold text-foreground">5 of 9</span>
                </div>
                <div className="w-full bg-white/5 h-1.5 rounded-full">
                  <div className="bg-cyan-500 h-full w-5/9 rounded-full shadow-[0_0_8px_rgba(0,229,255,0.5)]" />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">Daily Spend Limit</span>
                  <span className="text-xs font-bold text-foreground">2.5 ETH / 10.0 ETH</span>
                </div>
                <div className="w-full bg-white/5 h-1.5 rounded-full">
                  <div className="bg-purple-500 h-full w-[25%] rounded-full shadow-[0_0_8px_rgba(179,136,255,0.5)]" />
                </div>
              </div>

              <Separator className="bg-white/5" />
              
              <div className="space-y-3">
                <p className="text-[10px] font-mono text-muted-foreground uppercase">Active Guardians</p>
                <div className="flex flex-wrap gap-2">
                  {["Alpha", "Beta", "Gamma", "Delta", "Epsilon"].map(g => (
                    <Badge key={g} variant="outline" className="bg-cyan-500/5 text-cyan-400 border-cyan-500/20 text-[9px] no-default-hover-elevate">
                      {g} Centauri
                    </Badge>
                  ))}
                  <Badge variant="outline" className="bg-white/5 text-muted-foreground border-white/10 text-[9px] no-default-hover-elevate">
                    +4 Guardians
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-primary/10 to-purple-500/10 border-primary/20" data-testid="card-oracle-insights">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-heading flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" /> ORACLE INSIGHTS
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[11px] text-muted-foreground italic leading-relaxed">
                "The treasury's Phi-resonance is currently peaking at 1.84x. This indicates high alignment between cross-chain yield flows and network consciousness. Recommend maintaining current Stacks delegation to maximize ergotropy."
              </p>
              <div className="mt-4 flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                  <Activity className="w-3 h-3 text-primary" />
                </div>
                <span className="text-[9px] font-mono text-primary uppercase font-bold">Sphinx Oracle v3.4</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
