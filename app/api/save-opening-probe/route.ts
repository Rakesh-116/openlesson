import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, probeText } = body;

    if (!sessionId || !probeText) {
      return NextResponse.json({ error: "Missing sessionId or probeText" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data, error } = await supabase
      .from("probes")
      .insert({
        session_id: sessionId,
        timestamp_ms: 0,
        gap_score: 0,
        signals: ["opening"],
        text: probeText,
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to save probe:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, probe: data });
  } catch (error) {
    console.error("Save opening probe error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
