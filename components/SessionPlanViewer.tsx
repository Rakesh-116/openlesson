"use client";

import { useState } from "react";
import { type SessionPlan } from "@/lib/storage";

interface SessionPlanViewerProps {
  plan: SessionPlan | null;
  loading?: boolean;
  error?: string | null;
  onRecalculate?: () => Promise<void>;
}

export function SessionPlanViewer({ plan, loading, error, onRecalculate }: SessionPlanViewerProps) {
  const [recalculating, setRecalculating] = useState(false);

  const handleRecalculate = async () => {
    if (!onRecalculate || recalculating) return;
    setRecalculating(true);
    try {
      await onRecalculate();
    } finally {
      setRecalculating(false);
    }
  };

  const isCorrupted = plan && (!plan.steps || plan.steps.length === 0);
  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6">
        <div className="w-8 h-8 border-2 border-neutral-700 border-t-cyan-500 rounded-full animate-spin mb-4" />
        <p className="text-sm text-neutral-500">Creating your session plan...</p>
      </div>
    );
  }

  if (error || isCorrupted) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-900/20 flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <p className="text-sm text-red-400">
          {isCorrupted ? "Plan is corrupted" : "Plan creation failed"}
        </p>
        <p className="text-xs text-neutral-600 mt-1">
          {isCorrupted ? "The plan has no steps" : error}
        </p>
        {onRecalculate && (
          <button
            onClick={handleRecalculate}
            disabled={recalculating}
            className="mt-4 px-4 py-2 text-sm font-medium rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30 hover:border-cyan-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            {recalculating ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Recalculating...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Recalculate Plan
              </>
            )}
          </button>
        )}
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-neutral-800 flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-neutral-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
        </div>
        <p className="text-sm text-neutral-500">No plan created yet</p>
        <p className="text-xs text-neutral-600 mt-1">
          Plan will be created shortly...
        </p>
      </div>
    );
  }

  const completedSteps = plan.steps.filter((s) => s.status === "completed").length;
  const totalSteps = plan.steps.length;
  const progressPercent = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  const typeIcons: Record<string, React.ReactNode> = {
    question: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    task: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    suggestion: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    checkpoint: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };

  const typeLabels: Record<string, string> = {
    question: "Question",
    task: "Task",
    suggestion: "Suggestion",
    checkpoint: "Checkpoint",
  };

  const statusColors: Record<string, string> = {
    pending: "bg-neutral-600",
    in_progress: "bg-cyan-500 animate-pulse",
    completed: "bg-green-500",
    skipped: "bg-neutral-700",
  };

  return (
    <div className="h-full flex flex-col p-4 overflow-hidden">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-white mb-1">Session Plan</h2>
        <p className="text-xs text-neutral-500">
          Your learning roadmap for this session
        </p>
      </div>

      {/* Goal */}
      <div className="mb-6 p-4 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20">
        <div className="flex items-center gap-2 mb-2">
          <svg
            className="w-4 h-4 text-cyan-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
          <span className="text-xs font-medium text-cyan-400 uppercase tracking-wider">
            Goal
          </span>
        </div>
        <p className="text-sm text-white leading-relaxed">{plan.goal}</p>
      </div>

      {/* Strategy (collapsible) */}
      {plan.strategy && (
        <div className="mb-6">
          <details className="group">
            <summary className="flex items-center gap-2 cursor-pointer text-xs text-neutral-500 hover:text-neutral-400 transition-colors">
              <svg
                className="w-3 h-3 transition-transform group-open:rotate-90"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Strategy
            </summary>
            <p className="text-xs text-neutral-400 mt-2 pl-5 leading-relaxed">
              {plan.strategy}
            </p>
          </details>
        </div>
      )}

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-neutral-500">Progress</span>
          <span className="text-xs font-medium text-white">
            {completedSteps}/{totalSteps} steps
          </span>
        </div>
        <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Steps list */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {plan.steps.map((step, idx) => {
          const isActive = step.status === "in_progress";
          const isCompleted = step.status === "completed";
          const isSkipped = step.status === "skipped";

          return (
            <div
              key={step.id}
              className={`relative p-3 rounded-lg border transition-all ${
                isActive
                  ? "bg-cyan-500/10 border-cyan-500/30"
                  : isCompleted
                  ? "bg-green-500/5 border-green-500/20"
                  : isSkipped
                  ? "bg-neutral-800/30 border-neutral-700/30 opacity-50"
                  : "bg-neutral-900/50 border-neutral-800 hover:border-neutral-700"
              }`}
            >
              {/* Step number indicator */}
              <div className="absolute -left-px top-1/2 -translate-y-1/2 -translate-x-1/2 w-px h-full" />
              
              <div className="flex items-start gap-3">
                {/* Status indicator */}
                <div className="shrink-0 mt-1">
                  <div className={`w-2 h-2 rounded-full ${statusColors[step.status]}`} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`${isCompleted ? "text-green-400" : isActive ? "text-cyan-400" : "text-neutral-500"}`}>
                      {typeIcons[step.type] || typeIcons.question}
                    </span>
                    <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">
                      {typeLabels[step.type] || "Question"}
                    </span>
                    <span className="text-[10px] text-neutral-600">
                      #{idx + 1}
                    </span>
                  </div>
                  <p className={`text-sm leading-relaxed ${
                    isSkipped ? "line-through text-neutral-600" : 
                    isCompleted ? "text-neutral-400" : "text-white"
                  }`}>
                    {step.description}
                  </p>
                </div>

                {/* Status badge */}
                {isActive && (
                  <span className="shrink-0 px-2 py-0.5 text-[10px] font-medium bg-cyan-500/20 text-cyan-400 rounded-full">
                    Current
                  </span>
                )}
                {isCompleted && (
                  <svg className="shrink-0 w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-neutral-800">
        <p className="text-[10px] text-neutral-600 text-center mb-2">
          Plan updates automatically based on your progress
        </p>
        {onRecalculate && (
          <button
            onClick={handleRecalculate}
            disabled={recalculating}
            className="w-full px-3 py-1.5 text-[10px] font-medium rounded-lg bg-neutral-800/50 text-neutral-400 border border-neutral-700/50 hover:bg-neutral-800 hover:text-neutral-300 hover:border-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5"
          >
            {recalculating ? (
              <>
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Recalculating...
              </>
            ) : (
              <>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Regenerate Plan
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
