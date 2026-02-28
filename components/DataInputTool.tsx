"use client";

import { useState, useRef, useEffect } from "react";
import { MuseTemporalChart } from "./MuseTemporalChart";
import { FaceTracker, FacialDataPoint } from "./FaceTracker";

interface DataInputToolProps {
  isRecording: boolean;
  audioStream?: MediaStream | null;
  museStatus: "disconnected" | "connecting" | "connected" | "streaming";
  museError?: string | null;
  museChannelData: Map<string, number[]>;
  bandPowers?: { delta: number; theta: number; alpha: number; beta: number; gamma: number } | null;
  onConnectMuse: () => void;
  onDisconnectMuse: () => void;
  isWebcamEnabled?: boolean;
  onWebcamToggle?: () => void;
  latestFacialData?: FacialDataPoint | null;
  onFacialData?: (data: FacialDataPoint) => void;
  onFaceError?: (error: string) => void;
}

type Tab = "audio" | "muse" | "face";

export function DataInputTool({
  isRecording,
  audioStream,
  museStatus,
  museError,
  museChannelData,
  bandPowers,
  onConnectMuse,
  onDisconnectMuse,
  isWebcamEnabled = false,
  onWebcamToggle,
  latestFacialData = null,
  onFacialData,
  onFaceError,
}: DataInputToolProps) {
  const [activeTab, setActiveTab] = useState<Tab>("audio");
  const [blinkRate, setBlinkRate] = useState(0);
  const blinkCountRef = useRef<number>(0);
  const lastBlinkResetRef = useRef<number>(Date.now());

  useEffect(() => {
    if (isWebcamEnabled) {
      const interval = setInterval(() => {
        const now = Date.now();
        const elapsedMinutes = (now - lastBlinkResetRef.current) / 60000;
        if (elapsedMinutes >= 1) {
          setBlinkRate(blinkCountRef.current);
          blinkCountRef.current = 0;
          lastBlinkResetRef.current = now;
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isWebcamEnabled]);

  const prevEyeStateRef = useRef<"open" | "closed">("open");
  
  const handleFacialData = (data: FacialDataPoint) => {
    if (latestFacialData && data.facePresent) {
      const prevEye = prevEyeStateRef.current;
      if (prevEye === "closed" && latestFacialData.facePresent) {
        blinkCountRef.current++;
      }
    }
    prevEyeStateRef.current = data.facePresent ? "open" : "open";
    
    if (onFacialData) {
      onFacialData(data);
    }
  };

  const isMuseConnected = museStatus === "connected" || museStatus === "streaming";

  return (
    <div className="flex flex-col h-full bg-neutral-900">
      <div className="flex border-b border-neutral-800">
        {(["audio", "muse", "face"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 text-xs font-medium capitalize transition-colors ${
              activeTab === tab
                ? "text-blue-400 border-b-2 border-blue-400 bg-blue-500/10"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 p-4 overflow-auto">
        {activeTab === "audio" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-400">Audio Detection</span>
              <div className={`flex items-center gap-2 ${isRecording ? "text-green-400" : "text-neutral-500"}`}>
                <div className={`w-2 h-2 rounded-full ${isRecording ? "bg-green-400 animate-pulse" : "bg-neutral-600"}`} />
                <span className="text-xs">{isRecording ? "Audio Detected" : "No Audio"}</span>
              </div>
            </div>
            {audioStream && isRecording && (
              <div className="h-24 rounded-lg overflow-hidden bg-neutral-950 border border-neutral-800">
                <AudioLevelMeter stream={audioStream} />
              </div>
            )}
            {!audioStream && (
              <div className="h-24 flex items-center justify-center rounded-lg bg-neutral-950 border border-neutral-800">
                <p className="text-neutral-500 text-xs">Start recording to see audio levels</p>
              </div>
            )}
            <div className="text-xs text-neutral-500">
              {isRecording ? "Microphone is actively capturing audio" : "Microphone is not active"}
            </div>
          </div>
        )}

        {activeTab === "muse" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-400">Muse Headset</span>
              <button
                onClick={isMuseConnected ? onDisconnectMuse : onConnectMuse}
                disabled={museStatus === "connecting"}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                  isMuseConnected
                    ? "bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30"
                    : "bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30"
                }`}
              >
                {museStatus === "connecting" ? "Connecting..." : isMuseConnected ? "Disconnect" : "Connect"}
              </button>
            </div>

            {museError && (
              <div className="p-2 rounded-md bg-red-500/10 border border-red-500/30">
                <p className="text-xs text-red-400">{museError}</p>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-500">Status:</span>
                <span className={`${
                  museStatus === "streaming" ? "text-green-400" :
                  museStatus === "connected" ? "text-yellow-400" :
                  museStatus === "connecting" ? "text-yellow-400" :
                  "text-neutral-500"
                }`}>
                  {museStatus.charAt(0).toUpperCase() + museStatus.slice(1)}
                </span>
              </div>
              
              {bandPowers && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-500">Signal:</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-green-400">Receiving data</span>
                  </div>
                </div>
              )}
              
              {!bandPowers && isMuseConnected && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-500">Signal:</span>
                  <span className="text-yellow-400">Waiting for signal...</span>
                </div>
              )}
            </div>

            {bandPowers && (
              <div className="space-y-2">
                <p className="text-xs text-neutral-500">Band Powers</p>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { label: "δ", value: bandPowers.delta, color: "bg-red-500" },
                    { label: "θ", value: bandPowers.theta, color: "bg-orange-500" },
                    { label: "α", value: bandPowers.alpha, color: "bg-yellow-500" },
                    { label: "β", value: bandPowers.beta, color: "bg-green-500" },
                    { label: "γ", value: bandPowers.gamma, color: "bg-blue-500" },
                  ].map((band) => {
                    const maxVal = Math.max(bandPowers.delta, bandPowers.theta, bandPowers.alpha, bandPowers.beta, bandPowers.gamma) || 1;
                    const height = Math.max(4, (band.value / maxVal) * 40);
                    return (
                      <div key={band.label} className="flex flex-col items-center">
                        <div className="w-full h-10 bg-neutral-800 rounded-md relative overflow-hidden">
                          <div 
                            className={`absolute bottom-0 w-full ${band.color} transition-all duration-300`}
                            style={{ height: `${height}px` }}
                          />
                        </div>
                        <span className="text-[10px] text-neutral-400 mt-1">{band.label}</span>
                        <span className="text-[9px] text-neutral-500">{band.value.toFixed(1)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <p className="text-xs text-neutral-500 mb-2">EEG Channels (Temporal)</p>
              <MuseTemporalChart
                channelData={museChannelData}
                isConnected={isMuseConnected}
              />
            </div>

            <p className="text-xs text-neutral-600">
              Data captured every 500ms, stored every 60s
            </p>
          </div>
        )}

        {activeTab === "face" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-400">Facial Data Tracking</span>
              <button
                onClick={() => onWebcamToggle?.()}
                disabled={!onWebcamToggle}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                  isWebcamEnabled
                    ? "bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30"
                    : "bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isWebcamEnabled ? "Disable Webcam" : "Enable Webcam"}
              </button>
            </div>

            {isWebcamEnabled && (
              <>
                <FaceTracker
                  isEnabled={isWebcamEnabled}
                  onDataPoint={handleFacialData}
                  onError={onFaceError}
                />

                {latestFacialData && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 rounded-md bg-neutral-800/50">
                      <p className="text-[10px] text-neutral-500">Engagement</p>
                      <p className={`text-lg font-semibold ${
                        latestFacialData.engagementScore >= 70 ? "text-green-400" :
                        latestFacialData.engagementScore >= 40 ? "text-yellow-400" :
                        "text-red-400"
                      }`}>
                        {latestFacialData.engagementScore}%
                      </p>
                    </div>
                    <div className="p-2 rounded-md bg-neutral-800/50">
                      <p className="text-[10px] text-neutral-500">Blink Rate</p>
                      <p className="text-lg font-semibold text-neutral-300">{blinkRate}/min</p>
                    </div>
                    <div className="p-2 rounded-md bg-neutral-800/50">
                      <p className="text-[10px] text-neutral-500">Gaze</p>
                      <p className={`text-sm font-medium ${
                        latestFacialData.gazeDirection === "at_camera" ? "text-green-400" :
                        latestFacialData.gazeDirection === "away" ? "text-yellow-400" :
                        "text-neutral-400"
                      }`}>
                        {latestFacialData.gazeDirection === "at_camera" ? "At Camera" :
                         latestFacialData.gazeDirection === "away" ? "Away" : "Unknown"}
                      </p>
                    </div>
                    <div className="p-2 rounded-md bg-neutral-800/50">
                      <p className="text-[10px] text-neutral-500">Mouth</p>
                      <p className={`text-sm font-medium ${
                        latestFacialData.mouthState === "open" ? "text-green-400" : "text-neutral-400"
                      }`}>
                        {latestFacialData.mouthState === "open" ? "Open" : "Closed"}
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}

            {!isWebcamEnabled && (
              <div className="h-48 flex items-center justify-center rounded-lg bg-neutral-950 border border-neutral-800">
                <p className="text-neutral-500 text-xs">Enable webcam to track facial data</p>
              </div>
            )}

            <p className="text-xs text-neutral-600">
              Facial data captured every 500ms, stored every 60s. No video is sent to the server.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function AudioLevelMeter({ stream }: { stream: MediaStream }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);

    analyser.fftSize = 256;
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;

      analyser.getByteFrequencyData(dataArray);

      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length;
      const level = Math.min(100, (avg / 128) * 100);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = canvas.width / 20;
      for (let i = 0; i < 20; i++) {
        const barHeight = (dataArray[i * 4] / 255) * canvas.height;
        const hue = 120 - (dataArray[i * 4] / 255) * 120;
        ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
        ctx.fillRect(i * barWidth + 1, canvas.height - barHeight, barWidth - 2, barHeight);
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      audioContext.close();
    };
  }, [stream]);

  return <canvas ref={canvasRef} className="w-full h-full" />;
}