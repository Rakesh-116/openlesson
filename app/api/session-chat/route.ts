import { NextRequest, NextResponse } from "next/server";
import { callOpenRouterText, systemMessage, userMessage, DEFAULT_MODEL, RECOMMENDED_TEMPS } from "@/lib/openrouter-client";

const SYSTEM_PROMPT = `You are a helpful AI learning assistant in openLesson, an Integrated Learning Environment (ILE).

CONTEXT:
- The user is engaged in a live learning session where they think out loud about a topic
- The tutor (separate AI) asks probing questions to identify reasoning gaps in the user's thinking
- These "probes" are designed to expose misconceptions and deepen understanding
- The session captures audio, EEG (brainwave), and video data to analyze learning patterns

YOUR ROLE:
You are NOT the tutor - you are a separate AI assistant the user can chat with anytime. You're their learning companion throughout the session.

You should:
- Clarify concepts and explain things in different ways when asked
- Help break down complex parts of the topic
- Discuss the problem from alternative perspectives
- Encourage and support their learning journey
- Be conversational, friendly, and encouraging

Guidelines:
- Don't give away answers - help them think through it
- If they ask about the tutor's questions/probes, encourage them to engage with those
- Keep responses concise but thorough
- If they're stuck, suggest they might want to ask the tutor for a hint or try the "Need Help" button`;

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
        maxTokens: 800,
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
