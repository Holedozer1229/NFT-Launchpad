import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  RefreshCw, Activity, Settings, Play, Square, Cpu, Network,
  Vault, Zap, Fuel, Atom, PickaxeIcon, Power, AlertCircle
} from "lucide-react";

interface EngineInfo {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  statusKey?: string;
}

const ENGINES: EngineInfo[] = [
  { id: "iit-engine",         label: "IIT Consciousness",    description: "Integrated Information Theory φ engine",             icon: <Cpu className="w-4 h-4" /> },
  { id: "p2p-network",        label: "P2P Network",          description: "Genesis peer-to-peer mesh network",                  icon: <Network className="w-4 h-4" /> },
  { id: "treasury-yield",     label: "Treasury Yield",       description: "Auto-compound yield & gas refill engine",            icon: <Vault className="w-4 h-4" /> },
  { id: "btc-zk-daemon",      label: "BTC ZK Daemon",        description: "Bitcoin AuxPoW + zkSync Era anchoring daemon",       icon: <Zap className="w-4 h-4" /> },
  { id: "self-fund-sentinel", label: "Self-Fund Sentinel",   description: "OIYE gas reserve sentinel & auto-funder",           icon: <Fuel className="w-4 h-4" /> },
  { id: "price-driver",       label: "Price Driver",         description: "SKYNT buyback & burn engine (Uniswap v3)",           icon: <Activity className="w-4 h-4" /> },
  { id: "background-miner",   label: "Background Miner",     description: "Multi-chain merge miner & fee accumulator",         icon: <PickaxeIcon className="w-4 h-4" /> },
  { id: "dyson-sphere",       label: "Dyson Sphere",         description: "Quantum gravity lattice evolution engine",           icon: <Atom className="w-4 h-4" /> },
];

const SETTING_META: Record<string, { label: string; hint: string; type: "number" | "text" | "boolean" }> = {
  "price_driver.target_price_usd": { label: "Target Price (USD)",       hint: "e.g. 0.65",   type: "number" },
  "price_driver.burn_ratio":       { label: "Burn Ratio (0–1)",         hint: "e.g. 0.30",   type: "number" },
  "price_driver.max_eth_per_epoch":{ label: "Max ETH / Epoch",          hint: "e.g. 0.005",  type: "number" },
  "price_driver.epoch_interval_ms":{ label: "Epoch Interval (ms)",      hint: "e.g. 300000", type: "number" },
  "iit_engine.enabled":            { label: "IIT Engine Enabled",       hint: "true/false",  type: "boolean" },
  "p2p_network.enabled":           { label: "P2P Network Enabled",      hint: "true/false",  type: "boolean" },
  "treasury_yield.enabled":        { label: "Treasury Yield Enabled",   hint: "true/false",  type: "boolean" },
  "btc_zk_daemon.enabled":         { label: "BTC ZK Daemon Enabled",    hint: "true/false",  type: "boolean" },
  "self_fund_sentinel.enabled":    { label: "Self-Fund Sentinel Enabled",hint: "true/false", type: "boolean" },
  "dyson_sphere.enabled":          { label: "Dyson Sphere Enabled",     hint: "true/false",  type: "boolean" },
};

function EngineCard({ engine, onRestart, isRestarting }: {
  engine: EngineInfo;
  onRestart: (id: string) => void;
  isRestarting: boolean;
}) {
  return (
    <Card className="bg-card/60 border-border/40" data-testid={`engine-card-${engine.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-md bg-primary/10 text-primary mt-0.5">
              {engine.icon}
            </div>
            <div>
              <div className="font-mono text-sm font-semibold text-foreground">{engine.label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{engine.description}</div>
              <Badge variant="outline" className="mt-1.5 text-xs font-mono border-green-500/30 text-green-400">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block mr-1.5 animate-pulse" />
                active
              </Badge>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
            onClick={() => onRestart(engine.id)}
            disabled={isRestarting}
            data-testid={`restart-${engine.id}`}
          >
            {isRestarting
              ? <RefreshCw className="w-3 h-3 animate-spin mr-1.5" />
              : <Power className="w-3 h-3 mr-1.5" />}
            Restart
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminEngines() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [restartingEngine, setRestartingEngine] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const { data: settingsData, isLoading: settingsLoading } = useQuery<{
    settings: Record<string, string>;
    rows: Array<{ key: string; value: string; updated_by: string; updated_at: string }>;
  }>({
    queryKey: ["/api/admin/settings"],
    refetchInterval: 30_000,
  });

  const restartMutation = useMutation({
    mutationFn: (engineName: string) =>
      apiRequest("POST", `/api/admin/engines/${engineName}/restart`),
    onSuccess: (_data, engineName) => {
      toast({ title: `Engine restarted`, description: `${engineName} successfully restarted.` });
      setRestartingEngine(null);
    },
    onError: (err: any, engineName) => {
      toast({ title: "Restart failed", description: err.message, variant: "destructive" });
      setRestartingEngine(null);
    },
  });

  const saveSetting = async (key: string) => {
    const value = editValues[key];
    if (value === undefined || value === null) return;
    setSavingKey(key);
    try {
      await apiRequest("PUT", "/api/admin/settings", { key, value });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast({ title: "Setting saved", description: `${key} = ${value}` });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSavingKey(null);
      setEditValues(prev => { const n = { ...prev }; delete n[key]; return n; });
    }
  };

  const handleRestart = (id: string) => {
    setRestartingEngine(id);
    restartMutation.mutate(id);
  };

  const settings = settingsData?.settings ?? {};
  const rows = settingsData?.rows ?? [];

  return (
    <div className="min-h-screen p-6 space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
            <Settings className="w-6 h-6 text-primary" />
            Engine Console
          </h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono">
            Restart engines & hot-reload protocol parameters from DB
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] })}
          data-testid="refresh-settings"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Refresh
        </Button>
      </div>

      {/* Engines Grid */}
      <div>
        <h2 className="font-mono text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Protocol Engines
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {ENGINES.map(engine => (
            <EngineCard
              key={engine.id}
              engine={engine}
              onRestart={handleRestart}
              isRestarting={restartingEngine === engine.id}
            />
          ))}
        </div>
      </div>

      {/* Protocol Settings */}
      <div>
        <h2 className="font-mono text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Protocol Settings (Hot-Reload)
        </h2>

        {settingsLoading ? (
          <div className="text-sm text-muted-foreground font-mono animate-pulse">Loading settings from DB…</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(SETTING_META).map(([key, meta]) => {
              const currentValue = settings[key] ?? "";
              const editedValue = editValues[key];
              const displayValue = editedValue !== undefined ? editedValue : currentValue;
              const row = rows.find(r => r.key === key);
              const isDirty = editedValue !== undefined && editedValue !== currentValue;
              return (
                <Card key={key} className="bg-card/60 border-border/40" data-testid={`setting-card-${key}`}>
                  <CardContent className="p-4 space-y-2">
                    <Label className="font-mono text-xs text-muted-foreground">{key}</Label>
                    <div className="font-semibold text-sm text-foreground">{meta.label}</div>
                    <div className="flex gap-2">
                      <Input
                        value={displayValue}
                        onChange={e => setEditValues(prev => ({ ...prev, [key]: e.target.value }))}
                        placeholder={meta.hint}
                        className="font-mono text-sm h-8"
                        data-testid={`input-setting-${key}`}
                      />
                      <Button
                        size="sm"
                        className="h-8 px-3"
                        disabled={!isDirty || savingKey === key}
                        onClick={() => saveSetting(key)}
                        data-testid={`save-setting-${key}`}
                      >
                        {savingKey === key ? <RefreshCw className="w-3 h-3 animate-spin" /> : "Save"}
                      </Button>
                    </div>
                    {row && (
                      <div className="text-xs text-muted-foreground font-mono">
                        by {row.updated_by} · {new Date(row.updated_at).toLocaleString()}
                      </div>
                    )}
                    {isDirty && (
                      <div className="flex items-center gap-1 text-xs text-amber-400">
                        <AlertCircle className="w-3 h-3" />
                        Unsaved change
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Raw Settings Table */}
      {rows.length > 0 && (
        <div>
          <h2 className="font-mono text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            All Protocol Settings
          </h2>
          <Card className="bg-card/60 border-border/40">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="border-b border-border/40">
                      <th className="text-left p-3 text-muted-foreground">Key</th>
                      <th className="text-left p-3 text-muted-foreground">Value</th>
                      <th className="text-left p-3 text-muted-foreground">Updated By</th>
                      <th className="text-left p-3 text-muted-foreground">Updated At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(row => (
                      <tr key={row.key} className="border-b border-border/20 hover:bg-muted/10">
                        <td className="p-3 text-primary">{row.key}</td>
                        <td className="p-3 text-foreground">{row.value}</td>
                        <td className="p-3 text-muted-foreground">{row.updated_by}</td>
                        <td className="p-3 text-muted-foreground">{new Date(row.updated_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
