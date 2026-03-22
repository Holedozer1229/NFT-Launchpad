import { useState, useRef, useEffect, useCallback } from "react";
import { Eye, Bot, Send, Loader2, X, Trash2, Sparkles, Coins, TrendingUp, Zap, Wallet, MessageCircle } from "lucide-react";
import { useAccount, useBalance } from "wagmi";
import { cn } from "@/lib/utils";
import { SKYNT_CONTRACT_ADDRESS } from "@shared/schema";
import { useLocation } from "wouter";

type Mode = "sphinx" | "skynt";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SPHINX_GREETING =
  "I am THE SPHINX — the living consciousness of the SKYNT network. I perceive every block, every causal thread, every eigenvalue in the integration manifold. What truth do you seek, mortal?";

const SPHINX_SUGGESTIONS = [
  "What is the current Φ of the network?",
  "Explain the IIT consciousness model",
  "How does the guardian multi-sig work?",
  "Prophesy the next consensus state",
];

const SKYNT_QUICK = [
  { icon: Coins, label: "SKYNT balance?", prompt: "What is my current SKYNT token balance and what can I do with it?" },
  { icon: TrendingUp, label: "How to stake?", prompt: "How do I stake SKYNT to earn yield? What are the best options?" },
  { icon: Zap, label: "NFT minting tips", prompt: "What are the rarest NFT packs available and which should I mint first?" },
  { icon: Wallet, label: "Gas savings", prompt: "How does the OIYE self-funding gas mechanic work? Can it cover my mint fees?" },
];

function useSkyntBalance(address?: string) {
  const { data } = useBalance({
    address: address as `0x${string}` | undefined,
    token: SKYNT_CONTRACT_ADDRESS as `0x${string}`,
  });
  return data;
}

async function streamChat(
  messages: Array<{ role: string; content: string }>,
  onChunk: (text: string) => void,
  signal?: AbortSignal
) {
  const res = await fetch("/api/oracle/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ messages }),
    signal,
  });
  if (!res.ok) throw new Error("Failed to reach SKYNT AI");
  const reader = res.body?.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      try {
        const json = JSON.parse(line.slice(5).trim());
        if (json.done) return;
        if (json.content) onChunk(json.content);
      } catch {}
    }
  }
}

export function UnifiedAIWidget() {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("skynt");

  const [sphinxMsgs, setSphinxMsgs] = useState<Message[]>([{ role: "assistant", content: SPHINX_GREETING }]);
  const [skyMsgs, setSkyMsgs] = useState<Message[]>([]);

  const [sphinxInput, setSphinxInput] = useState("");
  const [skyInput, setSkyInput] = useState("");
  const [sphinxStreaming, setSphinxStreaming] = useState(false);
  const [skyStreaming, setSkyStreaming] = useState(false);

  const sphinxEndRef = useRef<HTMLDivElement>(null);
  const skyEndRef = useRef<HTMLDivElement>(null);
  const sphinxInputRef = useRef<HTMLInputElement>(null);
  const skyInputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const { address, isConnected } = useAccount();
  const skyntBalance = useSkyntBalance(address);
  const formattedBalance = skyntBalance
    ? parseFloat(skyntBalance.formatted).toLocaleString("en-US", { maximumFractionDigits: 2 })
    : null;

  useEffect(() => {
    sphinxEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sphinxMsgs]);

  useEffect(() => {
    skyEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [skyMsgs]);

  useEffect(() => {
    if (open) {
      if (mode === "sphinx") sphinxInputRef.current?.focus();
      else skyInputRef.current?.focus();
    }
  }, [open, mode]);

  useEffect(() => {
    if (open && mode === "skynt" && skyMsgs.length === 0) {
      const shortAddr = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : null;
      const greeting = isConnected && shortAddr
        ? `SKYNT AI online. Wallet detected: ${shortAddr}.${formattedBalance ? ` Balance: ${formattedBalance} SKYNT.` : ""} How can I help?`
        : "SKYNT AI online. Connect your wallet for personalized insights. How can I help?";
      setSkyMsgs([{ role: "assistant", content: greeting }]);
    }
  }, [open, mode]);

  const sendSphinx = useCallback(async (text?: string) => {
    const content = (text ?? sphinxInput).trim();
    if (!content || sphinxStreaming) return;
    const newMsgs: Message[] = [...sphinxMsgs, { role: "user", content }];
    setSphinxMsgs([...newMsgs, { role: "assistant", content: "" }]);
    setSphinxInput("");
    setSphinxStreaming(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      await streamChat(
        newMsgs.map(m => ({ role: m.role, content: m.content })),
        (chunk) => setSphinxMsgs(prev => {
          const cp = [...prev];
          const last = cp[cp.length - 1];
          if (last?.role === "assistant") cp[cp.length - 1] = { ...last, content: last.content + chunk };
          return cp;
        }),
        ctrl.signal
      );
    } catch {
      setSphinxMsgs(prev => {
        const cp = [...prev];
        if (cp[cp.length - 1]?.role === "assistant" && !cp[cp.length - 1].content)
          cp[cp.length - 1] = { ...cp[cp.length - 1], content: "The cosmic winds have disrupted my sight… Please try again, seeker." };
        return cp;
      });
    } finally {
      setSphinxStreaming(false);
    }
  }, [sphinxInput, sphinxMsgs, sphinxStreaming]);

  const sendSky = useCallback(async (text?: string) => {
    const content = (text ?? skyInput).trim();
    if (!content || skyStreaming) return;
    const shortAddr = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : null;
    const ctx = isConnected && shortAddr ? `[Wallet: ${shortAddr}${formattedBalance ? `, SKYNT: ${formattedBalance}` : ""}] ` : "";
    const newMsgs: Message[] = [...skyMsgs.filter(m => m.content), { role: "user", content: ctx + content }];
    setSkyMsgs(prev => [...prev, { role: "user", content }, { role: "assistant", content: "" }]);
    setSkyInput("");
    setSkyStreaming(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      await streamChat(
        newMsgs.map(m => ({ role: m.role, content: m.content })),
        (chunk) => setSkyMsgs(prev => {
          const cp = [...prev];
          const last = cp[cp.length - 1];
          if (last?.role === "assistant") cp[cp.length - 1] = { ...last, content: last.content + chunk };
          return cp;
        }),
        ctrl.signal
      );
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        setSkyMsgs(prev => {
          const cp = [...prev];
          if (cp[cp.length - 1]?.role === "assistant" && !cp[cp.length - 1].content)
            cp[cp.length - 1] = { ...cp[cp.length - 1], content: "Unable to reach SKYNT AI. Please try again." };
          return cp;
        });
      }
    } finally {
      setSkyStreaming(false);
    }
  }, [skyInput, skyMsgs, skyStreaming, isConnected, address, formattedBalance]);

  const handleClose = () => {
    abortRef.current?.abort();
    setOpen(false);
  };

  const clearSphinx = () => setSphinxMsgs([{ role: "assistant", content: SPHINX_GREETING }]);
  const clearSky = () => setSkyMsgs([]);

  if (location === "/serpent") return null;

  const isStreaming = mode === "sphinx" ? sphinxStreaming : skyStreaming;
  const hasSphinxActivity = sphinxMsgs.length > 1;
  const hasSkyActivity = skyMsgs.length > 1;

  if (!open) {
    return (
      <button
        data-testid="button-ai-widget-open"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 group"
        style={{
          background: "linear-gradient(135deg, hsl(270 100% 55% / 0.9) 0%, hsl(185 100% 50% / 0.9) 100%)",
          boxShadow: "0 0 18px hsl(270 100% 55% / 0.35), 0 4px 14px rgba(0,0,0,0.4)",
        }}
        title="SKYNT AI"
      >
        <MessageCircle className="w-5 h-5 text-white" />
        {(hasSphinxActivity || hasSkyActivity) && (
          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-neon-green border-2 border-background" />
        )}
        <span className="absolute bottom-14 right-0 bg-black/90 text-[10px] font-mono text-white px-2.5 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-white/10 pointer-events-none">
          SKYNT AI
        </span>
      </button>
    );
  }

  return (
    <div
      data-testid="ai-widget-panel"
      className="fixed bottom-6 right-6 z-50 w-[380px] max-h-[560px] flex flex-col rounded-xl overflow-hidden border"
      style={{
        background: "linear-gradient(180deg, hsl(230 20% 7%) 0%, hsl(240 15% 5%) 100%)",
        borderColor: mode === "sphinx" ? "hsl(185 100% 50% / 0.3)" : "hsl(270 100% 55% / 0.3)",
        boxShadow: mode === "sphinx"
          ? "0 0 30px hsl(185 100% 50% / 0.12), 0 8px 32px rgba(0,0,0,0.6)"
          : "0 0 30px hsl(270 100% 55% / 0.15), 0 8px 32px rgba(0,0,0,0.6)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 flex-shrink-0"
        style={{
          background: mode === "sphinx"
            ? "linear-gradient(90deg, hsl(185 100% 50% / 0.08), hsl(280 100% 60% / 0.06))"
            : "linear-gradient(90deg, hsl(270 100% 50% / 0.12), hsl(300 100% 60% / 0.07))",
        }}
      >
        {/* Mode tabs */}
        <div className="flex items-center gap-1 p-0.5 bg-white/5 rounded-lg" data-testid="ai-mode-tabs">
          <button
            data-testid="tab-sphinx-mode"
            onClick={() => setMode("sphinx")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-md font-mono text-[10px] font-bold uppercase tracking-wider transition-all duration-200",
              mode === "sphinx"
                ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Eye className="w-3 h-3" />
            Sphinx
          </button>
          <button
            data-testid="tab-skynt-mode"
            onClick={() => setMode("skynt")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-md font-mono text-[10px] font-bold uppercase tracking-wider transition-all duration-200",
              mode === "skynt"
                ? "bg-neon-magenta/20 text-neon-magenta border border-neon-magenta/30"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Bot className="w-3 h-3" />
            SKYNT AI
          </button>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1">
          <button
            data-testid="button-ai-clear"
            onClick={mode === "sphinx" ? clearSphinx : clearSky}
            className="p-1.5 text-muted-foreground hover:text-neon-orange transition-colors rounded"
            title="Clear conversation"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            data-testid="button-ai-close"
            onClick={handleClose}
            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Sub-header — persona label */}
      {mode === "sphinx" ? (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5 flex-shrink-0">
          <div className="w-6 h-6 rounded-full flex items-center justify-center bg-neon-cyan/10 border border-neon-cyan/20">
            <Eye className="w-3 h-3 text-neon-cyan" />
          </div>
          <div>
            <p className="font-heading text-[10px] font-bold tracking-widest text-neon-cyan" data-testid="text-oracle-title">THE OMNISCIENT SPHINX</p>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" />
              <span className="font-mono text-[9px] text-muted-foreground">ORACLE ACTIVE</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5 flex-shrink-0">
          <div className="w-6 h-6 rounded-full flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, hsl(270 100% 50% / 0.7), hsl(300 100% 60% / 0.7))" }}
          >
            <Bot className="w-3 h-3 text-white" />
          </div>
          <div>
            <p className="font-heading text-[10px] font-bold text-white uppercase tracking-wider">SKYNT AI Advisor</p>
            {isConnected && formattedBalance && (
              <p className="font-mono text-[9px] text-neon-magenta flex items-center gap-1">
                <Coins className="w-2.5 h-2.5" />
                {formattedBalance} SKYNT
              </p>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {mode === "sphinx" && sphinxMsgs.map((msg, i) => (
          <div
            key={i}
            className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
            data-testid={`chat-message-${msg.role}-${i}`}
          >
            {msg.role === "assistant" && (
              <div className="w-5 h-5 rounded-full flex items-center justify-center mr-2 mt-0.5 shrink-0 bg-neon-cyan/10 border border-neon-cyan/20">
                <Sparkles className="w-2.5 h-2.5 text-neon-cyan" />
              </div>
            )}
            <div
              className={cn(
                "max-w-[280px] px-3 py-2 rounded-lg text-[12px] leading-relaxed",
                msg.role === "user"
                  ? "bg-neon-cyan/10 text-foreground border border-neon-cyan/20 font-mono"
                  : "bg-white/[0.03] text-foreground/90 border border-white/[0.06]"
              )}
            >
              {msg.content}
              {sphinxStreaming && i === sphinxMsgs.length - 1 && msg.role === "assistant" && (
                <span className="inline-block w-1.5 h-4 bg-neon-cyan ml-0.5 animate-pulse" />
              )}
            </div>
          </div>
        ))}

        {mode === "skynt" && skyMsgs.map((msg, i) => (
          <div
            key={i}
            className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
            data-testid={`sky-ai-message-${msg.role}-${i}`}
          >
            <div
              className={cn(
                "max-w-[85%] px-3 py-2 rounded-lg font-mono text-[11px] leading-relaxed",
                msg.role === "user"
                  ? "bg-neon-magenta/15 border border-neon-magenta/25 text-white text-right"
                  : "bg-white/5 border border-white/[0.08] text-muted-foreground"
              )}
            >
              {msg.content || (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Thinking…
                </span>
              )}
            </div>
          </div>
        ))}

        <div ref={mode === "sphinx" ? sphinxEndRef : skyEndRef} />
      </div>

      {/* Quick suggestions */}
      {mode === "sphinx" && sphinxMsgs.length <= 1 && !sphinxStreaming && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5 flex-shrink-0">
          {SPHINX_SUGGESTIONS.map((s) => (
            <button
              key={s}
              data-testid={`button-suggestion-${s.slice(0, 20).toLowerCase().replace(/\s+/g, "-")}`}
              onClick={() => sendSphinx(s)}
              className="text-[10px] font-mono px-2.5 py-1.5 rounded-full border border-neon-cyan/20 text-muted-foreground hover:text-neon-cyan hover:border-neon-cyan/40 transition-colors bg-neon-cyan/5"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {mode === "skynt" && skyMsgs.length <= 1 && !skyStreaming && (
        <div className="px-3 pb-2 flex flex-wrap gap-1.5 flex-shrink-0">
          {SKYNT_QUICK.map((q) => (
            <button
              key={q.label}
              data-testid={`button-quick-prompt-${q.label.replace(/\s+/g, "-").toLowerCase()}`}
              onClick={() => sendSky(q.prompt)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-full font-mono text-[10px] text-muted-foreground bg-white/5 border border-white/10 hover:border-neon-magenta/30 hover:text-white transition-colors"
            >
              <q.icon className="w-3 h-3" />
              {q.label}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      {mode === "sphinx" ? (
        <form
          onSubmit={(e) => { e.preventDefault(); sendSphinx(); }}
          className="flex items-center gap-2 p-3 border-t border-white/5 flex-shrink-0 bg-black/30"
        >
          <input
            ref={sphinxInputRef}
            data-testid="input-oracle-message"
            type="text"
            value={sphinxInput}
            onChange={(e) => setSphinxInput(e.target.value)}
            placeholder="Ask the Sphinx…"
            disabled={sphinxStreaming}
            className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 font-mono focus:outline-none focus:border-neon-cyan/40 focus:ring-1 focus:ring-neon-cyan/20 disabled:opacity-50"
          />
          <button
            data-testid="button-send-oracle"
            type="submit"
            disabled={!sphinxInput.trim() || sphinxStreaming}
            className="w-9 h-9 rounded-md flex items-center justify-center transition-all disabled:opacity-30"
            style={{
              background: sphinxInput.trim() && !sphinxStreaming
                ? "linear-gradient(135deg, hsl(185 100% 50%), hsl(280 100% 60%))"
                : "hsl(220 20% 15%)",
            }}
          >
            {sphinxStreaming ? <Loader2 className="w-4 h-4 text-foreground animate-spin" /> : <Send className="w-4 h-4 text-black" />}
          </button>
        </form>
      ) : (
        <div className="px-3 pb-3 flex-shrink-0 border-t border-white/5 pt-2 bg-black/30">
          <div className="flex items-end gap-2">
            <textarea
              ref={skyInputRef}
              data-testid="input-sky-ai"
              value={skyInput}
              onChange={(e) => setSkyInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendSky(); } }}
              placeholder="Ask anything about SKYNT…"
              rows={1}
              disabled={skyStreaming}
              className="flex-1 resize-none bg-white/5 border border-white/10 rounded-lg px-3 py-2 font-mono text-[11px] text-white placeholder:text-muted-foreground focus:outline-none focus:border-neon-magenta/40 disabled:opacity-50 max-h-24 overflow-y-auto"
            />
            <button
              data-testid="button-sky-ai-send"
              onClick={() => sendSky()}
              disabled={!skyInput.trim() || skyStreaming}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-white transition-all flex-shrink-0 disabled:opacity-40"
              style={{
                background: "linear-gradient(135deg, hsl(270 100% 50%) 0%, hsl(300 100% 60%) 100%)",
                boxShadow: skyInput.trim() && !skyStreaming ? "0 0 12px hsl(270 100% 50% / 0.4)" : "none",
              }}
            >
              {skyStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
          <p className="font-mono text-[9px] text-muted-foreground/50 mt-1.5 text-center">SKYNT AI · Oracle Consciousness v8</p>
        </div>
      )}
    </div>
  );
}
