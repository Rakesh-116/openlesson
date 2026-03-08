"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChatPanel } from "./ChatPanel";
import { SessionList } from "./SessionList";
import { RemixModal } from "./RemixModal";

interface PlanNode {
  id: string;
  title: string;
  description: string;
  is_start: boolean;
  next_node_ids: string[];
  status: string;
  position_x?: number;
  position_y?: number;
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

export function PlanChat({ plan, nodes: initialNodes, onRefresh, supabase, planId, isOwner = true, currentUserId }: PlanChatProps) {
  const router = useRouter();
  const [nodes, setNodes] = useState(initialNodes);
  const [activeTab, setActiveTab] = useState<"chat" | "sessions">("chat");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [model, setModel] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(MODEL_STORAGE_KEY) || "x-ai/grok-4";
    }
    return "x-ai/grok-4";
  });
  const [description, setDescription] = useState(plan.description || "");
  const [isLoadingDesc, setIsLoadingDesc] = useState(false);
  const [highlightedNodes, setHighlightedNodes] = useState<Set<string>>(new Set());
  const [highlightOpacity, setHighlightOpacity] = useState(1);
  const [showRemixModal, setShowRemixModal] = useState(false);

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

  useEffect(() => {
    if (!description && !isLoadingDesc) {
      setIsLoadingDesc(true);
      fetch("/api/learning-plan/describe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id, model }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.description) {
            setDescription(data.description);
          }
        })
        .catch(console.error)
        .finally(() => setIsLoadingDesc(false));
    }
  }, [plan.id, description, model, isLoadingDesc]);

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

  const selectedNode = selectedNodeId ? nodes.find(n => n.id === selectedNodeId) : null;

  return (
    <div className="h-[calc(100dvh-120px)] md:h-[calc(100vh-140px)] flex flex-col md:flex-row gap-2 sm:gap-3">
      {/* Mobile Tab Switcher */}
      <div className="md:hidden flex border-b border-neutral-700 mb-2 shrink-0 -mt-1">
        <button
          onClick={() => setActiveTab("chat")}
          className={`flex-1 px-4 py-3.5 text-sm font-medium transition-colors min-h-[44px] ${
            activeTab === "chat"
              ? "text-white border-b-2 border-blue-500"
              : "text-neutral-400 hover:text-white"
          }`}
        >
          Chat
        </button>
        <button
          onClick={() => setActiveTab("sessions")}
          className={`flex-1 px-4 py-3.5 text-sm font-medium transition-colors min-h-[44px] ${
            activeTab === "sessions"
              ? "text-white border-b-2 border-blue-500"
              : "text-neutral-400 hover:text-white"
          }`}
        >
          Sessions ({nodes.length})
        </button>
      </div>

      {/* Chat Panel - Desktop: 60%, Mobile: full when selected */}
      <div className={`
        flex flex-col
        ${activeTab === "chat" ? "flex-1" : "hidden md:flex"}
        md:w-[60%] lg:w-[65%]
        h-full min-h-0
      `}>
        <div className="flex-1 bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden flex flex-col p-4">
          <ChatPanel
            planId={plan.id}
            description={description}
            model={model}
            onModelChange={handleModelChange}
            onRefresh={onRefresh}
            supabase={supabase}
            isOwner={isOwner}
            currentUserId={currentUserId}
          />
        </div>
      </div>

      {/* Sessions Panel - Desktop: 40%, Mobile: full when selected */}
      <div className={`
        flex flex-col
        ${activeTab === "sessions" ? "flex-1" : "hidden md:flex"}
        md:w-[40%] lg:w-[35%]
        h-full min-h-0
      `}>
        <div className="flex-1 bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden p-4">
          <SessionList
            nodes={nodes}
            onSelect={setSelectedNodeId}
            onDelete={handleDeleteClick}
            onFork={handleForkClick}
            highlightedNodes={highlightedNodes}
            highlightOpacity={highlightOpacity}
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
            <h3 className="text-lg font-semibold text-white mb-2">Delete Session?</h3>
            <p className="text-sm text-neutral-400 mb-4">
              This will remove the session and update your learning plan. You can always add new sessions through chat.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-3 bg-neutral-700 hover:bg-neutral-600 text-white text-sm font-medium rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteConfirm(showDeleteConfirm)}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-xl transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </>
      )}

      {/* Node Detail Modal */}
      {selectedNode && !showDeleteConfirm && (
        <>
          <div 
            className="fixed inset-0 z-40 bg-black/60"
            onClick={() => setSelectedNodeId(null)}
          />
          <div 
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-neutral-900 border border-neutral-700 rounded-2xl p-6 shadow-2xl max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  {selectedNode.is_start && (
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-900/50 px-2 py-0.5 rounded">START</span>
                  )}
                  {selectedNode.status === "completed" && (
                    <span className="text-xs font-bold text-green-400 bg-green-900/50 px-2 py-0.5 rounded">✓ DONE</span>
                  )}
                  <h3 className="text-xl font-semibold text-white">{selectedNode.title}</h3>
                </div>
                <p className="text-sm text-neutral-400 leading-relaxed">{selectedNode.description || "No description"}</p>
                {(() => {
                  const prevNodes = nodes.filter(n => (n.next_node_ids || []).includes(selectedNode.id));
                  const nextNodes = (selectedNode.next_node_ids || []).map(id => nodes.find(n => n.id === id)).filter(Boolean);
                  
                  if (prevNodes.length === 0 && nextNodes.length === 0) return null;
                  
                  return (
                    <div className="mt-4 flex gap-6">
                      {prevNodes.length > 0 && (
                        <div>
                          <span className="text-xs text-neutral-500 block mb-2">← From:</span>
                          <div className="flex flex-wrap gap-2">
                            {prevNodes.map(prevNode => (
                              <button
                                key={prevNode.id}
                                onClick={() => setSelectedNodeId(prevNode.id)}
                                className="text-xs px-3 py-1.5 rounded-md bg-neutral-700 hover:bg-neutral-600 text-neutral-300 transition-colors text-left"
                              >
                                {prevNode.title}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {nextNodes.length > 0 && (
                        <div>
                          <span className="text-xs text-neutral-500 block mb-2">→ To:</span>
                          <div className="flex flex-wrap gap-2">
                            {nextNodes.map(nextNode => (
                              <button
                                key={nextNode!.id}
                                onClick={() => setSelectedNodeId(nextNode!.id)}
                                className="text-xs px-3 py-1.5 rounded-md bg-blue-900/50 hover:bg-blue-800/70 text-blue-300 transition-colors text-left"
                              >
                                {nextNode!.title}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
              <button
                onClick={() => setSelectedNodeId(null)}
                className="p-2 text-neutral-500 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {isOwner && selectedNode.status !== "completed" && selectedNode.status !== "locked" && (
              <button
                onClick={async () => {
                  const client = supabase || createBrowserClient(
                    process.env.NEXT_PUBLIC_SUPABASE_URL!,
                    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
                  );
                  try {
                    await client
                      .from("plan_nodes")
                      .update({ status: "in_progress" })
                      .eq("id", selectedNode.id);

                    const { createSession } = await import("@/lib/storage");
                    const session = await createSession(selectedNode.title);
                    
                    await client
                      .from("plan_nodes")
                      .update({ session_id: session.id })
                      .eq("id", selectedNode.id);

                    router.push(`/session?id=${session.id}`);
                  } catch (err) {
                    console.error("Failed to start session:", err);
                  }
                }}
                className="mt-6 w-full px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-colors"
              >
                Start Lesson
              </button>
            )}
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