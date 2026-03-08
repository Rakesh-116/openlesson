"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface SyncStatus {
  total: number;
  synced: number;
  unsynced: number;
  byType: Record<string, { total: number; synced: number; unsynced: number }>;
}

interface SessionStats {
  session_id: string;
  audio_chunks: number;
  eeg_records: number;
  tool_events: number;
  last_updated: string;
}

export default function HealthPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [sessions, setSessions] = useState<SessionStats[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    checkAdminAndLoadData();
  }, []);

  const checkAdminAndLoadData = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();

      if (!authUser) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", authUser.id)
        .single();

      if (!profile?.is_admin) {
        setError("Admin access required");
        setLoading(false);
        return;
      }

      loadHealthData();
    } catch (err) {
      console.error("Admin check error:", err);
      setError("Failed to verify admin status");
      setLoading(false);
    }
  };

  const loadHealthData = async () => {
    try {
      const response = await fetch("/api/sync-to-preprocessing");
      if (response.ok) {
        const data = await response.json();
        setSyncStatus(data);
      }

      const { data: sessionData } = await supabase
        .from("session_data")
        .select("session_id, data_type, created_at")
        .order("created_at", { ascending: false })
        .limit(500);

      if (sessionData) {
        const sessionMap: Record<string, SessionStats> = {};
        for (const record of sessionData) {
          if (!sessionMap[record.session_id]) {
            sessionMap[record.session_id] = {
              session_id: record.session_id,
              audio_chunks: 0,
              eeg_records: 0,
              tool_events: 0,
              last_updated: record.created_at,
            };
          }
          if (record.data_type === "audio") sessionMap[record.session_id].audio_chunks++;
          if (record.data_type === "eeg") sessionMap[record.session_id].eeg_records++;
          if (record.data_type === "tool") sessionMap[record.session_id].tool_events++;
        }
        setSessions(Object.values(sessionMap).slice(0, 20));
      }
    } catch (err) {
      console.error("Load health data error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const response = await fetch("/api/sync-to-preprocessing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchSize: 100 }),
      });
      const data = await response.json();
      setSyncResult({
        success: data.success,
        message: `Synced ${data.synced} records${data.failed ? `, ${data.failed} failed` : ""}`,
      });
      setLastSyncTime(new Date().toLocaleTimeString());
      loadHealthData();
    } catch (err) {
      setSyncResult({
        success: false,
        message: "Sync failed",
      });
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-neutral-400">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-red-400">{error}</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/admin" className="text-neutral-400 hover:text-white text-sm">
              ← Back to Admin
            </Link>
            <h1 className="text-2xl font-bold text-white mt-2">Data Pipeline Health</h1>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {syncing ? "Syncing..." : "Sync Now"}
          </button>
        </div>

        {syncResult && (
          <div className={`mb-6 p-4 rounded-lg ${syncResult.success ? "bg-green-900/30 border border-green-800" : "bg-red-900/30 border border-red-800"}`}>
            <span className={syncResult.success ? "text-green-400" : "text-red-400"}>
              {syncResult.message}
            </span>
            {lastSyncTime && (
              <span className="text-neutral-400 text-sm ml-2">
                (at {lastSyncTime})
              </span>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
            <div className="text-neutral-400 text-sm">Total Records</div>
            <div className="text-2xl font-bold text-white">{syncStatus?.total || 0}</div>
          </div>
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
            <div className="text-neutral-400 text-sm">Synced</div>
            <div className="text-2xl font-bold text-green-400">{syncStatus?.synced || 0}</div>
          </div>
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
            <div className="text-neutral-400 text-sm">Pending Sync</div>
            <div className="text-2xl font-bold text-yellow-400">{syncStatus?.unsynced || 0}</div>
          </div>
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
            <div className="text-neutral-400 text-sm">Sync Rate</div>
            <div className="text-2xl font-bold text-white">
              {syncStatus?.total ? Math.round((syncStatus.synced / syncStatus.total) * 100) : 0}%
            </div>
          </div>
        </div>

        {syncStatus?.byType && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-white mb-4">Data by Type</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(syncStatus.byType).map(([type, stats]) => (
                <div key={type} className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
                  <div className="text-sm font-medium text-white capitalize mb-2">{type}</div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Total</span>
                      <span className="text-white">{stats.total}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Synced</span>
                      <span className="text-green-400">{stats.synced}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Pending</span>
                      <span className="text-yellow-400">{stats.unsynced}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Recent Sessions</h2>
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-800">
                  <th className="text-left p-4 text-neutral-400 text-sm font-medium">Session ID</th>
                  <th className="text-right p-4 text-neutral-400 text-sm font-medium">Audio Chunks</th>
                  <th className="text-right p-4 text-neutral-400 text-sm font-medium">EEG Records</th>
                  <th className="text-right p-4 text-neutral-400 text-sm font-medium">Tool Events</th>
                </tr>
              </thead>
              <tbody>
                {sessions.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-neutral-400">
                      No session data yet
                    </td>
                  </tr>
                ) : (
                  sessions.map((session) => (
                    <tr key={session.session_id} className="border-b border-neutral-800/50">
                      <td className="p-4 text-white text-sm font-mono">
                        {session.session_id.slice(0, 8)}...
                      </td>
                      <td className="p-4 text-right text-neutral-300">{session.audio_chunks}</td>
                      <td className="p-4 text-right text-neutral-300">{session.eeg_records}</td>
                      <td className="p-4 text-right text-neutral-300">{session.tool_events}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
    </div>
  );
}