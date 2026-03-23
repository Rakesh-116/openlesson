"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { useI18n } from "@/lib/i18n";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  planModified?: boolean;
  images?: UploadedImage[];
}

interface UploadedImage {
  id: string;
  data: string;
  mimeType: string;
  preview: string;
}

interface PlanNode {
  id: string;
  title: string;
  description: string;
  is_start: boolean;
  next_node_ids: string[];
  status: string;
  planning_prompt?: string;
}

interface ChatPanelProps {
  planId: string;
  model?: string;
  onModelChange?: (model: string) => void;
  onRefresh?: () => void;
  onNodesUpdate?: (nodes: PlanNode[]) => void;
  supabase?: ReturnType<typeof createBrowserClient>;
  isOwner?: boolean;
  currentUserId?: string | null;
}

export function ChatPanel({ planId, model, onModelChange, onRefresh, onNodesUpdate, supabase, isOwner = true, currentUserId }: ChatPanelProps) {
  const router = useRouter();
  const { t, locale } = useI18n();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showModelSelect, setShowModelSelect] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const models = [
    { id: "x-ai/grok-4", name: "Grok 4" },
    { id: "x-ai/grok-4-fast", name: "Grok 4 Fast" },
    { id: "grok-4.20-beta-0309-reasoning", name: "Grok 4.20 Beta (Reasoning)" },
    { id: "grok-4.20-beta-0309-non-reasoning", name: "Grok 4.20 Beta (Fast)" },
    { id: "anthropic/claude-sonnet-4", name: "Claude Sonnet 4" },
    { id: "openai/gpt-4o", name: "GPT-4o" },
  ];

  const currentModel = model || "x-ai/grok-4";

  const instructionalMessage = `**${t('learningPlanChat.welcome')}**

${t('learningPlanChat.intro')}
- **${t('learningPlanChat.addSessions').split(' – ')[0]}** – "${t('learningPlanChat.addSessions').split(' – ')[1]}"
- **${t('learningPlanChat.removeSessions').split(' – ')[0]}** – "${t('learningPlanChat.removeSessions').split(' – ')[1]}"
- **${t('learningPlanChat.reorder').split(' – ')[0]}** – "${t('learningPlanChat.reorder').split(' – ')[1]}"
- **${t('learningPlanChat.modifyContent').split(' – ')[0]}** – "${t('learningPlanChat.modifyContent').split(' – ')[1]}"

${t('learningPlanChat.changesAppear')}`;

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: "instructions",
          role: "assistant",
          content: instructionalMessage,
          timestamp: new Date(),
        },
      ]);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && uploadedImages.length === 0) || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim() || (uploadedImages.length > 0 ? `[Sent ${uploadedImages.length} image(s)]` : ""),
      timestamp: new Date(),
      images: uploadedImages.length > 0 ? [...uploadedImages] : undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setUploadedImages([]);
    setIsLoading(true);

    try {
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
          locale,
          images: uploadedImages.map(img => ({
            data: img.data,
            mimeType: img.mimeType,
          })),
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

      // If we have updated nodes from the API, use them directly for immediate UI update
      if (data.updatedNodes && data.updatedNodes.length > 0 && onNodesUpdate) {
        onNodesUpdate(data.updatedNodes);
      }
      
      // Also trigger refresh callbacks for other state updates
      if (onRefresh) {
        onRefresh();
      }
      
      // Trigger Next.js router refresh for server component updates
      router.refresh();
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

  const processFile = (file: File): Promise<UploadedImage> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1];
        resolve({
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          data: base64,
          mimeType: file.type || "image/png",
          preview: result,
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
    const newImages = await Promise.all(imageFiles.map(processFile));
    setUploadedImages((prev) => [...prev, ...newImages]);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    await handleFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageItems = Array.from(items).filter((item) => item.type.startsWith("image/"));
    const files = imageItems.map((item) => item.getAsFile()).filter(Boolean) as File[];
    if (files.length > 0) {
      const newImages = await Promise.all(files.map(processFile));
      setUploadedImages((prev) => [...prev, ...newImages]);
    }
  };

  const removeImage = (id: string) => {
    setUploadedImages((prev) => prev.filter((img) => img.id !== id));
  };

  const triggerFilePicker = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center mb-3 px-1">
        <h2 className="text-base font-semibold text-white">AI Planner</h2>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 mb-3 pr-2">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] px-4 py-2.5 rounded-xl ${
                msg.role === "user"
                  ? "bg-blue-600 text-white rounded-br-sm"
                  : "bg-neutral-800 text-neutral-200 rounded-bl-sm"
              }`}
            >
              {msg.images && msg.images.length > 0 && (
                <div className="flex gap-2 mb-2 flex-wrap">
                  {msg.images.map((img) => (
                    <img
                      key={img.id}
                      src={img.preview}
                      alt="Sent image"
                      className="w-16 h-16 object-cover rounded-lg border border-neutral-600"
                    />
                  ))}
                </div>
              )}
              <div className="prose prose-invert prose-sm max-w-none 
                prose-p:mb-6 prose-p:leading-7 prose-p:text-neutral-300
                prose-headings:mt-6 prose-headings:mb-3 prose-headings:text-neutral-100 prose-headings:font-semibold prose-headings:text-lg
                prose-h1:text-2xl prose-h1:font-bold prose-h1:mt-8 prose-h1:mb-4
                prose-h2:text-xl prose-h2:font-semibold prose-h2:mt-6 prose-h2:mb-3
                prose-h3:text-lg prose-h3:font-medium prose-h3:mt-4 prose-h3:mb-2
                prose-ul:my-3 prose-ul:pl-5 prose-ul:space-y-2
                prose-ol:my-3 prose-ol:pl-5 prose-ol:space-y-2
                prose-li:my-1 prose-li:text-neutral-300
                prose-strong:text-neutral-100 prose-strong:font-semibold
                prose-em:text-neutral-200
                prose-code:text-cyan-300 prose-code:bg-neutral-700 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs
                prose-pre:bg-neutral-900 prose-pre:text-neutral-200 prose-pre:rounded-lg prose-pre:my-4 prose-pre:p-4
                prose-blockquote:border-l-4 prose-blockquote:border-cyan-500/50 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-neutral-400 prose-blockquote:my-4 prose-blockquote:py-2
                prose-hr:border-neutral-700 prose-hr:my-6
                prose-a:text-cyan-400 prose-a:underline
                [&>p]:whitespace-pre-wrap [&>p]:leading-relaxed">
                {msg.content && (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
                  >
                    {msg.content}
                  </ReactMarkdown>
                )}
              </div>
              <p className={`text-[10px] mt-1.5 ${
                msg.role === "user" ? "text-blue-200" : "text-neutral-500"
              }`}>
                {msg.role === "user" ? "You" : "AI"} • {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-neutral-800 px-4 py-3 rounded-xl rounded-bl-sm">
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

      {!currentUserId ? (
        <div className="mt-auto pt-4 border-t border-neutral-800">
          <div className="text-center mb-4">
            <p className="text-sm text-neutral-400 mb-2">
              This learning plan can be copied and adapted to your needs. Sign up to get started.
            </p>
          </div>
          <a
            href="/register"
            className="block w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition-colors text-center"
          >
            Sign Up to Use This Plan
          </a>
        </div>
      ) : !isOwner ? (
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
      ) : (
        <form onSubmit={handleSubmit} className="relative">
          {uploadedImages.length > 0 && (
            <div className="flex gap-2 mb-2 flex-wrap">
              {uploadedImages.map((img) => (
                <div key={img.id} className="relative group">
                  <img
                    src={img.preview}
                    alt="Upload preview"
                    className="w-16 h-16 object-cover rounded-lg border border-neutral-700"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(img.id)}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <div
            className={`relative flex items-center gap-2 ${isDragging ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-neutral-900 rounded-xl" : ""}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <button
              type="button"
              onClick={triggerFilePicker}
              className="p-2.5 text-neutral-400 hover:text-white hover:bg-neutral-700 rounded-xl transition-colors self-center"
              title="Upload images"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="Add, remove, or reorder sessions... (paste or drag images)"
              className="flex-1 px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white placeholder-neutral-500 text-sm resize-none focus:outline-none focus:border-neutral-600 focus:ring-1 focus:ring-neutral-600"
              rows={3}
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() && uploadedImages.length === 0 || isLoading}
              className="p-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-700 disabled:text-neutral-500 text-white rounded-xl transition-colors self-center"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}