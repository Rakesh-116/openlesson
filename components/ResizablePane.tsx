"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface ResizablePaneProps {
  left: React.ReactNode;
  right: React.ReactNode;
  defaultLeftWidth?: number;
  minLeftWidth?: number;
  minRightWidth?: number;
}

export function ResizablePane({
  left,
  right,
  defaultLeftWidth = 50,
  minLeftWidth = 20,
  minRightWidth = 20,
}: ResizablePaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftWidth, setLeftWidth] = useState(defaultLeftWidth);
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      
      const containerRect = containerRef.current.getBoundingClientRect();
      const containerWidth = containerRect.width;
      const mouseX = e.clientX - containerRect.left;
      
      const leftPercent = (mouseX / containerWidth) * 100;
      const clampedPercent = Math.max(minLeftWidth, Math.min(100 - minRightWidth, leftPercent));
      
      setLeftWidth(clampedPercent);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, minLeftWidth, minRightWidth]);

  return (
    <div ref={containerRef} className="flex flex-1 min-h-0">
      <div style={{ width: `${leftWidth}%` }} className="min-w-0">
        {left}
      </div>
      <div
        className={`w-1 cursor-col-resize bg-neutral-800 hover:bg-blue-500 transition-colors flex-shrink-0 ${
          isDragging ? "bg-blue-500" : ""
        }`}
        onMouseDown={handleMouseDown}
      />
      <div style={{ width: `${100 - leftWidth}%` }} className="min-w-0">
        {right}
      </div>
    </div>
  );
}
