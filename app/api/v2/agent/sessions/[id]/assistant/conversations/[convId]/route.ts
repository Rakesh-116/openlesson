// ============================================
// OpenLesson Agentic API v2 - Conversation History
// GET /api/v2/agent/sessions/:id/assistant/conversations/:convId
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/agent-v2/auth";

export const runtime = "nodejs";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ConversationMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
}

// ─── GET Handler ─────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; convId: string }> }
) {
  const result = await authenticateRequest(req, "assistant:read");
  if (result instanceof NextResponse) return result;
  const { auth, supabase } = result;

  const { id: sessionId, convId } = await params;

  if (!sessionId) {
    return errorResponse(400, "validation_error", "Session ID is required");
  }

  if (!convId) {
    return errorResponse(400, "validation_error", "Conversation ID is required");
  }

  try {
    // ── 1. Validate session ownership, is_agent_session ───────────────
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

    // ── 2. Fetch conversation ─────────────────────────────────────────
    const { data: conversation, error: convErr } = await supabase
      .from("agent_assistant_conversations")
      .select("id, session_id, messages, created_at, updated_at")
      .eq("id", convId)
      .eq("session_id", sessionId)
      .eq("user_id", auth.user_id)
      .single();

    if (convErr || !conversation) {
      return errorResponse(404, "not_found", "Conversation not found");
    }

    const messages = (conversation.messages || []) as ConversationMessage[];

    // ── 3. Build response ─────────────────────────────────────────────
    return NextResponse.json({
      conversation: {
        id: conversation.id,
        session_id: conversation.session_id,
        messages: messages.map((msg) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
        })),
        created_at: conversation.created_at,
        updated_at: conversation.updated_at,
      },
    });
  } catch (err) {
    console.error("[v2/assistant/conversations/:convId] Error:", err);
    return errorResponse(500, "internal_error", "Internal server error");
  }
}
