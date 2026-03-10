import { ReactNode, useState } from "react";
import { useLocation, Link } from "wouter";
import { Gem, LayoutDashboard, Sparkles, Image, BarChart3, ArrowLeftRight, Shield, ChevronLeft, ChevronRight, Menu, X, Wallet, LogOut, User, TrendingUp, WalletCards, Brain, Gamepad2, Store, Flame, FlaskConical, Pickaxe, Power, PowerOff, Coins, Hash, ChevronUp, Orbit, ShieldCheck, Globe, Rocket, FileCode2, Vault } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useAccount, useDisconnect } from "wagmi";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import DynamicBackground from "@/components/DynamicBackground";
import { NotificationCenter } from "@/components/NotificationCenter";
import { OnboardingTour } from "@/components/OnboardingTour";
import { ThemeToggle } from "@/components/ThemeToggle";

const navGroups = [
  {
    label: "CORE",
    items: [
      { path: "/", label: "Mint NFT", icon: Sparkles, adminOnly: false },
      { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard, adminOnly: false },
      { path: "/gallery", label: "Gallery", icon: Image, adminOnly: false },
      { path: "/marketplace", label: "Marketplace", icon: Store, adminOnly: false },
      { path: "/rocket-babes", label: "RocketBabes", icon: Rocket, adminOnly: false },
    ]
  },
  {
    label: "EARN",
    items: [
      { path: "/genesis-miner", label: "Genesis Miner", icon: Pickaxe, adminOnly: false },
      { path: "/yield", label: "Yield", icon: TrendingUp, adminOnly: false },
      { path: "/serpent", label: "Omega Serpent", icon: Gamepad2, adminOnly: false },
    ]
  },
  {
    label: "NETWORK",
    items: [
      { path: "/bridge", label: "Bridge", icon: ArrowLeftRight, adminOnly: false },
      { path: "/wormhole", label: "ZK Wormhole", icon: Orbit, adminOnly: false },
      { path: "/p2p-network", label: "P2P Network", icon: Globe, adminOnly: false },
      { path: "/iit", label: "IIT Consciousness", icon: Brain, adminOnly: false },
      { path: "/berry-phase", label: "Berry Phase", icon: Orbit, adminOnly: false },
    ]
  },
  {
    label: "TOOLS",
    items: [
      { path: "/analytics", label: "Analytics", icon: BarChart3, adminOnly: false },
      { path: "/rarity-proof", label: "Rarity Proof", icon: ShieldCheck, adminOnly: false },
      { path: "/starship", label: "Starship", icon: Flame, adminOnly: false },
      { path: "/lab", label: "Public Lab", icon: FlaskConical, adminOnly: false },
    ]
  },
  {
    label: "SYSTEM",
    items: [
      { path: "/contracts", label: "Contracts", icon: FileCode2, adminOnly: false },
      { path: "/treasury", label: "Treasury", icon: Vault, adminOnly: true },
      { path: "/wallet", label: "Wallet", icon: WalletCards, adminOnly: false },
      { path: "/admin", label: "Admin", icon: Shield, adminOnly: true },
    ]
  },
];

const starData = Array.from({ length: 80 }, (_, i) => ({
  id: i,
  width: Math.random() * 2 + 1,
  top: Math.random() * 100,
  left: Math.random() * 100,
  opacity: Math.random() * 0.7 + 0.1,
  duration: Math.random() * 4 + 2,
  delay: Math.random() * 3,
}));

function StarField() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {starData.map((s) => (
        <div
          key={s.id}
          className="absolute rounded-full bg-white"
          style={{
            width: `${s.width}px`,
            height: `${s.width}px`,
            top: `${s.top}%`,
            left: `${s.left}%`,
            opacity: s.opacity,
            animation: `twinkle ${s.duration}s ease-in-out infinite`,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

export default function SidebarLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { address, isConnected, connector } = useAccount();
  const { disconnect: twDisconnect } = useDisconnect();
  const { user, logout } = useAuth();

  return (
    <div className="flex h-screen w-screen overflow-hidden cosmic-bg">
      <DynamicBackground />
      <StarField />

      <button
        data-testid="button-mobile-menu"
        className="fixed top-4 left-4 z-50 md:hidden p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-sm bg-[hsl(var(--sidebar-bg))] border border-[hsl(var(--sidebar-border))] text-foreground"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        data-testid="sidebar"
        className={`
          fixed md:relative z-40 h-full flex flex-col
          bg-[hsl(var(--sidebar-bg))] border-r border-[hsl(var(--sidebar-border))]
          transition-all duration-300 ease-in-out
          ${collapsed ? "w-16" : "w-56"}
          ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        <div className={`flex items-center gap-2 px-4 py-5 border-b border-[hsl(var(--sidebar-border))] ${collapsed ? "justify-center" : ""}`}>
          <Gem className="w-6 h-6 text-neon-cyan shrink-0" style={{ filter: "drop-shadow(0 0 6px hsl(185 100% 50% / 0.6))" }} />
          {!collapsed && (
            <div className="flex-1">
              <div className="font-heading text-sm font-bold tracking-widest text-foreground" data-testid="text-logo-title">SKYNT</div>
              <div className="text-[10px] font-mono text-muted-foreground tracking-wider">PROTOCOL</div>
            </div>
          )}
          {!collapsed ? <NotificationCenter /> : <NotificationCenter collapsed />}
        </div>

        <nav className="flex-1 py-4 space-y-4 overflow-y-auto scrollbar-none" data-testid="sidebar-nav">
          {navGroups.map((group, groupIdx) => {
            const visibleItems = group.items.filter((item) => !item.adminOnly || user?.isAdmin);
            if (visibleItems.length === 0) return null;

            return (
              <div key={group.label} className="space-y-1">
                {!collapsed && (
                  <div className="px-4 py-2">
                    {groupIdx > 0 && <div className="h-px bg-[hsl(var(--sidebar-border))] mb-2 opacity-50" />}
                    <h3 className="text-[9px] font-heading uppercase tracking-widest text-muted-foreground/40 font-bold">
                      {group.label}
                    </h3>
                  </div>
                )}
                <div className="space-y-1">
                  {visibleItems.map((item) => {
                    const isActive = location === item.path;
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.path}
                        href={item.path}
                        data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                        className={`sidebar-nav-item ${isActive ? "active" : ""} ${collapsed ? "justify-center px-2" : ""}`}
                        onClick={() => setMobileOpen(false)}
                        title={collapsed ? item.label : undefined}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        {!collapsed && <span>{item.label}</span>}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <PersistentMiner collapsed={collapsed} />

        <div className={`p-3 border-t border-[hsl(var(--sidebar-border))] ${collapsed ? "flex justify-center" : ""}`}>
          {isConnected ? (
            <div className={`${collapsed ? "" : "px-1"}`}>
              <div className="flex items-center gap-2">
                <span className="shrink-0 relative">
                  {connector?.name?.toLowerCase().includes("phantom") ? "👻" : "🦊"}
                  <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-neon-green border border-black" />
                </span>
                {!collapsed && (
                  <span className="font-mono text-[11px] text-foreground truncate flex-1">
                    {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ""}
                  </span>
                )}
                <button
                  data-testid="button-disconnect-wallet"
                  onClick={() => twDisconnect()}
                  className="text-muted-foreground hover:text-red-400 transition-colors shrink-0"
                  title="Disconnect Wallet"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          ) : (
            <div className={`space-y-1.5 ${collapsed ? "[&_button]:!p-2 [&_button]:!min-w-0" : ""}`} data-testid="sidebar-connect-wallet">
              <ConnectWalletButton
                showBalance={false}
                chainStatus="icon"
                accountStatus={collapsed ? "avatar" : "address"}
                label={collapsed ? "🔗" : "Connect Wallet"}
              />
            </div>
          )}
        </div>

        {user && (
          <div className={`p-3 border-t border-[hsl(var(--sidebar-border))] ${collapsed ? "flex flex-col items-center gap-2" : ""}`}>
            <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between"}`}>
              <div className="flex items-center gap-2 min-w-0">
                <User className="w-4 h-4 text-neon-cyan shrink-0" />
                {!collapsed && <span className="font-mono text-[11px] text-foreground truncate" data-testid="text-username">{user.username}</span>}
              </div>
              <button
                data-testid="button-logout"
                onClick={logout}
                className="text-muted-foreground hover:text-red-400 transition-colors shrink-0"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <div className={`flex items-center border-t border-[hsl(var(--sidebar-border))] ${collapsed ? "justify-center p-2" : "justify-between px-3 py-2"}`}>
          <ThemeToggle />
          {!collapsed && <span className="text-[9px] font-mono text-muted-foreground">Theme</span>}
        </div>

        <button
          data-testid="button-collapse-sidebar"
          className="hidden md:flex items-center justify-center py-2 border-t border-[hsl(var(--sidebar-border))] text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </aside>

      <main className="flex-1 overflow-y-auto relative z-10 p-4 pt-14 md:p-8 md:pt-8" data-testid="main-content">
        {children}
      </main>

      <OnboardingTour />
    </div>
  );
}

function PersistentMiner({ collapsed }: { collapsed: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);

  const { data: stats } = useQuery<{
    isActive: boolean;
    hashRate: number;
    totalSkyntEarned: number;
    blocksFound: number;
    currentPhiBoost: number;
    cyclesCompleted: number;
    uptimeSeconds: number;
    difficulty: number;
    streak: number;
    streakMultiplier: number;
  }>({
    queryKey: ["/api/mining/status"],
    refetchInterval: (query) => {
      const d = query.state.data;
      return d?.isActive ? 5000 : 30000;
    },
  });

  const startMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/mining/start");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mining/status"] });
      toast({ title: "Mining Started", description: "Background PoW mining is now active." });
    },
    onError: (err: Error) => {
      const msg = err.message.replace(/^\d+:\s*/, "");
      try {
        const parsed = JSON.parse(msg);
        toast({ title: "Cannot Start Mining", description: parsed.message, variant: "destructive" });
      } catch {
        toast({ title: "Cannot Start Mining", description: msg, variant: "destructive" });
      }
    },
  });

  const stopMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/mining/stop");
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/mining/status"] });
      const earned = data.stats?.totalSkyntEarned?.toFixed(4) || "0";
      toast({ title: "Mining Stopped", description: `Earned: ${earned} SKYNT` });
    },
  });

  const active = stats?.isActive || false;
  const pending = startMutation.isPending || stopMutation.isPending;

  const formatUptime = (s: number) => {
    const days = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    
    if (days > 0) return `${days}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  if (collapsed) {
    return (
      <div className="mx-1 mb-1" data-testid="sidebar-miner-panel">
        <button
          data-testid={active ? "button-stop-mining-sidebar" : "button-start-mining-sidebar"}
          onClick={() => active ? stopMutation.mutate() : startMutation.mutate()}
          disabled={pending}
          className={`w-full p-2 rounded border transition-all flex flex-col items-center justify-center gap-1 ${
            active
              ? "border-neon-green/40 bg-neon-green/10 text-neon-green"
              : "border-white/10 bg-white/5 text-muted-foreground hover:text-neon-green hover:border-neon-green/30"
          }`}
          title={active ? `Mining: ${stats?.totalSkyntEarned?.toFixed(2)} SKYNT | Streak: ${stats?.streak}` : "Start Mining"}
        >
          <Pickaxe className={`w-3.5 h-3.5 ${active ? "animate-pulse" : ""}`} />
          {active && stats && stats.streak > 0 && (
            <div className="flex items-center gap-0.5 text-[8px] font-bold">
              <Flame className="w-2 h-2 fill-orange-500 text-orange-500" />
              <span>{stats.streak}</span>
            </div>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className={`mx-2 mb-2 rounded border transition-all ${
      active ? "border-neon-green/30 bg-neon-green/5" : "border-white/10 bg-white/5"
    }`} data-testid="sidebar-miner-panel">
      <button
        className="w-full flex items-center justify-between px-2.5 py-2"
        onClick={() => setExpanded(!expanded)}
        data-testid="button-toggle-miner-details"
      >
        <div className="flex items-center gap-1.5">
          <Pickaxe className={`w-3 h-3 shrink-0 ${active ? "text-neon-green animate-pulse" : "text-muted-foreground"}`} />
          <span className="font-heading text-[10px] tracking-wider text-foreground">MINER</span>
          <span className={`text-[9px] font-mono px-1 rounded ${active ? "bg-neon-green/20 text-neon-green" : "text-muted-foreground"}`}>
            {active ? "ON" : "OFF"}
          </span>
          {active && stats && stats.streak > 0 && (
            <div className="flex items-center gap-0.5 text-[9px] text-orange-500 font-bold animate-pulse">
              <Flame className="w-2.5 h-2.5 fill-current" />
              <span>{stats.streakMultiplier.toFixed(1)}x</span>
            </div>
          )}
        </div>
        <ChevronUp className={`w-3 h-3 text-muted-foreground transition-transform ${expanded ? "" : "rotate-180"}`} />
      </button>

      {expanded && (
        <div className="px-2.5 pb-2.5 space-y-2">
          {active && stats && (
            <div className="space-y-1">
              <div className="flex justify-between text-[9px] font-mono">
                <span className="text-muted-foreground flex items-center gap-1"><Hash className="w-2.5 h-2.5" /> Hash</span>
                <span className="text-neon-cyan">{stats.hashRate} H/s</span>
              </div>
              {stats.streak > 0 && (
                <div className="flex justify-between text-[9px] font-mono">
                  <span className="text-muted-foreground flex items-center gap-1"><Flame className="w-2.5 h-2.5 text-orange-500" /> Streak</span>
                  <span className="text-orange-500 font-bold">{stats.streak} (x{stats.streakMultiplier.toFixed(2)})</span>
                </div>
              )}
              <div className="flex justify-between text-[9px] font-mono">
                <span className="text-muted-foreground flex items-center gap-1"><Coins className="w-2.5 h-2.5" /> Earned</span>
                <span className="text-neon-green">{stats.totalSkyntEarned.toFixed(4)} SKYNT</span>
              </div>
              <div className="flex justify-between text-[9px] font-mono">
                <span className="text-muted-foreground">Blocks</span>
                <span className="text-neon-orange">{stats.blocksFound}</span>
              </div>
              <div className="flex justify-between text-[9px] font-mono">
                <span className="text-muted-foreground">Φ Boost</span>
                <span className="text-amber-400">{stats.currentPhiBoost.toFixed(2)}x</span>
              </div>
              <div className="flex justify-between text-[9px] font-mono">
                <span className="text-muted-foreground">Uptime</span>
                <span className="text-foreground">{formatUptime(stats.uptimeSeconds)}</span>
              </div>
            </div>
          )}

          <button
            data-testid={active ? "button-stop-mining-sidebar" : "button-start-mining-sidebar"}
            onClick={() => active ? stopMutation.mutate() : startMutation.mutate()}
            disabled={pending}
            className={`w-full py-1.5 rounded text-[10px] font-heading tracking-wider flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 ${
              active
                ? "bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25"
                : "bg-neon-green/15 border border-neon-green/30 text-neon-green hover:bg-neon-green/25"
            }`}
          >
            {active ? <><PowerOff className="w-3 h-3" /> STOP</> : <><Power className="w-3 h-3" /> START</>}
          </button>
        </div>
      )}

      {!expanded && active && stats && (
        <div className="px-2.5 pb-2 text-[9px] font-mono text-neon-green truncate flex items-center gap-1">
          {stats.hashRate} H/s | {stats.totalSkyntEarned.toFixed(2)} SKYNT
          {stats.streak > 0 && <span className="text-orange-500 ml-auto">🔥 {stats.streak}</span>}
        </div>
      )}
    </div>
  );
}
