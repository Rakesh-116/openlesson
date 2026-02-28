import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { retrieveRelevantChunks } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query");
    const sessionId = searchParams.get("sessionId");

    if (!query) {
      return NextResponse.json({ error: "Missing query" }, { status: 400 });
    }

    console.log("[rag-match] Getting matches for user:", user.id, "query:", query);

    // Retrieve relevant chunks from past sessions
    const chunks = await retrieveRelevantChunks(user.id, query, {
      limit: 3,
      sessionId: sessionId || undefined,
      supabaseClient: supabase,
    });

    console.log("[rag-match] Retrieved chunks:", chunks.length);

    // Get session topics for each chunk
    const sessionIds = [...new Set(chunks.map(c => c.sessionId).filter(Boolean))];
    const { data: sessions } = await supabase
      .from("sessions")
      .select("id, problem")
      .in("id", sessionIds);
    
    const sessionMap = new Map((sessions || []).map(s => [s.id, s.problem]));

    return NextResponse.json({
      chunks: chunks.map(chunk => ({
        id: chunk.id,
        content: chunk.content,
        sessionId: chunk.sessionId,
        createdAt: chunk.createdAt,
        similarity: chunk.metadata?.similarity || 0,
        topic: chunk.sessionId ? sessionMap.get(chunk.sessionId) : null,
      })),
    });
  } catch (error) {
    console.error("[rag-match] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}