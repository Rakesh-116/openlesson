"use client";

import { useRef, useEffect, useState, useCallback } from "react";

interface WhiteboardCanvasProps {
  onCanvasChange?: (dataUrl: string) => void;
  initialData?: string;
}

export function WhiteboardCanvas({ onCanvasChange, initialData }: WhiteboardCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushColor, setBrushColor] = useState("#ffffff");
  const [brushSize, setBrushSize] = useState(3);
  const [tool, setTool] = useState<"draw" | "eraser">("draw");
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const getCoordinates = useCallback((e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ("touches" in e) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    } else {
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    }
  }, []);

  const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const coords = getCoordinates(e);
    if (coords) {
      setIsDrawing(true);
      lastPointRef.current = coords;
    }
  }, [getCoordinates]);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();

    const canvas = canvasRef.current;
    const coords = getCoordinates(e);
    if (!canvas || !coords || !lastPointRef.current) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(coords.x, coords.y);
    ctx.strokeStyle = tool === "eraser" ? "#0a0a0a" : brushColor;
    ctx.lineWidth = tool === "eraser" ? brushSize * 3 : brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();

    lastPointRef.current = coords;
  }, [isDrawing, getCoordinates, brushColor, brushSize, tool]);

  const stopDrawing = useCallback(() => {
    if (isDrawing && canvasRef.current) {
      const dataUrl = canvasRef.current.toDataURL("image/png");
      onCanvasChange?.(dataUrl);
    }
    setIsDrawing(false);
    lastPointRef.current = null;
  }, [isDrawing, onCanvasChange]);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    onCanvasChange?.(canvas.toDataURL("image/png"));
  }, [onCanvasChange]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const oldData = canvas.toDataURL("image/png");
      
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#0a0a0a";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (oldData && oldData.length > 0) {
          const img = new Image();
          img.onload = () => {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          };
          img.src = oldData;
        }
      }
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, []);

  const colors = ["#ffffff", "#22c55e", "#3b82f6", "#ef4444"];

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 p-2 border-b border-neutral-800 bg-neutral-900/30 overflow-x-auto min-w-0">
        <button
          onClick={() => setTool("draw")}
          className={`p-2 rounded-lg transition-colors ${
            tool === "draw" ? "bg-blue-600 text-white" : "bg-neutral-800 text-neutral-400 hover:text-white"
          }`}
          title="Draw"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
        <button
          onClick={() => setTool("eraser")}
          className={`p-2 rounded-lg transition-colors ${
            tool === "eraser" ? "bg-blue-600 text-white" : "bg-neutral-800 text-neutral-400 hover:text-white"
          }`}
          title="Eraser"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12.5L12 20l-7.5-7.5m0 0l7.5-7.5m-7.5 7.5h18" />
          </svg>
        </button>
        
        <div className="w-px h-6 bg-neutral-700" />
        
        <div className="flex gap-1">
          {colors.map((color) => (
            <button
              key={color}
              onClick={() => { setBrushColor(color); setTool("draw"); }}
              className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${
                brushColor === color && tool === "draw" ? "border-blue-500 scale-110" : "border-transparent"
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>

        <div className="w-px h-6 bg-neutral-700" />
        
        <input
          type="range"
          min="1"
          max="20"
          value={brushSize}
          onChange={(e) => setBrushSize(Number(e.target.value))}
          className="w-20 h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer"
        />

        <div className="flex-1" />
        
        <button
          onClick={clearCanvas}
          className="px-2 py-1 text-xs text-neutral-400 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors"
        >
          Clear
        </button>
      </div>

      <div ref={containerRef} className="flex-1 min-h-0 cursor-crosshair touch-none">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="block"
        />
      </div>
    </div>
  );
}
