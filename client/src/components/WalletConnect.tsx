import { Button } from "@/components/ui/button";
import { useWallet } from "@/lib/mock-web3";
import { Wallet, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function WalletConnect() {
  const { isConnected, address, balance, connect, disconnect } = useWallet();

  if (isConnected) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="font-mono gap-2 border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 transition-all">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            {address}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>My Wallet</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <div className="px-2 py-1.5 text-sm text-muted-foreground flex justify-between">
            <span>Balance</span>
            <span className="font-mono text-foreground">{balance} ETH</span>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={disconnect} className="text-destructive focus:text-destructive cursor-pointer">
            <LogOut className="mr-2 h-4 w-4" />
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Button onClick={connect} className="gap-2 shadow-lg shadow-primary/20 transition-all hover:scale-[1.02]">
      <Wallet className="w-4 h-4" />
      Connect Wallet
    </Button>
  );
}
