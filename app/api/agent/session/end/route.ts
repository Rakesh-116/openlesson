import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hashApiKey } from "@/lib/x402";
import { generateReport } from "@/lib/openrouter";
import { getUserPrompts } from "@/lib/prompts";

async function getServiceRoleClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function authenticateRequest(
  apiKey: string,
  supabase: SupabaseClient
) {
  const keyHash = await hashApiKey(apiKey);

  const { data: keyData, error } = await supabase
    .from("agent_api_keys")
    .select("id, user_id, is_active, rate_limit, last_used_at")
    .eq("key_hash", keyHash)
    .eq("is_active", true)
    .single();

  if (error || !keyData) {
    return null;
  }

  await supabase
    .from("agent_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", keyData.id);

  return keyData;
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid Authorization header" },
        { status: 401 }
      );
    }

    const apiKey = authHeader.substring(7);
    const supabase = await getServiceRoleClient();

    const auth = await authenticateRequest(apiKey, supabase as SupabaseClient);
    if (!auth) {
      return NextResponse.json(
        { error: "Invalid or inactive API key" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { session_id } = body;

    if (!session_id) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 }
      );
    }

    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("id, user_id, problem, status, is_agent_session")
      .eq("id", session_id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    if (session.user_id !== auth.user_id) {
      return NextResponse.json(
        { error: "Session does not belong to this API key" },
        { status: 403 }
      );
    }

    if (!session.is_agent_session) {
      return NextResponse.json(
        { error: "This endpoint is for agent sessions only" },
        { status: 403 }
      );
    }

    if (session.status === "completed" || session.status === "ended_by_tutor") {
      return NextResponse.json(
        { error: "Session is already completed" },
        { status: 400 }
      );
    }

    const { data: chunks, error: chunksError } = await supabase
      .from("transcript_rag_chunks")
      .select("content")
      .eq("session_id", session_id)
      .order("chunk_index", { ascending: true });

    if (chunksError) {
      console.error("[agent-session-end] Error fetching chunks:", chunksError);
    }

    const fullTranscript = chunks 
      ? chunks.map(c => c.content).join("\n\n") 
      : "";

    const chunkCount = chunks?.length || 0;
    const wordCount = fullTranscript.split(/\s+/).length;
    const avgGapScore = 0.5;

    const promptOverrides = await getUserPrompts();
    const reportResult = await generateReport({
      problem: session.problem,
      duration: chunkCount > 0 ? `${chunkCount * 30} seconds` : "unknown",
      probeCount: chunkCount,
      avgGapScore,
      probesSummary: fullTranscript,
      promptOverrides,
    });

    if (!reportResult.success) {
      return NextResponse.json(
        { error: reportResult.error || "Report generation failed" },
        { status: 500 }
      );
    }

    const { error: updateError } = await supabase
      .from("sessions")
      .update({
        status: "completed",
        report: reportResult.report,
        report_generated_at: new Date().toISOString(),
        ended_at: new Date().toISOString(),
      })
      .eq("id", session_id);

    if (updateError) {
      console.error("[agent-session-end] Update error:", updateError);
      return NextResponse.json(
        { error: "Failed to update session" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      sessionId: session_id,
      message: "Session ended and report generated",
      chunkCount,
      wordCount,
    });
  } catch (error) {
    console.error("Agent session end error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return NextResponse.json({
    endpoint: "session_end",
    description: "End an agent session and generate a summary report",
    required_params: ["session_id"],
    optional_params: [],
    usage: "Call this endpoint when the tutoring session is complete. It will mark the session as completed and generate a summary report.",
  });
}
