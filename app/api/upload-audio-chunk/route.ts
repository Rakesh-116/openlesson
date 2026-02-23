import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const HESITATION_MARKERS = ["um", "uh", "hmm", "huh", "er", "ah", "like,", "you know"];
const SELF_CORRECTION_MARKERS = ["actually", "no wait", "let me rethink", "scratch that", "I mean", "correction", "wait no"];
const QUESTION_MARKERS = ["?", "why", "how", "what if", "could it be", "I wonder"];

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File | null;

    if (!audioFile) {
      return NextResponse.json({ error: "Missing audio file" }, { status: 400 });
    }

    const allowedTypes = ["audio/webm", "audio/mp4", "audio/mpeg", "audio/wav", "audio/ogg", "audio/mp3"];
    if (!allowedTypes.includes(audioFile.type)) {
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
    const base64Audio = buffer.toString("base64");

    const openaiKey = process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY;
    if (!openaiKey) {
      return NextResponse.json({ error: "Transcription service not configured" }, { status: 500 });
    }

    const ext = audioFile.type.split("/")[1] || "webm";
    const mimeType = audioFile.type;

    let transcription = "";
    
    const useOpenAI = !!process.env.OPENAI_API_KEY;
    const apiUrl = useOpenAI 
      ? "https://api.openai.com/v1/audio/transcriptions"
      : "https://openrouter.ai/api/v1/audio/transcriptions";
    
    const form = new FormData();
    form.append("file", new Blob([buffer], { type: mimeType }), `audio.${ext}`);
    form.append("model", "whisper-1");
    if (!useOpenAI) {
      form.append("provider", "openai");
    }

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
      },
      body: form,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Transcription API error:", response.status, errorText);
      return NextResponse.json({ error: "Transcription failed" }, { status: 500 });
    }

    const result = await response.json();
    transcription = result.text || "";

    if (!transcription.trim()) {
      return NextResponse.json({ error: "No speech detected in audio" }, { status: 400 });
    }

    const chunks = splitIntoChunks(transcription, 200, 400);

    const taggedChunks = chunks.map((content, index) => {
      const lower = content.toLowerCase();
      return {
        user_id: user.id,
        session_id: null,
        transcript_id: null,
        chunk_index: index,
        content,
        source: "user_upload",
        metadata: {
          has_hesitation: HESITATION_MARKERS.some((m) => lower.includes(m)),
          has_self_correction: SELF_CORRECTION_MARKERS.some((m) => lower.includes(m)),
          has_questions: QUESTION_MARKERS.some((m) => lower.includes(m)),
          word_count: content.split(/\s+/).length,
          original_filename: audioFile.name,
        },
      };
    });

    if (taggedChunks.length > 0) {
      const { error: insertError } = await supabase
        .from("transcript_chunks")
        .insert(taggedChunks);

      if (insertError) {
        console.error("Insert chunks error:", insertError);
        return NextResponse.json({ error: "Failed to save chunks" }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      chunkCount: taggedChunks.length,
      transcript: transcription,
    });
  } catch (error) {
    console.error("Upload audio chunk error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function splitIntoChunks(text: string, minWords: number, maxWords: number): string[] {
  const sentences = text.match(/[^.!?\n]+[.!?\n]*/g) || [text];
  const chunks: string[] = [];
  let currentChunk = "";
  let currentWords = 0;

  for (const sentence of sentences) {
    const sentenceWords = sentence.trim().split(/\s+/).length;

    if (currentWords + sentenceWords > maxWords && currentWords >= minWords) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
      currentWords = sentenceWords;
    } else {
      currentChunk += " " + sentence;
      currentWords += sentenceWords;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}
