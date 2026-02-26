"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  planModified?: boolean;
}

interface ChatPanelProps {
  planId: string;
  description?: string;
  model?: string;
  onModelChange?: (model: string) => void;
  onRefresh?: () => void;
  supabase?: ReturnType<typeof createBrowserClient>;
  isOwner?: boolean;
}

export function ChatPanel({ planId, description, model, onModelChange, onRefresh, supabase, isOwner = true }: ChatPanelProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showModelSelect, setShowModelSelect] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const models = [
    { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash" },
    { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet" },
    { id: "openai/gpt-4o-mini", name: "GPT-4o Mini" },
    { id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3" },
  ];

  const currentModel = model || "google/gemini-2.5-flash";

  useEffect(() => {
    if (description && messages.length === 0) {
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content: description,
          timestamp: new Date(),
        },
      ]);
    }
  }, [description]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Include full message history for context
      const conversationHistory = messages.map(m => ({
        role: m.role,
        content: m.content
      }));

      const response = await fetch("/api/learning-plan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          userPrompt: userMessage.content,
          conversationHistory,
          model: currentModel,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const data = await response.json();

      // Only add AI response if there was a change or it's a direct answer
      if (data.explanation) {
        let responseContent = data.explanation;
        
        // If plan was modified or there's a currentPlan summary, show it prominently
        if (data.planModified && data.currentPlan) {
          responseContent += `\n\n📋 **Current Plan:**\n${data.currentPlan}`;
        } else if (data.currentPlan) {
          responseContent += `\n\n📋 **Current Plan:**\n${data.currentPlan}`;
        }

        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: responseContent,
          timestamp: new Date(),
          planModified: data.planModified || false,
        };

        setMessages((prev) => [...prev, aiMessage]);
      }

      if (data.questions && data.questions.length > 0) {
        const questionMessage: Message = {
          id: (Date.now() + 3).toString(),
          role: "assistant",
          content: data.questions[0],
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, questionMessage]);
      }

      router.refresh();
      
      // Trigger refresh
      if (onRefresh) {
        setTimeout(() => onRefresh(), 300);
      }
      
      // Also directly refresh if supabase client provided
      if (supabase) {
        setTimeout(async () => {
          const { data: nodesData } = await supabase
            .from("plan_nodes")
            .select("*")
            .eq("plan_id", planId);
          console.log("[ChatPanel] Refreshed nodes:", nodesData?.length);
        }, 500);
      }
    } catch (err) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center mb-4 px-1">
        <h2 className="text-lg font-semibold text-white">AI Planner</h2>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] px-4 py-3 rounded-2xl ${
                msg.role === "user"
                  ? "bg-blue-600 text-white rounded-br-md"
                  : "bg-neutral-800 text-neutral-200 rounded-bl-md"
              }`}
            >
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              <p className={`text-[10px] mt-2 ${
                msg.role === "user" ? "text-blue-200" : "text-neutral-500"
              }`}>
                {msg.role === "user" ? "You" : "AI Planner"} • {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>

            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-neutral-800 px-4 py-3 rounded-2xl rounded-bl-md">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-neutral-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 bg-neutral-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 bg-neutral-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {!isOwner && (
        <div className="mt-auto pt-4 border-t border-neutral-800">
          <div className="text-center mb-4">
            <p className="text-sm text-neutral-400 mb-2">
              This is a public plan. Fork it to customize for your learning journey.
            </p>
          </div>
          <button
            onClick={() => {
              const event = new CustomEvent("openRemixModal");
              window.dispatchEvent(event);
            }}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition-colors"
          >
            Fork / Remix This Plan
          </button>
        </div>
      )}

      {isOwner && (
        <form onSubmit={handleSubmit} className="relative">
          <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask to modify your plan, add sessions, or change the order..."
          className="w-full px-4 py-3 pr-12 bg-neutral-800 border border-neutral-700 rounded-xl text-white placeholder-neutral-500 text-sm resize-none focus:outline-none focus:border-neutral-600 focus:ring-1 focus:ring-neutral-600"
          rows={2}
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="absolute right-2 bottom-3 p-2 bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-700 disabled:text-neutral-500 text-white rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
        </form>
      )}
    </div>
  );
}