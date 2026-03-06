"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { AudioRecorder, blobToBase64 } from "@/lib/audio";
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
  type Session,
  type Probe,
  type ObserverMode,
  type Frequency,
  type ToolName,
  type ToolAction,
} from "@/lib/storage";
import { formatTime } from "@/lib/utils";
import { AudioVisualizer, RecordingIndicator } from "./AudioVisualizer";
import { ActiveProbe } from "./ActiveProbe";
import { ProbeNotifications } from "./ProbeNotifications";
import { ResizablePane } from "./ResizablePane";
import { WhiteboardCanvas } from "./WhiteboardCanvas";
import { ToolsPanel, type Tool } from "./ToolsPanel";
import { ToolsHelp } from "./ToolsHelp";
import { LLMChat } from "./LLMChat";
import { DataInputTool } from "./DataInputTool";
import { LogsTool, type LogEntry } from "./LogsTool";

// Configuration
const ANALYSIS_INTERVALS: Record<Frequency, number> = {
  rare: 15000,
  balanced: 8000,
  frequent: 4000,
};
const COOLDOWN_AFTER_PROBE_MS = 15000;

export function SessionView({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  const [whiteboardAnalyzing, setWhiteboardAnalyzing] = useState(false);
  const whiteboardAnalysisRef = useRef<NodeJS.Timeout | null>(null);
  const lastWhiteboardAnalysisRef = useRef(0);

  // Notebook
  const [showNotebook, setShowNotebook] = useState(false);
  const [notebookContent, setNotebookContent] = useState("");
  const [notebookAnalyzing, setNotebookAnalyzing] = useState(false);
  const notebookAnalysisRef = useRef<NodeJS.Timeout | null>(null);
  const lastNotebookAnalysisRef = useRef(0);

  // New 3-panel layout state
  const [activeTool, setActiveTool] = useState<Tool>("chat");
  const prevToolRef = useRef<Tool | null>(null);
  const [objectives, setObjectives] = useState<string[]>([]);
  const [objectiveStatuses, setObjectiveStatuses] = useState<("red" | "yellow" | "green" | "blue")[]>([]);
  const [trafficLight, setTrafficLight] = useState<"red" | "yellow" | "green">("green");
  const [currentProbeRevealed, setCurrentProbeRevealed] = useState(true);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [stuckLoading, setStuckLoading] = useState(false);

  // Mobile tabs
  const [mobileTab, setMobileTab] = useState<"main" | "canvas" | "notes" | "questions" | "prep">("main");

  // Error tracking for recording pipeline
  const [pipelineErrors, setPipelineErrors] = useState<{
    analysis?: string;
    transcription?: string;
    storage?: string;
  }>({});

  // Welcome modal
  const [showWelcomeModal, setShowWelcomeModal] = useState(true);

  // Block ILE tools when not actively monitoring
  const shouldBlockTools = session && !showWelcomeModal && (!isRecording || isPaused);

  // Prep material for tools
  const [prepToolContent, setPrepToolContent] = useState<{ title: string; content: string } | null>(null);
  const [prepToolLoading, setPrepToolLoading] = useState(false);
  const [showGrokipediaOnly, setShowGrokipediaOnly] = useState(false);

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
    
    prevToolRef.current = activeTool;
  }, [activeTool, session?.id, session?.startedAt]);

  const loadPrepToolContent = async (type: string) => {
    if (!session?.problem) return;
    if (type === "grokipedia") {
      setShowGrokipediaOnly(true);
      setPrepToolContent(null);
      return;
    }
    setShowGrokipediaOnly(false);
    setPrepToolLoading(true);
    try {
      const response = await fetch(`/api/prep-material?topic=${encodeURIComponent(session.problem)}&type=${type}`);
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
  const [facialDataBuffer, setFacialDataBuffer] = useState<Array<{
    timestamp: number;
    facePresent: boolean;
    blinkRate: number;
    gazeDirection: "at_camera" | "away" | "unknown";
    headPose: { pitch: number; yaw: number; roll: number };
    mouthState: "open" | "closed";
    faceDistance: "optimal" | "too_close" | "too_far";
    engagementScore: number;
  }>>([]);
  const facialBufferRef = useRef<Array<{
    timestamp: number;
    facePresent: boolean;
    blinkRate: number;
    gazeDirection: "at_camera" | "away" | "unknown";
    headPose: { pitch: number; yaw: number; roll: number };
    mouthState: "open" | "closed";
    faceDistance: "optimal" | "too_close" | "too_far";
    engagementScore: number;
  }>>([]);

  // Logs
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logsRef = useRef<LogEntry[]>([]);

  // Refs for interval callbacks
  const recorderRef = useRef<AudioRecorder | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const analysisRef = useRef<NodeJS.Timeout | null>(null);
  const eegSaveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastProbeTimeRef = useRef(0);
  const lastAnalysisTimeRef = useRef(0);
  const isAnalyzingRef = useRef(false);
  const muteTimerRef = useRef<NodeJS.Timeout | null>(null);
  const probeContainerRef = useRef<HTMLDivElement | null>(null);
  const chunkIndexRef = useRef(0);
  const eegChunkIndexRef = useRef(0);
  const facialChunkIndexRef = useRef(0);
  const observerModeRef = useRef(observerMode);
  const frequencyRef = useRef(frequency);
  const isMutedRef = useRef(isMuted);
  const whiteboardDataRef = useRef(whiteboardData);
  const notebookContentRef = useRef(notebookContent);
  const activeToolRef = useRef(activeTool);
  const objectivesRef = useRef(objectives);
  const trafficLightRef = useRef(trafficLight);

  // Keep refs in sync
  useEffect(() => { observerModeRef.current = observerMode; }, [observerMode]);
  useEffect(() => { frequencyRef.current = frequency; }, [frequency]);
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
  useEffect(() => { whiteboardDataRef.current = whiteboardData; }, [whiteboardData]);
  useEffect(() => { notebookContentRef.current = notebookContent; }, [notebookContent]);
  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);
  useEffect(() => { objectivesRef.current = objectives; }, [objectives]);
  useEffect(() => { trafficLightRef.current = trafficLight; }, [trafficLight]);

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

        // Fire opening probe immediately so it shows before Start
        if (s.probes.length === 0) {
          setOpeningProbeLoading(true);
          try {
            const res = await fetch("/api/opening-probe", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ problem: s.problem }),
            });
            if (!cancelled && res.ok) {
              const { probe: probeText } = await res.json();
              const savedProbe = await addProbe(s.id, {
                timestamp: 0,
                gapScore: 0,
                signals: ["opening"],
                text: probeText,
                isRevealed: false,
              });
              const updated = addProbeToSession(s, savedProbe);
              setSession(updated);
              sessionRef.current = updated;
              setActiveProbe(savedProbe);
              setViewingProbeIndex(updated.probes.length - 1);
              setCurrentProbeRevealed(false);
            }
          } catch { /* opening probe is optional */ }
          finally { if (!cancelled) setOpeningProbeLoading(false); }
        } else {
          // Session already has probes (e.g. page refresh) — show the latest
          const lastProbe = s.probes[s.probes.length - 1];
          setActiveProbe(lastProbe);
          setViewingProbeIndex(s.probes.length - 1);
          setCurrentProbeRevealed(lastProbe.isRevealed ?? true);
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
          console.log("[SessionView] Calibration response:", { 
            chunks: data.chunks?.length, 
            chunkCount: data.relevantChunkCount,
            problem: session.problem 
          });
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

  // ---- Audio Analysis ----
  const analyzeAudio = useCallback(async () => {
    const recorder = recorderRef.current;
    const currentSession = sessionRef.current;

    if (!recorder || !currentSession) return;
    if (observerModeRef.current === "off") return;
    if (isMutedRef.current) return;
    if (Date.now() - lastProbeTimeRef.current < COOLDOWN_AFTER_PROBE_MS) return;
    if (isAnalyzingRef.current) return;
    if (Date.now() - lastAnalysisTimeRef.current < 3000) return;

    const recentAudio = recorder.getRecentAudio(15000);
    if (!recentAudio || recentAudio.size < 1000) return;

    isAnalyzingRef.current = true;
    lastAnalysisTimeRef.current = Date.now();
    setIsAnalyzing(true);

    try {
      const audioBase64 = await blobToBase64(recentAudio);
      const audioFormat = recorder.getAudioFormat();

      const gapRes = await fetch("/api/analyze-gap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          audioBase64, 
          audioFormat, 
          problem: currentSession.problem,
          whiteboardData: whiteboardDataRef.current,
        }),
      });

      // Clear previous errors on successful response
      setPipelineErrors(prev => ({ ...prev, analysis: undefined, transcription: undefined }));

      if (!gapRes.ok) {
        setPipelineErrors(prev => ({ ...prev, analysis: "Analysis service unavailable" }));
        return;
      }
      const gapData = await gapRes.json();

      // Check for transcription errors
      if (gapData.error === "transcription_failed") {
        setPipelineErrors(prev => ({ ...prev, transcription: "Transcription failed - audio may be unclear" }));
      }

      // Update traffic light
      if (gapData.trafficLight) {
        setTrafficLight(gapData.trafficLight);
      }

      // Update objective statuses based on analysis
      if (objectiveStatuses.length > 0 && gapData.gapScore !== undefined) {
        setObjectiveStatuses(prev => {
          const newStatuses = [...prev];
          // Update a random objective based on gap score
          // Lower gap score = better progress = greener
          // Higher gap score = struggling = redder
          const statusToSet: "red" | "yellow" | "green" = 
            gapData.gapScore >= 0.7 ? "red" : 
            gapData.gapScore >= 0.4 ? "yellow" : "green";
          
          // Update a random objective to show progress (round-robin style)
          const idxToUpdate = currentSession.probes.length % newStatuses.length;
          newStatuses[idxToUpdate] = statusToSet;
          return newStatuses;
        });
      }

      const threshold = observerModeRef.current === "passive" ? 0.7 : 0.5;
      if (gapData.gapScore >= threshold) {
        const probeRes = await fetch("/api/generate-probe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            problem: currentSession.problem,
            transcript: gapData.transcript || "",
            gapScore: gapData.gapScore,
            signals: gapData.signals || [],
            previousProbes: currentSession.probes.map((p) => p.text),
          }),
        });

        if (probeRes.ok) {
          const { probe: probeText } = await probeRes.json();

          // Gate: don't add new probe if last one hasn't been revealed
          const lastProbe = currentSession.probes[currentSession.probes.length - 1];
          if (lastProbe && !lastProbe.isRevealed) {
            return;
          }

          // Persist probe to Supabase
          const savedProbe = await addProbe(currentSession.id, {
            timestamp: Date.now() - new Date(currentSession.startedAt).getTime(),
            gapScore: gapData.gapScore,
            signals: gapData.signals || [],
            text: probeText,
            isRevealed: false,
          });

          const updatedSession = addProbeToSession(currentSession, savedProbe);
          setSession(updatedSession);
          sessionRef.current = updatedSession;

          setActiveProbe(savedProbe);
          setViewingProbeIndex(updatedSession.probes.length - 1);
          setCurrentProbeRevealed(false);
          lastProbeTimeRef.current = Date.now();
        }
      }

      // Check if tutor suggests ending
      if (currentSession.probes.length > 3) {
        try {
          const endRes = await fetch("/api/check-session-end", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              problem: currentSession.problem,
              probeCount: currentSession.probes.length,
              elapsedMs: Date.now() - new Date(currentSession.startedAt).getTime(),
              recentProbes: currentSession.probes.slice(-3).map((p) => p.text),
            }),
          });
          if (endRes.ok) {
            const endData = await endRes.json();
            if (endData.shouldEnd) {
              setEndReason(endData.reason || "Looks like you've covered enough ground.");
              setShowEndDialog(true);
            }
          }
        } catch { /* silent */ }
      }
    } catch (err) {
      console.error("Analysis error:", err);
    } finally {
      isAnalyzingRef.current = false;
      setIsAnalyzing(false);
    }
  }, []);

  // ---- Whiteboard Analysis ----
  const analyzeWhiteboard = useCallback(async () => {
    const currentWhiteboardData = whiteboardDataRef.current;
    const currentSession = sessionRef.current;
    const now = Date.now();

    if (!currentWhiteboardData || !currentSession) return;
    if (!isRecording) return;
    if (now - lastWhiteboardAnalysisRef.current < 5000) return; // 5s cooldown
    if (Date.now() - lastProbeTimeRef.current < COOLDOWN_AFTER_PROBE_MS) return;

    lastWhiteboardAnalysisRef.current = now;
    setWhiteboardAnalyzing(true);

    try {
      // Extract base64 data from data URL if needed
      const base64Data = currentWhiteboardData.replace(/^data:image\/\w+;base64,/, "");

      const res = await fetch("/api/analyze-whiteboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64Data, problem: currentSession.problem }),
      });

      if (!res.ok) return;
      const data = await res.json();

      if (data.shouldProbe && data.gapScore >= 0.5) {
        const probeRes = await fetch("/api/generate-probe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            problem: currentSession.problem,
            transcript: `Whiteboard observation: ${data.observation}`,
            gapScore: data.gapScore,
            signals: data.signals || ["whiteboard_confusion"],
            previousProbes: currentSession.probes.map((p) => p.text),
          }),
        });

        if (probeRes.ok) {
          const { probe: probeText } = await probeRes.json();
          
          // Gate: don't add new probe if last one hasn't been revealed
          const lastProbe = currentSession.probes[currentSession.probes.length - 1];
          if (lastProbe && !lastProbe.isRevealed) {
            return;
          }

          const savedProbe = await addProbe(currentSession.id, {
            timestamp: Date.now() - new Date(currentSession.startedAt).getTime(),
            gapScore: data.gapScore,
            signals: data.signals || ["whiteboard_confusion"],
            text: probeText,
          });
          const updatedSession = addProbeToSession(currentSession, savedProbe);
          setSession(updatedSession);
          sessionRef.current = updatedSession;
          setActiveProbe(savedProbe);
          setViewingProbeIndex(updatedSession.probes.length - 1);
          lastProbeTimeRef.current = Date.now();
        }
      }
    } catch (err) {
      console.error("Whiteboard analysis error:", err);
    } finally {
      setWhiteboardAnalyzing(false);
    }
  }, []);

  // ---- Notebook Analysis ----
  const analyzeNotebook = useCallback(async () => {
    const currentNotebookContent = notebookContentRef.current;
    const currentSession = sessionRef.current;
    const now = Date.now();

    if (!currentNotebookContent || currentNotebookContent.trim().length < 20) return;
    if (!currentSession) return;
    if (!isRecording) return;
    if (now - lastNotebookAnalysisRef.current < 5000) return; // 5s cooldown
    if (Date.now() - lastProbeTimeRef.current < COOLDOWN_AFTER_PROBE_MS) return;

    lastNotebookAnalysisRef.current = now;
    setNotebookAnalyzing(true);

    try {
      const res = await fetch("/api/analyze-notebook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          content: currentNotebookContent, 
          problem: currentSession.problem,
        }),
      });

      if (!res.ok) return;
      const data = await res.json();

      if (data.shouldProbe && data.gapScore >= 0.5) {
        const probeRes = await fetch("/api/generate-probe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            problem: currentSession.problem,
            transcript: `Notebook notes: ${data.observation}`,
            gapScore: data.gapScore,
            signals: data.signals || ["notebook_confusion"],
            previousProbes: currentSession.probes.map((p) => p.text),
          }),
        });

        if (probeRes.ok) {
          const { probe: probeText } = await probeRes.json();
          
          // Gate: don't add new probe if last one hasn't been revealed
          const lastProbe = currentSession.probes[currentSession.probes.length - 1];
          if (lastProbe && !lastProbe.isRevealed) {
            return;
          }

          const savedProbe = await addProbe(currentSession.id, {
            timestamp: Date.now() - new Date(currentSession.startedAt).getTime(),
            gapScore: data.gapScore,
            signals: data.signals || ["notebook_confusion"],
            text: probeText,
          });
          const updatedSession = addProbeToSession(currentSession, savedProbe);
          setSession(updatedSession);
          sessionRef.current = updatedSession;
          setActiveProbe(savedProbe);
          setViewingProbeIndex(updatedSession.probes.length - 1);
          lastProbeTimeRef.current = Date.now();
        }
      }
    } catch (err) {
      console.error("Notebook analysis error:", err);
    } finally {
      setNotebookAnalyzing(false);
    }
  }, []);

  // Debounced whiteboard analysis when data changes
  useEffect(() => {
    if (!showWhiteboard || !whiteboardData || !isRecording) return;

    if (whiteboardAnalysisRef.current) {
      clearTimeout(whiteboardAnalysisRef.current);
    }

    whiteboardAnalysisRef.current = setTimeout(() => {
      analyzeWhiteboard();
    }, 2000); // Analyze 2 seconds after user stops drawing

    return () => {
      if (whiteboardAnalysisRef.current) {
        clearTimeout(whiteboardAnalysisRef.current);
      }
    };
  }, [whiteboardData, showWhiteboard, isRecording, analyzeWhiteboard]);

  // Debounced notebook analysis when content changes
  useEffect(() => {
    if (!showNotebook || !notebookContent || !isRecording) return;

    if (notebookAnalysisRef.current) {
      clearTimeout(notebookAnalysisRef.current);
    }

    notebookAnalysisRef.current = setTimeout(() => {
      analyzeNotebook();
    }, 3000); // Analyze 3 seconds after user stops typing

    return () => {
      if (notebookAnalysisRef.current) {
        clearTimeout(notebookAnalysisRef.current);
      }
    };
  }, [notebookContent, showNotebook, isRecording, analyzeNotebook]);

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
    } catch {
      setMicStatus("denied");
      setError("Microphone access denied. Please allow microphone permission in your browser settings and try again.");
    }
  };

  const startRecording = async () => {
    try {
      setError(null);

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
        onChunk: async (chunk) => {
          if (session) {
            const idx = chunkIndexRef.current++;
            console.log("[onChunk] Processing chunk:", { idx, chunkIndex: chunk.chunkIndex, blobSize: chunk.blob.size, blobType: chunk.blob.type });
            try {
              await saveAudioChunk(session.id, chunk.blob, idx, chunk.timestamp);
              
              const formData = new FormData();
              formData.append("audio", chunk.blob);
              formData.append("session_id", session.id);
              formData.append("chunk_index", chunk.chunkIndex.toString());
              formData.append("timestamp_ms", chunk.timestamp.toString());
              
              const transcribeRes = await fetch("/api/transcribe-chunk", {
                method: "POST",
                body: formData,
              });
              
              if (!transcribeRes.ok) {
                console.error("Transcription failed for chunk", chunk.chunkIndex);
              } else {
                const transcribeData = await transcribeRes.json();
                console.log("[onChunk] Transcription result:", { chunkIndex: chunk.chunkIndex, transcriptLength: transcribeData.transcript?.length, wordCount: transcribeData.wordCount });
              }
              
              setPipelineErrors(prev => ({ ...prev, storage: undefined, transcription: undefined }));
            } catch (err) {
              console.error("Chunk storage error:", err);
              setPipelineErrors(prev => ({ ...prev, storage: "Failed to save audio chunk" }));
            }
          }
        }
      });
      recorderRef.current = recorder;
      await recorder.start(mediaStream);
      setIsRecording(true);

      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);

      analysisRef.current = setInterval(() => {
        analyzeAudio();
      }, ANALYSIS_INTERVALS[frequency]);

      eegSaveIntervalRef.current = setInterval(async () => {
        if (!isRecording) return;
        
        if (session && museStatus === "streaming" && eegBufferRef.current.size > 0) {
          console.log("[EEG] Saving periodic EEG data...");
          const channels: Record<string, number[]> = {};
          for (const [ch, samples] of eegBufferRef.current.entries()) {
            channels[ch] = samples.slice();
          }
          const eegIdx = eegChunkIndexRef.current++;
          await saveSessionEEG(session.id, { channels, bandPowers }, museClientRef.current?.deviceName, eegIdx, Date.now());
        }
        if (session && isRecording && isWebcamEnabled && facialBufferRef.current.length > 0) {
          console.log("[Facial] Saving periodic facial data...", { dataPoints: facialBufferRef.current.length });
          const facialIdx = facialChunkIndexRef.current++;
          await saveFacialData(session.id, facialBufferRef.current, facialIdx, Date.now());
        }
      }, 60000);
    } catch {
      setError("Could not access microphone. Please grant permission and try again.");
    }
  };

  const stopRecording = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (analysisRef.current) clearInterval(analysisRef.current);
    if (eegSaveIntervalRef.current) clearInterval(eegSaveIntervalRef.current);

    const recorder = recorderRef.current;
    
    console.log("[stopRecording] Recorder state:", {
      hasRecorder: !!recorder,
      chunkCount: recorder?.getChunkCount?.() || 0,
      isRecording: recorder?.getIsRecording(),
      bufferDuration: recorder?.getBufferDuration(),
    });
    
    const fullAudio = recorder?.getFullAudio() ?? null;
    
    console.log("[stopRecording] Full audio:", {
      exists: !!fullAudio,
      size: fullAudio?.size,
      type: fullAudio?.type,
    });
    
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

    // Save audio first before navigating - it needs to be done before results page loads
    if (fullAudio) {
      console.log("[stopRecording] Saving audio:", { 
        hasAudio: !!fullAudio, 
        size: fullAudio.size, 
        type: fullAudio.type 
      });
      await saveSessionAudio(finalSession.id, fullAudio);
      console.log("[stopRecording] Audio saved successfully");

      // Trigger transcription for RAG
      console.log("[stopRecording] Starting transcription for RAG...");
      const audioBase64 = await blobToBase64(fullAudio);
      try {
        const transcriptResponse = await fetch("/api/process-session-transcript", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: finalSession.id,
            audioBase64,
            audioFormat: fullAudio.type.split("/")[1] || "webm",
          }),
        });
        if (transcriptResponse.ok) {
          console.log("[stopRecording] Transcription completed successfully");
        } else {
          console.warn("[stopRecording] Transcription failed:", await transcriptResponse.text());
        }
      } catch (transcribeErr) {
        console.error("[stopRecording] Transcription error:", transcribeErr);
      }
    } else {
      console.log("[stopRecording] No audio to save - fullAudio is null");
    }

    // Save EEG data before navigating
    if (museStatus === "streaming" && eegBufferRef.current.size > 0) {
      console.log("[stopRecording] Saving EEG data...");
      const channels: Record<string, number[]> = {};
      for (const [ch, samples] of eegBufferRef.current.entries()) {
        channels[ch] = samples;
      }
      await saveSessionEEG(finalSession.id, { channels, bandPowers }, museClientRef.current?.deviceName);
      console.log("[stopRecording] EEG data saved successfully");
    }

    handleDisconnectMuse();

    // Navigate after all data is saved
    router.push(`/results?id=${finalSession.id}`);

    handleDisconnectMuse();
  };

  const handlePause = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (analysisRef.current) clearInterval(analysisRef.current);
    if (eegSaveIntervalRef.current) clearInterval(eegSaveIntervalRef.current);

    const recorder = recorderRef.current;
    await recorder?.stop();
    recorderRef.current = null;

    if (stream) { stream.getTracks().forEach((t) => t.stop()); setStream(null); }
    
    setIsRecording(false);
    setIsPaused(true);

    if (session) {
      await pauseSession(session.id);
    }
  };

  const handleResume = async () => {
    if (!session) return;

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStream(mediaStream);

      const AudioRecorderClass = (await import("@/lib/audio")).AudioRecorder;
      const recorder = new AudioRecorderClass({
        chunkDurationMs: 60000,
        maxBufferDurationMs: 300000,
        onChunk: async (chunk) => {
          const idx = chunkIndexRef.current++;
          console.log("[onChunk] Processing chunk (resume):", { idx, chunkIndex: chunk.chunkIndex, blobSize: chunk.blob.size, blobType: chunk.blob.type });
          try {
            await saveAudioChunk(session.id, chunk.blob, idx, chunk.timestamp);
            
            const formData = new FormData();
            formData.append("audio", chunk.blob);
            formData.append("session_id", session.id);
            formData.append("chunk_index", chunk.chunkIndex.toString());
            formData.append("timestamp_ms", chunk.timestamp.toString());
            
            const transcribeRes = await fetch("/api/transcribe-chunk", {
              method: "POST",
              body: formData,
            });
            
            if (!transcribeRes.ok) {
              console.error("Transcription failed for chunk", chunk.chunkIndex);
            } else {
              const transcribeData = await transcribeRes.json();
              console.log("[onChunk] Transcription result:", { chunkIndex: chunk.chunkIndex, transcriptLength: transcribeData.transcript?.length, wordCount: transcribeData.wordCount });
            }
            
            setPipelineErrors(prev => ({ ...prev, storage: undefined, transcription: undefined }));
          } catch (err) {
            console.error("Chunk storage error:", err);
            setPipelineErrors(prev => ({ ...prev, storage: "Failed to save audio chunk" }));
          }
        }
      });
      await recorder.start(mediaStream);
      recorderRef.current = recorder;

      setIsRecording(true);
      setIsPaused(false);
      chunkIndexRef.current = 0;

      await resumeSession(session.id);

      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);

      analysisRef.current = setInterval(() => {
        analyzeAudio();
      }, ANALYSIS_INTERVALS[frequency]);

      eegSaveIntervalRef.current = setInterval(async () => {
        if (!isRecording) return;
        
        if (session && museStatus === "streaming" && eegBufferRef.current.size > 0) {
          console.log("[EEG] Saving periodic EEG data...");
          const channels: Record<string, number[]> = {};
          for (const [ch, samples] of eegBufferRef.current.entries()) {
            channels[ch] = samples.slice();
          }
          const eegIdx = eegChunkIndexRef.current++;
          await saveSessionEEG(session.id, { channels, bandPowers }, museClientRef.current?.deviceName, eegIdx, Date.now());
        }
        if (session && isRecording && isWebcamEnabled && facialBufferRef.current.length > 0) {
          console.log("[Facial] Saving periodic facial data...", { dataPoints: facialBufferRef.current.length });
          const facialIdx = facialChunkIndexRef.current++;
          await saveFacialData(session.id, facialBufferRef.current, facialIdx, Date.now());
        }
      }, 60000);
    } catch {
      setError("Could not access microphone. Please grant permission and try again.");
    }
  };

  const handleMute = (durationMs: number) => {
    setIsMuted(true);
    setMuteRemaining(durationMs);
    if (muteTimerRef.current) clearTimeout(muteTimerRef.current);
    muteTimerRef.current = setTimeout(() => { setIsMuted(false); setMuteRemaining(0); }, durationMs);
  };

  const [forcingProbe, setForcingProbe] = useState(false);

  const handleForceProbe = useCallback(async () => {
    const recorder = recorderRef.current;
    const currentSession = sessionRef.current;
    if (!recorder || !currentSession || forcingProbe) return;

    setForcingProbe(true);
    try {
      // Get recent audio for transcript context
      const recentAudio = recorder.getRecentAudio(15000);
      let transcript = "";

      if (recentAudio && recentAudio.size > 1000) {
        const audioBase64 = await blobToBase64(recentAudio);
        const audioFormat = recorder.getAudioFormat();
        const gapRes = await fetch("/api/analyze-gap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            audioBase64, 
            audioFormat, 
            problem: currentSession.problem,
            whiteboardData: whiteboardDataRef.current,
          }),
        });
        if (gapRes.ok) {
          const gapData = await gapRes.json();
          transcript = gapData.transcript || "";
        }
      }

      // Force a probe regardless of gap score
      const probeRes = await fetch("/api/generate-probe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problem: currentSession.problem,
          transcript,
          gapScore: 1.0,
          signals: ["user_requested"],
          previousProbes: currentSession.probes.map((p) => p.text),
        }),
      });

      if (probeRes.ok) {
        const { probe: probeText } = await probeRes.json();

        // Gate: don't add new probe if last one hasn't been revealed
        const lastProbe = currentSession.probes[currentSession.probes.length - 1];
        if (lastProbe && !lastProbe.isRevealed) {
          return;
        }

        const savedProbe = await addProbe(currentSession.id, {
          timestamp: Date.now() - new Date(currentSession.startedAt).getTime(),
          gapScore: 1.0,
          signals: ["user_requested"],
          text: probeText,
        });
        const updatedSession = addProbeToSession(currentSession, savedProbe);
        setSession(updatedSession);
        sessionRef.current = updatedSession;
        setActiveProbe(savedProbe);
        setViewingProbeIndex(updatedSession.probes.length - 1);
        lastProbeTimeRef.current = Date.now();
      }
    } catch (err) {
      console.error("Force probe error:", err);
    } finally {
      setForcingProbe(false);
    }
  }, [forcingProbe]);

  // Spacebar shortcut to force a probe
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only when recording, and not typing in an input/textarea
      if (!isRecording) return;
      if (e.code !== "Space") return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      e.preventDefault();
      handleForceProbe();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRecording, handleForceProbe]);

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
      const finalSession = endSession(session, elapsedSeconds * 1000, "ended_by_tutor");
      setSession(finalSession);
      sessionRef.current = finalSession;
    }
    await stopRecording();
  };

  const handleReveal = () => {
    setCurrentProbeRevealed(true);
  };

  const handleGetFeedback = async () => {
    if (!session || !activeProbe || !isRecording) return;

    // Gate: don't add new probe if last one hasn't been revealed
    const lastProbe = session.probes[session.probes.length - 1];
    if (lastProbe && !lastProbe.isRevealed) return;

    setFeedbackLoading(true);
    try {
      const previousProbes = session.probes.map(p => p.text);
      const res = await fetch("/api/feedback-and-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problem: session.problem,
          previousProbes,
          recentContext: "User requested feedback",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        
        if (data.question) {
          const savedProbe = await addProbe(session.id, {
            timestamp: Date.now() - new Date(session.startedAt).getTime(),
            gapScore: activeProbe.gapScore,
            signals: ["feedback_request"],
            text: data.question,
            isRevealed: false,
          });
          const updated = addProbeToSession(session, savedProbe);
          setSession(updated);
          sessionRef.current = updated;
          setActiveProbe(savedProbe);
          setViewingProbeIndex(updated.probes.length - 1);
          setCurrentProbeRevealed(false);
        }
      }
    } catch (error) {
      console.error("Get feedback error:", error);
    } finally {
      setFeedbackLoading(false);
    }
  };

  const handleImStuck = async () => {
    if (!session || !isRecording) return;

    // Gate: don't add new probe if last one hasn't been revealed
    const lastProbe = session.probes[session.probes.length - 1];
    if (lastProbe && !lastProbe.isRevealed) return;

    setStuckLoading(true);
    try {
      const previousProbes = session.probes.map(p => p.text);
      const res = await fetch("/api/fresh-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problem: session.problem,
          previousProbes,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        
        if (data.question) {
          const savedProbe = await addProbe(session.id, {
            timestamp: Date.now() - new Date(session.startedAt).getTime(),
            gapScore: 0.7,
            signals: ["stuck"],
            text: data.question,
            isRevealed: false,
          });
          const updated = addProbeToSession(session, savedProbe);
          setSession(updated);
          sessionRef.current = updated;
          setActiveProbe(savedProbe);
          setViewingProbeIndex(updated.probes.length - 1);
          setCurrentProbeRevealed(false);
        }
      }
    } catch (error) {
      console.error("I'm stuck error:", error);
    } finally {
      setStuckLoading(false);
    }
  };

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
      if (analysisRef.current) clearInterval(analysisRef.current);
      if (muteTimerRef.current) clearTimeout(muteTimerRef.current);
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(t => t.stop());
        micStreamRef.current = null;
      }
      handleDisconnectMuse();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!session || isSaving) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0a] gap-4">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
        {isSaving && (
          <p className="text-sm text-neutral-500 animate-pulse">Saving session...</p>
        )}
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-[#0a0a0a] overflow-hidden">
      {showWelcomeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => {
            setShowWelcomeModal(false);
            
          }} />
          <div className="relative z-10 w-[95vw] max-w-5xl p-6 bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl">
            <div className="flex gap-8">
              <div className="flex-shrink-0 text-6xl">👋</div>
              <div className="flex-1">
                <h2 className="text-3xl font-bold text-white mb-4">Welcome to openLesson!</h2>
                <p className="text-neutral-300 mb-6">You've just stepped into our Integrated Learning Environment (ILE) — a space designed to help you truly think and grow.</p>
                
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="flex gap-3">
                    <span className="flex-shrink-0 w-8 h-8 bg-cyan-500/20 border border-cyan-500/30 rounded-full flex items-center justify-center text-cyan-400 font-semibold">1</span>
                    <p className="text-neutral-300">Tap <strong className="text-white">Start Session</strong></p>
                  </div>
                  <div className="flex gap-3">
                    <span className="flex-shrink-0 w-8 h-8 bg-cyan-500/20 border border-cyan-500/30 rounded-full flex items-center justify-center text-cyan-400 font-semibold">2</span>
                    <p className="text-neutral-300">Tap to <strong className="text-white">reveal</strong> the first question</p>
                  </div>
                  <div className="flex gap-3">
                    <span className="flex-shrink-0 w-8 h-8 bg-cyan-500/20 border border-cyan-500/30 rounded-full flex items-center justify-center text-cyan-400 font-semibold">3</span>
                    <p className="text-neutral-300"><strong className="text-white">Speak out loud</strong> as you explore it!</p>
                  </div>
                </div>

                <p className="text-neutral-400 mb-4">Don't worry about sounding perfect — just let go of any fears and think out loud. This is how our tutor understands exactly how you're thinking and can guide you best.</p>

                <div className="bg-neutral-800/50 rounded-lg p-3 mb-4">
                  <p className="text-neutral-400">Your learning goals are always visible at the bottom of the question panel. You also have a full set of tools right there to support your thinking whenever you need them. The tutor will keep guiding you through the session with new questions, hints, and feedback as you progress.</p>
                </div>

                <p className="text-neutral-300 mb-4">And remember — I'm always here! Feel free to message me anytime about anything: the topic you're learning, a question that's confusing you, or even just to say hi. This chat is your safe space.</p>

                <p className="text-lg font-semibold text-white mb-6">Ready to begin?</p>
              </div>
            </div>

            <button
              onClick={() => {
                setShowWelcomeModal(false);
              }}
              className="w-full py-3 px-6 border border-cyan-500/50 hover:bg-cyan-500/10 text-cyan-400 font-medium rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              Let's go! 🚀
            </button>
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
                if (tool === "grokipedia" || tool === "exercise" || tool === "reading") {
                  setPrepToolContent(null);
                  setMobileTab("prep");
                } else if (tool === "chat") {
                  setMobileTab("main");
                } else if (tool === "canvas") {
                  setMobileTab("canvas");
                } else if (tool === "notebook") {
                  setMobileTab("notes");
                } else if (tool === "rag") {
                  // RAG tool - only available on desktop
                  setMobileTab("main");
                }
              }} 
              problem={session.problem} 
              className="hidden md:flex"
              ragNotification={ragHasNotification}
            />
      {/* Blur overlay on sidebar tools */}
      {shouldBlockTools && (
        <div className="hidden md:block absolute left-0 top-0 bottom-0 pointer-events-none" style={{ width: '280px', zIndex: 40 }}>
          <div className="absolute inset-0 bg-neutral-900/30 backdrop-blur-sm" />
        </div>
      )}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header removed */}
        <div className="flex-1 flex min-h-0">
          {/* Desktop: Resizable split view */}
          <div className="hidden md:flex flex-1 min-h-0">
            <ResizablePane
              defaultLeftWidth={30}
              left={
                <div className="flex flex-col min-w-0 p-4 overflow-hidden h-full relative">
                  {shouldBlockTools && (
                    <div className="absolute inset-0 bg-neutral-900/30 backdrop-blur-sm z-40" />
                  )}
                  <div className="flex-1 min-h-0 overflow-hidden relative">
                    {activeTool === "chat" && <LLMChat problem={session.problem} />}
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
                          placeholder="Jot down your thoughts..."
                          className="flex-1 w-full bg-transparent border-none resize-none p-4 text-sm text-white placeholder-neutral-600 focus:outline-none focus:ring-0"
                        />
                        <div className="shrink-0 px-3 py-2 border-t border-neutral-800">
                          <span className="text-[10px] text-neutral-600">{notebookContent.length} characters</span>
                        </div>
                      </div>
                    )}
                    {activeTool === "rag" && (
                      <div className="h-full p-4 overflow-auto">
                        {ragLoading && (
                          <div className="flex flex-col items-center justify-center h-64">
                            <div className="w-6 h-6 border border-neutral-700 border-t-cyan-500 rounded-full animate-spin mb-3" />
                            <p className="text-sm text-neutral-500">Finding relevant chunks...</p>
                          </div>
                        )}
                        {!ragLoading && ragChunks.length === 0 && (
                          <div className="flex flex-col items-center justify-center h-64 gap-4">
                            <p className="text-sm text-neutral-500">No matching chunks found</p>
                            <button
                              onClick={() => runRagMatching()}
                              className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-medium rounded-lg transition-all"
                            >
                              Retry Matching
                            </button>
                          </div>
                        )}
                        {!ragLoading && ragChunks.length > 0 && (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <h3 className="text-sm font-medium text-white">Matching Chunks</h3>
                              <span className="text-xs text-neutral-500">{ragChunks.length} found</span>
                            </div>
                            
                            {/* Modifier input */}
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={ragModifier}
                                onChange={(e) => setRagModifier(e.target.value)}
                                placeholder="Add modifier (e.g., 'focus on proofs')"
                                className="flex-1 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500"
                              />
                              <button
                                onClick={() => runRagMatching(ragModifier)}
                                disabled={ragLoading || !ragModifier.trim()}
                                className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:bg-cyan-500/50 disabled:cursor-not-allowed text-black font-medium rounded-lg transition-all"
                              >
                                Retry
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
                                          <span className="text-xs font-medium text-white">Chunk {idx + 1}</span>
                                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                            similarityPct > 50 
                                              ? "bg-cyan-500/20 text-cyan-400" 
                                              : "bg-neutral-700 text-neutral-400"
                                          }`}>
                                            {similarityPct}% match
                                          </span>
                                          {chunk.topic && (
                                            <span className="text-[10px] text-neutral-500">
                                              from: {chunk.topic}
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
                                {ragSelectedChunks.size} of {ragChunks.length} chunks selected for observation prompts
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
                        onFacialData={(data) => {
                          setLatestFacialData(data);
                          facialBufferRef.current.push(data);
                          if (facialBufferRef.current.length > 120) {
                            facialBufferRef.current = facialBufferRef.current.slice(-120);
                          }
                        }}
                        onFaceError={(error: string) => {
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
                        }}
                      />
                    </div>
                    {activeTool === "logs" && (
                      <LogsTool
                        logs={logs}
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
                              <h3 className="text-lg font-medium text-white mb-2">Grokipedia</h3>
                              <p className="text-sm text-neutral-400">Search for information about your topic</p>
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
                              Open Grokipedia
                            </a>
                          </div>
                        )}
                        {((activeTool === "grokipedia" && !showGrokipediaOnly) || activeTool === "exercise" || activeTool === "reading") && !prepToolContent && !prepToolLoading && (
                          <div className="flex flex-col items-center justify-center h-full gap-4">
                            <button
                              onClick={() => loadPrepToolContent(activeTool)}
                              className="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-medium rounded-xl transition-all"
                            >
                              Load {activeTool === "exercise" ? "Exercise" : "Reading"}
                            </button>
                          </div>
                        )}
                        {prepToolLoading && (
                          <div className="flex flex-col items-center justify-center h-full">
                            <div className="w-6 h-6 border border-neutral-700 border-t-cyan-500 rounded-full animate-spin mb-3" />
                            <p className="text-sm text-neutral-500">Loading...</p>
                          </div>
                        )}
                        {prepToolContent && !prepToolLoading && (
                          <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6">
                            <h3 className="text-lg font-medium text-white mb-4">{prepToolContent.title}</h3>
                            <div className="prose prose-invert prose-sm max-w-none text-neutral-300 whitespace-pre-wrap">
                              {prepToolContent.content}
                            </div>
                            {activeTool === "grokipedia" && session?.problem && (
                              <a
                                href={`https://grokipedia.com/search?q=${encodeURIComponent(session.problem)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-4 inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 text-sm"
                              >
                                Open Grokipedia
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
                </div>
              }
              right={
                <ProbeNotifications
                  sessionId={session.id}
                  probes={session.probes}
                  objectives={objectives}
                  objectiveStatuses={objectiveStatuses}
                  isRecording={isRecording}
                  isPaused={isPaused}
                  stream={stream}
                  onStartRecording={startRecording}
                  onStopRecording={stopRecording}
                  onPause={handlePause}
                  onResume={handleResume}
                  onGetFeedback={handleGetFeedback}
                  onImStuck={handleImStuck}
                  feedbackLoading={feedbackLoading}
                  stuckLoading={stuckLoading}
                  elapsedSeconds={elapsedSeconds}
                  cycleProgress={elapsedSeconds % 60}
                  isAnalyzing={isAnalyzing}
                />
              }
            />
          </div>

          {/* Floating message at bottom left */}
          {shouldBlockTools && (
            <div className="hidden md:block fixed bottom-8 left-8 z-[100]">
              <div className="bg-neutral-800 px-6 py-4 rounded-xl border border-neutral-700 shadow-xl">
                <p className="text-base font-semibold text-white">
                  Start/Resume student monitoring to access the ILE tools
                </p>
              </div>
            </div>
          )}

          {/* Mobile: Tab-based navigation */}
          <div className="flex-1 flex flex-col md:hidden min-h-0 h-full">
            <div className="flex-1 min-h-0 overflow-hidden h-full">
              {mobileTab === "main" && (
                <div className="h-full overflow-hidden">
                  <LLMChat problem={session.problem} />
                </div>
              )}
              {mobileTab === "canvas" && (
                <div className="h-full overflow-hidden">
                  <WhiteboardCanvas
                    initialData={whiteboardData || undefined}
                    onCanvasChange={(dataUrl) => {
                      setWhiteboardData(dataUrl);
                      if (sessionRef.current) {
                        sessionRef.current = { ...sessionRef.current, metadata: { ...sessionRef.current.metadata, whiteboardData: dataUrl } };
                      }
                    }}
                  />
                </div>
              )}
              {mobileTab === "notes" && (
                <div className="h-full p-4 overflow-hidden">
                  <div className="h-full rounded-lg border border-neutral-800 bg-neutral-900/50 flex flex-col">
                    <textarea
                      value={notebookContent}
                      onChange={(e) => setNotebookContent(e.target.value)}
                      placeholder="Jot down your thoughts..."
                      className="flex-1 w-full bg-transparent border-none resize-none p-4 text-sm text-white placeholder-neutral-600 focus:outline-none focus:ring-0"
                    />
                    <div className="shrink-0 px-3 py-2 border-t border-neutral-800">
                      <span className="text-[10px] text-neutral-600">{notebookContent.length} characters</span>
                    </div>
                  </div>
                </div>
              )}
              {mobileTab === "questions" && (
                <ProbeNotifications
                  sessionId={session.id}
                  probes={session.probes}
                  objectives={objectives}
                  objectiveStatuses={objectiveStatuses}
                  isRecording={isRecording}
                  isPaused={isPaused}
                  stream={stream}
                  onStartRecording={startRecording}
                  onStopRecording={stopRecording}
                  onPause={handlePause}
                  onResume={handleResume}
                  onGetFeedback={handleGetFeedback}
                  onImStuck={handleImStuck}
                  feedbackLoading={feedbackLoading}
                  stuckLoading={stuckLoading}
                  elapsedSeconds={elapsedSeconds}
                  cycleProgress={elapsedSeconds % 60}
                  isAnalyzing={isAnalyzing}
                />
              )}
              {mobileTab === "prep" && (
                <div className="h-full p-4 overflow-auto">
                  {!prepToolContent && !prepToolLoading && (
                    <div className="flex flex-col gap-3">
                      <button
                        onClick={() => loadPrepToolContent("reading")}
                        className="w-full p-4 rounded-xl border border-neutral-800 bg-neutral-900/50 hover:bg-neutral-800 text-left"
                      >
                        <div className="flex items-center gap-3">
                          <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                          </svg>
                          <div>
                            <div className="text-sm font-medium text-white">Prep Reading</div>
                            <div className="text-xs text-neutral-500">Key concepts to review</div>
                          </div>
                        </div>
                      </button>
                      <button
                        onClick={() => loadPrepToolContent("exercise")}
                        className="w-full p-4 rounded-xl border border-neutral-800 bg-neutral-900/50 hover:bg-neutral-800 text-left"
                      >
                        <div className="flex items-center gap-3">
                          <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                          </svg>
                          <div>
                            <div className="text-sm font-medium text-white">Exercise Prep</div>
                            <div className="text-xs text-neutral-500">Practice task before session</div>
                          </div>
                        </div>
                      </button>
                      {session?.problem && (
                        <a
                          href={`https://grokipedia.com/search?q=${encodeURIComponent(session.problem)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full p-4 rounded-xl border border-neutral-800 bg-neutral-900/50 hover:bg-neutral-800 text-left flex items-center gap-3"
                        >
                          <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <circle cx="12" cy="12" r="10" />
                            <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                          </svg>
                          <div>
                            <div className="text-sm font-medium text-white">Grokipedia</div>
                            <div className="text-xs text-neutral-500">Search external knowledge base</div>
                          </div>
                        </a>
                      )}
                    </div>
                  )}
                  {prepToolLoading && (
                    <div className="flex flex-col items-center justify-center h-64">
                      <div className="w-6 h-6 border border-neutral-700 border-t-cyan-500 rounded-full animate-spin mb-3" />
                      <p className="text-sm text-neutral-500">Loading...</p>
                    </div>
                  )}
                  {prepToolContent && !prepToolLoading && (
                    <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6">
                      <h3 className="text-lg font-medium text-white mb-4">{prepToolContent.title}</h3>
                      <div className="prose prose-invert prose-sm max-w-none text-neutral-300 whitespace-pre-wrap">
                        {prepToolContent.content}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Mobile Tab Bar */}
            <div className="flex border-t border-neutral-800 bg-[#0a0a0a] shrink-0">
              <button
                onClick={() => setMobileTab("main")}
                className={`flex-1 py-2.5 text-[10px] font-medium transition-colors flex flex-col items-center gap-1 ${
                  mobileTab === "main" ? "text-white" : "text-neutral-500"
                }`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                <span className="hidden xs:inline">Chat</span>
              </button>
              <button
                onClick={() => setMobileTab("canvas")}
                className={`flex-1 py-2.5 text-[10px] font-medium transition-colors flex flex-col items-center gap-1 ${
                  mobileTab === "canvas" ? "text-white" : "text-neutral-500"
                }`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                <span className="hidden xs:inline">Canvas</span>
              </button>
              <button
                onClick={() => setMobileTab("notes")}
                className={`flex-1 py-2.5 text-[10px] font-medium transition-colors flex flex-col items-center gap-1 ${
                  mobileTab === "notes" ? "text-white" : "text-neutral-500"
                }`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span className="hidden xs:inline">Notes</span>
              </button>
              <button
                onClick={() => setMobileTab("questions")}
                className={`flex-1 py-2.5 text-[10px] font-medium transition-colors flex flex-col items-center gap-1 ${
                  mobileTab === "questions" ? "text-white" : "text-neutral-500"
                }`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="hidden xs:inline">Questions</span>
              </button>
              <button
                onClick={() => { setPrepToolContent(null); setMobileTab("prep"); }}
                className={`flex-1 py-2.5 text-[10px] font-medium transition-colors flex flex-col items-center gap-1 ${
                  mobileTab === "prep" ? "text-white" : "text-neutral-500"
                }`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <span className="hidden xs:inline">Prep</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      {showEndDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 max-w-md mx-4">
            <h3 className="text-base font-semibold text-white mb-2">Tutor suggests ending</h3>
            <p className="text-neutral-400 mb-5 text-sm leading-relaxed">{endReason}</p>
            <div className="flex gap-2.5">
              <button onClick={() => setShowEndDialog(false)} className="flex-1 py-2.5 text-sm text-neutral-400 border border-neutral-700 hover:border-neutral-500 rounded-xl transition-colors">
                Keep going
              </button>
              <button onClick={handleConfirmEnd} className="flex-1 py-2.5 text-sm text-white bg-white/10 hover:bg-white/15 rounded-xl transition-colors">
                End session
              </button>
            </div>
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

// ---- Icons ----

function MicIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
    </svg>
  );
}

function ObserverIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

function FreqIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function SpeakerIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
    </svg>
  );
}

function StarIcon({ filled }: { filled?: boolean }) {
  return filled ? (
    <svg className="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  ) : (
    <svg className="w-4 h-4 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  );
}

function BluetoothIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7l10 10-5 5V2l5 5L7 17" />
    </svg>
  );
}
