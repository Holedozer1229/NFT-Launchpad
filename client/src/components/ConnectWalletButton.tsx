import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useAccount, useConnect, useDisconnect, useBalance, useChainId, useSwitchChain } from "wagmi";
import { mainnet, polygon, base } from "wagmi/chains";
import { Wallet, ChevronDown, X, Copy, ExternalLink, LogOut, Check, Loader2 } from "lucide-react";

const CHAINS = [mainnet, polygon, base];

function chainIcon(id: number) {
  if (id === mainnet.id) return "⟠";
  if (id === polygon.id) return "⬡";
  if (id === base.id) return "🔵";
  return "⛓";
}

function chainName(id: number) {
  return CHAINS.find(c => c.id === id)?.name ?? `Chain ${id}`;
}

function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

interface ConnectWalletButtonProps {
  label?: string;
  showBalance?: boolean;
  chainStatus?: "icon" | "name" | "none";
  accountStatus?: "avatar" | "address" | "full";
}

export function ConnectWalletButton({
  label = "Connect Wallet",
  showBalance = false,
  chainStatus = "icon",
  accountStatus = "address",
}: ConnectWalletButtonProps) {
  const { address, isConnected, connector } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { data: balanceData } = useBalance({ address });

  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showChainMenu, setShowChainMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [connectingId, setConnectingId] = useState<string | null>(null);

  const accountRef = useRef<HTMLDivElement>(null);
  const chainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isConnected) {
      setShowConnectModal(false);
      setConnectingId(null);
    }
  }, [isConnected]);

  useEffect(() => {
    if (!isPending) setConnectingId(null);
  }, [isPending]);

  const handleCopy = useCallback(() => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }, [address]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setShowAccountMenu(false);
      }
      if (chainRef.current && !chainRef.current.contains(e.target as Node)) {
        setShowChainMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const uniqueConnectors = connectors.reduce<typeof connectors>((acc, c) => {
    const name = c.name.toLowerCase();
    if (name === "injected" && connectors.some(x => x.id !== c.id && x.name !== "Injected")) return acc;
    if (!acc.find(x => x.name === c.name)) acc.push(c);
    return acc;
  }, []);

  if (!isConnected) {
    return (
      <>
        <button
          data-testid="button-connect-wallet"
          onClick={() => setShowConnectModal(true)}
          disabled={isPending}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-sm font-heading text-xs uppercase tracking-wider
            bg-gradient-to-r from-primary/90 to-primary text-primary-foreground
            hover:from-primary hover:to-primary/80 transition-all duration-200
            disabled:opacity-50 disabled:cursor-not-allowed
            shadow-[0_0_12px_rgba(var(--primary-rgb),0.25)]
            hover:shadow-[0_0_20px_rgba(var(--primary-rgb),0.4)]
            active:scale-[0.98] min-h-[44px]"
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Wallet className="w-4 h-4" />
          )}
          <span>{isPending ? "Connecting..." : label}</span>
        </button>

        {showConnectModal && createPortal(
          <WalletModal
            connectors={uniqueConnectors}
            connectingId={connectingId}
            onConnect={(c) => {
              setConnectingId(c.id);
              connect({ connector: c });
            }}
            onClose={() => { setShowConnectModal(false); setConnectingId(null); }}
          />,
          document.body
        )}
      </>
    );
  }

  return (
    <div className="flex items-center gap-1.5" data-testid="wallet-connected-controls">
      {chainStatus !== "none" && (
        <div className="relative" ref={chainRef}>
          <button
            data-testid="button-chain-selector"
            onClick={() => setShowChainMenu(!showChainMenu)}
            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-sm font-mono text-[10px]
              bg-white/5 border border-white/10 hover:border-white/20 transition-colors min-h-[32px]"
          >
            <span>{chainIcon(chainId)}</span>
            {chainStatus === "name" && <span className="text-foreground">{chainName(chainId)}</span>}
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          </button>
          {showChainMenu && (
            <div className="absolute top-full mt-1 right-0 z-[9999] min-w-[160px] py-1
              bg-[hsl(var(--card))] border border-white/10 rounded-sm shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              {CHAINS.map(chain => (
                <button
                  key={chain.id}
                  data-testid={`button-chain-${chain.id}`}
                  onClick={() => { switchChain({ chainId: chain.id }); setShowChainMenu(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left font-mono text-[11px] hover:bg-white/5 transition-colors
                    ${chain.id === chainId ? "text-primary" : "text-foreground"}`}
                >
                  <span>{chainIcon(chain.id)}</span>
                  <span>{chain.name}</span>
                  {chain.id === chainId && <Check className="w-3 h-3 ml-auto text-primary" />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {showBalance && balanceData && (
        <span className="font-mono text-[10px] text-muted-foreground px-2" data-testid="text-wallet-balance">
          {parseFloat(balanceData.formatted).toFixed(4)} {balanceData.symbol}
        </span>
      )}

      <div className="relative" ref={accountRef}>
        <button
          data-testid="button-wallet-account"
          onClick={() => setShowAccountMenu(!showAccountMenu)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm font-mono text-[10px]
            bg-white/5 border border-white/10 hover:border-primary/30 transition-colors text-foreground min-h-[32px]"
        >
          <div className="w-4 h-4 rounded-full bg-gradient-to-br from-primary/60 to-neon-cyan/60" />
          {accountStatus !== "avatar" && address && (
            <span>{truncateAddress(address)}</span>
          )}
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        </button>

        {showAccountMenu && (
          <div className="absolute top-full mt-1 right-0 z-[9999] min-w-[200px] py-1
            bg-[hsl(var(--card))] border border-white/10 rounded-sm shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="px-3 py-2 border-b border-white/5">
              <div className="font-mono text-[10px] text-muted-foreground">Connected via {connector?.name}</div>
              <div className="font-mono text-[11px] text-foreground mt-0.5">{address && truncateAddress(address)}</div>
            </div>
            <button
              data-testid="button-copy-address"
              onClick={handleCopy}
              className="w-full flex items-center gap-2 px-3 py-2 text-left font-mono text-[11px] text-foreground hover:bg-white/5 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied!" : "Copy Address"}
            </button>
            <button
              data-testid="button-view-explorer"
              onClick={() => window.open(`https://etherscan.io/address/${address}`, "_blank")}
              className="w-full flex items-center gap-2 px-3 py-2 text-left font-mono text-[11px] text-foreground hover:bg-white/5 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View on Explorer
            </button>
            <div className="border-t border-white/5 mt-1 pt-1">
              <button
                data-testid="button-disconnect-wallet"
                onClick={() => { disconnect(); setShowAccountMenu(false); }}
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
}

function connectorIcon(name: string): ReactNode {
  const n = name.toLowerCase();
  if (n.includes("metamask")) return <span className="text-base">🦊</span>;
  if (n.includes("coinbase")) return <span className="text-base">🔵</span>;
  if (n.includes("phantom")) return <span className="text-base">👻</span>;
  if (n.includes("rabby")) return <span className="text-base">🐰</span>;
  return <Wallet className="w-4 h-4 text-muted-foreground" />;
}

function WalletModal({
  connectors,
  connectingId,
  onConnect,
  onClose,
}: {
  connectors: ReturnType<typeof useConnect>["connectors"];
  connectingId: string | null;
  onConnect: (c: (typeof connectors)[number]) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 2147483647 }}
      data-testid="wallet-connect-modal"
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[360px] bg-[hsl(var(--card))] border border-white/10 rounded-lg shadow-2xl
        animate-in zoom-in-95 fade-in duration-200 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <h3 className="font-heading text-sm uppercase tracking-widest text-foreground">Connect Wallet</h3>
          <button
            data-testid="button-close-wallet-modal"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-3 space-y-1.5">
          {connectors.map(c => {
            const isConnecting = connectingId === c.id;
            return (
              <button
                key={c.id}
                data-testid={`button-connector-${c.id}`}
                onClick={() => onConnect(c)}
                disabled={!!connectingId}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-md font-heading text-xs uppercase tracking-wider
                  bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.08] hover:border-primary/20
                  transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed
                  active:scale-[0.98] min-h-[52px]"
              >
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                  {isConnecting ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : connectorIcon(c.name)}
                </div>
                <span className="text-foreground text-left flex-1">{c.name}</span>
                {isConnecting && (
                  <span className="font-mono text-[9px] text-primary/70 normal-case tracking-normal">Connecting...</span>
                )}
              </button>
            );
          })}
        </div>
        <div className="px-4 pb-4 pt-1">
          <p className="text-center text-[9px] text-muted-foreground/40 font-mono">
            By connecting, you agree to SKYNT Protocol terms
          </p>
        </div>
      </div>
    </div>
  );
}
