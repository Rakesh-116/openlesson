// ============================================
// OpenLesson Agentic API v2 - Pause Session
// POST /api/v2/agent/sessions/:id/pause
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/agent-v2/auth";
import { createProof, serializeProof } from "@/lib/agent-v2/proofs";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await authenticateRequest(req, "sessions:write");
  if (result instanceof NextResponse) return result;
  const { auth, supabase } = result;

  const { id: sessionId } = await params;

  if (!sessionId) {
    return errorResponse(400, "validation_error", "Session ID is required");
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // Body is optional for pause
  }

  const { reason, estimated_resume_minutes } = body as {
    reason?: string;
    estimated_resume_minutes?: number;
  };

  try {
    // ── Fetch and validate session ─────────────────────────────────────
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

    if (session.status === "completed" || session.status === "ended_by_tutor") {
      return errorResponse(400, "session_already_ended", "Session has already ended");
    }

    if (session.status === "paused") {
      return errorResponse(400, "session_not_active", "Session is already paused");
    }

    if (session.status !== "active") {
      return errorResponse(400, "session_not_active", `Session is in "${session.status}" state and cannot be paused`);
    }

    // ── Calculate elapsed duration ─────────────────────────────────────
    const elapsedMs = Date.now() - new Date(session.created_at).getTime();
    const previousDuration = session.duration_ms || 0;

    // ── Update session ─────────────────────────────────────────────────
    const pauseMetadata = {
      ...(session.metadata || {}),
      paused_at: new Date().toISOString(),
      pause_reason: reason || null,
      estimated_resume_minutes: estimated_resume_minutes || null,
      elapsed_before_pause_ms: elapsedMs,
    };

    const { data: updated, error: updateErr } = await supabase
      .from("sessions")
      .update({
        status: "paused",
        duration_ms: previousDuration + elapsedMs,
        metadata: pauseMetadata,
      })
      .eq("id", sessionId)
      .select()
      .single();

    if (updateErr || !updated) {
      console.error("[v2/sessions/:id/pause] Update error:", updateErr);
      return errorResponse(500, "internal_error", "Failed to pause session");
    }

    // ── Create proof ───────────────────────────────────────────────────
    const proof = await createProof(supabase, {
      type: "session_paused",
      user_id: auth.user_id,
      session_id: sessionId,
      event_data: {
        reason: reason || null,
        estimated_resume_minutes: estimated_resume_minutes || null,
        elapsed_ms: elapsedMs,
      },
    });

    return NextResponse.json({
      session: {
        id: updated.id,
        status: updated.status,
        duration_ms: updated.duration_ms,
        metadata: updated.metadata,
      },
      paused_at: pauseMetadata.paused_at,
      elapsed_ms: elapsedMs,
      proof: proof ? serializeProof(proof) : null,
    });
  } catch (err) {
    console.error("[v2/sessions/:id/pause] Error:", err);
    return errorResponse(500, "internal_error", "Internal server error");
  }
}
