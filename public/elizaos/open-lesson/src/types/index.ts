export interface LearningPlanNode {
  id: string;
  title: string;
  description: string;
  is_start: boolean;
  next_node_ids: string[];
  status: string;
}

export interface LearningPlanResponse {
  planId: string;
  topic: string;
  days: number;
  nodes: LearningPlanNode[];
}

export interface SessionStartResponse {
  sessionId: string;
  problem: string;
  nodeTitle?: string;
  planId?: string;
  status: string;
  instructions?: {
    audioFormat: string;
    submitEndpoint: string;
    maxChunkDuration: number;
  };
}

export interface AudioAnalysisResponse {
  sessionId: string;
  gapScore: number;
  signals: string[];
  transcript?: string;
  followUpQuestion: string;
  requiresFollowUp: boolean;
}

export interface SessionEndResponse {
  success: boolean;
  sessionId: string;
  message: string;
  chunkCount: number;
  wordCount: number;
}

export interface SessionSummaryResponse {
  ready: boolean;
  sessionId: string;
  report?: string;
  createdAt?: string;
  status: string;
  message?: string;
}

export interface PluginConfig {
  apiKey: string;
  baseUrl: string;
}

export interface GenerateLearningPlanParams {
  topic: string;
  days?: number;
}

export interface StartSessionParams {
  problem: string;
  plan_node_id?: string;
}

export interface AnalyzeAudioParams {
  session_id: string;
  audio_base64: string;
  audio_format: 'webm' | 'mp4' | 'ogg';
}

export interface EndSessionParams {
  session_id: string;
}

export interface GetSessionSummaryParams {
  session_id: string;
}
