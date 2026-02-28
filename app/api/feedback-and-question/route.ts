import { NextRequest, NextResponse } from "next/server";
import { feedbackAndQuestion } from "@/lib/openrouter";
import { getUserPrompts } from "@/lib/prompts";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { problem, previousProbes, recentContext } = body;

    if (!problem) {
      return NextResponse.json({ error: "Missing problem" }, { status: 400 });
    }

    const promptOverrides = await getUserPrompts();
    const result = await feedbackAndQuestion({
      problem,
      previousProbes: previousProbes || [],
      recentContext,
      promptOverrides,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Feedback generation failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      feedback: result.feedback,
      question: result.question,
    });
  } catch (error) {
    console.error("Feedback and question error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}