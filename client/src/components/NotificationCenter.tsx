import { useState, useRef, useEffect } from "react";
import { Bell, Sparkles, ArrowLeftRight, Gift, Shield, Check, Trash2 } from "lucide-react";

type NotificationType = "mint_success" | "bridge_complete" | "reward_claim" | "system";

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
}

const typeConfig: Record<NotificationType, { color: string; icon: typeof Bell; accent: string }> = {
  mint_success: { color: "text-neon-cyan", icon: Sparkles, accent: "border-l-[hsl(185,100%,50%)]" },
  bridge_complete: { color: "text-neon-orange", icon: ArrowLeftRight, accent: "border-l-[hsl(30,100%,55%)]" },
  reward_claim: { color: "text-neon-green", icon: Gift, accent: "border-l-[hsl(145,100%,50%)]" },
  system: { color: "text-neon-magenta", icon: Shield, accent: "border-l-[hsl(300,100%,60%)]" },
};

const initialNotifications: Notification[] = [
  { id: "1", type: "mint_success", title: "NFT Minted Successfully", description: "Legendary artifact inscribed on Ethereum", timestamp: "5 min ago", read: false },
  { id: "2", type: "bridge_complete", title: "Bridge Transfer Complete", description: "100 SKYNT bridged to Polygon", timestamp: "12 min ago", read: false },
  { id: "3", type: "reward_claim", title: "SKYNT Rewards Claimed", description: "2.4 SKYNT deposited to wallet", timestamp: "1 hour ago", read: false },
  { id: "4", type: "system", title: "Guardian Network Update", description: "9/9 guardians online, multi-sig active", timestamp: "3 hours ago", read: true },
];

export function NotificationCenter({ collapsed = false }: { collapsed?: boolean }) {
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const markAllRead = () => setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  const clearAll = () => setNotifications([]);
  const toggleRead = (id: string) =>
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: !n.read } : n)));

  return (
    <div className="relative" ref={panelRef}>
      <button
        data-testid="button-notification-bell"
        className="relative p-1.5 rounded-sm text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span
            data-testid="badge-unread-count"
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-[9px] font-bold text-white flex items-center justify-center"
          >
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          data-testid="panel-notifications"
          className="absolute top-full left-0 mt-2 w-80 cosmic-card backdrop-blur-xl z-50"
          style={{ filter: "drop-shadow(0 0 20px hsl(185 100% 50% / 0.15))" }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(var(--border))]">
            <span className="font-heading text-xs font-bold tracking-widest uppercase text-foreground">Notifications</span>
            {unreadCount > 0 && (
              <button
                data-testid="button-mark-all-read"
                className="flex items-center gap-1 text-[10px] font-mono text-neon-cyan hover:text-foreground transition-colors"
                onClick={markAllRead}
              >
                <Check className="w-3 h-3" /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-muted-foreground text-xs font-mono" data-testid="text-no-notifications">
                No notifications
              </div>
            ) : (
              notifications.map((n) => {
                const config = typeConfig[n.type];
                const Icon = config.icon;
                return (
                  <button
                    key={n.id}
                    data-testid={`notification-item-${n.id}`}
                    className={`w-full text-left px-4 py-3 border-l-2 ${config.accent} hover:bg-[hsl(var(--muted)/0.3)] transition-colors ${!n.read ? "bg-[hsl(var(--muted)/0.15)]" : ""}`}
                    onClick={() => toggleRead(n.id)}
                  >
                    <div className="flex items-start gap-3">
                      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${config.color}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-semibold ${!n.read ? "text-foreground" : "text-muted-foreground"}`}>{n.title}</span>
                          {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-neon-cyan shrink-0" />}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{n.description}</p>
                        <span className="text-[9px] font-mono text-muted-foreground/60 mt-1 block">{n.timestamp}</span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-[hsl(var(--border))]">
              <button
                data-testid="button-clear-all"
                className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-red-400 transition-colors w-full justify-center"
                onClick={clearAll}
              >
                <Trash2 className="w-3 h-3" /> Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
