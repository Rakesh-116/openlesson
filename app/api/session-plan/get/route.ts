import { NextRequest, NextResponse } from "next/server";
import { getSessionPlan } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing sessionId" },
        { status: 400 }
      );
    }

    // Verify user is authenticated
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get the plan (pass server client for RLS)
    const plan = await getSessionPlan(sessionId, supabase);

    if (!plan) {
      return NextResponse.json(
        { error: "No plan found for this session", plan: null },
        { status: 200 }
      );
    }

    // Verify user owns this plan
    if (plan.userId !== user.id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    return NextResponse.json({ plan });
  } catch (error) {
    console.error("Get session plan error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
