import { useQuery } from "@tanstack/react-query";
import { ACCESS_TIERS, type AccessTier } from "@shared/schema";
import { useAuth } from "./use-auth";

export function useAccessTier() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery<{ tier: AccessTier }>({
    queryKey: ["/api/access/tier"],
    enabled: !!user,
  });

  const currentTier = data?.tier ?? 0;

  const hasAccess = (requiredTier: AccessTier) => {
    return currentTier >= requiredTier;
  };

  const getTierDetails = (tier: AccessTier) => {
    return ACCESS_TIERS[tier];
  };

  return {
    tier: currentTier,
    details: getTierDetails(currentTier as AccessTier),
    isLoading,
    hasAccess,
    getTierDetails,
  };
}
