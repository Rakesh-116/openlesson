// ============================================
// OpenLesson Agentic API v2 - Session Plan
// GET /api/v2/agent/sessions/:id/plan
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

    // ── Fetch session plan ─────────────────────────────────────────────
    const { data: plan, error: planErr } = await supabase
      .from("session_plans")
      .select("*")
      .eq("session_id", sessionId)
      .maybeSingle();

    if (planErr) {
      console.error("[v2/sessions/:id/plan] Query error:", planErr);
      return errorResponse(500, "internal_error", "Failed to fetch session plan");
    }

    if (!plan) {
      return errorResponse(404, "not_found", "No plan found for this session");
    }

    // ── Compute step statistics ────────────────────────────────────────
    const steps = (plan.steps || []) as {
      id: string;
      type: string;
      description: string;
      order: number;
      status: string;
    }[];

    const stepStats = {
      total: steps.length,
      pending: steps.filter((s) => s.status === "pending").length,
      in_progress: steps.filter((s) => s.status === "in_progress").length,
      completed: steps.filter((s) => s.status === "completed").length,
      skipped: steps.filter((s) => s.status === "skipped").length,
    };

    const currentStep =
      plan.current_step_index >= 0 && plan.current_step_index < steps.length
        ? steps[plan.current_step_index]
        : null;

    return NextResponse.json({
      plan: {
        id: plan.id,
        session_id: plan.session_id,
        user_id: plan.user_id,
        goal: plan.goal,
        strategy: plan.strategy,
        description: plan.description,
        current_step_index: plan.current_step_index,
        current_step: currentStep,
        steps,
      },
      step_statistics: stepStats,
    });
  } catch (err) {
    console.error("[v2/sessions/:id/plan] Error:", err);
    return errorResponse(500, "internal_error", "Internal server error");
  }
}
