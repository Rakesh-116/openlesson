import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const maxDuration = 60;

const HESITATION_MARKERS = ["um", "uh", "hmm", "huh", "er", "ah", "like,", "you know"];
const SELF_CORRECTION_MARKERS = ["actually", "no wait", "let me rethink", "scratch that", "I mean", "correction", "wait no"];
const QUESTION_MARKERS = ["?", "why", "how", "what if", "could it be", "I wonder"];

async function getAudioFromSupabase(supabase: ReturnType<typeof createServerClient>, storagePath: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const { data, error } = await supabase.storage.from("session-audio").download(storagePath);
  
  if (error || !data) {
    console.error("[transcribe-chunk] Failed to download audio from Supabase:", error);
    return null;
  }
  
  const arrayBuffer = await data.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  // Determine mime type from extension
  const ext = storagePath.split(".").pop()?.toLowerCase() || "webm";
  const mimeMap: Record<string, string> = {
    webm: "audio/webm",
    mp4: "audio/mp4",
    m4a: "audio/mp4",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
  };
  const mimeType = mimeMap[ext] || "audio/webm";
  
  return { buffer, mimeType };
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const storagePath = formData.get("storage_path") as string | null;
    const audioFile = formData.get("audio") as File | null;
    const sessionId = formData.get("session_id") as string | null;
    const chunkIndex = formData.get("chunk_index") as string | null;
    const timestampMs = formData.get("timestamp_ms") as string | null;

    // Validate required fields
    if (!sessionId) {
      return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
    }
    if (!chunkIndex || isNaN(parseInt(chunkIndex))) {
      return NextResponse.json({ error: "Missing or invalid chunk_index" }, { status: 400 });
    }
    if (!timestampMs || isNaN(parseInt(timestampMs))) {
      return NextResponse.json({ error: "Missing or invalid timestamp_ms" }, { status: 400 });
    }

    const parsedChunkIndex = parseInt(chunkIndex);
    const parsedTimestampMs = parseInt(timestampMs);

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() {},
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let buffer: Buffer;
    let mimeType: string;
    let fileName = "unknown";

    // Two modes: new (storage_path) or legacy (audio file)
    if (storagePath) {
      // NEW MODE: Fetch audio from Supabase Storage (metadata-only, no double-upload)
      console.log("[transcribe-chunk] New mode: fetching audio from Supabase:", storagePath);
      const audioData = await getAudioFromSupabase(supabase, storagePath);
      
      if (!audioData) {
        return NextResponse.json({ error: "Failed to fetch audio from storage" }, { status: 400 });
      }
      
      buffer = audioData.buffer;
      mimeType = audioData.mimeType;
      fileName = storagePath.split("/").pop() || "audio.webm";
      
      console.log("[transcribe-chunk] Fetched audio from storage:", { size: buffer.length, mimeType });
      
    } else if (audioFile) {
      // LEGACY MODE: Receive audio file directly (backward compatibility)
      const allowedTypes = ["audio/webm", "audio/mp4", "audio/mpeg", "audio/wav", "audio/ogg", "audio/mp3"];
      const isAllowed = allowedTypes.some(type => 
        audioFile.type === type || audioFile.type.startsWith(type + ";")
      );
      if (!isAllowed) {
        console.log("[transcribe-chunk] Invalid audio format:", audioFile.type, "file:", audioFile.name);
        return NextResponse.json({ error: "Invalid audio format" }, { status: 400 });
      }

      const arrayBuffer = await audioFile.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      mimeType = audioFile.type.split(";")[0].trim() || "audio/webm";
      fileName = audioFile.name;
    } else {
      return NextResponse.json({ error: "Missing either storage_path or audio file" }, { status: 400 });
    }

    if (buffer.length < 1000) {
      console.log("[transcribe-chunk] Audio too small, skipping transcription:", buffer.length);
      return NextResponse.json({
        success: true,
        chunkIndex: parsedChunkIndex,
        transcript: "",
        wordCount: 0,
      });
    }

    // Determine audio format for OpenRouter
    let ext = mimeType.split("/")[1] || "webm";
    const formatMap: Record<string, string> = {
      webm: "wav",
      mp4: "m4a",
      mp3: "mp3",
      ogg: "ogg",
      wav: "wav",
    };
    const audioFormat = formatMap[ext] || "wav";
    const audioBase64 = buffer.toString("base64");

    console.log("[transcribe-chunk] Audio info:", { mimeType, ext, bufferSize: buffer.length });

    // Audio transcription always goes through OpenRouter (Google Gemini model)
    const { getChatUrl, getChatHeaders, getProviderForModel } = await import("@/lib/ai-provider");
    const audioModel = "google/gemini-2.5-flash"; // Must use audio-capable model
    const audioProvider = getProviderForModel(audioModel); // Always resolves to "openrouter"

    const prompt = "Transcribe this audio. Output ONLY the transcript text, nothing else. Include filler words like um, uh. If the audio is silent, empty, or contains no speech, respond with exactly: [NO_SPEECH]";

    console.log("[transcribe-chunk] Calling transcription API via", audioProvider);

    const response = await fetch(getChatUrl(audioProvider), {
      method: "POST",
      headers: getChatHeaders(audioProvider),
      body: JSON.stringify({
        model: audioModel,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "input_audio",
                input_audio: {
                  data: audioBase64,
                  format: audioFormat,
                },
              },
            ],
          },
        ],
        max_tokens: 4000,
      }),
    });

    console.log("[transcribe-chunk] Transcription response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[transcribe-chunk] Transcription API error:", response.status, errorText);
      return NextResponse.json({ error: `Transcription failed: ${response.status} - ${errorText.substring(0, 200)}` }, { status: 500 });
    }

    const data = await response.json();
    let transcription = data.choices?.[0]?.message?.content?.trim() || "";

    // Check for empty/silent audio markers or hallucinated content
    const lowerTranscript = transcription.toLowerCase();
    const isNoSpeech = 
      transcription === "[NO_SPEECH]" ||
      lowerTranscript.includes("[no_speech]") ||
      lowerTranscript.includes("no speech") ||
      lowerTranscript.includes("no audio") ||
      lowerTranscript.includes("silent") ||
      lowerTranscript.includes("inaudible") ||
      lowerTranscript.includes("cannot transcribe") ||
      lowerTranscript.includes("no discernible") ||
      lowerTranscript.includes("audio is empty") ||
      lowerTranscript.includes("nothing to transcribe") ||
      // Common hallucination patterns for empty audio
      (transcription.length < 30 && /^(thanks?|thank you|bye|goodbye|hello|hi|okay|ok|yes|no|\.+|\s*)$/i.test(transcription));
    
    if (isNoSpeech) {
      console.log("[transcribe-chunk] No speech detected or empty audio, returning empty transcript");
      return NextResponse.json({
        success: true,
        chunkIndex: parsedChunkIndex,
        transcript: "",
        wordCount: 0,
      });
    }

    // Use the storage path if provided, otherwise generate new one
    const audioStoragePath = storagePath || `${user.id}/${sessionId}/chunk_${parsedChunkIndex}_${Date.now()}.webm`;
    const transcriptStoragePath = storagePath 
      ? storagePath.replace("/session-audio/", "/session-transcript/").replace(/\.\w+$/, ".txt")
      : `${user.id}/${sessionId}/chunk_${parsedChunkIndex}_${Date.now()}.txt`;

    console.log("[transcribe-chunk] Storage paths:", { audioStoragePath, transcriptStoragePath });

    // Only upload transcript to storage (audio already exists in Supabase)
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

    const lower = transcription.toLowerCase();
    const wordCount = transcription.split(/\s+/).filter((w: string) => w.length > 0).length;
    const toolData = {
      has_hesitation: HESITATION_MARKERS.some((m) => lower.includes(m)),
      has_self_correction: SELF_CORRECTION_MARKERS.some((m) => lower.includes(m)),
      has_questions: QUESTION_MARKERS.some((m) => lower.includes(m)),
      word_count: wordCount,
      original_filename: fileName,
      transcript_path: transcriptStoragePath,
    };

    // Insert to session_audio table (only if new path, avoid duplicates)
    if (!storagePath) {
      try {
        await supabase
          .from("session_audio")
          .insert({
            session_id: sessionId,
            user_id: user.id,
            timestamp_ms: parsedTimestampMs,
            storage_path: audioStoragePath,
            chunk_index: parsedChunkIndex,
            metadata: { original_filename: fileName },
          });
      } catch (e) {
        console.warn("session_audio insert failed (non-critical):", e);
      }
    }

    // Insert to session_transcript table
    try {
      await supabase
        .from("session_transcript")
        .insert({
          session_id: sessionId,
          user_id: user.id,
          timestamp_ms: parsedTimestampMs,
          storage_path: transcriptStoragePath,
          chunk_index: parsedChunkIndex,
          word_count: wordCount,
          metadata: toolData,
        });
    } catch (e) {
      console.warn("session_transcript insert failed (non-critical):", e);
    }

    return NextResponse.json({
      success: true,
      chunkIndex: parsedChunkIndex,
      transcript: transcription,
      wordCount: wordCount,
    });
  } catch (error) {
    console.error("Transcribe chunk error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
