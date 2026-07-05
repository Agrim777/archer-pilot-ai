import { AppLayout } from "@/components/layout";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { BotMessageSquare, Send, Bot, User, Command } from "lucide-react";
import { cn } from "@/lib/utils";

type Message = { role: "user" | "assistant"; content: string };

export default function CopilotPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "I am the ArcherPilot AI Copilot. I can help you design data models, write complex calculation logic for Archer fields, or troubleshoot workflow issues. How can I assist you today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;

    const userMessage = input.trim();
    setInput("");

    // Build history excluding the initial greeting
    const history = messages.slice(1).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsStreaming(true);

    // Add an empty assistant message that we'll stream into
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");
      const response = await fetch(`${BASE_URL}/api/ai/copilot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage, history }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Server error: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (!data) continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.done) break;
            if (parsed.content) {
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  content: updated[updated.length - 1].content + parsed.content,
                };
                return updated;
              });
            }
          } catch {
            // ignore malformed SSE chunks
          }
        }
      }
    } catch (error) {
      console.error("Copilot SSE error:", error);
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last.role === "assistant" && !last.content) {
          updated[updated.length - 1] = {
            role: "assistant",
            content: "Sorry, I encountered an error connecting to the Copilot service. Please try again.",
          };
        }
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-full bg-background relative">
        <div className="flex-none h-16 border-b border-border/40 flex items-center px-6 shrink-0 bg-card z-10">
          <BotMessageSquare className="h-5 w-5 text-primary mr-3" />
          <div>
            <h1 className="font-semibold text-lg leading-none">Copilot Workspace</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Deep-dive assistance for your Archer implementations
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 max-w-4xl mx-auto w-full">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn("flex gap-4", msg.role === "user" ? "flex-row-reverse" : "flex-row")}
            >
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center shrink-0 border",
                  msg.role === "user"
                    ? "bg-secondary border-border"
                    : "bg-primary/10 border-primary/20",
                )}
              >
                {msg.role === "user" ? (
                  <User className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <Bot className="h-6 w-6 text-primary" />
                )}
              </div>
              <div
                className={cn(
                  "px-5 py-4 rounded-2xl max-w-[85%] text-[15px] leading-relaxed",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-card border border-border/50 rounded-tl-sm shadow-sm whitespace-pre-wrap",
                )}
              >
                {msg.content}
                {msg.role === "assistant" && isStreaming && i === messages.length - 1 && (
                  <span className="inline-block w-2 h-4 bg-primary ml-1 animate-pulse align-middle" />
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} className="h-4" />
        </div>

        <div className="p-4 bg-background border-t border-border/40 shrink-0">
          <div className="max-w-4xl mx-auto relative">
            <form onSubmit={handleSubmit} className="relative flex items-center">
              <div className="absolute left-4 text-muted-foreground">
                <Command className="h-5 w-5" />
              </div>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about Archer architecture, calculations, or workflows..."
                className="w-full h-14 bg-card border border-border/50 rounded-full pl-12 pr-16 text-base focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary shadow-sm"
                disabled={isStreaming}
              />
              <Button
                type="submit"
                size="icon"
                className="absolute right-2 h-10 w-10 rounded-full"
                disabled={!input.trim() || isStreaming}
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
            <div className="text-center mt-2 text-xs text-muted-foreground">
              AI Copilot can make mistakes. Verify critical configuration details.
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
