import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldOff, KeyRound, Loader2, Copy, Check, Eye, EyeOff, AlertTriangle } from "lucide-react";

type MfaStatus = {
  enabled: boolean;
  hasBackupCodes: boolean;
  backupCodesRemaining: number;
};

type SetupData = {
  secret: string;
  qrCode: string;
  otpAuthUrl: string;
};

type ConfirmData = {
  enabled: boolean;
  backupCodes: string[];
};

export function MfaSetup() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<"idle" | "setup" | "verify" | "backup" | "disable">("idle");
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verifyCode, setVerifyCode] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [backupCopied, setBackupCopied] = useState(false);

  const { data: mfaStatus, isLoading } = useQuery<MfaStatus>({
    queryKey: ["/api/auth/mfa/status"],
    staleTime: 30000,
  });

  const setupMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/mfa/setup");
      return res.json() as Promise<SetupData>;
    },
    onSuccess: (data) => {
      setSetupData(data);
      setStep("setup");
    },
    onError: (err: any) => {
      toast({ title: "Setup Failed", description: err.message, variant: "destructive" });
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async (code: string) => {
      const res = await apiRequest("POST", "/api/auth/mfa/confirm", { code });
      return res.json() as Promise<ConfirmData>;
    },
    onSuccess: (data) => {
      setBackupCodes(data.backupCodes);
      setStep("backup");
      queryClient.invalidateQueries({ queryKey: ["/api/auth/mfa/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: "MFA Enabled", description: "Two-factor authentication is now active on your account." });
    },
    onError: (err: any) => {
      toast({ title: "Verification Failed", description: err.message, variant: "destructive" });
      setVerifyCode("");
    },
  });

  const disableMutation = useMutation({
    mutationFn: async ({ password, code }: { password: string; code?: string }) => {
      const res = await apiRequest("POST", "/api/auth/mfa/disable", { password, code });
      return res.json();
    },
    onSuccess: () => {
      setStep("idle");
      setDisablePassword("");
      setDisableCode("");
      queryClient.invalidateQueries({ queryKey: ["/api/auth/mfa/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: "MFA Disabled", description: "Two-factor authentication has been removed." });
    },
    onError: (err: any) => {
      toast({ title: "Failed to Disable MFA", description: err.message, variant: "destructive" });
    },
  });

  const handleCopySecret = () => {
    if (setupData?.secret) {
      navigator.clipboard.writeText(setupData.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const handleCopyBackupCodes = () => {
    const text = backupCodes.join("\n");
    navigator.clipboard.writeText(text);
    setBackupCopied(true);
    setTimeout(() => setBackupCopied(false), 1500);
  };

  if (isLoading) {
    return (
      <Card className="sphinx-card bg-black/60 backdrop-blur-xl">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (step === "backup") {
    return (
      <Card className="sphinx-card bg-black/60 backdrop-blur-xl border-green-500/20" data-testid="mfa-backup-card">
        <CardHeader>
          <CardTitle className="font-heading text-sm uppercase tracking-widest text-green-400 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" />
            BACKUP CODES
          </CardTitle>
          <CardDescription className="font-mono text-xs">
            Save these backup codes in a secure location. Each code can only be used once.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-black/40 border border-white/10 rounded-sm p-4">
            <div className="grid grid-cols-2 gap-2">
              {backupCodes.map((code, i) => (
                <div key={i} className="font-mono text-sm text-foreground bg-white/5 rounded px-3 py-1.5 text-center" data-testid={`text-backup-code-${i}`}>
                  {code}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 p-2.5 bg-yellow-500/10 border border-yellow-500/20 rounded-sm">
            <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />
            <p className="text-[10px] font-mono text-yellow-400/80">
              If you lose access to your authenticator app, these codes are the only way to log in.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              data-testid="button-copy-backup-codes"
              variant="outline"
              onClick={handleCopyBackupCodes}
              className="flex-1 gap-2"
            >
              {backupCopied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              {backupCopied ? "Copied!" : "Copy All Codes"}
            </Button>
            <Button
              data-testid="button-mfa-done"
              onClick={() => { setStep("idle"); setBackupCodes([]); setSetupData(null); setVerifyCode(""); }}
              className="flex-1"
            >
              Done
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === "setup" && setupData) {
    return (
      <Card className="sphinx-card bg-black/60 backdrop-blur-xl border-primary/20" data-testid="mfa-setup-card">
        <CardHeader>
          <CardTitle className="font-heading text-sm uppercase tracking-widest text-primary flex items-center gap-2">
            <KeyRound className="w-4 h-4" />
            SETUP AUTHENTICATOR
          </CardTitle>
          <CardDescription className="font-mono text-xs">
            Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-center">
            <div className="bg-white p-3 rounded-lg" data-testid="mfa-qr-code">
              <img src={setupData.qrCode} alt="MFA QR Code" className="w-48 h-48" />
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-heading uppercase tracking-widest text-muted-foreground">
              Manual Entry Key
            </p>
            <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-sm p-2.5">
              <span className="font-mono text-xs text-foreground flex-1 break-all" data-testid="text-mfa-secret">
                {showSecret ? setupData.secret : "••••••••••••••••••••••••••••••••"}
              </span>
              <button
                data-testid="button-toggle-secret"
                onClick={() => setShowSecret(!showSecret)}
                className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
              >
                {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
              <button
                data-testid="button-copy-secret"
                onClick={handleCopySecret}
                className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (verifyCode.length >= 6) confirmMutation.mutate(verifyCode);
            }}
            className="space-y-3"
          >
            <div className="space-y-1.5">
              <p className="text-[10px] font-heading uppercase tracking-widest text-muted-foreground">
                Enter Code From App
              </p>
              <Input
                data-testid="input-mfa-verify"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="font-mono text-xl text-center tracking-[0.5em] bg-input/50 border-border/50"
              />
            </div>

            <div className="flex gap-2">
              <Button
                data-testid="button-mfa-cancel"
                type="button"
                variant="outline"
                onClick={() => { setStep("idle"); setSetupData(null); setVerifyCode(""); }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                data-testid="button-mfa-confirm"
                type="submit"
                disabled={confirmMutation.isPending || verifyCode.length < 6}
                className="flex-1"
              >
                {confirmMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify & Enable"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  if (step === "disable") {
    return (
      <Card className="sphinx-card bg-black/60 backdrop-blur-xl border-red-500/20" data-testid="mfa-disable-card">
        <CardHeader>
          <CardTitle className="font-heading text-sm uppercase tracking-widest text-red-400 flex items-center gap-2">
            <ShieldOff className="w-4 h-4" />
            DISABLE MFA
          </CardTitle>
          <CardDescription className="font-mono text-xs">
            Enter your password to disable two-factor authentication
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (disablePassword) {
                disableMutation.mutate({ password: disablePassword, code: disableCode || undefined });
              }
            }}
            className="space-y-3"
          >
            <div className="space-y-1.5">
              <label className="text-[10px] font-heading uppercase tracking-widest text-muted-foreground">Password</label>
              <Input
                data-testid="input-disable-password"
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                placeholder="Enter your password..."
                className="bg-input/50 border-border/50 font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-heading uppercase tracking-widest text-muted-foreground">
                Current MFA Code (optional)
              </label>
              <Input
                data-testid="input-disable-code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="bg-input/50 border-border/50 font-mono text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setStep("idle"); setDisablePassword(""); setDisableCode(""); }}
                className="flex-1"
                data-testid="button-disable-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={disableMutation.isPending || !disablePassword}
                className="flex-1"
                data-testid="button-disable-confirm"
              >
                {disableMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Disable MFA"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="sphinx-card bg-black/60 backdrop-blur-xl" data-testid="mfa-status-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="font-heading text-sm uppercase tracking-widest text-foreground flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-primary" />
            TWO-FACTOR AUTH
          </CardTitle>
          {mfaStatus?.enabled ? (
            <Badge variant="outline" className="bg-green-500/10 border-green-500/30 text-green-400 text-[9px]" data-testid="badge-mfa-enabled">
              <ShieldCheck className="w-3 h-3 mr-1" />
              ENABLED
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-white/5 border-white/15 text-muted-foreground text-[9px]" data-testid="badge-mfa-disabled">
              <ShieldOff className="w-3 h-3 mr-1" />
              DISABLED
            </Badge>
          )}
        </div>
        <CardDescription className="font-mono text-xs">
          {mfaStatus?.enabled
            ? `MFA is active. ${mfaStatus.backupCodesRemaining} backup codes remaining.`
            : "Add an extra layer of security to your account with an authenticator app."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {mfaStatus?.enabled ? (
          <Button
            data-testid="button-disable-mfa"
            variant="outline"
            onClick={() => setStep("disable")}
            className="w-full border-red-500/20 text-red-400 hover:bg-red-500/10"
          >
            <ShieldOff className="w-4 h-4 mr-2" />
            Disable MFA
          </Button>
        ) : (
          <Button
            data-testid="button-enable-mfa"
            onClick={() => setupMutation.mutate()}
            disabled={setupMutation.isPending}
            className="w-full"
          >
            {setupMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <ShieldCheck className="w-4 h-4 mr-2" />
            )}
            Enable MFA
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
