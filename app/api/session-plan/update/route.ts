import { NextRequest, NextResponse } from "next/server";
import { updateSessionPlanLLM } from "@/lib/openrouter";
import { getSessionPlan, updateSessionPlan, validatePlanSteps, type SessionPlanStep, getRecentTranscripts, getRecentToolEvents, getRecentFacialData, getRecentEEGData, getRecentScreenshots } from "@/lib/storage";
import { getUserPrompts } from "@/lib/prompts";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      sessionId, 
      previousProbes,
      focusedProbes,
      openProbeCount,
      lastProbeTimestamp,
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

    // Fetch plan and prompt overrides in parallel
    const [currentPlan, promptOverrides, transcripts, toolEvents, facialData, eegData, screenshots] = await Promise.all([
      getSessionPlan(sessionId, supabase),
      getUserPrompts(supabase, user.id),
      getRecentTranscripts(sessionId, 15000),
      getRecentToolEvents(sessionId, 15000),
      getRecentFacialData(sessionId, 15000),
      getRecentEEGData(sessionId, 15000),
      getRecentScreenshots(sessionId, 15000),
    ]);
    
    if (!currentPlan) {
      return NextResponse.json(
        { error: "No plan found for this session" },
        { status: 404 }
      );
    }

    // Build context description from fetched sensor data
    let contextDescription = "Recent session activity:\n";
    
    // Transcript - most important for gap analysis
    if (transcripts.length > 0) {
      contextDescription += `- Recent transcripts (${transcripts.length} chunks):\n`;
      transcripts.forEach((t, i) => {
        contextDescription += `  ${i + 1}. [${new Date(t.timestamp).toLocaleTimeString()}] ${t.content.slice(0, 200)}${t.content.length > 200 ? '...' : ''}\n`;
      });
    }
    
    if (toolEvents.length > 0) {
      const toolTypes = [...new Set(toolEvents.map(e => e.toolName))];
      contextDescription += `- Tools used: ${toolTypes.join(", ")}\n`;
    }
    
    if (facialData.length > 0) {
      contextDescription += `- ${facialData.length} facial data point(s) recorded\n`;
    }
    
    if (eegData.length > 0) {
      contextDescription += `- ${eegData.length} EEG data chunk(s) recorded\n`;
    }
    
    if (screenshots.length > 0) {
      contextDescription += `- ${screenshots.length} screenshot(s) available for analysis\n`;
    }

    // If no transcripts, return default - can't do gap analysis without speech
    if (transcripts.length === 0) {
      return NextResponse.json({
        plan: currentPlan,
        gapScore: 0.5,
        signals: ["waiting_for_audio"],
        transcript: "",
        planChanged: false,
        nextRequest: null,
        probesToArchive: [],
        canGenerateProbe: true,
        reasoning: "No audio transcripts available yet",
      });
    }

    // Combine transcripts into single context
    const transcriptText = transcripts.map(t => t.content).join("\n\n");

    // Update the plan using LLM with full sensor data
    const result = await updateSessionPlanLLM({
      goal: currentPlan.goal,
      strategy: currentPlan.strategy,
      steps: currentPlan.steps,
      currentStepIndex: currentPlan.currentStepIndex,
      contextDescription,
      transcript: transcriptText,
      previousProbes: previousProbes || [],
      focusedProbes: focusedProbes || [],
      openProbeCount: openProbeCount ?? 0,
      lastProbeTimestamp: lastProbeTimestamp ?? 0,
      promptOverrides,
    });

    if (!result.success || !result.result) {
      return NextResponse.json(
        { error: result.error || "Plan update failed" },
        { status: 500 }
      );
    }

    const { planChanged, shouldPause, pauseReason, updatedSteps, currentStepIndex, nextRequest, probesToArchive, canGenerateProbe, reasoning, gapScore, signals } = result.result;

    // Update plan in database if it changed
    let updatedPlan = currentPlan;
    if (planChanged && updatedSteps) {
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

      try {
        validatePlanSteps(normalizedSteps);
        updatedPlan = await updateSessionPlan(currentPlan.id, {
          steps: normalizedSteps,
          currentStepIndex,
        }, supabase);
      } catch (validationError) {
        console.warn('[Plan Update] LLM returned invalid steps, falling back to current steps with status updates:', validationError);
        const fallbackSteps: SessionPlanStep[] = currentPlan.steps.map((step, idx) => ({
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
          steps: fallbackSteps,
          currentStepIndex,
        }, supabase);
      }
    } else if (currentStepIndex !== currentPlan.currentStepIndex) {
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
      probesToArchive,
      canGenerateProbe,
      reasoning,
      gapScore: gapScore ?? 0.5,
      signals: signals || [],
      transcript: transcriptText.slice(0, 1000),
    });
  } catch (error) {
    console.error("Update session plan error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
