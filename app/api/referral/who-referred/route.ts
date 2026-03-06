import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get referral info
    const { data: referral, error } = await supabase
      .from("partner_referrals")
      .select(`
        created_at,
        partners!inner(
          id,
          user_id,
          referral_code,
          tier,
          profiles!inner(username)
        )
      `)
      .eq("referred_user_id", user.id)
      .single();

    if (error || !referral) {
      return NextResponse.json({ hasReferrer: false });
    }

    // The join returns partners with nested profiles
    const partnerData = referral.partners as unknown as {
      id: string;
      user_id: string;
      referral_code: string;
      tier: string;
      profiles: { username: string }[];
    };

    const partnerUsername = partnerData.profiles?.[0]?.username || "Unknown";

    return NextResponse.json({
      hasReferrer: true,
      referrer: {
        username: partnerUsername,
        tier: partnerData.tier,
        referralCode: partnerData.referral_code,
      },
      referredAt: referral.created_at,
    });
  } catch (error) {
    console.error("Get referrer error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}