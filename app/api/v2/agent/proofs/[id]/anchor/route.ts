// ============================================
// OpenLesson Agentic API v2 - Anchor Proof
// POST /api/v2/agent/proofs/:id/anchor
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/agent-v2/auth";
import { serializeProof } from "@/lib/agent-v2/proofs";
import type { Proof } from "@/lib/agent-v2/types";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// ─── POST Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const result = await authenticateRequest(req, "proofs:anchor");
    if (result instanceof NextResponse) return result;
    const { auth, supabase } = result;

    const { id: proofId } = await context.params;
    if (!proofId) {
      return errorResponse(400, "validation_error", "Proof ID is required");
    }

    // ── Fetch proof ──────────────────────────────────────────────────
    const { data: proof, error: proofErr } = await supabase
      .from("agent_proofs")
      .select("*")
      .eq("id", proofId)
      .single();

    if (proofErr || !proof) {
      return errorResponse(404, "proof_not_found", "Proof not found");
    }

    if (proof.user_id !== auth.user_id) {
      return errorResponse(
        403,
        "forbidden",
        "Proof does not belong to this user"
      );
    }

    // ── Check if already anchored ────────────────────────────────────
    if (proof.anchored && proof.anchor_tx_signature) {
      return NextResponse.json({
        status: "already_anchored",
        proof: {
          ...serializeProof(proof as Proof),
          data_hash: proof.data_hash,
        },
        anchor: {
          tx_signature: proof.anchor_tx_signature,
          slot: proof.anchor_slot,
          timestamp: proof.anchor_timestamp,
        },
      });
    }

    // ── Simulate anchoring ───────────────────────────────────────────
    // The Solana program is not yet deployed. For now, we mark the proof
    // as anchored with a simulated placeholder transaction.
    //
    // In production, this would:
    //   1. Build a Solana transaction with the proof fingerprint
    //   2. Submit to the OpenLesson on-chain program
    //   3. Wait for confirmation
    //   4. Store the real tx_signature, slot, and timestamp

    const simulatedTxSignature = `sim_${proof.fingerprint.replace("sha256:", "").slice(0, 32)}`;
    const simulatedSlot = Math.floor(Date.now() / 400); // Approximate Solana slot
    const anchorTimestamp = new Date().toISOString();

    const { data: updated, error: updateErr } = await supabase
      .from("agent_proofs")
      .update({
        anchored: true,
        anchor_tx_signature: simulatedTxSignature,
        anchor_slot: simulatedSlot,
        anchor_timestamp: anchorTimestamp,
      })
      .eq("id", proofId)
      .select()
      .single();

    if (updateErr || !updated) {
      console.error("[proofs/:id/anchor] Update error:", updateErr);
      return errorResponse(500, "anchor_failed", "Failed to anchor proof");
    }

    return NextResponse.json({
      status: "anchored",
      message:
        "Proof has been anchored (simulated). On-chain anchoring will be available when the Solana program is deployed.",
      proof: {
        ...serializeProof(updated as Proof),
        data_hash: updated.data_hash,
      },
      anchor: {
        tx_signature: simulatedTxSignature,
        slot: simulatedSlot,
        timestamp: anchorTimestamp,
        simulated: true,
      },
    });
  } catch (err) {
    console.error("[proofs/:id/anchor] Error:", err);
    return errorResponse(500, "internal_error", "Internal server error");
  }
}
