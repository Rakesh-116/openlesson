"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { FilesetResolver, FaceLandmarker } from "@mediapipe/tasks-vision";

if (typeof window !== "undefined") {
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalInfo = console.info;
  
  const isMediaPipeLog = (args: unknown[]) => {
    const msg = args.map(a => typeof a === "string" ? a : JSON.stringify(a)).join(" ");
    return msg.includes("vision_wasm") || msg.includes("XNNPACK") || msg.includes("TensorFlow") || msg.includes("mediapipe") || msg.includes("wasm");
  };
  
  console.error = (...args: unknown[]) => {
    if (isMediaPipeLog(args)) return;
    originalError.apply(console, args);
  };
  
  console.warn = (...args: unknown[]) => {
    if (isMediaPipeLog(args)) return;
    originalWarn.apply(console, args);
  };
  
  console.info = (...args: unknown[]) => {
    if (isMediaPipeLog(args)) return;
    originalInfo.apply(console, args);
  };
}

export interface FacialDataPoint {
  timestamp: number;
  facePresent: boolean;
  blinkRate: number;
  gazeDirection: "at_camera" | "away" | "unknown";
  headPose: {
    pitch: number;
    yaw: number;
    roll: number;
  };
  mouthState: "open" | "closed";
  faceDistance: "optimal" | "too_close" | "too_far";
  engagementScore: number;
}

interface FaceTrackerProps {
  isEnabled: boolean;
  onDataPoint: (data: FacialDataPoint) => void;
  onError?: (error: string) => void;
}

export function FaceTracker({ isEnabled, onDataPoint, onError }: FaceTrackerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const lastBlinkRef = useRef<number>(0);
  const blinkCountRef = useRef<number>(0);
  const blinkRateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const trackingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const prevEyeStateRef = useRef<"open" | "closed">("open");
  const onErrorRef = useRef(onError);
  const onDataPointRef = useRef(onDataPoint);
  const isInitializedRef = useRef(false);
  const isWebcamOnRef = useRef(false);
  
  useEffect(() => { onErrorRef.current = onError; }, [onError]);
  useEffect(() => { onDataPointRef.current = onDataPoint; }, [onDataPoint]);

  const [isWebcamOn, setIsWebcamOn] = useState(false);
  const [webcamError, setWebcamError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { isWebcamOnRef.current = isWebcamOn; }, [isWebcamOn]);

  const calculateEngagementScore = useCallback((
    facePresent: boolean,
    gazeDirection: "at_camera" | "away" | "unknown",
    mouthState: "open" | "closed",
    headPose: { pitch: number; yaw: number; roll: number }
  ): number => {
    if (!facePresent) return 0;

    let score = 50;

    if (gazeDirection === "at_camera") score += 25;
    else if (gazeDirection === "unknown") score += 10;

    if (mouthState === "open") score += 10;

    const headStability = Math.abs(headPose.pitch) < 15 && Math.abs(headPose.yaw) < 20;
    if (headStability) score += 15;

    return Math.min(100, Math.max(0, score));
  }, []);

  const processFrame = useCallback(async () => {
    if (!isEnabled || !isWebcamOnRef.current || !faceLandmarkerRef.current || !videoRef.current) return;

    const startTimeMs = performance.now();
    const result = faceLandmarkerRef.current.detectForVideo(videoRef.current, startTimeMs);

    const now = Date.now();
    const face = result.faceLandmarks && result.faceLandmarks.length > 0 ? result.faceLandmarks[0] : null;

    let headPose = { pitch: 0, yaw: 0, roll: 0 };
    let mouthState: "open" | "closed" = "closed";
    let eyeState: "open" | "closed" = "open";
    let gazeDirection: "at_camera" | "away" | "unknown" = "unknown";

    if (face && face.length > 468) {
      const nose = face[1];
      const leftEye = face[33];
      const rightEye = face[263];
      const leftEyeTop = face[159];
      const leftEyeBottom = face[145];
      const rightEyeTop = face[386];
      const rightEyeBottom = face[374];
      const upperLip = face[13];
      const lowerLip = face[14];

      const eyeCenterX = (leftEye.x + rightEye.x) / 2;
      const gazeOffset = Math.abs(nose.x - eyeCenterX);
      
      if (gazeOffset < 0.02) gazeDirection = "at_camera";
      else if (gazeOffset < 0.05) gazeDirection = "away";
      else gazeDirection = "unknown";

      const leftEyeOpenness = Math.abs(leftEyeTop.y - leftEyeBottom.y);
      const rightEyeOpenness = Math.abs(rightEyeTop.y - rightEyeBottom.y);
      const avgOpenness = (leftEyeOpenness + rightEyeOpenness) / 2;
      eyeState = avgOpenness < 0.015 ? "closed" : "open";

      const mouthOpen = Math.abs(upperLip.y - lowerLip.y);
      mouthState = mouthOpen > 0.02 ? "open" : "closed";

      const roll = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * (180 / Math.PI);
      headPose = {
        pitch: (nose.y - 0.5) * 50,
        yaw: (nose.x - 0.5) * -50,
        roll
      };
    }

    if (eyeState === "closed" && prevEyeStateRef.current === "open" && now - lastBlinkRef.current > 200) {
      blinkCountRef.current++;
      lastBlinkRef.current = now;
    }
    prevEyeStateRef.current = eyeState;

    const engagementScore = calculateEngagementScore(!!face, gazeDirection, mouthState, headPose);

    const dataPoint: FacialDataPoint = {
      timestamp: now,
      facePresent: !!face,
      blinkRate: 0,
      gazeDirection,
      headPose,
      mouthState,
      faceDistance: "optimal",
      engagementScore,
    };

    if (onDataPointRef.current) onDataPointRef.current(dataPoint);
  }, [isEnabled, calculateEngagementScore]);

  useEffect(() => {
    if (!isEnabled) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      setIsWebcamOn(false);
      setIsLoading(true);
      isInitializedRef.current = false;
      if (blinkRateIntervalRef.current) {
        clearInterval(blinkRateIntervalRef.current);
        blinkRateIntervalRef.current = null;
      }
      if (trackingIntervalRef.current) {
        clearInterval(trackingIntervalRef.current);
        trackingIntervalRef.current = null;
      }
      return;
    }

    let isMounted = true;

    const init = async () => {
      try {
        console.log("[FaceTracker] Loading FilesetResolver...");
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        console.log("[FaceTracker] FilesetResolver loaded");
        
        console.log("[FaceTracker] Loading FaceLandmarker model...");
        const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numFaces: 1
        });

        if (!isMounted) return;
        
        faceLandmarkerRef.current = faceLandmarker;
        console.log("[FaceTracker] FaceLandmarker created");

        console.log("[FaceTracker] Requesting webcam...");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240, facingMode: "user" }
        });

        if (!isMounted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        
        setIsWebcamOn(true);
        setIsLoading(false);
        console.log("[FaceTracker] Initialization complete!");
        setWebcamError(null);

        blinkRateIntervalRef.current = setInterval(() => {
          const rate = blinkCountRef.current;
          blinkCountRef.current = 0;
          const entry: FacialDataPoint = {
            timestamp: Date.now(),
            facePresent: true,
            blinkRate: rate,
            gazeDirection: "at_camera",
            headPose: { pitch: 0, yaw: 0, roll: 0 },
            mouthState: "closed",
            faceDistance: "optimal",
            engagementScore: 50,
          };
          if (onDataPointRef.current) onDataPointRef.current(entry);
        }, 60000);

        trackingIntervalRef.current = setInterval(processFrame, 500);
        isInitializedRef.current = true;
      } catch (err) {
        console.error("[FaceTracker] Init error:", err);
        if (!isMounted) return;
        const error = err as Error;
        setWebcamError(error.message || "Failed to initialize face tracking");
        if (onErrorRef.current) onErrorRef.current(error.message || "Failed to initialize");
        setIsLoading(false);
      }
    };

    init();

    return () => {
      isMounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (blinkRateIntervalRef.current) {
        clearInterval(blinkRateIntervalRef.current);
        blinkRateIntervalRef.current = null;
      }
      if (trackingIntervalRef.current) {
        clearInterval(trackingIntervalRef.current);
        trackingIntervalRef.current = null;
      }
    };
  }, [isEnabled, processFrame, onError]);

  if (!isEnabled) return null;

  return (
    <div className="relative w-full h-48 rounded-lg overflow-hidden bg-neutral-900">
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        playsInline
        muted
        style={{ opacity: isWebcamOn ? 1 : 0 }}
      />
      <canvas ref={canvasRef} className="hidden" />
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-900">
          <p className="text-neutral-400 text-xs">Loading face detection model...</p>
        </div>
      )}
      {webcamError && (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-900">
          <p className="text-red-400 text-xs text-center px-4">{webcamError}</p>
        </div>
      )}
      {!isWebcamOn && !isLoading && !webcamError && (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-900">
          <p className="text-neutral-400 text-xs">Initializing webcam...</p>
        </div>
      )}
    </div>
  );
}