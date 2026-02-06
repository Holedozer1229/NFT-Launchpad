import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Circle, Clock } from "lucide-react";

const CHECKLIST_ITEMS = [
  { id: 1, label: "Smart Contract Verified (Etherscan)", status: "done" },
  { id: 2, label: "Metadata Frozen (IPFS)", status: "done" },
  { id: 3, label: "Legal Terms Published", status: "done" },
  { id: 4, label: "Royalty Registry Set (OpenSea)", status: "done" },
  { id: 5, label: "Whitelist Snapshot Taken", status: "done" },
  { id: 6, label: "Public Mint Active", status: "active" },
  { id: 7, label: "Post-Reveal Asset Swap", status: "pending" },
];

export function LaunchChecklist() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-lg">Launch Readiness</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {CHECKLIST_ITEMS.map((item) => (
            <div key={item.id} className="flex items-center gap-3">
              {item.status === "done" && <CheckCircle2 className="w-5 h-5 text-green-500" />}
              {item.status === "active" && <Clock className="w-5 h-5 text-primary animate-pulse" />}
              {item.status === "pending" && <Circle className="w-5 h-5 text-muted-foreground/30" />}
              
              <span className={`text-sm ${item.status === 'pending' ? 'text-muted-foreground' : 'text-foreground font-medium'}`}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
