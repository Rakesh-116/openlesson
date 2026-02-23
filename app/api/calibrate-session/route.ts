import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserCalibration, retrieveRelevantChunks } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { problem, sessionId } = await request.json();

    if (!problem) {
      return NextResponse.json({ error: "Missing problem" }, { status: 400 });
    }

    console.log("[calibrate-session] Getting calibration for user:", user.id, "problem:", problem);

    // Get user's calibration data (pass server client to bypass RLS)
    const calibration = await getUserCalibration(user.id, supabase);

    // Retrieve relevant chunks from past sessions (pass server client to bypass RLS)
    const relevantChunks = await retrieveRelevantChunks(user.id, problem, {
      limit: 3,
      sessionId,
      supabaseClient: supabase,
    });

    // Generate calibration context string
    let calibrationContext = "";
    let gapThreshold = 0.5; // default
    let probeFrequency: "rare" | "balanced" | "frequent" = "balanced";

    if (calibration.sessionCount > 0) {
      // Build context based on user's history
      const trendEmoji = calibration.trend === "improving" ? "📈" : 
                         calibration.trend === "declining" ? "📉" : "➡️";
      
      calibrationContext = `User Session History (${calibration.sessionCount} sessions):
- Current trend: ${calibration.trend} ${trendEmoji}
- Average gap score: ${calibration.avgGapScore}
- Recent topics: ${calibration.recentTopics.slice(0, 3).join(", ") || "None"}
- Common gaps: ${calibration.commonGaps.slice(0, 3).join(", ") || "None"}

`;

      // Adjust thresholds based on trend
      if (calibration.trend === "improving") {
        // User is getting better - make tutor more challenging
        gapThreshold = 0.4; // Lower threshold = more probes = more challenging
        probeFrequency = "frequent";
      } else if (calibration.trend === "declining") {
        // User needs more support
        gapThreshold = 0.7; // Higher threshold = fewer probes = less overwhelming
        probeFrequency = "rare";
      } else {
        gapThreshold = 0.5;
        probeFrequency = "balanced";
      }
    }

    // Add RAG context if available
    if (relevantChunks.length > 0) {
      calibrationContext += `\nRelevant Past Thinking Patterns:\n`;
      for (const chunk of relevantChunks) {
        calibrationContext += `\n- ${chunk.content.slice(0, 200)}...\n`;
      }
    }

    console.log("[calibrate-session] Calibration complete:", {
      sessionCount: calibration.sessionCount,
      trend: calibration.trend,
      gapThreshold,
      probeFrequency,
      relevantChunks: relevantChunks.length,
    });

    // Get session topics for each chunk
    const sessionIds = [...new Set(relevantChunks.map(c => c.sessionId).filter(Boolean))];
    const { data: sessions } = await supabase
      .from("sessions")
      .select("id, problem")
      .in("id", sessionIds);
    
    const sessionMap = new Map((sessions || []).map(s => [s.id, s.problem]));

    return NextResponse.json({
      calibrationContext: calibrationContext.trim(),
      gapThreshold,
      probeFrequency,
      userTrend: calibration.trend,
      sessionCount: calibration.sessionCount,
      relevantChunkCount: relevantChunks.length,
      chunks: relevantChunks.map(chunk => ({
        id: chunk.id,
        content: chunk.content,
        similarity: chunk.metadata?.similarity || 0,
        createdAt: chunk.createdAt,
        topic: chunk.sessionId ? sessionMap.get(chunk.sessionId) : null,
      })),
    });
  } catch (error) {
    console.error("[calibrate-session] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
