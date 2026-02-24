import { useWallet, WalletProvider } from "@/lib/mock-web3";
import { X, Smartphone, Monitor, ExternalLink } from "lucide-react";
import { isMobileDevice, hasPhantomExtension, hasMetaMaskExtension, openWalletApp } from "@/lib/wallet-utils";

const WALLET_OPTIONS: { id: WalletProvider; name: string; icon: string; description: string; mobileDescription: string; color: string }[] = [
  {
    id: "metamask",
    name: "MetaMask",
    icon: "🦊",
    description: "Connect with MetaMask for EVM chains",
    mobileDescription: "Open MetaMask mobile app",
    color: "#E2761B",
  },
  {
    id: "phantom",
    name: "Phantom",
    icon: "👻",
    description: "Connect with Phantom for Solana",
    mobileDescription: "Open Phantom mobile app",
    color: "#AB9FF2",
  },
];

export function WalletPicker() {
  const { showPicker, setShowPicker, connect, isConnecting } = useWallet();
  const mobile = isMobileDevice();

  if (!showPicker) return null;

  const handleConnect = (walletId: WalletProvider) => {
    if (!walletId) return;

    if (mobile) {
      const redirected = openWalletApp(walletId);
      if (redirected) return;
    }

    connect(walletId);
  };

  const getAvailability = (walletId: WalletProvider): { available: boolean; label: string } => {
    if (!walletId) return { available: false, label: "" };
    if (mobile) {
      if (walletId === "phantom" && hasPhantomExtension()) return { available: true, label: "In-app browser" };
      if (walletId === "metamask" && hasMetaMaskExtension()) return { available: true, label: "In-app browser" };
      return { available: false, label: "Open mobile app" };
    }
    if (walletId === "phantom" && hasPhantomExtension()) return { available: true, label: "Extension detected" };
    if (walletId === "metamask" && hasMetaMaskExtension()) return { available: true, label: "Extension detected" };
    return { available: false, label: "Not installed" };
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" data-testid="wallet-picker-overlay">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowPicker(false)} />
      <div className="relative w-full max-w-sm mx-4 cosmic-card cosmic-card-cyan p-6 space-y-5 z-10 animate-in zoom-in-95 fade-in duration-200">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-sm uppercase tracking-widest text-foreground">Connect Wallet</h3>
          <button
            data-testid="button-close-picker"
            onClick={() => setShowPicker(false)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-muted-foreground font-mono">
          {mobile
            ? "Connect your mobile wallet to sign transactions"
            : "Select a wallet to connect to SKYNT Protocol"}
        </p>

        {mobile && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-sm bg-neon-cyan/5 border border-neon-cyan/20 text-[10px] font-mono text-neon-cyan">
            <Smartphone className="w-3.5 h-3.5 shrink-0" />
            Mobile detected — will open wallet app for signing
          </div>
        )}

        <div className="space-y-2">
          {WALLET_OPTIONS.map((wallet) => {
            const status = getAvailability(wallet.id);
            return (
              <button
                key={wallet.id}
                data-testid={`button-wallet-${wallet.id}`}
                onClick={() => handleConnect(wallet.id)}
                disabled={isConnecting}
                className="w-full flex items-center gap-4 p-4 rounded-sm border border-border/40 bg-black/30 hover:bg-white/5 hover:border-white/20 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="text-2xl shrink-0">{wallet.icon}</span>
                <div className="flex-1 text-left">
                  <p className="font-heading text-sm tracking-wider" style={{ color: wallet.color }}>
                    {wallet.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                    {mobile ? wallet.mobileDescription : wallet.description}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${status.available ? "bg-neon-green" : "bg-neon-orange"}`} />
                    <span className="text-[9px] font-mono text-muted-foreground/70">{status.label}</span>
                    {mobile && !status.available && <ExternalLink className="w-2.5 h-2.5 text-muted-foreground/50" />}
                  </div>
                </div>
                <div className="w-2 h-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: wallet.color }} />
              </button>
            );
          })}
        </div>

        <div className="text-center text-[9px] text-muted-foreground/50 font-mono pt-2">
          {mobile
            ? "Transactions require wallet app approval"
            : "By connecting, you agree to SKYNT Protocol terms"}
        </div>
      </div>
    </div>
  );
}
