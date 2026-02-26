import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updatePlanVisibility } from "@/lib/storage";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: planId } = await params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { is_public } = await req.json();

    if (typeof is_public !== "boolean") {
      return NextResponse.json(
        { error: "is_public must be a boolean" },
        { status: 400 }
      );
    }

    // First, let's check if we can read the plan
    const { data: existingPlan, error: checkError } = await supabase
      .from("learning_plans")
      .select("id, user_id, is_public")
      .eq("id", planId)
      .single();

    if (checkError) {
      console.error("Check error:", checkError);
      return NextResponse.json({ error: "Cannot access plan: " + checkError.message }, { status: 500 });
    }

    console.log("Existing plan:", existingPlan);
    console.log("Current user:", user.id);

    // Now update
    const { error: updateError } = await supabase
      .from("learning_plans")
      .update({ is_public: is_public, author_id: user.id })
      .eq("id", planId)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Update error:", updateError);
      return NextResponse.json({ error: "Update failed: " + updateError.message }, { status: 500 });
    }

    // Verify the update
    const { data: verifyPlan } = await supabase
      .from("learning_plans")
      .select("is_public")
      .eq("id", planId)
      .single();

    console.log("After update:", verifyPlan);

    return NextResponse.json({
      success: true,
      is_public: verifyPlan?.is_public,
      message: is_public
        ? "Plan is now public and visible to the community!"
        : "Plan is now private.",
    });
  } catch (error) {
    console.error("Error updating plan visibility:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update visibility" },
      { status: 500 }
    );
  }
}
