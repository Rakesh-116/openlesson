// ============================================
// OpenLesson Agentic API v2 - Session Details
// GET /api/v2/agent/sessions/:id
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/agent-v2/auth";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await authenticateRequest(req, "sessions:read");
  if (result instanceof NextResponse) return result;
  const { auth, supabase } = result;

  const { id: sessionId } = await params;

  if (!sessionId) {
    return errorResponse(400, "validation_error", "Session ID is required");
  }

  try {
    // ── Fetch session ──────────────────────────────────────────────────
    const { data: session, error: sessionErr } = await supabase
      .from("sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (sessionErr || !session) {
      return errorResponse(404, "not_found", "Session not found");
    }

    if (session.user_id !== auth.user_id) {
      return errorResponse(403, "forbidden", "Session does not belong to this user");
    }

    if (!session.is_agent_session) {
      return errorResponse(403, "forbidden", "This endpoint is for agent sessions only");
    }

    // ── Fetch session plan ─────────────────────────────────────────────
    const { data: plan } = await supabase
      .from("session_plans")
      .select("*")
      .eq("session_id", sessionId)
      .maybeSingle();

    // ── Fetch probe statistics ─────────────────────────────────────────
    const { data: probes, error: probesErr } = await supabase
      .from("probes")
      .select("id, gap_score, signals, text, request_type, archived, focused, timestamp_ms, plan_step_id")
      .eq("session_id", sessionId)
      .order("timestamp_ms", { ascending: true });

    if (probesErr) {
      console.warn("[v2/sessions/:id] Probes fetch error:", probesErr);
    }

    const allProbes = probes || [];
    const activeProbes = allProbes.filter((p) => !p.archived);
    const archivedProbes = allProbes.filter((p) => p.archived);

    const gapScores = allProbes
      .map((p) => p.gap_score)
      .filter((s): s is number => s != null && s > 0);

    const avgGapScore =
      gapScores.length > 0
        ? gapScores.reduce((sum, s) => sum + s, 0) / gapScores.length
        : 0;

    // ── Fetch transcript stats ─────────────────────────────────────────
    const { data: transcriptRecords, count: transcriptCount } = await supabase
      .from("session_transcript")
      .select("word_count, timestamp_ms", { count: "exact" })
      .eq("session_id", sessionId);

    const totalWords = (transcriptRecords || []).reduce(
      (sum, r) => sum + (r.word_count || 0),
      0
    );

    // ── Calculate duration ─────────────────────────────────────────────
    const durationMs = session.duration_ms
      || (session.ended_at
        ? new Date(session.ended_at).getTime() - new Date(session.created_at).getTime()
        : Date.now() - new Date(session.created_at).getTime());

    // ── Build response ─────────────────────────────────────────────────
    return NextResponse.json({
      session: {
        id: session.id,
        user_id: session.user_id,
        problem: session.problem,
        status: session.status,
        is_agent_session: session.is_agent_session,
        metadata: session.metadata,
        duration_ms: durationMs,
        report: session.report,
        created_at: session.created_at,
        ended_at: session.ended_at,
      },
      plan: plan
        ? {
            id: plan.id,
            goal: plan.goal,
            strategy: plan.strategy,
            description: plan.description,
            steps: plan.steps,
            current_step_index: plan.current_step_index,
          }
        : null,
      statistics: {
        total_probes: allProbes.length,
        active_probes: activeProbes.length,
        archived_probes: archivedProbes.length,
        avg_gap_score: parseFloat(avgGapScore.toFixed(3)),
        transcript_chunks: transcriptCount ?? 0,
        total_words: totalWords,
        duration_ms: durationMs,
      },
      active_probes: activeProbes.map((p) => ({
        id: p.id,
        text: p.text,
        gap_score: p.gap_score,
        signals: p.signals,
        request_type: p.request_type,
        focused: p.focused,
        timestamp_ms: p.timestamp_ms,
        plan_step_id: p.plan_step_id,
      })),
    });
  } catch (err) {
    console.error("[v2/sessions/:id] GET error:", err);
    return errorResponse(500, "internal_error", "Internal server error");
  }
}
