"use client";

import { useEffect, useRef, useState } from "react";

interface AudioPlayerProps {
  audioBlob: Blob;
}

export function AudioPlayer({ audioBlob }: AudioPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationRef = useRef<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const historyRef = useRef<Float32Array[]>([]);

  useEffect(() => {
    const audio = new Audio(URL.createObjectURL(audioBlob));
    audioRef.current = audio;

    audio.addEventListener("loadedmetadata", () => {
      setDuration(audio.duration);
    });

    audio.addEventListener("ended", () => {
      setIsPlaying(false);
      historyRef.current = [];
    });

    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.85;

    const source = audioContext.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(audioContext.destination);

    audioContextRef.current = audioContext;
    analyserRef.current = analyser;
    sourceRef.current = source;

    return () => {
      audio.pause();
      audio.src = "";
      audioContextRef.current?.close();
      cancelAnimationFrame(animationRef.current);
      historyRef.current = [];
    };
  }, [audioBlob]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    const audio = audioRef.current;
    if (!canvas || !analyser || !audio) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const timeDomain = new Float32Array(analyser.fftSize);
    historyRef.current = [];

    const draw = () => {
      if (!canvas || !analyser || !audio) return;
      
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      ctx.clearRect(0, 0, w, h);

      analyser.getFloatTimeDomainData(timeDomain);

      let rms = 0;
      for (let i = 0; i < timeDomain.length; i++) rms += timeDomain[i] * timeDomain[i];
      rms = Math.sqrt(rms / timeDomain.length);
      const intensity = Math.min(1, rms * 8);

      historyRef.current.push(new Float32Array(timeDomain));
      if (historyRef.current.length > 4) historyRef.current.shift();

      historyRef.current.forEach((hist, idx) => {
        const alpha = ((idx + 1) / historyRef.current.length) * 0.15;
        drawWaveform(ctx, hist, w, h, `rgba(59, 130, 246, ${alpha})`, 1.5);
      });

      const gradient = ctx.createLinearGradient(0, 0, w, 0);
      gradient.addColorStop(0, `rgba(59, 130, 246, ${0.3 + intensity * 0.7})`);
      gradient.addColorStop(0.5, `rgba(59, 130, 246, ${0.3 + intensity * 0.7})`);
      gradient.addColorStop(1, `rgba(59, 130, 246, ${0.3 + intensity * 0.7})`);

      drawWaveform(ctx, timeDomain, w, h, gradient, 2 + intensity * 1.5);

      if (intensity > 0.05) {
        ctx.save();
        ctx.filter = `blur(${4 + intensity * 8}px)`;
        ctx.globalAlpha = intensity * 0.4;
        drawWaveform(ctx, timeDomain, w, h, "rgba(59, 130, 246, 0.6)", 3);
        ctx.restore();
      }

      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.strokeStyle = "rgba(115, 115, 115, 0.08)";
      ctx.lineWidth = 0.5;
      ctx.stroke();

      animationRef.current = requestAnimationFrame(draw);
    };

    if (isPlaying) {
      if (audioContextRef.current?.state === "suspended") {
        audioContextRef.current.resume();
      }
      draw();
    } else {
      cancelAnimationFrame(animationRef.current);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      historyRef.current = [];
      
      const w = canvas.width / (window.devicePixelRatio || 1);
      const h = canvas.height / (window.devicePixelRatio || 1);
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.strokeStyle = "rgba(115, 115, 115, 0.2)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [isPlaying]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audioContextRef.current?.state === "suspended") {
      await audioContextRef.current.resume();
    }

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const progress = x / rect.width;
    audio.currentTime = progress * duration;
  };

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={togglePlay}
        className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-blue-600 hover:bg-blue-500 text-white transition-colors"
      >
        {isPlaying ? (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
          </svg>
        ) : (
          <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      <div 
        className="flex-1 cursor-pointer"
        onClick={handleSeek}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-14 sm:h-20 rounded-lg"
        />
      </div>
    </div>
  );
}

function drawWaveform(
  ctx: CanvasRenderingContext2D,
  data: Float32Array,
  w: number,
  h: number,
  strokeStyle: string | CanvasGradient,
  lineWidth: number
) {
  const points = 200;
  const step = Math.floor(data.length / points);
  const mid = h / 2;
  const amp = h * 0.4;

  ctx.beginPath();
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < points; i++) {
    const idx = i * step;
    const val = data[idx] || 0;
    pts.push({
      x: (i / (points - 1)) * w,
      y: mid + val * amp,
    });
  }

  if (pts.length < 2) return;

  ctx.moveTo(pts[0].x, pts[0].y);

  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];

    const tension = 0.3;
    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;

    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
  }

  ctx.stroke();
}
