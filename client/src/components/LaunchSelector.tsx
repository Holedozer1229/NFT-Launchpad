import { LaunchMission } from "@/lib/mock-web3";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Rocket, Disc, Activity, Eye } from "lucide-react";
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
            "cursor-pointer transition-all duration-300 sphinx-card group relative overflow-hidden",
            selectedId === launch.id 
              ? "border-primary bg-primary/10 shadow-[0_0_15px_hsl(var(--primary)/0.2)]" 
              : "border-primary/20 hover:border-primary/50 bg-black/40 hover:bg-primary/5"
          )}
          onClick={() => onSelect(launch)}
        >
          {/* Scanline effect on hover */}
          <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(255,215,0,0.02)_50%)] bg-[length:100%_4px] opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity"></div>

          <CardContent className="p-5 space-y-4 relative z-10">
            <div className="flex justify-between items-start">
              <Badge 
                variant="outline" 
                className={cn(
                  "font-mono text-[10px] tracking-widest uppercase border-opacity-50",
                  launch.status === 'live' ? "border-primary text-primary animate-pulse" : "border-muted-foreground text-muted-foreground"
                )}
              >
                {launch.status}
              </Badge>
              <span className="font-mono text-xs text-primary/60">{launch.date}</span>
            </div>
            
            <div>
              <h4 className={cn(
                "font-heading font-bold text-lg leading-tight transition-colors",
                selectedId === launch.id ? "text-primary oracle-glow" : "text-foreground group-hover:text-primary"
              )}>
                {launch.missionName}
              </h4>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2 font-mono">
                <Rocket className="w-3 h-3 text-secondary-foreground" />
                <span>{launch.vehicle}</span>
              </div>
            </div>

            <div className="pt-3 flex items-center justify-between border-t border-primary/20 text-xs font-mono uppercase">
               <span className="text-muted-foreground/70">{launch.type}</span>
               <span className={cn(
                 "font-bold flex items-center gap-1",
                 launch.outcome === 'Success' ? "text-green-500" : "text-yellow-500"
               )}>
                 <Eye className="w-3 h-3" />
                 {launch.outcome === 'Success' ? 'VERIFIED' : 'PENDING'}
               </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
