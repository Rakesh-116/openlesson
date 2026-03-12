"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { ProbeNotifications } from "@/components/ProbeNotifications";
import { 
  useSessionSync, 
  returnToMainWindow,
  type SessionSyncState,
  type SessionAction,
  type ScreenCaptureStatus,
} from "@/lib/broadcast-sync";
import { createScreenCapture, isScreenCaptureSupported, type ScreenCaptureInstance } from "@/lib/screen-capture";
import { saveScreenshot } from "@/lib/storage";
import { type Probe, type SessionPlan, type ToolName } from "@/lib/storage";

export default function MonitorPopOutPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;

  // Synced state from main window
  const [probes, setProbes] = useState<Probe[]>([]);
  const [sessionPlan, setSessionPlan] = useState<SessionPlan | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [cycleProgress, setCycleProgress] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [archivingProbeId, setArchivingProbeId] = useState<string | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [originalPrompt, setOriginalPrompt] = useState("");
  const [objectives, setObjectives] = useState<string[]>([]);
  const [objectiveStatuses, setObjectiveStatuses] = useState<("red" | "yellow" | "green" | "blue")[]>([]);

  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");

  // Screen capture state
  const [isCapturing, setIsCapturing] = useState(false);
  const [lastScreenshotAt, setLastScreenshotAt] = useState<number | null>(null);
  const [screenshotCount, setScreenshotCount] = useState(0);
  const screenCaptureRef = useRef<ScreenCaptureInstance | null>(null);
  
  // Client-side only flag to prevent hydration mismatch
  const [isClient, setIsClient] = useState(false);
  const [screenCaptureSupported, setScreenCaptureSupported] = useState(false);

  // Handle state updates from main window
  const handleStateUpdate = useCallback((state: Partial<SessionSyncState>) => {
    if (state.probes !== undefined) setProbes(state.probes);
    if (state.sessionPlan !== undefined) setSessionPlan(state.sessionPlan);
    if (state.isRecording !== undefined) setIsRecording(state.isRecording);
    if (state.isPaused !== undefined) setIsPaused(state.isPaused);
    if (state.elapsedSeconds !== undefined) setElapsedSeconds(state.elapsedSeconds);
    if (state.cycleProgress !== undefined) setCycleProgress(state.cycleProgress);
    if (state.isAnalyzing !== undefined) setIsAnalyzing(state.isAnalyzing);
    if (state.archivingProbeId !== undefined) setArchivingProbeId(state.archivingProbeId);
    if (state.planLoading !== undefined) setPlanLoading(state.planLoading);
    if (state.planError !== undefined) setPlanError(state.planError);
    if (state.originalPrompt !== undefined) setOriginalPrompt(state.originalPrompt);
    if (state.objectives !== undefined) setObjectives(state.objectives);
    if (state.objectiveStatuses !== undefined) setObjectiveStatuses(state.objectiveStatuses);
  }, []);

  // Use broadcast sync hook
  const { broadcastAction, broadcastScreenCapture } = useSessionSync({
    sessionId,
    isMainWindow: false,
    onStateUpdate: handleStateUpdate,
    onPeerConnected: () => {
      setIsConnected(true);
      setConnectionStatus("connected");
    },
    onPeerDisconnected: () => {
      setIsConnected(false);
      setConnectionStatus("disconnected");
    },
  });

  // Set client-side flags after hydration
  useEffect(() => {
    setIsClient(true);
    setScreenCaptureSupported(isScreenCaptureSupported());
  }, []);

  // Initialize screen capture
  useEffect(() => {
    if (!screenCaptureSupported) return;

    const handleScreenshotCaptured = async (blob: Blob, timestamp: number) => {
      try {
        await saveScreenshot(sessionId, blob, timestamp);
        setLastScreenshotAt(timestamp);
        setScreenshotCount((c) => c + 1);
        broadcastScreenCapture({ isCapturing: true, lastScreenshotAt: timestamp });
      } catch (error) {
        console.error("[MonitorPopOut] Failed to save screenshot:", error);
      }
    };

    screenCaptureRef.current = createScreenCapture({
      onScreenshotCaptured: handleScreenshotCaptured,
      intervalMs: 60000, // 1 minute
      onStatusChange: (capturing) => {
        setIsCapturing(capturing);
        broadcastScreenCapture({ isCapturing: capturing });
      },
      onError: (error) => {
        console.error("[MonitorPopOut] Screen capture error:", error);
      },
    });

    return () => {
      screenCaptureRef.current?.stop();
    };
  }, [sessionId, broadcastScreenCapture]);

  // Action handlers - broadcast to main window
  const handleStartRecording = useCallback(() => {
    broadcastAction({ action: "start" });
  }, [broadcastAction]);

  const handleStopRecording = useCallback(() => {
    broadcastAction({ action: "stop" });
  }, [broadcastAction]);

  const handlePause = useCallback(() => {
    broadcastAction({ action: "pause" });
  }, [broadcastAction]);

  const handleResume = useCallback(() => {
    broadcastAction({ action: "resume" });
  }, [broadcastAction]);

  const handleReset = useCallback(() => {
    broadcastAction({ action: "reset" });
  }, [broadcastAction]);

  const handleClose = useCallback(() => {
    broadcastAction({ action: "close" });
  }, [broadcastAction]);

  const handleGetFeedback = useCallback(() => {
    broadcastAction({ action: "get_feedback" });
  }, [broadcastAction]);

  const handleArchiveProbe = useCallback(async (probeId: string) => {
    broadcastAction({ action: "archive_probe", probeId });
  }, [broadcastAction]);

  const handleToggleFocus = useCallback((probeId: string, focused: boolean) => {
    broadcastAction({ action: "toggle_focus", probeId, focused });
  }, [broadcastAction]);

  const handleAdvanceStep = useCallback(async () => {
    broadcastAction({ action: "advance_step" });
  }, [broadcastAction]);

  const handleRollbackToStep = useCallback(async (stepIndex: number) => {
    broadcastAction({ action: "rollback_step", stepIndex });
  }, [broadcastAction]);

  const handleToolSelect = useCallback((tool: ToolName) => {
    // In pop-out mode, we can't switch tools - focus main window instead
    returnToMainWindow();
  }, []);

  // Screen capture controls
  const handleStartScreenCapture = useCallback(async () => {
    console.log("[MonitorPopOut] handleStartScreenCapture called", { 
      hasRef: !!screenCaptureRef.current,
      screenCaptureSupported 
    });
    
    if (!screenCaptureRef.current) {
      console.log("[MonitorPopOut] Creating screen capture instance on demand");
      const handleScreenshotCaptured = async (blob: Blob, timestamp: number) => {
        console.log("[MonitorPopOut] Screenshot captured", { size: blob.size, timestamp });
        try {
          await saveScreenshot(sessionId, blob, timestamp);
          setLastScreenshotAt(timestamp);
          setScreenshotCount((c) => c + 1);
          broadcastScreenCapture({ isCapturing: true, lastScreenshotAt: timestamp });
        } catch (error) {
          console.error("[MonitorPopOut] Failed to save screenshot:", error);
        }
      };

      screenCaptureRef.current = createScreenCapture({
        onScreenshotCaptured: handleScreenshotCaptured,
        intervalMs: 60000,
        onStatusChange: (capturing) => {
          console.log("[MonitorPopOut] Capture status changed:", capturing);
          setIsCapturing(capturing);
          broadcastScreenCapture({ isCapturing: capturing });
        },
        onError: (error) => {
          console.error("[MonitorPopOut] Screen capture error:", error);
        },
      });
    }
    
    const success = await screenCaptureRef.current.start();
    console.log("[MonitorPopOut] Screen capture start result:", success);
  }, [sessionId, broadcastScreenCapture, screenCaptureSupported]);

  const handleStopScreenCapture = useCallback(() => {
    console.log("[MonitorPopOut] handleStopScreenCapture called");
    screenCaptureRef.current?.stop();
  }, []);

  // Render connection status indicator
  const renderConnectionStatus = () => {
    switch (connectionStatus) {
      case "connecting":
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-xs text-amber-400">Connecting to session...</span>
          </div>
        );
      case "connected":
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/30 rounded-lg">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-xs text-green-400">Connected</span>
          </div>
        );
      case "disconnected":
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/30 rounded-lg">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-xs text-red-400">Session disconnected</span>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      {/* Header bar */}
      <div className="shrink-0 px-4 py-3 border-b border-neutral-800 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* Logo / Title */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-white">Monitor</span>
          </div>

          {/* Connection status */}
          {renderConnectionStatus()}
        </div>

        <div className="flex items-center gap-2">
          {/* Screen capture button - only render after client hydration */}
          {isClient && screenCaptureSupported && (
            <>
              {isCapturing ? (
                <button
                  onClick={handleStopScreenCapture}
                  className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/30 rounded-lg hover:bg-red-500/20 transition-colors"
                >
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-xs text-red-400">Recording Screen</span>
                  <span className="text-[10px] text-red-500/70">({screenshotCount})</span>
                </button>
              ) : (
                <button
                  onClick={handleStartScreenCapture}
                  className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg hover:bg-neutral-700 hover:border-neutral-600 transition-colors"
                >
                  <svg className="w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span className="text-xs text-neutral-400">Share Screen</span>
                </button>
              )}
            </>
          )}

          {/* Back to ILE button */}
          <button
            onClick={returnToMainWindow}
            className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/30 rounded-lg hover:bg-cyan-500/20 transition-colors"
          >
            <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="text-xs text-cyan-400">Back to ILE</span>
          </button>
        </div>
      </div>

      {/* Screen capture info banner */}
      {isCapturing && lastScreenshotAt && (
        <div className="shrink-0 px-4 py-2 bg-red-500/5 border-b border-red-500/20">
          <div className="flex items-center justify-between text-xs">
            <span className="text-red-400/70">
              Screen recording active - screenshot every 60 seconds
            </span>
            <span className="text-red-400/50">
              Last capture: {new Date(lastScreenshotAt).toLocaleTimeString()}
            </span>
          </div>
        </div>
      )}

      {/* Main content - ProbeNotifications */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {connectionStatus === "disconnected" ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-red-900/20 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">Session Disconnected</h2>
            <p className="text-sm text-neutral-500 mb-4">
              The main session window has been closed or is no longer available.
            </p>
            <button
              onClick={() => window.close()}
              className="px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-300 hover:bg-neutral-700 transition-colors"
            >
              Close Window
            </button>
          </div>
        ) : (
          <ProbeNotifications
            sessionId={sessionId}
            probes={probes}
            sessionPlan={sessionPlan}
            objectives={objectives}
            objectiveStatuses={objectiveStatuses}
            isRecording={isRecording}
            isPaused={isPaused}
            onStartRecording={handleStartRecording}
            onStopRecording={handleStopRecording}
            onPause={handlePause}
            onResume={handleResume}
            onGetFeedback={handleGetFeedback}
            feedbackLoading={false}
            elapsedSeconds={elapsedSeconds}
            cycleProgress={cycleProgress}
            isAnalyzing={isAnalyzing}
            onArchiveProbe={handleArchiveProbe}
            onToggleFocus={handleToggleFocus}
            onToolSelect={handleToolSelect}
            onReset={handleReset}
            onClose={handleClose}
            archivingProbeId={archivingProbeId}
            planLoading={planLoading}
            planError={planError}
            onAdvanceStep={handleAdvanceStep}
            onRollbackToStep={handleRollbackToStep}
            originalPrompt={originalPrompt}
            showControls={true}
          />
        )}
      </div>
    </div>
  );
}
