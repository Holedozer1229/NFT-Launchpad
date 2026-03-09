import { useState, useRef, useEffect } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { Wallet, ChevronDown, LogOut, Copy, Check, ExternalLink } from "lucide-react";
import { SiCoinbase } from "react-icons/si";

interface ConnectWalletButtonProps {
  label?: string;
  showBalance?: boolean;
  compact?: boolean;
}

export function ConnectWalletButton({ label = "Connect Wallet", compact = false }: ConnectWalletButtonProps) {
  const { address, isConnected, connector } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showConnectors, setShowConnectors] = useState(false);
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        setShowConnectors(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleCopy = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getConnectorIcon = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes("metamask")) return "🦊";
    if (n.includes("coinbase")) return <SiCoinbase className="w-4 h-4 text-blue-500" />;
    if (n.includes("phantom")) return "👻";
    return <Wallet className="w-4 h-4" />;
  };

  const getConnectorLabel = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes("metamask")) return "MetaMask";
    if (n.includes("coinbase")) return "Coinbase Wallet";
    if (n.includes("phantom")) return "Phantom";
    if (n.includes("injected")) return "Browser Wallet";
    return name;
  };

  const uniqueConnectors = connectors.reduce((acc, c) => {
    const key = c.name.toLowerCase().replace(/\s/g, "");
    if (!acc.find(x => x.name.toLowerCase().replace(/\s/g, "") === key)) {
      acc.push(c);
    }
    return acc;
  }, [] as typeof connectors);

  if (isConnected && address) {
    const connName = connector?.name?.toLowerCase() || "";
    const icon = connName.includes("phantom") ? "👻" : connName.includes("coinbase") ? <SiCoinbase className="w-3.5 h-3.5 text-blue-500 inline" /> : "🦊";

    if (compact) {
      return (
        <div className="relative" ref={dropdownRef}>
          <button
            data-testid="button-wallet-connected-compact"
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-1.5 px-2 py-1.5 bg-primary/10 border border-primary/30 rounded-sm text-primary hover:bg-primary/20 transition-colors"
          >
            <span className="text-sm">{icon}</span>
            <span className="font-mono text-[10px]">{address.slice(0, 4)}...{address.slice(-3)}</span>
          </button>
          {showDropdown && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-black/95 border border-primary/20 rounded-sm shadow-xl z-50 py-1 backdrop-blur-xl">
              <div className="px-3 py-2 border-b border-white/10">
                <p className="font-mono text-[10px] text-muted-foreground">Connected via {connector?.name}</p>
                <p className="font-mono text-xs text-foreground mt-0.5">{address.slice(0, 8)}...{address.slice(-6)}</p>
              </div>
              <button onClick={handleCopy} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors" data-testid="button-copy-wallet">
                {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied!" : "Copy Address"}
              </button>
              <a href={`https://etherscan.io/address/${address}`} target="_blank" rel="noopener noreferrer" className="w-full flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors">
                <ExternalLink className="w-3.5 h-3.5" /> View on Etherscan
              </a>
              <button onClick={() => { disconnect(); setShowDropdown(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/5 transition-colors" data-testid="button-disconnect-dropdown">
                <LogOut className="w-3.5 h-3.5" /> Disconnect
              </button>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="relative" ref={dropdownRef}>
        <button
          data-testid="button-wallet-connected"
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary/10 border border-primary/30 rounded-sm text-primary hover:bg-primary/20 transition-colors font-heading text-xs tracking-wider"
        >
          <span className="text-base">{icon}</span>
          <span className="font-mono">{address.slice(0, 6)}...{address.slice(-4)}</span>
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
        {showDropdown && (
          <div className="absolute right-0 top-full mt-1 w-56 bg-black/95 border border-primary/20 rounded-sm shadow-xl z-50 py-1 backdrop-blur-xl">
            <div className="px-3 py-2.5 border-b border-white/10">
              <p className="font-mono text-[10px] text-muted-foreground">Connected via {connector?.name}</p>
              <p className="font-mono text-xs text-foreground mt-0.5">{address.slice(0, 10)}...{address.slice(-8)}</p>
            </div>
            <button onClick={handleCopy} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors" data-testid="button-copy-wallet">
              {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied!" : "Copy Address"}
            </button>
            <a href={`https://etherscan.io/address/${address}`} target="_blank" rel="noopener noreferrer" className="w-full flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors">
              <ExternalLink className="w-3.5 h-3.5" /> View on Etherscan
            </a>
            <button onClick={() => { disconnect(); setShowDropdown(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/5 transition-colors" data-testid="button-disconnect-dropdown">
              <LogOut className="w-3.5 h-3.5" /> Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        data-testid="button-connect-wallet"
        onClick={() => setShowConnectors(!showConnectors)}
        disabled={isPending}
        className="flex items-center gap-2 px-4 py-2.5 bg-primary/10 border border-primary/30 rounded-sm text-primary hover:bg-primary/20 transition-all font-heading text-xs tracking-wider disabled:opacity-50"
      >
        <Wallet className="w-4 h-4" />
        {isPending ? "Connecting..." : label}
      </button>
      {showConnectors && (
        <div className="absolute left-0 top-full mt-1 w-64 bg-black/95 border border-primary/20 rounded-sm shadow-xl z-50 py-1 backdrop-blur-xl">
          <div className="px-3 py-2 border-b border-white/10">
            <p className="font-heading text-xs text-foreground tracking-wider">Select Wallet</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Choose your preferred wallet to connect</p>
          </div>
          {uniqueConnectors.map((c) => (
            <button
              key={c.uid}
              data-testid={`connector-${c.name.toLowerCase().replace(/\s/g, "-")}`}
              onClick={() => {
                connect({ connector: c });
                setShowConnectors(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-foreground hover:bg-primary/10 transition-colors"
            >
              <span className="text-lg">{getConnectorIcon(c.name)}</span>
              <span className="font-heading text-xs tracking-wider">{getConnectorLabel(c.name)}</span>
            </button>
          ))}
          <div className="px-3 py-2 border-t border-white/10">
            <p className="text-[9px] font-mono text-muted-foreground/50">Powered by MetaMask SDK + Alchemy</p>
          </div>
        </div>
      )}
    </div>
  );
}
