"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

interface PersonalAnalytics {
  total_sessions: number;
  completed_sessions: number;
  total_nodes: number;
  completed_nodes: number;
  avg_duration_minutes: number;
  total_duration_minutes: number;
  avg_gap_score: number;
  sessions: {
    id: string;
    problem: string;
    status: string;
    started_at: string;
    duration_minutes: number;
    node_title: string;
  }[];
}

interface OrgMember {
  username: string;
  sessions_count: number;
  completed_count: number;
  avg_duration_minutes: number;
}

interface OrgAnalytics {
  total_sessions: number;
  completed_sessions: number;
  unique_users: number;
  avg_duration_minutes: number;
  avg_gap_score: number;
  completion_rate: number;
  members: OrgMember[];
}

interface PlanAnalyticsProps {
  planId: string;
  isOwner: boolean;
}

export function PlanAnalytics({ planId, isOwner }: PlanAnalyticsProps) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [personal, setPersonal] = useState<PersonalAnalytics | null>(null);
  const [org, setOrg] = useState<OrgAnalytics | null>(null);
  const [activeSection, setActiveSection] = useState<"personal" | "org">("personal");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/learning-plan/analytics?planId=${planId}`);
        if (!res.ok) return;
        const data = await res.json();
        setPersonal(data.personal);
        if (data.org) setOrg(data.org);
      } catch (err) {
        console.error("Failed to load analytics:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [planId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-neutral-500">{t('planAnalytics.loading')}</div>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-neutral-500">{t('planAnalytics.ownerOnly')}</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="w-full space-y-6">
        {/* Section toggle if org data available */}
        {org && (
          <div className="flex gap-1 bg-neutral-900 rounded-lg p-1 w-fit">
            <button
              onClick={() => setActiveSection("personal")}
              className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                activeSection === "personal"
                  ? "bg-neutral-700 text-white"
                  : "text-neutral-400 hover:text-neutral-300"
              }`}
            >
              {t('planAnalytics.myProgress')}
            </button>
            <button
              onClick={() => setActiveSection("org")}
              className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                activeSection === "org"
                  ? "bg-neutral-700 text-white"
                  : "text-neutral-400 hover:text-neutral-300"
              }`}
            >
              {t('planAnalytics.organization')}
            </button>
          </div>
        )}

        {activeSection === "personal" && personal && (
          <>
            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label={t('planAnalytics.sessions')} value={personal.total_sessions} accent="blue" />
              <StatCard label={t('planAnalytics.completed')} value={personal.completed_sessions} accent="green" />
              <StatCard
                label={t('planAnalytics.nodesDone')}
                value={`${personal.completed_nodes}/${personal.total_nodes}`}
                accent="green"
              />
              <StatCard
                label={t('planAnalytics.avgDuration')}
                value={`${personal.avg_duration_minutes}m`}
                accent="violet"
              />
              <StatCard
                label={t('planAnalytics.totalTime')}
                value={`${personal.total_duration_minutes}m`}
                accent="violet"
              />
              <StatCard label={t('planAnalytics.avgGapScore')} value={personal.avg_gap_score} accent="amber" />
              <StatCard
                label={t('planAnalytics.completion')}
                value={
                  personal.total_nodes > 0
                    ? `${Math.round((personal.completed_nodes / personal.total_nodes) * 100)}%`
                    : "0%"
                }
                accent="emerald"
              />
            </div>

            {/* Session history */}
            {personal.sessions.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-neutral-300 mb-3">{t('planAnalytics.sessionHistory')}</h3>
                <div className="space-y-2">
                  {personal.sessions.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between px-4 py-3 bg-neutral-900/50 border border-neutral-800/60 rounded-xl"
                    >
                      <div className="min-w-0">
                        <p className="text-sm text-white truncate">{s.node_title || s.problem}</p>
                        <p className="text-xs text-neutral-500">
                          {new Date(s.started_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-xs text-neutral-400">{s.duration_minutes}m</span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            s.status === "completed" || s.status === "ended_by_tutor"
                              ? "bg-green-900/30 text-green-400"
                              : "bg-neutral-800 text-neutral-400"
                          }`}
                        >
                          {s.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {personal.total_sessions === 0 && (
              <div className="text-center py-12 text-neutral-500">
                {t('planAnalytics.noSessionsYet')}
              </div>
            )}
          </>
        )}

        {activeSection === "org" && org && (
          <>
            {/* Org stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label={t('planAnalytics.totalSessions')} value={org.total_sessions} accent="blue" />
              <StatCard label={t('planAnalytics.completed')} value={org.completed_sessions} accent="green" />
              <StatCard label={t('planAnalytics.activeMembers')} value={org.unique_users} accent="violet" />
              <StatCard label={t('planAnalytics.completionRate')} value={`${org.completion_rate}%`} accent="emerald" />
              <StatCard label={t('planAnalytics.avgDuration')} value={`${org.avg_duration_minutes}m`} accent="violet" />
              <StatCard label={t('planAnalytics.avgGapScore')} value={org.avg_gap_score} accent="amber" />
            </div>

            {/* Member breakdown */}
            {org.members.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-neutral-300 mb-3">{t('planAnalytics.memberActivity')}</h3>
                <div className="border border-neutral-800 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-neutral-900/50">
                        <th className="text-left px-4 py-2 text-neutral-400 font-medium">{t('planAnalytics.member')}</th>
                        <th className="text-right px-4 py-2 text-neutral-400 font-medium">{t('planAnalytics.sessions')}</th>
                        <th className="text-right px-4 py-2 text-neutral-400 font-medium">{t('planAnalytics.completed')}</th>
                        <th className="text-right px-4 py-2 text-neutral-400 font-medium">{t('planAnalytics.avgDuration')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {org.members.map((m, i) => (
                        <tr key={i} className="border-t border-neutral-800">
                          <td className="px-4 py-2 text-white">@{m.username}</td>
                          <td className="px-4 py-2 text-right text-neutral-300">{m.sessions_count}</td>
                          <td className="px-4 py-2 text-right text-neutral-300">{m.completed_count}</td>
                          <td className="px-4 py-2 text-right text-neutral-300">{m.avg_duration_minutes}m</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {org.total_sessions === 0 && (
              <div className="text-center py-12 text-neutral-500">
                {t('planAnalytics.noOrgSessionsYet')}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const accentColors: Record<string, string> = {
  blue: "border-l-blue-500/60",
  green: "border-l-green-500/60",
  violet: "border-l-violet-500/60",
  amber: "border-l-amber-500/60",
  emerald: "border-l-emerald-500/60",
  neutral: "border-l-neutral-700/50",
};

function StatCard({ label, value, accent = "neutral" }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className={`px-4 py-3 bg-neutral-900/50 border border-neutral-800/60 border-l-2 rounded-xl ${accentColors[accent] || accentColors.neutral}`}>
      <p className="text-xs text-neutral-500 mb-1">{label}</p>
      <p className="text-lg font-semibold text-white">{String(value)}</p>
    </div>
  );
}
