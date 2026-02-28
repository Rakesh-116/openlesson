import { NextRequest, NextResponse } from "next/server";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

const SYSTEM_PROMPT = `You are a helpful AI learning assistant. The user is working through a problem using the Socratic method with a tutor.

You are NOT the Socratic tutor - you are a separate AI assistant they can chat with for:
- Clarifying concepts
- Getting additional explanations
- Discussing the problem in a different way
- Getting help with specific parts they're stuck on

Guidelines:
- Be conversational and helpful
- If they ask about the Socratic questions, encourage them to engage with the tutor's questions
- Don't give away answers - help them think through it themselves
- Keep responses concise but thorough
- If they're struggling, suggest they might want to ask the tutor for help`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { problem, messages, model } = body;

    if (!problem) {
      return NextResponse.json({ error: "Missing problem" }, { status: 400 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API not configured" }, { status: 500 });
    }

    const conversationMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `The user is working on: ${problem}` },
      ...(messages || []),
    ];

    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "openLesson",
      },
      body: JSON.stringify({
        model: model || MODEL,
        messages: conversationMessages,
        max_tokens: 800,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Session chat API error:", response.status, errorText);
      return NextResponse.json({ error: `API error: ${response.status}` }, { status: 500 });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      return NextResponse.json({ error: "No response generated" }, { status: 500 });
    }

    return NextResponse.json({ message: content });
  } catch (error) {
    console.error("Session chat error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}