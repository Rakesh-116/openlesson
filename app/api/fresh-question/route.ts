import { NextRequest, NextResponse } from "next/server";
import { freshQuestion } from "@/lib/openrouter";
import { getUserPrompts } from "@/lib/prompts";

export const runtime = "nodejs";
export const maxDuration = 20;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { problem, previousProbes } = body;

    if (!problem) {
      return NextResponse.json({ error: "Missing problem" }, { status: 400 });
    }

    const promptOverrides = await getUserPrompts();
    const result = await freshQuestion(problem, previousProbes || [], promptOverrides);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Fresh question generation failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({ question: result.question });
  } catch (error) {
    console.error("Fresh question error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}