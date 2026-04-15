// ============================================
// OpenLesson Agentic API v2 - Session Proof Batch
// GET /api/v2/agent/proofs/session/:id/batch
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/agent-v2/auth";
import { serializeProof } from "@/lib/agent-v2/proofs";
import type { Proof } from "@/lib/agent-v2/types";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// ─── GET Handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const result = await authenticateRequest(req, "proofs:read");
    if (result instanceof NextResponse) return result;
    const { auth, supabase } = result;

    const { id: sessionId } = await context.params;
    if (!sessionId) {
      return errorResponse(400, "validation_error", "Session ID is required");
    }

    // ── Validate session ownership ───────────────────────────────────
    const { data: session, error: sessionErr } = await supabase
      .from("sessions")
      .select("id, user_id, is_agent_session, status")
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

    // ── Fetch batch ──────────────────────────────────────────────────
    const { data: batch, error: batchErr } = await supabase
      .from("agent_proof_batches")
      .select("*")
      .eq("session_id", sessionId)
      .eq("user_id", auth.user_id)
      .maybeSingle();

    if (batchErr) {
      console.error("[proofs/session/:id/batch] Batch query error:", batchErr);
      return errorResponse(500, "internal_error", "Failed to fetch batch");
    }

    if (!batch) {
      return errorResponse(
        404,
        "not_found",
        "No proof batch found for this session. Batches are created when a session ends."
      );
    }

    // ── Fetch individual proofs in the batch ─────────────────────────
    const proofIds = (batch.proof_ids as string[]) || [];
    let batchProofs: Proof[] = [];

    if (proofIds.length > 0) {
      const { data: proofs, error: proofsErr } = await supabase
        .from("agent_proofs")
        .select("*")
        .in("id", proofIds)
        .order("timestamp", { ascending: true });

      if (proofsErr) {
        console.warn(
          "[proofs/session/:id/batch] Proofs query error:",
          proofsErr
        );
      }
      batchProofs = (proofs || []) as Proof[];
    }

    // ── Build response ───────────────────────────────────────────────
    return NextResponse.json({
      batch: {
        id: batch.id,
        session_id: batch.session_id,
        merkle_root: batch.merkle_root,
        proof_count: batch.proof_count,
        anchored: batch.anchored,
        ...(batch.anchor_tx_signature
          ? { anchor_tx_signature: batch.anchor_tx_signature }
          : {}),
        ...(batch.anchor_slot ? { anchor_slot: batch.anchor_slot } : {}),
        ...(batch.anchor_timestamp
          ? { anchor_timestamp: batch.anchor_timestamp }
          : {}),
        created_at: batch.created_at,
      },
      proofs: batchProofs.map((p) => ({
        ...serializeProof(p),
        data_hash: p.data_hash,
      })),
      merkle_tree: {
        root: batch.merkle_root,
        leaf_count: proofIds.length,
        leaves: batchProofs.map((p) => ({
          proof_id: p.id,
          fingerprint: p.fingerprint,
        })),
      },
    });
  } catch (err) {
    console.error("[proofs/session/:id/batch] Error:", err);
    return errorResponse(500, "internal_error", "Internal server error");
  }
}
