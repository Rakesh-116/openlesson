import { NextRequest, NextResponse } from "next/server";
import { analyzeWhiteboard } from "@/lib/openrouter";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageBase64, problem } = body;

    if (!imageBase64) {
      return NextResponse.json({ error: "Missing imageBase64" }, { status: 400 });
    }
    if (!problem) {
      return NextResponse.json({ error: "Missing problem" }, { status: 400 });
    }

    const result = await analyzeWhiteboard({
      imageBase64,
      problem,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Analysis failed" }, { status: 500 });
    }

    return NextResponse.json({
      shouldProbe: result.result!.should_probe,
      gapScore: result.result!.gap_score,
      signals: result.result!.signals,
      observation: result.result!.observation,
    });
  } catch (error) {
    console.error("Analyze whiteboard error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
