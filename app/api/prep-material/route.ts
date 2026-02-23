import { NextRequest, NextResponse } from "next/server";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const topic = searchParams.get("topic");
    const type = searchParams.get("type");

    if (!topic) {
      return NextResponse.json({ error: "Topic is required" }, { status: 400 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "AI service not configured" }, { status: 500 });
    }

    let prompt = "";
    let title = "";

    switch (type) {
      case "reading":
        title = "Pre-Session Reading";
        prompt = `Generate 2-3 brief reading materials (key concepts, definitions, or explanations) for a Socratic tutoring session on the topic: "${topic}"

Format as a concise, scannable list. Each item should be 1-3 sentences max. Use bullet points.
Focus on foundational concepts the student should understand before the session.
Keep it minimal - this is just prep material, not a full lesson.`;
        break;
      case "exercise":
        title = "Pre-Session Exercise";
        prompt = `Generate a brief exercise or task (5-15 minutes) for a student to complete before a Socratic tutoring session on: "${topic}"

Format as a single, clear activity with 2-3 sub-steps if needed.
Keep it practical and thought-provoking. The exercise should help them think about the topic before the session.
Do NOT include any solutions or answers - this is for them to discover during the session.`;
        break;
      case "resources":
        title = "Helpful Resources";
        prompt = `Generate 2-3 helpful external resources (links) for learning about: "${topic}"

Format as a list with just the resource name and URL.
Only include real, reputable sources (Wikipedia, Khan Academy, MIT OpenCourseWare, official documentation, etc.).
Include a very brief (5 words max) description of why each is useful.`;
        break;
      default:
        return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "openLesson",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 800,
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

    return NextResponse.json({ title, content });
  } catch (error) {
    console.error("Prep material error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
