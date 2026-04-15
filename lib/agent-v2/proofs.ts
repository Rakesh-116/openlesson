// ============================================
// OpenLesson Agentic API v2 - Proof System
// ============================================

import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProofType, Proof } from "./types";

/**
 * Calculate a SHA-256 fingerprint for a proof event.
 * Uses canonical JSON serialization (sorted keys, no whitespace).
 */
export function calculateFingerprint(data: Record<string, unknown>): string {
  const sorted = JSON.stringify(data, Object.keys(data).sort());
  const hash = crypto.createHash("sha256").update(sorted).digest("hex");
  return `sha256:${hash}`;
}

/**
 * Calculate SHA-256 hash of arbitrary string data
 */
export function hashData(data: string): string {
  const hash = crypto.createHash("sha256").update(data).digest("hex");
  return `sha256:${hash}`;
}

/**
 * Generate and store a cryptographic proof for an event.
 */
export async function createProof(
  supabase: SupabaseClient,
  params: {
    type: ProofType;
    user_id: string;
    session_id?: string | null;
    plan_id?: string | null;
    previous_proof_id?: string | null;
    input_hash?: string | null;
    output_hash?: string | null;
    event_data: Record<string, unknown>;
  }
): Promise<Proof | null> {
  const timestamp = new Date().toISOString();

  const fingerprintData: Record<string, unknown> = {
    type: params.type,
    timestamp,
    user_id: params.user_id,
    ...(params.session_id ? { session_id: params.session_id } : {}),
    ...(params.plan_id ? { plan_id: params.plan_id } : {}),
    ...params.event_data,
  };

  const fingerprint = calculateFingerprint(fingerprintData);
  const data_hash = hashData(JSON.stringify(params.event_data));

  const { data: proof, error } = await supabase
    .from("agent_proofs")
    .insert({
      type: params.type,
      user_id: params.user_id,
      fingerprint,
      timestamp,
      session_id: params.session_id || null,
      plan_id: params.plan_id || null,
      previous_proof_id: params.previous_proof_id || null,
      input_hash: params.input_hash || null,
      output_hash: params.output_hash || null,
      data_hash,
      data: params.event_data,
      anchored: false,
    })
    .select()
    .single();

  if (error || !proof) {
    console.error("[proofs] Failed to create proof:", error);
    return null;
  }

  return proof as Proof;
}

/**
 * Build a Merkle tree from an array of fingerprints.
 * Returns the Merkle root.
 */
export function buildMerkleRoot(fingerprints: string[]): string {
  if (fingerprints.length === 0) return hashData("");

  // Strip sha256: prefix for tree computation
  let leaves = fingerprints.map((fp) =>
    fp.startsWith("sha256:") ? fp.slice(7) : fp
  );

  // Pad to even number if needed
  if (leaves.length % 2 !== 0) {
    leaves.push(leaves[leaves.length - 1]);
  }

  while (leaves.length > 1) {
    const nextLevel: string[] = [];
    for (let i = 0; i < leaves.length; i += 2) {
      const combined = leaves[i] + leaves[i + 1];
      const hash = crypto.createHash("sha256").update(combined).digest("hex");
      nextLevel.push(hash);
    }
    leaves = nextLevel;

    // Pad again if needed
    if (leaves.length > 1 && leaves.length % 2 !== 0) {
      leaves.push(leaves[leaves.length - 1]);
    }
  }

  return `sha256:${leaves[0]}`;
}

/**
 * Create a batch proof for a completed session.
 * Aggregates all heartbeat proofs into a Merkle tree.
 */
export async function createSessionBatchProof(
  supabase: SupabaseClient,
  params: {
    session_id: string;
    user_id: string;
  }
): Promise<{ batch_id: string; merkle_root: string } | null> {
  // Get all heartbeat and assistant proofs for this session
  const { data: proofs, error: proofError } = await supabase
    .from("agent_proofs")
    .select("id, fingerprint")
    .eq("session_id", params.session_id)
    .in("type", ["analysis_heartbeat", "assistant_query"])
    .order("timestamp", { ascending: true });

  if (proofError || !proofs || proofs.length === 0) {
    return null;
  }

  const fingerprints = proofs.map((p: { fingerprint: string }) => p.fingerprint);
  const merkle_root = buildMerkleRoot(fingerprints);
  const proof_ids = proofs.map((p: { id: string }) => p.id);

  const { data: batch, error: batchError } = await supabase
    .from("agent_proof_batches")
    .insert({
      session_id: params.session_id,
      user_id: params.user_id,
      merkle_root,
      proof_ids,
      proof_count: proofs.length,
      anchored: false,
    })
    .select()
    .single();

  if (batchError || !batch) {
    console.error("[proofs] Failed to create batch:", batchError);
    return null;
  }

  return { batch_id: batch.id, merkle_root };
}

/**
 * Serialize a proof for API response (public-facing fields only)
 */
export function serializeProof(proof: Proof) {
  return {
    id: proof.id,
    type: proof.type,
    fingerprint: proof.fingerprint,
    timestamp: proof.timestamp,
    ...(proof.session_id ? { session_id: proof.session_id } : {}),
    ...(proof.plan_id ? { plan_id: proof.plan_id } : {}),
    ...(proof.input_hash ? { input_hash: proof.input_hash } : {}),
    ...(proof.output_hash ? { output_hash: proof.output_hash } : {}),
    anchored: proof.anchored,
    ...(proof.anchor_tx_signature
      ? { anchor_tx_signature: proof.anchor_tx_signature }
      : {}),
  };
}
