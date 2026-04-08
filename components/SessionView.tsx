"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { AudioRecorder } from "@/lib/audio";
import { FacialDataPoint } from "./FaceTracker";
import {
  getSession,
  addProbe,
  addProbeToSession,
  endSession,
  saveSession,
  saveSessionAudio,
  saveSessionEEG,
  saveFacialData,
  saveAudioChunk,
  toggleProbeStarred,
  updateProbeRevealed,
  pauseSession,
  resumeSession,
  updateSessionStatus,
  logToolUsage,
  getSessionPlan,
  archiveProbe,
  toggleProbeFocused,
  resetSessionProbes,
  saveWithDedupString,
  saveWithDedupBlob,
  type Session,
  type SessionPlan,
  type Probe,
  type ObserverMode,
  type Frequency,
  type ToolName,
  type ToolAction,
  type RequestType,
} from "@/lib/storage";
import { playArchiveSound, playStepCompleteSound, playSessionCompleteSound } from "@/lib/sounds";
import { formatTime } from "@/lib/utils";
import { AudioVisualizer, RecordingIndicator } from "./AudioVisualizer";
import { ActiveProbe } from "./ActiveProbe";
import { ProbeNotifications } from "./ProbeNotifications";
import { ResizablePane } from "./ResizablePane";
import { WhiteboardCanvas } from "./WhiteboardCanvas";
import { ToolsPanel, type Tool } from "./ToolsPanel";
import { ToolsHelp } from "./ToolsHelp";
import { LLMChat, type ChatMessage } from "./LLMChat";
import { DataInputTool } from "./DataInputTool";
import { LogsTool, type LogEntry } from "./LogsTool";
import { createScreenCapture } from "@/lib/screen-capture";
import { saveScreenshot, updateSessionPlan } from "@/lib/storage";
import { LocalInferenceManager, type InitProgress, type LocalAnalysisContext } from "@/lib/local-inference";
import { LocalContextBuffer } from "@/lib/local-context";
// ModelLoadingModal no longer used -- loading UI is inline in welcome modal

import { PopOutBanner } from "./PopOutBanner";
import { 
  useSessionSync, 
  openPopOutWindow, 
  type SessionAction 
} from "@/lib/broadcast-sync";
import { useI18n } from "@/lib/i18n";
import { tutoringLocales, tutoringLanguageNames } from "@/lib/tutoring-languages";


// Configuration
const STORAGE_INTERVAL_MS = 5000;
const ANALYSIS_INTERVAL_MS = 10000;

export function SessionView({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const { t, locale, supportedLocales } = useI18n();
  const [session, setSession] = useState<Session | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tutoringLanguage, setTutoringLanguage] = useState(locale);
  const [autoAdvance, setAutoAdvance] = useState(true);

  // Mic check
  const [micStatus, setMicStatus] = useState<"idle" | "checking" | "ready" | "denied">("idle");
  const micStreamRef = useRef<MediaStream | null>(null);

  // Observer controls
  const [observerMode, setObserverMode] = useState<ObserverMode>("active");
  const [frequency, setFrequency] = useState<Frequency>("balanced");
  const [isMuted, setIsMuted] = useState(false);
  const [muteRemaining, setMuteRemaining] = useState(0);

  // Probes
  const [activeProbe, setActiveProbe] = useState<Probe | null>(null);
  const [viewingProbeIndex, setViewingProbeIndex] = useState<number>(-1);
  const [openingProbeLoading, setOpeningProbeLoading] = useState(false);

  // Session ending / saving
  const [isSaving, setIsSaving] = useState(false);

  // Tutor-end dialog
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [endReason, setEndReason] = useState("");

  // RAG / Calibration (session prep)
  const [calibrationLoading, setCalibrationLoading] = useState(false);
  const [calibrationAttempted, setCalibrationAttempted] = useState(false);
  const [ragChunks, setRagChunks] = useState<Array<{
    id: string;
    content: string;
    similarity: number;
    createdAt: string;
    topic?: string;
  }>>([]);
  const [selectedChunks, setSelectedChunks] = useState<Set<string>>(new Set());
  const [showRagChunks, setShowRagChunks] = useState(false);

  // Prep material cards
  const [prepCards, setPrepCards] = useState<Array<{ id: string; title: string; content: string }>>([]);
  const [prepLoading, setPrepLoading] = useState<string | null>(null);

  // Whiteboard
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [whiteboardData, setWhiteboardData] = useState<string | null>(null);

  // Notebook
  const [showNotebook, setShowNotebook] = useState(false);
  const [notebookContent, setNotebookContent] = useState("");



  // Teaching Assistant Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [pendingChatMessage, setPendingChatMessage] = useState<string | null>(null);

  // New 3-panel layout state
  const [activeTool, setActiveTool] = useState<Tool>("chat");
  const prevToolRef = useRef<Tool | null>(null);
  const [objectives, setObjectives] = useState<string[]>([]);
  const [objectiveStatuses, setObjectiveStatuses] = useState<("red" | "yellow" | "green" | "blue")[]>([]);

  // Archive/Focus probe state
  const [archivingProbeId, setArchivingProbeId] = useState<string | null>(null);
  
  // Celebration state for step completion
  const [isCelebrating, setIsCelebrating] = useState(false);
  
  // Plan complete modal (shown when all steps are done)
  const [showPlanCompleteModal, setShowPlanCompleteModal] = useState(false);

  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768 || /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Error tracking for recording pipeline
  const [pipelineErrors, setPipelineErrors] = useState<{
    analysis?: string;
    transcription?: string;
    storage?: string;
  }>({});

  // Local inference
  const [localInferenceEnabled, setLocalInferenceEnabled] = useState(false);
  const localInferenceEnabledRef = useRef(false);
  const localContextRef = useRef<LocalContextBuffer | null>(null);
  const [modelLoadProgress, setModelLoadProgress] = useState<InitProgress | null>(null);
  const [modelLoadError, setModelLoadError] = useState<string | null>(null);
  const [webGPUAvailable, setWebGPUAvailable] = useState(false);
  const [isGeneratingProbe, setIsGeneratingProbe] = useState(false);

  // Combined session prep modal (plan + optional model loading)
  const [prepStage, setPrepStage] = useState<"plan" | "model" | "done">("plan");

  // Detect WebGPU on mount
  useEffect(() => {
    setWebGPUAvailable(LocalInferenceManager.isWebGPUAvailable());
  }, []);

  // Welcome modal
  const [showWelcomeModal, setShowWelcomeModal] = useState(true);

  // Block ILE tools when not actively monitoring
  const shouldBlockTools = session && !showWelcomeModal && (!isRecording || isPaused);

  // Mobile detection


  // Session Plan state
  const [sessionPlan, setSessionPlan] = useState<SessionPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const sessionPlanRef = useRef<SessionPlan | null>(null);
  const [languageConfirmed, setLanguageConfirmed] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);

  // Prep material for tools
  const [prepToolContent, setPrepToolContent] = useState<{ title: string; content: string } | null>(null);
  const [prepToolLoading, setPrepToolLoading] = useState(false);
  const [showGrokipediaOnly, setShowGrokipediaOnly] = useState(false);

  // Pop-out window state
  const [isPopOutActive, setIsPopOutActive] = useState(false);
  const popOutWindowRef = useRef<Window | null>(null);
  const popOutDismissedRef = useRef<boolean>(false); // Track if user explicitly dismissed

  // RAG matching state (extended)
  const [ragLoading, setRagLoading] = useState(false);
  const [ragModifier, setRagModifier] = useState("");
  const [ragSelectedChunks, setRagSelectedChunks] = useState<Set<string>>(new Set());
  const [ragExpandedChunks, setRagExpandedChunks] = useState<Set<string>>(new Set());
  const [ragHasNotification, setRagHasNotification] = useState(false);

  const runRagMatching = async (modifier?: string) => {
    if (!session?.problem || !session?.id) return;
    setRagLoading(true);
    try {
      const params = new URLSearchParams({
        query: modifier ? `${session.problem} ${modifier}` : session.problem,
        sessionId: session.id,
      });
      const response = await fetch(`/api/rag-match?${params}`);
      if (response.ok) {
        const data = await response.json();
        setRagChunks(data.chunks || []);
        // Auto-select chunks with > 50% similarity
        const selected = new Set<string>();
        data.chunks?.forEach((c: { id: string; similarity: number }) => {
          if (c.similarity > 0.5) selected.add(c.id);
        });
        setRagSelectedChunks(selected);
        // Show notification if we have 3 or more matches
        setRagHasNotification((data.chunks?.length || 0) >= 3);
      }
    } catch (err) {
      console.error("RAG matching error:", err);
    } finally {
      setRagLoading(false);
    }
  };

  // Run RAG matching when tool is opened for the first time
  useEffect(() => {
    if (activeTool === "rag" && ragChunks.length === 0 && !ragLoading) {
      runRagMatching();
    }
  }, [activeTool]);

  // Track tool open/close events
  useEffect(() => {
    if (!session?.id || !activeTool) return;
    
    const prevTool = prevToolRef.current;
    const elapsedTime = session.startedAt 
      ? Date.now() - new Date(session.startedAt).getTime() 
      : 0;

    if (prevTool && prevTool !== activeTool) {
      logToolUsage(session.id, prevTool as ToolName, "close", elapsedTime, {});
    }
    logToolUsage(session.id, activeTool as ToolName, "open", elapsedTime, {});
    // Feed tool events into local context buffer
    if (localInferenceEnabledRef.current && localContextRef.current) {
      localContextRef.current.addToolEvent(`opened ${activeTool}`);
    }
    
    prevToolRef.current = activeTool;
  }, [activeTool, session?.id, session?.startedAt]);

  const loadPrepToolContent = async (type: string, stepContext?: string) => {
    if (!session?.problem) return;
    if (type === "grokipedia") {
      setShowGrokipediaOnly(true);
      setPrepToolContent(null);
      return;
    }
    setShowGrokipediaOnly(false);
    setPrepToolLoading(true);
    try {
      let url = `/api/prep-material?topic=${encodeURIComponent(session.problem)}&type=${type}`;
      if (stepContext) {
        url += `&step=${encodeURIComponent(stepContext)}`;
      }
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setPrepToolContent(data);
      }
    } catch (err) {
      console.error("Prep material error:", err);
    } finally {
      setPrepToolLoading(false);
    }
  };

  // Step action handlers — Resources, Practice, Ask Assistant
  const handleStepResources = (stepDescription: string) => {
    setActiveTool("reading");
    setPrepToolContent(null);
    loadPrepToolContent("reading", stepDescription);
  };

  const handleStepPractice = (stepDescription: string) => {
    setActiveTool("exercise");
    setPrepToolContent(null);
    loadPrepToolContent("exercise", stepDescription);
  };

  const handleStepAskAssistant = (stepDescription: string) => {
    setActiveTool("chat");
    setPendingChatMessage(`Help me understand and work through this step: "${stepDescription}"`);
  };

  // Muse EEG
  const [museStatus, setMuseStatus] = useState<"disconnected" | "connecting" | "connected" | "streaming">("disconnected");
  const [museError, setMuseError] = useState<string | null>(null);
  const [eegChannelData, setEegChannelData] = useState<Map<string, number[]>>(new Map());
  const [bandPowers, setBandPowers] = useState<{ delta: number; theta: number; alpha: number; beta: number; gamma: number } | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const museClientRef = useRef<any>(null);
  const eegIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const bandIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const eegBufferRef = useRef<Map<string, number[]>>(new Map());

  // Webcam
  const [isWebcamEnabled, setIsWebcamEnabled] = useState(false);
  const [webcamError, setWebcamError] = useState<string | null>(null);
  const [latestFacialData, setLatestFacialData] = useState<FacialDataPoint | null>(null);

  // Facial Data Tracking
  const [facialDataBuffer, setFacialDataBuffer] = useState<FacialDataPoint[]>([]);
  const facialBufferRef = useRef<FacialDataPoint[]>([]);

  // Logs
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logsRef = useRef<LogEntry[]>([]);

  // Data transfer health tracking
  const [transferHealth, setTransferHealth] = useState<{
    audio: { sent: number; saved: number; failed: number };
    eeg: { sent: number; saved: number; failed: number };
    facial: { sent: number; saved: number; failed: number };
  }>({ audio: { sent: 0, saved: 0, failed: 0 }, eeg: { sent: 0, saved: 0, failed: 0 }, facial: { sent: 0, saved: 0, failed: 0 } });

  // Refs for interval callbacks
  const recorderRef = useRef<AudioRecorder | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatSecondRef = useRef(0);
  const lastProbeTimeRef = useRef(0);
  const isAnalyzingRef = useRef(false);
  const muteTimerRef = useRef<NodeJS.Timeout | null>(null);
  const probeContainerRef = useRef<HTMLDivElement | null>(null);
  const chunkIndexRef = useRef(0);
  const eegChunkIndexRef = useRef(0);
  const facialChunkIndexRef = useRef(0);
  const transferHealthRef = useRef({ audio: { sent: 0, saved: 0, failed: 0 }, eeg: { sent: 0, saved: 0, failed: 0 }, facial: { sent: 0, saved: 0, failed: 0 } });
  const observerModeRef = useRef(observerMode);
  const frequencyRef = useRef(frequency);
  const isMutedRef = useRef(isMuted);
  const whiteboardDataRef = useRef(whiteboardData);
  const notebookContentRef = useRef(notebookContent);
  const activeToolRef = useRef(activeTool);
  const objectivesRef = useRef(objectives);
  const isRecordingRef = useRef(isRecording);
  const autoAdvanceRef = useRef(autoAdvance);
  const museStatusRef = useRef(museStatus);
  const isWebcamEnabledRef = useRef(isWebcamEnabled);

  // Heartbeat state for UI display
  const [storageBeat, setStorageBeat] = useState(0);
  const [analysisBeat, setAnalysisBeat] = useState(0);

  // Screen capture
  const screenCaptureRef = useRef<{ captureNow: () => Promise<Blob | null>; start: () => Promise<boolean>; stop: () => void; isCapturing: () => boolean; getStream: () => MediaStream | null } | null>(null);
  const [isScreenCapturing, setIsScreenCapturing] = useState(false);
  const [screenshotCount, setScreenshotCount] = useState(0);

  // Pause/Resume state tracking
  const wasRecordingRef = useRef(false);
  const wasScreenCapturingRef = useRef(false);
  const wasWebcamEnabledRef = useRef(false);
  const wasMuseStreamingRef = useRef(false);
  const pausedAudioStreamRef = useRef<MediaStream | null>(null);
  const pausedScreenStreamRef = useRef<MediaStream | null>(null);
  const pausedWebcamStreamRef = useRef<MediaStream | null>(null);

  const handleFacialData = useCallback((data: FacialDataPoint) => {
    setLatestFacialData(data);
    facialBufferRef.current.push(data);
    if (facialBufferRef.current.length > 120) {
      facialBufferRef.current = facialBufferRef.current.slice(-120);
    }
    // Feed into local context buffer if local inference is active
    if (localInferenceEnabledRef.current && localContextRef.current) {
      localContextRef.current.addFacialData({
        confusionScore: data.confusionScore ?? 0,
        frustrationScore: data.frustrationScore ?? 0,
        emotion: data.emotion === "confused" ? 0.8 : data.emotion === "frustrated" ? 0.7 : 0.2,
        attention: data.attentionLevel === "high" ? 0.9 : data.attentionLevel === "medium" ? 0.5 : 0.2,
      });
    }
  }, []);

  const handleFaceError = useCallback((error: string) => {
    setWebcamError(error);
    const entry: LogEntry = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      level: "error",
      message: error,
      source: "Face Tracker"
    };
    logsRef.current.push(entry);
    setLogs(prev => [...prev, entry]);
  }, []);

  // Keep refs in sync
  useEffect(() => { observerModeRef.current = observerMode; }, [observerMode]);
  useEffect(() => { frequencyRef.current = frequency; }, [frequency]);
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
  useEffect(() => { whiteboardDataRef.current = whiteboardData; }, [whiteboardData]);
  useEffect(() => { notebookContentRef.current = notebookContent; }, [notebookContent]);
  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);
  useEffect(() => { objectivesRef.current = objectives; }, [objectives]);
  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);
  useEffect(() => { autoAdvanceRef.current = autoAdvance; }, [autoAdvance]);
  useEffect(() => { localInferenceEnabledRef.current = localInferenceEnabled; }, [localInferenceEnabled]);
  useEffect(() => { museStatusRef.current = museStatus; }, [museStatus]);
  useEffect(() => { isWebcamEnabledRef.current = isWebcamEnabled; }, [isWebcamEnabled]);
  useEffect(() => { sessionPlanRef.current = sessionPlan; }, [sessionPlan]);

  // Ref for action handlers (populated later, used for pop-out communication)
  const actionHandlersRef = useRef<{
    startRecording?: () => void;
    stopRecording?: () => void;
    handlePause?: () => void;
    handleResume?: () => void;
    handleReset?: () => void;
    handleClose?: () => void;
    handleArchiveProbe?: (probeId: string) => Promise<void>;
    handleToggleFocus?: (probeId: string, focused: boolean) => void;
    handleAdvanceStep?: () => Promise<void>;
    handleRollbackToStep?: (stepIndex: number) => Promise<void>;
  }>({});

  // Handler for actions from pop-out window
  const handlePopOutAction = useCallback((action: SessionAction) => {
    const handlers = actionHandlersRef.current;
    switch (action.action) {
      case "start":
        handlers.startRecording?.();
        break;
      case "stop":
        handlers.stopRecording?.();
        break;
      case "pause":
        handlers.handlePause?.();
        break;
      case "resume":
        handlers.handleResume?.();
        break;
      case "reset":
        handlers.handleReset?.();
        break;
      case "close":
        handlers.handleClose?.();
        break;
      case "archive_probe":
        if (action.probeId) handlers.handleArchiveProbe?.(action.probeId);
        break;
      case "toggle_focus":
        if (action.probeId !== undefined) handlers.handleToggleFocus?.(action.probeId, action.focused ?? false);
        break;
      case "advance_step":
        handlers.handleAdvanceStep?.();
        break;
      case "rollback_step":
        if (action.stepIndex !== undefined) handlers.handleRollbackToStep?.(action.stepIndex);
        break;
    }
  }, []);

  // Broadcast sync for pop-out window communication
  const { 
    broadcastState, 
    broadcastProbes, 
    broadcastPlan, 
    broadcastRecordingStatus 
  } = useSessionSync({
    sessionId,
    isMainWindow: true,
    onAction: handlePopOutAction,
    onPeerConnected: () => {
      // Don't re-enable if user explicitly dismissed the popout
      if (popOutDismissedRef.current) return;
      setIsPopOutActive(true);
      // Send full state to the newly connected pop-out window
      if (sessionRef.current) {
        broadcastState({
          probes: sessionRef.current.probes,
          sessionPlan: sessionPlanRef.current,
          isRecording,
          isPaused,
          elapsedSeconds,
          cycleProgress: elapsedSeconds % 60,
          isAnalyzing,
          archivingProbeId,
          planLoading,
          planError,
          originalPrompt: sessionRef.current.problem,
          objectives,
          objectiveStatuses,
        });
      }
    },
    onPeerDisconnected: () => {
      setIsPopOutActive(false);
      popOutWindowRef.current = null;
    },
  });

  // Broadcast state updates when relevant state changes (excluding time-based updates)
  useEffect(() => {
    if (!isPopOutActive || !sessionRef.current) return;
    broadcastState({
      probes: sessionRef.current.probes,
      isRecording,
      isPaused,
      isAnalyzing,
      archivingProbeId,
      planLoading,
      planError,
      objectives,
      objectiveStatuses,
    });
  }, [isPopOutActive, isRecording, isPaused, isAnalyzing, archivingProbeId, planLoading, planError, objectives, objectiveStatuses, broadcastState]);

  // Broadcast time updates separately at a lower frequency (every 5 seconds)
  useEffect(() => {
    if (!isPopOutActive) return;
    if (elapsedSeconds % 5 !== 0) return; // Only broadcast every 5 seconds
    broadcastState({
      elapsedSeconds,
      cycleProgress: elapsedSeconds % 60,
    });
  }, [isPopOutActive, elapsedSeconds, broadcastState]);

  // Broadcast probes when session probes change
  useEffect(() => {
    if (!isPopOutActive || !session?.probes) return;
    broadcastProbes(session.probes);
  }, [isPopOutActive, session?.probes, broadcastProbes]);

  // Broadcast session plan when it changes
  useEffect(() => {
    if (!isPopOutActive) return;
    broadcastPlan(sessionPlan);
  }, [isPopOutActive, sessionPlan, broadcastPlan]);

  // Handle opening pop-out window
  const handlePopOut = useCallback(() => {
    if (popOutWindowRef.current && !popOutWindowRef.current.closed) {
      // Focus existing pop-out
      popOutWindowRef.current.focus();
    } else {
      // Clear dismissed state when user explicitly opens a new popout
      popOutDismissedRef.current = false;
      // Open new pop-out
      const popOut = openPopOutWindow(sessionId);
      popOutWindowRef.current = popOut;
      if (popOut) {
        setIsPopOutActive(true);
      }
    }
  }, [sessionId]);

  // Stable callback for focusing pop-out window (used by memoized overlay)
  const handleFocusPopOut = useCallback(() => {
    if (popOutWindowRef.current && !popOutWindowRef.current.closed) {
      popOutWindowRef.current.focus();
    }
  }, []);

  // Change tab title and warn on close when pop-out is active
  useEffect(() => {
    if (!isPopOutActive) return;

    // Store original title
    const originalTitle = document.title;
    
    // Change tab title to warning
    document.title = "⚠️ Keep Open - Session Active";

    // Warn user if they try to close/navigate away
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "The monitoring session is running in a separate window. Closing this tab will end your session.";
      return e.returnValue;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.title = originalTitle;
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isPopOutActive]);



  // Listen for probe events from ProbeNotifications
  useEffect(() => {
    const handleProbeRevealed = (e: Event) => {
      const probeId = (e as CustomEvent).detail;
      setSession((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          probes: prev.probes.map((p) =>
            p.id === probeId ? { ...p, isRevealed: true } : p
          ),
        };
      });
      if (sessionRef.current) {
        sessionRef.current = {
          ...sessionRef.current,
          probes: sessionRef.current.probes.map((p) =>
            p.id === probeId ? { ...p, isRevealed: true } : p
          ),
        };
      }
    };

    const handleProbeStarToggled = (e: Event) => {
      const { probeId, starred } = (e as CustomEvent).detail;
      setSession((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          probes: prev.probes.map((p) =>
            p.id === probeId ? { ...p, starred } : p
          ),
        };
      });
    };

    window.addEventListener("probe-revealed", handleProbeRevealed);
    window.addEventListener("probe-star-toggled", handleProbeStarToggled);

    return () => {
      window.removeEventListener("probe-revealed", handleProbeRevealed);
      window.removeEventListener("probe-star-toggled", handleProbeStarToggled);
    };
  }, []);

  // Scroll probe into view when it changes
  useEffect(() => {
    if (activeProbe && probeContainerRef.current) {
      probeContainerRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [activeProbe?.id]);

  // Load session on mount from Supabase + fire opening probe early
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const s = await getSession(sessionId);
      if (cancelled) return;
      if (s) {
        setSession(s);
        sessionRef.current = s;
        
        // Reset language confirmation for new session
        setLanguageConfirmed(false);
        
        // Load tutoring language from session metadata if set
        if (s.metadata?.tutoringLanguage) {
          setTutoringLanguage(s.metadata.tutoringLanguage as typeof tutoringLanguage);
        }
        
        // Set paused state if session was paused
        if (s.status === "paused") {
          setIsPaused(true);
        }
        
        // Load objectives from session or generate new ones
        let loadedObjectives: string[] = [];
        if (s.objectives && s.objectives.length > 0) {
          loadedObjectives = s.objectives;
        } else {
          try {
            const objRes = await fetch("/api/generate-objectives", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ problem: s.problem }),
            });
            if (!cancelled && objRes.ok) {
              const { objectives: generatedObjectives } = await objRes.json();
              if (generatedObjectives && generatedObjectives.length > 0) {
                loadedObjectives = generatedObjectives;
              }
            }
          } catch { /* objectives are optional */ }
        }
        if (loadedObjectives.length > 0) {
          setObjectives(loadedObjectives);
          // Initialize all objectives with blue status
          setObjectiveStatuses(loadedObjectives.map(() => "blue"));
        }

        // Load or create session plan - but wait for language confirmation first
        setPlanLoading(true);
        setPlanError(null);
        try {
          // First try to load existing plan - use it but user will need to confirm language to translate if needed
          const existingPlan = await getSessionPlan(s.id);
          // Validate existing plan before using
          if (existingPlan && existingPlan.steps && Array.isArray(existingPlan.steps) && existingPlan.steps.length > 0 && existingPlan.goal) {
            setSessionPlan(existingPlan);
            sessionPlanRef.current = existingPlan;
          } else if (existingPlan) {
            console.warn("Loaded existing plan is invalid:", existingPlan);
          }
          // Don't create new plan here - wait for user to confirm language first
        } catch (err) {
          console.warn("Session plan loading failed:", err);
        } finally {
          if (!cancelled) setPlanLoading(false);
        }

        // Fire opening probe (now uses session plan context if available) - but only if session already has probes
        // Opening probe generation is now handled after language confirmation
        if (s.probes.length > 0) {
          // Session already has probes (e.g. page refresh) — show the latest
          const lastProbe = s.probes[s.probes.length - 1];
          setActiveProbe(lastProbe);
          setViewingProbeIndex(s.probes.length - 1);
        }
      } else {
        router.push("/");
      }
    }
    load();
    return () => { cancelled = true; };
  }, [sessionId, router]);

  // Load RAG chunks on mount
  useEffect(() => {
    async function loadCalibration() {
      if (!session?.problem) return;
      setCalibrationLoading(true);
      try {
        const response = await fetch("/api/calibrate-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ problem: session.problem, sessionId: session.id }),
        });
        if (response.ok) {
          const data = await response.json();
          const chunks = data.chunks || [];
          setRagChunks(chunks);
          // Pre-select chunks with similarity > 70%
          const highRelevance = new Set<string>(chunks.filter((c: { similarity: number }) => c.similarity > 0.7).map((c: { id: string }) => c.id));
          setSelectedChunks(highRelevance);
        }
      } catch (err) {
        console.error("Calibration error:", err);
      } finally {
        setCalibrationLoading(false);
        setCalibrationAttempted(true);
      }
    }
    if (session?.problem) {
      loadCalibration();
    }
  }, [session?.problem, session?.id]);

  // Load prep material
  const loadPrepMaterial = async (type: string) => {
    if (!session?.problem) return;
    setPrepLoading(type);
    try {
      const response = await fetch(`/api/prep-material?topic=${encodeURIComponent(session.problem)}&type=${type}`);
      if (response.ok) {
        const data = await response.json();
        // Add card to list (avoid duplicates)
        setPrepCards(prev => {
          if (prev.some(c => c.id === type)) return prev;
          return [...prev, { id: type, title: data.title, content: data.content }];
        });
      }
    } catch (err) {
      console.error("Prep material error:", err);
    } finally {
      setPrepLoading(null);
    }
  };

  // Save selected RAG chunks to session when selection changes
  const saveSelectedRagChunks = async (chunkIds: string[]) => {
    if (!session?.id) return;
    try {
      await fetch("/api/save-session-rag-chunks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          sessionId: session.id, 
          chunkIds 
        }),
      });
    } catch (err) {
      console.error("Failed to save RAG chunks:", err);
    }
  };

  // ---- Muse EEG ----
  const handleConnectMuse = async () => {
    handleDisconnectMuse();
    setMuseStatus("connecting");
    setMuseError(null);
    try {
      const { MuseAthenaClient } = await import("@/lib/muse-athena");
      const muse = new MuseAthenaClient();

      muse.onEEG((sample: { channels: Record<string, number[]> }) => {
        for (const [channelName, samples] of Object.entries(sample.channels)) {
          const existing = eegBufferRef.current.get(channelName) || [];
          existing.push(...samples);
          if (existing.length > 512) {
            eegBufferRef.current.set(channelName, existing.slice(-512));
          } else {
            eegBufferRef.current.set(channelName, existing);
          }
        }
      });

      await muse.connect();
      museClientRef.current = muse;
      setMuseStatus("connected");

      await muse.startStreaming();
      setMuseStatus("streaming");

      eegIntervalRef.current = setInterval(() => {
        setEegChannelData(new Map(eegBufferRef.current));
      }, 100);

      bandIntervalRef.current = setInterval(() => {
        const af7 = eegBufferRef.current.get("AF7");
        const af8 = eegBufferRef.current.get("AF8");
        if (!af7 || af7.length < 256 || !af8 || af8.length < 256) return;
        const powers = computeBandPowers(af7.slice(-256), af8.slice(-256));
        setBandPowers(powers);
      }, 1000);
    } catch (err: unknown) {
      setMuseStatus("disconnected");
      const error = err as Error;
      if (error?.name === "NotFoundError" && error?.message?.includes("cancelled")) return;
      setMuseError(error?.message || "Connection failed.");
    }
  };

  const handleDisconnectMuse = () => {
    if (museClientRef.current) {
      try { museClientRef.current.disconnect(); } catch {}
      museClientRef.current = null;
    }
    if (eegIntervalRef.current) { clearInterval(eegIntervalRef.current); eegIntervalRef.current = null; }
    if (bandIntervalRef.current) { clearInterval(bandIntervalRef.current); bandIntervalRef.current = null; }
    eegBufferRef.current.clear();
    setEegChannelData(new Map());
    setBandPowers(null);
    setMuseStatus("disconnected");
  };

  // Hard minimum cooldown between probes (ms) to prevent rapid slot filling
  const PROBE_COOLDOWN_MS = 30_000;

  // ---- Local Analysis Heartbeat (runs Gemma 4 E2B in-browser) ----
  const runLocalAnalysisHeartbeat = useCallback(async () => {
    const currentSession = sessionRef.current;
    const currentPlan = sessionPlanRef.current;
    const recorder = recorderRef.current;
    const manager = LocalInferenceManager.getInstance();

    if (!currentSession || !currentPlan || !manager.isReady()) return;
    if (observerModeRef.current === "off") return;
    if (isMutedRef.current) return;
    if (isAnalyzingRef.current) return;

    isAnalyzingRef.current = true;
    setIsAnalyzing(true);

    try {
      // Ensure local context buffer exists
      if (!localContextRef.current) {
        localContextRef.current = new LocalContextBuffer();
      }
      const ctx = localContextRef.current;

      // Step 1: Transcribe recent audio locally
      if (recorder && isRecordingRef.current) {
        try {
          const recentAudio = recorder.getRecentAudio(10000); // last 10s
          if (recentAudio && recentAudio.size > 100) {
            const transcript = await manager.transcribe(recentAudio);
            if (transcript) {
              ctx.addTranscript(transcript);
            }
          }
        } catch (err) {
          console.warn("[LocalInference] Transcription error:", err);
        }
      }

      // Step 2: Generate a probe locally (no plan update)
      const openProbes = currentSession.probes.filter(p => !p.archived);
      if (openProbes.length >= 5) {
        // Too many open probes, skip generation
        return;
      }

      // Hard cooldown: don't generate probes too rapidly
      const timeSinceLastLocal = Date.now() - (lastProbeTimeRef.current || 0);
      if (lastProbeTimeRef.current !== 0 && timeSinceLastLocal < PROBE_COOLDOWN_MS) {
        return;
      }

      const currentStep = currentPlan.steps?.[currentPlan.currentStepIndex];
      const snapshot = ctx.getContext();

      const analysisContext: LocalAnalysisContext = {
        planGoal: currentPlan.goal || "",
        currentStep: currentStep?.description || "",
        recentTranscripts: snapshot.recentTranscripts,
        toolEvents: snapshot.toolEvents,
        facialSummary: snapshot.facialSummary,
        eegSummary: snapshot.eegSummary,
        previousProbes: currentSession.probes.map(p => p.text),
        tutoringLanguage: tutoringLanguage,
      };

      setIsGeneratingProbe(true);
      const probeText = await manager.generateProbe(analysisContext);
      setIsGeneratingProbe(false);

      if (probeText && probeText.trim().length > 5) {
        // Add probe in-memory only (not persisted to Supabase)
        const localProbe: Probe = {
          id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          timestamp: Date.now() - new Date(currentSession.startedAt).getTime(),
          gapScore: 0.5,
          signals: ["local-inference"],
          text: probeText.trim(),
          requestType: "question" as RequestType,
          archived: false,
          starred: false,
          focused: false,
          isRevealed: false,
        };

        const updatedSession = {
          ...currentSession,
          probes: [...currentSession.probes, localProbe],
        };
        setSession(updatedSession);
        sessionRef.current = updatedSession;
        setActiveProbe(localProbe);
        setViewingProbeIndex(updatedSession.probes.length - 1);
        lastProbeTimeRef.current = Date.now();
      }
    } catch (err) {
      console.error("[LocalInference] Analysis error:", err);
    } finally {
      isAnalyzingRef.current = false;
      setIsAnalyzing(false);
      setIsGeneratingProbe(false);
    }
  }, [tutoringLanguage]);

  // ---- Analysis Heartbeat (10s) ----
  const runAnalysisHeartbeat = useCallback(async () => {
    // Route to local analysis if enabled
    if (localInferenceEnabledRef.current) {
      return runLocalAnalysisHeartbeat();
    }

    const currentSession = sessionRef.current;

    if (!currentSession) return;
    if (observerModeRef.current === "off") return;
    if (isMutedRef.current) return;
    if (isAnalyzingRef.current) return;

    isAnalyzingRef.current = true;
    setIsAnalyzing(true);

    try {
      // Transcribe any pending audio chunks BEFORE analysis so the tutoring model sees latest speech
      if (currentSession && isRecordingRef.current) {
        try {
          await fetch("/api/transcribe-chunks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId: currentSession.id }),
          });
        } catch (err) {
          console.warn("Pre-analysis transcription error:", err);
        }
      }

      const openProbes = currentSession.probes.filter(p => !p.archived);
      const focusedProbes = openProbes.filter(p => p.focused).map(p => ({ id: p.id, text: p.text }));
      const currentPlan = sessionPlanRef.current;

      if (!currentPlan) {
        isAnalyzingRef.current = false;
        setIsAnalyzing(false);
        return;
      }

      // Helper to validate plan data
      const isValidPlan = (plan: SessionPlan | null | undefined): boolean => {
        return !!(plan && 
          plan.steps && 
          Array.isArray(plan.steps) && 
          plan.steps.length > 0 &&
          plan.goal);
      };

      // Single call to session-plan/update (now includes gap analysis)
      setIsGeneratingProbe(true);
      const res = await fetch("/api/session-plan/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: currentSession.id,
          previousProbes: currentSession.probes.map((p) => p.text),
          focusedProbes,
          openProbeCount: openProbes.length,
          lastProbeTimestamp: lastProbeTimeRef.current || 0,
        }),
      });

      setPipelineErrors(prev => ({ ...prev, analysis: undefined, transcription: undefined }));

      if (!res.ok) {
        setPipelineErrors(prev => ({ ...prev, analysis: "Analysis service unavailable" }));
        isAnalyzingRef.current = false;
        setIsAnalyzing(false);
        return;
      }

      const planData = await res.json();

      // Update objective statuses based on gap score from the unified response
      if (planData.gapScore !== undefined) {
        setObjectiveStatuses(prev => {
          if (prev.length === 0) return prev;
          const newStatuses = [...prev];
          const statusToSet: "red" | "yellow" | "green" = 
            planData.gapScore >= 0.7 ? "red" : 
            planData.gapScore >= 0.4 ? "yellow" : "green";
          
          const idxToUpdate = currentSession.probes.length % newStatuses.length;
          newStatuses[idxToUpdate] = statusToSet;
          return newStatuses;
        });
      }

      // Process plan update response
      if (planData) {
        // Check for step transition BEFORE updating state
        const previousStepIndex = sessionPlanRef.current?.currentStepIndex ?? 0;
        const newStepIndex = planData.plan?.currentStepIndex ?? 0;
        const totalSteps = planData.plan?.steps?.length ?? 0;
        const llmWantsAdvance = newStepIndex > previousStepIndex && isValidPlan(planData.plan);
        // Only allow automatic step transitions when autoAdvance is ON
        const isStepTransition = llmWantsAdvance && autoAdvanceRef.current;
        
        const allStepsCompleted = planData.plan?.steps?.every((s: { status: string }) => s.status === 'completed') ?? false;
        const isPlanComplete = isStepTransition && allStepsCompleted && totalSteps > 0;
        
        if (isStepTransition && isValidPlan(planData.plan)) {
          // Auto-advance: accept the new plan with advanced step
          setSessionPlan(planData.plan);
          sessionPlanRef.current = planData.plan;
        } else if (llmWantsAdvance && !autoAdvanceRef.current) {
          // Manual mode: LLM says ready to advance, but user controls when
          // Keep current plan (don't advance), but update other fields
          const planWithoutAdvance = {
            ...planData.plan,
            currentStepIndex: previousStepIndex,
            steps: planData.plan.steps.map((s: { status: string }, idx: number) => ({
              ...s,
              status: idx < previousStepIndex ? "completed" 
                : idx === previousStepIndex ? "in_progress" 
                : s.status === "skipped" ? "skipped" : "pending",
            })),
          };
          if (isValidPlan(planWithoutAdvance)) {
            setSessionPlan(planWithoutAdvance);
            sessionPlanRef.current = planWithoutAdvance;
          }
        } else if (isValidPlan(planData.plan)) {
          setSessionPlan(planData.plan);
          sessionPlanRef.current = planData.plan;
        } else if (planData.plan) {
          console.warn('[Plan Update] Plan corrupted, keeping previous state:', planData.plan);
        }
        
        // On step transition: archive ALL active probes and trigger celebration
        if (isStepTransition) {
          const activeProbesForArchive = currentSession.probes.filter(p => !p.archived);
          if (activeProbesForArchive.length > 0) {
            let sessionWithArchivedProbes = currentSession;
            for (const probe of activeProbesForArchive) {
              await archiveProbe(probe.id);
              sessionWithArchivedProbes = {
                ...sessionWithArchivedProbes,
                probes: sessionWithArchivedProbes.probes.map(p => 
                  p.id === probe.id ? { ...p, archived: true } : p
                ),
              };
            }
            setSession(sessionWithArchivedProbes);
            sessionRef.current = sessionWithArchivedProbes;
          }
          
          if (isPlanComplete) {
            setIsCelebrating(true);
            playSessionCompleteSound();
            setTimeout(() => {
              setIsCelebrating(false);
              setShowPlanCompleteModal(true);
              if (isRecording && !isPaused) {
                setIsPaused(true);
              }
            }, 1500);
          } else {
            setIsCelebrating(true);
            playStepCompleteSound();
            setTimeout(() => setIsCelebrating(false), 1500);
          }
        } else if (planData.probesToArchive && planData.probesToArchive.length > 0) {
          let updatedSession = currentSession;
          for (const probeId of planData.probesToArchive) {
            await archiveProbe(probeId);
            updatedSession = {
              ...updatedSession,
              probes: updatedSession.probes.map(p => 
                p.id === probeId ? { ...p, archived: true } : p
              ),
            };
          }
          setSession(updatedSession);
          sessionRef.current = updatedSession;
          
          if (planData.probesToArchive.length > 0) {
            playArchiveSound();
          }
        }
        
        // Use the next request from the plan update
        if (planData.nextRequest) {
          const currentOpenProbeCount = (sessionRef.current?.probes || currentSession.probes).filter(p => !p.archived).length;
          
          const timeSinceLastProbe = Date.now() - (lastProbeTimeRef.current || 0);
          const cooldownMet = lastProbeTimeRef.current === 0 || timeSinceLastProbe >= PROBE_COOLDOWN_MS;

          if (planData.canGenerateProbe !== false && currentOpenProbeCount < 5 && cooldownMet) {
            const savedProbe = await addProbe(currentSession.id, {
              timestamp: Date.now() - new Date(currentSession.startedAt).getTime(),
              gapScore: planData.gapScore ?? 0.5,
              signals: planData.signals || [],
              text: planData.nextRequest.text,
              requestType: planData.nextRequest.type || "question",
              planStepId: currentPlan.steps?.[currentPlan.currentStepIndex]?.id,
            });
            
            if (planData.nextRequest.suggested_tools) {
              savedProbe.suggestedTools = planData.nextRequest.suggested_tools;
            }
            
            const updatedSession = addProbeToSession(currentSession, savedProbe);
            setSession(updatedSession);
            sessionRef.current = updatedSession;

            setActiveProbe(savedProbe);
            setViewingProbeIndex(updatedSession.probes.length - 1);
            lastProbeTimeRef.current = Date.now();
          }
        }
      }
    } catch (err) {
      console.error("Analysis error:", err);
    } finally {
      isAnalyzingRef.current = false;
      setIsAnalyzing(false);
      setIsGeneratingProbe(false);
    }
  }, []);

  // ---- Storage Heartbeat (5s) ----
  const runStorageHeartbeat = useCallback(async () => {
    const currentSession = sessionRef.current;
    const recorder = recorderRef.current;
    const currentMuseStatus = museStatusRef.current;
    const currentWebcamEnabled = isWebcamEnabledRef.current;

    if (!currentSession || !isRecordingRef.current) return;

    try {
      // Audio: get recent 5 seconds and save
      if (recorder) {
        const recentAudio = recorder.getRecentAudio(5000);
        if (recentAudio && recentAudio.size > 100) {
          const idx = chunkIndexRef.current++;
          try {
            const savedPath = await saveAudioChunk(currentSession.id, recentAudio, idx, Date.now());
            if (savedPath) {
              transferHealthRef.current.audio.saved++;
            }
          } catch (err) {
            transferHealthRef.current.audio.failed++;
          }
          setTransferHealth({ ...transferHealthRef.current });
        }
      }

      // Tool data: save whiteboard and notebook content (with deduplication)
      if (whiteboardDataRef.current) {
        const whiteboardKey = `canvas_${currentSession.id}`;
        const whiteboardResult = await saveWithDedupString(whiteboardDataRef.current, whiteboardKey);
        if (whiteboardResult.saved) {
          await logToolUsage(currentSession.id, 'canvas', 'canvas_draw', Date.now(), { data: whiteboardDataRef.current });
        }
      }
      if (notebookContentRef.current && notebookContentRef.current.trim().length > 0) {
        const notebookKey = `notebook_${currentSession.id}`;
        const notebookResult = await saveWithDedupString(notebookContentRef.current, notebookKey);
        if (notebookResult.saved) {
          await logToolUsage(currentSession.id, 'notebook', 'notebook_edit', Date.now(), { data: notebookContentRef.current });
        }
      }

      // EEG: flush buffer if streaming
      if (currentSession && currentMuseStatus === "streaming" && eegBufferRef.current.size > 0) {
        const channels: Record<string, number[]> = {};
        for (const [ch, samples] of eegBufferRef.current.entries()) {
          channels[ch] = samples.slice();
        }
        const eegIdx = eegChunkIndexRef.current++;
        try {
          await saveSessionEEG(currentSession.id, { channels, bandPowers }, museClientRef.current?.deviceName, eegIdx, Date.now());
          transferHealthRef.current.eeg.saved++;
        } catch (err) {
          transferHealthRef.current.eeg.failed++;
        }
        setTransferHealth({ ...transferHealthRef.current });
      }

      // Facial: flush buffer if webcam enabled
      if (currentSession && currentWebcamEnabled && facialBufferRef.current.length > 0) {
        const facialIdx = facialChunkIndexRef.current++;
        try {
          await saveFacialData(currentSession.id, facialBufferRef.current, facialIdx, Date.now());
          transferHealthRef.current.facial.saved++;
        } catch (err) {
          transferHealthRef.current.facial.failed++;
        }
        setTransferHealth({ ...transferHealthRef.current });
      }
    } catch (err) {
      console.error("Storage heartbeat error:", err);
    }
  }, []);

  const checkMicrophone = async () => {
    setMicStatus("checking");
    setError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 48000,
        },
      });
      micStreamRef.current = mediaStream;
      setMicStatus("ready");
    } catch (err) {
      setMicStatus("denied");
      setError("Microphone access denied. Please allow microphone permission in your browser settings and try again.");
    }
  };

  const startRecording = async () => {
    try {
      setError(null);

      // Reset transfer health on new recording
      transferHealthRef.current = { audio: { sent: 0, saved: 0, failed: 0 }, eeg: { sent: 0, saved: 0, failed: 0 }, facial: { sent: 0, saved: 0, failed: 0 } };
      setTransferHealth({ audio: { sent: 0, saved: 0, failed: 0 }, eeg: { sent: 0, saved: 0, failed: 0 }, facial: { sent: 0, saved: 0, failed: 0 } });

      // Reuse the mic-checked stream, or request a new one
      let mediaStream = micStreamRef.current;
      if (!mediaStream || mediaStream.getTracks().some(t => t.readyState === "ended")) {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 48000,
          },
        });
      }
      micStreamRef.current = null; // hand off ownership
      setStream(mediaStream);

      const recorder = new AudioRecorder({
        chunkDurationMs: 60000,
        maxBufferDurationMs: 300000,
        // Audio saving is handled by runStorageHeartbeat every 5s via getRecentAudio()
        // No onChunk save needed — avoids duplicate audio entries in session_audio table
      });
      recorderRef.current = recorder;
      await recorder.start(mediaStream);
      setIsRecording(true);

      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);

      // Start dual heartbeat: storage every 5s, analysis every 10s
      heartbeatIntervalRef.current = setInterval(() => {
        const second = heartbeatSecondRef.current;
        
        if (second % 5 === 0) {
          runStorageHeartbeat();
        }
        
        if (second % 10 === 0) {
          runAnalysisHeartbeat();
        }
        
        setStorageBeat(second % 5);
        setAnalysisBeat(second % 10);
        
        heartbeatSecondRef.current = (second + 1) % 10;
      }, 1000);

    } catch (err) {
      setError("Could not access microphone. Please grant permission and try again.");
    }
  };

  const stopRecording = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);

    // Clean up local inference if active
    if (localInferenceEnabledRef.current) {
      LocalInferenceManager.getInstance().dispose();
      localContextRef.current?.clear();
    }

    // Trigger final heartbeat to save all remaining data
    await runStorageHeartbeat();
    await (localInferenceEnabledRef.current ? Promise.resolve() : runAnalysisHeartbeat());

    const recorder = recorderRef.current;
    
    const fullAudio = recorder?.getFullAudio() ?? null;
    
    await recorder?.stop();
    recorderRef.current = null;

    if (stream) { stream.getTracks().forEach((t) => t.stop()); setStream(null); }
    setIsRecording(false);
    setIsSaving(true);
    if (!session) return;

    const finalSession = endSession(session, elapsedSeconds * 1000);
    finalSession.hasAudio = !!fullAudio;
    finalSession.metadata = {
      ...finalSession.metadata,
      whiteboardData: whiteboardData || undefined,
      notebookData: notebookContent || undefined,
    };

    // Persist to Supabase
    await saveSession(finalSession);

    // Save EEG data before navigating
    if (museStatus === "streaming" && eegBufferRef.current.size > 0) {
      const channels: Record<string, number[]> = {};
      for (const [ch, samples] of eegBufferRef.current.entries()) {
        channels[ch] = samples;
      }
      await saveSessionEEG(finalSession.id, { channels, bandPowers }, museClientRef.current?.deviceName);
    }

    handleDisconnectMuse();

    // Navigate after all data is saved
    router.push(`/results?id=${finalSession.id}`);
  };

  // ---- Screenshot Handlers ----
  const handleStartScreenCapture = useCallback(async () => {
    if (!screenCaptureRef.current) {
      screenCaptureRef.current = createScreenCapture({
        onScreenshotCaptured: async (blob: Blob, timestamp: number) => {
          try {
            const screenshotKey = `screenshot_${sessionId}`;
            const result = await saveWithDedupBlob(blob, screenshotKey);
            if (result.saved) {
              await saveScreenshot(sessionId, blob, timestamp);
              setScreenshotCount(c => c + 1);
            }
          } catch (error) {
            console.error("[Screenshot] Failed to save:", error);
          }
        },
        intervalMs: 5000,
        onStatusChange: (capturing: boolean) => {
          setIsScreenCapturing(capturing);
        },
      });
    }
    await screenCaptureRef.current.start();
  }, [sessionId]);

  const handleStopScreenCapture = useCallback(() => {
    screenCaptureRef.current?.stop();
  }, []);

  const handlePause = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);

    // Track what was active before pause (for auto-resume)
    wasRecordingRef.current = !!recorderRef.current;
    wasScreenCapturingRef.current = isScreenCapturing;
    wasWebcamEnabledRef.current = isWebcamEnabled;
    wasMuseStreamingRef.current = museStatus === "streaming";

    // Store stream references for potential resume
    pausedAudioStreamRef.current = stream;
    pausedScreenStreamRef.current = screenCaptureRef.current?.getStream() || null;
    pausedWebcamStreamRef.current = null;

    const recorder = recorderRef.current;
    await recorder?.stop();
    recorderRef.current = null;

    // Stop all data flows
    if (stream) { stream.getTracks().forEach((t) => t.stop()); setStream(null); }
    
    // Stop screen capture
    if (screenCaptureRef.current) {
      screenCaptureRef.current.stop();
      setIsScreenCapturing(false);
    }

    // Stop EEG
    handleDisconnectMuse();

    // Stop webcam (FaceTracker manages its own stream internally)
    setIsWebcamEnabled(false);
    
    setIsRecording(false);
    setIsPaused(true);

    if (session) {
      await pauseSession(session.id);
    }
  };

  const handleResume = async () => {
    if (!session) return;

    try {
      // Resume audio stream
      let mediaStream = pausedAudioStreamRef.current;
      const tracksStillActive = mediaStream?.getTracks().some(t => t.readyState === "live");
      if (!mediaStream || !tracksStillActive) {
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      setStream(mediaStream);

      const AudioRecorderClass = (await import("@/lib/audio")).AudioRecorder;
      const recorder = new AudioRecorderClass({
        chunkDurationMs: 60000,
        maxBufferDurationMs: 300000,
        // Audio saving is handled by runStorageHeartbeat every 5s via getRecentAudio()
        // No onChunk save needed — avoids duplicate audio entries in session_audio table
      });
      await recorder.start(mediaStream);
      recorderRef.current = recorder;

      setIsRecording(true);
      setIsPaused(false);

      await resumeSession(session.id);

      const startTime = Date.now() - (elapsedSeconds * 1000);
      timerRef.current = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);

      // Start dual heartbeat: storage every 5s, analysis every 10s
      heartbeatIntervalRef.current = setInterval(() => {
        const second = heartbeatSecondRef.current;
        
        if (second % 5 === 0) {
          runStorageHeartbeat();
        }
        
        if (second % 10 === 0) {
          runAnalysisHeartbeat();
        }
        
        setStorageBeat(second % 5);
        setAnalysisBeat(second % 10);
        
        heartbeatSecondRef.current = (second + 1) % 10;
      }, 1000);

      // Auto-resume data sources that were active before pause
      // Screen capture
      if (wasScreenCapturingRef.current) {
        if (screenCaptureRef.current) {
          const existingStream = pausedScreenStreamRef.current;
          const streamStillActive = existingStream?.getVideoTracks().some(t => t.readyState === "live");
          if (streamStillActive) {
            // Try to restart with existing stream if tracks are still active
            try {
              await screenCaptureRef.current.start();
              setIsScreenCapturing(true);
            } catch (e) {
              console.warn("[Resume] Could not restart screen capture:", e);
              wasScreenCapturingRef.current = false;
            }
          } else {
            // Screen sharing was stopped by user, can't auto-resume
            wasScreenCapturingRef.current = false;
          }
        }
      }

      // Webcam (FaceTracker will auto-start when enabled)
      if (wasWebcamEnabledRef.current) {
        setIsWebcamEnabled(true);
      }

      // EEG (auto-reconnect)
      if (wasMuseStreamingRef.current) {
        handleConnectMuse();
      }

    } catch (err) {
      setError("Could not access microphone. Please grant permission and try again.");
    }
  };

  const handleMute = (durationMs: number) => {
    setIsMuted(true);
    setMuteRemaining(durationMs);
    if (muteTimerRef.current) clearTimeout(muteTimerRef.current);
    muteTimerRef.current = setTimeout(() => { setIsMuted(false); setMuteRemaining(0); }, durationMs);
  };

  // Reset session - deletes probes but keeps data chunks
  const handleReset = async () => {
    if (!session) return;
    
    try {
      // Clear probes from database
      await resetSessionProbes(session.id);
      
      // Clear local probe state
      const resetSession = { ...session, probes: [] };
      setSession(resetSession);
      sessionRef.current = resetSession;
      setActiveProbe(null);
      setViewingProbeIndex(-1);
      
      // Reset probe-related refs
      lastProbeTimeRef.current = 0;
    } catch (err) {
      console.error("Reset session error:", err);
    }
  };

  // Close session - navigate to dashboard without ending
  const handleClose = () => {
    // Session stays paused, just navigate away
    router.push("/");
  };

  // Archive a probe (immediately, without LLM validation)
  const handleArchiveProbe = async (probeId: string) => {
    if (!session) return;
    
    const probe = session.probes.find(p => p.id === probeId);
    if (!probe) return;
    
    setArchivingProbeId(probeId);
    
    try {
      // Archive the probe directly
      await archiveProbe(probeId);
      
      // Update local state
      const updatedProbes = session.probes.map(p => 
        p.id === probeId ? { ...p, archived: true } : p
      );
      const updatedSession = { ...session, probes: updatedProbes };
      setSession(updatedSession);
      sessionRef.current = updatedSession;
      
      // Play success sound
      playArchiveSound();
    } catch (err) {
      console.error("Archive probe error:", err);
    } finally {
      // Delay clearing to allow animation to complete
      setTimeout(() => setArchivingProbeId(null), 500);
    }
  };

  // Toggle focus on a probe
  const handleToggleFocus = async (probeId: string, focused: boolean) => {
    if (!session) return;
    
    try {
      await toggleProbeFocused(probeId, focused);
      
      // Update local state
      const updatedProbes = session.probes.map(p => 
        p.id === probeId ? { ...p, focused } : p
      );
      const updatedSession = { ...session, probes: updatedProbes };
      setSession(updatedSession);
      sessionRef.current = updatedSession;
    } catch (err) {
      console.error("Toggle focus error:", err);
    }
  };

  // Probe navigation
  const probeCount = session?.probes.length ?? 0;
  const canGoPrev = viewingProbeIndex > 0;
  const canGoNext = viewingProbeIndex < probeCount - 1;

  const handlePrevProbe = () => {
    if (!session || viewingProbeIndex <= 0) return;
    const newIdx = viewingProbeIndex - 1;
    setViewingProbeIndex(newIdx);
    setActiveProbe(session.probes[newIdx]);
  };

  const handleNextProbe = () => {
    if (!session || viewingProbeIndex >= session.probes.length - 1) return;
    const newIdx = viewingProbeIndex + 1;
    setViewingProbeIndex(newIdx);
    setActiveProbe(session.probes[newIdx]);
  };

  const handleToggleStar = async (probeId: string, starred: boolean) => {
    if (!session) return;

    // Update local state immediately
    const updatedProbes = session.probes.map((p) =>
      p.id === probeId ? { ...p, starred } : p
    );
    const updatedSession = { ...session, probes: updatedProbes };
    setSession(updatedSession);
    sessionRef.current = updatedSession;

    // Update the active probe if it's the one being starred
    if (activeProbe?.id === probeId) {
      setActiveProbe({ ...activeProbe, starred });
    }

    // Persist to DB (non-blocking)
    toggleProbeStarred(probeId, starred).catch(() => {});
  };

  const handleConfirmEnd = async () => {
    setShowEndDialog(false);
    if (session) {
      const finalSession = endSession(session, elapsedSeconds * 1000, "completed");
      setSession(finalSession);
      sessionRef.current = finalSession;
    }
    await stopRecording();
  };

  const handleAdvanceStep = async (forceAdvance = false) => {
    if (!session) return;
    const currentSession = sessionRef.current || session;
    const openProbes = currentSession.probes.filter(p => !p.archived);

    // --- Local inference mode: advance step entirely in-browser ---
    if (localInferenceEnabledRef.current) {
      const currentPlan = sessionPlanRef.current;
      if (!currentPlan?.steps?.length) return;

      const currentIdx = currentPlan.currentStepIndex ?? 0;
      const isLastStep = currentIdx >= currentPlan.steps.length - 1;

      // Mark current step completed, next step in_progress, and advance index
      const nextIdx = isLastStep ? currentIdx : currentIdx + 1;
      const updatedSteps = currentPlan.steps.map((s, i) => {
        if (i === currentIdx) return { ...s, status: "completed" as const };
        if (i === nextIdx && !isLastStep) return { ...s, status: "in_progress" as const };
        return s;
      });
      const updatedPlan = {
        ...currentPlan,
        steps: updatedSteps,
        currentStepIndex: nextIdx,
      };
      setSessionPlan(updatedPlan);
      sessionPlanRef.current = updatedPlan;

      // Sync step completion to backend
      updateSessionPlan(currentPlan.id, {
        steps: updatedSteps,
        currentStepIndex: updatedPlan.currentStepIndex,
      }).catch(err => console.warn("[LocalInference] Failed to sync plan to backend:", err));

      // Archive all active probes in-memory (not persisted since local mode)
      if (openProbes.length > 0) {
        const archivedSession = {
          ...currentSession,
          probes: currentSession.probes.map(p => !p.archived ? { ...p, archived: true } : p),
        };
        setSession(archivedSession);
        sessionRef.current = archivedSession;
      }

      if (isLastStep) {
        // All steps done
        setIsCelebrating(true);
        playSessionCompleteSound();
        setTimeout(() => {
          setIsCelebrating(false);
          setShowPlanCompleteModal(true);
          if (isRecording && !isPaused) setIsPaused(true);
        }, 1500);
      } else {
        // Step completed, generate local probe for next step
        setIsCelebrating(true);
        playStepCompleteSound();
        setTimeout(() => setIsCelebrating(false), 1500);

        const newStep = updatedPlan.steps[updatedPlan.currentStepIndex];
        if (newStep) {
          let probeText = "";
          const manager = LocalInferenceManager.getInstance();

          setIsGeneratingProbe(true);
          if (manager.isReady()) {
            try {
              const ctx = localContextRef.current;
              const snapshot = ctx?.getContext();
              const latestForProbe = sessionRef.current || currentSession;
              probeText = await manager.generateProbe({
                planGoal: updatedPlan.goal || "",
                currentStep: newStep.description || "",
                recentTranscripts: snapshot?.recentTranscripts || [],
                toolEvents: snapshot?.toolEvents || [],
                facialSummary: snapshot?.facialSummary,
                eegSummary: snapshot?.eegSummary,
                previousProbes: latestForProbe.probes.map(p => p.text),
                tutoringLanguage,
              });
            } catch (err) {
              console.warn("[LocalInference] Probe generation failed:", err);
            }
          }
          setIsGeneratingProbe(false);

          if (probeText && probeText.trim().length > 5) {
            const latestSession = sessionRef.current || currentSession;
            const localProbe: Probe = {
              id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
              timestamp: Date.now() - new Date(currentSession.startedAt).getTime(),
              gapScore: 0.5,
              signals: ["local-inference", "manual_step_advance"],
              text: probeText.trim(),
              requestType: (newStep.type || "question") as RequestType,
              archived: false,
              starred: false,
              focused: false,
              isRevealed: false,
            };
            const updatedSession = addProbeToSession(latestSession, localProbe);
            setSession(updatedSession);
            sessionRef.current = updatedSession;
            setActiveProbe(localProbe);
            setViewingProbeIndex(updatedSession.probes.length - 1);
            lastProbeTimeRef.current = Date.now();
          } else {
            setPipelineErrors(prev => ({ ...prev, analysis: "Local inference failed to generate a probe for this step." }));
          }
        }
      }
      return;
    }

    // --- API mode (unchanged) ---
    try {
      const res = await fetch("/api/session-plan/advance-step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          forceAdvance,
          previousProbes: currentSession.probes.map(p => p.text),
          focusedProbes: openProbes.filter(p => p.focused).map(p => ({ id: p.id, text: p.text })),
          openProbeCount: openProbes.length,
        }),
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("Advance step failed:", errorData);
        return;
      }
      
      const data = await res.json();
      
      // Handle blocked response — show reasoning and offer force-advance
      if (data.blocked) {
        const reasoning = data.advanceReasoning || "You may not be ready to move on yet.";
        // Create a feedback probe so the user sees WHY they can't advance
        const feedbackProbe = await addProbe(session.id, {
          timestamp: Date.now() - new Date(session.startedAt).getTime(),
          gapScore: data.gapScore ?? 0.6,
          signals: ["advance_blocked"],
          text: reasoning,
          requestType: "feedback",
          planStepId: sessionPlanRef.current?.steps?.[sessionPlanRef.current.currentStepIndex]?.id,
        });
        const updatedSession = addProbeToSession(currentSession, feedbackProbe);
        setSession(updatedSession);
        sessionRef.current = updatedSession;
        setActiveProbe(feedbackProbe);
        setViewingProbeIndex(updatedSession.probes.length - 1);
        
        // Also create the next request probe if the LLM suggested one
        if (data.nextRequest && openProbes.length < 4) {
          const nextProbe = await addProbe(session.id, {
            timestamp: Date.now() - new Date(session.startedAt).getTime(),
            gapScore: data.gapScore ?? 0.6,
            signals: ["advance_blocked_followup"],
            text: data.nextRequest.text,
            requestType: data.nextRequest.type || "question",
            planStepId: sessionPlanRef.current?.steps?.[sessionPlanRef.current.currentStepIndex]?.id,
          });
          const updatedSession2 = addProbeToSession(sessionRef.current || updatedSession, nextProbe);
          setSession(updatedSession2);
          sessionRef.current = updatedSession2;
        }
        return;
      }
      
      const { plan: updatedPlan, allComplete } = data;
      
      // Validate plan before updating
      if (!updatedPlan?.steps?.length || !updatedPlan?.goal) {
        console.warn('[Advance Step] Received invalid plan, keeping previous state');
        return;
      }
      
      // Update plan state
      setSessionPlan(updatedPlan);
      sessionPlanRef.current = updatedPlan;
      
      // Archive all active probes (same as automatic step transitions)
      const activeProbes = currentSession.probes.filter(p => !p.archived);
      if (activeProbes.length > 0) {
        let sessionWithArchivedProbes = currentSession;
        for (const probe of activeProbes) {
          await archiveProbe(probe.id);
          sessionWithArchivedProbes = {
            ...sessionWithArchivedProbes,
            probes: sessionWithArchivedProbes.probes.map(p => 
              p.id === probe.id ? { ...p, archived: true } : p
            ),
          };
        }
        setSession(sessionWithArchivedProbes);
        sessionRef.current = sessionWithArchivedProbes;
      }
      
      if (allComplete) {
        // Plan fully complete - celebrate and show modal
        setIsCelebrating(true);
        playSessionCompleteSound();
        setTimeout(() => {
          setIsCelebrating(false);
          setShowPlanCompleteModal(true);
          if (isRecording && !isPaused) {
            setIsPaused(true);
          }
        }, 1500);
      } else {
        // Regular step completion - celebrate and generate probe for next step
        setIsCelebrating(true);
        playStepCompleteSound();
        setTimeout(() => setIsCelebrating(false), 1500);
        
        // Immediately generate a probe for the new step
        const newStep = updatedPlan.steps?.[updatedPlan.currentStepIndex];
        if (newStep) {
          setIsGeneratingProbe(true);
          try {
            const probeRes = await fetch("/api/generate-probe", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                problem: session.problem,
                gapScore: 0.5,
                signals: ["manual_step_advance"],
                previousProbes: currentSession.probes.map(p => p.text),
                archivedProbes: currentSession.probes.filter(p => p.archived).map(p => p.text),
                sessionPlan: updatedPlan,
              }),
            });
            
            if (probeRes.ok) {
              const probeData = await probeRes.json();
              if (probeData.probe?.trim()) {
                const latestSession = sessionRef.current || currentSession;
                const savedProbe = await addProbe(session.id, {
                  timestamp: Date.now() - new Date(session.startedAt).getTime(),
                  gapScore: 0.5,
                  signals: ["manual_step_advance", "plan_step"],
                  text: probeData.probe.trim(),
                  requestType: probeData.requestType || newStep.type || "question",
                  planStepId: newStep.id,
                });
                
                const updatedSession = addProbeToSession(latestSession, savedProbe);
                setSession(updatedSession);
                sessionRef.current = updatedSession;
                setActiveProbe(savedProbe);
                setViewingProbeIndex(updatedSession.probes.length - 1);
              }
            }
          } catch (probeErr) {
            console.warn("Failed to generate probe for new step:", probeErr);
          } finally {
            setIsGeneratingProbe(false);
          }
        }
      }
    } catch (err) {
      console.error("Advance step error:", err);
    }
  };

  const handleRollbackToStep = async (stepIndex: number) => {
    if (!session) return;
    const currentSession = sessionRef.current || session;

    // --- Local inference mode: rollback entirely in-browser ---
    if (localInferenceEnabledRef.current) {
      const currentPlan = sessionPlanRef.current;
      if (!currentPlan?.steps?.length) return;

      // Reset steps: target step becomes in_progress, everything after becomes pending
      const updatedSteps = currentPlan.steps.map((s, i) => {
        if (i < stepIndex) return s; // keep completed steps before target
        if (i === stepIndex) return { ...s, status: "in_progress" as const };
        return { ...s, status: "pending" as const };
      });
      const updatedPlan = { ...currentPlan, steps: updatedSteps, currentStepIndex: stepIndex };
      setSessionPlan(updatedPlan);
      sessionPlanRef.current = updatedPlan;

      // Sync to backend
      updateSessionPlan(currentPlan.id, {
        steps: updatedSteps,
        currentStepIndex: stepIndex,
      }).catch(err => console.warn("[LocalInference] Failed to sync rollback to backend:", err));

      // Archive all active probes in-memory
      const activeProbes = currentSession.probes.filter(p => !p.archived);
      let latestSession = currentSession;
      if (activeProbes.length > 0) {
        latestSession = {
          ...currentSession,
          probes: currentSession.probes.map(p => !p.archived ? { ...p, archived: true } : p),
        };
        setSession(latestSession);
        sessionRef.current = latestSession;
      }

      // Generate probe for rolled-back step
      const targetStep = updatedPlan.steps[stepIndex];
      if (targetStep) {
        let probeText = "";
        const manager = LocalInferenceManager.getInstance();
        setIsGeneratingProbe(true);
        if (manager.isReady()) {
          try {
            const ctx = localContextRef.current;
            const snapshot = ctx?.getContext();
            probeText = await manager.generateProbe({
              planGoal: updatedPlan.goal || "",
              currentStep: targetStep.description || "",
              recentTranscripts: snapshot?.recentTranscripts || [],
              toolEvents: snapshot?.toolEvents || [],
              facialSummary: snapshot?.facialSummary,
              eegSummary: snapshot?.eegSummary,
              previousProbes: latestSession.probes.map(p => p.text),
              tutoringLanguage,
            });
          } catch (err) {
            console.warn("[LocalInference] Probe generation failed on rollback:", err);
          }
        }
        setIsGeneratingProbe(false);
        if (probeText && probeText.trim().length > 5) {
          const localProbe: Probe = {
            id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            timestamp: Date.now() - new Date(currentSession.startedAt).getTime(),
            gapScore: 0.5,
            signals: ["local-inference", "manual_step_rollback"],
            text: probeText.trim(),
            requestType: (targetStep.type || "question") as RequestType,
            archived: false,
            starred: false,
            focused: false,
            isRevealed: false,
          };
          const updatedSession = addProbeToSession(latestSession, localProbe);
          setSession(updatedSession);
          sessionRef.current = updatedSession;
          setActiveProbe(localProbe);
          setViewingProbeIndex(updatedSession.probes.length - 1);
          lastProbeTimeRef.current = Date.now();
        } else {
          setPipelineErrors(prev => ({ ...prev, analysis: "Local inference failed to generate a probe for this step." }));
        }
      }
      return;
    }

    // --- API mode (unchanged) ---
    try {
      const res = await fetch("/api/session-plan/rollback-step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id, targetStepIndex: stepIndex }),
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("Rollback step failed:", errorData);
        return;
      }
      
      const { plan: updatedPlan } = await res.json();
      
      // Validate plan before updating
      if (!updatedPlan?.steps?.length || !updatedPlan?.goal) {
        console.warn('[Rollback Step] Received invalid plan, keeping previous state');
        return;
      }
      
      // Update plan state
      setSessionPlan(updatedPlan);
      sessionPlanRef.current = updatedPlan;
      
      // Archive all active probes (clean slate for the rolled-back step)
      const activeProbes = currentSession.probes.filter(p => !p.archived);
      if (activeProbes.length > 0) {
        let sessionWithArchivedProbes = currentSession;
        for (const probe of activeProbes) {
          await archiveProbe(probe.id);
          sessionWithArchivedProbes = {
            ...sessionWithArchivedProbes,
            probes: sessionWithArchivedProbes.probes.map(p => 
              p.id === probe.id ? { ...p, archived: true } : p
            ),
          };
        }
        setSession(sessionWithArchivedProbes);
        sessionRef.current = sessionWithArchivedProbes;
      }
      
      // Generate a probe for the rolled-back step
      const targetStep = updatedPlan.steps?.[stepIndex];
      if (targetStep) {
        setIsGeneratingProbe(true);
        try {
          const probeRes = await fetch("/api/generate-probe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              problem: session.problem,
              gapScore: 0.5,
              signals: ["manual_step_rollback"],
              previousProbes: currentSession.probes.map(p => p.text),
              archivedProbes: currentSession.probes.filter(p => p.archived).map(p => p.text),
              sessionPlan: updatedPlan,
            }),
          });
          
          if (probeRes.ok) {
            const probeData = await probeRes.json();
            if (probeData.probe?.trim()) {
              const latestSession = sessionRef.current || currentSession;
              const savedProbe = await addProbe(session.id, {
                timestamp: Date.now() - new Date(session.startedAt).getTime(),
                gapScore: 0.5,
                signals: ["manual_step_rollback", "plan_step"],
                text: probeData.probe.trim(),
                requestType: probeData.requestType || targetStep.type || "question",
                planStepId: targetStep.id,
              });
              
              const updatedSession = addProbeToSession(latestSession, savedProbe);
              setSession(updatedSession);
              sessionRef.current = updatedSession;
              setActiveProbe(savedProbe);
              setViewingProbeIndex(updatedSession.probes.length - 1);
            }
          }
        } catch (probeErr) {
          console.warn("Failed to generate probe for rolled-back step:", probeErr);
        } finally {
          setIsGeneratingProbe(false);
        }
      }
    } catch (err) {
      console.error("Rollback step error:", err);
    }
  };

  // Populate action handlers ref for pop-out window communication
  useEffect(() => {
    actionHandlersRef.current = {
      startRecording,
      stopRecording,
      handlePause,
      handleResume,
      handleReset,
      handleClose,
      handleArchiveProbe,
      handleToggleFocus,
      handleAdvanceStep,
      handleRollbackToStep,
    };
  }, [startRecording, stopRecording, handlePause, handleResume, handleReset, handleClose, handleArchiveProbe, handleToggleFocus, handleAdvanceStep, handleRollbackToStep]);

  // Auto-pause on browser close/refresh
  useEffect(() => {
    const handleBeforeUnload = async (e: BeforeUnloadEvent) => {
      if (isRecording && session) {
        e.preventDefault();
        await pauseSession(session.id);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isRecording, session]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      if (muteTimerRef.current) clearTimeout(muteTimerRef.current);
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(t => t.stop());
        micStreamRef.current = null;
      }
      handleDisconnectMuse();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isMobile && sessionId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0a] px-6 text-center gap-5">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
          <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white mb-1">{t('session.mobileDetected')}</h2>
          <p className="text-sm text-neutral-400">{t('session.mobileDetectedDesc')}</p>
        </div>
        <a
          href={`/session/mobile/${sessionId}`}
          className="px-6 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black text-sm font-medium rounded-lg transition-colors"
        >
          {t('session.openMobileView')}
        </a>
        <button
          onClick={() => setIsMobile(false)}
          className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors"
        >
          {t('session.continueDesktopAnyway')}
        </button>
      </div>
    );
  }

  if (!session || isSaving) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0a] gap-4">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
        {isSaving && (
          <p className="text-sm text-neutral-500 animate-pulse">{t('session.savingSession')}</p>
        )}
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-[#0a0a0a] overflow-hidden">
      {showWelcomeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative z-10 w-[90vw] max-w-lg p-6 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl">
            <h2 className="text-xl font-semibold text-white mb-2">{t('session.welcomeTitle')}</h2>
            <p className="text-neutral-400 text-sm mb-5">{t('session.welcomeMessage')}</p>
            
            <div className="space-y-3 mb-5">
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-neutral-800 border border-neutral-700 rounded-full flex items-center justify-center text-neutral-300 text-xs font-medium">1</span>
                <p className="text-neutral-300 text-sm pt-0.5">{t('session.pressStart')}</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-neutral-800 border border-neutral-700 rounded-full flex items-center justify-center text-neutral-300 text-xs font-medium">2</span>
                <p className="text-neutral-300 text-sm pt-0.5">{t('session.followPlan')}</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-neutral-800 border border-neutral-700 rounded-full flex items-center justify-center text-neutral-300 text-xs font-medium">3</span>
                <p className="text-neutral-300 text-sm pt-0.5">{t('session.useSidebar')}</p>
              </div>
            </div>

            <p className="text-xs text-neutral-500 mb-5">{t('session.encouragement')}</p>

            {(() => {
              const isSessionReady = sessionPlan && !planLoading && !openingProbeLoading && session?.probes && session.probes.length > 0;
              
              // Phase 1: Language selection (before confirmation)
              if (!languageConfirmed) {
                const isButtonDisabled = planLoading || isPreparing;
                
                return (
                  <>
                    <div className="mb-4">
                      <label className="block text-xs text-neutral-400 mb-2">
                        Tutor language
                      </label>
                      <select
                        value={tutoringLanguage}
                        onChange={(e) => {
                          const newLang = e.target.value as typeof tutoringLanguage;
                          setTutoringLanguage(newLang);
                        }}
                        disabled={isButtonDisabled}
                        className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-neutral-500 disabled:opacity-50"
                      >
                        {tutoringLocales.map((loc) => (
                          <option key={loc} value={loc}>
                            {tutoringLanguageNames[loc]}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className={`mb-4 p-3 rounded-xl border transition-all ${autoAdvance ? 'bg-cyan-500/5 border-cyan-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <div className="relative shrink-0">
                          <input
                            type="checkbox"
                            checked={autoAdvance}
                            onChange={(e) => setAutoAdvance(e.target.checked)}
                            className="sr-only"
                          />
                          <div className={`w-10 h-5.5 rounded-full transition-colors ${autoAdvance ? 'bg-cyan-500' : 'bg-amber-500'}`}>
                            <div className={`absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-transform ${autoAdvance ? 'translate-x-5' : 'translate-x-0.5'}`} />
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
                              ? 'AI decides when to move forward automatically' 
                              : 'You click to advance — AI analyzes but you decide'}
                          </span>
                        </div>
                      </label>
                    </div>

                    {/* Browser Inference Toggle */}
                    <div className={`mb-4 p-3 rounded-xl border transition-all ${
                      localInferenceEnabled 
                        ? 'bg-purple-500/5 border-purple-500/20' 
                        : 'bg-neutral-800/30 border-neutral-700/50'
                    }`}>
                      <label className={`flex items-center gap-3 ${webGPUAvailable ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'} group`}>
                        <div className="relative shrink-0">
                          <input
                            type="checkbox"
                            checked={localInferenceEnabled}
                            onChange={(e) => setLocalInferenceEnabled(e.target.checked)}
                            disabled={!webGPUAvailable}
                            className="sr-only"
                          />
                          <div className={`w-10 h-5.5 rounded-full transition-colors ${localInferenceEnabled ? 'bg-purple-500' : 'bg-neutral-600'}`}>
                            <div className={`absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-transform ${localInferenceEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                          </div>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium leading-tight">
                            <span className={localInferenceEnabled ? 'text-purple-400' : 'text-neutral-400'}>
                              {localInferenceEnabled ? 'Browser Inference ON' : 'Browser Inference'}
                            </span>
                          </span>
                          <span className="text-xs text-neutral-500 leading-tight mt-0.5">
                            {!webGPUAvailable 
                              ? 'WebGPU not available in this browser'
                              : 'A less capable tutor but a faster, more real-time experience'}
                          </span>
                        </div>
                      </label>
                    </div>

                    <button
                      onClick={async () => {
                        if (!session || isPreparing) return;
                        
                        setPrepStage("plan");
                        setIsPreparing(true);
                        setPlanLoading(true);
                        setOpeningProbeLoading(true);
                        setPlanError(null);
                        setModelLoadError(null);
                        setModelLoadProgress(null);
                        
                        try {
                          // Save language to session metadata
                          const { data: sessionData } = await (await import("@/lib/supabase/client")).createClient()
                            .from("sessions")
                            .select("metadata")
                            .eq("id", session.id)
                            .single();
                          if (sessionData?.metadata) {
                            await (await import("@/lib/supabase/client")).createClient()
                              .from("sessions")
                              .update({ metadata: { ...sessionData.metadata, tutoringLanguage } })
                              .eq("id", session.id);
                          }
                          
                          // Check if plan exists - if so, translate it; otherwise create new
                          const existingPlan = await getSessionPlan(session.id);
                          let newPlan = null;
                          
                          if (existingPlan && existingPlan.steps && existingPlan.steps.length > 0 && existingPlan.goal) {
                            if (tutoringLanguage === "en") {
                              // English — no translation needed, use plan as-is
                              newPlan = existingPlan;
                            } else {
                              // Translate existing plan
                              console.log("[SessionView] Attempting to translate plan to:", tutoringLanguage);
                              const translateRes = await fetch("/api/session-plan/translate", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ 
                                  sessionId: session.id, 
                                  tutoringLanguage,
                                  objectives,
                                }),
                              });
                              console.log("[SessionView] Translate response status:", translateRes.status);
                              if (translateRes.ok) {
                                const { plan } = await translateRes.json();
                                newPlan = plan;
                                console.log("[SessionView] Translation succeeded, plan goal:", plan?.goal);
                              } else {
                                const err = await translateRes.json().catch(() => ({}));
                                console.error("[SessionView] Translation failed:", err);
                              }
                            }
                          } 
                          
                          if (!newPlan) {
                            // Create new plan with target language
                            console.log("[SessionView] Creating new plan with language:", tutoringLanguage);
                            const planRes = await fetch("/api/session-plan/create", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ 
                                sessionId: session.id, 
                                problem: session.problem, 
                                objectives,
                                planningPrompt: session.planningPrompt,
                                force: true,
                                tutoringLanguage,
                              }),
                            });
                            console.log("[SessionView] Create plan response status:", planRes.status);
                            if (planRes.ok) {
                              const { plan } = await planRes.json();
                              newPlan = plan;
                              console.log("[SessionView] Created plan goal:", plan?.goal);
                            } else {
                              const errorData = await planRes.json().catch(() => ({}));
                              console.error("[SessionView] Create plan failed:", errorData);
                              setPlanError(errorData.error || "Failed to create session plan");
                            }
                          }
                          
                          if (newPlan) {
                            setSessionPlan(newPlan);
                            sessionPlanRef.current = newPlan;
                          } else {
                            console.error("[SessionView] No plan could be created or translated!");
                            setPlanError("Failed to create session plan. Please try again.");
                          }
                          
                          // Archive existing probes and generate new opening probe
                          if (session.probes.length > 0) {
                            for (const probe of session.probes) {
                              await archiveProbe(probe.id);
                            }
                          }
                          setSession({ ...session, probes: [] });
                          setActiveProbe(null);
                          setViewingProbeIndex(-1);
                          
                          const probeRes = await fetch("/api/opening-probe", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ problem: session.problem, objectives, sessionId: session.id, tutoringLanguage }),
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
                              const updated = addProbeToSession({ ...session, probes: [] }, savedProbe);
                              setSession(updated);
                              sessionRef.current = updated;
                              setActiveProbe(savedProbe);
                              setViewingProbeIndex(updated.probes.length - 1);
                            }
                          }
                          
                          // Plan prep done
                          setPlanLoading(false);
                          setOpeningProbeLoading(false);
                          setLanguageConfirmed(true);

                          // Stage 2: Load local model if enabled
                          if (localInferenceEnabled) {
                            setPrepStage("model");
                            try {
                              const manager = LocalInferenceManager.getInstance();
                              await manager.init((progress) => {
                                setModelLoadProgress(progress);
                              });
                              localContextRef.current = new LocalContextBuffer();
                            } catch (modelErr) {
                              setModelLoadError(modelErr instanceof Error ? modelErr.message : String(modelErr));
                              setIsPreparing(false);
                              return; // Keep modal open to show error
                            }
                          }

                          // All done - Phase 2 will show "Get Started"
                          setPrepStage("done");
                        } catch (err) {
                          console.error("Failed to prepare session:", err);
                          setPlanError("Failed to prepare session");
                        } finally {
                          setPlanLoading(false);
                          setOpeningProbeLoading(false);
                          setIsPreparing(false);
                        }
                      }}
                      disabled={isButtonDisabled}
                      className={`w-full py-2.5 px-4 font-medium rounded-lg transition-colors ${
                        localInferenceEnabled
                          ? 'bg-purple-500 hover:bg-purple-400 text-white disabled:bg-neutral-700 disabled:text-neutral-500'
                          : 'bg-cyan-500 hover:bg-cyan-400 text-neutral-900 disabled:bg-neutral-700 disabled:text-neutral-500'
                      }`}
                    >
                      {isButtonDisabled ? 'Preparing...' : 'Confirm Settings'}
                    </button>

                    {/* Inline loading progress (replaces the separate prep modal) */}
                    {isPreparing && (
                      <div className="mt-4 p-4 bg-neutral-800/50 rounded-xl border border-neutral-700/50">
                        {/* Step indicators */}
                        <div className="space-y-2.5 mb-4">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                              prepStage !== "plan"
                                ? 'bg-green-500 text-black'
                                : 'border border-cyan-500/40 text-cyan-400'
                            }`}>
                              {prepStage !== "plan" ? (
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                              ) : '1'}
                            </div>
                            <span className={`text-xs ${prepStage !== "plan" ? 'text-neutral-500' : 'text-neutral-300'}`}>
                              {prepStage === "plan" ? 'Preparing session plan...' : 'Session plan ready'}
                            </span>
                            {prepStage === "plan" && (
                              <div className="w-3.5 h-3.5 border-2 border-neutral-600 border-t-cyan-500 rounded-full animate-spin ml-auto" />
                            )}
                          </div>

                          {localInferenceEnabled && (
                            <div className="flex items-center gap-2.5">
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                                prepStage === "done"
                                  ? 'bg-green-500 text-black'
                                  : prepStage === "model"
                                    ? 'border border-purple-500/40 text-purple-400'
                                    : 'border border-neutral-700 text-neutral-600'
                              }`}>
                                {prepStage === "done" ? (
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                ) : '2'}
                              </div>
                              <span className={`text-xs ${
                                prepStage === "done" ? 'text-neutral-500' : prepStage === "model" ? 'text-neutral-300' : 'text-neutral-600'
                              }`}>
                                {prepStage === "done" ? 'Local model loaded' : prepStage === "model" ? 'Loading local model...' : 'Load local model'}
                              </span>
                              {prepStage === "model" && !modelLoadProgress && (
                                <div className="w-3.5 h-3.5 border-2 border-neutral-600 border-t-purple-500 rounded-full animate-spin ml-auto" />
                              )}
                            </div>
                          )}
                        </div>

                        {/* Progress bar (only during model download) */}
                        {prepStage === "model" && modelLoadProgress && (
                          <div className="mb-2">
                            <div className="w-full h-1.5 bg-neutral-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all duration-500 ease-out"
                                style={{ width: `${modelLoadProgress.progress}%` }}
                              />
                            </div>
                            <div className="flex justify-between mt-1">
                              <span className="text-[10px] text-neutral-500">
                                {modelLoadProgress.loaded && modelLoadProgress.total
                                  ? `${(modelLoadProgress.loaded / 1024 / 1024).toFixed(0)} / ${(modelLoadProgress.total / 1024 / 1024).toFixed(0)} MB`
                                  : 'Downloading...'}
                              </span>
                              <span className="text-[10px] text-neutral-500">{modelLoadProgress.progress}%</span>
                            </div>
                          </div>
                        )}

                        {/* Errors */}
                        {(planError || modelLoadError) && (
                          <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-lg mt-2">
                            <p className="text-xs text-red-400">{planError || modelLoadError}</p>
                          </div>
                        )}

                        {/* Cancel for model loading errors */}
                        {modelLoadError && (
                          <button
                            onClick={() => {
                              LocalInferenceManager.getInstance().dispose();
                              setModelLoadError(null);
                              setLocalInferenceEnabled(false);
                              setIsPreparing(false);
                              setPrepStage("done");
                              // Plan was already done, let them proceed in API mode
                            }}
                            className="w-full mt-2 py-1.5 text-xs text-neutral-400 hover:text-neutral-300 transition-colors"
                          >
                            Continue without browser inference
                          </button>
                        )}
                      </div>
                    )}

                    {/* Ready to go - show after all prep is done */}
                    {prepStage === "done" && languageConfirmed && !isPreparing && (
                      <button
                        onClick={() => setShowWelcomeModal(false)}
                        className="mt-4 w-full py-2.5 px-4 font-medium rounded-lg transition-colors bg-white hover:bg-neutral-100 text-neutral-900"
                      >
                        {t('session.getStarted')}
                      </button>
                    )}
                  </>
                );
              }
              
              // Phase 2: Ready (already confirmed before, e.g. page refresh)
              return (
                <button
                  onClick={() => setShowWelcomeModal(false)}
                  className="w-full py-2.5 px-4 font-medium rounded-lg transition-colors bg-white hover:bg-neutral-100 text-neutral-900"
                >
                  {t('session.getStarted')}
                </button>
              );
            })()}
          </div>
        </div>
      )}

      <ToolsPanel 
              activeTool={activeTool} 
              onToolChange={(tool) => {
                setActiveTool(tool);
                setShowGrokipediaOnly(tool === "grokipedia");
                // Clear RAG notification when opening RAG tool
                if (tool === "rag") {
                  setRagHasNotification(false);
                }
                if (tool === "grokipedia") {
                  setPrepToolContent(null);
                } else if (tool === "exercise" || tool === "reading") {
                  setPrepToolContent(null);
                  loadPrepToolContent(tool);
                }
              }} 
              problem={session.problem} 
              ragNotification={ragHasNotification}
            />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header removed */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Resizable split view */}
          <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
            <ResizablePane
              defaultLeftWidth={50}
              leftLabel={t('session.tools')}
              rightLabel={t('session.studentMonitoring')}
              storageKey="session-split"
              left={
                <div className="flex flex-col min-w-0 p-4 overflow-hidden h-full relative">
                  {shouldBlockTools && !["data-input", "help", "logs", "rag"].includes(activeTool) ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-6">
                      <div className="w-12 h-12 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center">
                        <svg className="w-6 h-6 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          {isPaused ? (
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
                          ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                          )}
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-neutral-300">
                          {isPaused ? t('session.sessionPaused') : t('session.sessionNotActive')}
                        </p>
                        <p className="text-xs text-neutral-500 mt-1">
                          {isPaused ? t('session.resumeMonitoringToUse') : t('session.startMonitoringToUse')}
                        </p>
                      </div>
                      <button
                        onClick={isPaused ? handleResume : startRecording}
                        className="mt-2 px-5 py-2 bg-cyan-500 hover:bg-cyan-400 text-black text-sm font-medium rounded-lg transition-colors"
                      >
                        {isPaused ? t('session.resumeSession') : t('session.startSession')}
                      </button>
                    </div>
                  ) : (
                  <div className="flex-1 min-h-0 overflow-hidden relative">
                    {activeTool === "chat" && (
                      <LLMChat 
                        problem={session.problem}
                        messages={chatMessages}
                        onMessagesChange={setChatMessages}
                        sessionId={session.id}
                        tutoringLanguage={tutoringLanguage}
                        pendingMessage={pendingChatMessage}
                        onPendingMessageHandled={() => setPendingChatMessage(null)}
                      />
                    )}

                    {activeTool === "canvas" && (
                      <WhiteboardCanvas
                        initialData={whiteboardData || undefined}
                        onCanvasChange={(dataUrl) => {
                          setWhiteboardData(dataUrl);
                          if (sessionRef.current) {
                            sessionRef.current = { ...sessionRef.current, metadata: { ...sessionRef.current.metadata, whiteboardData: dataUrl } };
                          }
                        }}
                      />
                    )}
                    {activeTool === "notebook" && (
                      <div className="h-full rounded-lg border border-neutral-800 bg-neutral-900/50 flex flex-col">
                        <textarea
                          value={notebookContent}
                          onChange={(e) => setNotebookContent(e.target.value)}
                          placeholder={t('session.notebookPlaceholder')}
                          className="flex-1 w-full bg-transparent border-none resize-none p-4 text-sm text-white placeholder-neutral-600 focus:outline-none focus:ring-0"
                        />
                        <div className="shrink-0 px-3 py-2 border-t border-neutral-800">
                          <span className="text-[10px] text-neutral-600">{t('session.characters', { count: notebookContent.length })}</span>
                        </div>
                      </div>
                    )}

                    {activeTool === "rag" && (
                      <div className="h-full p-4 overflow-auto">
                        {ragLoading && (
                          <div className="flex flex-col items-center justify-center h-64">
                            <div className="w-6 h-6 border border-neutral-700 border-t-cyan-500 rounded-full animate-spin mb-3" />
                            <p className="text-sm text-neutral-500">{t('session.findingChunks')}</p>
                          </div>
                        )}
                        {!ragLoading && ragChunks.length === 0 && (
                          <div className="flex flex-col items-center justify-center h-64 gap-4">
                            <p className="text-sm text-neutral-500">{t('session.noChunksFound')}</p>
                            <button
                              onClick={() => runRagMatching()}
                              className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-medium rounded-lg transition-all"
                            >
                              {t('common.retry')}
                            </button>
                          </div>
                        )}
                        {!ragLoading && ragChunks.length > 0 && (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <h3 className="text-sm font-medium text-white">{t('session.matchingChunks')}</h3>
                              <span className="text-xs text-neutral-500">{t('session.chunksFound', { count: ragChunks.length })}</span>
                            </div>
                            
                            {/* Modifier input */}
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={ragModifier}
                                onChange={(e) => setRagModifier(e.target.value)}
                                placeholder={t('session.addModifier')}
                                className="flex-1 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500"
                              />
                              <button
                                onClick={() => runRagMatching(ragModifier)}
                                disabled={ragLoading || !ragModifier.trim()}
                                className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:bg-cyan-500/50 disabled:cursor-not-allowed text-black font-medium rounded-lg transition-all"
                              >
                                {t('common.retry')}
                              </button>
                            </div>

                            {/* Chunks list */}
                            <div className="space-y-3">
                              {ragChunks.map((chunk, idx) => {
                                const isSelected = ragSelectedChunks.has(chunk.id);
                                const isExpanded = ragExpandedChunks.has(chunk.id);
                                const similarityPct = Math.round((chunk.similarity || 0) * 100);
                                
                                return (
                                  <div
                                    key={chunk.id}
                                    className={`rounded-xl border transition-all ${
                                      isSelected 
                                        ? "border-cyan-500/50 bg-cyan-500/5" 
                                        : "border-neutral-800 bg-neutral-900/30"
                                    }`}
                                  >
                                    <div 
                                      className="p-3 flex items-start gap-3 cursor-pointer"
                                      onClick={() => {
                                        if (isExpanded) {
                                          const newExpanded = new Set(ragExpandedChunks);
                                          newExpanded.delete(chunk.id);
                                          setRagExpandedChunks(newExpanded);
                                        } else {
                                          setRagExpandedChunks(new Set(ragExpandedChunks).add(chunk.id));
                                        }
                                      }}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          const newSelected = new Set(ragSelectedChunks);
                                          if (e.target.checked) {
                                            newSelected.add(chunk.id);
                                          } else {
                                            newSelected.delete(chunk.id);
                                          }
                                          setRagSelectedChunks(newSelected);
                                        }}
                                        className="mt-1 w-4 h-4 rounded border-neutral-600 bg-neutral-800 text-cyan-500 focus:ring-cyan-500/50"
                                      />
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                          <span className="text-xs font-medium text-white">{t('session.chunk', { idx: idx + 1 })}</span>
                                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                            similarityPct > 50 
                                              ? "bg-cyan-500/20 text-cyan-400" 
                                              : "bg-neutral-700 text-neutral-400"
                                          }`}>
                                            {t('session.match', { percent: similarityPct })}
                                          </span>
                                          {chunk.topic && (
                                            <span className="text-[10px] text-neutral-500">
                                              {t('session.from', { topic: chunk.topic })}
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-xs text-neutral-400 line-clamp-2">
                                          {chunk.content?.slice(0, 150)}...
                                        </p>
                                        {isExpanded && (
                                          <p className="text-xs text-neutral-400 mt-2 whitespace-pre-wrap">
                                            {chunk.content}
                                          </p>
                                        )}
                                      </div>
                                      <svg 
                                        className={`w-4 h-4 text-neutral-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                                        fill="none" 
                                        viewBox="0 0 24 24" 
                                        stroke="currentColor"
                                      >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                      </svg>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Summary */}
                            <div className="pt-3 border-t border-neutral-800">
                              <p className="text-xs text-neutral-500">
                                {t('session.chunksSelected', { selected: ragSelectedChunks.size, total: ragChunks.length })}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {/* Bottom tools wrapper */}
                    <div className="mt-auto flex flex-col">
                      {activeTool === "help" && <ToolsHelp />}
                      <div className={activeTool === "data-input" ? "h-full" : "hidden"}>
                      <DataInputTool
                        isRecording={isRecording}
                        sessionId={session?.id}
                        audioStream={stream}
                        museStatus={museStatus}
                        museError={museError}
                        museChannelData={eegChannelData}
                        bandPowers={bandPowers}
                        onConnectMuse={handleConnectMuse}
                        onDisconnectMuse={handleDisconnectMuse}
                        isWebcamEnabled={isWebcamEnabled}
                        onWebcamToggle={() => setIsWebcamEnabled(prev => !prev)}
                        latestFacialData={latestFacialData}
                        onFacialData={handleFacialData}
                        onFaceError={handleFaceError}
                        isScreenCapturing={isScreenCapturing}
                        onStartScreenCapture={handleStartScreenCapture}
                        onStopScreenCapture={handleStopScreenCapture}
                        screenshotCount={screenshotCount}
                      />
                    </div>
                    {activeTool === "logs" && (
                      <LogsTool
                        logs={logs}
                        transferHealth={transferHealth}
                        onClear={() => {
                          logsRef.current = [];
                          setLogs([]);
                        }}
                      />
                    )}
                    </div>
                    {(activeTool === "grokipedia" || activeTool === "exercise" || activeTool === "reading") && (
                      <div className="h-full p-4 overflow-auto">
                        {activeTool === "grokipedia" && showGrokipediaOnly && session?.problem && (
                          <div className="flex flex-col items-center justify-center h-full gap-6">
                            <div className="text-center">
                              <h3 className="text-lg font-medium text-white mb-2">{t('session.grokipedia')}</h3>
                              <p className="text-sm text-neutral-400">{t('session.grokipediaDesc')}</p>
                            </div>
                            <a
                              href={`https://grokipedia.com/search?q=${encodeURIComponent(session.problem)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-medium rounded-xl transition-all inline-flex items-center gap-2"
                            >
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <circle cx="12" cy="12" r="10" />
                                <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                              </svg>
                              {t('session.openGrokipedia')}
                            </a>
                          </div>
                        )}
                        {((activeTool === "grokipedia" && !showGrokipediaOnly) || activeTool === "exercise" || activeTool === "reading") && !prepToolContent && !prepToolLoading && (
                          <div className="flex flex-col items-center justify-center h-full gap-4">
                            <button
                              onClick={() => loadPrepToolContent(activeTool)}
                              className="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-medium rounded-xl transition-all"
                            >
                              {activeTool === "exercise" ? t('session.loadPractice') : t('session.loadTheory')}
                            </button>
                          </div>
                        )}
                        {prepToolLoading && (
                          <div className="flex flex-col items-center justify-center h-full">
                            <div className="w-6 h-6 border border-neutral-700 border-t-cyan-500 rounded-full animate-spin mb-3" />
                            <p className="text-sm text-neutral-500">{t('common.loading')}</p>
                          </div>
                        )}
                        {prepToolContent && !prepToolLoading && (
                          <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6">
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="text-lg font-medium text-white">{prepToolContent.title}</h3>
                              {(activeTool === "exercise" || activeTool === "reading") && (
                                <button
                                  onClick={() => loadPrepToolContent(activeTool)}
                                  className="px-3 py-1.5 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white rounded-lg transition-colors"
                                >
                                  {t('session.loadAnother')}
                                </button>
                              )}
                            </div>
                            <div className="prose prose-invert prose-sm max-w-none text-neutral-300">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm, remarkMath]}
                                rehypePlugins={[rehypeKatex]}
                                components={activeTool === "reading" ? {
                                  a: ({ href, children }) => (
                                    <a
                                      href={href}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="no-underline inline-flex items-center gap-1.5 px-3 py-1.5 my-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/25 hover:bg-blue-500/20 hover:border-blue-500/40 hover:text-blue-300 transition-all text-sm font-medium"
                                    >
                                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                      </svg>
                                      {children}
                                    </a>
                                  ),
                                } : undefined}
                              >
                                {prepToolContent.content}
                              </ReactMarkdown>
                            </div>
                            {activeTool === "grokipedia" && session?.problem && (
                              <a
                                href={`https://grokipedia.com/search?q=${encodeURIComponent(session.problem)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-4 inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 text-sm"
                              >
                                {t('session.openGrokipedia')}
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  )}
                </div>
              }
              right={
                <ProbeNotifications
                  sessionId={session.id}
                  probes={session.probes}
                  sessionPlan={sessionPlan}
                  objectives={objectives}
                  objectiveStatuses={objectiveStatuses}
                  isRecording={isRecording}
                  isPaused={isPaused}
                  stream={stream}
                  onStartRecording={startRecording}
                  onStopRecording={stopRecording}
                  onPause={handlePause}
                  onResume={handleResume}
                  elapsedSeconds={elapsedSeconds}
                  storageBeat={storageBeat}
                  analysisBeat={analysisBeat}
                  isAnalyzing={isAnalyzing}
                  onArchiveProbe={handleArchiveProbe}
                  onToggleFocus={handleToggleFocus}
                  onToolSelect={(tool) => setActiveTool(tool as Tool)}
                  onReset={handleReset}
                  onClose={handleClose}
                  archivingProbeId={archivingProbeId}
                  planLoading={planLoading}
                  planError={planError}
                  onAdvanceStep={handleAdvanceStep}
                  onRollbackToStep={handleRollbackToStep}
                   autoAdvance={autoAdvance}
                   onToggleAutoAdvance={setAutoAdvance}
                   onOpenResources={handleStepResources}
                   onOpenPractice={handleStepPractice}
                   onAskAssistant={handleStepAskAssistant}
                   isInitializing={planLoading || openingProbeLoading}
                   isCelebrating={isCelebrating}
                   isGeneratingProbe={isGeneratingProbe}
                />
              }
            />
          </div>



          {/* Pop-out active banner - uses DOM manipulation to avoid re-renders */}
          <PopOutBanner 
            isVisible={isPopOutActive} 
            popOutWindowRef={popOutWindowRef}
            onDismiss={() => {
              popOutDismissedRef.current = true; // Prevent banner from re-appearing
              setIsPopOutActive(false);
              popOutWindowRef.current = null;
            }}
          />


        </div>
      </div>
      {showEndDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 max-w-md mx-4">
            <h3 className="text-base font-semibold text-white mb-2">{t('session.tutorSuggestsEnd')}</h3>
            <p className="text-neutral-400 mb-5 text-sm leading-relaxed">{endReason}</p>
            <div className="flex gap-2.5">
              <button onClick={() => setShowEndDialog(false)} className="flex-1 py-2.5 text-sm text-neutral-400 border border-neutral-700 hover:border-neutral-500 rounded-xl transition-colors">
                {t('common.keepGoing')}
              </button>
              <button onClick={handleConfirmEnd} className="flex-1 py-2.5 text-sm text-white bg-white/10 hover:bg-white/15 rounded-xl transition-colors">
                {t('sessionEnd.endSession')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SessionPrepModal removed -- loading progress now inline in welcome modal */}

      {/* Plan Complete Modal - shown when all steps are done */}
      {showPlanCompleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative z-10 w-[90vw] max-w-lg p-6 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-white">{t('session.sessionComplete')}</h2>
            </div>
            
            <p className="text-neutral-400 text-sm mb-6">
              {t('session.congratulationsComplete')}
            </p>

            <button
              onClick={() => {
                setShowPlanCompleteModal(false);
                handleConfirmEnd();
              }}
              className="w-full py-2.5 px-4 bg-white hover:bg-neutral-100 text-neutral-900 font-medium rounded-lg transition-colors"
            >
              {t('sessionEnd.endSession')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Band Power Computation ----

function computeBandPowers(af7: number[], af8: number[]) {
  const n = 256;
  const sampleRate = 256;
  const bandRanges: Record<string, [number, number]> = {
    delta: [1, 4], theta: [4, 8], alpha: [8, 13], beta: [13, 30], gamma: [30, 44],
  };

  function channelBands(samples: number[]) {
    const windowed = samples.map((s, i) => s * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1))));
    const powers: Record<string, number> = {};
    for (const [band, [fLow, fHigh]] of Object.entries(bandRanges)) {
      let power = 0;
      const binLow = Math.floor((fLow * n) / sampleRate);
      const binHigh = Math.min(Math.ceil((fHigh * n) / sampleRate), n / 2);
      for (let k = binLow; k <= binHigh; k++) {
        let re = 0, im = 0;
        for (let j = 0; j < n; j++) {
          const angle = (2 * Math.PI * k * j) / n;
          re += windowed[j] * Math.cos(angle);
          im -= windowed[j] * Math.sin(angle);
        }
        power += (re * re + im * im) / (n * n);
      }
      powers[band] = power;
    }
    return powers;
  }

  const p1 = channelBands(af7.slice(-n));
  const p2 = channelBands(af8.slice(-n));
  const avg: Record<string, number> = {};
  for (const band of Object.keys(bandRanges)) avg[band] = ((p1[band] || 0) + (p2[band] || 0)) / 2;

  const total = Object.values(avg).reduce((s, v) => s + v, 0);
  if (total > 0) for (const band of Object.keys(avg)) avg[band] /= total;

  return { delta: avg.delta || 0, theta: avg.theta || 0, alpha: avg.alpha || 0, beta: avg.beta || 0, gamma: avg.gamma || 0 };
}


