"use client";

import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";

interface SessionControlBarProps {
  isRecording: boolean;
  isPaused: boolean;
  elapsedSeconds: number;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onPause: () => void;
  onResume: () => void;
}

export function SessionControlBar({
  isRecording,
  isPaused,
  elapsedSeconds,
  onStartRecording,
  onStopRecording,
  onPause,
  onResume,
}: SessionControlBarProps) {
  const { t } = useI18n();
  const isStopped = !isRecording && !isPaused;
  const isPlaying = isRecording && !isPaused;

  // Auto-collapse after session starts (3s delay)
  const [collapsed, setCollapsed] = useState(false);
  const [hovering, setHovering] = useState(false);

  useEffect(() => {
    if (isPlaying) {
      setCollapsed(true);
    }
    if (isStopped || isPaused) {
      setCollapsed(false);
    }
  }, [isPlaying, isStopped, isPaused]);

  const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const isExpanded = !collapsed || hovering;

  return (
    <div
      className="w-full shrink-0 flex flex-col items-center"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {/* The bar itself */}
      <div
        className={`
          w-full flex items-center justify-center gap-3 transition-all duration-300 ease-in-out
          ${isExpanded
            ? "px-4 py-2.5 bg-neutral-900/95 border-b border-neutral-700/80 shadow-2xl shadow-black/50 backdrop-blur-md"
            : "px-3 py-1 bg-neutral-900/80 border-b border-neutral-700/50 shadow-lg shadow-black/30 backdrop-blur-sm"
          }
        `}
      >
        {/* Status indicator */}
        <div className="flex items-center gap-2">
          <div className={`rounded-full transition-all ${
            isPlaying
              ? "w-2.5 h-2.5 bg-red-500 animate-pulse"
              : isPaused
              ? "w-2.5 h-2.5 bg-amber-500"
              : "w-2 h-2 bg-neutral-600"
          }`} />

          {/* Timer - always visible */}
          <span className={`text-xs font-mono tabular-nums transition-colors ${
            isPlaying ? "text-red-400" : isPaused ? "text-amber-400" : "text-neutral-500"
          }`}>
            {formatTime(elapsedSeconds)}
          </span>

          {/* Status text - only when collapsed (replaces buttons) */}
          {!isExpanded && (
            <span className={`text-[10px] font-medium uppercase tracking-wider ${
              isPlaying ? "text-red-400/70" : isPaused ? "text-amber-400/70" : "text-neutral-600"
            }`}>
              {isPlaying ? t('session.recording') : isPaused ? t('session.paused') : t('session.stopped')}
            </span>
          )}
        </div>

        {/* Transport controls - only when expanded */}
        {isExpanded && (
          <>
            <div className="w-px h-6 bg-neutral-700/50" />

            <div className="flex items-center gap-1.5">
              {/* Play / Resume */}
              <button
                onClick={() => {
                  if (isStopped) onStartRecording();
                  else if (isPaused) onResume();
                }}
                disabled={isPlaying}
                className={`flex items-center justify-center w-9 h-9 rounded-lg transition-all ${
                  isPlaying
                    ? "text-green-500/20 cursor-default"
                    : "text-green-400 hover:bg-green-500/20 hover:text-green-300"
                }`}
                title={isStopped ? t('tools.startSession') : t('session.resume')}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </button>

              {/* Pause */}
              <button
                onClick={() => onPause()}
                disabled={!isPlaying}
                className={`flex items-center justify-center w-9 h-9 rounded-lg transition-all ${
                  !isPlaying
                    ? "text-amber-500/20 cursor-default"
                    : "text-amber-400 hover:bg-amber-500/20 hover:text-amber-300"
                }`}
                title={t('tools.pause')}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6zm8 0h4v16h-4z" />
                </svg>
              </button>

              {/* Stop / End */}
              <button
                onClick={() => onStopRecording()}
                disabled={isStopped}
                className={`flex items-center justify-center w-9 h-9 rounded-lg transition-all ${
                  isStopped
                    ? "text-red-500/20 cursor-default"
                    : "text-red-400 hover:bg-red-500/20 hover:text-red-300"
                }`}
                title={t('sessionEnd.endSession')}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="1" />
                </svg>
              </button>
            </div>

            {/* Status label */}
            <div className="w-px h-6 bg-neutral-700/50" />
            <span className={`text-[10px] font-medium uppercase tracking-wider min-w-[60px] ${
              isPlaying ? "text-red-400" : isPaused ? "text-amber-400" : "text-neutral-500"
            }`}>
              {isPlaying ? t('session.recording') : isPaused ? t('session.paused') : t('session.stopped')}
            </span>
          </>
        )}
      </div>


    </div>
  );
}
