import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Gem, Loader2, Eye, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import bgCosmic from "@/assets/bg-cosmic.png";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, register } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    setIsSubmitting(true);
    try {
      if (isLogin) {
        await login(username, password);
      } else {
        await register(username, password);
      }
    } catch (error: any) {
      const msg = error?.message || "Something went wrong";
      toast({
        title: isLogin ? "Login Failed" : "Registration Failed",
        description: msg.includes(":") ? msg.split(":").slice(1).join(":").trim() : msg,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      <div className="fixed inset-0 z-0">
        <img src={bgCosmic} alt="" className="w-full h-full object-cover opacity-30" />
        <div className="absolute inset-0 cosmic-bg" />
      </div>

      <div className="absolute inset-0 z-[1]">
        {[...Array(40)].map((_, i) => (
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

        <Card className="cosmic-card cosmic-card-cyan border-primary/20 bg-card/90 backdrop-blur-xl" data-testid="auth-card">
          <CardHeader className="text-center pb-4">
            <CardTitle className="font-heading text-lg text-primary tracking-wider">
              {isLogin ? "AUTHENTICATE" : "INITIALIZE IDENTITY"}
            </CardTitle>
            <CardDescription className="font-mono text-xs text-muted-foreground">
              {isLogin ? "Enter credentials to access the network" : "Create a new identity node"}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-heading font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Eye className="w-3 h-3" /> Username
                </label>
                <Input
                  data-testid="input-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username..."
                  className="bg-input/50 border-border/50 text-foreground font-mono text-sm focus:border-primary focus:ring-primary/20"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-heading font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Shield className="w-3 h-3" /> Password
                </label>
                <Input
                  data-testid="input-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password..."
                  className="bg-input/50 border-border/50 text-foreground font-mono text-sm focus:border-primary focus:ring-primary/20"
                />
              </div>

              <Button
                data-testid="button-submit"
                type="submit"
                disabled={isSubmitting || !username || !password}
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

            <div className="mt-6 text-center">
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
      </div>
    </div>
  );
}
