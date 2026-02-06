import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface TermsGateProps {
  onAccept: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TermsGate({ onAccept, open, onOpenChange }: TermsGateProps) {
  const [agreed, setAgreed] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl">Flight Manifest Agreement</DialogTitle>
          <DialogDescription>
            Confirm your understanding of this commemorative mission artifact.
          </DialogDescription>
        </DialogHeader>

        <div className="border rounded-md p-4 bg-muted/10 my-4">
          <ScrollArea className="h-[200px] pr-4 text-sm text-muted-foreground leading-relaxed">
            <h4 className="font-semibold text-foreground mb-2">1. Commemorative Artifact</h4>
            <p className="mb-4">
              You are acquiring a digital mission patch. This is an artistic representation and holds no official status with any aerospace agency.
            </p>

            <h4 className="font-semibold text-foreground mb-2">2. Non-Affiliation</h4>
            <p className="mb-4">
              <strong>CRITICAL:</strong> This project is NOT affiliated with, sponsored by, or endorsed by SpaceX, NASA, or any launch provider. 
              Trademarks are used nominatively for historical accuracy.
            </p>

            <h4 className="font-semibold text-foreground mb-2">3. Flight Data</h4>
            <p className="mb-4">
              Metadata regarding launch outcome, orbit, and vehicle telemetry is finalized based on public records at the time of minting.
            </p>

            <h4 className="font-semibold text-foreground mb-2">4. Final Sale</h4>
            <p className="mb-4">
              All flight manifest slots (mints) are final. No refunds for aborted launches or scrubbed missions once minted.
            </p>
          </ScrollArea>
        </div>

        <div className="flex items-center space-x-2 py-4">
          <Checkbox id="terms" checked={agreed} onCheckedChange={(c) => setAgreed(!!c)} />
          <Label htmlFor="terms" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            I acknowledge this is an unofficial commemorative collectible.
          </Label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abort</Button>
          <Button disabled={!agreed} onClick={() => { onAccept(); onOpenChange(false); }} className="bg-primary text-primary-foreground hover:bg-primary/90">
            Sign Manifest & Mint
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
