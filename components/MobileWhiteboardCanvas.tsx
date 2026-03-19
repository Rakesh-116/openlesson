"use client";

import { useRef, useEffect, useState, useCallback } from "react";

interface MobileWhiteboardCanvasProps {
  onCanvasChange?: (dataUrl: string) => void;
  initialData?: string;
  onOpenCamera?: () => void;
  onCapture?: () => void;
}

interface PastedObject {
  type: "image" | "text";
  dataUrl?: string;
  text?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  aspectRatio: number;
}

export function MobileWhiteboardCanvas({ 
  onCanvasChange, 
  initialData,
  onOpenCamera,
  onCapture,
}: MobileWhiteboardCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushColor, setBrushColor] = useState("#ffffff");
  const [brushSize, setBrushSize] = useState(5);
  const [tool, setTool] = useState<"draw" | "eraser">("draw");
  const [pastedObject, setPastedObject] = useState<PastedObject | null>(null);
  const [showPalette, setShowPalette] = useState(false);
  
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const isDrawingRef = useRef(false);

  const colors = [
    { color: "#ffffff", name: "White" },
    { color: "#22c55e", name: "Green" },
    { color: "#3b82f6", name: "Blue" },
    { color: "#ef4444", name: "Red" },
    { color: "#f59e0b", name: "Orange" },
    { color: "#a855f7", name: "Purple" },
  ];

  const brushSizes = [
    { size: 3, label: "S" },
    { size: 6, label: "M" },
    { size: 12, label: "L" },
    { size: 24, label: "XL" },
  ];

  const getCoordinates = useCallback((clientX: number, clientY: number): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }, []);

  const drawLine = useCallback((fromX: number, fromY: number, toX: number, toY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.strokeStyle = tool === "eraser" ? "#0a0a0a" : brushColor;
    ctx.lineWidth = tool === "eraser" ? brushSize * 3 : brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  }, [tool, brushColor, brushSize]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (pastedObject) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    
    const coords = getCoordinates(e.clientX, e.clientY);
    if (coords) {
      isDrawingRef.current = true;
      setIsDrawing(true);
      lastPointRef.current = coords;
    }
  }, [getCoordinates, pastedObject]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDrawingRef.current || !lastPointRef.current) return;
    e.preventDefault();

    const coords = getCoordinates(e.clientX, e.clientY);
    if (!coords) return;

    drawLine(lastPointRef.current.x, lastPointRef.current.y, coords.x, coords.y);
    lastPointRef.current = coords;
  }, [getCoordinates, drawLine]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (isDrawingRef.current && canvasRef.current) {
      const dataUrl = canvasRef.current.toDataURL("image/png");
      onCanvasChange?.(dataUrl);
    }
    isDrawingRef.current = false;
    setIsDrawing(false);
    lastPointRef.current = null;
  }, [onCanvasChange]);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    onCanvasChange?.(canvas.toDataURL("image/png"));
  }, [onCanvasChange]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (!dataUrl) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const img = new window.Image();
      img.onload = () => {
        const canvasW = canvas.width;
        const canvasH = canvas.height;
        const maxW = canvasW * 0.8;
        const maxH = canvasH * 0.8;

        let w = img.naturalWidth;
        let h = img.naturalHeight;

        if (w > maxW || h > maxH) {
          const scale = Math.min(maxW / w, maxH / h);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }

        const x = Math.round((canvasW - w) / 2);
        const y = Math.round((canvasH - h) / 2);

        setPastedObject({
          type: "image",
          dataUrl,
          x,
          y,
          width: w,
          height: h,
          aspectRatio: img.naturalWidth / img.naturalHeight,
        });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }, []);

  const commitPaste = useCallback(() => {
    if (!pastedObject) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (pastedObject.type === "image" && pastedObject.dataUrl) {
      const img = new window.Image();
      img.onload = () => {
        ctx.drawImage(img, pastedObject.x, pastedObject.y, pastedObject.width, pastedObject.height);
        onCanvasChange?.(canvas.toDataURL("image/png"));
        setPastedObject(null);
      };
      img.src = pastedObject.dataUrl;
    }
  }, [pastedObject, onCanvasChange]);

  const cancelPaste = useCallback(() => {
    setPastedObject(null);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let resizeTimer: ReturnType<typeof setTimeout>;
    
    const resizeCanvas = () => {
      resizeTimer = setTimeout(() => {
        const rect = container.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        
        if (width <= 0 || height <= 0) return;
        
        const dpr = window.devicePixelRatio || 1;
        const oldData = canvas.toDataURL();
        
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#0a0a0a";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          if (oldData && oldData !== "data:,") {
            const img = new Image();
            img.onload = () => {
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            };
            img.src = oldData;
          }
        }
      }, 16);
    };

    resizeCanvas();
    
    const resizeObserver = new ResizeObserver(() => {
      resizeCanvas();
    });
    resizeObserver.observe(container);

    return () => {
      clearTimeout(resizeTimer);
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!initialData) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    requestAnimationFrame(() => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const img = new window.Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = initialData;
    });
  }, [initialData]);

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]">
      {/* Canvas - fills space above toolbar */}
      <div 
        ref={containerRef} 
        className="flex-1 w-full min-h-0 relative"
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          className="absolute inset-0 w-full h-full touch-none"
        />

        {/* Paste overlay - positioned relative to canvas */}
        {pastedObject && (
          <>
            <div className="absolute inset-0 bg-black/20 pointer-events-none z-10" />
            <div
              className="absolute z-20 bg-black/40 border-2 border-dashed border-cyan-400/80"
              style={{
                left: `${(pastedObject.x / (canvasRef.current?.width || 1)) * 100}%`,
                top: `${(pastedObject.y / (canvasRef.current?.height || 1)) * 100}%`,
                width: `${(pastedObject.width / (canvasRef.current?.width || 1)) * 100}%`,
                height: `${(pastedObject.height / (canvasRef.current?.height || 1)) * 100}%`,
              }}
            >
              {pastedObject.type === "image" && pastedObject.dataUrl ? (
                <img
                  src={pastedObject.dataUrl}
                  alt="Pasted"
                  className="w-full h-full object-contain pointer-events-none"
                  draggable={false}
                />
              ) : null}
            </div>
          </>
        )}
      </div>

      {/* Paste buttons - above toolbar */}
      {pastedObject && (
        <div className="absolute bottom-[90px] left-4 right-4 flex gap-2 z-30">
          <button
            onClick={commitPaste}
            className="flex-1 py-2.5 bg-cyan-500 text-black font-medium rounded-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Place
          </button>
          <button
            onClick={cancelPaste}
            className="flex-1 py-2.5 bg-neutral-800 text-white font-medium rounded-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Bottom Toolbar */}
      <div className="shrink-0 bg-neutral-900 border-t border-neutral-800">
        {/* Palette section (expandable) */}
        <div className={`overflow-hidden transition-all duration-300 ${showPalette ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="p-2 space-y-2">
            <div className="flex gap-2 justify-center">
              {colors.map(({ color }) => (
                <button
                  key={color}
                  onClick={() => { setBrushColor(color); setTool("draw"); }}
                  className={`w-8 h-8 rounded-full transition-all ${
                    brushColor === color && tool === "draw" 
                      ? "ring-2 ring-cyan-400 ring-offset-2 ring-offset-neutral-900 scale-110" 
                      : "hover:scale-105"
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <div className="flex gap-2 justify-center">
              {brushSizes.map(({ size, label }) => (
                <button
                  key={size}
                  onClick={() => setBrushSize(size)}
                  className={`w-10 h-7 rounded-md flex items-center justify-center text-xs font-medium transition-all ${
                    brushSize === size 
                      ? "bg-cyan-500 text-black" 
                      : "bg-neutral-800 text-neutral-400"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main toolbar */}
        <div className="flex items-center justify-between px-1.5 py-1.5">
          {/* Draw/Erase */}
          <div className="flex gap-1">
            <button
              onClick={() => { setTool("draw"); }}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                tool === "draw" 
                  ? "bg-cyan-500 text-black" 
                  : "bg-neutral-800 text-neutral-400"
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
            <button
              onClick={() => setTool("eraser")}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                tool === "eraser" 
                  ? "bg-amber-500 text-black" 
                  : "bg-neutral-800 text-neutral-400"
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>

          {/* Palette toggle */}
          <button
            onClick={() => setShowPalette(!showPalette)}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
              showPalette
                ? "bg-cyan-500 text-black"
                : "bg-neutral-800 text-neutral-400"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
          </button>

          {/* Camera */}
          <button
            onClick={() => onOpenCamera?.()}
            className="w-9 h-9 rounded-lg bg-neutral-800 text-neutral-400 flex items-center justify-center"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>

          {/* Gallery */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-9 h-9 rounded-lg bg-neutral-800 text-neutral-400 flex items-center justify-center"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>

          {/* Clear */}
          <button
            onClick={clearCanvas}
            className="w-9 h-9 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />
    </div>
  );
}
