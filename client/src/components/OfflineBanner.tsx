import { useState, useEffect } from "react";
import { WifiOff, RefreshCw } from "lucide-react";

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setWasOffline(true);
      setTimeout(() => setWasOffline(false), 3000);
    };
    const handleOffline = () => {
      setIsOffline(true);
      setWasOffline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!isOffline && !wasOffline) return null;

  return (
    <div
      data-testid="offline-banner"
      className={`fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 px-4 py-2 text-xs font-heading tracking-wider transition-all duration-300 ${
        isOffline
          ? "bg-red-500/90 text-white backdrop-blur-sm"
          : "bg-neon-green/90 text-black backdrop-blur-sm"
      }`}
    >
      {isOffline ? (
        <>
          <WifiOff className="w-3.5 h-3.5" />
          <span>CONNECTION LOST — Some features may be unavailable</span>
          <button
            onClick={() => window.location.reload()}
            className="ml-2 px-2 py-0.5 rounded border border-white/30 hover:bg-white/10 transition-colors flex items-center gap-1"
            data-testid="button-retry-connection"
          >
            <RefreshCw className="w-3 h-3" /> Retry
          </button>
        </>
      ) : (
        <>
          <span className="w-2 h-2 rounded-full bg-black animate-pulse" />
          <span>CONNECTION RESTORED</span>
        </>
      )}
    </div>
  );
}
