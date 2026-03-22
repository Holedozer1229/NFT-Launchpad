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
  RefreshCw, Settings, Cpu, Network, Vault, Zap, Fuel, Atom,
  PickaxeIcon, Power, AlertCircle, Activity, BookOpen, Clock, Hash
} from "lucide-react";

interface EngineStatus {
  id: string;
  label: string;
  running: boolean;
  epochCount: number | null;
  lastActivity: number | null;
  detail: string;
}

interface EngineStatusResponse {
  engines: EngineStatus[];
  timestamp: number;
}

const ENGINE_ICONS: Record<string, React.ReactNode> = {
  "iit-engine":         <Cpu className="w-4 h-4" />,
  "p2p-network":        <Network className="w-4 h-4" />,
  "p2p-ledger":         <BookOpen className="w-4 h-4" />,
  "treasury-yield":     <Vault className="w-4 h-4" />,
  "btc-zk-daemon":      <Zap className="w-4 h-4" />,
  "self-fund-sentinel": <Fuel className="w-4 h-4" />,
  "price-driver":       <Activity className="w-4 h-4" />,
  "dyson-sphere":       <Atom className="w-4 h-4" />,
};

const SETTING_META: Record<string, { label: string; hint: string }> = {
  "price_driver.target_price_usd":  { label: "Target Price (USD)",        hint: "e.g. 0.65"   },
  "price_driver.burn_ratio":        { label: "Burn Ratio (0–1)",           hint: "e.g. 0.30"   },
  "price_driver.max_eth_per_epoch": { label: "Max ETH / Epoch",            hint: "e.g. 0.005"  },
  "price_driver.epoch_interval_ms": { label: "Epoch Interval (ms)",        hint: "e.g. 300000" },
  "iit_engine.enabled":             { label: "IIT Engine Enabled",         hint: "true/false"  },
  "p2p_network.enabled":            { label: "P2P Network Enabled",        hint: "true/false"  },
  "treasury_yield.enabled":         { label: "Treasury Yield Enabled",     hint: "true/false"  },
  "btc_zk_daemon.enabled":          { label: "BTC ZK Daemon Enabled",      hint: "true/false"  },
  "self_fund_sentinel.enabled":     { label: "OIYE Sentinel Enabled",      hint: "true/false"  },
  "dyson_sphere.enabled":           { label: "Dyson Sphere Enabled",       hint: "true/false"  },
};

function timeAgo(ts: number | null): string {
  if (!ts) return "—";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function EngineCard({ engine, onRestart, isRestarting }: {
  engine: EngineStatus;
  onRestart: (id: string) => void;
  isRestarting: boolean;
}) {
  const icon = ENGINE_ICONS[engine.id] ?? <Cpu className="w-4 h-4" />;

  return (
    <Card className="bg-card/60 border-border/40" data-testid={`engine-card-${engine.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className={`p-2 rounded-md mt-0.5 shrink-0 ${engine.running ? "bg-primary/10 text-primary" : "bg-muted/40 text-muted-foreground"}`}>
              {icon}
            </div>
            <div className="min-w-0">
              <div className="font-mono text-sm font-semibold text-foreground">{engine.label}</div>
              <div className="text-xs text-muted-foreground mt-0.5 truncate" title={engine.detail}>{engine.detail}</div>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <Badge
                  variant="outline"
                  className={`text-xs font-mono ${engine.running
                    ? "border-green-500/30 text-green-400"
                    : "border-red-500/30 text-red-400"
                  }`}
                  data-testid={`status-badge-${engine.id}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full inline-block mr-1.5 ${engine.running ? "bg-green-400 animate-pulse" : "bg-red-400"}`} />
                  {engine.running ? "running" : "stopped"}
                </Badge>
                {engine.epochCount !== null && (
                  <span className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                    <Hash className="w-3 h-3" />
                    {engine.epochCount}
                  </span>
                )}
                {engine.lastActivity !== null && (
                  <span className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {timeAgo(engine.lastActivity)}
                  </span>
                )}
              </div>
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
              ? <RefreshCw className="w-3 h-3 animate-spin" />
              : <Power className="w-3 h-3" />}
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

  const { data: statusData, isLoading: statusLoading } = useQuery<EngineStatusResponse>({
    queryKey: ["/api/admin/engines/status"],
    refetchInterval: 10_000,
  });

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
    onSuccess: (_data: any, engineName: string) => {
      toast({ title: "Engine restarted", description: `${engineName} successfully restarted.` });
      setRestartingEngine(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/engines/status"] });
    },
    onError: (err: any) => {
      toast({ title: "Restart failed", description: err.message, variant: "destructive" });
      setRestartingEngine(null);
    },
  });

  const saveSetting = async (key: string) => {
    const value = editValues[key];
    if (value === undefined) return;
    setSavingKey(key);
    try {
      await apiRequest("PUT", "/api/admin/settings", { key, value });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/engines/status"] });
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
  const engines = statusData?.engines ?? [];

  const runningCount = engines.filter(e => e.running).length;
  const totalCount   = engines.length;

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
            Live engine status · restart controls · hot-reload protocol settings
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!statusLoading && (
            <Badge variant="outline" className={`font-mono text-xs ${runningCount === totalCount ? "border-green-500/30 text-green-400" : "border-amber-500/30 text-amber-400"}`}>
              {runningCount}/{totalCount} engines running
            </Badge>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ["/api/admin/engines/status"] });
              queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
            }}
            data-testid="refresh-all"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Live Engine Status Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-mono text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Live Engine Status
          </h2>
          <span className="text-xs text-muted-foreground font-mono">auto-refresh 10s</span>
        </div>

        {statusLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="bg-card/40 border-border/30 animate-pulse">
                <CardContent className="p-4 h-24" />
              </Card>
            ))}
          </div>
        ) : engines.length === 0 ? (
          <div className="text-sm text-muted-foreground font-mono">No engine data available</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {engines.map(engine => (
              <EngineCard
                key={engine.id}
                engine={engine}
                onRestart={handleRestart}
                isRestarting={restartingEngine === engine.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Protocol Settings */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-mono text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Protocol Settings (Hot-Reload)
          </h2>
          <span className="text-xs text-muted-foreground font-mono">price driver reloads each epoch</span>
        </div>

        {settingsLoading ? (
          <div className="text-sm text-muted-foreground font-mono animate-pulse">Loading from DB…</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(SETTING_META).map(([key, meta]) => {
              const currentValue = settings[key] ?? "";
              const editedValue  = editValues[key];
              const displayValue = editedValue !== undefined ? editedValue : currentValue;
              const row = rows.find(r => r.key === key);
              const isDirty = editedValue !== undefined && editedValue !== currentValue;

              return (
                <Card key={key} className="bg-card/60 border-border/40" data-testid={`setting-card-${key}`}>
                  <CardContent className="p-4 space-y-2">
                    <div className="font-mono text-xs text-primary">{key}</div>
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
                        Unsaved
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* All Settings Table */}
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
                      <tr key={row.key} className="border-b border-border/20 hover:bg-muted/10" data-testid={`settings-row-${row.key}`}>
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
