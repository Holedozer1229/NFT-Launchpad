import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Wallet, ChevronDown, Copy, ExternalLink, LogOut, Check, Loader2, AlertTriangle, Coins } from "lucide-react";
import { useState, useCallback, useRef, useEffect } from "react";
import { useBalance } from "wagmi";
import { SKYNT_CONTRACT_ADDRESS } from "@shared/schema";

interface ConnectWalletButtonProps {
  label?: string;
  showBalance?: boolean;
  chainStatus?: "icon" | "name" | "none";
  accountStatus?: "avatar" | "address" | "full";
}

function SkyntBalance({ address }: { address: string }) {
  const { data } = useBalance({
    address: address as `0x${string}`,
    token: SKYNT_CONTRACT_ADDRESS as `0x${string}`,
  });

  if (!data || data.value === 0n) return null;

  const formatted = parseFloat(data.formatted).toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 mt-1 rounded bg-neon-cyan/5 border border-neon-cyan/20" data-testid="text-skynt-balance">
      <Coins className="w-3 h-3 text-neon-cyan" style={{ filter: "drop-shadow(0 0 4px hsl(185 100% 50% / 0.6))" }} />
      <span className="font-mono text-[11px] text-neon-cyan font-bold">{formatted} SKYNT</span>
    </div>
  );
}

export function ConnectWalletButton({
  label = "Connect Wallet",
  showBalance = false,
  chainStatus = "icon",
  accountStatus = "address",
}: ConnectWalletButtonProps) {
  const [copied, setCopied] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleCopy = useCallback((address: string) => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        authenticationStatus,
        mounted,
      }) => {
        const ready = mounted && authenticationStatus !== "loading";
        const connected =
          ready &&
          account &&
          chain &&
          (!authenticationStatus || authenticationStatus === "authenticated");

        if (!ready) {
          return (
            <button
              disabled
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-sm font-heading text-xs uppercase tracking-wider
                bg-primary/20 text-primary/40 cursor-not-allowed min-h-[44px]"
              aria-hidden="true"
            >
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Loading...</span>
            </button>
          );
        }

        if (!connected) {
          return (
            <button
              data-testid="button-connect-wallet"
              onClick={openConnectModal}
              type="button"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-sm font-heading text-xs uppercase tracking-wider
                bg-gradient-to-r from-primary/90 to-primary text-primary-foreground
                hover:from-primary hover:to-primary/80 transition-all duration-200
                shadow-[0_0_12px_rgba(var(--primary-rgb),0.25)]
                hover:shadow-[0_0_20px_rgba(var(--primary-rgb),0.4)]
                active:scale-[0.98] min-h-[44px]"
            >
              <Wallet className="w-4 h-4" />
              <span>{label}</span>
            </button>
          );
        }

        if (chain.unsupported) {
          return (
            <button
              data-testid="button-wrong-network"
              onClick={openChainModal}
              type="button"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-sm font-heading text-xs uppercase tracking-wider
                bg-red-500/20 border border-red-500/40 text-red-400
                hover:bg-red-500/30 transition-all duration-200
                active:scale-[0.98] min-h-[44px]"
            >
              <AlertTriangle className="w-4 h-4" />
              Wrong Network
            </button>
          );
        }

        return (
          <div className="flex items-center gap-1.5" data-testid="wallet-connected-controls">
            {chainStatus !== "none" && (
              <button
                data-testid="button-chain-selector"
                onClick={openChainModal}
                type="button"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm font-mono text-[10px]
                  bg-white/5 border border-white/10 hover:border-primary/30 transition-colors min-h-[32px]"
              >
                {chain.hasIcon && chain.iconUrl && (
                  <img
                    alt={chain.name ?? "Chain icon"}
                    src={chain.iconUrl}
                    className="w-3.5 h-3.5 rounded-full"
                    style={{ background: chain.iconBackground }}
                  />
                )}
                {chainStatus === "name" && (
                  <span className="text-foreground">{chain.name}</span>
                )}
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
              </button>
            )}

            {showBalance && account.displayBalance && (
              <span className="font-mono text-[10px] text-muted-foreground px-2" data-testid="text-wallet-balance">
                {account.displayBalance}
              </span>
            )}

            <div className="relative" ref={menuRef}>
              <button
                data-testid="button-wallet-account"
                onClick={() => setShowMenu(!showMenu)}
                type="button"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm font-mono text-[10px]
                  bg-white/5 border border-white/10 hover:border-primary/30 transition-colors text-foreground min-h-[32px]"
              >
                {account.hasPendingTransactions && (
                  <Loader2 className="w-3 h-3 animate-spin text-primary" />
                )}
                {!account.hasPendingTransactions && (
                  <div className="w-4 h-4 rounded-full bg-gradient-to-br from-primary/60 to-neon-cyan/60" />
                )}
                {accountStatus !== "avatar" && (
                  <span>{account.displayName}</span>
                )}
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
              </button>

              {showMenu && (
                <div className="absolute top-full mt-1 right-0 z-[9999] min-w-[220px] py-1
                  bg-[hsl(var(--card))] border border-white/10 rounded-sm shadow-2xl
                  animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-2 border-b border-white/5">
                    <div className="font-mono text-[10px] text-muted-foreground">{chain.name}</div>
                    <div className="font-mono text-[11px] text-foreground mt-0.5 truncate">
                      {account.address}
                    </div>
                    {account.displayBalance && (
                      <div className="font-mono text-[10px] text-primary mt-0.5">{account.displayBalance}</div>
                    )}
                    <SkyntBalance address={account.address} />
                  </div>

                  <button
                    data-testid="button-copy-address"
                    onClick={() => { handleCopy(account.address); setShowMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left font-mono text-[11px] text-foreground hover:bg-white/5 transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? "Copied!" : "Copy Address"}
                  </button>

                  <button
                    data-testid="button-view-explorer"
                    onClick={() => { window.open(`https://etherscan.io/address/${account.address}`, "_blank"); setShowMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left font-mono text-[11px] text-foreground hover:bg-white/5 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    View on Explorer
                  </button>

                  <button
                    data-testid="button-wallet-details"
                    onClick={() => { openAccountModal(); setShowMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left font-mono text-[11px] text-foreground hover:bg-white/5 transition-colors"
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    Wallet Details
                  </button>

                  <div className="border-t border-white/5 mt-1 pt-1">
                    <button
                      data-testid="button-disconnect-wallet"
                      onClick={() => { openAccountModal(); setShowMenu(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left font-mono text-[11px] text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Disconnect
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
