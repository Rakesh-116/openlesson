// ============================================
// BROADCAST CHANNEL SYNC FOR POP-OUT WINDOWS
// Enables real-time state sync between main session
// window and pop-out monitoring window
// ============================================

import { useEffect, useCallback, useRef } from "react";
import { type Probe, type SessionPlan } from "./storage";

// Channel name for session sync
const CHANNEL_PREFIX = "socrates-session-";

// Message types for synchronization
export type SyncMessageType =
  | "state_update"      // Full state sync
  | "probe_update"      // Probes changed
  | "plan_update"       // Session plan changed
  | "recording_update"  // Recording status changed
  | "action"            // User action (start, stop, pause, etc.)
  | "ping"              // Check if other window is alive
  | "pong"              // Response to ping
  | "request_state"     // Request full state from main window
  | "screen_capture"    // Screen capture status update
  | "close";            // Window is closing

export interface SessionSyncState {
  probes: Probe[];
  sessionPlan: SessionPlan | null;
  isRecording: boolean;
  isPaused: boolean;
  elapsedSeconds: number;
  cycleProgress: number;
  isAnalyzing: boolean;
  archivingProbeId: string | null;
  planLoading: boolean;
  planError: string | null;
  originalPrompt: string;
  objectives: string[];
  objectiveStatuses: ("red" | "yellow" | "green" | "blue")[];
}

export interface SyncMessage {
  type: SyncMessageType;
  senderId: string;
  timestamp: number;
  payload?: Partial<SessionSyncState> | SessionAction | ScreenCaptureStatus;
}

export interface SessionAction {
  action: "start" | "stop" | "pause" | "resume" | "reset" | "close" | "get_feedback" | "archive_probe" | "toggle_focus" | "advance_step" | "rollback_step";
  probeId?: string;
  focused?: boolean;
  stepIndex?: number;
}

export interface ScreenCaptureStatus {
  isCapturing: boolean;
  lastScreenshotAt?: number;
}

// Generate a unique ID for this window instance
const generateWindowId = () => `window_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

interface UseSessionSyncOptions {
  sessionId: string;
  isMainWindow: boolean;
  onStateUpdate?: (state: Partial<SessionSyncState>) => void;
  onAction?: (action: SessionAction) => void;
  onScreenCaptureUpdate?: (status: ScreenCaptureStatus) => void;
  onPeerConnected?: () => void;
  onPeerDisconnected?: () => void;
}

export function useSessionSync({
  sessionId,
  isMainWindow,
  onStateUpdate,
  onAction,
  onScreenCaptureUpdate,
  onPeerConnected,
  onPeerDisconnected,
}: UseSessionSyncOptions) {
  const channelRef = useRef<BroadcastChannel | null>(null);
  const windowIdRef = useRef<string>(generateWindowId());
  const peerAliveRef = useRef<boolean>(false);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPongTimeRef = useRef<number>(0);
  const peerCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize channel
  useEffect(() => {
    const channelName = `${CHANNEL_PREFIX}${sessionId}`;
    const channel = new BroadcastChannel(channelName);
    channelRef.current = channel;

    const handleMessage = (event: MessageEvent<SyncMessage>) => {
      const message = event.data;
      
      // Ignore our own messages
      if (message.senderId === windowIdRef.current) return;

      switch (message.type) {
        case "state_update":
        case "probe_update":
        case "plan_update":
        case "recording_update":
          // Any message from peer means they're alive
          lastPongTimeRef.current = Date.now();
          if (message.payload && onStateUpdate) {
            onStateUpdate(message.payload as Partial<SessionSyncState>);
          }
          break;

        case "action":
          lastPongTimeRef.current = Date.now();
          if (message.payload && onAction) {
            onAction(message.payload as SessionAction);
          }
          break;

        case "screen_capture":
          lastPongTimeRef.current = Date.now();
          if (message.payload && onScreenCaptureUpdate) {
            onScreenCaptureUpdate(message.payload as ScreenCaptureStatus);
          }
          break;

        case "ping":
          // Respond to ping
          channel.postMessage({
            type: "pong",
            senderId: windowIdRef.current,
            timestamp: Date.now(),
          } as SyncMessage);
          lastPongTimeRef.current = Date.now();
          if (!peerAliveRef.current) {
            peerAliveRef.current = true;
            onPeerConnected?.();
          }
          break;

        case "pong":
          lastPongTimeRef.current = Date.now();
          if (!peerAliveRef.current) {
            peerAliveRef.current = true;
            onPeerConnected?.();
          }
          break;

        case "request_state":
          // Pop-out window is requesting state - main window should respond
          // This is handled by the main window's state broadcaster
          lastPongTimeRef.current = Date.now();
          if (!peerAliveRef.current) {
            peerAliveRef.current = true;
            onPeerConnected?.();
          }
          break;

        case "close":
          peerAliveRef.current = false;
          lastPongTimeRef.current = 0;
          onPeerDisconnected?.();
          break;
      }
    };

    channel.addEventListener("message", handleMessage);

    // Start ping interval to detect peer presence
    pingIntervalRef.current = setInterval(() => {
      channel.postMessage({
        type: "ping",
        senderId: windowIdRef.current,
        timestamp: Date.now(),
      } as SyncMessage);
    }, 5000);

    // Check if peer has timed out (no messages in 15 seconds)
    peerCheckIntervalRef.current = setInterval(() => {
      if (peerAliveRef.current && lastPongTimeRef.current > 0) {
        const timeSinceLastPong = Date.now() - lastPongTimeRef.current;
        if (timeSinceLastPong > 15000) {
          // Peer hasn't responded in 15 seconds, consider them disconnected
          peerAliveRef.current = false;
          lastPongTimeRef.current = 0;
          onPeerDisconnected?.();
        }
      }
    }, 5000);

    // Initial ping
    channel.postMessage({
      type: "ping",
      senderId: windowIdRef.current,
      timestamp: Date.now(),
    } as SyncMessage);

    // If pop-out window, request initial state
    if (!isMainWindow) {
      channel.postMessage({
        type: "request_state",
        senderId: windowIdRef.current,
        timestamp: Date.now(),
      } as SyncMessage);
    }

    // Cleanup
    return () => {
      channel.postMessage({
        type: "close",
        senderId: windowIdRef.current,
        timestamp: Date.now(),
      } as SyncMessage);
      
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
      if (peerCheckIntervalRef.current) {
        clearInterval(peerCheckIntervalRef.current);
      }
      channel.removeEventListener("message", handleMessage);
      channel.close();
      channelRef.current = null;
    };
  }, [sessionId, isMainWindow, onStateUpdate, onAction, onScreenCaptureUpdate, onPeerConnected, onPeerDisconnected]);

  // Broadcast state update
  const broadcastState = useCallback((state: Partial<SessionSyncState>) => {
    channelRef.current?.postMessage({
      type: "state_update",
      senderId: windowIdRef.current,
      timestamp: Date.now(),
      payload: state,
    } as SyncMessage);
  }, []);

  // Broadcast probe update
  const broadcastProbes = useCallback((probes: Probe[]) => {
    channelRef.current?.postMessage({
      type: "probe_update",
      senderId: windowIdRef.current,
      timestamp: Date.now(),
      payload: { probes },
    } as SyncMessage);
  }, []);

  // Broadcast plan update
  const broadcastPlan = useCallback((sessionPlan: SessionPlan | null) => {
    channelRef.current?.postMessage({
      type: "plan_update",
      senderId: windowIdRef.current,
      timestamp: Date.now(),
      payload: { sessionPlan },
    } as SyncMessage);
  }, []);

  // Broadcast recording status
  const broadcastRecordingStatus = useCallback((isRecording: boolean, isPaused: boolean) => {
    channelRef.current?.postMessage({
      type: "recording_update",
      senderId: windowIdRef.current,
      timestamp: Date.now(),
      payload: { isRecording, isPaused },
    } as SyncMessage);
  }, []);

  // Broadcast action
  const broadcastAction = useCallback((action: SessionAction) => {
    channelRef.current?.postMessage({
      type: "action",
      senderId: windowIdRef.current,
      timestamp: Date.now(),
      payload: action,
    } as SyncMessage);
  }, []);

  // Broadcast screen capture status
  const broadcastScreenCapture = useCallback((status: ScreenCaptureStatus) => {
    channelRef.current?.postMessage({
      type: "screen_capture",
      senderId: windowIdRef.current,
      timestamp: Date.now(),
      payload: status,
    } as SyncMessage);
  }, []);

  return {
    broadcastState,
    broadcastProbes,
    broadcastPlan,
    broadcastRecordingStatus,
    broadcastAction,
    broadcastScreenCapture,
    isPeerAlive: peerAliveRef.current,
  };
}

// Utility to open pop-out window
export function openPopOutWindow(sessionId: string): Window | null {
  const width = 500;
  const height = 800;
  const left = window.screen.width - width - 50;
  const top = 50;

  const popOut = window.open(
    `/monitor/${sessionId}`,
    `socrates-monitor-${sessionId}`,
    `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
  );

  return popOut;
}

// Utility to focus main window and close pop-out
export function returnToMainWindow(): void {
  if (window.opener && !window.opener.closed) {
    window.opener.focus();
  }
  window.close();
}
