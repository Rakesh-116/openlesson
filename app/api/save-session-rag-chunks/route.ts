import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId, chunkIds } = await req.json();

    if (!sessionId || !Array.isArray(chunkIds)) {
      return NextResponse.json({ error: "Missing sessionId or chunkIds" }, { status: 400 });
    }

    // Get the actual chunk contents
    const { data: chunks, error: chunksError } = await supabase
      .from("transcript_rag_chunks")
      .select("id, content")
      .in("id", chunkIds);

    if (chunksError) {
      return NextResponse.json({ error: "Failed to fetch chunks" }, { status: 500 });
    }

    // Store the RAG context in session metadata
    const ragContext = chunks?.map(c => c.content).join("\n\n---\n\n") || "";

    const { error: updateError } = await supabase
      .from("sessions")
      .update({ 
        metadata: { 
          rag_chunks: chunkIds,
          rag_context: ragContext 
        } 
      })
      .eq("id", sessionId)
      .eq("user_id", user.id);

    if (updateError) {
      return NextResponse.json({ error: "Failed to save RAG chunks" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Save session RAG chunks error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
