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
      activeProbes,
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
      getRecentTranscripts(sessionId, 180000),  // 3 minutes of transcripts for cumulative context
      getRecentToolEvents(sessionId, 60000),    // 1 minute of tool events
      getRecentFacialData(sessionId, 60000),
      getRecentEEGData(sessionId, 60000),
      getRecentScreenshots(sessionId, 60000),
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
    // Split into "recent" (last 30s) and "earlier" for context
    const now = Date.now();
    const recentCutoff = now - 30000; // last 30 seconds
    const recentTranscripts = transcripts.filter(t => t.timestamp >= recentCutoff);
    const earlierTranscripts = transcripts.filter(t => t.timestamp < recentCutoff);
    
    if (transcripts.length > 0) {
      if (earlierTranscripts.length > 0) {
        contextDescription += `- Earlier transcript context (${earlierTranscripts.length} chunks, for background):\n`;
        earlierTranscripts.forEach((t, i) => {
          contextDescription += `  ${i + 1}. [${new Date(t.timestamp).toLocaleTimeString()}] ${t.content.slice(0, 300)}${t.content.length > 300 ? '...' : ''}\n`;
        });
      }
      if (recentTranscripts.length > 0) {
        contextDescription += `- MOST RECENT speech (last 30s, ${recentTranscripts.length} chunks — focus gap analysis here):\n`;
        recentTranscripts.forEach((t, i) => {
          contextDescription += `  ${i + 1}. [${new Date(t.timestamp).toLocaleTimeString()}] ${t.content}\n`;
        });
      }
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

    // If no transcripts, just return waiting state (no nudges)
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
      activeProbes: activeProbes || [],
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

    const { planChanged, updatedSteps, currentStepIndex, nextRequest, probesToArchive, canGenerateProbe, reasoning, gapScore, signals, canAutoAdvance, advanceReasoning } = result.result;

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
      nextRequest,
      probesToArchive,
      canGenerateProbe,
      reasoning,
      gapScore: gapScore ?? 0.5,
      signals: signals || [],
      canAutoAdvance: canAutoAdvance ?? false,
      advanceReasoning: advanceReasoning ?? "",
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
