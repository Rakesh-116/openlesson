"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Editor from "@monaco-editor/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { executeCode, destroySandbox, type ExecutionResult } from "@/lib/sandbox";

interface OutputLine {
  type: "log" | "warn" | "error" | "result";
  content: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface CodingData {
  code: string;
  output: OutputLine[];
  chatHistory?: Array<{ role: string; content: string }>;
}

interface CodingToolProps {
  sessionId: string;
  problem: string;
  initialCode?: string;
  initialChatHistory?: Array<{ role: string; content: string }>;
  onDataChange?: (data: CodingData) => void;
}

const DEFAULT_CODE = `// Start coding here
console.log("Hello, world!");`;

export function CodingTool({
  sessionId,
  problem,
  initialCode,
  initialChatHistory,
  onDataChange,
}: CodingToolProps) {
  const [code, setCode] = useState(initialCode || DEFAULT_CODE);
  const [output, setOutput] = useState<OutputLine[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => {
    if (initialChatHistory && initialChatHistory.length > 0) {
      return initialChatHistory.map((m, i) => ({
        id: `restored-${i}`,
        role: m.role as "user" | "assistant",
        content: m.content,
      }));
    }
    return [
      {
        id: "welcome",
        role: "assistant",
        content: "Hi! I'm your coding assistant. I can help you write JavaScript code, explain concepts, or debug issues. What would you like to build?",
      },
    ];
  });
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"output" | "chat">("output");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Scroll chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Cleanup sandbox on unmount
  useEffect(() => {
    return () => {
      destroySandbox();
    };
  }, []);

  // Debounced save to parent
  const saveData = useCallback(() => {
    if (onDataChange) {
      onDataChange({
        code,
        output,
        chatHistory: messages.map((m) => ({ role: m.role, content: m.content })),
      });
    }
  }, [code, output, messages, onDataChange]);

  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(saveData, 1000);
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [code, output, messages, saveData]);

  const handleRunCode = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setOutput([]);

    try {
      const result = await executeCode(code);
      setOutput(result.output);
    } catch (error) {
      setOutput([{ type: "error", content: `Execution failed: ${error}` }]);
    } finally {
      setIsRunning(false);
    }
  };

  const handleClearOutput = () => {
    setOutput([]);
  };

  const handleClearEditor = () => {
    setCode(DEFAULT_CODE);
    setOutput([]);
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: chatInput.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setChatInput("");
    setIsChatLoading(true);

    try {
      const conversationHistory = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch("/api/coder-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          problem,
          code,
          messages: [...conversationHistory, { role: "user", content: userMessage.content }],
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const data = await response.json();

      if (data.message) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.message,
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (error) {
      console.error("Coder chat error:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsChatLoading(false);
      chatInputRef.current?.focus();
    }
  };

  const handleChatKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleChatSubmit(e);
    }
  };

  const insertCodeToEditor = (codeBlock: string) => {
    setCode(codeBlock);
    setActiveTab("output");
  };

  // Extract code blocks from markdown content
  const renderMessageWithInsert = (content: string) => {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ node, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            const isCodeBlock = match || (typeof children === "string" && children.includes("\n"));
            const codeContent = String(children).replace(/\n$/, "");

            if (isCodeBlock) {
              return (
                <div className="relative group my-2">
                  <pre className="bg-neutral-950 rounded-lg p-3 overflow-x-auto border border-neutral-700">
                    <code className="text-xs text-neutral-200 font-mono" {...props}>
                      {children}
                    </code>
                  </pre>
                  <button
                    onClick={() => insertCodeToEditor(codeContent)}
                    className="absolute top-2 right-2 px-2 py-1 text-[10px] bg-blue-600 hover:bg-blue-500 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    Insert to Editor
                  </button>
                </div>
              );
            }
            return (
              <code className="bg-neutral-800 px-1.5 py-0.5 rounded text-xs" {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    );
  };

  return (
    <div className="flex flex-col h-full bg-neutral-950">
      {/* Editor Section */}
      <div className="flex-1 min-h-0 flex flex-col border-b border-neutral-800">
        <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800 bg-neutral-900/50">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-sm font-medium text-white">JavaScript Editor</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleClearEditor}
              className="px-2 py-1 text-xs text-neutral-400 hover:text-white hover:bg-neutral-800 rounded transition-colors"
            >
              Clear
            </button>
            <button
              onClick={handleRunCode}
              disabled={isRunning}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              {isRunning ? (
                <>
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Running...
                </>
              ) : (
                <>
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Run
                </>
              )}
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <Editor
            height="100%"
            defaultLanguage="javascript"
            theme="vs-dark"
            value={code}
            onChange={(value) => setCode(value || "")}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbers: "on",
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              wordWrap: "on",
              padding: { top: 12 },
            }}
          />
        </div>
      </div>

      {/* Bottom Panel - Output/Chat Tabs */}
      <div className="h-[40%] min-h-[200px] flex flex-col">
        {/* Tab Buttons */}
        <div className="flex items-center gap-1 px-3 py-2 border-b border-neutral-800 bg-neutral-900/50">
          <button
            onClick={() => setActiveTab("output")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              activeTab === "output"
                ? "bg-neutral-700 text-white"
                : "text-neutral-400 hover:text-white hover:bg-neutral-800"
            }`}
          >
            Console Output
          </button>
          <button
            onClick={() => setActiveTab("chat")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              activeTab === "chat"
                ? "bg-blue-600 text-white"
                : "text-neutral-400 hover:text-white hover:bg-neutral-800"
            }`}
          >
            Coder Assistant
          </button>
          {activeTab === "output" && output.length > 0 && (
            <button
              onClick={handleClearOutput}
              className="ml-auto px-2 py-1 text-xs text-neutral-500 hover:text-white hover:bg-neutral-800 rounded transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {/* Output Tab */}
        {activeTab === "output" && (
          <div className="flex-1 overflow-y-auto p-3 font-mono text-xs">
            {output.length === 0 ? (
              <div className="text-neutral-500 italic">
                Run your code to see output here...
              </div>
            ) : (
              <div className="space-y-1">
                {output.map((line, i) => (
                  <div
                    key={i}
                    className={`${
                      line.type === "error"
                        ? "text-red-400"
                        : line.type === "warn"
                        ? "text-yellow-400"
                        : line.type === "result"
                        ? "text-emerald-400"
                        : "text-neutral-200"
                    }`}
                  >
                    <span className="text-neutral-600 mr-2">
                      {line.type === "error" ? "!" : line.type === "warn" ? "!" : ">"}
                    </span>
                    <span className="whitespace-pre-wrap">{line.content}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Chat Tab */}
        {activeTab === "chat" && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl px-3 py-2 text-xs ${
                      message.role === "user"
                        ? "bg-blue-600 text-white"
                        : "bg-neutral-800 text-neutral-200"
                    }`}
                  >
                    {message.role === "assistant" ? (
                      <div className="prose prose-invert prose-xs max-w-none">
                        {renderMessageWithInsert(message.content)}
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    )}
                  </div>
                </div>
              ))}
              {isChatLoading && (
                <div className="flex justify-start">
                  <div className="bg-neutral-800 rounded-xl px-3 py-2">
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleChatSubmit} className="p-2 border-t border-neutral-800">
              <div className="flex gap-2 items-end">
                <textarea
                  ref={chatInputRef}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={handleChatKeyDown}
                  placeholder="Ask the Coder for help..."
                  className="flex-1 bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 resize-none focus:outline-none focus:border-blue-500"
                  rows={1}
                  disabled={isChatLoading}
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || isChatLoading}
                  className="p-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
