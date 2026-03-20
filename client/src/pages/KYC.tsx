import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldAlert, Clock, CheckCircle2, XCircle, User, CreditCard, Globe, MapPin, FileText, Camera, ChevronRight, ChevronLeft, Loader2, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface KycSubmission {
  id: number;
  userId: number;
  fullName: string;
  dateOfBirth: string;
  nationality: string;
  country: string;
  address: string;
  idType: string;
  idNumber: string;
  idFrontUrl: string | null;
  idBackUrl: string | null;
  selfieUrl: string | null;
  status: string;
  reviewNotes: string | null;
  submittedAt: string;
  reviewedAt: string | null;
}

const COUNTRIES = [
  "United States", "United Kingdom", "Canada", "Australia", "Germany", "France",
  "Japan", "South Korea", "Singapore", "Netherlands", "Switzerland", "Sweden",
  "Norway", "Denmark", "Finland", "New Zealand", "Ireland", "Austria", "Belgium",
  "Portugal", "Spain", "Italy", "Brazil", "Mexico", "Argentina", "Chile",
  "India", "Thailand", "Malaysia", "Philippines", "Vietnam", "Indonesia",
  "South Africa", "Nigeria", "Kenya", "Egypt", "UAE", "Israel", "Turkey",
  "Poland", "Czech Republic", "Romania", "Hungary", "Other",
];

const ID_TYPES = [
  { value: "passport", label: "Passport" },
  { value: "drivers_license", label: "Driver's License" },
  { value: "national_id", label: "National ID Card" },
  { value: "residence_permit", label: "Residence Permit" },
];

function StatusCard({ kyc }: { kyc: KycSubmission }) {
  const config: Record<string, { icon: any; color: string; title: string; bg: string }> = {
    pending:      { icon: Clock,          color: "text-neon-cyan",    bg: "bg-neon-cyan/10 border-neon-cyan/30",    title: "Under Review" },
    under_review: { icon: Loader2,        color: "text-neon-orange",  bg: "bg-neon-orange/10 border-neon-orange/30", title: "Being Reviewed" },
    approved:     { icon: CheckCircle2,   color: "text-neon-green",   bg: "bg-neon-green/10 border-neon-green/30",  title: "Verified" },
    rejected:     { icon: XCircle,        color: "text-plasma-red",   bg: "bg-plasma-red/10 border-plasma-red/30",  title: "Rejected" },
  };
  const c = config[kyc.status] ?? config.pending;
  const Icon = c.icon;

  return (
    <div className={`cosmic-card p-6 border ${c.bg}`} data-testid="kyc-status-card">
      <div className="flex items-center gap-4 mb-4">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center bg-black/40 ${c.color}`}>
          <Icon className={`w-6 h-6 ${kyc.status === "under_review" ? "animate-spin" : ""}`} />
        </div>
        <div>
          <p className="font-heading font-bold text-lg text-foreground">{c.title}</p>
          <p className="font-mono text-xs text-muted-foreground">
            Submitted {formatDistanceToNow(new Date(kyc.submittedAt), { addSuffix: true })}
          </p>
        </div>
      </div>
      <div className="space-y-2 font-mono text-xs text-muted-foreground">
        <div className="flex justify-between"><span>Name</span><span className="text-foreground">{kyc.fullName}</span></div>
        <div className="flex justify-between"><span>Country</span><span className="text-foreground">{kyc.country}</span></div>
        <div className="flex justify-between"><span>ID Type</span><span className="text-foreground">{ID_TYPES.find(t => t.value === kyc.idType)?.label ?? kyc.idType}</span></div>
        <div className="flex justify-between"><span>Status</span>
          <span className={c.color}>{c.title}</span>
        </div>
      </div>
      {kyc.reviewNotes && (
        <div className="mt-4 p-3 rounded-lg bg-black/40 border border-border/40">
          <p className="font-mono text-xs text-muted-foreground mb-1">Review Notes</p>
          <p className="font-mono text-xs text-foreground">{kyc.reviewNotes}</p>
        </div>
      )}
    </div>
  );
}

const STEPS = [
  { id: "personal", label: "Personal Info", icon: User },
  { id: "identity", label: "Identity", icon: CreditCard },
  { id: "documents", label: "Documents", icon: FileText },
];

export default function KYCPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    fullName: "",
    dateOfBirth: "",
    nationality: "",
    country: "",
    address: "",
    idType: "",
    idNumber: "",
    idFrontUrl: "",
    idBackUrl: "",
    selfieUrl: "",
  });

  const { data: kycStatus, isLoading } = useQuery<KycSubmission | null>({
    queryKey: ["/api/kyc/status"],
    enabled: !!user,
  });

  const submit = useMutation({
    mutationFn: () => apiRequest("POST", "/api/kyc/submit", {
      ...form,
      idFrontUrl: form.idFrontUrl || null,
      idBackUrl: form.idBackUrl || null,
      selfieUrl: form.selfieUrl || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/kyc/status"] });
      toast({ title: "KYC submitted!", description: "Your identity verification is under review. We'll notify you within 24–48 hours." });
    },
    onError: (e: any) => {
      toast({ title: "Submission failed", description: e.message, variant: "destructive" });
    },
  });

  const set = (key: keyof typeof form) => (val: string) => setForm(f => ({ ...f, [key]: val }));
  const inputProps = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [key]: e.target.value })),
    className: "bg-black/40 border-border/50 font-mono text-sm",
  });

  const canProceed = () => {
    if (step === 0) return form.fullName.length >= 2 && form.dateOfBirth && form.nationality && form.country && form.address.length >= 5;
    if (step === 1) return form.idType && form.idNumber.length >= 3;
    return true;
  };

  const canSubmit = form.fullName && form.dateOfBirth && form.nationality && form.country && form.address && form.idType && form.idNumber;

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-4">
        <ShieldAlert className="w-12 h-12 text-primary/30" />
        <h2 className="font-heading font-bold text-xl text-foreground">Sign in Required</h2>
        <p className="font-mono text-xs text-muted-foreground">Please log in to complete identity verification.</p>
      </div>
    );
  }

  return (
    <div data-testid="kyc-page" className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="font-heading font-bold text-2xl flex items-center gap-3 text-primary neon-glow-cyan">
          <ShieldCheck className="w-6 h-6" /> Identity Verification
        </h1>
        <p className="font-mono text-xs text-muted-foreground mt-1">Complete KYC to unlock all protocol features and higher withdrawal limits</p>
      </div>

      {isLoading ? (
        <div className="cosmic-card p-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : kycStatus && kycStatus.status !== "rejected" ? (
        <StatusCard kyc={kycStatus} />
      ) : (
        <div className="space-y-6">
          {kycStatus?.status === "rejected" && (
            <div className="cosmic-card p-4 border border-plasma-red/30 bg-plasma-red/5 flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-plasma-red mt-0.5 shrink-0" />
              <div>
                <p className="font-mono text-xs text-plasma-red font-bold">Previous submission rejected</p>
                {kycStatus.reviewNotes && <p className="font-mono text-xs text-muted-foreground mt-1">{kycStatus.reviewNotes}</p>}
                <p className="font-mono text-xs text-muted-foreground mt-1">Please re-submit with correct information.</p>
              </div>
            </div>
          )}

          {/* Step indicator */}
          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const active = i === step;
              const done = i < step;
              return (
                <div key={s.id} className="flex items-center gap-2 flex-1">
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono transition-all ${
                    active ? "bg-primary/20 border border-primary/40 text-primary" :
                    done ? "bg-neon-green/10 border border-neon-green/30 text-neon-green" :
                    "bg-muted/20 border border-border/30 text-muted-foreground"
                  }`}>
                    <Icon className="w-3 h-3" />
                    <span className="hidden sm:inline">{s.label}</span>
                  </div>
                  {i < STEPS.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground/40 shrink-0" />}
                </div>
              );
            })}
          </div>

          {/* Step 0: Personal Info */}
          {step === 0 && (
            <div className="cosmic-card p-6 space-y-5" data-testid="kyc-step-personal">
              <div>
                <h3 className="font-heading font-bold text-base text-foreground mb-1">Personal Information</h3>
                <p className="font-mono text-xs text-muted-foreground">Your legal details as they appear on your government ID</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="font-mono text-xs text-muted-foreground">Full Legal Name *</label>
                  <Input data-testid="input-kyc-fullname" placeholder="As on your ID" {...inputProps("fullName")} />
                </div>
                <div className="space-y-1.5">
                  <label className="font-mono text-xs text-muted-foreground">Date of Birth *</label>
                  <Input data-testid="input-kyc-dob" type="date" {...inputProps("dateOfBirth")} />
                </div>
                <div className="space-y-1.5">
                  <label className="font-mono text-xs text-muted-foreground">Nationality *</label>
                  <Select value={form.nationality} onValueChange={set("nationality")}>
                    <SelectTrigger data-testid="select-kyc-nationality" className="bg-black/40 border-border/50 font-mono text-sm">
                      <SelectValue placeholder="Select nationality" />
                    </SelectTrigger>
                    <SelectContent className="max-h-48">
                      {COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="font-mono text-xs text-muted-foreground">Country of Residence *</label>
                  <Select value={form.country} onValueChange={set("country")}>
                    <SelectTrigger data-testid="select-kyc-country" className="bg-black/40 border-border/50 font-mono text-sm">
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent className="max-h-48">
                      {COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="font-mono text-xs text-muted-foreground">Residential Address *</label>
                  <Input data-testid="input-kyc-address" placeholder="Street, City, Postal Code" {...inputProps("address")} />
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Identity Document */}
          {step === 1 && (
            <div className="cosmic-card p-6 space-y-5" data-testid="kyc-step-identity">
              <div>
                <h3 className="font-heading font-bold text-base text-foreground mb-1">Identity Document</h3>
                <p className="font-mono text-xs text-muted-foreground">Select your document type and enter the identifying number</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-mono text-xs text-muted-foreground">Document Type *</label>
                  <Select value={form.idType} onValueChange={set("idType")}>
                    <SelectTrigger data-testid="select-kyc-idtype" className="bg-black/40 border-border/50 font-mono text-sm">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {ID_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="font-mono text-xs text-muted-foreground">Document Number *</label>
                  <Input data-testid="input-kyc-idnumber" placeholder="e.g. AB1234567" {...inputProps("idNumber")} />
                </div>
              </div>

              <div className="p-4 rounded-lg bg-neon-cyan/5 border border-neon-cyan/20">
                <p className="font-mono text-[10px] text-neon-cyan/80 flex items-center gap-1.5">
                  <ShieldCheck className="w-3 h-3" />
                  Your document details are encrypted and stored securely. We comply with GDPR and applicable data protection laws.
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Document Upload (URL-based for demo) */}
          {step === 2 && (
            <div className="cosmic-card p-6 space-y-5" data-testid="kyc-step-documents">
              <div>
                <h3 className="font-heading font-bold text-base text-foreground mb-1">Document Photos</h3>
                <p className="font-mono text-xs text-muted-foreground">Optional — provide public image URLs for your documents (or skip)</p>
              </div>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="font-mono text-xs text-muted-foreground flex items-center gap-1.5">
                    <CreditCard className="w-3 h-3" /> ID Front (image URL)
                  </label>
                  <Input data-testid="input-kyc-idfront" placeholder="https://…" {...inputProps("idFrontUrl")} />
                </div>
                <div className="space-y-1.5">
                  <label className="font-mono text-xs text-muted-foreground flex items-center gap-1.5">
                    <CreditCard className="w-3 h-3" /> ID Back (image URL)
                  </label>
                  <Input data-testid="input-kyc-idback" placeholder="https://… (optional)" {...inputProps("idBackUrl")} />
                </div>
                <div className="space-y-1.5">
                  <label className="font-mono text-xs text-muted-foreground flex items-center gap-1.5">
                    <Camera className="w-3 h-3" /> Selfie with ID (image URL)
                  </label>
                  <Input data-testid="input-kyc-selfie" placeholder="https://… (optional)" {...inputProps("selfieUrl")} />
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-3">
                {["ID Front", "ID Back", "Selfie"].map((label, i) => {
                  const url = [form.idFrontUrl, form.idBackUrl, form.selfieUrl][i];
                  return (
                    <div key={label} className="aspect-[4/3] rounded-lg border border-border/40 bg-black/30 flex items-center justify-center overflow-hidden">
                      {url ? (
                        <img src={url} alt={label} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      ) : (
                        <div className="text-center space-y-1">
                          <Camera className="w-5 h-5 text-muted-foreground/30 mx-auto" />
                          <p className="font-mono text-[9px] text-muted-foreground/50">{label}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center gap-3">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep(s => s - 1)} className="border-border/50" data-testid="button-kyc-back">
                <ChevronLeft className="w-4 h-4 mr-1" /> Back
              </Button>
            )}
            {step < STEPS.length - 1 ? (
              <Button
                className="flex-1 font-heading font-bold tracking-wider"
                disabled={!canProceed()}
                onClick={() => setStep(s => s + 1)}
                data-testid="button-kyc-next"
              >
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button
                className="flex-1 font-heading font-bold tracking-wider"
                disabled={!canSubmit || submit.isPending}
                onClick={() => submit.mutate()}
                data-testid="button-kyc-submit"
              >
                {submit.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting…</> : "Submit Verification"}
              </Button>
            )}
          </div>

          <p className="font-mono text-[10px] text-muted-foreground/60 text-center">
            By submitting, you confirm all information is accurate. Review typically takes 24–48 hours.
          </p>
        </div>
      )}
    </div>
  );
}
