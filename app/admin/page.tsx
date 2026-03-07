"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface Stats {
  totalUsers: number;
  totalSessions: number;
  totalAudioChunks: number;
  totalToolEvents: number;
  totalEEGRecords: number;
}

export default function AdminPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    checkAdminAndLoadStats();
  }, []);

  const checkAdminAndLoadStats = async () => {
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

      loadStats();
    } catch (err) {
      console.error("Admin check error:", err);
      setError("Failed to verify admin status");
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const [usersRes, sessionsRes, dataRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("sessions").select("id", { count: "exact", head: true }),
        supabase.from("session_data").select("data_type"),
      ]);

      const audioChunks = dataRes.data?.filter((d: { data_type: string }) => d.data_type === "audio").length || 0;
      const toolEvents = dataRes.data?.filter((d: { data_type: string }) => d.data_type === "tool").length || 0;
      const eegRecords = dataRes.data?.filter((d: { data_type: string }) => d.data_type === "eeg").length || 0;

      setStats({
        totalUsers: usersRes.count || 0,
        totalSessions: sessionsRes.count || 0,
        totalAudioChunks: audioChunks,
        totalToolEvents: toolEvents,
        totalEEGRecords: eegRecords,
      });
    } catch (err) {
      console.error("Load stats error:", err);
      setError("Failed to load stats");
    } finally {
      setLoading(false);
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
    <div className="max-w-5xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-white mb-2">Admin Dashboard</h1>
        <p className="text-neutral-400 mb-8">Overview and quick navigation</p>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-6">
            <div className="text-3xl font-bold text-white">{stats?.totalUsers || 0}</div>
            <div className="text-neutral-400 text-sm mt-1">Total Users</div>
          </div>
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-6">
            <div className="text-3xl font-bold text-white">{stats?.totalSessions || 0}</div>
            <div className="text-neutral-400 text-sm mt-1">Total Sessions</div>
          </div>
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-6">
            <div className="text-3xl font-bold text-white">{stats?.totalAudioChunks || 0}</div>
            <div className="text-neutral-400 text-sm mt-1">Audio Chunks</div>
          </div>
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-6">
            <div className="text-3xl font-bold text-white">{stats?.totalToolEvents || 0}</div>
            <div className="text-neutral-400 text-sm mt-1">Tool Events</div>
          </div>
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-6">
            <div className="text-3xl font-bold text-white">{stats?.totalEEGRecords || 0}</div>
            <div className="text-neutral-400 text-sm mt-1">EEG Records</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link 
            href="/admin/sessions" 
            className="block bg-neutral-900/50 border border-neutral-800 rounded-lg p-6 hover:border-neutral-700 transition-colors"
          >
            <h2 className="text-lg font-semibold text-white mb-2">Sessions</h2>
            <p className="text-neutral-400 text-sm">
              View all sessions, filter by status, and see what data was captured (audio, EEG, tools)
            </p>
          </Link>
          
          <Link 
            href="/admin/users" 
            className="block bg-neutral-900/50 border border-neutral-800 rounded-lg p-6 hover:border-neutral-700 transition-colors"
          >
            <h2 className="text-lg font-semibold text-white mb-2">Users</h2>
            <p className="text-neutral-400 text-sm">
              Manage users, change tiers (free/regular/pro), view subscription status
            </p>
          </Link>

          <Link 
            href="/admin/health" 
            className="block bg-neutral-900/50 border border-neutral-800 rounded-lg p-6 hover:border-neutral-700 transition-colors"
          >
            <h2 className="text-lg font-semibold text-white mb-2">Data Pipeline Health</h2>
            <p className="text-neutral-400 text-sm">
              Monitor sync status between Supabase and preprocessing server
            </p>
          </Link>

          <Link 
            href="/admin/partners" 
            className="block bg-neutral-900/50 border border-neutral-800 rounded-lg p-6 hover:border-neutral-700 transition-colors"
          >
            <h2 className="text-lg font-semibold text-white mb-2">Partner Program</h2>
            <p className="text-neutral-400 text-sm">
              Manage partners, view referrals, and issue payouts
            </p>
          </Link>

          <Link 
            href="/admin/organizations" 
            className="block bg-neutral-900/50 border border-neutral-800 rounded-lg p-6 hover:border-neutral-700 transition-colors"
          >
            <h2 className="text-lg font-semibold text-white mb-2">Organizations</h2>
            <p className="text-neutral-400 text-sm">
              Manage organizations, members, and generate invite links
            </p>
          </Link>
        </div>
    </div>
  );
}