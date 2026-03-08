import { NextRequest, NextResponse } from "next/server";
import { generateProbe } from "@/lib/openrouter";
import { getUserPrompts } from "@/lib/prompts";
import type { RequestType, SessionPlan } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      problem, 
      gapScore, 
      signals, 
      previousProbes, 
      ragContext, 
      audioBase64, 
      audioFormat, 
      objectives,
      sessionPlan,  // NEW: session plan context
      requestType,  // NEW: optional override for request type
    } = body;

    if (!problem) {
      return NextResponse.json({ error: "Missing problem" }, { status: 400 });
    }
    if (typeof gapScore !== "number") {
      return NextResponse.json({ error: "Missing gapScore" }, { status: 400 });
    }

    const promptOverrides = await getUserPrompts();

    // Build enhanced context with session plan
    let enhancedRagContext = ragContext || "";
    if (sessionPlan) {
      const plan = sessionPlan as SessionPlan;
      const currentStep = plan.steps[plan.currentStepIndex];
      const planContext = `
SESSION PLAN CONTEXT:
- Goal: ${plan.goal}
- Strategy: ${plan.strategy}
- Current step (${plan.currentStepIndex + 1}/${plan.steps.length}): [${currentStep?.type || "question"}] ${currentStep?.description || "Continue guiding"}
- Progress: ${plan.steps.filter(s => s.status === "completed").length}/${plan.steps.length} steps completed
`;
      enhancedRagContext = planContext + (ragContext ? `\n\n${ragContext}` : "");
    }

    const result = await generateProbe({
      problem,
      gapScore,
      signals: signals || [],
      previousProbes: previousProbes || [],
      ragContext: enhancedRagContext,
      audioBase64,
      audioFormat,
      promptOverrides,
      objectives,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Probe generation failed" }, { status: 500 });
    }

    // Determine request type based on session plan if not explicitly provided
    let finalRequestType: RequestType = requestType || "question";
    if (!requestType && sessionPlan) {
      const plan = sessionPlan as SessionPlan;
      const currentStep = plan.steps[plan.currentStepIndex];
      if (currentStep?.type) {
        finalRequestType = currentStep.type;
      }
    }

    return NextResponse.json({ 
      probe: result.probe,
      requestType: finalRequestType,
    });
  } catch (error) {
    console.error("Generate probe error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
