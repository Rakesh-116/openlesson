// ============================================
// OpenLesson Agentic API v2 - Fee Payer Management
// ============================================
//
// OpenLesson pays all Solana transaction fees. This module loads the
// fee payer keypair from SOLANA_FEE_PAYER_SECRET_KEY (base64-encoded
// 64-byte secret key) and provides balance monitoring.

import { Keypair, Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";

const MIN_BALANCE_SOL = 0.5;

let cachedFeePayer: Keypair | null = null;

/**
 * Load the fee payer Keypair from the SOLANA_FEE_PAYER_SECRET_KEY env var.
 * The key is expected to be a base64-encoded 64-byte Solana secret key.
 */
export function getFeePayerKeypair(): Keypair {
  if (cachedFeePayer) return cachedFeePayer;

  const b64 = process.env.SOLANA_FEE_PAYER_SECRET_KEY;
  if (!b64) {
    throw new Error("SOLANA_FEE_PAYER_SECRET_KEY is not set.");
  }

  const secretKey = new Uint8Array(Buffer.from(b64, "base64"));
  if (secretKey.length !== 64) {
    throw new Error(
      `SOLANA_FEE_PAYER_SECRET_KEY decoded to ${secretKey.length} bytes, expected 64.`
    );
  }

  cachedFeePayer = Keypair.fromSecretKey(secretKey);
  console.log(
    `[solana-fee-payer] Loaded fee payer: ${cachedFeePayer.publicKey.toBase58()}`
  );
  return cachedFeePayer;
}

/**
 * Check the fee payer's SOL balance and warn if it's below the threshold.
 */
export async function checkFeePayerBalance(): Promise<{
  balance: number;
  sufficient: boolean;
}> {
  const rpcUrl = process.env.SOLANA_RPC_URL;
  if (!rpcUrl) {
    throw new Error("SOLANA_RPC_URL is not set.");
  }

  const feePayer = getFeePayerKeypair();
  const connection = new Connection(rpcUrl, "confirmed");
  const lamports = await connection.getBalance(feePayer.publicKey);
  const balance = lamports / LAMPORTS_PER_SOL;
  const sufficient = balance >= MIN_BALANCE_SOL;

  if (!sufficient) {
    console.warn(
      `[solana-fee-payer] WARNING: Fee payer balance is ${balance.toFixed(4)} SOL ` +
        `(below ${MIN_BALANCE_SOL} SOL threshold). ` +
        `Address: ${feePayer.publicKey.toBase58()}`
    );
  }

  return { balance, sufficient };
}
