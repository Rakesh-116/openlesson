import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const maxDuration = 60;

const HESITATION_MARKERS = ["um", "uh", "hmm", "huh", "er", "ah", "like,", "you know"];
const SELF_CORRECTION_MARKERS = ["actually", "no wait", "let me rethink", "scratch that", "I mean", "correction", "wait no"];
const QUESTION_MARKERS = ["?", "why", "how", "what if", "could it be", "I wonder"];

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File | null;
    const sessionId = formData.get("session_id") as string | null;
    const chunkIndex = formData.get("chunk_index") as string | null;
    const timestampMs = formData.get("timestamp_ms") as string | null;

    if (!audioFile) {
      return NextResponse.json({ error: "Missing audio file" }, { status: 400 });
    }
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

    const allowedTypes = ["audio/webm", "audio/mp4", "audio/mpeg", "audio/wav", "audio/ogg", "audio/mp3"];
    const isAllowed = allowedTypes.some(type => 
      audioFile.type === type || audioFile.type.startsWith(type + ";")
    );
    if (!isAllowed) {
      console.log("[transcribe-chunk] Invalid audio format:", audioFile.type, "file:", audioFile.name);
      return NextResponse.json({ error: "Invalid audio format" }, { status: 400 });
    }

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

    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    if (buffer.length < 1000) {
      console.log("[transcribe-chunk] Audio too small, skipping transcription:", buffer.length);
      return NextResponse.json({
        success: true,
        chunkIndex: parsedChunkIndex,
        transcript: "",
        wordCount: 0,
      });
    }
    
    const rawMimeType = audioFile.type;
    const mimeType = rawMimeType.split(";")[0].trim() || "audio/webm";
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

    console.log("[transcribe-chunk] Audio info:", { rawMimeType, mimeType, ext, bufferSize: buffer.length });

    const openrouterKey = process.env.OPENROUTER_API_KEY;
    if (!openrouterKey) {
      return NextResponse.json({ error: "OPENROUTER_API_KEY not configured for transcription" }, { status: 500 });
    }

    const prompt = "Transcribe this audio. Output ONLY the transcript text. Include filler words like um, uh.";

    console.log("[transcribe-chunk] Calling OpenRouter transcription API");

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openrouterKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "Socrates",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
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

    const ts = Date.now();
    const audioStoragePath = `${user.id}/${sessionId}/chunk_${parsedChunkIndex}_${ts}.webm`;
    const transcriptStoragePath = `${user.id}/${sessionId}/chunk_${parsedChunkIndex}_${ts}.txt`;

    console.log("[transcribe-chunk] Storage paths:", { audioStoragePath, transcriptStoragePath });

    // Try to upload audio to storage (non-critical - continue even if fails)
    try {
      await supabase.storage
        .from("session-audio")
        .upload(audioStoragePath, buffer, {
          contentType: mimeType,
          upsert: false,
        });
    } catch (e) {
      console.warn("Audio upload failed (non-critical):", e);
    }

    // Try to upload transcript to storage (non-critical)
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
    const toolData = {
      has_hesitation: HESITATION_MARKERS.some((m) => lower.includes(m)),
      has_self_correction: SELF_CORRECTION_MARKERS.some((m) => lower.includes(m)),
      has_questions: QUESTION_MARKERS.some((m) => lower.includes(m)),
      word_count: transcription.split(/\s+/).length,
      original_filename: audioFile.name,
      transcript_path: transcriptStoragePath,
    };

    // Try to insert to DB (non-critical - don't fail the request)
    try {
      await supabase
        .from("session_data")
        .insert({
          session_id: sessionId,
          user_id: user.id,
          data_type: "audio",
          timestamp_ms: parsedTimestampMs,
          chunk_index: parsedChunkIndex,
          audio_path: audioStoragePath,
          transcript: transcriptStoragePath,
          tool_data: toolData,
        });
    } catch (e) {
      console.warn("session_data insert failed (non-critical):", e);
    }

    return NextResponse.json({
      success: true,
      chunkIndex: parsedChunkIndex,
      transcript: transcription,
      wordCount: toolData.word_count,
    });
  } catch (error) {
    console.error("Transcribe chunk error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}