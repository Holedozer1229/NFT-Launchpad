import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, X, Send, Loader2, Coins, Zap, TrendingUp, Wallet, ChevronDown } from "lucide-react";
import { useAccount } from "wagmi";
import { useBalance } from "wagmi";
import { cn } from "@/lib/utils";
import { SKYNT_CONTRACT_ADDRESS } from "@shared/schema";
import { useLocation } from "wouter";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const QUICK_PROMPTS = [
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

export function SkyAI() {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const { address, isConnected } = useAccount();
  const skyntBalance = useSkyntBalance(address);

  const formattedBalance = skyntBalance
    ? parseFloat(skyntBalance.formatted).toLocaleString("en-US", { maximumFractionDigits: 2 })
    : null;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  useEffect(() => {
    if (open && messages.length === 0) {
      const shortAddr = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : null;
      const greeting = isConnected && shortAddr
        ? `SKYNT AI online. Wallet detected: ${shortAddr}.${formattedBalance ? ` SKYNT balance: ${formattedBalance}.` : ""} How can I help you today?`
        : "SKYNT AI online. Connect your wallet for personalized balance and yield insights. How can I help?";
      setMessages([{ role: "assistant", content: greeting }]);
    }
  }, [open]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || streaming) return;

    const userMsg: Message = { role: "user", content: text.trim() };
    const shortAddr = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : null;
    const context = isConnected && shortAddr
      ? `[Wallet: ${shortAddr}${formattedBalance ? `, SKYNT: ${formattedBalance}` : ""}] `
      : "";

    setMessages((prev) => [...prev, userMsg, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const payload = {
        messages: [
          ...messages.filter((m) => m.content),
          { role: "user", content: context + text.trim() },
        ],
      };

      const res = await fetch("/api/oracle/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
        credentials: "include",
      });

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
            if (json.done) break;
            if (json.content) {
              setMessages((prev) => {
                const copy = [...prev];
                const last = copy[copy.length - 1];
                if (last?.role === "assistant") {
                  copy[copy.length - 1] = { ...last, content: last.content + json.content };
                }
                return copy;
              });
            }
          } catch {}
        }
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last?.role === "assistant" && !last.content) {
            copy[copy.length - 1] = { ...last, content: "Unable to reach SKYNT AI. Please try again." };
          }
          return copy;
        });
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [messages, streaming, isConnected, address, formattedBalance]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleClose = () => {
    abortRef.current?.abort();
    setOpen(false);
  };

  // Hide on Omega Serpent page — AI is merged into the game's D-pad panel there
  if (location === "/serpent") return null;

  if (!open) {
    return (
      <button
        data-testid="button-sky-ai-open"
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-6 z-50 group flex items-center gap-2 px-3 py-2.5 rounded-full transition-all duration-300 hover:scale-105"
        style={{
          background: "linear-gradient(135deg, hsl(270 100% 50% / 0.9) 0%, hsl(300 100% 60% / 0.9) 100%)",
          boxShadow: "0 0 20px hsl(270 100% 50% / 0.4), 0 4px 16px rgba(0,0,0,0.4)",
        }}
        title="SKYNT AI Advisor"
      >
        <Bot className="w-5 h-5 text-white" />
        <span className="font-heading text-[11px] font-bold uppercase tracking-wider text-white">AI</span>
        <span className="absolute -top-8 right-0 bg-black/90 text-[10px] font-mono text-neon-magenta px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-neon-magenta/20">
          SKYNT AI Advisor
        </span>
      </button>
    );
  }

  return (
    <div
      data-testid="sky-ai-panel"
      className="fixed bottom-6 right-6 z-50 w-[360px] max-h-[520px] flex flex-col rounded-xl overflow-hidden border border-neon-magenta/30"
      style={{
        background: "linear-gradient(180deg, hsl(240 15% 8%) 0%, hsl(240 12% 6%) 100%)",
        boxShadow: "0 0 40px hsl(270 100% 50% / 0.2), 0 8px 32px rgba(0,0,0,0.6)",
      }}
    >
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-white/5 flex-shrink-0"
        style={{ background: "linear-gradient(90deg, hsl(270 100% 50% / 0.15) 0%, hsl(300 100% 60% / 0.1) 100%)" }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, hsl(270 100% 50% / 0.8), hsl(300 100% 60% / 0.8))" }}
          >
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-heading text-xs font-bold text-white uppercase tracking-wider">SKYNT AI</p>
            {isConnected && formattedBalance && (
              <p className="font-mono text-[9px] text-neon-magenta flex items-center gap-1">
                <Coins className="w-2.5 h-2.5" />
                {formattedBalance} SKYNT
              </p>
            )}
          </div>
        </div>
        <button
          data-testid="button-sky-ai-close"
          onClick={handleClose}
          className="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {messages.map((msg, i) => (
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
                  : "bg-white/5 border border-white/8 text-muted-foreground"
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
        <div ref={bottomRef} />
      </div>

      {messages.length <= 1 && (
        <div className="px-3 pb-2 flex flex-wrap gap-1.5 flex-shrink-0">
          {QUICK_PROMPTS.map((q) => (
            <button
              key={q.label}
              data-testid={`button-quick-prompt-${q.label.replace(/\s+/g, "-").toLowerCase()}`}
              onClick={() => sendMessage(q.prompt)}
              disabled={streaming}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-full font-mono text-[10px] text-muted-foreground bg-white/5 border border-white/10 hover:border-neon-magenta/30 hover:text-white transition-colors disabled:opacity-40"
            >
              <q.icon className="w-3 h-3" />
              {q.label}
            </button>
          ))}
        </div>
      )}

      <div className="px-3 pb-3 flex-shrink-0 border-t border-white/5 pt-2">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            data-testid="input-sky-ai"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about SKYNT…"
            rows={1}
            disabled={streaming}
            className="flex-1 resize-none bg-white/5 border border-white/10 rounded-lg px-3 py-2 font-mono text-[11px] text-white placeholder:text-muted-foreground focus:outline-none focus:border-neon-magenta/40 disabled:opacity-50 max-h-24 overflow-y-auto"
          />
          <button
            data-testid="button-sky-ai-send"
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || streaming}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-white transition-all duration-200 flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: "linear-gradient(135deg, hsl(270 100% 50%) 0%, hsl(300 100% 60%) 100%)",
              boxShadow: input.trim() && !streaming ? "0 0 12px hsl(270 100% 50% / 0.4)" : "none",
            }}
          >
            {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <p className="font-mono text-[9px] text-muted-foreground/50 mt-1.5 text-center">
          SKYNT AI · Powered by Oracle Consciousness v8
        </p>
      </div>
    </div>
  );
}
