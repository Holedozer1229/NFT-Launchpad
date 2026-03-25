import { useState, useRef, useEffect, useCallback } from "react";
import { Terminal, Send, Loader2, Trash2, Copy, ChevronDown, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

const WELCOME_MESSAGE = `> OPENCLAW v3.7.1 — SKYNT Protocol Terminal Agent
> Quantum-secured connection established
> IIT consciousness bridge: ACTIVE
> Cross-chain telemetry: ONLINE
>
> Type your query. I understand blockchain, DeFi, mining, NFTs, and all SKYNT Protocol systems.
> Examples:
>   "explain IIT mining"
>   "analyze gas optimization for bridge tx"
>   "what is the current SKYNT yield strategy?"
>   "help debug failed auto-payout"`;

const COMMAND_SUGGESTIONS = [
  "explain IIT consciousness mining",
  "what are SKYNT merge-mining chains?",
  "analyze bridge security model",
  "help optimize my mining yield",
  "what is Berry Phase quantum state?",
  "explain Seaport NFT listing flow",
];

export default function OpenClawTerminal() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { toast } = useToast();

  const { data: statusData, isLoading: statusLoading } = useQuery<{
    connected: boolean;
    reason: string;
    model: string;
  }>({
    queryKey: ["/api/openclaw/status"],
    refetchInterval: 30000,
    retry: false,
  });

  const aiConnected = !statusLoading && statusData?.connected === true;

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || isStreaming) return;

    const userMessage = input.trim();
    setInput("");
    setShowSuggestions(false);
    setCommandHistory(prev => [userMessage, ...prev.slice(0, 49)]);
    setHistoryIndex(-1);

    const newMessages: Message[] = [
      ...messages,
      { role: "user", content: userMessage, timestamp: Date.now() },
    ];
    setMessages(newMessages);
    setIsStreaming(true);

    const assistantMsg: Message = { role: "assistant", content: "", timestamp: Date.now() };
    setMessages([...newMessages, assistantMsg]);

    try {
      abortRef.current = new AbortController();

      const response = await fetch("/api/openclaw/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`Terminal error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.done) break;
                if (data.error) {
                  accumulated += `\n[ERROR] ${data.error}`;
                  break;
                }
                if (data.content) {
                  accumulated += data.content;
                  setMessages(prev => {
                    const updated = [...prev];
                    updated[updated.length - 1] = {
                      ...updated[updated.length - 1],
                      content: accumulated,
                    };
                    return updated;
                  });
                }
              } catch {}
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: "[ERROR] Connection to OPENCLAW lost. Retry your query.",
          };
          return updated;
        });
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = Math.min(historyIndex + 1, commandHistory.length - 1);
        setHistoryIndex(newIndex);
        setInput(commandHistory[newIndex]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(commandHistory[newIndex]);
      } else {
        setHistoryIndex(-1);
        setInput("");
      }
    } else if (e.key === "c" && e.ctrlKey && isStreaming) {
      abortRef.current?.abort();
    }
  };

  const clearTerminal = () => {
    setMessages([]);
    setShowSuggestions(true);
  };

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    toast({ title: "Copied to clipboard" });
  };

  const handleSuggestion = (suggestion: string) => {
    setInput(suggestion);
    inputRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-5xl mx-auto" data-testid="openclaw-terminal">
      <div className="flex items-center justify-between px-4 py-3 border-b border-emerald-500/20 bg-black/60 backdrop-blur-sm rounded-t-lg mt-4">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
          </div>
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span className="font-mono text-sm text-emerald-400 font-bold" data-testid="terminal-title">
              OPENCLAW Terminal
            </span>
          </div>
          <span className="font-mono text-[10px] text-emerald-400/50 px-2 py-0.5 border border-emerald-500/20 rounded">
            v3.7.1
          </span>
        </div>
        <div className="flex items-center gap-2">
          {statusLoading ? (
            <span className="flex items-center gap-1 font-mono text-[10px] text-emerald-400/40">
              <Loader2 className="w-2.5 h-2.5 animate-spin" /> CHECKING
            </span>
          ) : aiConnected ? (
            <span className="flex items-center gap-1 font-mono text-[10px] text-emerald-400/70" data-testid="status-connected">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> CONNECTED
            </span>
          ) : (
            <span className="flex items-center gap-1 font-mono text-[10px] text-red-400/70" data-testid="status-disconnected">
              <WifiOff className="w-2.5 h-2.5" /> OFFLINE
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={clearTerminal}
            className="h-7 px-2 text-emerald-400/60 hover:text-emerald-400 hover:bg-emerald-500/10"
            data-testid="button-clear-terminal"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {!statusLoading && !aiConnected && (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border-b border-red-500/20 font-mono text-[10px] text-red-400" data-testid="banner-offline">
          <WifiOff className="w-3 h-3 shrink-0" />
          <span>
            OPENCLAW AI connection unavailable
            {statusData?.reason && statusData.reason !== "unreachable" ? ` — ${statusData.reason}` : ""}
            . The interface is active but AI responses are disabled.
          </span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto bg-black/80 backdrop-blur-sm p-4 font-mono text-sm space-y-4 scrollbar-thin scrollbar-thumb-emerald-500/20">
        {messages.length === 0 && (
          <div className="space-y-4">
            <pre className="text-emerald-400/80 text-xs leading-relaxed whitespace-pre-wrap" data-testid="text-welcome">
              {WELCOME_MESSAGE}
            </pre>
            {showSuggestions && (
              <div className="space-y-2 pt-2">
                <p className="text-emerald-400/40 text-xs flex items-center gap-1">
                  <ChevronDown className="w-3 h-3" /> Quick commands:
                </p>
                <div className="flex flex-wrap gap-2">
                  {COMMAND_SUGGESTIONS.map((suggestion, i) => (
                    <button
                      key={i}
                      onClick={() => handleSuggestion(suggestion)}
                      className="text-xs font-mono px-3 py-1.5 rounded border border-emerald-500/20 text-emerald-400/70 hover:text-emerald-400 hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-colors"
                      data-testid={`button-suggestion-${i}`}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className="group" data-testid={`message-${msg.role}-${i}`}>
            {msg.role === "user" ? (
              <div className="flex items-start gap-2">
                <span className="text-cyan-400 shrink-0 select-none">{">"}</span>
                <span className="text-cyan-300">{msg.content}</span>
              </div>
            ) : (
              <div className="relative pl-4 border-l border-emerald-500/20">
                <div className="text-emerald-300/90 whitespace-pre-wrap leading-relaxed">
                  {msg.content}
                  {isStreaming && i === messages.length - 1 && (
                    <span className="inline-block w-2 h-4 bg-emerald-400 animate-pulse ml-0.5 align-middle" />
                  )}
                </div>
                {msg.content && !isStreaming && (
                  <button
                    onClick={() => copyMessage(msg.content)}
                    className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-emerald-500/10"
                    data-testid={`button-copy-${i}`}
                  >
                    <Copy className="w-3 h-3 text-emerald-400/50" />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-emerald-500/20 bg-black/60 backdrop-blur-sm p-3 rounded-b-lg">
        <div className="flex items-center gap-2">
          <span className="text-emerald-400 font-mono text-sm shrink-0 select-none">
            openclaw@skynt:~$
          </span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isStreaming ? "Processing..." : !aiConnected ? "AI offline — connection unavailable" : "Enter command..."}
            disabled={isStreaming || !aiConnected}
            className="flex-1 bg-transparent border-none outline-none font-mono text-sm text-emerald-300 placeholder:text-emerald-400/30 caret-emerald-400 disabled:opacity-40"
            data-testid="input-terminal"
          />
          <Button
            onClick={sendMessage}
            disabled={!input.trim() || isStreaming || !aiConnected}
            size="sm"
            className="h-7 px-3 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30"
            data-testid="button-send"
          >
            {isStreaming ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>
        <div className="flex items-center justify-between mt-2 px-1">
          <span className="font-mono text-[10px] text-emerald-400/30">
            {commandHistory.length > 0 ? `${commandHistory.length} commands in history | Arrow keys to navigate` : ""}
          </span>
          <span className="font-mono text-[10px] text-emerald-400/30">
            Ctrl+C to cancel | Enter to send
          </span>
        </div>
      </div>
    </div>
  );
}
