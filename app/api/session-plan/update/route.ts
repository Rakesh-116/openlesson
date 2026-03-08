import { NextRequest, NextResponse } from "next/server";
import { updateSessionPlanLLM } from "@/lib/openrouter";
import { getSessionPlan, updateSessionPlan, type SessionPlanStep } from "@/lib/storage";
import { getUserPrompts } from "@/lib/prompts";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      sessionId, 
      gapScore, 
      signals, 
      transcript, 
      trafficLight, 
      previousProbes 
    } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing sessionId" },
        { status: 400 }
      );
    }

    // Get user
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get current plan (pass server client for RLS)
    const currentPlan = await getSessionPlan(sessionId, supabase);
    
    if (!currentPlan) {
      return NextResponse.json(
        { error: "No plan found for this session" },
        { status: 404 }
      );
    }

    // Get user prompt overrides
    const promptOverrides = await getUserPrompts();

    // Update the plan using LLM
    const result = await updateSessionPlanLLM({
      goal: currentPlan.goal,
      strategy: currentPlan.strategy,
      steps: currentPlan.steps,
      currentStepIndex: currentPlan.currentStepIndex,
      gapScore: gapScore ?? 0.5,
      signals: signals || [],
      transcript: transcript || "",
      trafficLight: trafficLight || "yellow",
      previousProbes: previousProbes || [],
      promptOverrides,
    });

    if (!result.success || !result.result) {
      return NextResponse.json(
        { error: result.error || "Plan update failed" },
        { status: 500 }
      );
    }

    const { planChanged, shouldPause, pauseReason, updatedSteps, currentStepIndex, nextRequest, reasoning } = result.result;

    // Update plan in database if it changed
    let updatedPlan = currentPlan;
    if (planChanged && updatedSteps) {
      // Mark the current step as in_progress, previous as completed
      const normalizedSteps: SessionPlanStep[] = updatedSteps.map((step, idx) => ({
        id: step.id || `step_${idx + 1}_${Date.now()}`,
        description: step.description,
        type: step.type,
        order: step.order,
        status: idx < currentStepIndex 
          ? "completed" 
          : idx === currentStepIndex 
            ? "in_progress" 
            : "pending",
      }));

      updatedPlan = await updateSessionPlan(currentPlan.id, {
        steps: normalizedSteps,
        currentStepIndex,
      }, supabase);
    } else if (currentStepIndex !== currentPlan.currentStepIndex) {
      // Just update the current step index if it changed
      const normalizedSteps: SessionPlanStep[] = currentPlan.steps.map((step, idx) => ({
        id: step.id,
        description: step.description,
        type: step.type,
        order: step.order,
        status: idx < currentStepIndex 
          ? "completed" 
          : idx === currentStepIndex 
            ? "in_progress" 
            : step.status === "skipped" ? "skipped" : "pending",
      }));

      updatedPlan = await updateSessionPlan(currentPlan.id, {
        steps: normalizedSteps,
        currentStepIndex,
      }, supabase);
    }

    return NextResponse.json({
      plan: updatedPlan,
      planChanged,
      shouldPause,
      pauseReason,
      nextRequest,
      reasoning,
    });
  } catch (error) {
    console.error("Update session plan error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
