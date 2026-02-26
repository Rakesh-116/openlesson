"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

interface PlanNode {
  id: string;
  title: string;
  description: string;
  is_start: boolean;
  next_node_ids: string[];
  status: string;
}

interface SessionItemProps {
  node: PlanNode;
  index: number;
  onSelect: () => void;
  onDelete: (id: string) => void;
  onFork: (id: string) => void;
  highlighted?: boolean;
  highlightOpacity?: number;
}

const statusColors = {
  completed: { bg: "#166534", border: "#22c55e", text: "#d1fae5" },
  in_progress: { bg: "#1d4ed8", border: "#3b82f6", text: "#dbeafe" },
  available: { bg: "#404040", border: "#525252", text: "#e5e7eb" },
  locked: { bg: "#27272a", border: "#3f3f46", text: "#71717a" },
};

export function SessionItem({ node, index, onSelect, onDelete, onFork, highlighted, highlightOpacity = 1 }: SessionItemProps) {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  
  const [isStarting, setIsStarting] = useState(false);
  const isCompleted = node.status === "completed";
  const colors = statusColors[node.status as keyof typeof statusColors] || statusColors.available;

  const handleStart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isCompleted || isStarting) return;

    setIsStarting(true);
    try {
      await supabase
        .from("plan_nodes")
        .update({ status: "in_progress" })
        .eq("id", node.id);

      const { createSession } = await import("@/lib/storage");
      const session = await createSession(node.title);
      
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

  const handleFork = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFork(node.id);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(node.id);
  };

  return (
    <div 
      onClick={onSelect}
      className={`
        group relative p-5 rounded-xl cursor-pointer transition-all duration-200
        ${highlighted ? "ring-2" : ""}
        ${isCompleted 
          ? "bg-neutral-800/50 border border-neutral-700/50 hover:border-neutral-600" 
          : "bg-neutral-800 border border-neutral-700 hover:border-neutral-500 hover:bg-neutral-750"
        }
      `}
      style={highlighted ? { 
        borderColor: `rgba(6, 182, 212, ${highlightOpacity})`,
        boxShadow: `0 0 12px rgba(6, 182, 212, ${highlightOpacity * 0.5})`,
        animation: highlightOpacity > 0.5 ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none'
      } : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            {node.is_start && !isCompleted && (
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-900/50 px-1.5 py-0.5 rounded">START</span>
            )}
            {isCompleted && (
              <span className="text-[10px] font-bold text-green-400 bg-green-900/50 px-1.5 py-0.5 rounded">✓ DONE</span>
            )}
            {!isCompleted && (
              <span 
                className="text-[10px] px-2 py-0.5 rounded-full"
                style={{ backgroundColor: `${colors.bg}50`, color: colors.text }}
              >
                {node.status === "in_progress" ? "In Progress" : "Available"}
              </span>
            )}
          </div>
          
          <h3 className={`font-medium text-sm truncate ${isCompleted ? "text-neutral-400" : "text-white"}`}>
            {node.title}
          </h3>
          
          {!isCompleted && node.description && (
            <p className="text-xs text-neutral-500 mt-1 line-clamp-2">
              {node.description}
            </p>
          )}
        </div>

        {!isCompleted && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleStart}
              disabled={isStarting || node.status === "locked"}
              className="p-1.5 rounded-lg bg-blue-900/50 hover:bg-blue-800/70 text-blue-400 transition-colors disabled:opacity-50"
              title="Start session"
            >
              {isStarting ? (
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </button>
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center text-xs text-neutral-600">
        <span className={isCompleted ? "text-neutral-500" : ""}>
          #{index + 1}
        </span>
        {(node.next_node_ids || []).length > 0 && !isCompleted && (
          <span className="ml-2">→ {(node.next_node_ids || []).length} next</span>
        )}
      </div>
    </div>
  );
}