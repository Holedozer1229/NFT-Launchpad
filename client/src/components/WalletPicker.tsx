import { useWallet, WalletProvider } from "@/lib/mock-web3";
import { X } from "lucide-react";

const WALLET_OPTIONS: { id: WalletProvider; name: string; icon: string; description: string; color: string }[] = [
  {
    id: "metamask",
    name: "MetaMask",
    icon: "🦊",
    description: "Connect with MetaMask for EVM chains",
    color: "#E2761B",
  },
  {
    id: "phantom",
    name: "Phantom",
    icon: "👻",
    description: "Connect with Phantom for Solana",
    color: "#AB9FF2",
  },
];

export function WalletPicker() {
  const { showPicker, setShowPicker, connect, isConnecting } = useWallet();

  if (!showPicker) return null;

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
          Select a wallet to connect to SKYNT Protocol
        </p>

        <div className="space-y-2">
          {WALLET_OPTIONS.map((wallet) => (
            <button
              key={wallet.id}
              data-testid={`button-wallet-${wallet.id}`}
              onClick={() => connect(wallet.id)}
              disabled={isConnecting}
              className="w-full flex items-center gap-4 p-4 rounded-sm border border-border/40 bg-black/30 hover:bg-white/5 hover:border-white/20 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="text-2xl shrink-0">{wallet.icon}</span>
              <div className="flex-1 text-left">
                <p className="font-heading text-sm tracking-wider" style={{ color: wallet.color }}>
                  {wallet.name}
                </p>
                <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                  {wallet.description}
                </p>
              </div>
              <div className="w-2 h-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: wallet.color }} />
            </button>
          ))}
        </div>

        <div className="text-center text-[9px] text-muted-foreground/50 font-mono pt-2">
          By connecting, you agree to SKYNT Protocol terms
        </div>
      </div>
    </div>
  );
}
