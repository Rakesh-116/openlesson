"use client";

import { useEffect, useState } from "react";

interface SessionStep {
  id: string;
  type: string;
  description: string;
  order: number;
  status: string;
}

interface PreviewData {
  goal: string;
  strategy: string;
  description?: string;
  steps: SessionStep[];
}

interface PreviewSessionModalProps {
  nodeTitle: string;
  nodeDescription: string;
  planTopic: string;
  planningPrompt?: string;
  onClose: () => void;
  onStartSession?: () => void;
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
  feedback: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
    </svg>
  ),
};

export function PreviewSessionModal({
  nodeTitle,
  nodeDescription,
  planTopic,
  planningPrompt,
  onClose,
  onStartSession,
}: PreviewSessionModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<PreviewData | null>(null);

  useEffect(() => {
    async function generate() {
      try {
        const res = await fetch("/api/learning-plan/preview-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nodeTitle, nodeDescription, planTopic, planningPrompt }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to generate preview");
        }
        const data = await res.json();
        setPreview(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    }
    generate();
  }, [nodeTitle, nodeDescription, planTopic, planningPrompt]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-neutral-700 rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
          <div>
            <h3 className="text-base font-semibold text-white">Session Preview</h3>
            <p className="text-xs text-neutral-400 mt-0.5">{nodeTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <svg className="w-8 h-8 animate-spin text-neutral-500" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="text-sm text-neutral-500">Generating session plan...</p>
            </div>
          )}

          {error && (
            <div className="text-center py-12">
              <p className="text-red-400 text-sm">{error}</p>
              <button
                onClick={onClose}
                className="mt-4 text-sm text-neutral-400 hover:text-white transition-colors"
              >
                Close
              </button>
            </div>
          )}

          {preview && (
            <div className="space-y-4">
              {/* Goal & Strategy */}
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-neutral-500 mb-0.5">Goal</p>
                  <p className="text-sm text-white">{preview.goal}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500 mb-0.5">Strategy</p>
                  <p className="text-sm text-neutral-300">{preview.strategy}</p>
                </div>
              </div>

              {/* Progress bar (all pending) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-neutral-500">Steps</span>
                  <span className="text-xs font-medium text-white">
                    0/{preview.steps.length}
                  </span>
                </div>
                <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500" style={{ width: "0%" }} />
                </div>
              </div>

              {/* Steps list — matching SessionPlanViewer style */}
              <div className="space-y-1">
                {preview.steps.map((step, idx) => (
                  <div
                    key={step.id || idx}
                    className="relative w-full px-3 py-2 rounded-lg border bg-neutral-900/50 border-neutral-800"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-neutral-600 shrink-0" />
                      <span className="text-neutral-500">
                        {typeIcons[step.type] || typeIcons.question}
                      </span>
                      <span className="text-[10px] text-neutral-600">#{idx + 1}</span>
                      <span className="text-xs text-neutral-400 truncate flex-1">
                        {step.description}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {preview && (
          <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-neutral-800">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-neutral-400 hover:text-white transition-colors"
            >
              Close
            </button>
            {onStartSession && (
              <button
                onClick={onStartSession}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors"
              >
                Start Real Session
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
