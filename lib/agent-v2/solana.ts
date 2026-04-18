// ============================================
// OpenLesson Agentic API v2 - Solana Client
// ============================================
//
// Main wrapper around the @openlesson/proof-anchor-sdk. Provides a
// singleton ProofAnchorClient and high-level functions for anchoring
// proofs and batches on Solana.
//
// All exports gracefully handle the case where Solana is not configured
// (missing env vars) by returning null so callers can fall back to
// simulated behavior.

import { Connection, Keypair, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { AnchorProvider } from "@coral-xyz/anchor";
import { ProofAnchorClient } from "./sdk/client";
import type { ProofType as SdkProofType } from "./sdk/types";
import { getFeePayerKeypair } from "./solana-fee-payer";
import { decryptWalletKeypair } from "./solana-custodial";
import type { Proof, ProofBatch } from "./types";

// ─── Configuration Check ────────────────────────────────────────────────────

const REQUIRED_ENV_VARS = [
  "SOLANA_NETWORK",
  "SOLANA_RPC_URL",
  "SOLANA_PROGRAM_ID",
  "SOLANA_FEE_PAYER_SECRET_KEY",
  "SOLANA_WALLET_ENCRYPTION_KEY",
] as const;

/**
 * Check whether all Solana env vars are configured.
 * If this returns false, all anchor operations fall back to simulated mode.
 */
export function isSolanaConfigured(): boolean {
  return REQUIRED_ENV_VARS.every((key) => !!process.env[key]);
}

// ─── Singleton Client ────────────────────────────────────────────────────────

let clientInstance: ProofAnchorClient | null = null;

/**
 * Get (or create) the singleton ProofAnchorClient.
 * Throws if Solana is not configured.
 */
export function getSolanaClient(): ProofAnchorClient {
  if (clientInstance) return clientInstance;

  if (!isSolanaConfigured()) {
    throw new Error(
      "Solana is not configured. Set all required env vars: " +
        REQUIRED_ENV_VARS.join(", ")
    );
  }

  const rpcUrl = process.env.SOLANA_RPC_URL!;
  const programId = new PublicKey(process.env.SOLANA_PROGRAM_ID!);
  const feePayer = getFeePayerKeypair();

  const connection = new Connection(rpcUrl, "confirmed");

  // Minimal wallet adapter compatible with AnchorProvider
  const wallet = {
    publicKey: feePayer.publicKey,
    signTransaction: async <T extends Transaction | VersionedTransaction>(tx: T): Promise<T> => {
      if (tx instanceof Transaction) {
        tx.partialSign(feePayer);
      }
      return tx;
    },
    signAllTransactions: async <T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> => {
      for (const tx of txs) {
        if (tx instanceof Transaction) {
          tx.partialSign(feePayer);
        }
      }
      return txs;
    },
  };

  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });

  clientInstance = new ProofAnchorClient(provider, feePayer, programId);

  console.log(
    `[solana] Client initialized — network: ${process.env.SOLANA_NETWORK}, ` +
      `program: ${programId.toBase58()}, ` +
      `fee payer: ${feePayer.publicKey.toBase58()}`
  );

  return clientInstance;
}

// ─── Transaction Confirmation Helper ─────────────────────────────────────────

interface TxDetails {
  txSignature: string;
  slot: number;
  timestamp: string;
}

/**
 * Confirm a transaction and extract its slot and block timestamp.
 */
async function getTransactionDetails(
  client: ProofAnchorClient,
  txSignature: string
): Promise<TxDetails> {
  // Wait for confirmation
  const latestBlockhash = await client.connection.getLatestBlockhash();
  await client.connection.confirmTransaction(
    { signature: txSignature, ...latestBlockhash },
    "confirmed"
  );

  // Fetch the confirmed transaction to get slot and blockTime
  const txInfo = await client.connection.getTransaction(txSignature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });

  const slot = txInfo?.slot ?? 0;
  const blockTime = txInfo?.blockTime ?? Math.floor(Date.now() / 1000);
  const timestamp = new Date(blockTime * 1000).toISOString();

  return { txSignature, slot, timestamp };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Anchor a proof on Solana.
 *
 * @returns Transaction details, or null if Solana is not configured.
 */
export async function anchorProofOnChain(
  proof: Proof,
  userId: string,
  userWallet: { pubkey: string; encryptedPrivateKey: string }
): Promise<TxDetails | null> {
  if (!isSolanaConfigured()) {
    console.warn("[solana] Solana not configured — skipping proof anchoring");
    return null;
  }

  const client = getSolanaClient();
  const userKeypair = decryptWalletKeypair(userWallet.encryptedPrivateKey);

  // Ensure user is initialized on-chain (idempotent)
  await client.ensureUserInitialized(userKeypair, userId);

  // Convert event timestamp to unix seconds
  const eventTimestamp = Math.floor(
    new Date(proof.timestamp).getTime() / 1000
  );

  const txSignature = await client.anchorProof(userKeypair, {
    proofId: proof.id,
    fingerprint: proof.fingerprint,
    proofType: proof.type as SdkProofType,
    userId,
    eventTimestamp,
    sessionId: proof.session_id || null,
    planId: proof.plan_id || null,
  });

  return getTransactionDetails(client, txSignature);
}

/**
 * Anchor a session batch on Solana.
 *
 * @returns Transaction details, or null if Solana is not configured.
 */
export async function anchorBatchOnChain(
  batch: ProofBatch,
  userWallet: { pubkey: string; encryptedPrivateKey: string }
): Promise<TxDetails | null> {
  if (!isSolanaConfigured()) {
    console.warn("[solana] Solana not configured — skipping batch anchoring");
    return null;
  }

  const client = getSolanaClient();
  const userKeypair = decryptWalletKeypair(userWallet.encryptedPrivateKey);

  // Ensure user is initialized on-chain (idempotent)
  await client.ensureUserInitialized(userKeypair, batch.user_id);

  // Get timestamps from the batch's constituent proofs
  // The batch startTimestamp/endTimestamp come from the proof creation times
  const startTimestamp = Math.floor(Date.now() / 1000) - 3600; // fallback
  const endTimestamp = Math.floor(Date.now() / 1000);

  const txSignature = await client.anchorBatch(userKeypair, {
    batchId: batch.id,
    merkleRoot: batch.merkle_root,
    proofCount: batch.proof_count,
    userId: batch.user_id,
    sessionId: batch.session_id,
    startTimestamp,
    endTimestamp,
  });

  return getTransactionDetails(client, txSignature);
}

/**
 * Verify a proof exists on-chain and its fingerprint matches.
 *
 * @returns Verification result, or null if Solana is not configured.
 */
export async function verifyProofOnChain(
  proofId: string,
  fingerprint: string
): Promise<{
  exists: boolean;
  fingerprintMatch: boolean;
  onChainFingerprint: string | null;
  anchorSlot: number | null;
  anchorTimestamp: number | null;
} | null> {
  if (!isSolanaConfigured()) {
    return null;
  }

  const client = getSolanaClient();
  return client.verifyProofOnChain(proofId, fingerprint);
}
