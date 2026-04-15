// ============================================
// OpenLesson Agentic API v2 - List Proofs
// GET /api/v2/agent/proofs
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/agent-v2/auth";
import { serializeProof } from "@/lib/agent-v2/proofs";
import type { Proof, ProofType } from "@/lib/agent-v2/types";

export const runtime = "nodejs";

const VALID_PROOF_TYPES: ProofType[] = [
  "plan_created",
  "plan_adapted",
  "session_started",
  "session_paused",
  "session_resumed",
  "session_ended",
  "analysis_heartbeat",
  "assistant_query",
  "session_batch",
];

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

// ─── GET Handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const result = await authenticateRequest(req, "proofs:read");
    if (result instanceof NextResponse) return result;
    const { auth, supabase } = result;

    const url = req.nextUrl;
    const sessionId = url.searchParams.get("session_id");
    const planId = url.searchParams.get("plan_id");
    const type = url.searchParams.get("type");
    const anchoredParam = url.searchParams.get("anchored");
    const limitParam = parseInt(url.searchParams.get("limit") || "", 10);
    const offsetParam = parseInt(url.searchParams.get("offset") || "", 10);

    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(1, limitParam), MAX_LIMIT)
      : DEFAULT_LIMIT;
    const offset = Number.isFinite(offsetParam) ? Math.max(0, offsetParam) : 0;

    // Validate type if provided
    if (type && !VALID_PROOF_TYPES.includes(type as ProofType)) {
      return errorResponse(400, "validation_error", `Invalid proof type: "${type}"`, {
        valid_types: VALID_PROOF_TYPES,
      });
    }

    // Validate anchored if provided
    if (anchoredParam !== null && anchoredParam !== "true" && anchoredParam !== "false") {
      return errorResponse(
        400,
        "validation_error",
        'Parameter "anchored" must be "true" or "false"'
      );
    }

    // ── Build query ──────────────────────────────────────────────────
    let query = supabase
      .from("agent_proofs")
      .select("*", { count: "exact" })
      .eq("user_id", auth.user_id)
      .order("timestamp", { ascending: false })
      .range(offset, offset + limit - 1);

    if (sessionId) {
      query = query.eq("session_id", sessionId);
    }
    if (planId) {
      query = query.eq("plan_id", planId);
    }
    if (type) {
      query = query.eq("type", type);
    }
    if (anchoredParam !== null) {
      query = query.eq("anchored", anchoredParam === "true");
    }

    const { data: proofs, count, error } = await query;

    if (error) {
      console.error("[proofs] List query error:", error);
      return errorResponse(500, "internal_error", "Failed to fetch proofs");
    }

    const total = count ?? 0;
    const items = (proofs || []).map((p: Proof) => serializeProof(p));

    return NextResponse.json({
      proofs: items,
      pagination: {
        total,
        limit,
        offset,
        has_more: offset + limit < total,
      },
    });
  } catch (err) {
    console.error("[proofs] Error:", err);
    return errorResponse(500, "internal_error", "Internal server error");
  }
}
