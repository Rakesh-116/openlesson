"use client";

import { ToolsHelp } from "./ToolsHelp";
import { DataInputTool } from "./DataInputTool";
import { LogsTool, type LogEntry, type TransferHealth } from "./LogsTool";

interface BottomToolsProps {
  activeTool: string;
  isRecording: boolean;
  audioStream: MediaStream | null;
  museStatus: "disconnected" | "connecting" | "connected" | "streaming";
  museError: string | null;
  museChannelData: Map<string, number[]>;
  bandPowers: { delta: number; theta: number; alpha: number; beta: number; gamma: number } | null;
  onConnectMuse: () => void;
  onDisconnectMuse: () => void;
  isWebcamEnabled: boolean;
  onWebcamToggle: () => void;
  latestFacialData: any;
  webcamError: string | null;
  transferHealth?: TransferHealth;
  logs: LogEntry[];
  onClearLogs: () => void;
  onFacialData: (data: any) => void;
  onFaceError: (error: string) => void;
  logsRef: React.MutableRefObject<LogEntry[]>;
  setLogs: React.Dispatch<React.SetStateAction<LogEntry[]>>;
}

export function BottomTools({
  activeTool,
  isRecording,
  audioStream,
  museStatus,
  museError,
  museChannelData,
  bandPowers,
  onConnectMuse,
  onDisconnectMuse,
  isWebcamEnabled,
  onWebcamToggle,
  latestFacialData,
  webcamError,
  transferHealth,
  logs,
  onClearLogs,
  onFacialData,
  onFaceError,
  logsRef,
  setLogs,
}: BottomToolsProps) {
  return (
    <div className="mt-auto shrink-0 flex flex-col" style={{ minHeight: '200px' }}>
      {activeTool === "help" && <div className="shrink-0"><ToolsHelp /></div>}
      {activeTool === "data-input" && (
        <div className="flex-1 overflow-auto">
          <DataInputTool
            isRecording={isRecording}
            audioStream={audioStream}
            museStatus={museStatus}
            museError={museError}
            museChannelData={museChannelData}
            bandPowers={bandPowers}
            onConnectMuse={onConnectMuse}
            onDisconnectMuse={onDisconnectMuse}
            isWebcamEnabled={isWebcamEnabled}
            onWebcamToggle={onWebcamToggle}
            latestFacialData={latestFacialData}
            onFacialData={onFacialData}
            onFaceError={onFaceError}
          />
        </div>
      )}
      {activeTool === "logs" && (
        <div className="flex-1 overflow-auto">
          <LogsTool
            logs={logs}
            transferHealth={transferHealth}
            onClear={onClearLogs}
          />
        </div>
      )}
    </div>
  );
}
