import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Gem, Loader2, Eye, Shield, Wallet, KeyRound, ArrowLeft } from "lucide-react";
import { SiGoogle, SiApple } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";
import bgCosmic from "@/assets/bg-cosmic.png";
import HCaptcha from "@hcaptcha/react-hcaptcha";

import { isMobileDevice, openWalletApp } from "@/lib/wallet-utils";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isWalletConnecting, setIsWalletConnecting] = useState(false);
  const [usernameError, setUsernameError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [isMfaSubmitting, setIsMfaSubmitting] = useState(false);
  const captchaRef = useRef<HCaptcha>(null);
  const mfaInputRef = useRef<HTMLInputElement>(null);
  const { login, register, loginWithWallet, verifyMfa } = useAuth();
  const { toast } = useToast();

  const { data: captchaConfig } = useQuery<{ enabled: boolean; siteKey: string }>({
    queryKey: ["/api/auth/captcha-config"],
    staleTime: Infinity,
  });

  const { data: providers } = useQuery<{ google: boolean; apple: boolean; wallet: boolean; local: boolean }>({
    queryKey: ["/api/auth/providers"],
    staleTime: Infinity,
  });

  const captchaEnabled = !!(captchaConfig?.enabled && captchaConfig?.siteKey);

  const validateUsername = (value: string) => {
    if (!value) { setUsernameError(""); return; }
    if (value.length < 3) { setUsernameError("Username must be at least 3 characters"); return; }
    if (value.length > 30) { setUsernameError("Username must be 30 characters or less"); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(value)) { setUsernameError("Only letters, numbers, and underscores allowed"); return; }
    setUsernameError("");
  };

  const validatePassword = (value: string) => {
    if (!value) { setPasswordError(""); return; }
    if (value.length < 6) { setPasswordError("Password must be at least 6 characters"); return; }
    setPasswordError("");
  };

  const handleWalletLogin = async () => {
    if (!window.ethereum) {
      toast({
        title: "Wallet Not Found",
        description: "Please install MetaMask or another Ethereum wallet extension",
        variant: "destructive",
      });
      return;
    }

    setIsWalletConnecting(true);
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const address = accounts[0];
      
      const nonceRes = await fetch(`/api/auth/nonce?address=${address}`);
      const { nonce } = await nonceRes.json();
      
      const message = `Sign this message to authenticate with SKYNT Protocol (Contract: 0x22d3f06afB69e5FCFAa98C20009510dD11aF2517)\nNonce: ${nonce}`;
      const signature = await window.ethereum.request({
        method: "personal_sign",
        params: [message, address],
      });

      await loginWithWallet(address, signature, nonce);
      toast({
        title: "Success",
        description: "Successfully authenticated with wallet",
      });
    } catch (error: any) {
      toast({
        title: "Wallet Authentication Failed",
        description: error.message || "User denied signature or connection failed",
        variant: "destructive",
      });
    } finally {
      setIsWalletConnecting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    if (captchaEnabled && !captchaToken) {
      toast({
        title: "CAPTCHA Required",
        description: "Please complete the CAPTCHA verification",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      if (isLogin) {
        const result = await login(username, password, captchaToken || undefined);
        if (result?.mfaToken) {
          setMfaToken(result.mfaToken);
          setTimeout(() => mfaInputRef.current?.focus(), 100);
        }
      } else {
        await register(username, password, captchaToken || undefined);
      }
    } catch (error: any) {
      const msg = error?.message || "Something went wrong";
      toast({
        title: isLogin ? "Login Failed" : "Registration Failed",
        description: msg.includes(":") ? msg.split(":").slice(1).join(":").trim() : msg,
        variant: "destructive",
      });
      captchaRef.current?.resetCaptcha();
      setCaptchaToken(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaToken || !mfaCode) return;

    setIsMfaSubmitting(true);
    try {
      await verifyMfa(mfaToken, mfaCode);
    } catch (error: any) {
      const msg = error?.message || "Verification failed";
      toast({
        title: "MFA Verification Failed",
        description: msg.includes(":") ? msg.split(":").slice(1).join(":").trim() : msg,
        variant: "destructive",
      });
      setMfaCode("");
      mfaInputRef.current?.focus();
    } finally {
      setIsMfaSubmitting(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = "/api/auth/google";
  };

  const handleAppleLogin = async () => {
    try {
      toast({
        title: "Apple Sign In",
        description: "Apple Sign In requires Apple Developer credentials to be configured",
      });
    } catch (error: any) {
      toast({
        title: "Apple Sign In Failed",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    captchaRef.current?.resetCaptcha();
    setCaptchaToken(null);
    setMfaToken(null);
    setMfaCode("");
  }, [isLogin]);

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      <div className="fixed inset-0 z-0">
        <img src={bgCosmic} alt="" className="w-full h-full object-cover opacity-30" />
        <div className="absolute inset-0 cosmic-bg" />
      </div>

      <div className="absolute inset-0 z-[1]">
        {[...Array(isMobileDevice() ? 15 : 40)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              width: `${Math.random() * 2 + 1}px`,
              height: `${Math.random() * 2 + 1}px`,
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              opacity: Math.random() * 0.6 + 0.2,
              animation: `twinkle ${Math.random() * 3 + 2}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 3}s`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 w-full max-w-md px-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-lg bg-primary/10 border border-primary/30 mb-4">
            <Gem className="w-8 h-8 text-primary" />
          </div>
          <h1 className="font-heading text-3xl font-bold text-primary neon-glow-cyan tracking-widest">
            SKYNT
          </h1>
          <p className="font-mono text-xs text-muted-foreground mt-1 tracking-widest uppercase">
            Protocol Access Terminal
          </p>
        </div>

        {mfaToken ? (
          <Card className="cosmic-card cosmic-card-cyan border-primary/20 bg-card/90 backdrop-blur-xl" data-testid="mfa-card">
            <CardHeader className="text-center pb-4">
              <CardTitle className="font-heading text-lg text-primary tracking-wider flex items-center justify-center gap-2">
                <KeyRound className="w-5 h-5" />
                MFA VERIFICATION
              </CardTitle>
              <CardDescription className="font-mono text-xs text-muted-foreground">
                Enter the 6-digit code from your authenticator app
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              <form onSubmit={handleMfaSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-heading font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Shield className="w-3 h-3" /> Verification Code
                  </label>
                  <Input
                    ref={mfaInputRef}
                    data-testid="input-mfa-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={8}
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/[^0-9a-fA-F]/g, ""))}
                    placeholder="000000"
                    className="bg-input/50 border-border/50 text-foreground font-mono text-2xl text-center tracking-[0.5em] focus:border-primary focus:ring-primary/20"
                  />
                  <p className="text-[9px] font-mono text-muted-foreground/60 text-center">
                    Or enter a backup code if you lost access to your authenticator
                  </p>
                </div>

                <Button
                  data-testid="button-mfa-submit"
                  type="submit"
                  disabled={isMfaSubmitting || mfaCode.length < 6}
                  className="w-full font-heading font-bold tracking-wider uppercase py-6 connect-wallet-btn"
                >
                  {isMfaSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "VERIFY CODE"
                  )}
                </Button>
              </form>

              <button
                data-testid="button-mfa-back"
                type="button"
                onClick={() => { setMfaToken(null); setMfaCode(""); }}
                className="w-full flex items-center justify-center gap-2 text-xs font-mono text-muted-foreground hover:text-primary transition-colors"
              >
                <ArrowLeft className="w-3 h-3" />
                Back to login
              </button>
            </CardContent>
          </Card>
        ) : (
          <Card className="cosmic-card cosmic-card-cyan border-primary/20 bg-card/90 backdrop-blur-xl" data-testid="auth-card">
            <CardHeader className="text-center pb-4">
              <CardTitle className="font-heading text-lg text-primary tracking-wider">
                {isLogin ? "AUTHENTICATE" : "INITIALIZE IDENTITY"}
              </CardTitle>
              <CardDescription className="font-mono text-xs text-muted-foreground">
                {isLogin ? "Enter credentials to access the network" : "Create a new identity node"}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              {(providers?.google || providers?.apple) && (
                <>
                  <div className="flex gap-3">
                    {providers?.google && (
                      <Button
                        data-testid="button-google-login"
                        type="button"
                        variant="outline"
                        disabled={isSubmitting || isWalletConnecting}
                        onClick={handleGoogleLogin}
                        className="flex-1 border-white/15 bg-white/5 hover:bg-white/10 text-foreground font-heading font-bold tracking-wider uppercase py-5"
                      >
                        <SiGoogle className="w-4 h-4 mr-2" />
                        Google
                      </Button>
                    )}
                    {providers?.apple && (
                      <Button
                        data-testid="button-apple-login"
                        type="button"
                        variant="outline"
                        disabled={isSubmitting || isWalletConnecting}
                        onClick={handleAppleLogin}
                        className="flex-1 border-white/15 bg-white/5 hover:bg-white/10 text-foreground font-heading font-bold tracking-wider uppercase py-5"
                      >
                        <SiApple className="w-4 h-4 mr-2" />
                        Apple
                      </Button>
                    )}
                  </div>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border/50" />
                    </div>
                    <div className="relative flex justify-center text-[10px] uppercase tracking-tighter">
                      <span className="bg-card px-2 text-muted-foreground font-mono">Or continue with</span>
                    </div>
                  </div>
                </>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-heading font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Eye className="w-3 h-3" /> Username
                  </label>
                  <Input
                    data-testid="input-username"
                    type="text"
                    value={username}
                    onChange={(e) => { setUsername(e.target.value); validateUsername(e.target.value); }}
                    placeholder="Enter username..."
                    className="bg-input/50 border-border/50 text-foreground font-mono text-sm focus:border-primary focus:ring-primary/20"
                  />
                  {usernameError && (
                    <p className="text-[10px] font-mono text-red-400 mt-1" data-testid="error-username">{usernameError}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-heading font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Shield className="w-3 h-3" /> Password
                  </label>
                  <Input
                    data-testid="input-password"
                    type="password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); validatePassword(e.target.value); }}
                    placeholder="Enter password..."
                    className="bg-input/50 border-border/50 text-foreground font-mono text-sm focus:border-primary focus:ring-primary/20"
                  />
                  {passwordError && (
                    <p className="text-[10px] font-mono text-red-400 mt-1" data-testid="error-password">{passwordError}</p>
                  )}
                </div>

                {captchaEnabled && (
                  <div className="flex justify-center" data-testid="captcha-container">
                    <HCaptcha
                      ref={captchaRef}
                      sitekey={captchaConfig.siteKey}
                      theme="dark"
                      onVerify={(token) => setCaptchaToken(token)}
                      onExpire={() => setCaptchaToken(null)}
                      onError={() => setCaptchaToken(null)}
                    />
                  </div>
                )}

                <Button
                  data-testid="button-submit"
                  type="submit"
                  disabled={isSubmitting || isWalletConnecting || !username || !password || !!usernameError || !!passwordError || (captchaEnabled && !captchaToken)}
                  className="w-full font-heading font-bold tracking-wider uppercase py-6 connect-wallet-btn"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isLogin ? (
                    "ACCESS NETWORK"
                  ) : (
                    "CREATE IDENTITY"
                  )}
                </Button>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border/50" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase tracking-tighter">
                  <span className="bg-card px-2 text-muted-foreground font-mono">Or connect via</span>
                </div>
              </div>

              <Button
                data-testid="button-wallet-login"
                type="button"
                variant="outline"
                disabled={isSubmitting || isWalletConnecting}
                onClick={handleWalletLogin}
                className="w-full border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary font-heading font-bold tracking-wider uppercase py-6"
              >
                {isWalletConnecting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Wallet className="w-4 h-4 mr-2" />
                )}
                {isWalletConnecting ? "SIGNING..." : "CONNECT WALLET"}
              </Button>

              <div className="text-center">
                <button
                  data-testid="button-toggle-auth"
                  type="button"
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-xs font-mono text-muted-foreground hover:text-primary transition-colors"
                >
                  {isLogin ? "Need an identity? Register here" : "Already have access? Login here"}
                </button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
