// ============================================
// OpenLesson Agentic API v2 - Plan Analytics
// GET /api/v2/agent/analytics/plans/:id
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/agent-v2/auth";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calculateTrend(values: number[]): "improving" | "declining" | "stable" {
  if (values.length < 2) return "stable";
  const recent = values.slice(-3);
  const earlier = values.slice(0, Math.max(1, values.length - 3));
  const recentAvg = recent.reduce((s, v) => s + v, 0) / recent.length;
  const earlierAvg = earlier.reduce((s, v) => s + v, 0) / earlier.length;
  const diff = recentAvg - earlierAvg;
  if (Math.abs(diff) < 0.05) return "stable";
  // Lower gap score = improving (less gap in understanding)
  return diff < 0 ? "improving" : "declining";
}

function generateRecommendations(
  completionPct: number,
  avgGap: number,
  weakestTopics: string[],
  totalSessions: number
): { type: string; message: string }[] {
  const recs: { type: string; message: string }[] = [];

  if (completionPct < 30 && totalSessions < 2) {
    recs.push({
      type: "engagement",
      message:
        "You've only completed a small portion of this plan. Try scheduling regular study sessions to build momentum.",
    });
  }

  if (avgGap > 0.6 && weakestTopics.length > 0) {
    recs.push({
      type: "review",
      message: `Consider revisiting these topics where gap scores are highest: ${weakestTopics.slice(0, 3).join(", ")}.`,
    });
  }

  if (completionPct >= 70 && avgGap < 0.4) {
    recs.push({
      type: "advancement",
      message:
        "Strong progress across most nodes. Consider moving to more advanced material or attempting the remaining topics.",
    });
  }

  if (recs.length === 0) {
    recs.push({
      type: "general",
      message:
        "Keep up your current pace. Focus on nodes that haven't been started yet to maintain well-rounded coverage.",
    });
  }

  return recs;
}

// ─── GET Handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const result = await authenticateRequest(req, "analytics:read");
    if (result instanceof NextResponse) return result;
    const { auth, supabase } = result;

    const { id: planId } = await context.params;
    if (!planId) {
      return errorResponse(400, "validation_error", "Plan ID is required");
    }

    // ── Fetch plan ───────────────────────────────────────────────────
    const { data: plan, error: planErr } = await supabase
      .from("learning_plans")
      .select("id, user_id, title, root_topic, status, created_at, updated_at")
      .eq("id", planId)
      .eq("user_id", auth.user_id)
      .single();

    if (planErr || !plan) {
      return errorResponse(404, "plan_not_found", "Plan not found");
    }

    // ── Fetch nodes ──────────────────────────────────────────────────
    const { data: nodes, error: nodesErr } = await supabase
      .from("plan_nodes")
      .select("id, title, status, metadata")
      .eq("plan_id", planId)
      .order("created_at", { ascending: true });

    if (nodesErr) {
      console.error("[analytics/plans/:id] Nodes query error:", nodesErr);
      return errorResponse(500, "internal_error", "Failed to fetch plan nodes");
    }

    const allNodes = nodes || [];
    const totalNodes = allNodes.length;
    const completedNodes = allNodes.filter(
      (n: { status: string }) => n.status === "completed"
    ).length;
    const inProgressNodes = allNodes.filter(
      (n: { status: string }) => n.status === "in_progress"
    ).length;
    const notStartedNodes = allNodes.filter(
      (n: { status: string }) =>
        n.status === "available" || n.status === "locked"
    ).length;
    const completionPercentage =
      totalNodes > 0 ? Math.round((completedNodes / totalNodes) * 100) : 0;

    // ── Fetch sessions for this plan ─────────────────────────────────
    const { data: sessions, error: sessionsErr } = await supabase
      .from("sessions")
      .select(
        "id, status, duration_ms, created_at, ended_at, metadata, is_agent_session"
      )
      .eq("user_id", auth.user_id)
      .eq("is_agent_session", true)
      .filter("metadata->>plan_id", "eq", planId)
      .order("created_at", { ascending: true });

    if (sessionsErr) {
      console.error("[analytics/plans/:id] Sessions query error:", sessionsErr);
    }

    const allSessions = sessions || [];
    const completedSessions = allSessions.filter(
      (s: { status: string }) =>
        s.status === "completed" || s.status === "ended_by_tutor"
    );

    // ── Session stats ────────────────────────────────────────────────
    const sessionDurations = allSessions
      .map((s) => {
        if (s.duration_ms) return s.duration_ms as number;
        if (s.ended_at) {
          return (
            new Date(s.ended_at).getTime() - new Date(s.created_at).getTime()
          );
        }
        return 0;
      })
      .filter((d) => d > 0);

    const totalTime = sessionDurations.reduce((sum, d) => sum + d, 0);
    const averageDuration =
      sessionDurations.length > 0
        ? Math.round(totalTime / sessionDurations.length)
        : 0;

    // ── Fetch probes across all plan sessions ────────────────────────
    const sessionIds = allSessions.map((s: { id: string }) => s.id);

    let allProbes: {
      id: string;
      session_id: string;
      gap_score: number | null;
      signals: string[] | null;
      text: string | null;
      request_type: string | null;
      timestamp_ms: number | null;
      plan_step_id: string | null;
    }[] = [];

    if (sessionIds.length > 0) {
      const { data: probes, error: probesErr } = await supabase
        .from("probes")
        .select(
          "id, session_id, gap_score, signals, text, request_type, timestamp_ms, plan_step_id"
        )
        .in("session_id", sessionIds)
        .order("timestamp_ms", { ascending: true });

      if (probesErr) {
        console.warn("[analytics/plans/:id] Probes query error:", probesErr);
      }
      allProbes = probes || [];
    }

    // ── Performance metrics ──────────────────────────────────────────
    const gapScores = allProbes
      .map((p) => p.gap_score)
      .filter((s): s is number => s != null && s > 0);

    const avgGapScore =
      gapScores.length > 0
        ? gapScores.reduce((sum, s) => sum + s, 0) / gapScores.length
        : 0;

    // Per-session gap score trend
    const sessionTrend = allSessions.map((s: { id: string; created_at: string }) => {
      const sessionProbes = allProbes.filter((p) => p.session_id === s.id);
      const scores = sessionProbes
        .map((p) => p.gap_score)
        .filter((g): g is number => g != null && g > 0);
      const avg =
        scores.length > 0
          ? scores.reduce((sum, v) => sum + v, 0) / scores.length
          : 0;
      return {
        session_id: s.id,
        created_at: s.created_at,
        avg_gap_score: parseFloat(avg.toFixed(3)),
        probe_count: sessionProbes.length,
      };
    });

    const trend = calculateTrend(sessionTrend.map((t) => t.avg_gap_score));

    // ── Topic analysis (per-node stats) ──────────────────────────────
    const nodesDetail = allNodes.map(
      (node: { id: string; title: string; status: string; metadata: Record<string, unknown> | null }) => {
        const nodeProbes = allProbes.filter((p) => p.plan_step_id === node.id);
        const nodeGaps = nodeProbes
          .map((p) => p.gap_score)
          .filter((g): g is number => g != null && g > 0);
        const nodeAvgGap =
          nodeGaps.length > 0
            ? nodeGaps.reduce((sum, v) => sum + v, 0) / nodeGaps.length
            : 0;

        const meta = (node.metadata || {}) as Record<string, unknown>;

        return {
          node_id: node.id,
          title: node.title,
          status: node.status,
          probe_count: nodeProbes.length,
          avg_gap_score: parseFloat(nodeAvgGap.toFixed(3)),
          last_session_id: (meta.last_session_id as string) || null,
          last_session_duration_ms:
            (meta.last_session_duration_ms as number) || null,
        };
      }
    );

    // Strongest / weakest topics (by avg gap score among nodes with data)
    const scoredNodes = nodesDetail.filter((n) => n.probe_count > 0);
    const sortedByGap = [...scoredNodes].sort(
      (a, b) => a.avg_gap_score - b.avg_gap_score
    );
    const strongestTopics = sortedByGap.slice(0, 3).map((n) => ({
      node_id: n.node_id,
      title: n.title,
      avg_gap_score: n.avg_gap_score,
    }));
    const weakestTopics = sortedByGap
      .slice(-3)
      .reverse()
      .map((n) => ({
        node_id: n.node_id,
        title: n.title,
        avg_gap_score: n.avg_gap_score,
      }));

    // ── Recommendations ──────────────────────────────────────────────
    const recommendations = generateRecommendations(
      completionPercentage,
      avgGapScore,
      weakestTopics.map((t) => t.title),
      allSessions.length
    );

    // ── Build response ───────────────────────────────────────────────
    return NextResponse.json({
      plan: {
        id: plan.id,
        title: plan.title,
        root_topic: plan.root_topic,
        status: plan.status,
        created_at: plan.created_at,
      },
      progress: {
        total_nodes: totalNodes,
        completed: completedNodes,
        in_progress: inProgressNodes,
        not_started: notStartedNodes,
        completion_percentage: completionPercentage,
      },
      sessions: {
        total: allSessions.length,
        completed: completedSessions.length,
        average_duration_ms: averageDuration,
        total_time_ms: totalTime,
      },
      performance: {
        avg_gap_score: parseFloat(avgGapScore.toFixed(3)),
        total_probes: allProbes.length,
        trend,
        session_trend: sessionTrend,
        strongest_topics: strongestTopics,
        weakest_topics: weakestTopics,
      },
      nodes_detail: nodesDetail,
      recommendations,
    });
  } catch (err) {
    console.error("[analytics/plans/:id] Error:", err);
    return errorResponse(500, "internal_error", "Internal server error");
  }
}
