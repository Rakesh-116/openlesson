"use client";

import { useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import { SwipeableTabs } from "./SwipeableTabs";
import { MobileProbesTab } from "./MobileProbesTab";
import { MobilePlanTab } from "./MobilePlanTab";
import { MobileWhiteboardCanvas } from "./MobileWhiteboardCanvas";
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
  addProbe,
  startSession,
  pauseSession,
  resumeSession,
  endSession,
  saveSession,
  saveWithDedupString,
} from "@/lib/storage";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";

interface MobileSessionViewProps {
  sessionId: string;
  initialSession?: Session | null;
  initialPlan?: SessionPlan | null;
}

const supportedLocales = ['en', 'vi', 'zh', 'es', 'de', 'pl'] as const;
type SupportedLocale = typeof supportedLocales[number];

const languageNames: Record<SupportedLocale, string> = {
  en: 'English',
  vi: 'Tiếng Việt',
  zh: '中文',
  es: 'Español',
  de: 'Deutsch',
  pl: 'Polski',
};

const tabIcons = [
  (
    <svg key="probes" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  (
    <svg key="plan" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  (
    <svg key="canvas" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
];

export function MobileSessionView({ 
  sessionId,
  initialSession,
  initialPlan,
}: MobileSessionViewProps) {
  const { t } = useI18n();
  const router = useRouter();
  
  // Session state
  const [session, setSession] = useState<Session | null>(initialSession ?? null);
  const [sessionPlan, setSessionPlan] = useState<SessionPlan | null>(initialPlan ?? null);
  const [probes, setProbes] = useState<Probe[]>(initialSession?.probes ?? []);
  
  // Preparation modal state
  // Active sessions that already have tutoringLanguage: skip modal
  // Paused sessions: always show modal to allow resume
  const [showWelcomeModal, setShowWelcomeModal] = useState(
    initialSession 
      ? initialSession.status === "paused" 
        ? true 
        : initialSession.status === "active" && initialSession.metadata?.tutoringLanguage 
          ? false 
          : true
      : true
  );
  const [languageConfirmed, setLanguageConfirmed] = useState(
    initialSession?.metadata?.tutoringLanguage && initialSession?.status !== "paused" ? true : false
  );
  const [tutoringLanguage, setTutoringLanguage] = useState<SupportedLocale>(
    (initialSession?.metadata?.tutoringLanguage as SupportedLocale) || 'en'
  );
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [isPreparing, setIsPreparing] = useState(false);
  const [planLoading, setPlanLoading] = useState(false);
  const [openingProbeLoading, setOpeningProbeLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  
  // Recording state - initialize from session status if provided
  const [isRecording, setIsRecording] = useState(
    initialSession ? initialSession.status === "active" || initialSession.status === "paused" : false
  );
  const [isPaused, setIsPaused] = useState(
    initialSession ? initialSession.status === "paused" : false
  );
  const [elapsedSeconds, setElapsedSeconds] = useState(
    initialSession?.durationMs ? Math.floor(initialSession.durationMs / 1000) : 0
  );
  const [micStatus, setMicStatus] = useState<"idle" | "checking" | "ready" | "denied">("idle");
  
  // UI state
  const [activeTab, setActiveTab] = useState(0);
  const [archivingProbeId, setArchivingProbeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!initialSession);
  const [whiteboardData, setWhiteboardData] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [storageBeat, setStorageBeat] = useState(0);
  const [analysisBeat, setAnalysisBeat] = useState(0);

  // Camera state
  const [cameraMode, setCameraMode] = useState<'closed' | 'open' | 'preview'>('closed');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [pendingWhiteboardImage, setPendingWhiteboardImage] = useState<string | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement>(null);

  // Refs
  const recorderRef = useRef<AudioRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerBaseRef = useRef<number>(0);
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
          // Sync recording state with session status
          setIsRecording(sessionData.status === "active" || sessionData.status === "paused");
          setIsPaused(sessionData.status === "paused");
          // Sync elapsed time from session duration
          setElapsedSeconds(sessionData.durationMs ? Math.floor(sessionData.durationMs / 1000) : 0);
          // Paused sessions: show modal to resume. Active sessions with language: skip modal.
          if (sessionData.status === "active" && sessionData.metadata?.tutoringLanguage) {
            setShowWelcomeModal(false);
          }
          // Otherwise keep showWelcomeModal true (default) to show the modal
          if (sessionData.metadata?.tutoringLanguage) {
            setLanguageConfirmed(true);
            setTutoringLanguage(sessionData.metadata.tutoringLanguage as SupportedLocale);
          }
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

  // Attach camera stream to video element when camera opens
  useEffect(() => {
    if (cameraMode === 'open' && cameraStreamRef.current && videoRef.current) {
      videoRef.current.srcObject = cameraStreamRef.current;
      videoRef.current.play().catch(err => {
        console.error("[Camera] Failed to play video:", err);
      });
    }
  }, [cameraMode]);

  // Start/stop timer based on recording state (and paused state)
  useEffect(() => {
    if (isRecording && !isPaused && !timerRef.current) {
      const baseMs = timerBaseRef.current || (session?.durationMs ?? Date.now());
      timerRef.current = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - baseMs) / 1000));
      }, 1000);
      
      setMicStatus("ready");
    }
    
    if ((!isRecording || isPaused) && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [isRecording, isPaused, session?.durationMs, session?.id]);

  // Sync durationMs to elapsedSeconds when loading a paused session
  useEffect(() => {
    if (session?.durationMs) {
      setElapsedSeconds(Math.floor(session.durationMs / 1000));
    }
  }, [session?.durationMs]);

  // Heartbeat effect - runs when recording and handles storage/analysis beats
  useEffect(() => {
    if (!isRecording || isPaused) {
      if (analysisRef.current) {
        clearInterval(analysisRef.current);
        analysisRef.current = null;
      }
      return;
    }

    // Start heartbeat interval
    analysisRef.current = setInterval(() => {
      const second = heartbeatSecondRef.current;
      
      // Storage heartbeat every 5s
      if (second % 5 === 0 && session) {
        try {
          if (recorderRef.current) {
            const audio = recorderRef.current.getRecentAudio(5000);
            if (audio && audio.size > 100) {
              const idx = chunkIndexRef.current++;
              console.log("[Mobile] Saving audio chunk", idx, "size=", audio.size);
              saveAudioChunk(session.id, audio, idx, Date.now())
                .then(savedPath => {
                  if (!savedPath) {
                    console.log("[Mobile] Audio chunk skipped (too small)");
                  }
                })
                .catch(err => {
                  console.error("[Mobile] Failed to save audio chunk:", err);
                });
            }
          }
          if (whiteboardDataRef.current) {
            const dataStr = whiteboardDataRef.current;
            console.log("[Mobile] Saving canvas data, fullSize:", dataStr.length);
            const whiteboardKey = `canvas_${session.id}`;
            saveWithDedupString(dataStr, whiteboardKey).then(whiteboardResult => {
              if (whiteboardResult.saved) {
                console.log("[Mobile] Canvas data changed, saving...");
                console.log("[Mobile] Canvas data START:", dataStr.substring(0, 100));
                console.log("[Mobile] Canvas data END:", dataStr.substring(dataStr.length - 100));
                logToolUsage(session.id, 'canvas', 'canvas_draw', Date.now(), { data: dataStr });
              } else {
                console.log("[Mobile] Canvas data unchanged, skipping");
              }
            });
          }
        } catch (err) {
          console.warn("[Mobile] Storage heartbeat error:", err);
        }
      }
      
      // Analysis heartbeat every 10s
      if (second % 10 === 0 && session) {
        const openProbes = session.probes.filter((p: Probe) => !p.archived);
        const focusedProbes = openProbes.filter((p: Probe) => p.focused).map((p: Probe) => ({ id: p.id, text: p.text }));
        fetch("/api/session-plan/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: session.id,
            previousProbes: session.probes.map((p: Probe) => p.text),
            focusedProbes,
            openProbeCount: openProbes.length,
            lastProbeTimestamp: 0,
          }),
        }).then(() => {
          return fetch("/api/transcribe-chunks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId: session.id }),
          });
        }).catch(err => {
          console.error("[Mobile] Analysis error:", err);
        });
      }
      
      // Update heartbeat indicators every second
      setStorageBeat(second % 5);
      setAnalysisBeat(second % 10);
      heartbeatSecondRef.current = (second + 1) % 10;
    }, 1000);

    return () => {
      if (analysisRef.current) {
        clearInterval(analysisRef.current);
        analysisRef.current = null;
      }
    };
  }, [isRecording, isPaused, session]);

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
      stream.getTracks().forEach(t => t.stop());
      setMicStatus("ready");
    } catch (err) {
      setMicStatus("denied");
      setError("Microphone access denied. Please allow microphone permission and try again.");
    }
  }, []);

  // Start session directly (checks mic first)
  const handleStartSession = useCallback(async () => {
    if (!session) return;
    
    setMicStatus("checking");
    setError(null);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        stream.getTracks().forEach(t => t.stop());
        setMicStatus("denied");
        setError("Could not access microphone. No audio track available. Please grant permission and try again.");
        return;
      }

      const track = audioTracks[0];
      if (track.readyState === 'ended') {
        stream.getTracks().forEach(t => t.stop());
        setMicStatus("denied");
        setError("Microphone permission denied. Please allow microphone access in your browser settings.");
        return;
      }

      chunkIndexRef.current = 0;

      const recorder = new AudioRecorder({
        chunkDurationMs: 60000,
        maxBufferDurationMs: 300000,
      });

      recorderRef.current = recorder;
      await recorder.start(stream);
      await startSession(session.id);
      timerBaseRef.current = Date.now();
      setIsRecording(true);
      setIsPaused(false);
      setMicStatus("ready");
      // Timer is handled by the effect based on isRecording/isPaused state

    } catch (err) {
      setMicStatus("denied");
      setError("Could not access microphone. Please grant permission and try again.");
    }
  }, [session]);

  // Prepare session with language selection
  const prepareSession = useCallback(async () => {
    if (!session || isPreparing) return;
    
    setIsPreparing(true);
    setPlanLoading(true);
    setOpeningProbeLoading(true);
    setPlanError(null);
    
    try {
      // Save language to session metadata
      const supabase = createClient();
      const { data: sessionData } = await supabase
        .from("sessions")
        .select("metadata")
        .eq("id", session.id)
        .single();
      if (sessionData?.metadata) {
        await supabase
          .from("sessions")
          .update({ metadata: { ...sessionData.metadata, tutoringLanguage } })
          .eq("id", session.id);
      }
      
      // Check if plan exists - if so, translate it; otherwise create new
      const existingPlan = await getSessionPlan(session.id);
      let newPlan = null;
      
      if (existingPlan && existingPlan.steps && existingPlan.steps.length > 0 && existingPlan.goal) {
        // Translate existing plan
        const translateRes = await fetch("/api/session-plan/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            sessionId: session.id, 
            tutoringLanguage,
            objectives: session.objectives,
          }),
        });
        if (translateRes.ok) {
          const { plan } = await translateRes.json();
          newPlan = plan;
        }
      }
      
      if (!newPlan) {
        // Create new plan with target language
        const planRes = await fetch("/api/session-plan/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            sessionId: session.id, 
            problem: session.problem, 
            objectives: session.objectives,
            planningPrompt: session.planningPrompt,
            force: true,
            tutoringLanguage,
          }),
        });
        if (planRes.ok) {
          const { plan } = await planRes.json();
          newPlan = plan;
        } else {
          const errorData = await planRes.json().catch(() => ({}));
          setPlanError(errorData.error || "Failed to create session plan");
        }
      }
      
      if (newPlan) {
        setSessionPlan(newPlan);
      }
      
      // Archive existing probes and generate new opening probe
      if (session.probes.length > 0) {
        for (const probe of session.probes) {
          await archiveProbe(probe.id);
        }
      }
      setSession({ ...session, probes: [] });
      setProbes([]);
      
      const probeRes = await fetch("/api/opening-probe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problem: session.problem, objectives: session.objectives, sessionId: session.id, tutoringLanguage }),
      });
      if (probeRes.ok) {
        const { probe: probeText } = await probeRes.json();
        if (probeText?.trim()) {
          const savedProbe = await addProbe(session.id, {
            timestamp: 0,
            gapScore: 0,
            signals: ["opening"],
            text: probeText,
            requestType: "question",
          });
          setSession(prev => prev ? { ...prev, probes: [savedProbe] } : null);
          setProbes([savedProbe]);
        }
      }
      
      // Mark language as confirmed
      setLanguageConfirmed(true);
    } catch (err) {
      console.error("Failed to prepare session:", err);
      setPlanError("Failed to prepare session");
    } finally {
      setPlanLoading(false);
      setOpeningProbeLoading(false);
      setIsPreparing(false);
    }
  }, [session, tutoringLanguage, isPreparing]);

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
      await startSession(session.id);
      timerBaseRef.current = Date.now();
      setIsRecording(true);
      setIsPaused(false);
      // Timer is handled by the effect based on isRecording/isPaused state

      // Dual heartbeat: storage every 5s, analysis every 10s
      analysisRef.current = setInterval(async () => {
        const second = heartbeatSecondRef.current;
        const currentSession = session;
        const recorder = recorderRef.current;
        
        if (second % 5 === 0 && currentSession) {
          // Storage heartbeat - save audio and whiteboard
          try {
            // Save audio chunks from recorder buffer
            if (recorder) {
              const recentAudio = recorder.getRecentAudio(5000);
              if (recentAudio && recentAudio.size > 100) {
                const idx = chunkIndexRef.current++;
                await saveAudioChunk(currentSession.id, recentAudio, idx, Date.now());
                // Note: null return means audio was too small, skip silently
              }
            }
            
            // Save whiteboard data (with deduplication)
            if (whiteboardDataRef.current) {
              const whiteboardKey = `canvas_${currentSession.id}`;
              const whiteboardResult = await saveWithDedupString(whiteboardDataRef.current, whiteboardKey);
              if (whiteboardResult.saved) {
                await logToolUsage(currentSession.id, 'canvas', 'canvas_draw', Date.now(), { data: whiteboardDataRef.current });
              }
            }
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
            // Transcribe missing audio chunks
            await fetch("/api/transcribe-chunks", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sessionId: currentSession.id }),
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

  // Stop recording and end session
  const stopRecording = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (analysisRef.current) clearInterval(analysisRef.current);
    
    await recorderRef.current?.stop();
    recorderRef.current = null;
    
    setIsRecording(false);
    setIsPaused(false);
    setIsSaving(true);
    
    if (!session) return;
    
    const finalSession = endSession(session, elapsedSeconds * 1000);
    finalSession.hasAudio = true;
    finalSession.metadata = {
      ...finalSession.metadata,
      whiteboardData: whiteboardData || undefined,
    };
    
    await saveSession(finalSession);
    
    router.push(`/results?id=${finalSession.id}`);
  }, [session, elapsedSeconds, router]);

  // Pause recording
  const pauseRecording = useCallback(async () => {
    if (!session) return;
    recorderRef.current?.pause();
    setIsPaused(true);
    timerBaseRef.current = Date.now() - elapsedSeconds * 1000;
    await pauseSession(session.id);
  }, [session, elapsedSeconds]);

  // Resume recording
  const resumeRecording = useCallback(async () => {
    if (!session) return;

    if (recorderRef.current) {
      timerBaseRef.current = Date.now() - elapsedSeconds * 1000;
      recorderRef.current.resume();
      setIsPaused(false);
      await resumeSession(session.id);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        stream.getTracks().forEach(t => t.stop());
        setMicStatus("denied");
        setError("Could not access microphone. Please grant permission and try again.");
        return;
      }

      const recorder = new AudioRecorder({
        chunkDurationMs: 60000,
        maxBufferDurationMs: 300000,
      });

      recorderRef.current = recorder;
      await recorder.start(stream);
      setIsPaused(false);
      setIsRecording(true);
      timerBaseRef.current = Date.now() - elapsedSeconds * 1000;
      await resumeSession(session.id);
    } catch (err) {
      setMicStatus("denied");
      setError("Could not access microphone. Please grant permission and try again.");
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

  // Camera functions
  const openCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      cameraStreamRef.current = stream;
      setCameraMode('open');
    } catch (err) {
      console.error("Camera access failed:", err);
    }
  }, []);

  const closeCamera = useCallback(() => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    cameraStreamRef.current = null;
    setCapturedImage(null);
    setCameraMode('closed');
  }, []);

  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    const canvas = captureCanvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setCapturedImage(dataUrl);
    setCameraMode('preview');
  }, []);

  const confirmCapture = useCallback(() => {
    if (!capturedImage) return;
    setPendingWhiteboardImage(capturedImage);
    closeCamera();
  }, [capturedImage, closeCamera]);

  const retakePhoto = useCallback(() => {
    setCapturedImage(null);
    setCameraMode('open');
  }, []);

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

  // Welcome/Preparation Modal
  if (showWelcomeModal) {
    const isSessionReady = sessionPlan && !planLoading && !openingProbeLoading && probes.length > 0;
    const isButtonDisabled = planLoading || isPreparing;
    
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="w-14 h-14 flex items-center justify-center mb-6 mx-auto">
            <img 
              src="/op_logo.jpg" 
              alt="Logo" 
              className="w-full h-full object-contain"
            />
          </div>
          
          <h1 className="text-xl font-semibold text-white text-center mb-2">
            {t('session.welcomeTitle')}
          </h1>
          <p className="text-neutral-400 text-sm text-center mb-6">
            {t('session.welcomeMessage')}
          </p>
          
          {/* Step indicators */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              languageConfirmed ? 'bg-cyan-500 text-black' : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
            }`}>
              1
            </div>
            <div className={`w-12 h-0.5 ${languageConfirmed ? 'bg-cyan-500' : 'bg-neutral-700'}`} />
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              languageConfirmed && isSessionReady ? 'bg-cyan-500 text-black' : 
              languageConfirmed ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' :
              'bg-neutral-800 text-white border border-neutral-700'
            }`}>
              2
            </div>
          </div>
          
          {planError && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
              <p className="text-xs text-red-400">{planError}</p>
            </div>
          )}
          
          {/* Phase 1: Language selection */}
          {!languageConfirmed && (
            <>
              <div className="mb-4">
                <label className="block text-xs text-neutral-400 mb-2">
                  Tutor language
                </label>
                <select
                  value={tutoringLanguage}
                  onChange={(e) => {
                    setTutoringLanguage(e.target.value as SupportedLocale);
                  }}
                  disabled={isButtonDisabled}
                  className="w-full px-3 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white text-sm focus:outline-none focus:border-neutral-500 disabled:opacity-50"
                >
                  {supportedLocales.map((loc) => (
                    <option key={loc} value={loc}>
                      {languageNames[loc]}
                    </option>
                  ))}
                </select>
              </div>

              <div className={`mb-5 p-3.5 rounded-xl border transition-all ${autoAdvance ? 'bg-cyan-500/5 border-cyan-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative shrink-0">
                    <input
                      type="checkbox"
                      checked={autoAdvance}
                      onChange={(e) => setAutoAdvance(e.target.checked)}
                      className="sr-only"
                    />
                    <div className={`w-11 h-6 rounded-full transition-colors ${autoAdvance ? 'bg-cyan-500' : 'bg-amber-500'}`}>
                      <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${autoAdvance ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium leading-tight">
                      <span className={autoAdvance ? 'text-cyan-400' : 'text-amber-400'}>
                        {autoAdvance ? 'Auto-advance ON' : 'Manual mode'}
                      </span>
                    </span>
                    <span className="text-xs text-neutral-500 leading-tight mt-0.5">
                      {autoAdvance 
                        ? 'AI decides when to move forward' 
                        : 'You click to advance — AI analyzes but you decide'}
                    </span>
                  </div>
                </label>
              </div>
              
              <button
                onClick={prepareSession}
                disabled={isButtonDisabled}
                className="w-full py-3.5 px-4 font-medium rounded-xl transition-colors bg-cyan-500 hover:bg-cyan-400 text-black disabled:bg-neutral-700 disabled:text-neutral-500"
              >
                {isButtonDisabled ? 'Preparing...' : 'Confirm Language'}
              </button>
            </>
          )}
          
          {/* Phase 2: Preparation or Ready */}
          {languageConfirmed && (
            <>
              {!isSessionReady && (
                <div className="flex items-center gap-3 mb-4 p-3 bg-neutral-800/50 rounded-xl">
                  <div className="w-5 h-5 border-2 border-neutral-600 border-t-white rounded-full animate-spin" />
                  <span className="text-sm text-neutral-400">{t('session.preparing')}</span>
                </div>
              )}
              
              <button
                onClick={() => setShowWelcomeModal(false)}
                disabled={!isSessionReady}
                className={`w-full py-3.5 px-4 font-medium rounded-xl transition-colors ${
                  !isSessionReady
                    ? 'bg-neutral-700 text-neutral-500 cursor-not-allowed'
                    : 'bg-white hover:bg-neutral-100 text-neutral-900'
                }`}
              >
                {!isSessionReady ? t('session.pleaseWait') : t('session.getStarted')}
              </button>
            </>
          )}
        </div>
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
          autoAdvance={autoAdvance}
          onToggleAutoAdvance={setAutoAdvance}
          sessionId={session?.id}
        />
      ),
    },
    {
      id: "canvas",
      label: t('tools.canvas'),
      content: (
        <div className="h-full relative">
          <MobileWhiteboardCanvas
            initialData={whiteboardData || undefined}
            pendingImage={pendingWhiteboardImage}
            onPendingImageUsed={() => setPendingWhiteboardImage(null)}
            onCanvasChange={(dataUrl: string) => {
              console.log("[Mobile] Canvas changed, size:", dataUrl.length);
              whiteboardDataRef.current = dataUrl;
              setWhiteboardData(dataUrl);
            }}
            onOpenCamera={openCamera}
          />
        </div>
      ),
    },
  ];

  return (
    <div 
      className="h-dvh bg-[#0a0a0a] flex flex-col overflow-hidden"
      style={{ 
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* Compact Header */}
      <header className="shrink-0 px-3 py-2 border-b border-neutral-800/80 bg-[#0a0a0a]">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {isRecording && !isPaused ? (
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
            ) : isPaused ? (
              <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
            ) : (
              <div className="w-2 h-2 rounded-full bg-neutral-600 shrink-0" />
            )}
            <span className="text-xs font-medium text-neutral-400">
              {isRecording && !isPaused ? t('session.recording') : isPaused ? t('session.paused') : t('session.session')}
            </span>
            
            {/* Heartbeat indicators */}
            {isRecording && (
              <div className="flex items-center gap-1.5 ml-2">
                {/* Storage heartbeat */}
                <div className="flex items-center gap-0.5">
                  <span className="text-[8px] text-cyan-500/60 uppercase">S</span>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div
                      key={`storage-${i}`}
                      className={`w-1 h-1 rounded-sm transition-colors ${
                        i <= storageBeat ? "bg-cyan-500" : "bg-neutral-700"
                      }`}
                    />
                  ))}
                </div>
                {/* Analysis heartbeat */}
                <div className="flex items-center gap-0.5">
                  <span className="text-[8px] text-purple-500/60 uppercase">A</span>
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                    <div
                      key={`analysis-${i}`}
                      className={`w-1 h-1 rounded-sm transition-colors ${
                        i <= analysisBeat ? "bg-purple-500" : "bg-neutral-700"
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {(isRecording || elapsedSeconds > 0) && (
              <div className="px-2 py-1 bg-neutral-900 border border-neutral-800 rounded-md">
                <span className="text-xs font-mono text-white tabular-nums">
                  {formatTime(elapsedSeconds)}
                </span>
              </div>
            )}
            <button
              onClick={() => router.push('/dashboard')}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-neutral-500 hover:text-white hover:bg-neutral-800 transition-colors"
              title="Close"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Compact Recording Controls */}
        <div className="mt-2">
          {error && (
            <div className="mb-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-[10px] text-red-400">{error}</p>
            </div>
          )}

          {micStatus === "idle" && !isRecording && (
            <button
              onClick={handleStartSession}
              className="w-full py-2 px-3 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl text-xs font-medium text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-lg shadow-cyan-500/20"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              {t('session.startSession')}
            </button>
          )}

          {micStatus === "checking" && (
            <div className="w-full py-2 px-3 bg-neutral-800 border border-neutral-700 rounded-xl flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-neutral-600 border-t-cyan-500 rounded-full animate-spin" />
              <span className="text-xs text-neutral-400">{t('session.checkingMic')}</span>
            </div>
          )}

          {micStatus === "denied" && (
            <button
              onClick={checkMicrophone}
              className="w-full py-2 px-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs font-medium text-red-400 flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
                    className="flex-1 py-2 px-3 bg-green-500/10 border border-green-500/30 rounded-xl text-xs font-medium text-green-400 flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    </svg>
                    {t('session.resume')}
                  </button>
                  <button
                    onClick={() => setShowEndConfirm(true)}
                    className="flex-1 py-2 px-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs font-medium text-red-400 flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
                    className="flex-1 py-2 px-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs font-medium text-amber-400 flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {t('session.pause')}
                  </button>
                  <button
                    onClick={() => setShowEndConfirm(true)}
                    className="flex-1 py-2 px-3 bg-neutral-800 border border-neutral-700 rounded-xl text-xs font-medium text-neutral-400 flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                    </svg>
                    {t('session.end')}
                  </button>
                </>
              )}
            </div>
          )}

          {isSaving && (
            <div className="flex items-center justify-center gap-2 py-2">
              <div className="w-4 h-4 border-2 border-neutral-600 border-t-cyan-500 rounded-full animate-spin" />
              <span className="text-xs text-neutral-400">Saving session...</span>
            </div>
          )}
        </div>
      </header>

      {/* End Session Confirmation Modal */}
      {showEndConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 max-w-sm w-full">
            <h3 className="text-sm font-semibold text-white mb-2">End Session?</h3>
            <p className="text-neutral-400 mb-4 text-xs leading-relaxed">
              Are you sure you want to end this session? Your session data will be saved and you'll be taken to the results page.
            </p>
            <div className="flex gap-2">
              <button 
                onClick={() => setShowEndConfirm(false)} 
                className="flex-1 py-2 text-xs text-neutral-400 border border-neutral-700 hover:border-neutral-500 rounded-lg transition-colors"
              >
                {t('common.keepGoing')}
              </button>
              <button 
                onClick={stopRecording} 
                className="flex-1 py-2 text-xs text-white bg-white/10 hover:bg-white/15 rounded-lg transition-colors"
              >
                {t('sessionEnd.endSession')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Camera Overlay - Full screen, outside tab content */}
      {cameraMode !== 'closed' && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <div className="shrink-0 flex items-center justify-between px-4 py-4">
            <button
              onClick={closeCamera}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white active:bg-white/20"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <button
              onClick={() => setFlashEnabled(!flashEnabled)}
              className={`w-10 h-10 flex items-center justify-center rounded-full ${
                flashEnabled ? "bg-cyan-500 text-black" : "bg-white/10 text-white"
              }`}
            >
              <svg className="w-6 h-6" fill={flashEnabled ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center relative overflow-hidden">
            {cameraMode === 'open' && cameraStreamRef.current && (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            )}
            
            {cameraMode === 'preview' && capturedImage && (
              <img
                src={capturedImage}
                alt="Captured"
                className="max-w-full max-h-full object-contain"
              />
            )}
            
            <canvas ref={captureCanvasRef} className="hidden" />
          </div>

          <div className="shrink-0 px-6 py-8">
            {cameraMode === 'open' && (
              <div className="flex items-center justify-center">
                <button
                  onClick={capturePhoto}
                  className="w-20 h-20 rounded-full bg-white flex items-center justify-center active:scale-95"
                >
                  <div className="w-16 h-16 rounded-full border-4 border-neutral-900" />
                </button>
              </div>
            )}
            
            {cameraMode === 'preview' && (
              <div className="flex gap-3">
                <button
                  onClick={retakePhoto}
                  className="flex-1 py-4 bg-white/10 text-white font-medium rounded-2xl flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Retake
                </button>
                <button
                  onClick={confirmCapture}
                  className="flex-1 py-4 bg-cyan-500 text-black font-medium rounded-2xl flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Use Photo
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content - Swipeable */}
      <div className="flex-1 min-h-0 relative overflow-hidden">
        <SwipeableTabContent
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </div>

      {/* Bottom Tab Bar */}
      <div
        className="shrink-0 py-1.5 px-4 bg-neutral-900 border-t border-neutral-800"
        style={{ paddingBottom: "max(6px, env(safe-area-inset-bottom))" }}
      >
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-around">
            {tabs.map((tab, index) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(index)}
                className={`flex items-center gap-1 px-4 py-1 rounded-lg transition-all ${
                  activeTab === index
                    ? "text-cyan-400"
                    : "text-neutral-500"
                }`}
              >
                {tabIcons[index]}
                <span className="text-[10px] font-medium">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

interface SwipeableTabContentProps {
  tabs: { id: string; label: string; content: React.ReactNode }[];
  activeTab: number;
  onTabChange: (index: number) => void;
}

function SwipeableTabContent({ tabs, activeTab, onTabChange }: SwipeableTabContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const touchCurrentRef = useRef<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isFirstMove, setIsFirstMove] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };
      touchCurrentRef.current = touch.clientX;
      setIsDragging(true);
      setIsFirstMove(true);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!touchStartRef.current) return;

      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = touch.clientY - touchStartRef.current.y;

      if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10) {
        touchStartRef.current = null;
        setIsDragging(false);
        setDragOffset(0);
        return;
      }

      if (isFirstMove && Math.abs(deltaX) > 10) {
        e.preventDefault();
        setIsFirstMove(false);
      }

      touchCurrentRef.current = touch.clientX;
      
      let offset = deltaX;
      if ((activeTab === 0 && deltaX > 0) || (activeTab === tabs.length - 1 && deltaX < 0)) {
        offset = deltaX * 0.3;
      }
      
      setDragOffset(offset);
    };

    const handleTouchEnd = () => {
      if (!touchStartRef.current) {
        setIsDragging(false);
        setDragOffset(0);
        return;
      }

      const deltaX = touchCurrentRef.current - touchStartRef.current.x;
      const deltaTime = Date.now() - touchStartRef.current.time;
      const velocity = Math.abs(deltaX) / deltaTime;

      const containerWidth = containerRef.current?.offsetWidth || 300;
      const threshold = containerWidth * 0.2;
      const velocityThreshold = 0.3;

      let newTab = activeTab;

      if (Math.abs(deltaX) > threshold || velocity > velocityThreshold) {
        if (deltaX < 0 && activeTab < tabs.length - 1) {
          newTab = activeTab + 1;
        } else if (deltaX > 0 && activeTab > 0) {
          newTab = activeTab - 1;
        }
      }

      onTabChange(newTab);
      touchStartRef.current = null;
      setIsDragging(false);
      setDragOffset(0);
      setIsFirstMove(false);
    };

    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [activeTab, onTabChange, tabs.length, isFirstMove]);

  const getContentTransform = () => {
    const stepPercent = 100 / tabs.length;
    const baseOffset = -activeTab * stepPercent;
    if (isDragging && containerRef.current) {
      const containerWidth = containerRef.current.offsetWidth;
      const dragPercent = (dragOffset / containerWidth) * stepPercent;
      return `translateX(calc(${baseOffset}% + ${dragPercent}%))`;
    }
    return `translateX(${baseOffset}%)`;
  };

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden"
    >
      <div
        className="absolute top-0 bottom-0 left-0 flex"
        style={{
          transform: getContentTransform(),
          transition: isDragging ? "none" : "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          width: `${tabs.length * 100}%`,
        }}
      >
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className="h-full overflow-hidden"
            style={{ width: `${100 / tabs.length}%` }}
          >
            {tab.content}
          </div>
        ))}
      </div>
    </div>
  );
}
