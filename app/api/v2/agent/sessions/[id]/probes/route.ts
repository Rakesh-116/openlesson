// ============================================
// OpenLesson Agentic API v2 - Session Probes
// GET /api/v2/agent/sessions/:id/probes
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

  const url = req.nextUrl;
  const statusFilter = url.searchParams.get("status") || "all"; // active, archived, all

  if (!["active", "archived", "all"].includes(statusFilter)) {
    return errorResponse(400, "validation_error", "status must be one of: active, archived, all");
  }

  try {
    // ── Validate session ownership ─────────────────────────────────────
    const { data: session, error: sessionErr } = await supabase
      .from("sessions")
      .select("id, user_id, is_agent_session")
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

    // ── Fetch probes ───────────────────────────────────────────────────
    let query = supabase
      .from("probes")
      .select("id, session_id, timestamp_ms, gap_score, signals, text, request_type, archived, focused, plan_step_id")
      .eq("session_id", sessionId)
      .order("timestamp_ms", { ascending: true });

    if (statusFilter === "active") {
      query = query.eq("archived", false);
    } else if (statusFilter === "archived") {
      query = query.eq("archived", true);
    }

    const { data: probes, error: probesErr } = await query;

    if (probesErr) {
      console.error("[v2/sessions/:id/probes] Query error:", probesErr);
      return errorResponse(500, "internal_error", "Failed to fetch probes");
    }

    const allProbes = probes || [];
    const activeCount = allProbes.filter((p) => !p.archived).length;
    const archivedCount = allProbes.filter((p) => p.archived).length;

    return NextResponse.json({
      probes: allProbes.map((p) => ({
        id: p.id,
        session_id: p.session_id,
        timestamp_ms: p.timestamp_ms,
        gap_score: p.gap_score,
        signals: p.signals,
        text: p.text,
        request_type: p.request_type,
        archived: p.archived,
        focused: p.focused,
        plan_step_id: p.plan_step_id,
      })),
      summary: {
        total: allProbes.length,
        active: activeCount,
        archived: archivedCount,
        filter: statusFilter,
      },
    });
  } catch (err) {
    console.error("[v2/sessions/:id/probes] Error:", err);
    return errorResponse(500, "internal_error", "Internal server error");
  }
}
