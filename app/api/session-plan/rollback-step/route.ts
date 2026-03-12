import { NextRequest, NextResponse } from "next/server";
import { getSessionPlan, updateSessionPlan, validatePlanSteps, type SessionPlanStep } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 10;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, targetStepIndex } = body;

    if (!sessionId || targetStepIndex === undefined || targetStepIndex === null) {
      return NextResponse.json(
        { error: "Missing sessionId or targetStepIndex" },
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

    if (targetStepIndex < 0 || targetStepIndex >= steps.length) {
      return NextResponse.json(
        { error: "targetStepIndex out of bounds" },
        { status: 400 }
      );
    }

    if (targetStepIndex >= currentStepIndex) {
      return NextResponse.json(
        { error: "Can only roll back to a step before the current one" },
        { status: 400 }
      );
    }

    // Rollback: set target to in_progress, revert everything from target+1..currentStepIndex to pending
    // Steps before target remain untouched (stay completed)
    const updatedSteps: SessionPlanStep[] = steps.map((step, idx) => {
      if (idx === targetStepIndex) {
        return { ...step, status: "in_progress" as const };
      }
      if (idx > targetStepIndex && idx <= currentStepIndex) {
        return { ...step, status: "pending" as const };
      }
      return step;
    });

    // Validate and persist
    validatePlanSteps(updatedSteps);

    const updatedPlan = await updateSessionPlan(currentPlan.id, {
      steps: updatedSteps,
      currentStepIndex: targetStepIndex,
    }, supabase);

    return NextResponse.json({
      plan: updatedPlan,
    });
  } catch (error) {
    console.error("Rollback step error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
