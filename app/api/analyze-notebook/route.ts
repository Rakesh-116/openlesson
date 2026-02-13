import { NextRequest, NextResponse } from "next/server";
import { analyzeNotebook } from "@/lib/openrouter";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content, problem } = body;

    if (!content) {
      return NextResponse.json({ error: "Missing content" }, { status: 400 });
    }
    if (!problem) {
      return NextResponse.json({ error: "Missing problem" }, { status: 400 });
    }

    const result = await analyzeNotebook({
      content,
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
    console.error("Analyze notebook error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
