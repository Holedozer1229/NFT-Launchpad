import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Circle, Radio, Rocket } from "lucide-react";

const CHECKLIST_ITEMS = [
  { id: 1, label: "Flight Plan Filed (Contract Verified)", status: "done" },
  { id: 2, label: "Payload Integrated (Metadata IPFS)", status: "done" },
  { id: 3, label: "Launch Window Open (Public Mint)", status: "active" },
  { id: 4, label: "Telemetry Stream Active (OpenSea)", status: "done" },
  { id: 5, label: "Mission Patch Reveal", status: "pending" },
  { id: 6, label: "Post-Flight Analysis (Provenance)", status: "pending" },
];

export function LaunchChecklist() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-lg flex items-center gap-2">
          <Rocket className="w-5 h-5" />
          Mission Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {CHECKLIST_ITEMS.map((item) => (
            <div key={item.id} className="flex items-center gap-3">
              {item.status === "done" && <CheckCircle2 className="w-5 h-5 text-green-500" />}
              {item.status === "active" && <Radio className="w-5 h-5 text-primary animate-pulse" />}
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
