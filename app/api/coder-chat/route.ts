import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callOpenRouterText, systemMessage, userMessage, RECOMMENDED_TEMPS } from "@/lib/openrouter-client";

export const runtime = "nodejs";

const DEFAULT_CODER_MODEL = "x-ai/grok-4";

const SYSTEM_PROMPT = `You are a JavaScript coding assistant in openLesson, an Integrated Learning Environment.

The user is in a learning session and has access to a JavaScript sandbox that can execute code in their browser.

YOUR ROLE:
- Help the user write, understand, and debug JavaScript code
- Provide clear, working code examples
- Explain concepts when asked
- Keep code simple and educational

GUIDELINES:
- When providing code, always use markdown code blocks with \`\`\`javascript
- Prefer console.log() for output since the sandbox captures console output
- Keep code examples concise and focused
- If the code relates to the learning topic, try to make it educational
- Support async/await since the sandbox supports it
- No DOM manipulation (sandbox is console-only)
- No fetch/network requests (sandbox is isolated)

AVAILABLE IN SANDBOX:
- All standard JavaScript (ES2020+)
- console.log(), console.warn(), console.error()
- JSON, Math, Date, Array methods, etc.
- async/await support
- 5 second execution timeout`;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { problem, code, messages } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Missing messages array" }, { status: 400 });
    }

    // Get user's preferred coder model from profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("metadata")
      .eq("id", user.id)
      .single();

    const coderModel = profile?.metadata?.coder_model || DEFAULT_CODER_MODEL;

    // Build context message
    let contextMessage = "";
    if (problem) {
      contextMessage += `The user is working on a learning session about: "${problem}"\n\n`;
    }
    if (code) {
      contextMessage += `Current code in the editor:\n\`\`\`javascript\n${code}\n\`\`\``;
    }

    const conversationMessages = [
      systemMessage(SYSTEM_PROMPT),
      ...(contextMessage ? [userMessage(contextMessage)] : []),
      ...messages.map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];

    const response = await callOpenRouterText(
      conversationMessages,
      {
        model: coderModel,
        maxTokens: 2000,
        temperature: RECOMMENDED_TEMPS.chat,
      }
    );

    if (!response.success || !response.data) {
      console.error("Coder chat API error:", response.error);
      return NextResponse.json({ error: `API error: ${response.error}` }, { status: 500 });
    }

    return NextResponse.json({ message: response.data, model: coderModel });
  } catch (error) {
    console.error("Coder chat error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
