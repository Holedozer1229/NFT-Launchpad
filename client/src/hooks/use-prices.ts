import { useQuery } from "@tanstack/react-query";

interface PriceData {
  usd: number;
  usd_24h_change: number;
}

export interface Prices {
  ETH: PriceData;
  SOL: PriceData;
  STX: PriceData;
  SKYNT: PriceData;
}

export function usePrices() {
  return useQuery<Prices>({
    queryKey: ["/api/prices"],
    refetchInterval: 60000,
    staleTime: 30000,
  });
}
