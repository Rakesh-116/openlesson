import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const maxDuration = 60;

type SupabaseServerClient = ReturnType<typeof createServerClient>;

async function transcribeChunk(supabase: SupabaseServerClient, storagePath: string, sessionId: string, chunkIndex: number, timestampMs: number, userId: string): Promise<string> {
  try {
    const { data: audioData } = await supabase.storage
      .from("session-audio")
      .download(storagePath);
    
    if (!audioData) {
      console.warn("[transcribe-chunks] Failed to download audio:", storagePath);
      return "";
    }
    
    const arrayBuffer = await audioData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    if (buffer.length < 1000) {
      return "";
    }
    
    const ext = storagePath.split(".").pop()?.toLowerCase() || "webm";
    const formatMap: Record<string, string> = {
      webm: "webm",
      mp4: "mp4",
      m4a: "mp4",
      mp3: "mpeg",
      wav: "wav",
      ogg: "ogg",
    };
    const audioFormat = formatMap[ext] || "webm";
    
    const base64 = buffer.toString("base64");
    
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
        "X-Title": "Socrates Transcription",
      },
      body: JSON.stringify({
        model: "anthropic/claude-3-haiku",
        messages: [
          {
            role: "system",
            content: "You are a transcriptionist. Transcribe the audio exactly as spoken. Return only the transcription, nothing else. If there's no speech, return exactly: [NO_SPEECH]"
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Transcribe this audio:" },
              { type: "input_audio", input_audio: { format: audioFormat, data: base64 } }
            ]
          }
        ],
        max_tokens: 4096,
      }),
    });
    
    if (!response.ok) {
      console.warn("[transcribe-chunks] Transcription API error:", response.status);
      return "";
    }
    
    const data = await response.json();
    let transcription = data.choices?.[0]?.message?.content?.trim() || "";
    
    const lowerTranscript = transcription.toLowerCase();
    const isNoSpeech = 
      transcription === "[NO_SPEECH]" ||
      lowerTranscript.includes("[no_speech]") ||
      lowerTranscript.includes("no speech") ||
      lowerTranscript.includes("no audio") ||
      lowerTranscript.includes("silent") ||
      transcription.length < 30;
    
    if (isNoSpeech) {
      transcription = "";
    }
    
    if (!transcription) {
      return "";
    }
    
    const wordCount = transcription.split(/\s+/).filter((w: string) => w.length > 0).length;
    
    const transcriptStoragePath = storagePath.replace("/session-audio/", "/session-transcript/").replace(/\.\w+$/, ".txt");
    
    try {
      await supabase.storage
        .from("session-transcript")
        .upload(transcriptStoragePath, transcription, {
          contentType: "text/plain",
          upsert: false,
        });
    } catch (e) {
      console.warn("Transcript upload failed (non-critical):", e);
    }
    
    try {
      await supabase
        .from("session_transcript")
        .insert({
          session_id: sessionId,
          user_id: userId,
          timestamp_ms: timestampMs,
          storage_path: transcriptStoragePath,
          chunk_index: chunkIndex,
          word_count: wordCount,
          metadata: { transcript_path: transcriptStoragePath },
        });
    } catch (e) {
      console.warn("session_transcript insert failed (non-critical):", e);
    }
    
    return transcription;
  } catch (e) {
    console.warn("[transcribe-chunks] Transcription failed:", e);
    return "";
  }
}

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() {},
        },
      }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cutoffTime = Date.now() - 15 * 60 * 1000; // 15 minutes
    
    const { data: audioChunks } = await supabase
      .from("session_audio")
      .select("id, session_id, timestamp_ms, storage_path, chunk_index")
      .eq("session_id", sessionId)
      .gte("timestamp_ms", cutoffTime)
      .order("timestamp_ms", { ascending: true });

    if (!audioChunks || audioChunks.length === 0) {
      console.log("[transcribe-chunks] No audio chunks found in the last 15 minutes");
      return NextResponse.json({ transcribed: 0 });
    }

    const chunkIndices = audioChunks.map((c: { chunk_index: number }) => c.chunk_index);
    const { data: existingTranscripts } = await supabase
      .from("session_transcript")
      .select("chunk_index")
      .eq("session_id", sessionId)
      .in("chunk_index", chunkIndices);

    const transcribedIndices = new Set((existingTranscripts || []).map((t: { chunk_index: number }) => t.chunk_index));

    let transcribedCount = 0;
    for (const chunk of audioChunks) {
      if (!transcribedIndices.has(chunk.chunk_index)) {
        console.log(`[transcribe-chunks] Transcribing chunk ${chunk.chunk_index}`);
        const transcript = await transcribeChunk(
          supabase, 
          chunk.storage_path, 
          chunk.session_id, 
          chunk.chunk_index, 
          chunk.timestamp_ms,
          user.id
        );
        if (transcript) {
          transcribedCount++;
        }
      }
    }

    return NextResponse.json({ transcribed: transcribedCount });
  } catch (error) {
    console.error("Transcribe chunks error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
