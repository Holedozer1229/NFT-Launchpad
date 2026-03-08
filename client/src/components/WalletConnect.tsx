import { ConnectButton } from "@rainbow-me/rainbowkit";

export function WalletConnect() {
  return (
    <div data-testid="wallet-connect-nav" className="[&_button]:font-mono [&_button]:text-xs">
      <ConnectButton
        chainStatus="icon"
        showBalance={false}
        accountStatus="avatar"
      />
    </div>
  );
}
