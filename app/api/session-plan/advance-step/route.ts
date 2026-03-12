import { NextRequest, NextResponse } from "next/server";
import { getSessionPlan, updateSessionPlan, validatePlanSteps, type SessionPlanStep } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 10;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing sessionId" },
        { status: 400 }
      );
    }

    // Auth check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Load current plan
    const currentPlan = await getSessionPlan(sessionId, supabase);

    if (!currentPlan) {
      return NextResponse.json(
        { error: "No plan found for this session" },
        { status: 404 }
      );
    }

    const { steps, currentStepIndex } = currentPlan;

    if (!steps || steps.length === 0) {
      return NextResponse.json(
        { error: "Plan has no steps" },
        { status: 400 }
      );
    }

    // Mark the current step as completed
    const updatedSteps: SessionPlanStep[] = steps.map((step, idx) => {
      if (idx === currentStepIndex) {
        return { ...step, status: "completed" as const };
      }
      return step;
    });

    // Find the next pending step (first non-completed, non-skipped step after current)
    let nextIndex = currentStepIndex;
    let allComplete = true;
    for (let i = 0; i < updatedSteps.length; i++) {
      if (updatedSteps[i].status === "pending" || (updatedSteps[i].status === "in_progress" && i !== currentStepIndex)) {
        allComplete = false;
        if (i > currentStepIndex) {
          nextIndex = i;
          break;
        }
      }
    }

    // If we didn't find a pending step after currentStepIndex,
    // check if there are any pending steps at all (shouldn't happen normally, but be safe)
    if (nextIndex === currentStepIndex && !allComplete) {
      for (let i = 0; i < updatedSteps.length; i++) {
        if (updatedSteps[i].status === "pending") {
          nextIndex = i;
          break;
        }
      }
    }

    // If all steps are now completed, keep the index at the last step
    if (allComplete) {
      nextIndex = updatedSteps.length - 1;
    } else {
      // Mark the next step as in_progress
      updatedSteps[nextIndex] = { ...updatedSteps[nextIndex], status: "in_progress" as const };
    }

    // Validate and persist
    validatePlanSteps(updatedSteps);

    const updatedPlan = await updateSessionPlan(currentPlan.id, {
      steps: updatedSteps,
      currentStepIndex: nextIndex,
    }, supabase);

    return NextResponse.json({
      plan: updatedPlan,
      allComplete,
    });
  } catch (error) {
    console.error("Advance step error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
