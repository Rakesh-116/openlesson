import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { transcribeAudio, generateEmbeddings } from "@/lib/openrouter";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes for long transcriptions

function splitIntoChunks(text: string, minWords: number = 200, maxWords: number = 400): string[] {
  if (!text || text.trim().length === 0) return [];

  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentWordCount = 0;

  for (const sentence of sentences) {
    const wordCount = sentence.split(/\s+/).filter(w => w.length > 0).length;
    
    if (currentWordCount + wordCount > maxWords && currentWordCount >= minWords) {
      chunks.push(currentChunk.join(" "));
      currentChunk = [sentence];
      currentWordCount = wordCount;
    } else {
      currentChunk.push(sentence);
      currentWordCount += wordCount;
    }
  }

  if (currentChunk.length > 0 && currentWordCount >= minWords / 2) {
    chunks.push(currentChunk.join(" "));
  }

  return chunks;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { sessionId, audioBase64, audioFormat } = await request.json();

    if (!sessionId || !audioBase64 || !audioFormat) {
      return NextResponse.json(
        { error: "Missing sessionId, audioBase64, or audioFormat" },
        { status: 400 }
      );
    }

    // Get session to verify ownership and get problem
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("id, user_id, problem, audio_path, has_transcript")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Check if already processed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((session as any).has_transcript) {
      return NextResponse.json({ 
        message: "Session already transcribed",
        chunkCount: 0 
      });
    }

    console.log("[process-session-transcript] Starting transcription for session:", sessionId);

    // Transcribe audio using OpenRouter (Gemini multimodal)
    const transcriptResult = await transcribeAudio({
      audioBase64,
      audioFormat,
      problem: session.problem,
    });

    if (!transcriptResult.success || !transcriptResult.transcript) {
      console.error("[process-session-transcript] Transcription failed:", transcriptResult.error);
      return NextResponse.json(
        { error: `Transcription failed: ${transcriptResult.error}` },
        { status: 500 }
      );
    }

    console.log("[process-session-transcript] Transcription complete, length:", transcriptResult.transcript.length);
    console.log("[process-session-transcript] Transcript text:", transcriptResult.transcript.substring(0, 500));

    // Split into chunks
    const chunks = splitIntoChunks(transcriptResult.transcript, 200, 400);
    console.log("[process-session-transcript] Chunks created:", chunks.length);
    console.log("[process-session-transcript] First chunk:", chunks[0]?.substring(0, 200) || "empty");

    // Generate embeddings for all chunks in batch
    const embeddingResult = await generateEmbeddings(chunks);
    console.log("[process-session-transcript] Embedding result:", embeddingResult.success ? "success" : "failed", embeddingResult.error);
    
    if (!embeddingResult.success || !embeddingResult.embedding) {
      // Store chunks without embeddings if embedding fails
      console.warn("[process-session-transcript] Embedding failed, storing without embeddings");
      
      for (let i = 0; i < chunks.length; i++) {
        const submittedAt = new Date().toISOString();
        console.log("[process-session-transcript] Inserting chunk", i, "submitted_at:", submittedAt);
        const { error: chunkError } = await supabase.from("transcript_rag_chunks").insert({
          session_id: sessionId,
          user_id: user.id,
          chunk_index: i,
          content: chunks[i],
          metadata: { source: "session" },
          submitted_at: submittedAt,
        });
        if (chunkError) {
          console.error("[process-session-transcript] Chunk insert error:", chunkError.code, chunkError.message);
        } else {
          console.log("[process-session-transcript] Chunk", i, "inserted OK");
        }
      }
    } else {
      // Store chunks with embeddings
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const embeddings = embeddingResult.embedding as number[][];
      
      for (let i = 0; i < chunks.length; i++) {
        const submittedAt = new Date().toISOString();
        console.log("[process-session-transcript] Inserting chunk with embedding", i, "submitted_at:", submittedAt);
        const { error: chunkError } = await supabase.from("transcript_rag_chunks").insert({
          session_id: sessionId,
          user_id: user.id,
          chunk_index: i,
          content: chunks[i],
          metadata: { source: "session" },
          embedding: embeddings[i] || [],
          submitted_at: submittedAt,
        });
        if (chunkError) {
          console.error("[process-session-transcript] Chunk insert error:", chunkError.code, chunkError.message);
        } else {
          console.log("[process-session-transcript] Chunk", i, "inserted OK");
        }
      }
    }

    // Mark session as having transcript
    await supabase
      .from("sessions")
      .update({ has_transcript: true })
      .eq("id", sessionId);

    console.log("[process-session-transcript] Complete, chunks:", chunks.length);

    return NextResponse.json({
      success: true,
      chunkCount: chunks.length,
      transcriptLength: transcriptResult.transcript.length,
    });
  } catch (error) {
    console.error("[process-session-transcript] Error:", error);
    
    // Mark as error if we have a sessionId
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
