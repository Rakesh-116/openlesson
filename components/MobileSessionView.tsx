"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { SwipeableTabs } from "./SwipeableTabs";
import { MobileProbesTab } from "./MobileProbesTab";
import { MobilePlanTab } from "./MobilePlanTab";
import { WhiteboardCanvas } from "./WhiteboardCanvas";
import { AudioRecorder } from "@/lib/audio";
import { 
  type Probe, 
  type SessionPlan, 
  type Session,
  getSession,
  getSessionPlan,
  saveAudioChunk,
  archiveProbe,
  toggleProbeFocused,
  logToolUsage,
} from "@/lib/storage";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";

interface MobileSessionViewProps {
  sessionId: string;
  initialSession?: Session | null;
}

export function MobileSessionView({ 
  sessionId,
  initialSession,
}: MobileSessionViewProps) {
  const { t } = useI18n();
  // Session state
  const [session, setSession] = useState<Session | null>(initialSession ?? null);
  const [sessionPlan, setSessionPlan] = useState<SessionPlan | null>(null);
  const [probes, setProbes] = useState<Probe[]>(initialSession?.probes ?? []);
  
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [micStatus, setMicStatus] = useState<"idle" | "checking" | "ready" | "denied">("idle");
  
  // UI state
  const [activeTab, setActiveTab] = useState(0);
  const [archivingProbeId, setArchivingProbeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!initialSession);
  const [whiteboardData, setWhiteboardData] = useState<string | null>(null);

  // Refs
  const recorderRef = useRef<AudioRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analysisRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunkIndexRef = useRef(0);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const heartbeatSecondRef = useRef(0);
  const whiteboardDataRef = useRef<string | null>(null);

  // Load session data if not provided
  useEffect(() => {
    if (initialSession) return;
    
    const loadSession = async () => {
      try {
        const [sessionData, planData] = await Promise.all([
          getSession(sessionId),
          getSessionPlan(sessionId),
        ]);
        
        if (sessionData) {
          setSession(sessionData);
          setProbes(sessionData.probes);
        }
        if (planData) {
          setSessionPlan(planData);
        }
      } catch (err) {
        console.error("Failed to load session:", err);
        setError("Failed to load session data");
      } finally {
        setLoading(false);
      }
    };

    loadSession();
  }, [sessionId, initialSession]);

  // Request wake lock when recording
  useEffect(() => {
    const requestWakeLock = async () => {
      if (isRecording && "wakeLock" in navigator) {
        try {
          wakeLockRef.current = await navigator.wakeLock.request("screen");
        } catch (err) {
          console.warn("[MobileSession] Wake lock failed:", err);
        }
      }
    };

    const releaseWakeLock = () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    };

    if (isRecording) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }

    return () => releaseWakeLock();
  }, [isRecording]);

  // Check microphone permission
  const checkMicrophone = useCallback(async () => {
    setMicStatus("checking");
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      // Stop immediately, we just wanted to check permission
      stream.getTracks().forEach(t => t.stop());
      setMicStatus("ready");
    } catch (err) {
      setMicStatus("denied");
      setError("Microphone access denied. Please allow microphone permission and try again.");
    }
  }, []);

  // Start recording
  const startRecording = useCallback(async () => {
    if (!session) return;
    
    try {
      setError(null);
      chunkIndexRef.current = 0;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      const recorder = new AudioRecorder({
        chunkDurationMs: 60000, // 1 minute chunks
        maxBufferDurationMs: 300000, // 5 minute buffer
      });

      recorderRef.current = recorder;
      await recorder.start(stream);
      setIsRecording(true);
      setIsPaused(false);

      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);

      // Dual heartbeat: storage every 5s, analysis every 10s
      analysisRef.current = setInterval(async () => {
        const second = heartbeatSecondRef.current;
        const currentSession = session;
        const recorder = recorderRef.current;
        
        if (second % 5 === 0 && currentSession) {
          // Storage heartbeat - save audio, whiteboard, and transcribe
          try {
            // Save audio chunks from recorder buffer
            if (recorder) {
              const recentAudio = recorder.getRecentAudio(5000);
              if (recentAudio && recentAudio.size > 100) {
                const idx = chunkIndexRef.current++;
                await saveAudioChunk(currentSession.id, recentAudio, idx, Date.now());
              }
            }
            
            // Save whiteboard data
            if (whiteboardDataRef.current) {
              await logToolUsage(currentSession.id, 'canvas', 'canvas_draw', Date.now(), { data: whiteboardDataRef.current });
            }
            
            // Transcribe missing chunks
            await fetch("/api/transcribe-chunks", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sessionId: currentSession.id }),
            });
          } catch (err) {
            console.warn("[Mobile] Storage heartbeat error:", err);
          }
        }
        
        if (second % 10 === 0 && currentSession) {
          // Analysis heartbeat - call session-plan/update (now includes gap analysis)
          try {
            const openProbes = currentSession.probes.filter((p: Probe) => !p.archived);
            const focusedProbes = openProbes.filter((p: Probe) => p.focused).map((p: Probe) => ({ id: p.id, text: p.text }));
            await fetch("/api/session-plan/update", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                sessionId: currentSession.id,
                previousProbes: currentSession.probes.map((p: Probe) => p.text),
                focusedProbes,
                openProbeCount: openProbes.length,
                lastProbeTimestamp: 0,
              }),
            });
          } catch (err) {
            console.error("[Mobile] Analysis error:", err);
          }
        }
        
        heartbeatSecondRef.current = (second + 1) % 10;
      }, 1000);

    } catch (err) {
      setError("Could not access microphone. Please grant permission and try again.");
    }
  }, [session]);

  // Stop recording
  const stopRecording = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (analysisRef.current) clearInterval(analysisRef.current);
    
    await recorderRef.current?.stop();
    recorderRef.current = null;
    
    setIsRecording(false);
    setIsPaused(false);
  }, []);

  // Pause recording
  const pauseRecording = useCallback(() => {
    setIsPaused(true);
    // Note: MediaRecorder doesn't have native pause in all browsers
    // We just stop the timer and analysis
    if (timerRef.current) clearInterval(timerRef.current);
    if (analysisRef.current) clearInterval(analysisRef.current);
  }, []);

  // Resume recording
  const resumeRecording = useCallback(() => {
    setIsPaused(false);
    
    const startTime = Date.now() - (elapsedSeconds * 1000);
    timerRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    // Restart dual heartbeat: storage every 5s, analysis every 10s
    if (session) {
      analysisRef.current = setInterval(async () => {
        const second = heartbeatSecondRef.current;
        const currentSession = session;
        const recorder = recorderRef.current;
        
        if (second % 5 === 0 && currentSession) {
          try {
            if (recorder) {
              const recentAudio = recorder.getRecentAudio(5000);
              if (recentAudio && recentAudio.size > 100) {
                const idx = chunkIndexRef.current++;
                await saveAudioChunk(currentSession.id, recentAudio, idx, Date.now());
              }
            }
            
            if (whiteboardDataRef.current) {
              await logToolUsage(currentSession.id, 'canvas', 'canvas_draw', Date.now(), { data: whiteboardDataRef.current });
            }
            
            await fetch("/api/transcribe-chunks", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sessionId: currentSession.id }),
            });
          } catch (err) {
            console.warn("[Mobile] Storage heartbeat error:", err);
          }
        }
        
        if (second % 10 === 0 && currentSession) {
          try {
            const openProbeCount = currentSession.probes.filter((p: Probe) => !p.archived).length;
            await fetch("/api/analyze-gap", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                sessionId: currentSession.id,
                problem: currentSession.problem,
                openProbeCount,
                lastProbeTimestamp: 0,
              }),
            });
          } catch (err) {
            console.error("[Mobile] Analysis error:", err);
          }
        }
        
        heartbeatSecondRef.current = (second + 1) % 10;
      }, 1000);
    }
  }, [session, elapsedSeconds]);

  // Archive probe
  const handleArchiveProbe = useCallback(async (probeId: string) => {
    setArchivingProbeId(probeId);
    try {
      await archiveProbe(probeId);
      setProbes(prev => prev.map(p => 
        p.id === probeId ? { ...p, archived: true } : p
      ));
    } catch (err) {
      console.error("Failed to archive probe:", err);
    } finally {
      setArchivingProbeId(null);
    }
  }, []);

  // Toggle probe focus
  const handleToggleFocus = useCallback(async (probeId: string, focused: boolean) => {
    try {
      await toggleProbeFocused(probeId, focused);
      setProbes(prev => prev.map(p => 
        p.id === probeId ? { ...p, focused } : p
      ));
    } catch (err) {
      console.error("Failed to toggle focus:", err);
    }
  }, []);

  // Advance to next step
  const handleAdvanceStep = useCallback(async () => {
    if (!session) return;
    try {
      const res = await fetch("/api/session-plan/advance-step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id }),
      });
      
      if (!res.ok) throw new Error("Failed to advance step");
      
      const { plan } = await res.json();
      if (plan && plan.steps && Array.isArray(plan.steps) && plan.steps.length > 0 && plan.goal) {
        setSessionPlan(plan);
      }
    } catch (err) {
      console.error("Advance step error:", err);
    }
  }, [session]);

  // Rollback to a specific step
  const handleRollbackToStep = useCallback(async (stepIndex: number) => {
    if (!session) return;
    try {
      const res = await fetch("/api/session-plan/rollback-step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id, targetStepIndex: stepIndex }),
      });
      
      if (!res.ok) throw new Error("Failed to rollback step");
      
      const { plan } = await res.json();
      if (plan && plan.steps && Array.isArray(plan.steps) && plan.steps.length > 0 && plan.goal) {
        setSessionPlan(plan);
      }
    } catch (err) {
      console.error("Rollback step error:", err);
    }
  }, [session]);

  // Format time display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-6">
        <div className="w-10 h-10 border-2 border-neutral-700 border-t-cyan-500 rounded-full animate-spin mb-4" />
        <p className="text-sm text-neutral-500">{t('session.loadingSession')}</p>
      </div>
    );
  }

  // Session not found
  if (!session) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-900/20 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-lg font-semibold text-white mb-2">{t('session.sessionNotFound')}</h1>
        <p className="text-sm text-neutral-500 mb-6">
          {t('session.sessionNotFoundDesc')}
        </p>
        <Link
          href="/dashboard"
          className="px-5 py-2.5 bg-neutral-800 border border-neutral-700 rounded-xl text-sm text-white hover:bg-neutral-700 transition-colors"
        >
          {t('session.goToDashboard')}
        </Link>
      </div>
    );
  }

  const tabs = [
    {
      id: "probes",
      label: t('session.questions'),
      content: (
        <MobileProbesTab
          probes={probes}
          sessionPlan={sessionPlan}
          onArchiveProbe={handleArchiveProbe}
          onToggleFocus={handleToggleFocus}
          archivingProbeId={archivingProbeId}
        />
      ),
    },
    {
      id: "plan",
      label: t('session.plan'),
      content: (
        <MobilePlanTab
          plan={sessionPlan}
          onAdvanceStep={handleAdvanceStep}
          onRollbackToStep={handleRollbackToStep}
        />
      ),
    },
    {
      id: "canvas",
      label: t('tools.canvas'),
      content: (
        <div className="flex-1 min-h-0">
          <WhiteboardCanvas
            initialData={whiteboardData || undefined}
            onCanvasChange={(dataUrl) => {
              whiteboardDataRef.current = dataUrl;
              setWhiteboardData(dataUrl);
            }}
          />
        </div>
      ),
    },
  ];

  return (
    <div 
      className="h-screen bg-[#0a0a0a] flex flex-col overflow-hidden"
      style={{ 
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* Header */}
      <header className="shrink-0 px-4 py-3 border-b border-neutral-800 bg-[#0a0a0a]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-sm font-semibold text-white shrink-0">{t('session.session')}</h1>
            <p className="text-[10px] text-neutral-500 truncate">
              {session.problem || t('session.session')}
            </p>
          </div>

          {/* Timer */}
          {(isRecording || elapsedSeconds > 0) && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-900 border border-neutral-800 rounded-lg">
              {isRecording && !isPaused && (
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              )}
              {isPaused && (
                <div className="w-2 h-2 rounded-full bg-amber-500" />
              )}
              <span className="text-sm font-mono text-white tabular-nums">
                {formatTime(elapsedSeconds)}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Recording controls */}
      <div className="shrink-0 px-4 py-3 border-b border-neutral-800 bg-neutral-900/50">
        {error && (
          <div className="mb-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        {micStatus === "idle" && !isRecording && (
          <button
            onClick={checkMicrophone}
            className="w-full py-3.5 bg-neutral-800 border border-neutral-700 rounded-xl text-sm font-medium text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            {t('session.checkMicrophone')}
          </button>
        )}

        {micStatus === "checking" && (
          <div className="w-full py-3.5 bg-neutral-800 border border-neutral-700 rounded-xl flex items-center justify-center gap-2">
            <div className="w-5 h-5 border-2 border-neutral-600 border-t-cyan-500 rounded-full animate-spin" />
            <span className="text-sm text-neutral-400">{t('session.checkingMic')}</span>
          </div>
        )}

        {micStatus === "ready" && !isRecording && (
          <button
            onClick={startRecording}
            className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl text-sm font-medium text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-lg shadow-cyan-500/20"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {t('session.startSession')}
          </button>
        )}

        {micStatus === "denied" && (
          <button
            onClick={checkMicrophone}
            className="w-full py-3.5 bg-red-500/10 border border-red-500/30 rounded-xl text-sm font-medium text-red-400 flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            {t('session.retryMicrophoneAccess')}
          </button>
        )}

        {isRecording && (
          <div className="flex gap-2">
            {isPaused ? (
              <>
                <button
                  onClick={resumeRecording}
                  className="flex-1 py-3 bg-green-500/10 border border-green-500/30 rounded-xl text-sm font-medium text-green-400 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  </svg>
                  {t('session.resume')}
                </button>
                <button
                  onClick={stopRecording}
                  className="flex-1 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-sm font-medium text-red-400 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                  </svg>
                  {t('session.end')}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={pauseRecording}
                  className="flex-1 py-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-sm font-medium text-amber-400 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {t('session.pause')}
                </button>
                <button
                  onClick={stopRecording}
                  className="flex-1 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-sm font-medium text-neutral-400 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                  </svg>
                  {t('session.end')}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Swipeable tabs content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <SwipeableTabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </div>
    </div>
  );
}
