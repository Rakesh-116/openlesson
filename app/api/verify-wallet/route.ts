import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const TOKEN_THRESHOLDS = {
  regular: 2_000_000, // 2M $UNSYS
  pro: 5_000_000,      // 5M $UNSYS
};

const VALIDITY_MONTHS = 3;

/**
 * POST: Verify wallet ownership and token balance
 * In production, this would call Solana RPC to check actual token balance
 * For now, we'll accept any valid Solana address and mock the balance check
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { walletAddress } = await request.json();
    
    if (!walletAddress || typeof walletAddress !== "string") {
      return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
    }

    // Basic Solana address validation (base58, 32-44 chars)
    const solanaAddressRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    if (!solanaAddressRegex.test(walletAddress)) {
      return NextResponse.json({ error: "Invalid Solana wallet address format" }, { status: 400 });
    }

    // TODO: In production, integrate with Solana RPC to check actual token balance
    // For now, we'll use a placeholder that accepts any valid address
    // In a real implementation, you would:
    // 1. Connect to Solana mainnet (e.g., via Helius, Alchemy, or quicknode)
    // 2. Get token account balance for $UNSYS token mint
    // 3. Compare against TOKEN_THRESHOLDS
    
    // Placeholder: Accept any address and randomly assign tier for demo
    // Replace this logic with actual on-chain check
    const mockBalance = 6_000_000; // Simulate having 6M tokens (pro tier)
    const tier = mockBalance >= TOKEN_THRESHOLDS.pro ? "pro" 
               : mockBalance >= TOKEN_THRESHOLDS.regular ? "regular" 
               : null;

    if (!tier) {
      return NextResponse.json({ 
        error: `Insufficient $UNSYS tokens. Need at least ${TOKEN_THRESHOLDS.regular.toLocaleString()} for Regular tier.`,
        tier: null 
      }, { status: 200 }); // Return 200 with tier: null so UI can show error
    }

    // Calculate validity period (3 months from now)
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setMonth(expiresAt.getMonth() + VALIDITY_MONTHS);

    // Update profile with token tier and validation timestamps
    const { data: updatedProfile, error: updateError } = await supabase
      .from("profiles")
      .update({
        wallet_address: walletAddress,
        token_tier: tier,
        token_validated_at: now.toISOString(),
        token_validity_expires_at: expiresAt.toISOString(),
      })
      .eq("id", user.id)
      .select("token_tier, token_validated_at, token_validity_expires_at")
      .single();

    if (updateError) {
      console.error("Failed to update profile:", updateError);
      return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
    }

    return NextResponse.json({
      tier,
      validatedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("Verify wallet error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
