import { ReactNode } from "react";
import { Lock, ShieldAlert, Sparkles, TrendingUp, Brain, Gamepad2, Store, Flame } from "lucide-react";
import { useAccessTier } from "@/hooks/use-access-tier";
import { ACCESS_TIERS, type AccessTier } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface AccessGateProps {
  children: ReactNode;
  requiredTier: AccessTier;
}

const tierIcons: Record<number, any> = {
  1: Sparkles,
  2: Gamepad2,
  3: Brain,
  4: Flame,
};

export function AccessGate({ children, requiredTier }: AccessGateProps) {
  const { tier, isLoading, hasAccess } = useAccessTier();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (hasAccess(requiredTier)) {
    return <>{children}</>;
  }

  const details = ACCESS_TIERS[requiredTier];
  const Icon = tierIcons[requiredTier] || Lock;

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4">
      <Card className="max-w-md w-full border-red-500/20 bg-red-500/5 backdrop-blur-sm">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
            <Lock className="w-6 h-6 text-red-500" />
          </div>
          <CardTitle className="text-2xl font-bold font-heading text-foreground">
            {details.name} Access Required
          </CardTitle>
          <CardDescription className="text-muted-foreground mt-2">
            You are currently at Tier {tier}. This sector requires Tier {requiredTier} clearance.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-black/40 rounded-lg p-4 border border-white/5 space-y-3">
            <h4 className="text-xs font-mono uppercase tracking-widest text-primary">Unlocking Requirements</h4>
            <p className="text-sm text-foreground/80 leading-relaxed">
              {details.description}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <Link href="/">
              <Button className="w-full" variant="default">
                Mint NFT to Level Up
              </Button>
            </Link>
            <Link href="/wallet">
              <Button className="w-full" variant="outline">
                Check Wallet Balance
              </Button>
            </Link>
          </div>
          
          <p className="text-[10px] font-mono text-center text-muted-foreground uppercase tracking-tighter">
            Causal Gating Protocol Active
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
