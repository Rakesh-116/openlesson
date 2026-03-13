"use client";

import { useState, useRef, useEffect, useCallback } from "react";

type CollapsedSide = null | "left" | "right";

interface ResizablePaneProps {
  left: React.ReactNode;
  right: React.ReactNode;
  defaultLeftWidth?: number;
  minLeftWidth?: number;
  minRightWidth?: number;
  leftLabel?: string;
  rightLabel?: string;
  storageKey?: string;
}

export function ResizablePane({
  left,
  right,
  defaultLeftWidth = 50,
  minLeftWidth = 20,
  minRightWidth = 20,
  leftLabel = "Left Panel",
  rightLabel = "Right Panel",
  storageKey,
}: ResizablePaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftWidth, setLeftWidth] = useState(defaultLeftWidth);
  const [isDragging, setIsDragging] = useState(false);
  const [collapsedSide, setCollapsedSide] = useState<CollapsedSide>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const savedLeftWidthRef = useRef(defaultLeftWidth);

  // Load persisted state from localStorage on mount
  useEffect(() => {
    if (!storageKey) return;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (typeof parsed.leftWidth === "number") {
          setLeftWidth(parsed.leftWidth);
          savedLeftWidthRef.current = parsed.leftWidth;
        }
        if (parsed.collapsedSide === "left" || parsed.collapsedSide === "right") {
          setCollapsedSide(parsed.collapsedSide);
        }
      }
    } catch {
      // ignore malformed localStorage
    }
  }, [storageKey]);

  // Persist state to localStorage on changes
  const persistState = useCallback(
    (width: number, collapsed: CollapsedSide) => {
      if (!storageKey) return;
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({ leftWidth: width, collapsedSide: collapsed })
        );
      } catch {
        // ignore quota errors
      }
    },
    [storageKey]
  );

  // --- Drag logic (unchanged behavior) ---
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (collapsedSide) return; // no drag when collapsed
      e.preventDefault();
      setIsDragging(true);
    },
    [collapsedSide]
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const containerWidth = containerRect.width;
      const mouseX = e.clientX - containerRect.left;

      const leftPercent = (mouseX / containerWidth) * 100;
      const clampedPercent = Math.max(
        minLeftWidth,
        Math.min(100 - minRightWidth, leftPercent)
      );

      setLeftWidth(clampedPercent);
      savedLeftWidthRef.current = clampedPercent;
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      // Persist the new width after drag
      persistState(savedLeftWidthRef.current, collapsedSide);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, minLeftWidth, minRightWidth, collapsedSide, persistState]);

  // --- Collapse / Expand ---
  const collapseLeft = useCallback(() => {
    if (collapsedSide === null) {
      savedLeftWidthRef.current = leftWidth;
    }
    setIsTransitioning(true);
    setCollapsedSide("left");
    persistState(savedLeftWidthRef.current, "left");
    setTimeout(() => setIsTransitioning(false), 250);
  }, [collapsedSide, leftWidth, persistState]);

  const collapseRight = useCallback(() => {
    if (collapsedSide === null) {
      savedLeftWidthRef.current = leftWidth;
    }
    setIsTransitioning(true);
    setCollapsedSide("right");
    persistState(savedLeftWidthRef.current, "right");
    setTimeout(() => setIsTransitioning(false), 250);
  }, [collapsedSide, leftWidth, persistState]);

  const expand = useCallback(() => {
    setIsTransitioning(true);
    setLeftWidth(savedLeftWidthRef.current);
    setCollapsedSide(null);
    persistState(savedLeftWidthRef.current, null);
    setTimeout(() => setIsTransitioning(false), 250);
  }, [persistState]);

  // --- Double-click to reset to 50/50 ---
  const handleDoubleClick = useCallback(() => {
    setIsTransitioning(true);
    setLeftWidth(50);
    savedLeftWidthRef.current = 50;
    setCollapsedSide(null);
    persistState(50, null);
    setTimeout(() => setIsTransitioning(false), 250);
  }, [persistState]);

  // --- Compute actual widths ---
  const effectiveLeftWidth =
    collapsedSide === "left" ? 0 : collapsedSide === "right" ? 100 : leftWidth;
  const effectiveRightWidth = 100 - effectiveLeftWidth;

  const transitionClass =
    isTransitioning && !isDragging ? "transition-all duration-200 ease-in-out" : "";

  return (
    <div ref={containerRef} className="flex flex-1 min-h-0 overflow-hidden relative">
      {/* ---- Left collapsed strip ---- */}
      {collapsedSide === "left" && (
        <div className="flex-shrink-0 w-7 bg-neutral-900 border-r border-neutral-800 flex flex-col items-center justify-center relative group cursor-pointer hover:bg-neutral-800/80 transition-colors"
          onClick={expand}
          title={`Expand ${leftLabel}`}
        >
          {/* Rotated label */}
          <span
            className="absolute text-[9px] font-medium text-neutral-500 uppercase tracking-widest whitespace-nowrap select-none pointer-events-none"
            style={{
              writingMode: "vertical-rl",
              textOrientation: "mixed",
              transform: "rotate(180deg)",
            }}
          >
            {leftLabel}
          </span>
          {/* Expand chevron */}
          <div className="absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
            <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
          </div>
        </div>
      )}

      {/* ---- Left panel ---- */}
      <div
        style={{ width: collapsedSide === "left" ? "0%" : collapsedSide === "right" ? "100%" : `${leftWidth}%` }}
        className={`min-w-0 overflow-hidden ${transitionClass} ${collapsedSide === "left" ? "invisible" : ""}`}
      >
        {left}
      </div>

      {/* ---- Separator bar ---- */}
      {collapsedSide === null && (
        <div
          className={`w-1.5 cursor-col-resize bg-neutral-800 hover:bg-blue-500/70 flex-shrink-0 relative group transition-colors ${
            isDragging ? "bg-blue-500" : ""
          }`}
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClick}
        >
          {/* Chevron buttons — visible on hover */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
            <button
              className="pointer-events-auto w-5 h-5 rounded bg-neutral-700 hover:bg-neutral-600 flex items-center justify-center border border-neutral-600 shadow-sm"
              onClick={(e) => {
                e.stopPropagation();
                collapseLeft();
              }}
              onMouseDown={(e) => e.stopPropagation()}
              title={`Collapse ${leftLabel}`}
            >
              <ChevronLeft className="w-3 h-3 text-neutral-300" />
            </button>
            <button
              className="pointer-events-auto w-5 h-5 rounded bg-neutral-700 hover:bg-neutral-600 flex items-center justify-center border border-neutral-600 shadow-sm"
              onClick={(e) => {
                e.stopPropagation();
                collapseRight();
              }}
              onMouseDown={(e) => e.stopPropagation()}
              title={`Collapse ${rightLabel}`}
            >
              <ChevronRight className="w-3 h-3 text-neutral-300" />
            </button>
          </div>
        </div>
      )}

      {/* ---- Right panel ---- */}
      <div
        style={{ width: collapsedSide === "right" ? "0%" : collapsedSide === "left" ? "100%" : `${effectiveRightWidth}%` }}
        className={`min-w-0 overflow-hidden ${transitionClass} ${collapsedSide === "right" ? "invisible" : ""}`}
      >
        {right}
      </div>

      {/* ---- Right collapsed strip ---- */}
      {collapsedSide === "right" && (
        <div
          className="flex-shrink-0 w-7 bg-neutral-900 border-l border-neutral-800 flex flex-col items-center justify-center relative group cursor-pointer hover:bg-neutral-800/80 transition-colors"
          onClick={expand}
          title={`Expand ${rightLabel}`}
        >
          {/* Rotated label */}
          <span
            className="absolute text-[9px] font-medium text-neutral-500 uppercase tracking-widest whitespace-nowrap select-none pointer-events-none"
            style={{
              writingMode: "vertical-rl",
              textOrientation: "mixed",
            }}
          >
            {rightLabel}
          </span>
          {/* Expand chevron */}
          <div className="absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
            <ChevronLeft className="w-3.5 h-3.5 text-neutral-400" />
          </div>
        </div>
      )}
    </div>
  );
}

// --- Inline SVG icon components ---

function ChevronLeft({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}
