import { ConnectWalletButton } from "@/components/ConnectWalletButton";

export function WalletConnect() {
  return (
    <div data-testid="wallet-connect-nav" className="[&_button]:font-mono [&_button]:text-xs">
      <ConnectWalletButton
        chainStatus="icon"
        showBalance={false}
        accountStatus="avatar"
      />
    </div>
  );
}
