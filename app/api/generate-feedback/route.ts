import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { callOpenRouterText, systemMessage, userMessage, DEFAULT_MODEL } from "@/lib/openrouter-client";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const { sessionId, problem } = await request.json();
    console.log("[generate-feedback] Request:", { sessionId, problem });

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    // First check transcript_rag_chunks table (where processed transcripts with embeddings are stored)
    console.log("[generate-feedback] Checking transcript_rag_chunks table for session:", sessionId);
    const { data: transcriptChunks, error: chunksError } = await supabase
      .from("transcript_rag_chunks")
      .select("id, content, chunk_index")
      .eq("session_id", sessionId)
      .order("chunk_index", { ascending: true });

    console.log("[generate-feedback] transcript_rag_chunks:", transcriptChunks?.length || 0, "chunks");

    let transcripts: string[] = [];
    
    if (transcriptChunks && transcriptChunks.length > 0) {
      // Use the already-processed chunks from DB
      transcripts = transcriptChunks.map(c => c.content);
      console.log("[generate-feedback] Using", transcripts.length, "transcript chunks from DB");
    } else {
      // Fallback: try session_transcript for storage paths (individual chunk transcripts)
      console.log("[generate-feedback] No chunks in DB, checking session_transcript for storage paths");
      const { data: transcriptRecords, error: transcriptError } = await supabase
        .from("session_transcript")
        .select("id, storage_path, timestamp_ms")
        .eq("session_id", sessionId)
        .order("timestamp_ms", { ascending: true })
        .limit(20);

      if (transcriptError) {
        console.error("[generate-feedback] Error fetching transcript records:", transcriptError);
      } else {
        console.log("[generate-feedback] Found", transcriptRecords?.length || 0, "transcript records");
        
        for (const record of transcriptRecords || []) {
          if (record.storage_path) {
            try {
              console.log("[generate-feedback] Downloading:", record.storage_path);
              const { data: fileData, error: downloadError } = await supabase.storage
                .from("session-transcript")
                .download(record.storage_path);
              
              if (downloadError) {
                console.warn("[generate-feedback] Download error:", downloadError);
                continue;
              }
              
              if (fileData) {
                const text = await fileData.text();
                console.log("[generate-feedback] Got transcript, length:", text.length);
                transcripts.push(text);
              }
            } catch (e) {
              console.warn("[generate-feedback] Failed to download:", record.storage_path, e);
            }
          }
        }
      }
    }

    if (transcripts.length === 0) {
      console.log("[generate-feedback] No transcripts found - returning debug info");
      
      // Final check - list all tables
      const { data: allSessionTranscripts } = await supabase
        .from("session_transcript")
        .select("id")
        .eq("session_id", sessionId);
      
      const { data: allChunks } = await supabase
        .from("transcript_rag_chunks")
        .select("id")
        .eq("session_id", sessionId);
        
      return NextResponse.json({ 
        feedback: null,
        debug: {
          reason: "No transcripts found in transcript_rag_chunks or session_transcript",
          sessionTranscriptCount: allSessionTranscripts?.length || 0,
          transcriptChunksCount: allChunks?.length || 0
        }
      });
    }

    const combinedTranscript = transcripts.reverse().join("\n\n");
    console.log("[generate-feedback] Combined length:", combinedTranscript.length);

    // Call LLM using shared client
    const response = await callOpenRouterText(
      [
        systemMessage("You are an AI learning assistant. Based on the student's speech, give brief feedback (1-2 sentences)."),
        userMessage(`Problem: ${problem}\n\nTranscripts:\n${combinedTranscript}`)
      ],
      {
        model: DEFAULT_MODEL,
        maxTokens: 200,
        temperature: 0.6,
      }
    );

    console.log("[generate-feedback] LLM success:", response.success);
    
    if (!response.success || !response.data) {
      console.error("[generate-feedback] LLM error:", response.error);
      return NextResponse.json({ 
        feedback: null,
        debug: { reason: "LLM call failed", error: response.error }
      });
    }

    const feedback = response.data;
    console.log("[generate-feedback] Feedback:", feedback);

    if (!feedback || feedback.length < 10) {
      return NextResponse.json({ feedback: null });
    }

    return NextResponse.json({ feedback });
  } catch (err) {
    console.error("[generate-feedback] Error:", err);
    return NextResponse.json({ feedback: null });
  }
}
