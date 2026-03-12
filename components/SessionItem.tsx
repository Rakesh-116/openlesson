"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

interface PlanNode {
  id: string;
  title: string;
  description: string;
  is_start: boolean;
  next_node_ids: string[];
  status: string;
  planning_prompt?: string;
  session_id?: string;
}

interface SessionItemProps {
  node: PlanNode;
  index: number;
  onSelect: () => void;
  onDelete: (id: string) => void;
  onFork: (id: string) => void;
  highlighted?: boolean;
  highlightOpacity?: number;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  allNodes?: PlanNode[];
  isOwner?: boolean;
  supabase?: ReturnType<typeof createBrowserClient>;
  onNavigateToNode?: (nodeId: string) => void;
}

const statusConfig = {
  completed: { label: "Done", bg: "bg-green-900/50", text: "text-green-400", icon: "✓" },
  in_progress: { label: "In Progress", bg: "bg-blue-900/50", text: "text-blue-400", icon: null },
  available: { label: "Available", bg: "bg-neutral-700/50", text: "text-neutral-300", icon: null },
  locked: { label: "Locked", bg: "bg-neutral-800/50", text: "text-neutral-500", icon: null },
};

export function SessionItem({ 
  node, 
  index, 
  onSelect, 
  onDelete, 
  onFork, 
  highlighted, 
  highlightOpacity = 1,
  isExpanded = false,
  onToggleExpand,
  allNodes = [],
  isOwner = true,
  supabase: propSupabase,
  onNavigateToNode
}: SessionItemProps) {
  const router = useRouter();
  const supabase = propSupabase || createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  
  const [isStarting, setIsStarting] = useState(false);
  const [editedPlanningPrompt, setEditedPlanningPrompt] = useState(node.planning_prompt || "");
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [promptSaved, setPromptSaved] = useState(false);
  
  const isCompleted = node.status === "completed";
  const isLocked = node.status === "locked";
  const config = statusConfig[node.status as keyof typeof statusConfig] || statusConfig.available;

  // Get previous and next nodes for sequence info
  const prevNodes = allNodes.filter(n => (n.next_node_ids || []).includes(node.id));
  const nextNodes = (node.next_node_ids || []).map(id => allNodes.find(n => n.id === id)).filter(Boolean) as PlanNode[];

  const handleStart = async () => {
    if (isStarting || isLocked) return;

    setIsStarting(true);
    try {
      // Save planning prompt if changed before starting
      if (editedPlanningPrompt !== (node.planning_prompt || "")) {
        await supabase
          .from("plan_nodes")
          .update({ planning_prompt: editedPlanningPrompt || null })
          .eq("id", node.id);
      }

      await supabase
        .from("plan_nodes")
        .update({ status: "in_progress" })
        .eq("id", node.id);

      const { createSession } = await import("@/lib/storage");
      const session = await createSession(node.title, undefined, editedPlanningPrompt || undefined);
      
      await supabase
        .from("plan_nodes")
        .update({ session_id: session.id })
        .eq("id", node.id);

      router.push(`/session?id=${session.id}`);
    } catch (err) {
      console.error("Failed to start session:", err);
      setIsStarting(false);
    }
  };

  const savePlanningPrompt = useCallback(async () => {
    if (editedPlanningPrompt === (node.planning_prompt || "")) return;
    
    setSavingPrompt(true);
    setPromptSaved(false);
    try {
      await supabase
        .from("plan_nodes")
        .update({ planning_prompt: editedPlanningPrompt || null })
        .eq("id", node.id);
      
      setPromptSaved(true);
      setTimeout(() => setPromptSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save planning prompt:", err);
    } finally {
      setSavingPrompt(false);
    }
  }, [editedPlanningPrompt, node.planning_prompt, node.id, supabase]);

  const handleClick = () => {
    if (onToggleExpand) {
      onToggleExpand();
    } else {
      onSelect();
    }
  };

  return (
    <div 
      id={`session-item-${node.id}`}
      className={`
        rounded-lg transition-all duration-200
        ${highlighted ? "ring-1" : ""}
        ${isExpanded ? "bg-neutral-800/70" : "hover:bg-neutral-800/50"}
      `}
      style={highlighted ? { 
        borderColor: `rgba(6, 182, 212, ${highlightOpacity})`,
        boxShadow: `0 0 8px rgba(6, 182, 212, ${highlightOpacity * 0.4})`
      } : undefined}
    >
      {/* Collapsed View */}
      <div 
        onClick={handleClick}
        className="px-3 py-2 cursor-pointer"
      >
        <div className="flex items-center gap-2">
          {/* Status Badge */}
          <span className={`text-xs px-2 py-0.5 rounded font-medium whitespace-nowrap ${config.bg} ${config.text}`}>
            {config.icon && <span className="mr-0.5">{config.icon}</span>}
            {config.label}
          </span>
          
          {/* Title */}
          <span className={`text-sm flex-1 truncate font-medium ${isCompleted ? "text-neutral-400" : "text-white"}`}>
            {node.title}
          </span>
          
          {/* Index & Expand Icon */}
          <span className="text-xs text-neutral-500">#{index + 1}</span>
          <svg 
            className={`w-4 h-4 text-neutral-500 transition-transform flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`} 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        
        {/* Description preview & sequence info - only when collapsed */}
        {!isExpanded && (
          <div className="mt-1.5 pl-[calc(0.5rem+4ch)]">
            {node.description && (
              <p className="text-xs text-neutral-500 line-clamp-1">
                {node.description}
              </p>
            )}
            {(nextNodes.length > 0) && (
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <span className="text-[10px] text-neutral-600 uppercase tracking-wide">Next:</span>
                {nextNodes.map((n) => (
                  <button
                    key={n.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigateToNode?.(n.id);
                    }}
                    className="text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-blue-400 transition-colors"
                  >
                    {n.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Expanded View */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-neutral-700/50 mt-1 pt-3">
          {/* Description */}
          {node.description && (
            <p className="text-sm text-neutral-400 leading-relaxed">
              {node.description}
            </p>
          )}
          
          {/* Sequence Info */}
          {(prevNodes.length > 0 || nextNodes.length > 0) && (
            <div className="flex flex-col gap-2 p-2.5 bg-neutral-900/50 rounded-lg border border-neutral-800">
              {prevNodes.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] text-neutral-500 uppercase tracking-wide w-12 flex-shrink-0">From</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {prevNodes.map((n) => (
                      <button
                        key={n.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigateToNode?.(n.id);
                        }}
                        className="text-xs px-2.5 py-1 rounded-md bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-blue-400 transition-colors border border-neutral-700"
                      >
                        ← {n.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {nextNodes.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] text-neutral-500 uppercase tracking-wide w-12 flex-shrink-0">Next</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {nextNodes.map((n) => (
                      <button
                        key={n.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigateToNode?.(n.id);
                        }}
                        className="text-xs px-2.5 py-1 rounded-md bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-blue-400 transition-colors border border-neutral-700"
                      >
                        {n.title} →
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Planning Prompt */}
          {isOwner && (
            <div className="pt-1">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-neutral-400">
                  Planning Prompt
                </label>
                <span className="text-xs text-neutral-600">
                  {savingPrompt ? "Saving..." : promptSaved ? "Saved" : ""}
                </span>
              </div>
              <textarea
                value={editedPlanningPrompt}
                onChange={(e) => setEditedPlanningPrompt(e.target.value)}
                onBlur={savePlanningPrompt}
                placeholder="Custom instructions for this session..."
                className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-neutral-600 resize-none"
                rows={2}
              />
            </div>
          )}

          {/* Actions */}
          {!isLocked && isOwner && (
            <div className="flex gap-2 pt-1">
              {isCompleted ? (
                <button
                  onClick={handleStart}
                  disabled={isStarting}
                  className="flex-1 px-4 py-2 bg-neutral-700 hover:bg-neutral-600 disabled:bg-neutral-800 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {isStarting ? "Starting..." : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Run Again
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleStart}
                  disabled={isStarting}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {isStarting ? "Starting..." : "Start Lesson"}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
