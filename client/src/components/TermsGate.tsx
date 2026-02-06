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
          <DialogTitle className="font-heading text-2xl">Terms of Mint</DialogTitle>
          <DialogDescription>
            Please review and accept the legal conditions before proceeding with the transaction.
          </DialogDescription>
        </DialogHeader>

        <div className="border rounded-md p-4 bg-muted/10 my-4">
          <ScrollArea className="h-[200px] pr-4 text-sm text-muted-foreground leading-relaxed">
            <h4 className="font-semibold text-foreground mb-2">1. Nature of Asset</h4>
            <p className="mb-4">
              You acknowledge that you are purchasing a digital collectible (NFT) on the Ethereum blockchain. 
              This token represents a limited license to the associated artwork as defined herein.
            </p>

            <h4 className="font-semibold text-foreground mb-2">2. No Investment Advice</h4>
            <p className="mb-4">
              This digital collectible is intended for consumer enjoyment, use, and consumption only. 
              It is not a security, financial instrument, or investment contract. You agree that you are not purchasing 
              with the expectation of profit.
            </p>

            <h4 className="font-semibold text-foreground mb-2">3. Intellectual Property</h4>
            <p className="mb-4">
              Subject to your continued compliance with these Terms, LegalMint grants you a worldwide, royalty-free license to use, 
              copy, and display the purchased Art for your purchased NFTs, solely for the following purposes: (i) for your own personal, 
              non-commercial use; (ii) as part of a marketplace that permits the purchase and sale of your NFTs.
            </p>

            <h4 className="font-semibold text-foreground mb-2">4. Jurisdiction</h4>
            <p className="mb-4">
              These terms are governed by the laws of the State of Delaware, without regard to conflict of law principles.
            </p>
          </ScrollArea>
        </div>

        <div className="flex items-center space-x-2 py-4">
          <Checkbox id="terms" checked={agreed} onCheckedChange={(c) => setAgreed(!!c)} />
          <Label htmlFor="terms" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            I have read and agree to the Terms of Service and Disclaimer.
          </Label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!agreed} onClick={() => { onAccept(); onOpenChange(false); }} className="bg-primary text-primary-foreground hover:bg-primary/90">
            Confirm & Proceed to Wallet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
