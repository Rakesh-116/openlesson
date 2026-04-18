"use client";

import { useMemo } from "react";
import { type Probe, type RequestType, type ToolName } from "@/lib/storage";
import { useI18n } from "@/lib/i18n";

const MAX_PROBES = 5;

// Tool labels for display
function getToolLabel(tool: string, t: (key: string) => string): string {
  const labels: Record<string, string> = {
    chat: t('tools.teachingAssistant'),
    canvas: t('tools.canvas'),
    notebook: t('tools.notebook'),
    grokipedia: t('tools.grokipedia'),
    plan: t('probes.session'),
    rag: t('tools.ragMatches'),
    exercise: t('tools.practice'),
    reading: t('tools.theory'),
    help: t('tools.help'),
  };
  return labels[tool] || tool;
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

interface ProbesPanelProps {
  probes: Probe[];
  onArchiveProbe?: (probeId: string) => Promise<void>;
  onToggleFocus?: (probeId: string, focused: boolean) => void;
  onToolSelect?: (tool: ToolName) => void;
  archivingProbeId?: string | null;
  isInitializing?: boolean;
  isGeneratingProbe?: boolean;
  sessionPlan?: { steps?: Array<{ id: string; order: number; description: string }> } | null;
}

export function ProbesPanel({
  probes,
  onArchiveProbe,
  onToggleFocus,
  onToolSelect,
  archivingProbeId,
  isInitializing = false,
  isGeneratingProbe = false,
  sessionPlan,
}: ProbesPanelProps) {
  const { t } = useI18n();

  const activeProbes = useMemo(() => probes.filter(p => !p.archived), [probes]);

  const formatTimestamp = (timestamp: number) => {
    const totalSeconds = Math.floor(timestamp / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex-1 min-w-0 flex flex-col bg-[#0a0a0a] h-full overflow-hidden">
      {/* Section Title */}
      <div className="px-4 pt-3 pb-2 shrink-0">
        <h2 className="text-sm font-semibold text-white">{t('probes.guidingTasks')}</h2>
      </div>

      {/* 5 Probe Slots - filled + empty */}
      <div className="flex-1 min-h-0 px-3 pb-3 flex flex-col gap-2 overflow-hidden">
        {isInitializing && activeProbes.length === 0 ? (
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-3">
            <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
            <p className="text-xs text-neutral-500">{t('probes.preparing')}</p>
          </div>
        ) : (
          Array.from({ length: MAX_PROBES }).map((_, i) => {
            const probe = activeProbes[i];
            const isGeneratingThisSlot = isGeneratingProbe && !probe && i === activeProbes.length;

            if (!probe) {
              // Empty / generating slot
              return (
                <div
                  key={`empty-${i}`}
                  className="flex-1 min-h-0 p-3 rounded-lg border-2 border-dashed border-neutral-700 bg-neutral-800/40 flex items-center justify-center gap-2"
                >
                  {isGeneratingThisSlot ? (
                    <>
                      <div className="w-4 h-4 border-2 border-neutral-600 border-t-cyan-500 rounded-full animate-spin" />
                      <span className="text-xs text-neutral-400">{t('probes.generatingProbe')}</span>
                    </>
                  ) : (
                    <>
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-neutral-700/60 text-[10px] font-bold text-neutral-400">
                        {i + 1}
                      </span>
                      <span className="text-xs text-neutral-400">{t('session.emptySlot')}</span>
                    </>
                  )}
                </div>
              );
            }

            const planStep = probe.planStepId
              ? sessionPlan?.steps?.find(s => s.id === probe.planStepId)
              : null;
            const stepContext = planStep
              ? t('probes.stepContext', { order: planStep.order, description: planStep.description })
              : t('probes.general');

            const requestType = probe.requestType || "question";
            const typeBadge = getTypeBadgeStyles(requestType);
            const isArchiving = archivingProbeId === probe.id;

            return (
              <div
                key={probe.id}
                onClick={() => onToggleFocus?.(probe.id, !probe.focused)}
                className={`
                  group relative p-3 rounded-lg transition-all duration-300 cursor-pointer
                  flex-1 min-h-0 overflow-y-auto
                  ${probe.focused
                    ? "bg-amber-500/10 border border-amber-500/30"
                    : "bg-neutral-900/50 border border-neutral-800/50 hover:border-neutral-700"
                  }
                  ${isArchiving ? "animate-slide-out-right opacity-0" : ""}
                `}
              >
                {/* Probe Header */}
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="text-[10px] font-mono text-neutral-500">
                    {formatTimestamp(probe.timestamp)}
                  </span>
                  <span className={`px-1.5 py-0.5 text-[9px] font-medium rounded ${typeBadge.bg} ${typeBadge.text} border ${typeBadge.border}`}>
                    {requestType}
                  </span>
                  <span className="text-[9px] text-neutral-600 truncate max-w-[100px]" title={stepContext}>
                    {stepContext}
                  </span>

                  {/* Done Button */}
                  <div className="ml-auto flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onArchiveProbe?.(probe.id);
                      }}
                      disabled={isArchiving}
                      className="flex items-center gap-1 px-2 py-1 rounded text-neutral-500 hover:text-green-400 hover:bg-green-500/10 transition-colors disabled:opacity-50 text-xs"
                      title={t('session.markAsDone')}
                    >
                      {isArchiving ? (
                        <>
                          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          <span className="text-green-400">{t('probes.validating')}</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          <span>{t('probes.done')}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Probe Text */}
                <p className="text-sm text-neutral-300 leading-snug">
                  {probe.text}
                </p>

                {/* Task hint */}
                {requestType === "task" && (
                  <p className="text-[10px] text-purple-400/70 mt-1.5 italic">
                    {t('probes.useToolsHint')}
                  </p>
                )}

                {/* Tool Suggestions */}
                {probe.suggestedTools && probe.suggestedTools.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className="text-[9px] text-neutral-500 self-center mr-1">{t('probes.tryHint')}</span>
                    {probe.suggestedTools.map(tool => (
                      <button
                        key={tool}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToolSelect?.(tool);
                        }}
                        className="px-2 py-0.5 text-[10px] font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-full hover:bg-cyan-500/20 hover:border-cyan-500/40 transition-colors"
                      >
                        {getToolLabel(tool, t)}
                      </button>
                    ))}
                  </div>
                )}

                {/* Focused indicator */}
                {probe.focused && (
                  <div className="mt-2 text-[9px] text-amber-400/80 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
                    </svg>
                    {t('probes.focusedHint')}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
