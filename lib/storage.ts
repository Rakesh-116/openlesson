// ============================================
// SUPABASE-ONLY SESSION STORAGE
// All data lives in Supabase DB + Storage
// ============================================

import { createClient } from "@/lib/supabase/client";

// ---- Types ----

export interface Probe {
  id: string;
  timestamp: number; // ms since session start
  gapScore: number;
  signals: string[];
  text: string;
  expandedText?: string;
  starred?: boolean;
  isRevealed?: boolean; // user has clicked to reveal this question
}

export type TrafficLight = "red" | "yellow" | "green";

export type SessionStatus = "ready" | "paused" | "completed" | "ended_by_tutor";
export type ObserverMode = "off" | "passive" | "active";
export type Frequency = "rare" | "balanced" | "frequent";

export interface Session {
  id: string;
  problem: string;
  startedAt: string; // ISO string
  endedAt?: string;
  durationMs: number;
  status: SessionStatus;
  probes: Probe[];
  objectives: string[];
  hasAudio: boolean;
  audioPath?: string;
  report?: string;
  reportGeneratedAt?: string;
  transcript?: string;
  planTitle?: string;
  metadata: {
    observerMode?: ObserverMode;
    frequency?: Frequency;
    eegSummary?: Record<string, number> | null;
    whiteboardData?: string | null;
    notebookData?: string | null;
    trafficLight?: TrafficLight;
  };
}

// ---- Helpers: map DB rows → Session ----

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDbSession(s: any, probes: Probe[] = []): Session {
  return {
    id: s.id,
    problem: s.problem,
    startedAt: s.created_at,
    endedAt: s.ended_at ?? undefined,
    durationMs: s.duration_ms || 0,
    status: s.status || "completed",
    probes,
    objectives: s.objectives || [],
    hasAudio: !!s.audio_path,
    audioPath: s.audio_path ?? undefined,
    report: s.report ?? undefined,
    reportGeneratedAt: s.report_generated_at ?? undefined,
    transcript: s.transcript ?? undefined,
    metadata: s.metadata || {},
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDbProbe(p: any): Probe {
  return {
    id: p.id,
    timestamp: p.timestamp_ms,
    gapScore: p.gap_score,
    signals: p.signals || [],
    text: p.text,
    expandedText: p.expanded_text ?? undefined,
    starred: p.starred ?? false,
    isRevealed: p.is_revealed ?? false,
  };
}

// ---- Session CRUD ----

export async function createSession(problem: string): Promise<Session> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("sessions")
    .insert({ user_id: user.id, problem, status: "active" })
    .select()
    .single();

  if (error || !data) throw new Error(error?.message || "Failed to create session");
  return mapDbSession(data);
}

export async function getSession(id: string): Promise<Session | null> {
  const supabase = createClient();

  const { data: sessionRow, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", id)
    .single();

  console.log("[getSession] DB row:", { id, error, hasAudio: sessionRow?.audio_path });

  if (!sessionRow) return null;

  const { data: probeRows } = await supabase
    .from("probes")
    .select("*")
    .eq("session_id", id)
    .order("timestamp_ms", { ascending: true });

  return mapDbSession(sessionRow, (probeRows || []).map(mapDbProbe));
}

export async function getSessions(): Promise<Session[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: sessionRows } = await supabase
    .from("sessions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (!sessionRows) return [];

  // Batch-load all probes for these sessions
  const sessionIds = sessionRows.map((s: { id: string }) => s.id);
  const { data: allProbes } = await supabase
    .from("probes")
    .select("*")
    .in("session_id", sessionIds)
    .order("timestamp_ms", { ascending: true });

  const probesBySession = new Map<string, Probe[]>();
  for (const p of allProbes || []) {
    const mapped = mapDbProbe(p);
    const existing = probesBySession.get(p.session_id) || [];
    existing.push(mapped);
    probesBySession.set(p.session_id, existing);
  }

  return sessionRows.map((s: { id: string }) => mapDbSession(s, probesBySession.get(s.id) || []));
}

export async function saveSession(session: Session): Promise<void> {
  const supabase = createClient();

  await supabase
    .from("sessions")
    .update({
      problem: session.problem,
      status: session.status,
      duration_ms: session.durationMs,
      ended_at: session.endedAt || null,
      audio_path: session.audioPath || null,
      report: session.report || null,
      report_generated_at: session.reportGeneratedAt || null,
      transcript: session.transcript || null,
      metadata: session.metadata,
    })
    .eq("id", session.id);
}

export async function deleteSession(id: string): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Delete audio from Storage
  const { data: sessionRow } = await supabase
    .from("sessions")
    .select("audio_path")
    .eq("id", id)
    .single();

  if (sessionRow?.audio_path) {
    await supabase.storage.from("session-audio").remove([sessionRow.audio_path]);
  }

  // Delete EEG data from Storage
  const { data: eegRows } = await supabase
    .from("session_eeg_data")
    .select("data_path")
    .eq("session_id", id);

  if (eegRows && eegRows.length > 0) {
    await supabase.storage
      .from("session-eeg")
      .remove(eegRows.map((r: { data_path: string }) => r.data_path));
  }

  // Cascade delete handles probes, eeg rows
  await supabase.from("sessions").delete().eq("id", id);
}

// ---- Probe CRUD ----

export async function addProbe(
  sessionId: string,
  probe: Omit<Probe, "id">
): Promise<Probe> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("probes")
    .insert({
      session_id: sessionId,
      timestamp_ms: probe.timestamp,
      gap_score: probe.gapScore,
      signals: probe.signals,
      text: probe.text,
      expanded_text: probe.expandedText || null,
    })
    .select()
    .single();

  if (error || !data) throw new Error(error?.message || "Failed to insert probe");
  return mapDbProbe(data);
}

export async function updateProbeExpanded(probeId: string, expandedText: string): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("probes")
    .update({ expanded_text: expandedText })
    .eq("id", probeId);
}

export async function toggleProbeStarred(probeId: string, starred: boolean): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("probes")
    .update({ starred })
    .eq("id", probeId);
}

export async function updateProbeRevealed(probeId: string, isRevealed: boolean): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("probes")
    .update({ is_revealed: isRevealed })
    .eq("id", probeId);
}

export async function startSession(sessionId: string): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("sessions")
    .update({ status: "paused" })
    .eq("id", sessionId);
}

export async function updateSessionStatus(sessionId: string, status: SessionStatus): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("sessions")
    .update({ status })
    .eq("id", sessionId);
}

export async function pauseSession(sessionId: string): Promise<void> {
  await updateSessionStatus(sessionId, "paused");
}

export async function resumeSession(sessionId: string): Promise<void> {
  await updateSessionStatus(sessionId, "ready");
}

// ---- In-memory session helpers (for active recording) ----

export function addProbeToSession(
  session: Session,
  probe: Probe
): Session {
  return {
    ...session,
    probes: [...session.probes, probe],
  };
}

export function endSession(
  session: Session,
  durationMs: number,
  status: SessionStatus = "completed"
): Session {
  return {
    ...session,
    endedAt: new Date().toISOString(),
    durationMs,
    status,
  };
}

// ---- Audio Storage ----

export async function saveSessionAudio(
  sessionId: string,
  audioBlob: Blob
): Promise<string> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const timestamp = Date.now();
  const path = `${user.id}/${sessionId}_${timestamp}.webm`;
  const contentType = audioBlob.type || "audio/webm";

  console.log("[saveSessionAudio] Saving audio:", { sessionId, path, contentType, size: audioBlob.size });

  const { error } = await supabase.storage
    .from("session-audio")
    .upload(path, audioBlob, {
      contentType,
      upsert: true,
    });

  if (error) {
    console.error("[saveSessionAudio] Upload error:", error);
    throw new Error(error.message);
  }

  console.log("[saveSessionAudio] Upload success, updating session...");

  // Update session with audio path
  const { error: updateError } = await supabase
    .from("sessions")
    .update({ audio_path: path })
    .eq("id", sessionId);

  if (updateError) {
    console.error("[saveSessionAudio] Update session error:", updateError);
    throw new Error(updateError.message);
  }

  console.log("[saveSessionAudio] Done!");

  return path;
}

export async function saveAudioChunk(
  sessionId: string,
  chunkBlob: Blob,
  chunkIndex: number,
  timestamp: number
): Promise<string> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const ts = Date.now();
  const path = `${user.id}/${sessionId}/chunk_${chunkIndex}_${ts}.webm`;
  const contentType = chunkBlob.type || "audio/webm";

  console.log("[saveAudioChunk] Saving:", { sessionId, chunkIndex, path });

  const { error } = await supabase.storage
    .from("session-audio")
    .upload(path, chunkBlob, {
      contentType,
      upsert: false,
    });

  if (error) {
    console.error("[saveAudioChunk] Upload error:", error);
    return "";
  }

  return path;
}

export async function getSessionAudio(sessionId: string): Promise<Blob | null> {
  const supabase = createClient();

  const { data: sessionRow } = await supabase
    .from("sessions")
    .select("audio_path")
    .eq("id", sessionId)
    .single();

  if (!sessionRow?.audio_path) return null;

  const { data, error } = await supabase.storage
    .from("session-audio")
    .download(sessionRow.audio_path);

  if (error || !data) return null;
  return data;
}

export interface FacialDataPoint {
  timestamp: number;
  facePresent: boolean;
  blinkRate: number;
  gazeDirection: "at_camera" | "away" | "unknown";
  headPose: { pitch: number; yaw: number; roll: number };
  mouthState: "open" | "closed";
  faceDistance: "optimal" | "too_close" | "too_far";
  engagementScore: number;
}

export async function saveFacialData(
  sessionId: string,
  facialData: FacialDataPoint[],
  chunkIndex: number,
  timestamp: number
): Promise<string> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const path = `${user.id}/${sessionId}/facial_chunk_${chunkIndex}_${timestamp}.json`;
  const payload = { sessionId, timestamp, data: facialData };

  const { error } = await supabase.storage
    .from("session-facial")
    .upload(path, JSON.stringify(payload), { contentType: "application/json", upsert: false });

  if (error) {
    console.error("[saveFacialData] Upload error:", error);
    return "";
  }
  return path;
}

// ---- Tool Usage Tracking ----

export type ToolName = "chat" | "canvas" | "notebook" | "grokipedia" | "exercise" | "reading" | "rag" | "help" | "data-input" | "logs";

export type ToolAction = 
  | "open" 
  | "close" 
  | "send_message" 
  | "canvas_draw" 
  | "canvas_save"
  | "notebook_edit"
  | "notebook_save"
  | "rag_query"
  | "rag_select_chunk"
  | "prep_material_load"
  | "help_view";

export async function logToolUsage(
  sessionId: string,
  toolName: ToolName,
  toolAction: ToolAction,
  timestampMs: number,
  toolData: Record<string, unknown> = {}
): Promise<boolean> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const toolDataJson = JSON.stringify(toolData);
    const toolStoragePath = `${user.id}/${sessionId}/tool_${timestampMs}.json`;

    try {
      await supabase.storage
        .from("session-tool")
        .upload(toolStoragePath, toolDataJson, {
          contentType: "application/json",
          upsert: true,
        });
    } catch (e) {
      console.warn("[logToolUsage] Storage upload failed (non-critical):", e);
    }

    const { error } = await supabase
      .from("session_data")
      .insert({
        session_id: sessionId,
        user_id: user.id,
        data_type: "tool",
        timestamp_ms: timestampMs,
        tool_name: toolName,
        tool_action: toolAction,
        tool_data: { path: toolStoragePath },
      });

    if (error) {
      console.warn("[logToolUsage] DB insert failed (non-critical):", error.message);
    }

    return true;
  } catch (e) {
    console.warn("[logToolUsage] Failed (non-critical):", e);
    return true;
  }
}

// ---- EEG Data Logging ----

export async function logEEGData(
  sessionId: string,
  timestampMs: number,
  chunkIndex: number,
  bandPowers: { delta: number; theta: number; alpha: number; beta: number; gamma: number }
): Promise<boolean> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const eegDataJson = JSON.stringify({
      timestamp_ms: timestampMs,
      chunk_index: chunkIndex,
      band_powers: bandPowers,
    });
    const eegStoragePath = `${user.id}/${sessionId}/eeg_chunk_${chunkIndex}_${timestampMs}.json`;

    try {
      await supabase.storage
        .from("session-eeg")
        .upload(eegStoragePath, eegDataJson, {
          contentType: "application/json",
          upsert: true,
        });
    } catch (e) {
      console.warn("[logEEGData] Storage upload failed (non-critical):", e);
    }

    const { error } = await supabase
      .from("session_data")
      .insert({
        session_id: sessionId,
        user_id: user.id,
        data_type: "eeg",
        timestamp_ms: timestampMs,
        chunk_index: chunkIndex,
        eeg_data: { path: eegStoragePath },
      });

    if (error) {
      console.warn("[logEEGData] DB insert failed (non-critical):", error.message);
    }

    return true;
  } catch (e) {
    console.warn("[logEEGData] Failed (non-critical):", e);
    return true;
  }
}

// ---- EEG Storage ----

export async function saveSessionEEG(
  sessionId: string,
  eegData: { channels: Record<string, number[]>; bandPowers: Record<string, number> | null },
  deviceName?: string,
  chunkIndex?: number,
  timestamp?: number
): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const ts = timestamp || Date.now();
  const idx = chunkIndex ?? 0;
  const path = `${user.id}/${sessionId}/eeg_chunk_${idx}_${ts}.json`;
  const blob = new Blob([JSON.stringify(eegData)], { type: "application/json" });

  console.log("[saveSessionEEG] Saving:", { sessionId, path, deviceName, channels: Object.keys(eegData.channels) });

  await supabase.storage
    .from("session-eeg")
    .upload(path, blob, { contentType: "application/json", upsert: true });

  const sampleCount = Object.values(eegData.channels)[0]?.length || 0;

  await supabase.from("session_eeg_data").insert({
    session_id: sessionId,
    user_id: user.id,
    device_name: deviceName || null,
    data_path: path,
    sample_count: sampleCount,
    avg_band_powers: eegData.bandPowers,
  });

  // Also save summary into session metadata
  if (eegData.bandPowers) {
    const { data: sessionRow } = await supabase
      .from("sessions")
      .select("metadata")
      .eq("id", sessionId)
      .single();

    const existingMeta = sessionRow?.metadata || {};
    await supabase
      .from("sessions")
      .update({ metadata: { ...existingMeta, eegSummary: eegData.bandPowers } })
      .eq("id", sessionId);
  }
  
  console.log("[saveSessionEEG] Done!");
}

// ---- Analytics Helpers ----

export function getSessionStats(session: Session) {
  const probeCount = session.probes.length;
  const avgGapScore =
    probeCount > 0
      ? session.probes.reduce((sum, p) => sum + p.gapScore, 0) / probeCount
      : 0;

  const durationMinutes = Math.round(session.durationMs / 60000);
  const probesPerMinute = durationMinutes > 0 ? probeCount / durationMinutes : 0;

  const peakProbe = session.probes.reduce(
    (max, p) => (p.gapScore > max.gapScore ? p : max),
    { gapScore: 0 } as Probe
  );

  return {
    probeCount,
    avgGapScore: Math.round(avgGapScore * 100) / 100,
    durationMinutes,
    probesPerMinute: Math.round(probesPerMinute * 10) / 10,
    peakGapScore: peakProbe.gapScore,
    peakGapTime: peakProbe.timestamp,
  };
}

// ---- RAG: Retrieve Relevant Transcript Chunks ----

export interface RetrievedChunk {
  id: string;
  content: string;
  sessionId: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
}

interface RetrieveOptions {
  limit?: number;
  sessionId?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseClient?: any;
}

export async function retrieveRelevantChunks(
  userId: string,
  query: string,
  options: RetrieveOptions = {}
): Promise<RetrievedChunk[]> {
  const { limit = 3, sessionId = null, supabaseClient } = options;

  // Use provided supabase client or create new one
  const supabase = supabaseClient || createClient();

  console.log("[retrieveRelevantChunks] Query:", query);
  console.log("[retrieveRelevantChunks] UserId:", userId);
  console.log("[retrieveRelevantChunks] SessionId:", sessionId);

  // Check if any transcript chunks exist for this user
  const { count, error: countError } = await supabase
    .from("transcript_chunks")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);
  
  console.log("[retrieveRelevantChunks] Total chunks for user:", count, "error:", countError);

  // Check how many have embeddings
  const { count: embedCount, error: embedError } = await supabase
    .from("transcript_chunks")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .not("embedding", "is", null);
  
  console.log("[retrieveRelevantChunks] Chunks with embeddings:", embedCount, "error:", embedError);

  // Generate embedding for the query
  const embedding = await generateEmbedding(query);
  if (!embedding) {
    console.warn("[retrieveRelevantChunks] Failed to generate embedding");
    return [];
  }

  console.log("[retrieveRelevantChunks] Generated embedding, length:", embedding.length);

  // Get all chunks with embeddings for this user (skip session filter for now to debug)
  const { data: chunks, error } = await supabase
    .from("transcript_chunks")
    .select("id, session_id, content, created_at, embedding")
    .eq("user_id", userId)
    .not("embedding", "is", null)
    .limit(limit * 3);

  console.log("[retrieveRelevantChunks] Query result:", { count: chunks?.length, error });

  console.log("[retrieveRelevantChunks] Query result:", { count: chunks?.length, error, sessionIdProvided: !!sessionId });

  if (!chunks || chunks.length === 0) {
    console.log("[retrieveRelevantChunks] No chunks with embeddings, falling back to recent chunks");
    
    const { data: recentChunks, error: recentError } = await supabase
      .from("transcript_chunks")
      .select("id, session_id, content, created_at")
      .eq("user_id", userId)
      .neq("session_id", sessionId || "")
      .not("content", "is", null)
      .order("created_at", { ascending: false })
      .limit(limit);
    
    if (recentError) {
      console.error("[retrieveRelevantChunks] Fallback query error:", recentError);
      return [];
    }
    
    if (!recentChunks || recentChunks.length === 0) {
      return [];
    }
    
    return recentChunks.map((c: { id: string; content: string; session_id: string; created_at: string }) => ({
      id: c.id,
      content: c.content,
      sessionId: c.session_id,
      createdAt: c.created_at,
      metadata: { similarity: 0, fallback: true },
    }));
  }

  // Calculate cosine similarity manually
  function cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum: number, val: number, i: number) => sum + val * b[i], 0);
    const magA = Math.sqrt(a.reduce((sum: number, val: number) => sum + val * val, 0));
    const magB = Math.sqrt(b.reduce((sum: number, val: number) => sum + val * val, 0));
    return dotProduct / (magA * magB);
  }

  const chunksWithSimilarity = chunks
    .map((c: { id: string; content: string; session_id: string; created_at: string; embedding: unknown }): { id: string; content: string; sessionId: string; createdAt: string; similarity: number } | null => {
      let emb: number[] = [];
      if (Array.isArray(c.embedding)) {
        emb = c.embedding as number[];
      } else if (typeof c.embedding === "string") {
        try {
          emb = JSON.parse(c.embedding);
        } catch {
          console.warn("[retrieveRelevantChunks] Failed to parse embedding:", c.id);
        }
      }
      if (emb.length === 0) return null;
      const sim = cosineSimilarity(embedding, emb);
      console.log("[retrieveRelevantChunks] Similarity for chunk:", c.id.slice(0, 8), "len:", emb.length, "sim:", sim);
      return {
        id: c.id,
        content: c.content,
        sessionId: c.session_id,
        createdAt: c.created_at,
        similarity: sim,
      };
    })
    .filter((c: { id: string; content: string; sessionId: string; createdAt: string; similarity: number } | null): c is { id: string; content: string; sessionId: string; createdAt: string; similarity: number } => c !== null)
    .sort((a: { similarity: number }, b: { similarity: number }) => b.similarity - a.similarity)
    .slice(0, limit);

  console.log("[retrieveRelevantChunks] Vector search result:", chunksWithSimilarity.length, "top similarity:", chunksWithSimilarity[0]?.similarity);

  return chunksWithSimilarity.map((c: { id: string; content: string; sessionId: string; createdAt: string; similarity: number }) => ({
    id: c.id,
    content: c.content,
    sessionId: c.sessionId,
    createdAt: c.createdAt,
    metadata: { similarity: c.similarity },
  }));
}

// ---- RAG: Generate Embedding ----

const EMBEDDING_URL = "https://openrouter.ai/api/v1/embeddings";
const EMBEDDING_MODEL = "google/gemini-embedding-001";

async function generateEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.warn("[generateEmbedding] No API key configured");
    return null;
  }

  try {
    const response = await fetch(EMBEDDING_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: text,
      }),
    });

    if (!response.ok) {
      console.error("[generateEmbedding] API error:", response.status);
      return null;
    }

    const data = await response.json();
    return data.data?.[0]?.embedding || null;
  } catch (err) {
    console.error("[generateEmbedding] Exception:", err);
    return null;
  }
}

// ---- RAG: Get User Calibration ----

export interface UserCalibration {
  sessionCount: number;
  avgGapScore: number;
  trend: "improving" | "declining" | "stable";
  recentTopics: string[];
  commonGaps: string[];
}

export async function getUserCalibration(
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseClient?: any
): Promise<UserCalibration> {
  const supabase = supabaseClient || createClient();

  // Get all user's sessions with probes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: sessions, error } = await supabase
    .from("sessions")
    .select(`
      id,
      problem,
      created_at,
      probes (gap_score, signals)
    `)
    .eq("user_id", userId)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(20) as { data: Array<{ id: string; problem: string; created_at: string; probes: Array<{ gap_score: number; signals: string[] }> }> | null; error: Error | null };

  if (error || !sessions) {
    console.warn("[getUserCalibration] Failed to fetch sessions:", error);
    return {
      sessionCount: 0,
      avgGapScore: 0.5,
      trend: "stable",
      recentTopics: [],
      commonGaps: [],
    };
  }

  const sessionCount = sessions.length;

  if (sessionCount === 0) {
    return {
      sessionCount: 0,
      avgGapScore: 0.5,
      trend: "stable",
      recentTopics: [],
      commonGaps: [],
    };
  }

  // Calculate average gap score
  let totalGapScore = 0;
  let probeCount = 0;
  const allSignals: string[] = [];

  for (const session of sessions) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const probes = session.probes as any[];
    if (probes) {
      for (const probe of probes) {
        totalGapScore += probe.gap_score || 0;
        probeCount++;
        if (probe.signals) {
          allSignals.push(...probe.signals);
        }
      }
    }
  }

  const avgGapScore = probeCount > 0 ? totalGapScore / probeCount : 0.5;

  // Determine trend by comparing recent sessions to older ones
  let trend: "improving" | "declining" | "stable" = "stable";
  
  if (sessionCount >= 4) {
    const recentSessions = sessions.slice(0, Math.floor(sessionCount / 2));
    const olderSessions = sessions.slice(Math.floor(sessionCount / 2));

    const recentAvg = calculateAvgGap(recentSessions);
    const olderAvg = calculateAvgGap(olderSessions);

    if (recentAvg < olderAvg - 0.1) {
      trend = "improving"; // Lower gap = better understanding
    } else if (recentAvg > olderAvg + 0.1) {
      trend = "declining";
    }
  }

  // Get recent topics
  const recentTopics = sessions.slice(0, 5).map(s => s.problem);

  // Get common gaps (most frequent signals)
  const signalCounts = new Map<string, number>();
  for (const signal of allSignals) {
    signalCounts.set(signal, (signalCounts.get(signal) || 0) + 1);
  }
  const commonGaps = Array.from(signalCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([signal]) => signal);

  return {
    sessionCount,
    avgGapScore: Math.round(avgGapScore * 100) / 100,
    trend,
    recentTopics,
    commonGaps,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function calculateAvgGap(sessions: { probes: { gap_score: number }[] }[]): number {
  let total = 0;
  let count = 0;
  for (const session of sessions) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const probes = session.probes as any[];
    if (probes) {
      for (const probe of probes) {
        total += probe.gap_score || 0;
        count++;
      }
    }
  }
  return count > 0 ? total / count : 0.5;
}

// ---- Learning Plans ----

export interface LearningPlan {
  id: string;
  title: string;
  root_topic: string;
  status: "active" | "completed" | "paused";
  created_at: string;
  is_public?: boolean;
  author_id?: string;
  author_username?: string;
  remix_count?: number;
  original_plan_id?: string;
}

export interface PlanNode {
  id: string;
  plan_id: string;
  title: string;
  description: string;
  is_start: boolean;
  next_node_ids: string[];
  status: "not_started" | "in_progress" | "completed";
}

export async function getLearningPlans(): Promise<LearningPlan[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await supabase
    .from("learning_plans")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (data || []).map((p: any) => ({
    id: p.id,
    title: p.root_topic,
    root_topic: p.root_topic,
    status: p.status || "active",
    created_at: p.created_at,
  }));
}

export async function getPlanNodes(planId: string): Promise<PlanNode[]> {
  const supabase = createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await supabase
    .from("plan_nodes")
    .select("*")
    .eq("plan_id", planId);

  return (data || []).map((n: any) => ({
    id: n.id,
    plan_id: n.plan_id,
    title: n.title,
    description: n.description || "",
    is_start: n.is_start || false,
    next_node_ids: n.next_node_ids || [],
    status: n.status || "not_started",
  }));
}

export async function getIncompleteNodes(): Promise<(PlanNode & { planTitle: string })[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: plans } = await supabase
    .from("learning_plans")
    .select("id, root_topic")
    .eq("user_id", user.id)
    .eq("status", "active");

  if (!plans || plans.length === 0) return [];

  const planIds = plans.map((p: any) => p.id);
  const planTitles = new Map(plans.map((p: any) => [p.id, p.root_topic]));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: nodes } = await supabase
    .from("plan_nodes")
    .select("*")
    .in("plan_id", planIds)
    .in("status", ["not_started", "in_progress"]);

  return (nodes || []).map((n: any) => ({
    id: n.id,
    plan_id: n.plan_id,
    title: n.title,
    description: n.description || "",
    is_start: n.is_start || false,
    next_node_ids: n.next_node_ids || [],
    status: n.status || "not_started",
    planTitle: planTitles.get(n.plan_id) || "",
  }));
}

export async function getPlanById(planId: string): Promise<LearningPlan | null> {
  const supabase = createClient();

  const { data } = await supabase
    .from("learning_plans")
    .select(`
      id,
      root_topic,
      status,
      created_at,
      is_public,
      author_id,
      user_id,
      remix_count,
      original_plan_id,
      profiles:author_id (username)
    `)
    .eq("id", planId)
    .single();

  if (!data) return null;

  return {
    id: data.id,
    title: data.root_topic,
    root_topic: data.root_topic,
    status: data.status || "active",
    created_at: data.created_at,
    is_public: data.is_public,
    author_id: data.author_id,
    author_username: data.profiles?.username || "anonymous",
    remix_count: data.remix_count || 0,
    original_plan_id: data.original_plan_id,
  };
}

export async function getUserById(userId: string): Promise<{ username: string } | null> {
  const supabase = createClient();

  const { data } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .single();

  return data;
}

export async function forkPlan(
  sourcePlanId: string,
  userId: string
): Promise<{ planId: string; nodesCount: number }> {
  const supabase = createClient();

  const { data: sourcePlan, error: planError } = await supabase
    .from("learning_plans")
    .select("*")
    .eq("id", sourcePlanId)
    .single();

  if (planError || !sourcePlan) {
    throw new Error("Source plan not found");
  }

  const { data: sourceNodes, error: nodesError } = await supabase
    .from("plan_nodes")
    .select("*")
    .eq("plan_id", sourcePlanId);

  if (nodesError) {
    throw new Error("Could not fetch source nodes");
  }

  const { data: newPlan, error: createError } = await supabase
    .from("learning_plans")
    .insert({
      user_id: userId,
      root_topic: sourcePlan.root_topic,
      status: "active",
      is_public: false,
      author_id: userId,
      original_plan_id: sourcePlanId,
    })
    .select()
    .single();

  if (createError) {
    throw new Error("Could not create new plan");
  }

  const nodeIdMap = new Map<string, string>();
  const newNodes = sourceNodes.map((node: any) => {
    const newId = crypto.randomUUID();
    nodeIdMap.set(node.id, newId);
    return {
      plan_id: newPlan.id,
      title: node.title,
      description: node.description,
      is_start: node.is_start,
      next_node_ids: (node.next_node_ids || []).map((id: string) => nodeIdMap.get(id) || id),
      status: "not_started",
      position_x: node.position_x,
      position_y: node.position_y,
    };
  });

  const { error: insertError } = await supabase.from("plan_nodes").insert(newNodes);

  if (insertError) {
    await supabase.from("learning_plans").delete().eq("id", newPlan.id);
    throw new Error("Could not copy nodes");
  }

  await supabase
    .from("learning_plans")
    .update({ remix_count: (sourcePlan.remix_count || 0) + 1 })
    .eq("id", sourcePlanId);

  return { planId: newPlan.id, nodesCount: newNodes.length };
}

export async function updatePlanVisibility(
  planId: string,
  userId: string,
  isPublic: boolean
): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("learning_plans")
    .update({ is_public: isPublic, author_id: userId })
    .eq("id", planId)
    .eq("user_id", userId);

  if (error) {
    throw new Error("Could not update plan visibility");
  }
}
