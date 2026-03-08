"use client";

import { useState, useMemo } from "react";
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
}

interface LearningPlan {
  id: string;
  title: string;
  root_topic: string;
  status: string;
}

interface NodePosition {
  x: number;
  y: number;
}

interface HexPlanViewProps {
  plan: LearningPlan;
  nodes: PlanNode[];
}

function NodeBubble({ 
  node, 
  position,
  onClick,
  onExpand,
  isExpanding,
  isSelected,
}: { 
  node: PlanNode; 
  position: NodePosition;
  onClick: () => void;
  onExpand: () => void;
  isExpanding: boolean;
  isSelected: boolean;
}) {
  const isStart = node.is_start;
  const isCompleted = node.status === "completed";
  const isInProgress = node.status === "in_progress";
  const canExpand = isCompleted && !isExpanding;

  const getColors = () => {
    if (isStart) {
      return {
        fill: isCompleted ? "#166534" : isInProgress ? "#2563eb" : "#059669",
        stroke: isCompleted ? "#22c55e" : isInProgress ? "#3b82f6" : "#34d399",
        text: "#d1fae5",
        label: "#34d399"
      };
    }
    return {
      fill: isCompleted ? "#166534" : isInProgress ? "#2563eb" : "#404040",
      stroke: isCompleted ? "#22c55e" : isInProgress ? "#3b82f6" : "#525252",
      text: "#e5e7eb",
      label: null
    };
  };

  const colors = getColors();
  const size = isSelected ? 55 : 40;

  return (
    <g 
      transform={`translate(${position.x}, ${position.y})`}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      {/* Selection ring */}
      {isSelected && (
        <circle
          r={size + 8}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="2"
          opacity="0.8"
        />
      )}
      
      {/* Main circle */}
      <circle
        r={size}
        fill={colors.fill}
        stroke={colors.stroke}
        strokeWidth={isSelected ? 3 : 2}
        style={{ 
          filter: isSelected 
            ? "drop-shadow(0 0 15px rgba(59, 130, 246, 0.6))" 
            : "drop-shadow(0 4px 8px rgba(0,0,0,0.4))",
          cursor: "pointer",
          transition: "all 0.2s ease"
        }}
        onClick={onClick}
      />
      
      {/* Text */}
      <text
        textAnchor="middle"
        dominantBaseline="middle"
        fill={colors.text}
        fontSize={isSelected ? "10" : "9"}
        fontWeight={isStart ? "bold" : "normal"}
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        {node.title.length > (isSelected ? 15 : 10) 
          ? node.title.slice(0, isSelected ? 15 : 10) + "..." 
          : node.title}
      </text>

      {/* START label */}
      {isStart && !isSelected && (
        <text
          textAnchor="middle"
          y={-size - 10}
          fontSize="7"
          fill={colors.label!}
          fontWeight="bold"
        >
          START
        </text>
      )}

      {/* Expand button */}
      {canExpand && (
        <g 
          transform={`translate(0, ${size + 14})`}
          onClick={(e) => { e.stopPropagation(); onExpand(); }}
          style={{ cursor: "pointer" }}
        >
          <circle r="10" fill="#3b82f6" />
          <text textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="12" fontWeight="bold">+</text>
        </g>
      )}
    </g>
  );
}

export function HexPlanView({ plan, nodes }: HexPlanViewProps) {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  
  const [isExpanding, setIsExpanding] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Calculate circular positions
  const positions = useMemo((): Map<string, NodePosition> => {
    if (nodes.length === 0) return new Map();

    const posMap = new Map<string, NodePosition>();
    const centerX = 400;
    const centerY = 350;
    const startRadius = 100;
    const mainRadius = 220;

    // Separate start nodes from others
    const startNodes = nodes.filter(n => n.is_start);
    const otherNodes = nodes.filter(n => !n.is_start);

    // Position start nodes in a small inner circle on the left
    if (startNodes.length > 0) {
      startNodes.forEach((node, i) => {
        const angle = Math.PI + (i - (startNodes.length - 1) / 2) * (Math.PI / (startNodes.length + 1));
        posMap.set(node.id, {
          x: centerX + Math.cos(angle) * startRadius,
          y: centerY + Math.sin(angle) * startRadius
        });
      });
    }

    // Position other nodes in a larger outer circle
    otherNodes.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / otherNodes.length - Math.PI / 2;
      posMap.set(node.id, {
        x: centerX + Math.cos(angle) * mainRadius,
        y: centerY + Math.sin(angle) * mainRadius
      });
    });

    return posMap;
  }, [nodes]);

  // Build edges
  const edges = useMemo(() => {
    return nodes.flatMap(node => 
      (node.next_node_ids || []).map(nextId => ({
        from: node.id,
        to: nextId
      }))
    );
  }, [nodes]);

  const selectedNode = selectedNodeId ? nodes.find(n => n.id === selectedNodeId) : null;

  const handleNodeClick = (nodeId: string) => {
    setSelectedNodeId(nodeId === selectedNodeId ? null : nodeId);
  };

  const handleStartSession = async (node: PlanNode) => {
    if (node.status === "locked") return;

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
      setError("Failed to start session");
    }
  };

  const handleExpand = async (node: PlanNode) => {
    setIsExpanding(node.id);
    setError("");

    try {
      const response = await fetch("/api/learning-plan/expand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId: node.id }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to expand");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to expand");
    } finally {
      setIsExpanding(null);
    }
  };

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-[400px] text-neutral-500">
        No nodes in this plan yet.
      </div>
    );
  }

  return (
    <div className="w-full h-screen relative">
      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-500/50 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}
      {isExpanding && (
        <div className="mb-4 p-3 bg-blue-900/30 border border-blue-500/50 rounded-lg text-blue-400 text-sm flex items-center gap-2">
          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Expanding learning path...
        </div>
      )}

      <svg
        viewBox="0 0 800 700"
        className="w-full h-screen rounded-xl"
        style={{ 
          background: "radial-gradient(circle at center, #1a1a1a 0%, #0a0a0a 100%)",
        }}
        onClick={() => setSelectedNodeId(null)}
      >
        {/* Edges */}
        {edges.map((edge, i) => {
          const from = positions.get(edge.from);
          const to = positions.get(edge.to);
          if (!from || !to) return null;

          const dx = to.x - from.x;
          const dy = to.y - from.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const offset = 45;

          return (
            <g key={i}>
              <line
                x1={from.x + (dx / dist) * offset}
                y1={from.y + (dy / dist) * offset}
                x2={to.x - (dx / dist) * (offset + 8)}
                y2={to.y - (dy / dist) * (offset + 8)}
                stroke="#525252"
                strokeWidth="1.5"
                opacity="0.6"
              />
              {/* Arrow head */}
              <polygon
                points={`${to.x - (dx / dist) * offset},${to.y - (dy / dist) * offset} ${to.x - (dx / dist) * (offset + 10) - (dy / dist) * 5},${to.y - (dy / dist) * (offset + 10) + (dx / dist) * 5} ${to.x - (dx / dist) * (offset + 10) + (dy / dist) * 5},${to.y - (dy / dist) * (offset + 10) - (dx / dist) * 5}`}
                fill="#525252"
                opacity="0.6"
              />
            </g>
          );
        })}
        
        {/* Nodes */}
        {nodes.map(node => {
          const pos = positions.get(node.id);
          if (!pos) return null;
          
          return (
            <NodeBubble
              key={node.id}
              node={node}
              position={pos}
              onClick={() => handleNodeClick(node.id)}
              onExpand={() => handleExpand(node)}
              isExpanding={isExpanding === node.id}
              isSelected={selectedNodeId === node.id}
            />
          );
        })}
      </svg>

      {/* Floating Legend */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 bg-neutral-900/80 backdrop-blur-sm border border-neutral-700 rounded-lg p-3 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-600 border border-emerald-500" />
          <span className="text-neutral-300">Start Node</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-neutral-700 border border-neutral-500" />
          <span className="text-neutral-300">Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-600 border border-blue-500" />
          <span className="text-neutral-300">In Progress</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-600 border border-green-500" />
          <span className="text-neutral-300">Completed</span>
        </div>
        <div className="mt-1 pt-2 border-t border-neutral-700 text-neutral-500">
          Click node for details
        </div>
      </div>

      {/* Detail panel - centered modal */}
      {selectedNode && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40 bg-black/60"
            onClick={() => setSelectedNodeId(null)}
          />
          {/* Modal */}
          <div 
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-neutral-900 border border-neutral-700 rounded-2xl p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  {selectedNode.is_start && (
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-900/50 px-2 py-0.5 rounded">START</span>
                  )}
                  <h3 className="text-xl font-semibold text-white">{selectedNode.title}</h3>
                </div>
                <p className="text-sm text-neutral-400 leading-relaxed">{selectedNode.description || "No description"}</p>
                <div className="mt-4 flex items-center gap-3">
                  <span className={`text-xs px-3 py-1.5 rounded-full ${
                    selectedNode.status === 'completed' 
                      ? 'bg-green-900/50 text-green-400'
                      : selectedNode.status === 'in_progress'
                      ? 'bg-blue-900/50 text-blue-400'
                      : 'bg-neutral-800 text-neutral-400'
                  }`}>
                    {selectedNode.status}
                  </span>
                  {(selectedNode.next_node_ids || []).length > 0 && (
                    <span className="text-xs text-neutral-500">
                      → {(selectedNode.next_node_ids || []).length} connection{(selectedNode.next_node_ids || []).length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
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
            <div className="mt-6 flex gap-3">
              {selectedNode.status !== 'locked' && (
                <button
                  onClick={() => handleStartSession(selectedNode)}
                  className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-colors"
                >
                  Start Session
                </button>
              )}
              {selectedNode.status === 'completed' && (
                <button
                  onClick={() => handleExpand(selectedNode)}
                  disabled={isExpanding === selectedNode.id}
                  className="flex-1 px-4 py-3 bg-neutral-700 hover:bg-neutral-600 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
                >
                  {isExpanding === selectedNode.id ? 'Expanding...' : 'Expand'}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
