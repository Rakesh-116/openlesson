"use client";

import { useState, useMemo } from "react";
import { type Probe, type SessionPlan, type RequestType } from "@/lib/storage";

interface MobileProbesTabProps {
  probes: Probe[];
  sessionPlan?: SessionPlan | null;
  onArchiveProbe?: (probeId: string) => Promise<void>;
  onToggleFocus?: (probeId: string, focused: boolean) => void;
  archivingProbeId?: string | null;
  isGeneratingProbe?: boolean;
}

// Type badge styling based on request type
function getTypeBadgeStyles(type: RequestType): { bg: string; text: string; border: string } {
  switch (type) {
    case "question":
      return { bg: "bg-blue-500/15", text: "text-blue-400", border: "border-blue-500/20" };
    case "task":
      return { bg: "bg-purple-500/15", text: "text-purple-400", border: "border-purple-500/20" };
    case "suggestion":
      return { bg: "bg-green-500/15", text: "text-green-400", border: "border-green-500/20" };
    case "checkpoint":
      return { bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/20" };
    case "feedback":
      return { bg: "bg-cyan-500/15", text: "text-cyan-400", border: "border-cyan-500/20" };
    default:
      return { bg: "bg-neutral-500/15", text: "text-neutral-400", border: "border-neutral-500/20" };
  }
}

export function MobileProbesTab({
  probes,
  sessionPlan,
  onArchiveProbe,
  onToggleFocus,
  archivingProbeId,
  isGeneratingProbe = false,
}: MobileProbesTabProps) {
  const [viewMode, setViewMode] = useState<"active" | "archived">("active");
  const [expandedProbeId, setExpandedProbeId] = useState<string | null>(null);

  const activeProbes = useMemo(() => probes.filter(p => !p.archived), [probes]);
  const archivedProbes = useMemo(() => probes.filter(p => p.archived), [probes]);

  const displayedProbes = viewMode === "active" ? activeProbes : archivedProbes;

  const formatTimestamp = (timestamp: number) => {
    const totalSeconds = Math.floor(timestamp / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const handleProbeClick = (probeId: string) => {
    setExpandedProbeId(expandedProbeId === probeId ? null : probeId);
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]">
      {/* Toggle tabs */}
      <div className="shrink-0 px-4 pt-3 pb-3">
        <div className="flex rounded-lg overflow-hidden border border-neutral-800 bg-neutral-900/50">
          <button
            onClick={() => setViewMode("active")}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
              viewMode === "active"
                ? "bg-cyan-500/20 text-cyan-400"
                : "text-neutral-500 hover:text-neutral-400"
            }`}
          >
            Active ({activeProbes.length})
          </button>
          <button
            onClick={() => setViewMode("archived")}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
              viewMode === "archived"
                ? "bg-cyan-500/20 text-cyan-400"
                : "text-neutral-500 hover:text-neutral-400"
            }`}
          >
            Archived ({archivedProbes.length})
          </button>
        </div>
      </div>

      {/* Probes list */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 space-y-3">
        {displayedProbes.length === 0 ? (
          isGeneratingProbe && viewMode === "active" ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-7 h-7 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
              <p className="text-neutral-500 text-sm">Generating probe...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-neutral-800 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-neutral-500 text-sm">
                {viewMode === "active" 
                  ? "No active probes yet" 
                  : "No archived probes"
                }
              </p>
              <p className="text-neutral-600 text-xs mt-1">
                {viewMode === "active" 
                  ? "Start your session to receive guiding questions" 
                  : "Completed probes will appear here"
                }
              </p>
            </div>
          )
        ) : (
          displayedProbes.map((probe) => {
            const planStep = probe.planStepId 
              ? sessionPlan?.steps?.find(s => s.id === probe.planStepId)
              : null;
            const stepContext = planStep 
              ? `Step ${planStep.order}: ${planStep.description}`
              : "General";
            
            const requestType = probe.requestType || "question";
            const typeBadge = getTypeBadgeStyles(requestType);
            const isArchiving = archivingProbeId === probe.id;
            const isExpanded = expandedProbeId === probe.id;

            return (
              <div
                key={probe.id}
                className={`
                  relative rounded-xl transition-all duration-300
                  ${probe.focused 
                    ? "bg-amber-500/10 border-2 border-amber-500/30" 
                    : "bg-neutral-900/70 border border-neutral-800"
                  }
                  ${isArchiving ? "opacity-50 scale-95" : ""}
                `}
              >
                {/* Main content - clickable */}
                <button
                  onClick={() => handleProbeClick(probe.id)}
                  className="w-full text-left p-4"
                >
                  {/* Header row */}
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-xs font-mono text-neutral-500">
                      {formatTimestamp(probe.timestamp)}
                    </span>
                    <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${typeBadge.bg} ${typeBadge.text} border ${typeBadge.border}`}>
                      {requestType}
                    </span>
                    {probe.focused && (
                      <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        Focused
                      </span>
                    )}
                  </div>

                  {/* Probe text */}
                  <p className={`text-sm text-neutral-200 leading-relaxed ${!isExpanded ? "line-clamp-2" : ""}`}>
                    {probe.text}
                  </p>

                  {/* Step context - shown when expanded */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-neutral-800">
                      <p className="text-[10px] text-neutral-500">
                        {stepContext}
                      </p>
                    </div>
                  )}
                </button>

                {/* Actions - shown when expanded and in active view */}
                {isExpanded && viewMode === "active" && (
                  <div className="px-4 pb-4 flex gap-2">
                    <button
                      onClick={() => onToggleFocus?.(probe.id, !probe.focused)}
                      className={`flex-1 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                        probe.focused
                          ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          : "bg-neutral-800 text-neutral-400 border border-neutral-700 hover:bg-neutral-700"
                      }`}
                    >
                      {probe.focused ? "Unfocus" : "Focus"}
                    </button>
                    <button
                      onClick={() => onArchiveProbe?.(probe.id)}
                      disabled={isArchiving}
                      className="flex-1 py-2.5 rounded-lg text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 disabled:opacity-50 transition-colors"
                    >
                      {isArchiving ? (
                        <span className="flex items-center justify-center gap-1.5">
                          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Archiving...
                        </span>
                      ) : (
                        <span className="flex items-center justify-center gap-1.5">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          Mark Complete
                        </span>
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
        {/* Probe generation spinner at bottom of list */}
        {isGeneratingProbe && viewMode === "active" && displayedProbes.length > 0 && (
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-neutral-800/50 border border-neutral-700/30 animate-pulse">
            <div className="w-4 h-4 border-2 border-neutral-600 border-t-cyan-500 rounded-full animate-spin shrink-0" />
            <span className="text-xs text-neutral-500">Generating probe...</span>
          </div>
        )}
      </div>
    </div>
  );
}
