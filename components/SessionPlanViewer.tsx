"use client";

import { useState } from "react";
import { type SessionPlan } from "@/lib/storage";
import { useI18n } from "@/lib/i18n";

interface SessionPlanViewerProps {
  plan: SessionPlan | null;
  loading?: boolean;
  error?: string | null;
  onAdvanceStep?: () => Promise<void>;
  onRollbackToStep?: (stepIndex: number) => Promise<void>;
  autoAdvance?: boolean;
  onToggleAutoAdvance?: (value: boolean) => void;
  sessionId?: string;
  onOpenResources?: (stepDescription: string) => void;
  onOpenPractice?: (stepDescription: string) => void;
  onAskAssistant?: (stepDescription: string) => void;
  isSessionActive?: boolean;
}

export function SessionPlanViewer({ plan, loading, error, onAdvanceStep, onRollbackToStep, autoAdvance = true, onToggleAutoAdvance, sessionId, onOpenResources, onOpenPractice, onAskAssistant, isSessionActive = false }: SessionPlanViewerProps) {
  const { t } = useI18n();
  const [advancing, setAdvancing] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);
  const [rollbackTargetIdx, setRollbackTargetIdx] = useState<number | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [showAdvanceDialog, setShowAdvanceDialog] = useState(false);
  const [advanceDialogReasoning, setAdvanceDialogReasoning] = useState("");
  const [analyzingAdvance, setAnalyzingAdvance] = useState(false);

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

    if (autoAdvance) {
      setAdvancing(true);
      try {
        await onAdvanceStep();
      } finally {
        setAdvancing(false);
      }
    } else {
      setAnalyzingAdvance(true);
      try {
        const res = await fetch("/api/session-plan/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: sessionId,
            previousProbes: [],
            focusedProbes: [],
            openProbeCount: 0,
            lastProbeTimestamp: 0,
          }),
        });
        
        if (res.ok) {
          const data = await res.json();
          if (data.canAutoAdvance) {
            setAdvancing(true);
            try {
              await onAdvanceStep();
            } finally {
              setAdvancing(false);
            }
          } else {
            setAdvanceDialogReasoning(data.advanceReasoning || t('sessionPlan.aiSuggestsStayingDefault'));
            setShowAdvanceDialog(true);
          }
        } else {
          setAdvanceDialogReasoning(t('sessionPlan.unableToAnalyze'));
          setShowAdvanceDialog(true);
        }
      } catch {
        setAdvanceDialogReasoning(t('sessionPlan.unableToAnalyze'));
        setShowAdvanceDialog(true);
      } finally {
        setAnalyzingAdvance(false);
      }
    }
  };

  const handleForceAdvance = async () => {
    setShowAdvanceDialog(false);
    if (!onAdvanceStep) return;
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

  // Enhanced validation - check for various corruption states
  const isCorrupted = plan && (
    !plan.steps || 
    !Array.isArray(plan.steps) || 
    plan.steps.length === 0 ||
    !plan.goal
  );
  
  if (loading) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-6">
        <div className="w-8 h-8 border-2 border-neutral-700 border-t-cyan-500 rounded-full animate-spin mb-4" />
        <p className="text-sm text-neutral-500">{t('sessionPlanViewer.creating')}</p>
      </div>
    );
  }

  if (error || isCorrupted) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-6 text-center">
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
          {isCorrupted ? t('sessionPlan.planCorrupted') : t('sessionPlan.creationFailed')}
        </p>
        <p className="text-xs text-neutral-600 mt-1">
          {isCorrupted ? t('sessionPlan.noSteps') : error}
        </p>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-6 text-center">
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
        <p className="text-sm text-neutral-500">{t('sessionPlanViewer.noPlanYet')}</p>
        <p className="text-xs text-neutral-600 mt-1">
          {t('sessionPlan.planWillBeCreated')}
        </p>
      </div>
    );
  }

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
    question: t('sessionPlan.question'),
    task: t('sessionPlan.task'),
    suggestion: t('sessionPlan.suggestion'),
    checkpoint: t('sessionPlan.checkpoint'),
  };

  const statusColors: Record<string, string> = {
    pending: "bg-neutral-600",
    in_progress: "bg-cyan-500 animate-pulse",
    completed: "bg-green-500",
    skipped: "bg-neutral-700",
  };

  return (
    <div className="h-full w-full flex flex-col p-4 overflow-hidden">
      {/* Section title */}
      <div className="mb-2 shrink-0">
        <h2 className="text-sm font-semibold text-white">{t('session.sessionPlan')}</h2>
      </div>

      {/* Steps list */}
      <div className="flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col gap-1 pr-1">
        {plan.steps.map((step, idx) => {
          const isActive = step.status === "in_progress";
          const isCompleted = step.status === "completed";
          const isSkipped = step.status === "skipped";
          const isExpanded = expandedSteps.has(step.id) || (isActive && !expandedSteps.has(step.id + "_collapsed"));

          // Collapsed view
          if (!isExpanded) {
            return (
              <button
                key={step.id}
                onClick={() => toggleStep(step.id)}
                className={`relative w-full flex-1 min-h-0 px-3 py-2.5 rounded-lg border transition-all text-left ${
                  isActive
                    ? "bg-cyan-500/10 border-cyan-500/30"
                    : isCompleted
                    ? "bg-green-500/5 border-green-500/20"
                    : isSkipped
                    ? "bg-neutral-800/30 border-neutral-700/30 opacity-50"
                    : "bg-neutral-900/50 border-neutral-800 hover:border-neutral-700"
                }`}
              >
                <div className="flex items-center gap-2">
                  <svg
                    className="w-3 h-3 text-neutral-500 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <div className={`w-2 h-2 rounded-full shrink-0 ${statusColors[step.status]}`} />
                  <span className={`${isActive ? "text-cyan-400" : isCompleted ? "text-green-400" : "text-neutral-500"}`}>
                    {typeIcons[step.type] || typeIcons.question}
                  </span>
                  <span className="text-[10px] text-neutral-600">#{idx + 1}</span>
                  <span className={`text-xs truncate flex-1 ${
                    isSkipped ? "line-through text-neutral-600" : 
                    isActive ? "text-white" :
                    isCompleted ? "text-neutral-500" : "text-neutral-400"
                  }`}>
                    {step.description}
                  </span>
                  {isActive && (
                    <span className="shrink-0 px-2 py-0.5 text-[10px] font-medium bg-cyan-500/20 text-cyan-400 rounded-full">
                      {t('sessionPlan.current')}
                    </span>
                  )}
                  {isCompleted && (
                    <svg className="shrink-0 w-3.5 h-3.5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </button>
            );
          }

          // Expanded view
          return (
            <div
              key={step.id}
              className={`relative p-3 rounded-lg border transition-all min-h-0 overflow-y-auto ${
                isActive ? "flex-[1.3_1_0%]" : "flex-1"
              } ${
                isActive
                  ? "bg-cyan-500/10 border-cyan-500/30"
                  : isCompleted
                  ? "bg-green-500/5 border-green-500/20"
                  : isSkipped
                  ? "bg-neutral-800/30 border-neutral-700/30 opacity-50"
                  : "bg-neutral-900/50 border-neutral-800"
              }`}
            >
              <div className="flex items-start gap-2">
                {/* Collapse button */}
                <button
                  onClick={() => isActive ? toggleStep(step.id + "_collapsed") : toggleStep(step.id)}
                  className="shrink-0 mt-0.5 text-neutral-500 hover:text-neutral-400"
                >
                  <svg
                    className="w-3 h-3 rotate-90"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                {/* Status indicator */}
                <div className="shrink-0 mt-1.5">
                  <div className={`w-2 h-2 rounded-full ${statusColors[step.status]}`} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`${isActive ? "text-cyan-400" : isCompleted ? "text-green-400" : "text-neutral-500"}`}>
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
                  {/* Step action buttons — Mark Complete, Resources, Practice, Ask Assistant */}
                  {isActive && (
                    <div className={`grid gap-1.5 mt-2.5 ${!autoAdvance && onAdvanceStep ? 'grid-cols-4' : 'grid-cols-3'}`}>
                      {!autoAdvance && onAdvanceStep && (
                        <button
                          onClick={handleAdvanceStep}
                          disabled={advancing || analyzingAdvance}
                          className="flex-1 py-1.5 text-[10px] font-medium rounded-md bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 hover:border-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1"
                        >
                          {advancing || analyzingAdvance ? (
                            <>
                              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                              {advancing ? "..." : "..."}
                            </>
                          ) : (
                            <>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              {t('sessionPlan.complete')}
                            </>
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => onOpenResources?.(step.description)}
                        disabled={!isSessionActive}
                        className="flex-1 py-1.5 text-[10px] font-medium rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 hover:border-blue-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1"
                      >
                        <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                        {t('sessionPlan.resources')}
                      </button>
                      <button
                        onClick={() => onOpenPractice?.(step.description)}
                        disabled={!isSessionActive}
                        className="flex-1 py-1.5 text-[10px] font-medium rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 hover:border-purple-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1"
                      >
                        <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        {t('sessionPlan.practice')}
                      </button>
                      <button
                        onClick={() => onAskAssistant?.(step.description)}
                        disabled={!isSessionActive}
                        className="flex-1 py-1.5 text-[10px] font-medium rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 hover:border-cyan-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1"
                      >
                        <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                        </svg>
                        {t('sessionPlan.ask')}
                      </button>
                    </div>
                  )}
                  {/* Rollback button - only on completed steps, hidden in auto mode */}
                  {!autoAdvance && isCompleted && onRollbackToStep && (
                    <button
                      onClick={(e) => handleRollbackToStep(e, idx)}
                      disabled={rollingBack}
                      className="mt-2.5 px-3 py-1.5 text-[11px] font-medium rounded-lg bg-amber-500/10 text-amber-400/80 border border-amber-500/20 hover:bg-amber-500/20 hover:border-amber-500/30 hover:text-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
                    >
                      {rollingBack && rollbackTargetIdx === idx ? (
                        <>
                          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          {t('sessionPlan.rollingBack')}
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a5 5 0 015 5v2M3 10l4-4M3 10l4 4" />
                          </svg>
                          {t('sessionPlan.goBackToStep')}
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Status badge */}
                {isActive && (
                  <span className="shrink-0 px-2 py-0.5 text-[10px] font-medium bg-cyan-500/20 text-cyan-400 rounded-full">
                    {t('sessionPlan.current')}
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

      {/* Advance Confirmation Dialog */}
      {showAdvanceDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 max-w-sm mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-white">{t('sessionPlan.aiSuggestsStaying')}</h3>
            </div>
            <p className="text-sm text-neutral-400 mb-4 leading-relaxed">
              {advanceDialogReasoning}
            </p>
            <p className="text-xs text-neutral-500 mb-4">
              {t('sessionPlan.canStillAdvance')}
            </p>
            <div className="flex gap-2.5">
              <button
                onClick={() => setShowAdvanceDialog(false)}
                className="flex-1 py-2.5 text-sm text-neutral-400 border border-neutral-700 hover:border-neutral-600 rounded-lg transition-colors"
              >
                {t('sessionPlan.stayOnStep')}
              </button>
              <button
                onClick={handleForceAdvance}
                className="flex-1 py-2.5 text-sm text-white bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 rounded-lg transition-colors"
              >
                {t('sessionPlan.continueAnyway')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
