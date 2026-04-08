"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useI18n } from "@/lib/i18n";

interface WhiteboardCanvasProps {
  onCanvasChange?: (dataUrl: string) => void;
  initialData?: string;
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

type DragMode = "move" | "resize" | null;

export function WhiteboardCanvas({ onCanvasChange, initialData }: WhiteboardCanvasProps) {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushColor, setBrushColor] = useState("#ffffff");
  const [brushSize, setBrushSize] = useState(3);
  const [tool, setTool] = useState<"draw" | "eraser">("draw");
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Paste overlay state
  const [pastedObject, setPastedObject] = useState<PastedObject | null>(null);
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; objX: number; objY: number; objW: number; objH: number } | null>(null);
  const pastedImageRef = useRef<HTMLImageElement | null>(null);

  // File upload ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  // Convert canvas-space coords to CSS-space coords relative to the container
  const canvasToCss = useCallback((cx: number, cy: number, cw?: number, ch?: number) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return { x: 0, y: 0, w: 0, h: 0 };
    const rect = container.getBoundingClientRect();
    const scaleX = rect.width / canvas.width;
    const scaleY = rect.height / canvas.height;
    return {
      x: cx * scaleX,
      y: cy * scaleY,
      w: (cw ?? 0) * scaleX,
      h: (ch ?? 0) * scaleY,
    };
  }, []);

  // Convert CSS-space delta to canvas-space delta
  const cssDeltaToCanvas = useCallback((dx: number, dy: number) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return { dx: 0, dy: 0 };
    const rect = container.getBoundingClientRect();
    return {
      dx: dx * (canvas.width / rect.width),
      dy: dy * (canvas.height / rect.height),
    };
  }, []);

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
    // Disable drawing while paste overlay is active
    if (pastedObject) return;
    e.preventDefault();
    const coords = getCoordinates(e);
    if (coords) {
      setIsDrawing(true);
      lastPointRef.current = coords;
    }
  }, [getCoordinates, pastedObject]);

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

  // --- Paste: commit pasted object onto the canvas ---
  const commitPaste = useCallback(() => {
    if (!pastedObject) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (pastedObject.type === "image" && pastedObject.dataUrl) {
      const img = pastedImageRef.current;
      if (img && img.complete) {
        ctx.drawImage(img, pastedObject.x, pastedObject.y, pastedObject.width, pastedObject.height);
      } else {
        // Fallback: load and draw
        const fallbackImg = new Image();
        fallbackImg.onload = () => {
          ctx.drawImage(fallbackImg, pastedObject.x, pastedObject.y, pastedObject.width, pastedObject.height);
          onCanvasChange?.(canvas.toDataURL("image/png"));
        };
        fallbackImg.src = pastedObject.dataUrl;
        setPastedObject(null);
        pastedImageRef.current = null;
        return;
      }
    } else if (pastedObject.type === "text" && pastedObject.text) {
      const dpr = window.devicePixelRatio || 1;
      const fontSize = 16 * dpr;
      ctx.font = `${fontSize}px "Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.fillStyle = "#ffffff";
      ctx.textBaseline = "top";

      const lines = pastedObject.text.split("\n");
      const lineHeight = fontSize * 1.3;
      const padding = 8 * dpr;

      for (let i = 0; i < lines.length; i++) {
        const lineY = pastedObject.y + padding + i * lineHeight;
        if (lineY > pastedObject.y + pastedObject.height) break;
        ctx.fillText(lines[i], pastedObject.x + padding, lineY, pastedObject.width - padding * 2);
      }
    }

    onCanvasChange?.(canvas.toDataURL("image/png"));
    setPastedObject(null);
    pastedImageRef.current = null;
  }, [pastedObject, onCanvasChange]);

  const cancelPaste = useCallback(() => {
    setPastedObject(null);
    pastedImageRef.current = null;
  }, []);

  // --- Paste: handle clipboard paste event ---
  const handlePaste = useCallback((e: ClipboardEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const items = e.clipboardData?.items;
    if (!items) return;

    // Check for image first
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (!blob) continue;

        const reader = new FileReader();
        reader.onload = (ev) => {
          const dataUrl = ev.target?.result as string;
          if (!dataUrl) return;

          const img = new Image();
          img.onload = () => {
            const canvasW = canvas.width;
            const canvasH = canvas.height;
            const maxW = canvasW * 0.8;
            const maxH = canvasH * 0.8;

            let w = img.naturalWidth;
            let h = img.naturalHeight;

            // Scale down to fit, never upscale
            if (w > maxW || h > maxH) {
              const scale = Math.min(maxW / w, maxH / h);
              w = Math.round(w * scale);
              h = Math.round(h * scale);
            }

            const x = Math.round((canvasW - w) / 2);
            const y = Math.round((canvasH - h) / 2);

            // If there's already a paste overlay, commit it first
            setPastedObject((prev) => {
              if (prev) {
                // Auto-commit the previous paste by drawing it
                const ctx = canvas.getContext("2d");
                if (ctx && prev.type === "image" && prev.dataUrl && pastedImageRef.current?.complete) {
                  ctx.drawImage(pastedImageRef.current, prev.x, prev.y, prev.width, prev.height);
                  onCanvasChange?.(canvas.toDataURL("image/png"));
                }
              }
              return null;
            });

            pastedImageRef.current = img;
            // Use setTimeout to ensure previous state is cleared
            setTimeout(() => {
              setPastedObject({
                type: "image",
                dataUrl,
                x,
                y,
                width: w,
                height: h,
                aspectRatio: img.naturalWidth / img.naturalHeight,
              });
            }, 0);
          };
          img.src = dataUrl;
        };
        reader.readAsDataURL(blob);
        return;
      }
    }

    // Check for text
    const text = e.clipboardData?.getData("text/plain");
    if (text && text.trim().length > 0) {
      e.preventDefault();
      const trimmedText = text.length > 2000 ? text.slice(0, 2000) + "..." : text;

      const canvasW = canvas.width;
      const canvasH = canvas.height;
      const dpr = window.devicePixelRatio || 1;
      const fontSize = 16 * dpr;
      const lineHeight = fontSize * 1.3;
      const padding = 8 * dpr;

      // Measure text to determine overlay dimensions
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.font = `${fontSize}px "Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif`;

      const lines = trimmedText.split("\n");
      let maxLineWidth = 0;
      for (const line of lines) {
        const measured = ctx.measureText(line);
        if (measured.width > maxLineWidth) maxLineWidth = measured.width;
      }

      let w = Math.min(maxLineWidth + padding * 2, canvasW * 0.8);
      let h = Math.min(lines.length * lineHeight + padding * 2, canvasH * 0.8);

      // Minimum size
      w = Math.max(w, 100 * dpr);
      h = Math.max(h, 40 * dpr);

      const x = Math.round((canvasW - w) / 2);
      const y = Math.round((canvasH - h) / 2);

      // Auto-commit previous paste overlay
      setPastedObject((prev) => {
        if (prev) {
          const prevCtx = canvas.getContext("2d");
          if (prevCtx && prev.type === "image" && prev.dataUrl && pastedImageRef.current?.complete) {
            prevCtx.drawImage(pastedImageRef.current, prev.x, prev.y, prev.width, prev.height);
            onCanvasChange?.(canvas.toDataURL("image/png"));
          }
        }
        return null;
      });

      pastedImageRef.current = null;
      setTimeout(() => {
        setPastedObject({
          type: "text",
          text: trimmedText,
          x,
          y,
          width: w,
          height: h,
          aspectRatio: w / h,
        });
      }, 0);
    }
  }, [onCanvasChange]);

  // --- Image from file upload ---
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (!dataUrl) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const img = new Image();
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

        setPastedObject((prev) => {
          if (prev) {
            const ctx = canvas.getContext("2d");
            if (ctx && prev.type === "image" && prev.dataUrl && pastedImageRef.current?.complete) {
              ctx.drawImage(pastedImageRef.current, prev.x, prev.y, prev.width, prev.height);
              onCanvasChange?.(canvas.toDataURL("image/png"));
            }
          }
          return null;
        });

        pastedImageRef.current = img;
        setTimeout(() => {
          setPastedObject({
            type: "image",
            dataUrl,
            x,
            y,
            width: w,
            height: h,
            aspectRatio: w / h,
          });
        }, 0);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }, [onCanvasChange]);

  // --- Capture from camera ---
  const captureFromCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      setCameraStream(stream);

      const video = document.createElement("video");
      video.srcObject = stream;
      video.setAttribute("playsinline", "true");
      video.play();

      video.onloadedmetadata = () => {
        const canvas = canvasRef.current;
        if (!canvas) {
          stream.getTracks().forEach((t) => t.stop());
          setCameraStream(null);
          return;
        }

        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = video.videoWidth;
        tempCanvas.height = video.videoHeight;
        const ctx = tempCanvas.getContext("2d");
        if (!ctx) {
          stream.getTracks().forEach((t) => t.stop());
          setCameraStream(null);
          return;
        }

        ctx.drawImage(video, 0, 0);
        const dataUrl = tempCanvas.toDataURL("image/jpeg", 0.9);

        stream.getTracks().forEach((t) => t.stop());
        setCameraStream(null);

        const img = new Image();
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

          setPastedObject((prev) => {
            if (prev) {
              const ctx = canvas.getContext("2d");
              if (ctx && prev.type === "image" && prev.dataUrl && pastedImageRef.current?.complete) {
                ctx.drawImage(pastedImageRef.current, prev.x, prev.y, prev.width, prev.height);
                onCanvasChange?.(canvas.toDataURL("image/png"));
              }
            }
            return null;
          });

          pastedImageRef.current = img;
          setTimeout(() => {
            setPastedObject({
              type: "image",
              dataUrl,
              x,
              y,
              width: w,
              height: h,
              aspectRatio: w / h,
            });
          }, 0);
        };
        img.src = dataUrl;
      };
    } catch (err) {
      console.error("Camera capture failed:", err);
    }
  }, [onCanvasChange]);

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [cameraStream]);

  // --- Paste: drag and resize handlers ---
  const handleOverlayMouseDown = useCallback((e: React.MouseEvent, mode: "move" | "resize") => {
    e.preventDefault();
    e.stopPropagation();
    if (!pastedObject) return;
    setDragMode(mode);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      objX: pastedObject.x,
      objY: pastedObject.y,
      objW: pastedObject.width,
      objH: pastedObject.height,
    };
  }, [pastedObject]);

  useEffect(() => {
    if (!dragMode) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current || !pastedObject) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const dxCss = e.clientX - dragStartRef.current.mouseX;
      const dyCss = e.clientY - dragStartRef.current.mouseY;
      const { dx, dy } = cssDeltaToCanvas(dxCss, dyCss);

      if (dragMode === "move") {
        setPastedObject((prev) => {
          if (!prev || !dragStartRef.current) return prev;
          return {
            ...prev,
            x: dragStartRef.current.objX + dx,
            y: dragStartRef.current.objY + dy,
          };
        });
      } else if (dragMode === "resize") {
        setPastedObject((prev) => {
          if (!prev || !dragStartRef.current) return prev;
          const newW = Math.max(30, dragStartRef.current.objW + dx);
          const isImage = prev.type === "image";
          const newH = isImage
            ? newW / prev.aspectRatio
            : Math.max(20, dragStartRef.current.objH + dy);
          return {
            ...prev,
            width: newW,
            height: newH,
          };
        });
      }
    };

    const handleMouseUp = () => {
      setDragMode(null);
      dragStartRef.current = null;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragMode, pastedObject, cssDeltaToCanvas]);

  // --- Paste: keyboard shortcuts (Enter to commit, Escape to cancel) ---
  useEffect(() => {
    if (!pastedObject) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commitPaste();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelPaste();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pastedObject, commitPaste, cancelPaste]);

  // --- Paste: attach paste event listener to window when canvas container is focused ---
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Listen on the document so paste works whenever the canvas tool is visible
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const oldWidth = canvas.width;
      const oldHeight = canvas.height;

      if (oldWidth > 0 && oldHeight > 0) {
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = oldWidth;
        tempCanvas.height = oldHeight;
        const tempCtx = tempCanvas.getContext("2d");
        if (tempCtx) {
          tempCtx.drawImage(canvas, 0, 0);
        }

        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;

        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#0a0a0a";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(tempCanvas, 0, 0);
        }
      } else {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;

        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#0a0a0a";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
      }
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, []);

  // Restore canvas from initialData when component mounts
  useEffect(() => {
    if (!initialData) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      // Draw the saved image onto the canvas
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = initialData;
  }, [initialData]);

  const colors = ["#ffffff", "#22c55e", "#3b82f6", "#ef4444"];

  // Compute overlay CSS position from canvas-space coords
  const overlayStyle = pastedObject
    ? (() => {
        const pos = canvasToCss(pastedObject.x, pastedObject.y, pastedObject.width, pastedObject.height);
        return {
          left: `${pos.x}px`,
          top: `${pos.y}px`,
          width: `${pos.w}px`,
          height: `${pos.h}px`,
        };
      })()
    : null;

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 p-2 border-b border-neutral-800 bg-neutral-900/30 overflow-x-auto min-w-0">
        <button
          onClick={() => setTool("draw")}
          className={`p-2 rounded-lg transition-colors ${
            tool === "draw" ? "bg-blue-600 text-white" : "bg-neutral-800 text-neutral-400 hover:text-white"
          }`}
          title={t('whiteboard.draw')}
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
          title={t('whiteboard.eraser')}
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

        {pastedObject && (
          <span className="text-[10px] text-neutral-500 hidden sm:inline">
            {t('whiteboard.enterToPlaceEscCancel')}
          </span>
        )}

        <button
          onClick={captureFromCamera}
          className="lg:hidden p-2 rounded-lg bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
          title={t('whiteboard.takePhoto')}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="hidden lg:inline-flex p-2 rounded-lg bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
          title={t('whiteboard.uploadImage')}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />
        
        <button
          onClick={clearCanvas}
          className="px-2 py-1 text-xs text-neutral-400 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors"
        >
          {t('whiteboard.clear')}
        </button>
      </div>

      <div ref={containerRef} className="flex-1 min-h-0 relative cursor-crosshair touch-none">
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

        {/* Paste overlay */}
        {pastedObject && overlayStyle && (
          <>
            {/* Semi-transparent backdrop to indicate paste mode */}
            <div className="absolute inset-0 bg-black/20 pointer-events-none" />

            {/* Movable pasted object */}
            <div
              className="absolute border-2 border-dashed border-blue-500/80 cursor-move select-none overflow-hidden"
              style={overlayStyle}
              onMouseDown={(e) => handleOverlayMouseDown(e, "move")}
            >
              {pastedObject.type === "image" && pastedObject.dataUrl ? (
                <img
                  src={pastedObject.dataUrl}
                  alt="Pasted"
                  className="w-full h-full object-contain pointer-events-none"
                  draggable={false}
                />
              ) : (
                <div
                  className="w-full h-full text-white text-sm font-sans p-2 whitespace-pre-wrap overflow-hidden pointer-events-none leading-snug"
                  style={{ fontSize: "14px" }}
                >
                  {pastedObject.text}
                </div>
              )}

              {/* Resize handle (bottom-right corner) */}
              <div
                className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
                onMouseDown={(e) => handleOverlayMouseDown(e, "resize")}
              >
                <svg
                  className="w-4 h-4 text-blue-400"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                >
                  <path d="M14 14H10V12H12V10H14V14Z" />
                  <path d="M14 8H12V6H14V8Z" opacity="0.6" />
                  <path d="M8 14V12H6V14H8Z" opacity="0.6" />
                </svg>
              </div>
            </div>

            {/* Confirm / Cancel buttons below the overlay */}
            <div
              className="absolute flex items-center gap-1.5"
              style={{
                left: overlayStyle.left,
                top: `calc(${overlayStyle.top} + ${overlayStyle.height} + 6px)`,
              }}
            >
              <button
                onClick={(e) => { e.stopPropagation(); commitPaste(); }}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-md transition-colors shadow-lg"
                title={t('whiteboard.placeOnCanvas')}
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                {t('whiteboard.place')}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); cancelPaste(); }}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-neutral-300 bg-neutral-800 hover:bg-neutral-700 rounded-md transition-colors shadow-lg"
                title={t('whiteboard.cancel')}
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                {t('whiteboard.cancelLabel')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
