import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const planId = req.nextUrl.searchParams.get("planId");
    if (!planId) {
      return NextResponse.json({ error: "planId is required" }, { status: 400 });
    }

    // Get personal analytics (always)
    const { data: personal, error: personalError } = await supabase
      .rpc("get_personal_plan_analytics", {
        target_plan_id: planId,
        requesting_user_id: user.id,
      });

    if (personalError) {
      console.error("[Plan Analytics] Personal error:", personalError);
    }

    // Check if user is org admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id, is_org_admin, is_admin")
      .eq("id", user.id)
      .single();

    let org = null;
    if (profile && (profile.is_admin || (profile.is_org_admin && profile.organization_id))) {
      const { data: orgData, error: orgError } = await supabase
        .rpc("get_org_plan_analytics", {
          target_plan_id: planId,
          requesting_user_id: user.id,
        });

      if (orgError) {
        console.error("[Plan Analytics] Org error:", orgError);
      } else if (orgData && !orgData.error) {
        org = orgData;
      }
    }

    return NextResponse.json({
      personal: personal || {
        total_sessions: 0,
        completed_sessions: 0,
        total_nodes: 0,
        completed_nodes: 0,
        avg_duration_minutes: 0,
        total_duration_minutes: 0,
        avg_gap_score: 0,
        sessions: [],
      },
      org,
    });
  } catch (error) {
    console.error("[Plan Analytics] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load analytics" },
      { status: 500 }
    );
  }
}
