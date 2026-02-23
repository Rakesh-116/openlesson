import { NextRequest, NextResponse } from "next/server";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

export async function POST(req: NextRequest) {
  try {
    const { topic } = await req.json();

    if (!topic || typeof topic !== "string") {
      return NextResponse.json({ error: "Topic is required" }, { status: 400 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "AI service not configured" }, { status: 500 });
    }

    const prompt = `Generate preparation material for a Socratic tutoring session on the topic: "${topic}"

Create a comprehensive guide that includes:

## 1. Key Concepts to Review
- 3-5 important foundational concepts related to this topic
- Brief explanations of each (1-2 sentences)

## 2. External Resources
- 2-3 helpful external links (real, existing URLs to reputable sources like Wikipedia, Khan Academy, MIT OpenCourseWare, etc.)
- Include a one-sentence description of why each is useful

## 3. Mini Preparation Activity
- A small hands-on exercise, thought experiment, or practical application to try before the session
- Should take 5-15 minutes

## 4. What to Expect
- 1-2 sentences about what the Socratic session will focus on and what kind of questions you'll be asked

Format the response in clear markdown. Be concise but helpful. The goal is to help the learner feel prepared, not overwhelmed.`;

    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "Socrates",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter API error:", response.status, errorText);
      return NextResponse.json({ error: "Failed to generate material" }, { status: 500 });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json({ error: "No content generated" }, { status: 500 });
    }

    return NextResponse.json({ content });
  } catch (error) {
    console.error("Prepare session error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
