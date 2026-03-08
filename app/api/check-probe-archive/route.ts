import { NextRequest, NextResponse } from "next/server";
import { checkProbeArchivable } from "@/lib/openrouter";
import { getUserPrompts } from "@/lib/prompts";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      probeId,
      probeText, 
      sessionId,
      sessionGoal,
      transcript, 
      whiteboardData,
      codingData,
    } = body;

    if (!probeText) {
      return NextResponse.json(
        { error: "Missing probeText" },
        { status: 400 }
      );
    }

    // Get user for authentication
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get user prompt overrides
    const promptOverrides = await getUserPrompts();

    // Check if probe can be archived using LLM
    const result = await checkProbeArchivable({
      probeText,
      sessionGoal: sessionGoal || "General learning session",
      transcript,
      whiteboardData,
      codingData: codingData ? JSON.stringify(codingData) : undefined,
      promptOverrides,
    });

    if (!result.success || !result.result) {
      return NextResponse.json(
        { error: result.error || "Archive check failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      probeId,
      canArchive: result.result.canArchive,
      reason: result.result.reason,
    });
  } catch (error) {
    console.error("Check probe archive error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
