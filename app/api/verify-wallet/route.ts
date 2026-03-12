import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * POST: Wallet verification has been replaced by the partner staking system.
 * Users should stake $UNSYS tokens via /dashboard/partner to get plan access.
 */
export async function POST() {
  return NextResponse.json({
    error: "Wallet verification has been replaced by token staking. Visit /dashboard/partner to stake $UNSYS and get plan access.",
    redirect: "/dashboard/partner",
  }, { status: 410 });
}
