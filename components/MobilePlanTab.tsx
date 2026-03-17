"use client";

import { useState } from "react";
import { type SessionPlan } from "@/lib/storage";
import { useI18n } from "@/lib/i18n";

interface MobilePlanTabProps {
  plan: SessionPlan | null;
  loading?: boolean;
  error?: string | null;
  onAdvanceStep?: () => Promise<void>;
  onRollbackToStep?: (stepIndex: number) => Promise<void>;
}

export function MobilePlanTab({
  plan,
  loading,
  error,
  onAdvanceStep,
  onRollbackToStep,
}: MobilePlanTabProps) {
  const { t } = useI18n();
  const [advancing, setAdvancing] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);
  const [rollbackTargetIdx, setRollbackTargetIdx] = useState<number | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  const toggleStep = (stepId: string) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  };

  const handleAdvanceStep = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onAdvanceStep || advancing) return;
    setAdvancing(true);
    try {
      await onAdvanceStep();
    } finally {
      setAdvancing(false);
    }
  };

  const handleRollbackToStep = async (e: React.MouseEvent, stepIndex: number) => {
    e.stopPropagation();
    if (!onRollbackToStep || rollingBack) return;
    setRollingBack(true);
    setRollbackTargetIdx(stepIndex);
    try {
      await onRollbackToStep(stepIndex);
    } finally {
      setRollingBack(false);
      setRollbackTargetIdx(null);
    }
  };

  // Check for corruption
  const isCorrupted = plan && (
    !plan.steps || 
    !Array.isArray(plan.steps) || 
    plan.steps.length === 0 ||
    !plan.goal
  );

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6">
        <div className="w-10 h-10 border-2 border-neutral-700 border-t-cyan-500 rounded-full animate-spin mb-4" />
        <p className="text-sm text-neutral-500">Creating your session plan...</p>
      </div>
    );
  }

  if (error || isCorrupted) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-900/20 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p className="text-sm text-red-400 mb-1">
          {isCorrupted ? "Plan is corrupted" : "Plan creation failed"}
        </p>
        <p className="text-xs text-neutral-600 mb-4">
          {isCorrupted ? "The plan has no steps" : error}
        </p>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-neutral-800 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <p className="text-sm text-neutral-500">No plan created yet</p>
        <p className="text-xs text-neutral-600 mt-1">
          Plan will be created when session starts
        </p>
      </div>
    );
  }

  const completedSteps = plan.steps.filter(s => s.status === "completed").length;
  const totalSteps = plan.steps.length;
  const progressPercent = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  const statusColors: Record<string, string> = {
    pending: "bg-neutral-600",
    in_progress: "bg-cyan-500 animate-pulse",
    completed: "bg-green-500",
    skipped: "bg-neutral-700",
  };

  const typeLabels: Record<string, string> = {
    question: "Question",
    task: "Task",
    suggestion: "Suggestion",
    checkpoint: "Checkpoint",
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]">
      {/* Progress bar */}
      <div className="shrink-0 px-4 pt-3 pb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-neutral-500">{t('sessionPlan.progress')}</span>
          <span className="text-xs font-medium text-white">{completedSteps}/{totalSteps} {t('sessionPlan.steps')}</span>
        </div>
        <div className="h-2.5 bg-neutral-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 space-y-3">
        {/* Steps */}
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider px-1">{t('sessionPlan.steps')}</h3>
          {plan.steps.map((step, idx) => {
            const isActive = step.status === "in_progress";
            const isCompleted = step.status === "completed";
            const isSkipped = step.status === "skipped";
            const isExpanded = expandedSteps.has(step.id) || isActive;

            return (
              <div
                key={step.id}
                onClick={() => toggleStep(step.id)}
                className={`w-full text-left rounded-xl border transition-all cursor-pointer ${
                  isActive
                    ? "bg-cyan-500/10 border-cyan-500/30"
                    : isCompleted
                    ? "bg-green-500/5 border-green-500/20"
                    : isSkipped
                    ? "bg-neutral-800/30 border-neutral-700/30 opacity-50"
                    : "bg-neutral-900/50 border-neutral-800"
                }`}
              >
                <div className="p-4">
                  {/* Step header */}
                  <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusColors[step.status]}`} />
                    <span className="text-xs text-neutral-500 font-mono">#{idx + 1}</span>
                    <span className="text-[10px] text-neutral-500 uppercase">
                      {typeLabels[step.type] || "Task"}
                    </span>
                    {isActive && (
                      <span className="ml-auto px-2 py-0.5 text-[10px] font-medium bg-cyan-500/20 text-cyan-400 rounded-full">
                        Current
                      </span>
                    )}
                    {isCompleted && (
                      <svg className="ml-auto w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>

                  {/* Step description */}
                  <p className={`mt-2 text-sm leading-relaxed ${
                    isSkipped ? "line-through text-neutral-600" :
                    isCompleted ? "text-neutral-400" : "text-white"
                  } ${!isExpanded ? "line-clamp-2" : ""}`}>
                    {step.description}
                  </p>
                  {/* Mark Complete button - only on active step */}
                  {isActive && onAdvanceStep && (
                    <button
                      onClick={handleAdvanceStep}
                      disabled={advancing}
                      className="mt-3 px-4 py-2 text-xs font-medium rounded-lg bg-green-500/15 text-green-400 border border-green-500/25 hover:bg-green-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                    >
                      {advancing ? (
                        <>
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Completing...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Mark Complete
                        </>
                      )}
                    </button>
                  )}
                  {/* Rollback button - only on completed steps */}
                  {isCompleted && onRollbackToStep && (
                    <button
                      onClick={(e) => handleRollbackToStep(e, idx)}
                      disabled={rollingBack}
                      className="mt-3 px-4 py-2 text-xs font-medium rounded-lg bg-amber-500/10 text-amber-400/80 border border-amber-500/20 hover:bg-amber-500/20 hover:text-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                    >
                      {rollingBack && rollbackTargetIdx === idx ? (
                        <>
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Rolling back...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a5 5 0 015 5v2M3 10l4-4M3 10l4 4" />
                          </svg>
                          Go back to this step
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
