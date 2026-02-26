"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  Handle,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

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
}

interface PlanFlowProps {
  plan: LearningPlan;
  nodes: PlanNode[];
}

const statusColors = {
  completed: { bg: "#166534", border: "#22c55e", text: "#d1fae5" },
  in_progress: { bg: "#1d4ed8", border: "#3b82f6", text: "#dbeafe" },
  available: { bg: "#404040", border: "#525252", text: "#e5e7eb" },
  locked: { bg: "#27272a", border: "#3f3f46", text: "#71717a" },
};

function PlanNodeComponent({ 
  data, 
  selected 
}: { 
  data: Record<string, unknown>; 
  selected?: boolean;
}) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const colors = statusColors[data.status as keyof typeof statusColors] || statusColors.available;
  const hasChildren = (data.nextNodeIds as string[] || []).length > 0;

  return (
    <div
      ref={nodeRef}
      className={`
        relative px-4 py-3 rounded-xl min-w-[140px] max-w-[200px]
        transition-all duration-200
        ${selected ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-neutral-900" : ""}
      `}
      style={{
        backgroundColor: colors.bg,
        border: `2px solid ${colors.border}`,
        boxShadow: selected ? "0 0 20px rgba(59, 130, 246, 0.4)" : "0 4px 12px rgba(0,0,0,0.3)",
      }}
    >
      <Handle 
        type="target" 
        position={Position.Left} 
        className="!w-3 !h-3 !bg-neutral-400 !border-2 !border-neutral-600"
      />
      
      {data.isStart as boolean && (
        <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-emerald-400">
          START
        </div>
      )}
      
      <div className="text-xs font-medium" style={{ color: colors.text }}>
        {String(data.label)}
      </div>
      
      <div className="flex gap-1 mt-2">
        {!!data.nodeId && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                (data.onDelete as (id: string) => void)?.(data.nodeId as string);
              }}
              className="p-1.5 rounded-lg bg-red-900/50 hover:bg-red-800/70 text-red-300 transition-colors"
              title="Delete node"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                (data.onFork as (id: string) => void)?.(data.nodeId as string);
              }}
              className="p-1.5 rounded-lg bg-blue-900/50 hover:bg-blue-800/70 text-blue-300 transition-colors"
              title="Fork/Expand"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </>
        )}
      </div>

      {hasChildren && (
        <div className="absolute -right-3 top-1/2 -translate-y-1/2 flex items-center">
          <div className="w-4 h-[2px] bg-neutral-500" />
          <div className="w-2 h-2 rounded-full bg-neutral-400 -ml-1" />
        </div>
      )}
      
      <Handle 
        type="source" 
        position={Position.Right} 
        className="!w-3 !h-3 !bg-neutral-400 !border-2 !border-neutral-600"
      />
    </div>
  );
}

function MobileNodeCard({ 
  node, 
  allNodes, 
  onSelect,
  onDelete,
  onFork 
}: { 
  node: PlanNode; 
  allNodes: PlanNode[];
  onSelect: () => void;
  onDelete: (id: string) => void;
  onFork: (id: string) => void;
}) {
  const colors = statusColors[node.status as keyof typeof statusColors] || statusColors.available;
  const nextNodes = allNodes.filter(n => node.next_node_ids?.includes(n.id));
  const prevNodes = allNodes.filter(n => n.next_node_ids?.includes(node.id));

  return (
    <div 
      onClick={onSelect}
      className="bg-neutral-800 border border-neutral-700 rounded-xl p-4 cursor-pointer active:scale-[0.98] transition-transform"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            {node.is_start && (
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-900/50 px-1.5 py-0.5 rounded">START</span>
            )}
            <span 
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ backgroundColor: `${colors.bg}50`, color: colors.text }}
            >
              {node.status}
            </span>
          </div>
          <h3 className="font-medium text-white truncate">{node.title}</h3>
          <p className="text-xs text-neutral-400 mt-1 line-clamp-2">
            {node.description || "No description"}
          </p>
        </div>
        
        <div className="flex flex-col gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onFork(node.id); }}
            className="p-2 rounded-lg bg-blue-900/50 hover:bg-blue-800/70 text-blue-400 transition-colors"
            title="Fork/Expand"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(node.id); }}
            className="p-2 rounded-lg bg-red-900/50 hover:bg-red-800/70 text-red-400 transition-colors"
            title="Delete"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
      
      <div className="mt-3 pt-3 border-t border-neutral-700 flex items-center justify-between text-xs text-neutral-500">
        {prevNodes.length > 0 && (
          <span>← {prevNodes.length} prev</span>
        )}
        <span className="flex-1" />
        {nextNodes.length > 0 && (
          <span>{nextNodes.length} next →</span>
        )}
      </div>
    </div>
  );
}

function forceDirectedLayout(
  nodes: PlanNode[],
  edges: { from: string; to: string }[]
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  
  if (nodes.length === 0) return positions;
  
  const width = 800;
  const height = 600;
  const padding = 100;
  
  nodes.forEach((node, i) => {
    if (node.position_x && node.position_y) {
      positions.set(node.id, { x: node.position_x, y: node.position_y });
      return;
    }
    const angle = (2 * Math.PI * i) / nodes.length - Math.PI / 2;
    const radius = Math.min(width, height) / 3;
    positions.set(node.id, {
      x: width / 2 + Math.cos(angle) * radius,
      y: height / 2 + Math.sin(angle) * radius,
    });
  });
  
  const iterations = 30;
  const repulsion = 4000;
  const attraction = 0.08;
  const damping = 0.85;
  
  const velocities = new Map<string, { x: number; y: number }>();
  nodes.forEach((n) => velocities.set(n.id, { x: 0, y: 0 }));
  
  for (let iter = 0; iter < iterations; iter++) {
    const forces = new Map<string, { x: number; y: number }>();
    nodes.forEach((n) => forces.set(n.id, { x: 0, y: 0 }));
    
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const posA = positions.get(nodes[i].id)!;
        const posB = positions.get(nodes[j].id)!;
        
        const dx = posB.x - posA.x;
        const dy = posB.y - posA.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        
        const force = repulsion / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        
        const fA = forces.get(nodes[i].id)!;
        const fB = forces.get(nodes[j].id)!;
        fA.x -= fx;
        fA.y -= fy;
        fB.x += fx;
        fB.y += fy;
      }
    }
    
    for (const edge of edges) {
      const posA = positions.get(edge.from);
      const posB = positions.get(edge.to);
      if (!posA || !posB) continue;
      
      const dx = posB.x - posA.x;
      const dy = posB.y - posA.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      const force = (dist - 120) * attraction;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      
      const fA = forces.get(edge.from)!;
      const fB = forces.get(edge.to)!;
      fA.x += fx;
      fA.y += fy;
      fB.x -= fx;
      fB.y -= fy;
    }
    
    for (const node of nodes) {
      const pos = positions.get(node.id)!;
      const vel = velocities.get(node.id)!;
      const force = forces.get(node.id)!;
      
      vel.x = (vel.x + force.x) * damping;
      vel.y = (vel.y + force.y) * damping;
      
      pos.x += vel.x;
      pos.y += vel.y;
      
      pos.x = Math.max(padding, Math.min(width - padding, pos.x));
      pos.y = Math.max(padding, Math.min(height - padding, pos.y));
    }
  }
  
  return positions;
}

function createNodeData(
  node: PlanNode,
  onDelete: (id: string) => void,
  onFork: (id: string) => void
) {
  return {
    label: node.title,
    status: node.status,
    isStart: node.is_start,
    nextNodeIds: node.next_node_ids,
    nodeId: node.id,
    onDelete,
    onFork,
  };
}

export function PlanFlow({ plan, nodes }: PlanFlowProps) {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const handleDeleteClick = useCallback((nodeId: string) => {
    setShowDeleteConfirm(nodeId);
  }, []);

  const handleForkClick = useCallback(async (nodeId: string) => {
    setIsLoading(nodeId);
    setError("");

    try {
      const response = await fetch("/api/learning-plan/expand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to fork");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fork");
    } finally {
      setIsLoading(null);
    }
  }, [router]);

  const handleDeleteConfirm = useCallback(async (nodeId: string) => {
    setIsLoading(nodeId);
    setError("");
    setShowDeleteConfirm(null);

    try {
      const response = await fetch("/api/learning-plan/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId, planId: plan.id }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to delete");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setIsLoading(null);
    }
  }, [router, plan.id]);

  const edges = useMemo(() => {
    return nodes.flatMap(node => 
      (node.next_node_ids || []).map(nextId => ({
        from: node.id,
        to: nextId
      }))
    );
  }, [nodes]);

  const positions = useMemo(() => forceDirectedLayout(nodes, edges), [nodes, edges]);

  const initialNodes: Node[] = useMemo(() => {
    return nodes.map(node => {
      const pos = positions.get(node.id) || { x: 100, y: 100 };
      return {
        id: node.id,
        type: "planNode",
        position: pos,
        data: createNodeData(node, handleDeleteClick, handleForkClick),
      };
    });
  }, [nodes, positions, handleDeleteClick, handleForkClick]);

  const initialEdges: Edge[] = useMemo(() => {
    return nodes.flatMap(node => 
      (node.next_node_ids || []).map((nextId, idx) => ({
        id: `${node.id}-${nextId}-${idx}`,
        source: node.id,
        target: nextId,
        type: "smoothstep",
        style: { stroke: "#525252", strokeWidth: 1.5 },
        animated: false,
      }))
    );
  }, [nodes]);

  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState(initialNodes);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setFlowNodes(initialNodes);
  }, [initialNodes, setFlowNodes]);

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

  const selectedNode = selectedNodeId ? nodes.find(n => n.id === selectedNodeId) : null;

  const nodeTypes = { planNode: PlanNodeComponent };

  return (
    <div className="w-full h-[600px] md:h-screen relative">
      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-red-900/90 border border-red-500/50 rounded-lg text-red-200 text-sm">
          {error}
        </div>
      )}
      
      {isLoading && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-blue-900/90 border border-blue-500/50 rounded-lg text-blue-200 text-sm flex items-center gap-2">
          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Processing...
        </div>
      )}

      {/* Desktop: React Flow */}
      <div className="hidden md:block w-full h-full rounded-xl overflow-hidden">
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.3}
          maxZoom={2}
          defaultEdgeOptions={{
            type: "smoothstep",
            style: { stroke: "#525252", strokeWidth: 1.5 },
          }}
        >
          <Background color="#333" gap={20} />
          <Controls className="!bg-neutral-800 !border-neutral-700" />
        </ReactFlow>

        {/* Legend */}
        <div className="absolute bottom-4 right-4 flex flex-col gap-2 bg-neutral-900/90 backdrop-blur-sm border border-neutral-700 rounded-lg p-3 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-emerald-700 border border-emerald-500" />
            <span className="text-neutral-300">Start Node</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-neutral-700 border border-neutral-500" />
            <span className="text-neutral-300">Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-blue-700 border border-blue-500" />
            <span className="text-neutral-300">In Progress</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-green-700 border border-green-500" />
            <span className="text-neutral-300">Completed</span>
          </div>
          <div className="mt-1 pt-2 border-t border-neutral-700 text-neutral-500">
            Drag to pan, scroll to zoom
          </div>
        </div>
      </div>

      {/* Mobile: List View */}
      <div className="md:hidden flex flex-col gap-3 p-4 pb-20 max-h-[calc(100vh-120px)] overflow-y-auto">
        {nodes.map(node => (
          <MobileNodeCard
            key={node.id}
            node={node}
            allNodes={nodes}
            onSelect={() => setSelectedNodeId(node.id)}
            onDelete={handleDeleteClick}
            onFork={handleForkClick}
          />
        ))}
        
        {nodes.length === 0 && (
          <div className="text-center py-8 text-neutral-500">
            No nodes in this plan yet.
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <>
          <div 
            className="fixed inset-0 z-50 bg-black/60 md:hidden"
            onClick={() => setShowDeleteConfirm(null)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-50 md:absolute md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-sm bg-neutral-800 border-t md:border border-neutral-700 rounded-t-2xl md:rounded-2xl p-4">
            <h3 className="text-lg font-semibold text-white mb-2">Delete Node?</h3>
            <p className="text-sm text-neutral-400 mb-4">
              This will remove the node and regenerate the learning path using AI. This cannot be undone.
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
                disabled={!!isLoading}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
              >
                {isLoading === showDeleteConfirm ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Detail Panel Modal */}
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
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              {selectedNode.status !== 'locked' && (
                <button
                  onClick={() => handleStartSession(selectedNode)}
                  className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-colors"
                >
                  Start Session
                </button>
              )}
              <button
                onClick={() => handleForkClick(selectedNode.id)}
                disabled={!!isLoading}
                className="flex-1 px-4 py-3 bg-neutral-700 hover:bg-neutral-600 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
              >
                Fork / Expand
              </button>
              <button
                onClick={() => handleDeleteClick(selectedNode.id)}
                className="flex-1 px-4 py-3 bg-red-900/50 hover:bg-red-800/70 text-red-400 text-sm font-medium rounded-xl transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}