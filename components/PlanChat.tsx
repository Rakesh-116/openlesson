"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChatPanel } from "./ChatPanel";
import { SessionList } from "./SessionList";
import { RemixModal } from "./RemixModal";
import { useI18n } from "@/lib/i18n";

const DIVIDER_STORAGE_KEY = "plan-divider-width";

interface PlanNode {
  id: string;
  title: string;
  description: string;
  is_start: boolean;
  next_node_ids: string[];
  status: string;
  position_x?: number;
  position_y?: number;
  planning_prompt?: string;
  session_id?: string;
}

interface LearningPlan {
  id: string;
  title: string;
  root_topic: string;
  status: string;
  description?: string;
}

import { createBrowserClient } from "@supabase/ssr";

interface PlanChatProps {
  plan: LearningPlan;
  nodes: PlanNode[];
  onRefresh?: () => void;
  onNodesUpdate?: (nodes: PlanNode[]) => void;
  supabase?: ReturnType<typeof createBrowserClient>;
  planId?: string;
  isOwner?: boolean;
  currentUserId?: string | null;
}

const MODEL_STORAGE_KEY = "planner-model";

function nodesHaveChanged(oldNodes: PlanNode[], newNodes: PlanNode[]): Set<string> {
  const changedIds = new Set<string>();
  const oldMap = new Map(oldNodes.map(n => [n.id, n]));
  
  for (const newNode of newNodes) {
    const oldNode = oldMap.get(newNode.id);
    
    if (!oldNode) {
      changedIds.add(newNode.id);
      continue;
    }
    
    if (
      oldNode.title !== newNode.title ||
      oldNode.description !== newNode.description ||
      JSON.stringify(oldNode.next_node_ids) !== JSON.stringify(newNode.next_node_ids) ||
      oldNode.position_x !== newNode.position_x ||
      oldNode.position_y !== newNode.position_y ||
      oldNode.status !== newNode.status
    ) {
      changedIds.add(newNode.id);
    }
  }
  
  return changedIds;
}

export function PlanChat({ plan, nodes: initialNodes, onRefresh, onNodesUpdate, supabase, planId, isOwner = true, currentUserId }: PlanChatProps) {
  const router = useRouter();
  const { t } = useI18n();
  const [nodes, setNodes] = useState(initialNodes);
  const [activeTab, setActiveTab] = useState<"chat" | "sessions">("sessions");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [model, setModel] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(MODEL_STORAGE_KEY) || "x-ai/grok-4";
    }
    return "x-ai/grok-4";
  });
  const [highlightedNodes, setHighlightedNodes] = useState<Set<string>>(new Set());
  const [highlightOpacity, setHighlightOpacity] = useState(1);
  const [showRemixModal, setShowRemixModal] = useState(false);
  
  // Draggable divider state
  const [leftWidth, setLeftWidth] = useState<number>(55);
  const [isDragging, setIsDragging] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Load saved width from localStorage on mount and track desktop state
  useEffect(() => {
    setIsMounted(true);
    const saved = localStorage.getItem(DIVIDER_STORAGE_KEY);
    if (saved) {
      setLeftWidth(parseFloat(saved));
    }
    
    // Check if desktop and listen for resize
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 768);
    checkDesktop();
    window.addEventListener("resize", checkDesktop);
    return () => window.removeEventListener("resize", checkDesktop);
  }, []);

  useEffect(() => {
    const changedIds = nodesHaveChanged(nodes, initialNodes);
    
    if (changedIds.size > 0) {
      setHighlightedNodes(changedIds);
      setHighlightOpacity(1);
      
      setTimeout(() => setHighlightOpacity(0.7), 7000);
      setTimeout(() => setHighlightOpacity(0.4), 8500);
      setTimeout(() => {
        setHighlightedNodes(new Set());
        setHighlightOpacity(1);
      }, 10000);
    }
    
    setNodes(initialNodes);
  }, [initialNodes]);

  useEffect(() => {
    const handleOpenRemix = () => setShowRemixModal(true);
    window.addEventListener("openRemixModal", handleOpenRemix);
    return () => window.removeEventListener("openRemixModal", handleOpenRemix);
  }, []);

  // Draggable divider handlers
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newWidth = ((e.clientX - rect.left) / rect.width) * 100;
      // Clamp between 25% and 75%
      const clampedWidth = Math.max(25, Math.min(75, newWidth));
      setLeftWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      // Save to localStorage
      localStorage.setItem(DIVIDER_STORAGE_KEY, leftWidth.toString());
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, leftWidth]);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleModelChange = useCallback((newModel: string) => {
    setModel(newModel);
    localStorage.setItem(MODEL_STORAGE_KEY, newModel);
  }, []);

  const handleDeleteClick = useCallback((nodeId: string) => {
    setShowDeleteConfirm(nodeId);
  }, []);

  const handleForkClick = useCallback(async (nodeId: string) => {
    try {
      // If no specific nodeId (adding at end), use chat API to add a session
      if (!nodeId) {
        const response = await fetch("/api/learning-plan/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            planId: plan.id,
            userPrompt: "Add a new learning session at the end of the plan.",
            model,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to add session");
        }
      } else {
        const response = await fetch("/api/learning-plan/expand", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nodeId }),
        });

        if (!response.ok) {
          throw new Error("Failed to add session");
        }
      }

      router.refresh();
    } catch (err) {
      console.error("Failed to fork:", err);
    }
  }, [router, plan.id, model]);

  const handleDeleteConfirm = useCallback(async (nodeId: string) => {
    setShowDeleteConfirm(null);
    try {
      const response = await fetch("/api/learning-plan/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId, planId: plan.id }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete");
      }

      router.refresh();
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  }, [plan.id, router]);

  return (
    <div 
      ref={containerRef}
      className={`h-full flex flex-col md:flex-row gap-2 ${isDragging ? "select-none" : ""}`}
    >
      {/* Mobile Tab Switcher */}
      <div className="md:hidden flex border-b border-neutral-700 mb-1 shrink-0 -mt-1">
        <button
          onClick={() => setActiveTab("chat")}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors min-h-[40px] ${
            activeTab === "chat"
              ? "text-white border-b-2 border-blue-500"
              : "text-neutral-400 hover:text-white"
          }`}
        >
          {t('planChat.chat')}
        </button>
        <button
          onClick={() => setActiveTab("sessions")}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors min-h-[40px] ${
            activeTab === "sessions"
              ? "text-white border-b-2 border-blue-500"
              : "text-neutral-400 hover:text-white"
          }`}
        >
          {t('planChat.sessions')} ({nodes.length})
        </button>
      </div>

      {/* Chat Panel - Desktop: resizable, Mobile: full width when selected */}
      <div 
        className={`
          flex flex-col
          ${activeTab === "chat" ? "flex-1" : "hidden md:flex"}
          h-full min-h-0
          ${isDesktop ? "flex-none" : ""}
        `}
        style={isDesktop ? { width: `${leftWidth}%` } : undefined}
      >
        <div className="flex-1 bg-neutral-900 rounded-lg border border-neutral-800 overflow-hidden flex flex-col p-4">
          <ChatPanel
            planId={plan.id}
            model={model}
            onModelChange={handleModelChange}
            onRefresh={onRefresh}
            onNodesUpdate={onNodesUpdate}
            supabase={supabase}
            isOwner={isOwner}
            currentUserId={currentUserId}
          />
        </div>
      </div>

      {/* Draggable Divider - Desktop only */}
      <div 
        className="hidden md:flex items-center justify-center w-1.5 cursor-col-resize group"
        onMouseDown={handleDragStart}
      >
        <div className={`w-0.5 h-full rounded-full transition-colors ${isDragging ? "bg-blue-500" : "bg-neutral-700 group-hover:bg-neutral-500"}`} />
      </div>

      {/* Sessions Panel - Desktop: resizable, Mobile: full width when selected */}
      <div 
        className={`
          flex flex-col
          ${activeTab === "sessions" ? "flex-1" : "hidden md:flex"}
          h-full min-h-0
          ${isDesktop ? "flex-none" : ""}
        `}
        style={isDesktop ? { width: `${100 - leftWidth - 0.5}%` } : undefined}
      >
        <div className="flex-1 bg-neutral-900 rounded-lg border border-neutral-800 overflow-hidden">
          <SessionList
            nodes={nodes}
            onSelect={() => {}}
            onDelete={handleDeleteClick}
            onFork={handleForkClick}
            highlightedNodes={highlightedNodes}
            highlightOpacity={highlightOpacity}
            isOwner={isOwner}
            supabase={supabase}
          />
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <>
          <div 
            className="fixed inset-0 z-50 bg-black/60 md:hidden"
            onClick={() => setShowDeleteConfirm(null)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-50 md:absolute md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-sm bg-neutral-800 border-t md:border border-neutral-700 rounded-t-2xl md:rounded-2xl p-4">
            <h3 className="text-lg font-semibold text-white mb-2">{t('planChat.deleteSession')}</h3>
            <p className="text-sm text-neutral-400 mb-4">
              {t('planChat.deleteSessionConfirm')}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-3 bg-neutral-700 hover:bg-neutral-600 text-white text-sm font-medium rounded-xl transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => handleDeleteConfirm(showDeleteConfirm)}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-xl transition-colors"
              >
                {t('planChat.delete')}
              </button>
            </div>
          </div>
        </>
      )}



      {showRemixModal && (
        <RemixModal
          plan={{ id: plan.id, root_topic: plan.root_topic, author_username: "", remix_count: 0 }}
          onClose={() => setShowRemixModal(false)}
          onComplete={(newPlanId) => {
            setShowRemixModal(false);
            router.push(`/plan/${newPlanId}`);
          }}
        />
      )}
    </div>
  );
}