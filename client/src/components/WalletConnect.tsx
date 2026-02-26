import { Button } from "@/components/ui/button";
import { useWallet } from "@/lib/mock-web3";
import { Wallet, LogOut, Terminal, RefreshCw } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function WalletConnect() {
  const { isConnected, address, balance, connect, disconnect, provider, chainName, refreshBalance } = useWallet();

  const tokenSymbol = provider === "phantom" ? "SOL" : "ETH";
  const providerIcon = provider === "phantom" ? "👻" : "🦊";
  const shortAddress = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "";

  if (isConnected) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="font-mono text-xs gap-2 border-primary text-primary bg-black/50 hover:bg-primary hover:text-black transition-all shadow-[0_0_10px_rgba(0,243,255,0.2)]">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_5px_currentColor]" />
            <span title={provider === "phantom" ? "Phantom" : "MetaMask"}>{providerIcon}</span>
            {shortAddress}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 bg-black border border-primary/20 text-foreground">
          <DropdownMenuLabel className="font-heading uppercase tracking-widest text-primary">Wallet Link</DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-white/10" />
          <div className="px-2 py-1.5 text-xs font-mono text-muted-foreground flex justify-between">
            <span>CREDITS</span>
            <span className="text-white">{balance.toFixed(4)} {tokenSymbol}</span>
          </div>
          {chainName && (
            <div className="px-2 py-1 text-[10px] font-mono text-muted-foreground flex justify-between">
              <span>NETWORK</span>
              <span className="text-neon-cyan">{chainName}</span>
            </div>
          )}
          <DropdownMenuSeparator className="bg-white/10" />
          <DropdownMenuItem onClick={() => refreshBalance()} className="text-muted-foreground focus:text-foreground focus:bg-white/5 cursor-pointer font-mono text-xs">
            <RefreshCw className="mr-2 h-3 w-3" />
            REFRESH BALANCE
          </DropdownMenuItem>
          <DropdownMenuItem onClick={disconnect} className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer font-mono text-xs">
            <LogOut className="mr-2 h-3 w-3" />
            TERMINATE LINK
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Button 
      onClick={() => connect()} 
      className="gap-2 font-heading font-bold tracking-wide uppercase bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-transparent hover:border-white/20"
    >
      <Terminal className="w-4 h-4" />
      Connect
    </Button>
  );
}
