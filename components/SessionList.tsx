"use client";

import { useState, useMemo } from "react";
import { SessionItem } from "./SessionItem";

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
}

interface SessionListProps {
  nodes: PlanNode[];
  onSelect: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onFork: (nodeId: string) => void;
  highlightedNodes?: Set<string>;
  highlightOpacity?: number;
}

function getOrderedSessions(nodes: PlanNode[]): PlanNode[] {
  if (nodes.length === 0) return [];
  
  const visited = new Set<string>();
  const ordered: PlanNode[] = [];
  
  const startNodes = nodes.filter(n => n.is_start);
  const queue = [...startNodes];
  
  while (queue.length > 0) {
    const node = queue.shift()!;
    if (visited.has(node.id)) continue;
    
    visited.add(node.id);
    ordered.push(node);
    
    const children = nodes.filter(n => 
      node.next_node_ids?.includes(n.id)
    );
    
    for (const child of children) {
      if (!visited.has(child.id)) {
        queue.push(child);
      }
    }
  }
  
  for (const node of nodes) {
    if (!visited.has(node.id)) {
      ordered.push(node);
    }
  }
  
  return ordered;
}

export function SessionList({ nodes, onSelect, onDelete, onFork, highlightedNodes, highlightOpacity = 1 }: SessionListProps) {
  const [showCompleted, setShowCompleted] = useState(false);
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());

  const { activeSessions, completedSessions } = useMemo(() => {
    const ordered = getOrderedSessions(nodes);
    const active = ordered.filter(n => n.status !== "completed");
    const completed = ordered.filter(n => n.status === "completed");
    return { activeSessions: active, completedSessions: completed };
  }, [nodes]);

  const toggleCollapse = (nodeId: string) => {
    setCollapsedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const visibleActive = activeSessions.filter(n => !collapsedNodes.has(n.id));
  const visibleCompleted = showCompleted ? completedSessions : [];

  return (
    <div className="flex flex-col h-full p-3 sm:p-4">
      <div className="flex items-center justify-between mb-4 sm:mb-6 px-1">
        <h2 className="text-lg font-semibold text-white">Sessions</h2>
        <span className="text-xs text-neutral-500">
          {activeSessions.length} active, {completedSessions.length} done
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 sm:space-y-3 pr-2">
        {visibleActive.map((node, index) => (
          <div key={node.id} className="relative">
            <SessionItem
              node={node}
              index={index}
              onSelect={() => onSelect(node.id)}
              onDelete={onDelete}
              onFork={onFork}
              highlighted={highlightedNodes?.has(node.id)}
              highlightOpacity={highlightOpacity}
            />
            {index < activeSessions.length - 1 && (
              <div className="absolute left-1/2 -bottom-3 w-0.5 h-3 bg-neutral-700 -translate-x-1/2 z-0" />
            )}
          </div>
        ))}

        {visibleActive.length === 0 && completedSessions.length === 0 && (
          <div className="text-center py-8 text-neutral-500 text-sm">
            No sessions yet. Start a conversation to build your plan!
          </div>
        )}

        {completedSessions.length > 0 && (
          <div className="mt-4 pt-4 border-t border-neutral-800">
            <button
              onClick={() => setShowCompleted(!showCompleted)}
              className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors w-full px-1 py-2"
            >
              <svg 
                className={`w-4 h-4 transition-transform ${showCompleted ? "rotate-90" : ""}`} 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Completed ({completedSessions.length})
            </button>

            {showCompleted && (
              <div className="space-y-2 mt-2 opacity-60">
                {completedSessions.map((node, index) => (
                  <SessionItem
                    key={node.id}
                    node={node}
                    index={activeSessions.length + index}
                    onSelect={() => onSelect(node.id)}
                    onDelete={() => {}}
                    onFork={() => {}}
                    highlighted={highlightedNodes?.has(node.id)}
                    highlightOpacity={highlightOpacity}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>


    </div>
  );
}