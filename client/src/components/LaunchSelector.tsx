import { LaunchMission } from "@/lib/mock-web3";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Rocket, Calendar, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface LaunchSelectorProps {
  launches: LaunchMission[];
  selectedId: string;
  onSelect: (launch: LaunchMission) => void;
}

export function LaunchSelector({ launches, selectedId, onSelect }: LaunchSelectorProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {launches.map((launch) => (
        <Card 
          key={launch.id}
          className={cn(
            "cursor-pointer transition-all hover:scale-[1.02] border-2",
            selectedId === launch.id 
              ? "border-primary bg-primary/5 shadow-lg shadow-primary/10" 
              : "border-transparent hover:border-border bg-card"
          )}
          onClick={() => onSelect(launch)}
        >
          <CardContent className="p-4 space-y-3">
            <div className="flex justify-between items-start">
              <Badge variant={launch.status === 'live' ? 'default' : 'secondary'} className="uppercase text-[10px] tracking-wider">
                {launch.status}
              </Badge>
              <span className="font-mono text-xs text-muted-foreground">{launch.date}</span>
            </div>
            
            <div>
              <h4 className="font-heading font-bold text-lg leading-tight">{launch.missionName}</h4>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                <Rocket className="w-3 h-3" />
                <span>{launch.vehicle}</span>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between border-t text-xs">
               <span className="text-muted-foreground">{launch.type}</span>
               <span className={cn(
                 "font-medium",
                 launch.outcome === 'Success' ? "text-green-600" : "text-yellow-600"
               )}>
                 {launch.outcome}
               </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
