import { NextRequest, NextResponse } from "next/server";
import { analyzeGap } from "@/lib/openrouter";
import { getUserPrompts } from "@/lib/prompts";
import { getRecentAudioChunks, getRecentToolEvents, getRecentFacialData, getRecentEEGData, getRecentScreenshots } from "@/lib/storage";
import { createClient } from "@/lib/supabase/client";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const maxRetries = 2;
  
  const { sessionId, problem, openProbeCount, lastProbeTimestamp } = await request.json();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (!sessionId) {
        return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
      }
      if (!problem) {
        return NextResponse.json({ error: "Missing problem" }, { status: 400 });
      }

      // Fetch all data from the last 15 seconds
      const [audioChunks, toolEvents, facialData, eegData, screenshots] = await Promise.all([
        getRecentAudioChunks(sessionId, 15000),
        getRecentToolEvents(sessionId, 15000),
        getRecentFacialData(sessionId, 15000),
        getRecentEEGData(sessionId, 15000),
        getRecentScreenshots(sessionId, 15000),
      ]);

      // Build context description from fetched data
      let contextDescription = "Recent session activity:\n";
      
      if (audioChunks.length > 0) {
        contextDescription += `- ${audioChunks.length} audio chunk(s) recorded\n`;
      }
      
      if (toolEvents.length > 0) {
        const toolTypes = [...new Set(toolEvents.map(e => e.toolName))];
        contextDescription += `- Tools used: ${toolTypes.join(", ")}\n`;
      }
      
      if (facialData.length > 0) {
        contextDescription += `- ${facialData.length} facial data point(s)\n`;
      }
      
      if (eegData.length > 0) {
        contextDescription += `- ${eegData.length} EEG data chunk(s)\n`;
      }
      
      if (screenshots.length > 0) {
        contextDescription += `- ${screenshots.length} screenshot(s)\n`;
      }

      // If no audio, return default - can't do gap analysis without audio
      if (audioChunks.length === 0) {
        return NextResponse.json({
          gapScore: 0.5,
          signals: ["waiting_for_audio"],
          transcript: "",
        });
      }

      // Fetch and combine audio chunks
      const supabase = createClient();
      const audioBlobs: Blob[] = [];
      
      for (const chunk of audioChunks) {
        try {
          const { data } = await supabase.storage
            .from("session-audio")
            .download(chunk.storagePath);
          if (data) {
            audioBlobs.push(data);
          }
        } catch (e) {
          console.warn("[analyze-gap] Failed to fetch audio chunk:", chunk.storagePath, e);
        }
      }

      if (audioBlobs.length === 0) {
        return NextResponse.json({
          gapScore: 0.5,
          signals: ["audio_fetch_failed"],
          transcript: "",
        });
      }

      // Combine audio blobs (simplified - just use the most recent for now)
      // In production, you'd concatenate them properly
      const combinedBlob = audioBlobs[audioBlobs.length - 1];
      
      // Convert to base64
      const arrayBuffer = await combinedBlob.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");

      const promptOverrides = await getUserPrompts();

      const result = await analyzeGap({
        audioBase64: base64,
        audioFormat: "webm",
        problem,
        openProbeCount: openProbeCount ?? 0,
        lastProbeTimestamp: lastProbeTimestamp ?? 0,
        promptOverrides,
      });

      if (!result.success) {
        const isRetryableError = result.error?.includes("API error: 400");
        if (isRetryableError && attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
          continue;
        }
        return NextResponse.json({ error: result.error || "Analysis failed" }, { status: 500 });
      }

      const gapScore = result.result!.gap_score;

      return NextResponse.json({
        gapScore,
        signals: result.result!.signals,
        transcript: result.result!.transcript || "",
      });
    } catch (error) {
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
        continue;
      }
      console.error("Analyze gap error:", error);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  }
  
  return NextResponse.json({ error: "Max retries exceeded" }, { status: 500 });
}
