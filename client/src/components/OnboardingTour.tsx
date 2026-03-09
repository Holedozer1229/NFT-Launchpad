import { useState, useEffect, useCallback } from "react";
import { ChevronRight, X } from "lucide-react";

const STORAGE_KEY = "skynt-onboarded";

interface TourStep {
  title: string;
  description: string;
  targetSelector: string;
  position: "right" | "bottom" | "left";
}

const steps: TourStep[] = [
  { title: "Welcome to SKYNT Protocol", description: "Your gateway to cross-chain NFT minting and DeFi", targetSelector: "[data-testid='sidebar']", position: "right" },
  { title: "Mint NFTs", description: "Create tiered-rarity artifacts on any chain", targetSelector: "[data-testid='nav-mint-nft']", position: "right" },
  { title: "Your Wallet", description: "Manage SKYNT, STX, and ETH tokens", targetSelector: "[data-testid='nav-wallet']", position: "right" },
  { title: "Ask the Sphinx", description: "The AI oracle sees all network activity", targetSelector: "body", position: "left" },
];

export function OnboardingTour() {
  const [active, setActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const onboarded = localStorage.getItem(STORAGE_KEY);
    if (!onboarded) setActive(true);
  }, []);

  useEffect(() => {
    if (!active) return;
    const step = steps[currentStep];
    const el = document.querySelector(step.targetSelector);
    if (el) {
      const rect = el.getBoundingClientRect();
      setSpotlightRect(rect);
    } else if (currentStep === steps.length - 1) {
      setSpotlightRect(new DOMRect(window.innerWidth - 120, window.innerHeight - 120, 100, 100));
    }
  }, [active, currentStep]);

  const finish = useCallback(() => {
    setActive(false);
    localStorage.setItem(STORAGE_KEY, "true");
  }, []);

  const next = useCallback(() => {
    if (currentStep < steps.length - 1) setCurrentStep((s) => s + 1);
    else finish();
  }, [currentStep, finish]);

  useEffect(() => {
    if (!active) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "Enter" || e.key === " ") next();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [active, finish, next]);

  if (!active) return null;

  const step = steps[currentStep];
  const cardStyle: React.CSSProperties = { position: "fixed", zIndex: 102 };

  if (spotlightRect) {
    if (step.position === "right") {
      cardStyle.top = Math.min(
        spotlightRect.top + spotlightRect.height / 2 - 80,
        window.innerHeight - 200
      );
      cardStyle.left = Math.min(spotlightRect.right + 16, window.innerWidth - 304);
    } else if (step.position === "left") {
      cardStyle.bottom = 100;
      cardStyle.right = Math.min(40, window.innerWidth - 304);
    } else {
      cardStyle.top = Math.min(spotlightRect.bottom + 16, window.innerHeight - 200);
      cardStyle.left = Math.min(spotlightRect.left, window.innerWidth - 304);
    }
  } else {
    cardStyle.top = "50%";
    cardStyle.left = "50%";
    cardStyle.transform = "translate(-50%, -50%)";
  }

  return (
    <div data-testid="onboarding-tour" className="fixed inset-0 z-[100]">
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.75)" }}
        onClick={finish}
        data-testid="tour-backdrop"
      />

      {spotlightRect && (
        <div
          className="absolute pointer-events-none rounded-lg"
          style={{
            left: spotlightRect.x - 8,
            top: spotlightRect.y - 8,
            width: spotlightRect.width + 16,
            height: spotlightRect.height + 16,
            boxShadow: "0 0 0 3px hsl(185 100% 50% / 0.5), 0 0 30px hsl(185 100% 50% / 0.2)",
            borderRadius: 8,
            zIndex: 101,
          }}
        />
      )}

      <div
        data-testid="tour-card"
        className="cosmic-card cosmic-card-cyan p-5 w-72"
        style={cardStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-2">
          <div className="font-heading text-sm font-bold tracking-widest text-neon-cyan" data-testid="tour-step-title">
            {step.title}
          </div>
          <button
            data-testid="button-close-tour"
            onClick={finish}
            className="p-1 -mt-1 -mr-1 rounded-sm text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
            aria-label="Close tour"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground font-mono mb-4" data-testid="tour-step-description">
          {step.description}
        </p>

        <div className="flex items-center justify-between">
          <div className="flex gap-1.5" data-testid="tour-step-dots">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${i === currentStep ? "bg-neon-cyan" : "bg-[hsl(var(--muted))]"}`}
              />
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              data-testid="button-skip-tour"
              className="text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors"
              onClick={finish}
            >
              Skip
            </button>
            <button
              data-testid="button-next-step"
              className="flex items-center gap-1 px-3 py-1.5 rounded-sm text-[11px] font-bold uppercase tracking-wider bg-neon-cyan text-[hsl(220,30%,5%)] hover:brightness-110 transition-all"
              onClick={next}
            >
              {currentStep === steps.length - 1 ? "Done" : "Next"}
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
