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
          <DialogTitle className="font-heading text-2xl">SKYNT Protocol — Mint Agreement</DialogTitle>
          <DialogDescription>
            Please review and acknowledge the following before minting your artifact.
          </DialogDescription>
        </DialogHeader>

        <div className="border rounded-md p-4 bg-muted/10 my-4">
          <ScrollArea className="h-[260px] pr-4 text-sm text-muted-foreground leading-relaxed">
            <h4 className="font-semibold text-foreground mb-2">1. Digital Artifact Ownership</h4>
            <p className="mb-4">
              By minting, you acquire a unique on-chain digital artifact issued by the SKYNT Protocol. Each NFT is recorded immutably on your chosen network. Ownership is governed by the underlying smart contract and cannot be reversed by SKYNT Protocol once confirmed on-chain.
            </p>

            <h4 className="font-semibold text-foreground mb-2">2. No Guarantee of Value</h4>
            <p className="mb-4">
              Digital assets, including SKYNT NFTs and the SKYNT token, are speculative instruments. Their market value may fluctuate significantly or reach zero. Nothing in this protocol constitutes investment advice or a guarantee of return. You are solely responsible for your financial decisions.
            </p>

            <h4 className="font-semibold text-foreground mb-2">3. Regulatory Risk</h4>
            <p className="mb-4">
              Cryptocurrency and NFT regulations vary by jurisdiction. You confirm that participating in this protocol is lawful in your country or region. SKYNT Protocol bears no responsibility for regulatory or tax obligations arising from your use of the platform.
            </p>

            <h4 className="font-semibold text-foreground mb-2">4. Smart Contract Risk</h4>
            <p className="mb-4">
              Interactions with on-chain contracts carry inherent risk, including potential bugs, exploits, or network issues. All minting fees and gas costs are non-refundable once a transaction is broadcast. SKYNT Protocol does not guarantee the outcome of any transaction.
            </p>

            <h4 className="font-semibold text-foreground mb-2">5. Non-Refundable Transactions</h4>
            <p className="mb-4">
              All mints are final. SKYNT Protocol does not issue refunds for confirmed on-chain transactions. If a transaction fails before confirmation, gas fees may still be deducted by the network.
            </p>

            <h4 className="font-semibold text-foreground mb-2">6. Intellectual Property</h4>
            <p className="mb-4">
              Minting an NFT grants you ownership of the token as defined by the smart contract. It does not transfer copyright or intellectual property rights over the underlying artwork or metadata, unless explicitly stated in the specific collection's terms.
            </p>

            <h4 className="font-semibold text-foreground mb-2">7. Platform Use</h4>
            <p className="mb-4">
              You agree to use SKYNT Protocol in compliance with applicable laws, and not to engage in market manipulation, wash trading, fraud, or any activity that disrupts protocol integrity. SKYNT reserves the right to restrict access for violations.
            </p>
          </ScrollArea>
        </div>

        <div className="flex items-center space-x-2 py-2">
          <Checkbox
            id="terms"
            checked={agreed}
            onCheckedChange={(c) => setAgreed(!!c)}
            data-testid="checkbox-terms"
          />
          <Label htmlFor="terms" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            I have read and agree to the SKYNT Protocol Mint Agreement and acknowledge all associated risks.
          </Label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-terms-cancel">Cancel</Button>
          <Button
            disabled={!agreed}
            onClick={() => { onAccept(); onOpenChange(false); }}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            data-testid="button-terms-confirm"
          >
            Confirm & Mint
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
