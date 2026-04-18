// ============================================
// OpenLesson Agentic API v2 - Custodial Wallet Management
// ============================================
//
// Manages Solana custodial wallets for users. Each user gets a Keypair
// whose private key is AES-256-GCM encrypted and stored in the
// user_solana_wallets Supabase table. Users never need SOL — the fee
// payer (OpenLesson) covers all transaction costs.

import crypto from "crypto";
import { Keypair } from "@solana/web3.js";
import type { SupabaseClient } from "@supabase/supabase-js";

// ─── Encryption ──────────────────────────────────────────────────────────────

const IV_LENGTH = 12; // AES-GCM standard
const AUTH_TAG_LENGTH = 16;
const ALGORITHM = "aes-256-gcm";

function getEncryptionKey(): Buffer {
  const hex = process.env.SOLANA_WALLET_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error(
      "SOLANA_WALLET_ENCRYPTION_KEY is not set. Cannot encrypt/decrypt custodial wallets."
    );
  }
  if (hex.length !== 64) {
    throw new Error(
      `SOLANA_WALLET_ENCRYPTION_KEY must be a 32-byte hex string (64 chars), got ${hex.length} chars.`
    );
  }
  return Buffer.from(hex, "hex");
}

/**
 * Encrypt a Solana secret key for storage.
 * Format: base64(IV[12] + ciphertext + authTag[16])
 */
export function encryptPrivateKey(secretKey: Uint8Array): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(secretKey)),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // IV + ciphertext + authTag
  const combined = Buffer.concat([iv, encrypted, authTag]);
  return combined.toString("base64");
}

/**
 * Decrypt a stored encrypted private key back to a Keypair.
 */
export function decryptWalletKeypair(encryptedPrivateKey: string): Keypair {
  const key = getEncryptionKey();
  const combined = Buffer.from(encryptedPrivateKey, "base64");

  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH, combined.length - AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return Keypair.fromSecretKey(new Uint8Array(decrypted));
}

/**
 * Look up or create a custodial Solana wallet for a user.
 *
 * If the user already has a wallet in user_solana_wallets, decrypts and
 * returns it. Otherwise generates a new Keypair, encrypts the secret key,
 * and stores it.
 */
export async function getOrCreateUserWallet(
  supabase: SupabaseClient,
  userId: string
): Promise<{ pubkey: string; keypair: Keypair }> {
  // Check for existing wallet
  const { data: existing, error: lookupErr } = await supabase
    .from("user_solana_wallets")
    .select("pubkey, encrypted_private_key")
    .eq("user_id", userId)
    .single();

  if (!lookupErr && existing) {
    const keypair = decryptWalletKeypair(existing.encrypted_private_key);
    return { pubkey: existing.pubkey, keypair };
  }

  // Generate new wallet
  const keypair = Keypair.generate();
  const pubkey = keypair.publicKey.toBase58();
  const encryptedPrivateKey = encryptPrivateKey(keypair.secretKey);

  const { error: insertErr } = await supabase
    .from("user_solana_wallets")
    .insert({
      user_id: userId,
      pubkey,
      encrypted_private_key: encryptedPrivateKey,
      key_version: 1,
    });

  if (insertErr) {
    // Race condition: another request may have created the wallet
    // Try to fetch again
    const { data: retry, error: retryErr } = await supabase
      .from("user_solana_wallets")
      .select("pubkey, encrypted_private_key")
      .eq("user_id", userId)
      .single();

    if (retryErr || !retry) {
      throw new Error(
        `Failed to create custodial wallet for user ${userId}: ${insertErr.message}`
      );
    }

    const retryKeypair = decryptWalletKeypair(retry.encrypted_private_key);
    return { pubkey: retry.pubkey, keypair: retryKeypair };
  }

  console.log(`[solana-custodial] Created custodial wallet for user ${userId}: ${pubkey}`);
  return { pubkey, keypair };
}
