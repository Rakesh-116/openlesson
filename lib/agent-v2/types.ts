// ============================================
// OpenLesson Agentic API v2 - Shared Types
// ============================================

// --- API Key Types ---

export type ApiKeyScope =
  | "plans:read"
  | "plans:write"
  | "sessions:read"
  | "sessions:write"
  | "analysis:write"
  | "assistant:read"
  | "analytics:read"
  | "proofs:read"
  | "proofs:anchor"
  | "*";

export interface AgentApiKey {
  id: string;
  user_id: string;
  key_hash: string;
  key_prefix: string;
  label: string | null;
  scopes: ApiKeyScope[];
  rate_limit: number;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
}

// --- Auth Context ---

export interface AuthContext {
  user_id: string;
  key_id: string;
  scopes: ApiKeyScope[];
}

// --- Proof Types ---

export type ProofType =
  | "plan_created"
  | "plan_adapted"
  | "session_started"
  | "session_paused"
  | "session_resumed"
  | "session_ended"
  | "analysis_heartbeat"
  | "assistant_query"
  | "session_batch";

export const PROOF_TYPE_VALUES: Record<ProofType, number> = {
  plan_created: 0,
  plan_adapted: 1,
  session_started: 2,
  session_paused: 3,
  session_resumed: 4,
  session_ended: 5,
  analysis_heartbeat: 6,
  assistant_query: 7,
  session_batch: 8,
};

export interface Proof {
  id: string;
  type: ProofType;
  fingerprint: string;
  timestamp: string;
  session_id?: string | null;
  plan_id?: string | null;
  previous_proof_id?: string | null;
  input_hash?: string | null;
  output_hash?: string | null;
  data_hash: string;
  data?: Record<string, unknown> | null;
  anchored: boolean;
  anchor_tx_signature?: string | null;
  anchor_slot?: number | null;
  anchor_timestamp?: string | null;
}

export interface ProofBatch {
  id: string;
  session_id: string;
  user_id: string;
  merkle_root: string;
  proof_ids: string[];
  proof_count: number;
  anchored: boolean;
  anchor_tx_signature?: string | null;
  anchor_slot?: number | null;
  anchor_timestamp?: string | null;
}

// --- Error Types ---

export type ErrorCode =
  | "unauthorized"
  | "key_expired"
  | "key_revoked"
  | "forbidden"
  | "subscription_lapsed"
  | "not_found"
  | "validation_error"
  | "rate_limit_exceeded"
  | "session_not_active"
  | "session_already_ended"
  | "plan_not_found"
  | "node_not_found"
  | "proof_not_found"
  | "anchor_failed"
  | "transcription_failed"
  | "analysis_failed"
  | "internal_error";

export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

// --- Request/Response Helpers ---

export interface PaginationParams {
  limit: number;
  offset: number;
}

export interface PaginationResponse {
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

// --- Analysis Input Types ---

export interface AudioInput {
  type: "audio";
  data: string; // base64
  format: string; // webm, mp4, ogg, m4a
  duration_ms?: number;
}

export interface ImageInput {
  type: "image";
  data: string; // base64
  mime_type: string;
  description?: string;
}

export interface TextInput {
  type: "text";
  content: string;
}

export type AnalysisInput = AudioInput | ImageInput | TextInput;

// --- Session Types ---

export type SessionStatus = "active" | "paused" | "completed" | "ended_by_tutor";

// --- Scope requirements per endpoint ---

export const ENDPOINT_SCOPES: Record<string, ApiKeyScope> = {
  "GET /plans": "plans:read",
  "POST /plans": "plans:write",
  "GET /plans/:id": "plans:read",
  "PATCH /plans/:id": "plans:write",
  "DELETE /plans/:id": "plans:write",
  "GET /plans/:id/nodes": "plans:read",
  "POST /plans/:id/adapt": "plans:write",
  "POST /plans/from-video": "plans:write",
  "GET /sessions": "sessions:read",
  "POST /sessions": "sessions:write",
  "GET /sessions/:id": "sessions:read",
  "POST /sessions/:id/analyze": "analysis:write",
  "POST /sessions/:id/pause": "sessions:write",
  "POST /sessions/:id/resume": "sessions:write",
  "POST /sessions/:id/restart": "sessions:write",
  "POST /sessions/:id/end": "sessions:write",
  "GET /sessions/:id/probes": "sessions:read",
  "GET /sessions/:id/plan": "sessions:read",
  "GET /sessions/:id/transcript": "sessions:read",
  "POST /sessions/:id/ask": "assistant:read",
  "GET /sessions/:id/assistant/conversations/:convId": "assistant:read",
  "GET /analytics/plans/:id": "analytics:read",
  "GET /analytics/sessions/:id": "analytics:read",
  "GET /analytics/user": "analytics:read",
  "GET /proofs": "proofs:read",
  "GET /proofs/:id": "proofs:read",
  "GET /proofs/:id/verify": "proofs:read",
  "POST /proofs/:id/anchor": "proofs:anchor",
  "GET /proofs/session/:id/batch": "proofs:read",
};
