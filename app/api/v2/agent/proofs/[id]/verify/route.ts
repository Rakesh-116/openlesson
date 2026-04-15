// ============================================
// OpenLesson Agentic API v2 - Verify Proof
// GET /api/v2/agent/proofs/:id/verify
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/agent-v2/auth";
import { calculateFingerprint } from "@/lib/agent-v2/proofs";

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

    // ── Fetch proof with full data ───────────────────────────────────
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

    // ── Recalculate fingerprint from stored data ─────────────────────
    const eventData = (proof.data as Record<string, unknown>) || {};
    const fingerprintData: Record<string, unknown> = {
      type: proof.type,
      timestamp: proof.timestamp,
      user_id: proof.user_id,
      ...(proof.session_id ? { session_id: proof.session_id } : {}),
      ...(proof.plan_id ? { plan_id: proof.plan_id } : {}),
      ...eventData,
    };

    const recalculatedFingerprint = calculateFingerprint(fingerprintData);
    const storedFingerprint = proof.fingerprint as string;

    const fingerprintMatch = recalculatedFingerprint === storedFingerprint;

    // ── Verify chain integrity (check previous proof link) ───────────
    let chainValid = true;
    let chainDetails: {
      previous_proof_id: string | null;
      previous_proof_exists: boolean;
    } | null = null;

    if (proof.previous_proof_id) {
      const { data: prevProof, error: prevErr } = await supabase
        .from("agent_proofs")
        .select("id, fingerprint, timestamp")
        .eq("id", proof.previous_proof_id)
        .single();

      const previousExists = !prevErr && !!prevProof;

      // If linked to a previous proof, verify it exists and was created before this one
      if (previousExists && prevProof) {
        const prevTimestamp = new Date(prevProof.timestamp).getTime();
        const currentTimestamp = new Date(proof.timestamp).getTime();
        chainValid = prevTimestamp <= currentTimestamp;
      } else {
        chainValid = false;
      }

      chainDetails = {
        previous_proof_id: proof.previous_proof_id,
        previous_proof_exists: previousExists,
      };
    }

    // ── Anchor verification ──────────────────────────────────────────
    let anchorValid: boolean | null = null;
    if (proof.anchored && proof.anchor_tx_signature) {
      // In production, this would verify against the Solana blockchain.
      // For now, we confirm the anchor fields are present and consistent.
      anchorValid = !!(
        proof.anchor_tx_signature &&
        proof.anchor_slot &&
        proof.anchor_timestamp
      );
    }

    // ── Overall verification result ──────────────────────────────────
    const verified =
      fingerprintMatch &&
      chainValid &&
      (anchorValid === null || anchorValid === true);

    return NextResponse.json({
      verified,
      proof_id: proofId,
      checks: {
        fingerprint: {
          valid: fingerprintMatch,
          stored: storedFingerprint,
          recalculated: recalculatedFingerprint,
        },
        chain: {
          valid: chainValid,
          ...(chainDetails ? { details: chainDetails } : {}),
        },
        anchor: proof.anchored
          ? {
              valid: anchorValid,
              tx_signature: proof.anchor_tx_signature || null,
              slot: proof.anchor_slot || null,
              timestamp: proof.anchor_timestamp || null,
            }
          : { valid: null, message: "Proof has not been anchored" },
      },
      timestamp: proof.timestamp,
      type: proof.type,
    });
  } catch (err) {
    console.error("[proofs/:id/verify] Error:", err);
    return errorResponse(500, "internal_error", "Internal server error");
  }
}
