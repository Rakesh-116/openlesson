// ============================================
// OpenLesson Agentic API v2 - Session Analytics
// GET /api/v2/agent/analytics/sessions/:id
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/agent-v2/auth";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// ─── GET Handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const result = await authenticateRequest(req, "analytics:read");
    if (result instanceof NextResponse) return result;
    const { auth, supabase } = result;

    const { id: sessionId } = await context.params;
    if (!sessionId) {
      return errorResponse(400, "validation_error", "Session ID is required");
    }

    // ── Fetch session ────────────────────────────────────────────────
    const { data: session, error: sessionErr } = await supabase
      .from("sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (sessionErr || !session) {
      return errorResponse(404, "not_found", "Session not found");
    }

    if (session.user_id !== auth.user_id) {
      return errorResponse(
        403,
        "forbidden",
        "Session does not belong to this user"
      );
    }

    if (!session.is_agent_session) {
      return errorResponse(
        403,
        "forbidden",
        "This endpoint is for agent sessions only"
      );
    }

    // ── Calculate duration ───────────────────────────────────────────
    const durationMs =
      session.duration_ms ||
      (session.ended_at
        ? new Date(session.ended_at).getTime() -
          new Date(session.created_at).getTime()
        : Date.now() - new Date(session.created_at).getTime());

    // ── Fetch probes ─────────────────────────────────────────────────
    const { data: probes, error: probesErr } = await supabase
      .from("probes")
      .select(
        "id, gap_score, signals, text, request_type, archived, focused, timestamp_ms, plan_step_id"
      )
      .eq("session_id", sessionId)
      .order("timestamp_ms", { ascending: true });

    if (probesErr) {
      console.warn("[analytics/sessions/:id] Probes query error:", probesErr);
    }

    const allProbes = probes || [];
    const activeProbes = allProbes.filter((p) => !p.archived);
    const archivedProbes = allProbes.filter((p) => p.archived);
    const focusedProbes = allProbes.filter((p) => p.focused);

    const gapScores = allProbes
      .map((p) => p.gap_score)
      .filter((s): s is number => s != null && s > 0);
    const avgGapScore =
      gapScores.length > 0
        ? gapScores.reduce((sum, s) => sum + s, 0) / gapScores.length
        : 0;

    // Group probes by request_type
    const byType: Record<string, number> = {};
    for (const p of allProbes) {
      const type = p.request_type || "unknown";
      byType[type] = (byType[type] || 0) + 1;
    }

    // ── Gap timeline ─────────────────────────────────────────────────
    const gapTimeline = allProbes
      .filter((p) => p.gap_score != null && p.gap_score > 0)
      .map((p) => ({
        probe_id: p.id,
        timestamp_ms: p.timestamp_ms,
        gap_score: p.gap_score,
        request_type: p.request_type,
        signals: p.signals,
      }));

    // ── Session plan progress ────────────────────────────────────────
    const { data: sessionPlan } = await supabase
      .from("session_plans")
      .select("*")
      .eq("session_id", sessionId)
      .maybeSingle();

    let planProgress = null;
    if (sessionPlan) {
      const steps = (sessionPlan.steps as unknown[]) || [];
      const totalSteps = steps.length;
      const currentIndex =
        typeof sessionPlan.current_step_index === "number"
          ? sessionPlan.current_step_index
          : 0;
      planProgress = {
        goal: sessionPlan.goal,
        strategy: sessionPlan.strategy,
        total_steps: totalSteps,
        current_step_index: currentIndex,
        progress_percentage:
          totalSteps > 0 ? Math.round((currentIndex / totalSteps) * 100) : 0,
      };
    }

    // ── Transcript stats ─────────────────────────────────────────────
    const { data: transcriptRecords, count: transcriptCount } = await supabase
      .from("session_transcript")
      .select("word_count, timestamp_ms", { count: "exact" })
      .eq("session_id", sessionId);

    const totalWords = (transcriptRecords || []).reduce(
      (sum, r) => sum + (r.word_count || 0),
      0
    );

    // ── Build response ───────────────────────────────────────────────
    return NextResponse.json({
      session: {
        id: session.id,
        problem: session.problem,
        status: session.status,
        duration_ms: durationMs,
        metadata: session.metadata,
        created_at: session.created_at,
        ended_at: session.ended_at,
      },
      probes: {
        total: allProbes.length,
        active: activeProbes.length,
        archived: archivedProbes.length,
        focused: focusedProbes.length,
        by_type: byType,
        avg_gap_score: parseFloat(avgGapScore.toFixed(3)),
      },
      gap_timeline: gapTimeline,
      plan_progress: planProgress,
      transcript: {
        chunk_count: transcriptCount ?? 0,
        total_words: totalWords,
      },
      report: session.report || null,
    });
  } catch (err) {
    console.error("[analytics/sessions/:id] Error:", err);
    return errorResponse(500, "internal_error", "Internal server error");
  }
}
