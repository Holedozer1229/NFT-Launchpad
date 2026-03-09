import { ConnectWalletButton } from "@/components/ConnectWalletButton";

export function WalletConnect() {
  return (
    <div data-testid="wallet-connect-nav">
      <ConnectWalletButton compact />
    </div>
  );
}
