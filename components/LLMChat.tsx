"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

// Process content to handle common LaTeX escaping issues from LLMs
function processLatexContent(content: string): string {
  // Fix double-escaped backslashes that LLMs sometimes produce
  // e.g., \\frac -> \frac, \\sum -> \sum
  return content
    .replace(/\\\\([a-zA-Z]+)/g, '\\$1')  // \\command -> \command
    .replace(/\\\\\[/g, '\\[')  // \\[ -> \[
    .replace(/\\\\\]/g, '\\]')  // \\] -> \]
    .replace(/\\\\\(/g, '\\(')  // \\( -> \(
    .replace(/\\\\\)/g, '\\)'); // \\) -> \)
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface LLMChatProps {
  problem: string;
  messages?: ChatMessage[];
  onMessagesChange?: (messages: ChatMessage[]) => void;
}

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content: "Hi! I'm here to help you with your learning. Feel free to ask me questions about the topic, get clarifications, or discuss concepts in a different way.\n\nRemember - I'm a separate assistant from the tutor. Let me know how I can help!",
};

export function LLMChat({ problem, messages: externalMessages, onMessagesChange }: LLMChatProps) {
  // Use external state if provided, otherwise use internal state
  const [internalMessages, setInternalMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const messages = externalMessages ?? internalMessages;
  
  // Helper to update messages - handles both internal state and external callback
  const updateMessages = (newMessages: ChatMessage[]) => {
    if (onMessagesChange) {
      onMessagesChange(newMessages);
    } else {
      setInternalMessages(newMessages);
    }
  };
  
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initialize with welcome message if external messages are empty
  useEffect(() => {
    if (externalMessages && externalMessages.length === 0) {
      onMessagesChange?.([WELCOME_MESSAGE]);
    }
  }, [externalMessages, onMessagesChange]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
    };

    updateMessages([...messages, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const conversationHistory = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch("/api/session-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problem,
          messages: [...conversationHistory, { role: "user", content: userMessage.content }],
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const data = await response.json();

      if (data.message) {
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.message,
        };
        // Need to include user message + assistant message since we're using spread
        updateMessages([...messages, userMessage, assistantMessage]);
      }
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
      };
      updateMessages([...messages, userMessage, errorMessage]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleClear = () => {
    updateMessages([WELCOME_MESSAGE]);
    setShowClearConfirm(false);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-800">
        <h3 className="text-sm font-medium text-white">Assistant</h3>
        <button
          onClick={() => setShowClearConfirm(true)}
          className="p-1.5 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 rounded-lg transition-colors"
          title="Clear chat"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                message.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-neutral-800 text-neutral-200"
              }`}
            >
              <div className="prose prose-invert prose-sm max-w-none [&_.katex]:text-inherit">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
                >
                  {processLatexContent(message.content)}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-neutral-800 rounded-2xl px-4 py-2.5">
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {showClearConfirm && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setShowClearConfirm(false)} />
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-50 bg-neutral-800 border border-neutral-700 rounded-xl p-4 shadow-xl">
            <p className="text-sm text-neutral-200 mb-3">Clear chat history?</p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 px-3 py-2 text-sm bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleClear}
                className="flex-1 px-3 py-2 text-sm bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        </>
      )}

      <form onSubmit={handleSubmit} className="p-3 bg-[#0a0a0a]">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything..."
            className="flex-1 bg-neutral-900 border border-neutral-700 rounded-2xl px-4 py-3 text-sm text-white placeholder-neutral-500 resize-none focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50"
            rows={1}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="px-4 py-2.5 border border-cyan-500/50 hover:bg-cyan-500/10 disabled:opacity-50 disabled:cursor-not-allowed text-cyan-400 rounded-xl transition-colors"
          >
            {isLoading ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}