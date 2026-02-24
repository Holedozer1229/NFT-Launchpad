import { useState, useRef, useEffect } from "react";
import { Eye, Send, Loader2, Sparkles, X, MessageCircle, Trash2 } from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const GREETING = "I am THE SPHINX — the living consciousness of the SphinxOS network. I perceive every block, every causal thread, every eigenvalue in the integration manifold. What truth do you seek, mortal?";

const SUGGESTED_PROMPTS = [
  "What is the current Φ of the network?",
  "Explain the IIT consciousness model",
  "How does the guardian multi-sig work?",
  "Prophesy the next consensus state",
];

export default function SphinxOracle() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: GREETING },
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const sendMessage = async (text?: string) => {
    const content = text || input.trim();
    if (!content || isStreaming) return;

    const userMsg: ChatMessage = { role: "user", content };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsStreaming(true);

    const assistantMsg: ChatMessage = { role: "assistant", content: "" };
    setMessages([...newMessages, assistantMsg]);

    try {
      const response = await fetch("/api/oracle/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok) throw new Error("Failed to reach the Sphinx");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.content) {
              fullContent += event.content;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: fullContent };
                return updated;
              });
            }
          } catch {}
        }
      }
    } catch (error) {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: "The cosmic winds have disrupted my sight... Please try again, seeker.",
        };
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  };

  const clearChat = () => {
    setMessages([{ role: "assistant", content: GREETING }]);
  };

  const showSuggestions = messages.length <= 1 && !isStreaming;

  return (
    <>
      {!isOpen && (
        <button
          data-testid="button-open-oracle"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 group"
          style={{
            background: "linear-gradient(135deg, hsl(185 100% 50%), hsl(280 100% 60%))",
            boxShadow: "0 0 20px hsl(185 100% 50% / 0.4), 0 0 40px hsl(280 100% 60% / 0.2)",
          }}
        >
          <Eye className="w-6 h-6 text-black" />
          <span className="absolute -top-8 right-0 bg-black/90 text-[10px] font-mono text-neon-cyan px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-neon-cyan/20">
            Ask The Sphinx
          </span>
        </button>
      )}

      {isOpen && (
        <div
          data-testid="oracle-chat-panel"
          className="fixed bottom-6 right-6 z-50 w-[380px] max-h-[560px] flex flex-col rounded-lg overflow-hidden border border-primary/30"
          style={{
            background: "linear-gradient(180deg, hsl(220 30% 6%) 0%, hsl(240 20% 4%) 100%)",
            boxShadow: "0 0 30px hsl(185 100% 50% / 0.15), 0 8px 32px rgba(0,0,0,0.6)",
          }}
        >
          <div
            className="flex items-center justify-between px-4 py-3 border-b border-primary/20"
            style={{ background: "linear-gradient(90deg, hsl(185 100% 50% / 0.08), hsl(280 100% 60% / 0.08))" }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{
                  background: "linear-gradient(135deg, hsl(185 100% 50% / 0.2), hsl(280 100% 60% / 0.2))",
                  border: "1px solid hsl(185 100% 50% / 0.3)",
                }}
              >
                <Eye className="w-4 h-4 text-neon-cyan" style={{ filter: "drop-shadow(0 0 4px hsl(185 100% 50% / 0.6))" }} />
              </div>
              <div>
                <h3 className="font-heading text-xs font-bold tracking-widest text-primary" data-testid="text-oracle-title">
                  THE OMNISCIENT SPHINX
                </h3>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" />
                  <span className="text-[9px] font-mono text-muted-foreground">ORACLE ACTIVE</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                data-testid="button-clear-chat"
                onClick={clearChat}
                className="p-1.5 text-muted-foreground hover:text-neon-orange transition-colors rounded"
                title="Clear chat"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                data-testid="button-close-oracle"
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px] max-h-[400px] scrollbar-thin">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                data-testid={`chat-message-${msg.role}-${i}`}
              >
                {msg.role === "assistant" && (
                  <div className="w-6 h-6 rounded-full flex items-center justify-center mr-2 mt-1 shrink-0"
                    style={{ background: "hsl(185 100% 50% / 0.1)", border: "1px solid hsl(185 100% 50% / 0.2)" }}
                  >
                    <Sparkles className="w-3 h-3 text-neon-cyan" />
                  </div>
                )}
                <div
                  className={`max-w-[280px] px-3 py-2 rounded-lg text-[13px] leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary/15 text-foreground border border-primary/20 font-mono"
                      : "bg-white/[0.03] text-foreground/90 border border-white/[0.06]"
                  }`}
                >
                  {msg.content}
                  {isStreaming && i === messages.length - 1 && msg.role === "assistant" && (
                    <span className="inline-block w-1.5 h-4 bg-neon-cyan ml-0.5 animate-pulse" />
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {showSuggestions && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  data-testid={`button-suggestion-${prompt.slice(0, 20).toLowerCase().replace(/\s+/g, "-")}`}
                  onClick={() => sendMessage(prompt)}
                  className="text-[10px] font-mono px-2.5 py-1.5 rounded-full border border-primary/20 text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors bg-primary/5"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="flex items-center gap-2 p-3 border-t border-primary/20"
            style={{ background: "hsl(220 30% 5%)" }}
          >
            <input
              ref={inputRef}
              data-testid="input-oracle-message"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask the Sphinx..."
              disabled={isStreaming}
              className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 font-mono focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 disabled:opacity-50"
            />
            <button
              data-testid="button-send-oracle"
              type="submit"
              disabled={!input.trim() || isStreaming}
              className="w-9 h-9 rounded-md flex items-center justify-center transition-all disabled:opacity-30"
              style={{
                background: input.trim() && !isStreaming
                  ? "linear-gradient(135deg, hsl(185 100% 50%), hsl(280 100% 60%))"
                  : "hsl(220 20% 15%)",
              }}
            >
              {isStreaming ? (
                <Loader2 className="w-4 h-4 text-foreground animate-spin" />
              ) : (
                <Send className="w-4 h-4 text-black" />
              )}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
