import { useWalletStore } from "@/lib/mock-web3";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { X } from "lucide-react";

export function WalletPicker() {
  const { showPicker, setShowPicker, clearError } = useWalletStore();

  if (!showPicker) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" data-testid="wallet-picker-overlay">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => { setShowPicker(false); clearError(); }} />
      <div className="relative w-full max-w-sm mx-4 cosmic-card cosmic-card-cyan p-6 space-y-5 z-10 animate-in zoom-in-95 fade-in duration-200">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-sm uppercase tracking-widest text-foreground">Connect Wallet</h3>
          <button
            data-testid="button-close-picker"
            onClick={() => { setShowPicker(false); clearError(); }}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div data-testid="wallet-connect-picker" className="[&_button]:w-full">
          <ConnectButton
            showBalance={false}
            chainStatus="icon"
          />
        </div>

        <div className="text-center text-[9px] text-muted-foreground/50 font-mono pt-2">
          By connecting, you agree to SKYNT Protocol terms
        </div>
      </div>
    </div>
  );
}
