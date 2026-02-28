"use client";

import { useState, useRef, useEffect } from "react";

export type LogLevel = "error" | "warning" | "info";

export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  message: string;
  source?: string;
}

interface LogsToolProps {
  logs: LogEntry[];
  onClear?: () => void;
}

export function LogsTool({ logs, onClear }: LogsToolProps) {
  const [filter, setFilter] = useState<LogLevel | "all">("all");
  const [autoScroll, setAutoScroll] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredLogs = filter === "all" 
    ? logs 
    : logs.filter(log => log.level === filter);

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [filteredLogs, autoScroll]);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", { 
      hour12: false, 
      hour: "2-digit", 
      minute: "2-digit", 
      second: "2-digit" 
    });
  };

  const getLevelColor = (level: LogLevel) => {
    switch (level) {
      case "error": return "text-red-400 bg-red-500/10 border-red-500/30";
      case "warning": return "text-yellow-400 bg-yellow-500/10 border-yellow-500/30";
      case "info": return "text-blue-400 bg-blue-500/10 border-blue-500/30";
    }
  };

  const getLevelDot = (level: LogLevel) => {
    switch (level) {
      case "error": return "bg-red-400";
      case "warning": return "bg-yellow-400";
      case "info": return "bg-blue-400";
    }
  };

  return (
    <div className="flex flex-col h-full bg-neutral-900">
      <div className="flex items-center justify-between p-3 border-b border-neutral-800">
        <div className="flex gap-1">
          {(["all", "error", "warning", "info"] as const).map((level) => (
            <button
              key={level}
              onClick={() => setFilter(level)}
              className={`px-2 py-1 text-[10px] rounded capitalize transition-colors ${
                filter === level
                  ? "bg-neutral-700 text-white"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              {level}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-[10px] text-neutral-500">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="w-3 h-3 rounded border-neutral-700 bg-neutral-800"
            />
            Auto-scroll
          </label>
          {onClear && (
            <button
              onClick={onClear}
              className="text-[10px] text-neutral-500 hover:text-neutral-300"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div 
        ref={containerRef}
        className="flex-1 overflow-auto p-2 space-y-1"
      >
        {filteredLogs.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-neutral-500 text-xs">No logs to display</p>
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className={`p-2 rounded border text-xs ${getLevelColor(log.level)}`}
            >
              <div className="flex items-start gap-2">
                <div className={`w-1.5 h-1.5 rounded-full mt-1 ${getLevelDot(log.level)}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-neutral-500 font-mono">{formatTime(log.timestamp)}</span>
                    {log.source && (
                      <span className="text-neutral-600">[{log.source}]</span>
                    )}
                  </div>
                  <p className="mt-0.5 break-words">{log.message}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-2 border-t border-neutral-800 text-[10px] text-neutral-600">
        {filteredLogs.length} / {logs.length} entries
      </div>
    </div>
  );
}