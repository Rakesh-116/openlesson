import { NextRequest, NextResponse } from "next/server";
import { analyzeGap } from "@/lib/openrouter";
import { getUserPrompts } from "@/lib/prompts";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const maxRetries = 2;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const body = await request.json();
      const { audioBase64, audioFormat, problem } = body;

      if (!audioBase64) {
        return NextResponse.json({ error: "Missing audioBase64" }, { status: 400 });
      }
      if (!problem) {
        return NextResponse.json({ error: "Missing problem" }, { status: 400 });
      }

      const promptOverrides = await getUserPrompts();

      const result = await analyzeGap({
        audioBase64,
        audioFormat: audioFormat || "webm",
        problem,
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

      return NextResponse.json({
        gapScore: result.result!.gap_score,
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
