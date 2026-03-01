"use client";

import { useEffect, useRef, useState } from "react";
import { type Probe, toggleProbeStarred, updateProbeRevealed } from "@/lib/storage";

interface ProbeNotificationsProps {
  sessionId: string;
  probes: Probe[];
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
}: ProbeNotificationsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    if (containerRef.current && probes.length > 0) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [probes.length]);

  const latestUnrevealedIndex = probes.findLastIndex((p) => !p.isRevealed);

  const handleReveal = async (probe: Probe) => {
    if (probe.isRevealed) return;
    
    await updateProbeRevealed(probe.id, true);
    
    window.dispatchEvent(new CustomEvent("probe-revealed", { detail: probe.id }));
  };

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

  return (
    <div className="flex-1 min-w-0 flex flex-col bg-[#0a0a0a] h-full">
      <div className="px-3 py-2 border-b border-neutral-800 shrink-0 md:hidden">
        <h2 className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
          Questions
        </h2>
      </div>
      
      <div ref={containerRef} className="flex-1 overflow-y-auto p-3 space-y-2">
        {!bannerDismissed && (
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 flex items-start gap-2">
            <svg className="w-5 h-5 text-green-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm text-green-300">Start the session, reveal the question and think out loud</p>
            </div>
            <button
              onClick={() => setBannerDismissed(true)}
              className="text-green-500 hover:text-green-400 shrink-0"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        {probes.length === 0 ? (
          <p className="text-xs text-neutral-600 text-center py-4">
            No questions yet
          </p>
        ) : (
          probes.map((probe, index) => {
            const isLatestUnrevealed = index === latestUnrevealedIndex;
            const shouldBlur = isLatestUnrevealed && !probe.isRevealed;

            return (
              <div
                key={probe.id}
                className="group relative p-3 rounded-lg bg-neutral-900/50 border border-neutral-800/50 hover:border-neutral-700 transition-colors"
              >
                <div className="flex items-start gap-2 mb-1.5">
                  <span className="text-[10px] font-mono text-neutral-500">
                    {formatTimestamp(probe.timestamp)}
                  </span>
                </div>
                
                {shouldBlur ? (
                  <button
                    onClick={() => handleReveal(probe)}
                    className="w-full"
                  >
                    <div className="relative">
                      <p className="text-sm text-neutral-400 blur-sm select-none">
                        {probe.text}
                      </p>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="px-2 py-1 bg-neutral-800 rounded text-[10px] text-neutral-400">
                          Tap to reveal
                        </span>
                      </div>
                    </div>
                  </button>
                ) : (
                  <p className="text-sm text-neutral-300 leading-snug">
                    {probe.text}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>
      
      {showControls && (
        <div className="shrink-0 border-t border-neutral-800 flex flex-col">
          {/* Objectives */}
          {objectives.length > 0 && (
            <div className="p-3 border-b border-neutral-800">
              <div className="text-[10px] uppercase tracking-wider font-medium text-neutral-500 mb-2">
                Goals
              </div>
              <div className="flex flex-col gap-2">
                {objectives.map((objective, index) => {
                  const status = objectiveStatuses[index] || "blue";
                  const colors = objectiveStatusColors[status];
                  
                  return (
                    <div
                      key={index}
                      className={`p-2.5 rounded-lg border ${colors.bg} ${colors.border}`}
                    >
                      <div className="flex items-start gap-2">
                        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${colors.dot}`} />
                        <span className="text-xs text-neutral-300">
                          {objective}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Session Controls */}
          <div className="p-3 space-y-2">
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
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <button onClick={onGetFeedback} disabled={feedbackLoading} className="flex-1 py-3 border border-cyan-500/50 hover:bg-cyan-500/10 text-cyan-400 font-medium rounded-xl flex items-center justify-center gap-2">
                    {feedbackLoading ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    )}
                    {feedbackLoading ? "Loading..." : "Next Question"}
                  </button>
                  <button onClick={onImStuck} disabled={stuckLoading} className="flex-1 py-3 border border-neutral-600 hover:border-neutral-400 text-neutral-400 font-medium rounded-xl flex items-center justify-center gap-2">
                    {stuckLoading ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    )}
                    {stuckLoading ? "Loading..." : "Need Help"}
                  </button>
                </div>
                <div className="flex gap-2">
                  <button onClick={onPause} className="flex-1 py-3 border border-neutral-600 hover:border-neutral-400 text-neutral-400 font-medium rounded-xl flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Pause
                  </button>
                  <button onClick={onStopRecording} className="flex-1 py-3 border border-neutral-600 hover:border-neutral-400 text-neutral-400 font-medium rounded-xl flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                    </svg>
                    End
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}