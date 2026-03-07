import { ReactNode, useState } from "react";
import { useLocation, Link } from "wouter";
import { Gem, LayoutDashboard, Sparkles, Image, BarChart3, ArrowLeftRight, Shield, ChevronLeft, ChevronRight, Menu, X, Wallet, LogOut, User, TrendingUp, WalletCards, Brain, Gamepad2, Store, Flame, FlaskConical, Pickaxe } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useActiveAccount, useActiveWallet, useDisconnect } from "thirdweb/react";
import { ConnectButton } from "thirdweb/react";
import { thirdwebClient } from "@/lib/thirdweb";
import { createWallet, inAppWallet } from "thirdweb/wallets";
import { ethereum, polygon, base } from "thirdweb/chains";
import DynamicBackground from "@/components/DynamicBackground";
import { NotificationCenter } from "@/components/NotificationCenter";
import { OnboardingTour } from "@/components/OnboardingTour";
import { ThemeToggle } from "@/components/ThemeToggle";

const navItems = [
  { path: "/", label: "Mint NFT", icon: Sparkles, adminOnly: false },
  { path: "/lab", label: "Public Lab", icon: FlaskConical, adminOnly: false },
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard, adminOnly: false },
  { path: "/gallery", label: "Gallery", icon: Image, adminOnly: false },
  { path: "/marketplace", label: "Marketplace", icon: Store, adminOnly: false },
  { path: "/analytics", label: "Analytics", icon: BarChart3, adminOnly: false },
  { path: "/bridge", label: "Bridge", icon: ArrowLeftRight, adminOnly: false },
  { path: "/yield", label: "Yield", icon: TrendingUp, adminOnly: false },
  { path: "/iit", label: "IIT Consciousness", icon: Brain, adminOnly: false },
  { path: "/starship", label: "Starship", icon: Flame, adminOnly: false },
  { path: "/serpent", label: "Omega Serpent", icon: Gamepad2, adminOnly: false },
  { path: "/wallet", label: "Wallet", icon: WalletCards, adminOnly: false },
  { path: "/admin", label: "Admin", icon: Shield, adminOnly: true },
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
  const account = useActiveAccount();
  const activeWallet = useActiveWallet();
  const { disconnect: twDisconnect } = useDisconnect();
  const isConnected = !!account;
  const address = account?.address ?? null;
  const { user, logout } = useAuth();

  return (
    <div className="flex h-screen w-screen overflow-hidden cosmic-bg">
      <DynamicBackground />
      <StarField />

      <button
        data-testid="button-mobile-menu"
        className="fixed top-4 left-4 z-50 md:hidden p-2 rounded-sm bg-[hsl(var(--sidebar-bg))] border border-[hsl(var(--sidebar-border))] text-foreground"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
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

        <nav className="flex-1 py-4 space-y-1 overflow-y-auto" data-testid="sidebar-nav">
          {navItems.filter((item) => !item.adminOnly || user?.isAdmin).map((item) => {
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
        </nav>

        <MinerStatusBadge collapsed={collapsed} />

        <div className={`p-3 border-t border-[hsl(var(--sidebar-border))] ${collapsed ? "flex justify-center" : ""}`}>
          {isConnected ? (
            <div className={`${collapsed ? "" : "px-1"}`}>
              <div className="flex items-center gap-2">
                <span className="shrink-0 relative">
                  {activeWallet?.id === "app.phantom" ? "👻" : "🦊"}
                  <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-neon-green border border-black" />
                </span>
                {!collapsed && (
                  <span className="font-mono text-[11px] text-foreground truncate flex-1">
                    {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ""}
                  </span>
                )}
                <button
                  data-testid="button-disconnect-wallet"
                  onClick={() => activeWallet && twDisconnect(activeWallet)}
                  className="text-muted-foreground hover:text-red-400 transition-colors shrink-0"
                  title="Disconnect Wallet"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          ) : (
            <div className={`space-y-1.5 ${collapsed ? "[&_button]:!p-2 [&_button]:!min-w-0" : ""}`} data-testid="sidebar-connect-wallet">
              <ConnectButton
                client={thirdwebClient}
                wallets={[
                  createWallet("io.metamask"),
                  createWallet("app.phantom"),
                  createWallet("com.coinbase.wallet"),
                  inAppWallet(),
                ]}
                chains={[ethereum, polygon, base]}
                theme="dark"
                connectButton={{
                  label: collapsed ? "🔗" : "Connect Wallet",
                  style: {
                    width: "100%",
                    fontSize: "12px",
                    fontFamily: "monospace",
                    padding: collapsed ? "8px" : "10px 16px",
                  },
                }}
                connectModal={{
                  title: "SKYNT Protocol",
                  titleIcon: "",
                  size: "compact",
                }}
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

      <main className="flex-1 overflow-y-auto relative z-10 p-6 md:p-8" data-testid="main-content">
        {children}
      </main>

      <OnboardingTour />
    </div>
  );
}

function MinerStatusBadge({ collapsed }: { collapsed: boolean }) {
  const { data } = useQuery<{ isActive: boolean; hashRate: number; totalSkyntEarned: number }>({
    queryKey: ["/api/mining/status"],
    refetchInterval: 10000,
  });

  if (!data?.isActive) return null;

  return (
    <div className={`mx-2 mb-2 px-2 py-1.5 rounded border border-neon-green/30 bg-neon-green/5 ${collapsed ? "flex justify-center" : ""}`} data-testid="sidebar-miner-status">
      <div className="flex items-center gap-1.5">
        <Pickaxe className="w-3 h-3 text-neon-green animate-pulse shrink-0" />
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <div className="font-mono text-[9px] text-neon-green truncate">{data.hashRate} H/s | {data.totalSkyntEarned.toFixed(2)} SKYNT</div>
          </div>
        )}
      </div>
    </div>
  );
}
