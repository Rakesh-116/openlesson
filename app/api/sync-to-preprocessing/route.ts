import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const maxDuration = 120;

interface SessionDataRecord {
  id: string;
  session_id: string;
  user_id: string;
  data_type: string;
  timestamp_ms: number;
  chunk_index: number | null;
  audio_path: string | null;
  transcript: string | null;
  eeg_data: Record<string, unknown> | null;
  tool_name: string | null;
  tool_action: string | null;
  tool_data: Record<string, unknown> | null;
  created_at: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, batchSize = 100, forceSync = false } = body;

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

    let query = supabase
      .from("session_data")
      .select("*")
      .eq("synced_to_preprocessing", false)
      .order("timestamp_ms", { ascending: true })
      .limit(batchSize);

    if (sessionId) {
      query = query.eq("session_id", sessionId);
    }

    const { data: records, error: fetchError } = await query;

    if (fetchError) {
      console.error("[sync-to-preprocessing] Fetch error:", fetchError);
      return NextResponse.json({ error: "Failed to fetch records" }, { status: 500 });
    }

    if (!records || records.length === 0) {
      return NextResponse.json({
        success: true,
        synced: 0,
        message: "No records to sync",
      });
    }

    const preprocessingUrl = process.env.PREPROCESSING_SERVER_URL;

    if (!preprocessingUrl) {
      console.log("[sync-to-preprocessing] PREPROCESSING_SERVER_URL not configured, simulating sync");
      
      const ids = records.map((r: SessionDataRecord) => r.id);
      const { error: updateError } = await supabase
        .from("session_data")
        .update({ synced_to_preprocessing: true, preprocessing_server_id: "simulated" })
        .in("id", ids);

      if (updateError) {
        console.error("[sync-to-preprocessing] Update error:", updateError);
        return NextResponse.json({ error: "Failed to mark records as synced" }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        synced: records.length,
        simulated: true,
        message: "PREPROCESSING_SERVER_URL not configured - simulated sync",
      });
    }

    const groupedBySession: Record<string, SessionDataRecord[]> = {};
    for (const record of records) {
      if (!groupedBySession[record.session_id]) {
        groupedBySession[record.session_id] = [];
      }
      groupedBySession[record.session_id].push(record);
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const [sessionIdKey, sessionRecords] of Object.entries(groupedBySession)) {
      try {
        const response = await fetch(preprocessingUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-User-Id": user.id,
          },
          body: JSON.stringify({
            session_id: sessionIdKey,
            user_id: user.id,
            records: sessionRecords,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("[sync-to-preprocessing] Server error:", response.status, errorText);
          results.failed += sessionRecords.length;
          results.errors.push(`Session ${sessionIdKey}: HTTP ${response.status}`);
          continue;
        }

        const ids = sessionRecords.map((r: SessionDataRecord) => r.id);
        await supabase
          .from("session_data")
          .update({ synced_to_preprocessing: true, preprocessing_server_id: sessionIdKey })
          .in("id", ids);

        results.success += sessionRecords.length;
      } catch (err) {
        console.error("[sync-to-preprocessing] Send error:", err);
        results.failed += sessionRecords.length;
        results.errors.push(`Session ${sessionIdKey}: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }

    return NextResponse.json({
      success: results.failed === 0,
      synced: results.success,
      failed: results.failed,
      errors: results.errors,
    });
  } catch (error) {
    console.error("Sync to preprocessing error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("session_id");

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

    let query = supabase
      .from("session_data")
      .select("data_type, synced_to_preprocessing, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (sessionId) {
      query = query.eq("session_id", sessionId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[sync-status] Fetch error:", error);
      return NextResponse.json({ error: "Failed to fetch sync status" }, { status: 500 });
    }

    const total = data?.length || 0;
    const synced = data?.filter((r) => r.synced_to_preprocessing).length || 0;
    const unsynced = total - synced;

    const byType: Record<string, { total: number; synced: number; unsynced: number }> = {};
    for (const record of data || []) {
      if (!byType[record.data_type]) {
        byType[record.data_type] = { total: 0, synced: 0, unsynced: 0 };
      }
      byType[record.data_type].total++;
      if (record.synced_to_preprocessing) {
        byType[record.data_type].synced++;
      } else {
        byType[record.data_type].unsynced++;
      }
    }

    return NextResponse.json({
      total,
      synced,
      unsynced,
      byType,
    });
  } catch (error) {
    console.error("Get sync status error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}