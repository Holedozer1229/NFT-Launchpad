import { Link } from "wouter";
import { Gem, Home, AlertTriangle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center cosmic-bg">
      <div className="text-center space-y-6 p-8 max-w-md" data-testid="not-found-page">
        <div className="flex justify-center">
          <div className="relative">
            <Gem className="w-16 h-16 text-primary/30" />
            <AlertTriangle className="w-6 h-6 text-neon-orange absolute -top-1 -right-1" />
          </div>
        </div>

        <div className="space-y-2">
          <p className="font-mono text-xs text-primary tracking-widest uppercase">Error 404</p>
          <h1 className="font-heading text-3xl font-bold text-foreground tracking-wide">
            Signal Lost
          </h1>
          <p className="font-mono text-sm text-muted-foreground leading-relaxed">
            The portal you requested does not exist on this network node.
            Check the address and try again, or return to the protocol hub.
          </p>
        </div>

        <div className="pt-2">
          <Link
            href="/"
            data-testid="button-go-home"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-primary/40 bg-primary/10 text-primary font-heading text-sm tracking-wider uppercase hover-elevate transition-colors"
          >
            <Home className="w-4 h-4" />
            Return to Hub
          </Link>
        </div>

        <p className="font-mono text-[10px] text-muted-foreground/30 tracking-widest uppercase">
          SKYNT Protocol // Node 404 // Transmission End
        </p>
      </div>
    </div>
  );
}
