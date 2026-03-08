import { NextRequest, NextResponse } from "next/server";
import { callOpenRouterText, userMessage, DEFAULT_MODEL } from "@/lib/openrouter-client";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const topic = searchParams.get("topic");
    const type = searchParams.get("type");

    if (!topic) {
      return NextResponse.json({ error: "Topic is required" }, { status: 400 });
    }

    let prompt = "";
    let title = "";

    switch (type) {
      case "reading":
        title = "Theory";
        prompt = `Generate 2-3 brief reading materials (key concepts, definitions, or explanations) for a tutoring session on the topic: "${topic}"

Format as a concise, scannable list. Each item should be 1-3 sentences max. Use bullet points.
Focus on foundational concepts the student should understand before the session.
Keep it minimal - this is just prep material, not a full lesson.`;
        break;
      case "exercise":
        title = "Practice";
        prompt = `Generate a brief exercise or task (5-15 minutes) for a student to complete before a tutoring session on: "${topic}"

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

    const response = await callOpenRouterText(
      [userMessage(prompt)],
      {
        model: DEFAULT_MODEL,
        maxTokens: 800,
        temperature: 0.6,
      }
    );

    if (!response.success || !response.data) {
      console.error("OpenRouter API error:", response.error);
      return NextResponse.json({ error: "Failed to generate material" }, { status: 500 });
    }

    return NextResponse.json({ title, content: response.data });
  } catch (error) {
    console.error("Prep material error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
