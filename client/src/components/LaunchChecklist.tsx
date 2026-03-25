import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Circle, Radio, Rocket } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

const STATIC_CHECKLIST = [
  { id: 1, label: "SKYNT Token Contract Deployed (0x22d3...2517)", status: "done" },
  { id: 2, label: "IIT Φ-Engine Active (Mainnet)", status: "done" },
  { id: 3, label: "RocketBabesNFT Contract Verified", status: "done" },
  { id: 4, label: "Cross-Chain Bridge Operational", status: "done" },
  { id: 5, label: "OpenSea Seaport Integration Live", status: "done" },
  { id: 6, label: "ZK Wormhole Portals Open", status: "active" },
  { id: 7, label: "Governance DAO — Proposals Open", status: "active" },
  { id: 8, label: "SKYNT/WETH Liquidity Pool", status: "pending" },
  { id: 9, label: "CoinGecko / CMC Listing", status: "pending" },
];

export function LaunchChecklist() {
  const { data: iit } = useQuery<{ phi: number; level: string; networkNodes: number }>({
    queryKey: ["/api/iit/status"],
    refetchInterval: 60000,
  });

  const { data: mining } = useQuery<{ isActive: boolean; hashRate: number }>({
    queryKey: ["/api/mining/status"],
  });

  const dynamicItems = [
    {
      id: 100,
      label: `IIT Φ Engine — Φ=${iit?.phi?.toFixed(3) ?? "…"} | Level: ${iit?.level ?? "…"} | Nodes: ${iit?.networkNodes ?? "…"}`,
      status: iit ? "done" : "active",
    },
    {
      id: 101,
      label: `Mining Hub — ${mining?.isActive ? `Active @ ${mining.hashRate?.toFixed(0)} H/s` : "Standby (start mining to earn SKYNT)"}`,
      status: mining?.isActive ? "done" : "active",
    },
  ];

  const allItems = [...STATIC_CHECKLIST, ...dynamicItems];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-lg flex items-center gap-2">
          <Rocket className="w-5 h-5 text-primary" />
          Mainnet Launch Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {allItems.map((item) => (
            <div key={item.id} className="flex items-center gap-3">
              {item.status === "done" && <CheckCircle2 className="w-4 h-4 text-neon-green shrink-0" />}
              {item.status === "active" && <Radio className="w-4 h-4 text-primary animate-pulse shrink-0" />}
              {item.status === "pending" && <Circle className="w-4 h-4 text-muted-foreground/30 shrink-0" />}

              <span className={`text-sm font-mono ${item.status === "pending" ? "text-muted-foreground" : item.status === "active" ? "text-foreground" : "text-foreground font-medium"}`}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
