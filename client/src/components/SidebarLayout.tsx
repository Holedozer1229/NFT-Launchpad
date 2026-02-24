import { ReactNode, useState } from "react";
import { useLocation, Link } from "wouter";
import { Gem, LayoutDashboard, Sparkles, Image, BarChart3, ArrowLeftRight, Shield, ChevronLeft, ChevronRight, Menu, X, Wallet, LogOut, User } from "lucide-react";
import { useWallet } from "@/lib/mock-web3";
import { useAuth } from "@/hooks/use-auth";

const navItems = [
  { path: "/", label: "Mint NFT", icon: Sparkles, adminOnly: false },
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard, adminOnly: false },
  { path: "/gallery", label: "Gallery", icon: Image, adminOnly: false },
  { path: "/analytics", label: "Analytics", icon: BarChart3, adminOnly: false },
  { path: "/bridge", label: "Bridge", icon: ArrowLeftRight, adminOnly: false },
  { path: "/admin", label: "Admin", icon: Shield, adminOnly: true },
];

function StarField() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {Array.from({ length: 80 }).map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            width: `${Math.random() * 2 + 1}px`,
            height: `${Math.random() * 2 + 1}px`,
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`,
            opacity: Math.random() * 0.7 + 0.1,
            animation: `twinkle ${Math.random() * 4 + 2}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 3}s`,
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
  const { isConnected, address, connect, isConnecting, disconnect } = useWallet();
  const { user, logout } = useAuth();

  return (
    <div className="flex h-screen w-screen overflow-hidden cosmic-bg">
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
            <div>
              <div className="font-heading text-sm font-bold tracking-widest text-foreground" data-testid="text-logo-title">SKYNT</div>
              <div className="text-[10px] font-mono text-muted-foreground tracking-wider">PROTOCOL</div>
            </div>
          )}
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

        <div className={`p-3 border-t border-[hsl(var(--sidebar-border))] ${collapsed ? "flex justify-center" : ""}`}>
          {isConnected ? (
            <div className={`${collapsed ? "" : "px-1"}`}>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-neon-green animate-pulse shrink-0" style={{ boxShadow: "0 0 6px hsl(145 100% 50% / 0.6)" }} />
                {!collapsed && (
                  <span className="font-mono text-[11px] text-foreground truncate flex-1">
                    {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ""}
                  </span>
                )}
                <button
                  data-testid="button-disconnect-wallet"
                  onClick={disconnect}
                  className="text-muted-foreground hover:text-red-400 transition-colors shrink-0"
                  title="Disconnect Wallet"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          ) : (
            <button
              data-testid="button-connect-wallet"
              className={`connect-wallet-btn w-full flex items-center justify-center gap-2 py-2.5 rounded-sm text-xs ${collapsed ? "px-2" : "px-4"}`}
              onClick={connect}
              disabled={isConnecting}
            >
              <Wallet className={`w-4 h-4 shrink-0 ${isConnecting ? "animate-pulse" : ""}`} />
              {!collapsed && <span>{isConnecting ? "Connecting..." : "Connect Wallet"}</span>}
            </button>
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
    </div>
  );
}
