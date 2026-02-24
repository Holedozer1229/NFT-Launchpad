export function isMobileDevice(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

export function hasPhantomExtension(): boolean {
  return typeof window !== "undefined" && !!(window as any).phantom?.solana;
}

export function hasMetaMaskExtension(): boolean {
  return typeof window !== "undefined" && !!(window as any).ethereum?.isMetaMask;
}

export function getPhantomDeepLink(action: string = "connect"): string {
  const appUrl = encodeURIComponent(window.location.origin);
  const redirectUrl = encodeURIComponent(window.location.href);
  return `https://phantom.app/ul/v1/${action}?app_url=${appUrl}&redirect_link=${redirectUrl}`;
}

export function getMetaMaskDeepLink(): string {
  const url = window.location.href.replace("https://", "").replace("http://", "");
  return `https://metamask.app.link/dapp/${url}`;
}

export function openWalletApp(provider: "metamask" | "phantom") {
  if (provider === "phantom") {
    if (isMobileDevice() && !hasPhantomExtension()) {
      window.location.href = getPhantomDeepLink("connect");
      return true;
    }
  } else if (provider === "metamask") {
    if (isMobileDevice() && !hasMetaMaskExtension()) {
      window.location.href = getMetaMaskDeepLink();
      return true;
    }
  }
  return false;
}

export type ExternalWalletStatus = "not_connected" | "connected" | "required";

export function getRequiredWalletForChain(chain: string): "metamask" | "phantom" {
  if (chain === "solana") return "phantom";
  return "metamask";
}
