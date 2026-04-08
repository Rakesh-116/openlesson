"use client";

import { useState, useRef, useEffect } from "react";
import { useI18n } from "@/lib/i18n";

export type LogLevel = "error" | "warning" | "info";

export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  message: string;
  source?: string;
}

export interface TransferHealthData {
  sent: number;
  saved: number;
  failed: number;
}

export interface TransferHealth {
  audio: TransferHealthData;
  eeg: TransferHealthData;
  facial: TransferHealthData;
}

interface LogsToolProps {
  logs: LogEntry[];
  transferHealth?: TransferHealth;
  onClear?: () => void;
}

export function LogsTool({ logs, transferHealth, onClear }: LogsToolProps) {
  const { t } = useI18n();
  const [filter, setFilter] = useState<LogLevel | "all">("all");
  const [autoScroll, setAutoScroll] = useState(true);
  const [healthAutoRefresh, setHealthAutoRefresh] = useState(true);
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

  const getHealthStatus = (data: TransferHealthData) => {
    if (data.sent === 0) return { color: "bg-neutral-600", dot: "bg-neutral-500" };
    if (data.failed === 0) return { color: "text-emerald-400", dot: "bg-emerald-400" };
    if (data.failed < data.saved) return { color: "text-yellow-400", dot: "bg-yellow-400" };
    return { color: "text-red-400", dot: "bg-red-400" };
  };

  return (
    <div className="flex flex-col h-full bg-neutral-900">
      <div className="flex items-center justify-between p-3 border-b border-neutral-800 shrink-0">
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
            {t('logs.autoScroll')}
          </label>
          {onClear && (
            <button
              onClick={onClear}
              className="text-[10px] text-neutral-500 hover:text-neutral-300"
            >
              {t('logs.clear')}
            </button>
          )}
        </div>
      </div>

      <div 
        ref={containerRef}
        className="flex-1 overflow-auto p-2 space-y-1"
        style={{ height: transferHealth ? "65%" : "auto" }}
      >
        {filteredLogs.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-neutral-500 text-xs">{t('logs.noLogs')}</p>
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

      {transferHealth && (
        <div className="border-t border-neutral-800 flex flex-col" style={{ height: "35%" }}>
          <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800/50">
            <div className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="text-xs font-medium text-neutral-300">{t('logs.dataTransferHealth')}</span>
            </div>
            <label className="flex items-center gap-1.5 text-[10px] text-neutral-500">
              <input
                type="checkbox"
                checked={healthAutoRefresh}
                onChange={(e) => setHealthAutoRefresh(e.target.checked)}
                className="w-3 h-3 rounded border-neutral-700 bg-neutral-800"
              />
              Auto
            </label>
          </div>
          
          <div className="flex-1 overflow-auto p-3">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-neutral-500 text-[10px] uppercase tracking-wider">
                  <th className="text-left font-medium pb-2">{t('logs.type')}</th>
                  <th className="text-center font-medium pb-2">{t('logs.sent')}</th>
                  <th className="text-center font-medium pb-2">{t('logs.saved')}</th>
                  <th className="text-center font-medium pb-2">{t('logs.failed')}</th>
                  <th className="text-center font-medium pb-2">{t('logs.status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/50">
                {[
                  { key: "audio", label: t('logs.audio'), data: transferHealth.audio },
                  { key: "eeg", label: t('logs.eeg'), data: transferHealth.eeg },
                  { key: "facial", label: t('logs.facial'), data: transferHealth.facial },
                ].map(({ key, label, data }) => {
                  const status = getHealthStatus(data);
                  return (
                    <tr key={key}>
                      <td className="py-2 text-neutral-300 font-medium">{label}</td>
                      <td className="py-2 text-center text-neutral-400">{data.sent}</td>
                      <td className="py-2 text-center text-neutral-400">{data.saved}</td>
                      <td className={`py-2 text-center font-mono ${data.failed > 0 ? "text-red-400" : "text-neutral-500"}`}>
                        {data.failed}
                      </td>
                      <td className="py-2 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] ${status.color} bg-neutral-800`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                          {data.sent === 0 ? t('logs.idle') : data.failed === 0 ? t('logs.ok') : t('logs.issues')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="p-2 border-t border-neutral-800 text-[10px] text-neutral-600 shrink-0">
        {filteredLogs.length} / {logs.length} entries
      </div>
    </div>
  );
}
