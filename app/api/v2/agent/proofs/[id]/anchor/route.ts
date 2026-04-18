// ============================================
// OpenLesson Agentic API v2 - Anchor Proof
// POST /api/v2/agent/proofs/:id/anchor
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/agent-v2/auth";
import { serializeProof } from "@/lib/agent-v2/proofs";
import { isSolanaConfigured, anchorProofOnChain } from "@/lib/agent-v2/solana";
import { getOrCreateUserWallet } from "@/lib/agent-v2/solana-custodial";
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

    // ── Anchor on Solana (or simulate if not configured) ────────────
    let txSignature: string;
    let anchorSlot: number;
    let anchorTimestamp: string;
    let simulated = false;

    if (isSolanaConfigured()) {
      // Real Solana anchoring
      // getOrCreateUserWallet ensures the wallet row exists; then we
      // fetch the encrypted key to pass to anchorProofOnChain
      await getOrCreateUserWallet(supabase, auth.user_id);
      const { data: walletRow } = await supabase
        .from("user_solana_wallets")
        .select("pubkey, encrypted_private_key")
        .eq("user_id", auth.user_id)
        .single();

      if (!walletRow) {
        return errorResponse(500, "anchor_failed", "Could not load custodial wallet");
      }

      const result = await anchorProofOnChain(
        proof as Proof,
        auth.user_id,
        { pubkey: walletRow.pubkey, encryptedPrivateKey: walletRow.encrypted_private_key },
      );

      if (!result) {
        return errorResponse(500, "anchor_failed", "Solana anchoring returned no result");
      }

      txSignature = result.txSignature;
      anchorSlot = result.slot;
      anchorTimestamp = result.timestamp;

      // Update wallet stats (non-critical, best-effort)
      const { data: walletStats } = await supabase
        .from("user_solana_wallets")
        .select("total_anchored_proofs")
        .eq("user_id", auth.user_id)
        .single();

      await supabase
        .from("user_solana_wallets")
        .update({
          total_anchored_proofs: (walletStats?.total_anchored_proofs || 0) + 1,
          last_anchor_at: anchorTimestamp,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", auth.user_id);
    } else {
      // Simulated anchoring (Solana not configured)
      simulated = true;
      txSignature = `sim_${proof.fingerprint.replace("sha256:", "").slice(0, 32)}`;
      anchorSlot = Math.floor(Date.now() / 400);
      anchorTimestamp = new Date().toISOString();
    }

    const { data: updated, error: updateErr } = await supabase
      .from("agent_proofs")
      .update({
        anchored: true,
        anchor_tx_signature: txSignature,
        anchor_slot: anchorSlot,
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
      ...(simulated
        ? {
            message:
              "Proof has been anchored (simulated). Configure Solana env vars for on-chain anchoring.",
          }
        : {
            message: "Proof has been anchored on Solana.",
          }),
      proof: {
        ...serializeProof(updated as Proof),
        data_hash: updated.data_hash,
      },
      anchor: {
        tx_signature: txSignature,
        slot: anchorSlot,
        timestamp: anchorTimestamp,
        simulated,
        ...(simulated ? {} : { network: process.env.SOLANA_NETWORK }),
      },
    });
  } catch (err) {
    console.error("[proofs/:id/anchor] Error:", err);
    return errorResponse(500, "internal_error", "Internal server error");
  }
}
