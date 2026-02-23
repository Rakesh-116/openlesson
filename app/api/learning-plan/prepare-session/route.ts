import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const EMBEDDING_URL = "https://openrouter.ai/api/v1/embeddings";
const MODEL = "google/gemini-2.5-flash";
const EMBEDDING_MODEL = "google/gemini-embedding-001";

async function generateEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch(EMBEDDING_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: text,
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.data?.[0]?.embedding || null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { topic, planNodeId } = await req.json();

    if (!topic || typeof topic !== "string") {
      return NextResponse.json({ error: "Topic is required" }, { status: 400 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "AI service not configured" }, { status: 500 });
    }

    // RAG: Search for relevant transcript chunks
    let relevantChunks: Array<{
      id: string;
      content: string;
      session_id: string | null;
      created_at: string;
    }> = [];

    const embedding = await generateEmbedding(topic);
    if (embedding) {
      const { data: chunks, error } = await supabase.rpc("match_transcript_chunks", {
        query_embedding: embedding,
        match_user_id: user.id,
        match_session_id: planNodeId || null,
        match_limit: 3,
      });

      if (!error && chunks) {
        relevantChunks = chunks.map((c: { id: string; content: string; session_id: string | null; created_at: string }) => ({
          id: c.id,
          content: c.content,
          session_id: c.session_id,
          created_at: c.created_at,
        }));
      }
    }

    const prompt = `Generate preparation material for a Socratic tutoring session on the topic: "${topic}"

${relevantChunks.length > 0 ? `## Relevant Past Sessions Context
The student has previously worked on related topics. Here are relevant excerpts from their past sessions:
${relevantChunks.map((c, i) => `${i + 1}. "${c.content.slice(0, 300)}..."`).join("\n")}

Use this context to tailor the preparation to what the student has already explored.` : ""}

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
        "X-Title": "openLesson",
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

    return NextResponse.json({
      content,
      relevantChunks: relevantChunks.map(c => ({
        id: c.id,
        preview: c.content.slice(0, 150) + (c.content.length > 150 ? "..." : ""),
        sessionId: c.session_id,
      })),
    });
  } catch (error) {
    console.error("Prepare session error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
