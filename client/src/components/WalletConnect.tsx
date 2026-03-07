import { ConnectButton, useActiveAccount } from "thirdweb/react";
import { thirdwebClient } from "@/lib/thirdweb";
import { createWallet, inAppWallet } from "thirdweb/wallets";
import { ethereum, polygon, base } from "thirdweb/chains";

const wallets = [
  createWallet("io.metamask"),
  createWallet("app.phantom"),
  createWallet("com.coinbase.wallet"),
  inAppWallet(),
];

export function WalletConnect() {
  return (
    <div data-testid="thirdweb-connect-nav" className="[&_button]:font-mono [&_button]:text-xs">
      <ConnectButton
        client={thirdwebClient}
        wallets={wallets}
        chains={[ethereum, polygon, base]}
        theme="dark"
        connectButton={{
          label: "Connect",
          style: {
            fontSize: "12px",
            fontFamily: "monospace",
          },
        }}
        connectModal={{
          title: "SKYNT Protocol",
          titleIcon: "",
          size: "compact",
        }}
      />
    </div>
  );
}
