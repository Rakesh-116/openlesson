"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { AudioRecorder } from "@/lib/audio";
import {
  getSession,
  startSession,
  type Session,
  type Probe,
} from "@/lib/storage";

export function PlanningView({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mic check
  const [micStatus, setMicStatus] = useState<"idle" | "checking" | "ready" | "denied">("idle");
  const micStreamRef = useRef<MediaStream | null>(null);

  // Probes
  const [activeProbe, setActiveProbe] = useState<Probe | null>(null);
  const [openingProbeLoading, setOpeningProbeLoading] = useState(false);

  // Prepare for session
  const [preparingSession, setPreparingSession] = useState(false);
  const [preparedMaterial, setPreparedMaterial] = useState<string | null>(null);
  const [showMaterial, setShowMaterial] = useState(false);
  const [relevantChunks, setRelevantChunks] = useState<Array<{
    id: string;
    preview: string;
    sessionId: string | null;
  }>>([]);
  const [selectedChunks, setSelectedChunks] = useState<string[]>([]);

  // Calibration (RAG)
  const [calibrationLoading, setCalibrationLoading] = useState(true);
  const [calibration, setCalibration] = useState<{
    context: string;
    gapThreshold: number;
    probeFrequency: "rare" | "balanced" | "frequent";
    chunks: Array<{
      id: string;
      content: string;
      similarity: number;
      createdAt: string;
      topic?: string;
    }>;
  } | null>(null);
  const [showPastPatterns, setShowPastPatterns] = useState(false);
  const [selectedPatterns, setSelectedPatterns] = useState<string[]>([]);

  // Starting session
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    async function loadSession() {
      try {
        const s = await getSession(sessionId);
        if (!s) {
          setError("Session not found");
          return;
        }
        if (s.status !== "ready") {
          router.push(`/session?id=${sessionId}`);
          return;
        }
        setSession(s);
        await loadCalibration(s.problem);
      } catch (err) {
        console.error("Failed to load session:", err);
        setError("Failed to load session");
      } finally {
        setLoading(false);
      }
    }
    loadSession();
  }, [sessionId, router]);

  async function loadCalibration(problem: string) {
    setCalibrationLoading(true);
    try {
      const response = await fetch("/api/calibrate-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problem }),
      });
      if (response.ok) {
        const data = await response.json();
        setCalibration(data);
        // Pre-select all relevant patterns
        if (data.chunks) {
          setSelectedPatterns(data.chunks.map((c: { id: string }) => c.id));
        }
      }
    } catch (err) {
      console.error("Calibration error:", err);
    } finally {
      setCalibrationLoading(false);
    }
  }

  useEffect(() => {
    if (!session?.problem) return;
    async function loadOpeningProbe() {
      setOpeningProbeLoading(true);
      try {
        const response = await fetch("/api/opening-probe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ problem: session!.problem }),
        });
        if (response.ok) {
          const data = await response.json();
          console.log("[PlanningView] Opening probe loaded:", data.probe);
          setActiveProbe(data.probe);
        } else {
          console.error("[PlanningView] Opening probe failed:", response.status, await response.text());
        }
      } catch (err) {
        console.error("Opening probe error:", err);
      } finally {
        setOpeningProbeLoading(false);
      }
    }
    loadOpeningProbe();
  }, [session?.problem]);

  const checkMicrophone = async () => {
    setMicStatus("checking");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      setMicStatus("ready");
    } catch (err) {
      console.error("Mic check error:", err);
      setMicStatus("denied");
    }
  };

  const handlePrepareForSession = async () => {
    if (!session?.problem) return;
    setPreparingSession(true);
    setPreparedMaterial(null);
    setRelevantChunks([]);
    setSelectedChunks([]);
    setShowMaterial(true);
    try {
      const response = await fetch("/api/learning-plan/prepare-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: session.problem, planNodeId: session.id }),
      });
      if (response.ok) {
        const data = await response.json();
        setPreparedMaterial(data.content);
        if (data.relevantChunks && data.relevantChunks.length > 0) {
          setRelevantChunks(data.relevantChunks);
          setSelectedChunks(data.relevantChunks.map((c: { id: string }) => c.id));
        }
      } else {
        setPreparedMaterial("Failed to generate preparation material. Please try again.");
      }
    } catch (err) {
      console.error("Prepare session error:", err);
      setPreparedMaterial("Error generating preparation material. Please try again.");
    } finally {
      setPreparingSession(false);
    }
  };

  const handleBeginSession = async () => {
    if (!session) return;
    setIsStarting(true);
    try {
      if (activeProbe) {
        const probeText = typeof activeProbe === 'string' ? activeProbe : activeProbe.text;
        await fetch("/api/save-opening-probe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: session.id, probeText }),
        });
      }
      // Save selected RAG chunks to session metadata
      if (selectedChunks.length > 0) {
        await fetch("/api/save-session-rag-chunks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            sessionId: session.id, 
            chunkIds: selectedChunks 
          }),
        });
      }
      await startSession(session.id);
      router.push(`/session?id=${session.id}`);
    } catch (err) {
      console.error("Failed to start session:", err);
      setIsStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-black">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-neutral-400 text-sm">Loading session...</p>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="flex items-center justify-center h-full bg-black">
        <p className="text-red-400">{error || "Session not found"}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-black text-white">
      {/* TOP STATUS BAR */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800/50 shrink-0">
        <div />
        <div className="flex items-center gap-3">
          {calibration && calibration.chunks.length > 0 && (
            <button
              onClick={() => setShowPastPatterns(!showPastPatterns)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-neutral-800 bg-neutral-900/50 hover:bg-neutral-800/50 transition-colors"
            >
              <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs text-neutral-400">{selectedPatterns.length}/{calibration.chunks.length} patterns</span>
              <svg className={`w-3 h-3 text-neutral-500 transition-transform ${showPastPatterns ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Collapsible past patterns */}
      {showPastPatterns && calibration && calibration.chunks.length > 0 && (
        <div className="px-4 py-3 border-b border-neutral-800/30 bg-neutral-900/20">
          <div className="max-w-4xl mx-auto space-y-2">
            {calibration.chunks.map((chunk) => (
              <div 
                key={chunk.id} 
                className="p-3 rounded-lg border border-neutral-800 bg-neutral-900/30"
              >
                <div className="flex items-start gap-2 mb-2">
                  <input 
                    type="checkbox" 
                    id={`pattern-${chunk.id}`}
                    checked={selectedPatterns.includes(chunk.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedPatterns([...selectedPatterns, chunk.id]);
                      } else {
                        setSelectedPatterns(selectedPatterns.filter(id => id !== chunk.id));
                      }
                    }}
                    className="mt-0.5 w-3.5 h-3.5 rounded border-neutral-600 bg-neutral-800 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0" 
                  />
                  <label htmlFor={`pattern-${chunk.id}`} className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-neutral-500">{chunk.topic || 'Previous session'}</span>
                      <span className="text-[10px] text-emerald-400 font-mono">{Math.round(chunk.similarity * 100)}% match</span>
                    </div>
                  </label>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed line-clamp-3 pl-5">
                  {chunk.content}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 overflow-y-auto px-4 py-8">
        {calibrationLoading && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-6 h-6 border border-neutral-700 border-t-cyan-500 rounded-full animate-spin mb-3" />
            <p className="text-xs text-neutral-500">Analyzing your learning history...</p>
          </div>
        )}

        {openingProbeLoading && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="flex gap-1 mb-4">
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: "0ms" }} />
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: "150ms" }} />
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
            <p className="text-sm text-neutral-500">Preparing your question...</p>
          </div>
        )}

        {activeProbe && !openingProbeLoading && (
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-400/70 font-medium mb-4">
                Your Starting Question
              </p>
              <div className="p-6 rounded-2xl bg-neutral-900/50 border border-neutral-800">
                <p className="text-2xl sm:text-3xl font-medium text-white leading-relaxed">
                  {typeof activeProbe === 'string' ? activeProbe : activeProbe.text}
                </p>
              </div>
            </div>

            <div className="mb-8">
              <p className="text-xs text-neutral-500 mb-3 text-center">Feeling lost or lacking confidence?</p>
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  onClick={handlePrepareForSession}
                  disabled={preparingSession}
                  className="px-4 py-2.5 rounded-xl border border-neutral-700 bg-neutral-800/50 hover:bg-neutral-800 text-neutral-300 text-sm font-medium transition-all hover:border-neutral-600 flex items-center gap-2"
                >
                  {preparingSession ? (
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="31.4 31.4" strokeLinecap="round" /></svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  )}
                  Prepare for Session
                </button>
                <a
                  href={`https://grokipedia.com/search?q=${encodeURIComponent(session?.problem || "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 rounded-xl border border-neutral-700 bg-neutral-800/50 hover:bg-neutral-800 text-neutral-300 text-sm font-medium transition-all hover:border-neutral-600 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="12" r="10" />
                    <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                  Search Grokipedia
                </a>
              </div>
            </div>
          </div>
        )}

        {!activeProbe && !openingProbeLoading && !calibrationLoading && (
          <div className="max-w-4xl mx-auto">
            <div className="text-center py-8">
              <p className="text-sm text-neutral-400 mb-4">
                Think about how you'd explain <span className="text-cyan-400">{session?.problem}</span> out loud.
              </p>
              <p className="text-xs text-neutral-500">
                When you're ready, check your microphone and begin the session.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM SECTION */}
      <div className="px-4 py-6 border-t border-neutral-800/50 bg-neutral-900/30">
        <div className="max-w-lg mx-auto mb-6">
          {micStatus === "ready" ? (
            <button
              onClick={handleBeginSession}
              disabled={isStarting || openingProbeLoading}
              className="w-full py-4 bg-cyan-500 hover:bg-cyan-400 disabled:bg-cyan-500/50 disabled:cursor-not-allowed text-black font-semibold text-lg rounded-2xl transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-3"
            >
              {isStarting ? (
                <>
                  <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                  Begin Session
                </>
              )}
            </button>
          ) : (
            <button
              onClick={checkMicrophone}
              disabled={micStatus === "checking"}
              className="w-full py-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium rounded-xl transition-colors flex items-center justify-center gap-2 text-sm border border-neutral-700"
            >
              {micStatus === "checking" ? (
                <>
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                  Checking microphone...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                  {micStatus === "denied" ? "Microphone Denied - Try Again" : "Check Microphone First"}
                </>
              )}
            </button>
          )}
        </div>

        <p className="text-[10px] text-neutral-600 text-center leading-relaxed">
          By starting this session, you agree to let us collect and use your voice data for research purposes and improvement of the product.
        </p>
      </div>

      {/* Prepare Material Modal */}
      {showMaterial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="w-full max-w-2xl max-h-[80vh] bg-neutral-900 rounded-2xl border border-neutral-800 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
              <h2 className="text-lg font-semibold text-white">Preparation Material</h2>
              <button
                onClick={() => setShowMaterial(false)}
                className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {preparingSession ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="text-neutral-400">Generating your preparation material...</p>
                </div>
              ) : preparedMaterial ? (
                <div className="space-y-6">
                  {relevantChunks.length > 0 && (
                    <div className="border border-neutral-800 rounded-lg p-4 bg-neutral-900/30">
                      <div className="flex items-center gap-2 mb-3">
                        <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="text-sm font-medium text-neutral-300">Relevant past sessions</span>
                        <span className="text-xs text-neutral-500">(select to include)</span>
                      </div>
                      <div className="space-y-2">
                        {relevantChunks.map((chunk) => (
                          <label
                            key={chunk.id}
                            className="flex items-start gap-3 p-2 rounded hover:bg-neutral-800/50 cursor-pointer transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={selectedChunks.includes(chunk.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedChunks([...selectedChunks, chunk.id]);
                                } else {
                                  setSelectedChunks(selectedChunks.filter(id => id !== chunk.id));
                                }
                              }}
                              className="mt-1 w-4 h-4 rounded border-neutral-600 bg-neutral-800 text-cyan-500 focus:ring-cyan-500/50"
                            />
                            <span className="text-xs text-neutral-400">{chunk.preview}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown>{preparedMaterial}</ReactMarkdown>
                  </div>
                </div>
              ) : (
                <p className="text-neutral-500">No material available</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
