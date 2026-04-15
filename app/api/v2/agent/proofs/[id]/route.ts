// ============================================
// OpenLesson Agentic API v2 - Proof Details
// GET /api/v2/agent/proofs/:id
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

    // ── Fetch chain context (previous and next proofs) ───────────────
    let previousProof = null;
    if (proof.previous_proof_id) {
      const { data: prev } = await supabase
        .from("agent_proofs")
        .select("id, type, fingerprint, timestamp")
        .eq("id", proof.previous_proof_id)
        .single();

      if (prev) {
        previousProof = {
          id: prev.id,
          type: prev.type,
          fingerprint: prev.fingerprint,
          timestamp: prev.timestamp,
        };
      }
    }

    // Find proofs that reference this one as previous_proof_id
    const { data: nextProofs } = await supabase
      .from("agent_proofs")
      .select("id, type, fingerprint, timestamp")
      .eq("previous_proof_id", proofId)
      .eq("user_id", auth.user_id)
      .order("timestamp", { ascending: true })
      .limit(10);

    // ── Fetch related proofs in the same session ─────────────────────
    let relatedProofs: { id: string; type: string; fingerprint: string; timestamp: string }[] = [];
    if (proof.session_id) {
      const { data: related } = await supabase
        .from("agent_proofs")
        .select("id, type, fingerprint, timestamp")
        .eq("session_id", proof.session_id)
        .eq("user_id", auth.user_id)
        .neq("id", proofId)
        .order("timestamp", { ascending: true })
        .limit(20);

      relatedProofs = (related || []).map(
        (r: { id: string; type: string; fingerprint: string; timestamp: string }) => ({
          id: r.id,
          type: r.type,
          fingerprint: r.fingerprint,
          timestamp: r.timestamp,
        })
      );
    }

    // ── Check if proof is part of a batch ────────────────────────────
    let batch = null;
    if (proof.session_id) {
      const { data: batchData } = await supabase
        .from("agent_proof_batches")
        .select("id, merkle_root, proof_ids, proof_count, anchored, anchor_tx_signature")
        .eq("session_id", proof.session_id)
        .eq("user_id", auth.user_id)
        .maybeSingle();

      if (batchData) {
        // Check if this proof is in the batch's proof_ids
        const batchProofIds = (batchData.proof_ids ?? []) as string[];
        const isInBatch =
          batchProofIds.length === 0 || batchProofIds.includes(proofId);
        if (isInBatch) {
          batch = {
            id: batchData.id,
            merkle_root: batchData.merkle_root,
            proof_count: batchData.proof_count,
            anchored: batchData.anchored,
            ...(batchData.anchor_tx_signature
              ? { anchor_tx_signature: batchData.anchor_tx_signature }
              : {}),
          };
        }
      }
    }

    // ── Build response ───────────────────────────────────────────────
    return NextResponse.json({
      proof: {
        ...serializeProof(proof as Proof),
        data_hash: proof.data_hash,
      },
      verification: {
        fingerprint: proof.fingerprint,
        data_hash: proof.data_hash,
        anchored: proof.anchored,
        ...(proof.anchor_tx_signature
          ? { anchor_tx_signature: proof.anchor_tx_signature }
          : {}),
        ...(proof.anchor_slot ? { anchor_slot: proof.anchor_slot } : {}),
        ...(proof.anchor_timestamp
          ? { anchor_timestamp: proof.anchor_timestamp }
          : {}),
      },
      chain: {
        previous: previousProof,
        next: (nextProofs || []).map(
          (n: { id: string; type: string; fingerprint: string; timestamp: string }) => ({
            id: n.id,
            type: n.type,
            fingerprint: n.fingerprint,
            timestamp: n.timestamp,
          })
        ),
      },
      related_proofs: relatedProofs,
      batch,
    });
  } catch (err) {
    console.error("[proofs/:id] Error:", err);
    return errorResponse(500, "internal_error", "Internal server error");
  }
}
