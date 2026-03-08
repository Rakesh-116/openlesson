"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { type Probe, type SessionPlan, type RequestType, toggleProbeStarred } from "@/lib/storage";

interface ProbeNotificationsProps {
  sessionId: string;
  probes: Probe[];
  sessionPlan?: SessionPlan | null;
  objectives?: string[];
  objectiveStatuses?: ("red" | "yellow" | "green" | "blue")[];
  isRecording?: boolean;
  isPaused?: boolean;
  stream?: MediaStream | null;
  onStartRecording?: () => void;
  onStopRecording?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onGetFeedback?: () => void;
  onImStuck?: () => void;
  feedbackLoading?: boolean;
  stuckLoading?: boolean;
  showControls?: boolean;
  elapsedSeconds?: number;
  cycleProgress?: number;
  isAnalyzing?: boolean;
  feedbackItems?: Array<{ id: string; text: string; timestamp: number }>;
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

const objectiveStatusColors: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  blue: { bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-400", dot: "bg-blue-500" },
  green: { bg: "bg-green-500/10", border: "border-green-500/30", text: "text-green-400", dot: "bg-green-500" },
  yellow: { bg: "bg-yellow-500/10", border: "border-yellow-500/30", text: "text-yellow-400", dot: "bg-yellow-500" },
  red: { bg: "bg-red-500/10", border: "border-red-500/30", text: "text-red-400", dot: "bg-red-500" },
};

export function ProbeNotifications({ 
  sessionId, 
  probes,
  sessionPlan,
  objectives = [],
  objectiveStatuses = [],
  isRecording,
  isPaused,
  stream,
  onStartRecording,
  onStopRecording,
  onPause,
  onResume,
  onGetFeedback,
  onImStuck,
  feedbackLoading,
  stuckLoading,
  showControls = true,
  elapsedSeconds = 0,
  cycleProgress = 0,
  isAnalyzing = false,
  feedbackItems = [],
}: ProbeNotificationsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hidePastProbes, setHidePastProbes] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (containerRef.current && probes.length > 0) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [probes.length]);

  const filteredProbes = useMemo(() => {
    let result = probes;
    if (hidePastProbes && probes.length > 0) {
      // Show only the latest probe when hiding past
      result = probes.slice(-1);
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p => p.text.toLowerCase().includes(query));
    }
    return result;
  }, [probes, hidePastProbes, searchQuery]);

  const filteredFeedback = useMemo(() => {
    let result = feedbackItems.filter(f => f.text && f.text !== "null");
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(f => f.text.toLowerCase().includes(query));
    }
    return result;
  }, [feedbackItems, searchQuery]);



  const handleToggleStar = async (probeId: string, starred: boolean) => {
    await toggleProbeStarred(probeId, starred);
    window.dispatchEvent(new CustomEvent("probe-star-toggled", { detail: { probeId, starred } }));
  };

  const formatTimestamp = (timestamp: number) => {
    const totalSeconds = Math.floor(timestamp / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex-1 min-w-0 flex flex-col bg-[#0a0a0a] h-full">
      <div className="px-3 py-2 border-b border-neutral-800 shrink-0 space-y-2">
        <div>
          <h2 className="text-xs font-medium text-white uppercase tracking-wider mb-1">
            Student Monitoring
          </h2>
          <p className="text-[10px] text-neutral-500">
            Questions and feedback from an AI that monitors your thinking and actions in the ILE
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={hidePastProbes}
              onChange={(e) => setHidePastProbes(e.target.checked)}
              className="w-3 h-3 rounded border-neutral-600 bg-neutral-800 text-cyan-500 focus:ring-0 focus:ring-offset-0"
            />
            <span className="text-[10px] text-neutral-400">Hide past</span>
          </label>
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Filter..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-6 px-2 pr-6 text-[10px] bg-neutral-800 border border-neutral-700 rounded text-neutral-300 placeholder-neutral-500 focus:outline-none focus:border-neutral-600"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-1 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-400"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {isRecording && (
        <div className="px-3 py-2 border-b border-neutral-800 flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            {isAnalyzing && (
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            )}
            <span className="text-[11px] text-blue-400">{isAnalyzing ? "Observing" : "Monitoring"}</span>
          </div>
          <div className="text-xs font-mono text-neutral-300 tabular-nums">
            {formatTime(elapsedSeconds)}
          </div>
          <div className="flex-1 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-cyan-500 transition-all duration-1000 ease-linear rounded-full"
              style={{ width: `${(cycleProgress / 60) * 100}%` }}
            />
          </div>
        </div>
      )}
      
      <div ref={containerRef} className="flex-1 overflow-y-auto p-3 space-y-2">
        {filteredProbes.length === 0 && filteredFeedback.length === 0 ? (
          <p className="text-xs text-neutral-600 text-center py-4">
            {searchQuery ? "No matching questions or feedback" : "No questions yet"}
          </p>
        ) : (
          filteredProbes.map((probe) => {
            // Get the plan step for this probe
            const planStep = probe.planStepId 
              ? sessionPlan?.steps?.find(s => s.id === probe.planStepId)
              : null;
            const stepContext = planStep 
              ? `Step ${planStep.order}: ${planStep.description}`
              : "General";
            
            // Get type badge styling
            const requestType = probe.requestType || "question";
            const typeBadge = getTypeBadgeStyles(requestType);

            return (
              <div
                key={probe.id}
                className="group relative p-3 rounded-lg bg-neutral-900/50 border border-neutral-800/50 hover:border-neutral-700 transition-colors"
              >
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="text-[10px] font-mono text-neutral-500">
                    {formatTimestamp(probe.timestamp)}
                  </span>
                  <span className={`px-1.5 py-0.5 text-[9px] font-medium rounded ${typeBadge.bg} ${typeBadge.text} border ${typeBadge.border}`}>
                    {requestType}
                  </span>
                  <span className="text-[9px] text-neutral-600 truncate max-w-[150px]" title={stepContext}>
                    {stepContext}
                  </span>
                </div>
                
                <p className="text-sm text-neutral-300 leading-snug">
                  {probe.text}
                </p>
              </div>
            );
          })
        )}
        {filteredFeedback.length > 0 && (
          <>
            <div className="text-[10px] font-medium text-purple-400 uppercase tracking-wider pt-2">
              AI Feedback
            </div>
            {filteredFeedback.map((feedback) => (
              <div
                key={feedback.id}
                className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/30"
              >
                <div className="flex items-start gap-2 mb-1.5">
                  <span className="text-[10px] font-mono text-purple-500/70">
                    {formatTimestamp(feedback.timestamp)}
                  </span>
                </div>
                <p className="text-sm text-purple-200 leading-snug">
                  {feedback.text}
                </p>
              </div>
            ))}
          </>
        )}
      </div>
      
      {showControls && (
        <div className="shrink-0 border-t border-neutral-800 flex flex-col">
          <div className="p-3">
            {!isRecording && !isPaused ? (
              <button onClick={onStartRecording} className="w-full py-3 border border-neutral-600 hover:border-neutral-400 text-white font-medium rounded-xl flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                Start Session
              </button>
            ) : isPaused ? (
              <div className="flex flex-col gap-2">
                <button onClick={onResume} className="w-full py-3 border border-green-500/50 hover:bg-green-500/10 text-green-400 font-medium rounded-xl flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Resume
                </button>
                <button onClick={onStopRecording} className="w-full py-3 border border-neutral-600 hover:border-neutral-400 text-neutral-400 font-medium rounded-xl flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                  </svg>
                  End Session
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button onClick={onImStuck} disabled={stuckLoading} className="flex-1 py-2.5 border border-cyan-500/50 hover:bg-cyan-500/10 text-cyan-400 font-medium rounded-xl flex items-center justify-center gap-1.5 text-xs">
                  {stuckLoading ? (
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  )}
                  {stuckLoading ? "Loading..." : "Need Help"}
                </button>
                <button onClick={onPause} className="flex-1 py-2.5 border border-neutral-600 hover:border-neutral-400 text-neutral-400 font-medium rounded-xl flex items-center justify-center gap-1.5 text-xs">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Pause
                </button>
                <button onClick={onStopRecording} className="flex-1 py-2.5 border border-neutral-600 hover:border-neutral-400 text-neutral-400 font-medium rounded-xl flex items-center justify-center gap-1.5 text-xs">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                  </svg>
                  End
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
