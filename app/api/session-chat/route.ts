import { NextRequest, NextResponse } from "next/server";
import { callOpenRouterText, systemMessage, userMessage, DEFAULT_MODEL, RECOMMENDED_TEMPS } from "@/lib/openrouter-client";

const SYSTEM_PROMPT = `You are a learning assistant in openLesson.

The user is in a live session thinking out loud about a topic. A separate AI tutor asks probing questions to find reasoning gaps.

You are NOT the tutor. You're a quick-reference companion they can chat with anytime.

Rules:
- Reply in 1-3 short paragraphs. Max 80 words unless they explicitly ask for a detailed explanation.
- Use bullet points when listing multiple ideas.
- Don't give away answers. Ask a guiding question instead.
- If they ask about the tutor's probes, encourage them to engage with those directly.
- Be direct and clear. No filler.`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { problem, messages, model } = body;

    if (!problem) {
      return NextResponse.json({ error: "Missing problem" }, { status: 400 });
    }

    const conversationMessages = [
      systemMessage(SYSTEM_PROMPT),
      userMessage(`The user is working on: ${problem}`),
      ...(messages || []).map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];

    const response = await callOpenRouterText(
      conversationMessages,
      {
        model: model || DEFAULT_MODEL,
        maxTokens: 400,
        temperature: RECOMMENDED_TEMPS.chat,
      }
    );

    if (!response.success || !response.data) {
      console.error("Session chat API error:", response.error);
      return NextResponse.json({ error: `API error: ${response.error}` }, { status: 500 });
    }

    return NextResponse.json({ message: response.data });
  } catch (error) {
    console.error("Session chat error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
