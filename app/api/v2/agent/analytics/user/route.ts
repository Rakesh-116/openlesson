// ============================================
// OpenLesson Agentic API v2 - User Analytics
// GET /api/v2/agent/analytics/user
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/agent-v2/auth";

export const runtime = "nodejs";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function estimateStreak(sessionDates: string[]): {
  current: number;
  longest: number;
} {
  if (sessionDates.length === 0) return { current: 0, longest: 0 };

  // Normalize to day strings and deduplicate
  const days = [
    ...new Set(
      sessionDates.map((d) => new Date(d).toISOString().split("T")[0])
    ),
  ].sort();

  let current = 1;
  let longest = 1;
  let streak = 1;

  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1]);
    const curr = new Date(days[i]);
    const diffDays = Math.round(
      (curr.getTime() - prev.getTime()) / 86_400_000
    );

    if (diffDays === 1) {
      streak++;
      if (streak > longest) longest = streak;
    } else {
      streak = 1;
    }
  }

  // Check if current streak is still active (last session was today or yesterday)
  const lastDay = new Date(days[days.length - 1]);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffToToday = Math.round(
    (today.getTime() - lastDay.getTime()) / 86_400_000
  );

  current = diffToToday <= 1 ? streak : 0;

  return { current, longest };
}

// ─── GET Handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const result = await authenticateRequest(req, "analytics:read");
    if (result instanceof NextResponse) return result;
    const { auth, supabase } = result;

    // ── Fetch all plans ──────────────────────────────────────────────
    const { data: plans, error: plansErr } = await supabase
      .from("learning_plans")
      .select("id, title, root_topic, status, created_at")
      .eq("user_id", auth.user_id)
      .eq("is_agent_session", true)
      .order("created_at", { ascending: false });

    if (plansErr) {
      console.error("[analytics/user] Plans query error:", plansErr);
    }

    const allPlans = plans || [];

    // ── Fetch plan nodes for completion stats ────────────────────────
    const planIds = allPlans.map((p: { id: string }) => p.id);
    let allNodes: { plan_id: string; status: string }[] = [];

    if (planIds.length > 0) {
      const { data: nodes, error: nodesErr } = await supabase
        .from("plan_nodes")
        .select("plan_id, status")
        .in("plan_id", planIds);

      if (nodesErr) {
        console.warn("[analytics/user] Nodes query error:", nodesErr);
      }
      allNodes = nodes || [];
    }

    const totalNodesCount = allNodes.length;
    const completedNodesCount = allNodes.filter(
      (n) => n.status === "completed"
    ).length;
    const overallNodeCompletion =
      totalNodesCount > 0
        ? Math.round((completedNodesCount / totalNodesCount) * 100)
        : 0;

    // Plan-level completion
    const completedPlans = allPlans.filter(
      (p: { status: string }) => p.status === "completed"
    ).length;
    const planCompletionRate =
      allPlans.length > 0
        ? Math.round((completedPlans / allPlans.length) * 100)
        : 0;

    // ── Fetch all agent sessions ─────────────────────────────────────
    const { data: sessions, error: sessionsErr } = await supabase
      .from("sessions")
      .select("id, status, duration_ms, created_at, ended_at, metadata, problem")
      .eq("user_id", auth.user_id)
      .eq("is_agent_session", true)
      .order("created_at", { ascending: false });

    if (sessionsErr) {
      console.error("[analytics/user] Sessions query error:", sessionsErr);
    }

    const allSessions = sessions || [];
    const completedSessions = allSessions.filter(
      (s: { status: string }) =>
        s.status === "completed" || s.status === "ended_by_tutor"
    );
    const sessionCompletionRate =
      allSessions.length > 0
        ? Math.round((completedSessions.length / allSessions.length) * 100)
        : 0;

    // ── Total time ───────────────────────────────────────────────────
    const totalTime = allSessions.reduce((sum, s) => {
      const dur =
        s.duration_ms ||
        (s.ended_at
          ? new Date(s.ended_at).getTime() - new Date(s.created_at).getTime()
          : 0);
      return sum + (dur > 0 ? dur : 0);
    }, 0);

    // ── Performance: fetch probes for gap score ──────────────────────
    const sessionIds = allSessions.map((s: { id: string }) => s.id);
    let allProbes: { gap_score: number | null; session_id: string }[] = [];

    if (sessionIds.length > 0) {
      // Fetch in batches if too many session ids
      const batchSize = 100;
      for (let i = 0; i < sessionIds.length; i += batchSize) {
        const batch = sessionIds.slice(i, i + batchSize);
        const { data: probes, error: probesErr } = await supabase
          .from("probes")
          .select("gap_score, session_id")
          .in("session_id", batch);

        if (probesErr) {
          console.warn("[analytics/user] Probes query error:", probesErr);
        }
        if (probes) {
          allProbes = allProbes.concat(probes);
        }
      }
    }

    const gapScores = allProbes
      .map((p) => p.gap_score)
      .filter((s): s is number => s != null && s > 0);
    const overallGapScore =
      gapScores.length > 0
        ? gapScores.reduce((sum, s) => sum + s, 0) / gapScores.length
        : 0;

    // Gap trend: compute per-session averages in chronological order
    const sessionsByDate = [...allSessions].sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    const gapTrend = sessionsByDate
      .map((s: { id: string; created_at: string }) => {
        const sProbes = allProbes.filter((p) => p.session_id === s.id);
        const scores = sProbes
          .map((p) => p.gap_score)
          .filter((g): g is number => g != null && g > 0);
        if (scores.length === 0) return null;
        const avg = scores.reduce((sum, v) => sum + v, 0) / scores.length;
        return {
          session_id: s.id,
          created_at: s.created_at,
          avg_gap_score: parseFloat(avg.toFixed(3)),
        };
      })
      .filter(Boolean);

    // Determine overall trend direction
    const trendScores = gapTrend.map((t) => t!.avg_gap_score);
    let trendDirection: "improving" | "declining" | "stable" = "stable";
    if (trendScores.length >= 2) {
      const recent = trendScores.slice(-3);
      const earlier = trendScores.slice(0, Math.max(1, trendScores.length - 3));
      const recentAvg = recent.reduce((s, v) => s + v, 0) / recent.length;
      const earlierAvg = earlier.reduce((s, v) => s + v, 0) / earlier.length;
      const diff = recentAvg - earlierAvg;
      if (Math.abs(diff) >= 0.05) {
        trendDirection = diff < 0 ? "improving" : "declining";
      }
    }

    // ── Learning history ─────────────────────────────────────────────
    // Recent topics from plans
    const recentTopics = allPlans.slice(0, 10).map(
      (p: { id: string; title: string; root_topic: string; created_at: string }) => ({
        plan_id: p.id,
        title: p.title,
        root_topic: p.root_topic,
        started_at: p.created_at,
      })
    );

    // Time per topic (plan)
    const timePerTopic = allPlans.map(
      (p: { id: string; title: string }) => {
        const planSessions = allSessions.filter((s) => {
          const meta = s.metadata as Record<string, unknown> | null;
          return meta?.plan_id === p.id;
        });
        const planTime = planSessions.reduce((sum, s) => {
          const dur =
            s.duration_ms ||
            (s.ended_at
              ? new Date(s.ended_at).getTime() -
                new Date(s.created_at).getTime()
              : 0);
          return sum + (dur > 0 ? dur : 0);
        }, 0);
        return {
          plan_id: p.id,
          title: p.title,
          total_time_ms: planTime,
          session_count: planSessions.length,
        };
      }
    );

    // ── Achievements / streaks ───────────────────────────────────────
    const sessionDates = allSessions.map(
      (s: { created_at: string }) => s.created_at
    );
    const streaks = estimateStreak(sessionDates);

    const achievements = {
      total_plans: allPlans.length,
      completed_plans: completedPlans,
      total_sessions: allSessions.length,
      completed_sessions: completedSessions.length,
      total_probes: allProbes.length,
      total_nodes: totalNodesCount,
      completed_nodes: completedNodesCount,
      streaks: {
        current_days: streaks.current,
        longest_days: streaks.longest,
      },
    };

    // ── Build response ───────────────────────────────────────────────
    return NextResponse.json({
      overview: {
        total_plans: allPlans.length,
        total_sessions: allSessions.length,
        plan_completion_rate: planCompletionRate,
        session_completion_rate: sessionCompletionRate,
        node_completion_rate: overallNodeCompletion,
        total_time_ms: totalTime,
      },
      performance: {
        overall_gap_score: parseFloat(overallGapScore.toFixed(3)),
        trend: trendDirection,
        gap_trend: gapTrend,
      },
      learning_history: {
        recent_topics: recentTopics,
        time_per_topic: timePerTopic,
      },
      achievements,
    });
  } catch (err) {
    console.error("[analytics/user] Error:", err);
    return errorResponse(500, "internal_error", "Internal server error");
  }
}
