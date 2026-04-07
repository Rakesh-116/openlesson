import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateAndStorePlanCover } from "@/lib/plan-image";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { planId, description } = await req.json();

    if (!planId) {
      return NextResponse.json({ error: "planId is required" }, { status: 400 });
    }

    // Verify ownership
    const { data: plan, error: planError } = await supabase
      .from("learning_plans")
      .select("id, user_id, root_topic, description")
      .eq("id", planId)
      .single();

    if (planError || !plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    if (plan.user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const imageDescription = description || plan.description || plan.root_topic;

    const coverUrl = await generateAndStorePlanCover(
      supabase as any,
      user.id,
      planId,
      imageDescription
    );

    if (!coverUrl) {
      return NextResponse.json(
        { error: "Failed to generate cover image" },
        { status: 500 }
      );
    }

    return NextResponse.json({ coverImageUrl: coverUrl });
  } catch (error) {
    console.error("Generate cover error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
