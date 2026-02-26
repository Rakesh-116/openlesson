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

    const { is_public, title } = await req.json();

    const updates: Record<string, any> = {};

    if (typeof is_public === "boolean") {
      updates.is_public = is_public;
    }

    if (typeof title === "string" && title.trim()) {
      updates.title = title.trim();
      updates.root_topic = title.trim();
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
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
      .update({ ...updates, author_id: user.id })
      .eq("id", planId)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Update error:", updateError);
      return NextResponse.json({ error: "Update failed: " + updateError.message }, { status: 500 });
    }

    // Verify the update
    const { data: verifyPlan } = await supabase
      .from("learning_plans")
      .select("is_public, title")
      .eq("id", planId)
      .single();

    console.log("After update:", verifyPlan);

    const response: Record<string, any> = {
      success: true,
    };

    if (typeof is_public === "boolean") {
      response.is_public = verifyPlan?.is_public;
      response.message = is_public
        ? "Plan is now public and visible to the community!"
        : "Plan is now private.";
    }

    if (title) {
      response.title = verifyPlan?.title;
      response.message = response.message 
        ? response.message + " Title updated." 
        : "Title updated.";
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error updating plan visibility:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update visibility" },
      { status: 500 }
    );
  }
}
