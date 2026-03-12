// ============================================
// SHARED AI CLIENT (supports OpenRouter + xAI Direct)
// Centralized client with retry logic, response format handling, and type safety
// Provider is controlled by AI_PROVIDER env var ("openrouter" | "xai")
// ============================================

import {
  getProvider,
  getChatUrl,
  getEmbeddingUrl,
  getChatHeaders,
  getEmbeddingHeaders,
  getProviderForModel,
  resolveModelId,
  getDefaultModel,
  getDefaultAudioModel,
  getDefaultVideoModel,
  getDefaultEmbeddingModel,
  type AIProvider,
} from "./ai-provider";

// Re-export defaults as computed values for backward compatibility
// Callers that import DEFAULT_MODEL will get the provider-appropriate model
export const DEFAULT_MODEL = getDefaultModel();
export const AUDIO_MODEL = getDefaultAudioModel();
export const VIDEO_MODEL = getDefaultVideoModel();
export const EMBEDDING_MODEL = getDefaultEmbeddingModel();

// ============================================
// TYPES
// ============================================

export interface Message {
  role: "system" | "user" | "assistant";
  content: string | MessageContent[];
}

export type MessageContent =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "input_audio"; input_audio: { data: string; format: string } }
  | { type: "file"; file: { filename: string; file_data: string } }
  | { type: "video_url"; video_url: { url: string } };

export interface JsonSchema {
  name: string;
  strict?: boolean;
  schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
}

export interface OpenRouterConfig {
  model?: string;
  maxTokens: number;
  temperature: number;
  responseFormat?: "json" | "json_schema";
  jsonSchema?: JsonSchema;
  stop?: string | string[];
  retries?: number;
  retryDelay?: number;
  /** Per-request fetch timeout in milliseconds. If set, each fetch attempt will abort after this duration. */
  fetchTimeout?: number;
}

export interface OpenRouterResponse<T = string> {
  success: boolean;
  data?: T;
  rawContent?: string;
  error?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenRouterAPIResponse {
  id: string;
  choices: Array<{
    message: {
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ============================================
// RETRY LOGIC
// ============================================

function isRetryableError(status: number): boolean {
  // Retry on rate limits (429) and server errors (5xx)
  return status === 429 || (status >= 500 && status < 600);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================
// HEADERS (delegated to ai-provider.ts)
// ============================================

function getHeaders(provider?: AIProvider): Record<string, string> {
  return getChatHeaders(provider);
}

// ============================================
// REQUEST BODY BUILDER
// ============================================

interface RequestBody {
  model: string;
  messages: Message[];
  max_tokens: number;
  temperature: number;
  response_format?: { type: "json_object" } | { type: "json_schema"; json_schema: JsonSchema };
  stop?: string | string[];
}

function buildRequestBody(messages: Message[], config: OpenRouterConfig, provider?: AIProvider): RequestBody {
  const modelId = config.model || DEFAULT_MODEL;
  const effectiveProvider = provider ?? getProviderForModel(modelId);
  const body: RequestBody = {
    model: resolveModelId(modelId, effectiveProvider),
    messages,
    max_tokens: config.maxTokens,
    temperature: config.temperature,
  };

  // Add response format
  if (config.responseFormat === "json") {
    body.response_format = { type: "json_object" };
  } else if (config.responseFormat === "json_schema" && config.jsonSchema) {
    body.response_format = {
      type: "json_schema",
      json_schema: config.jsonSchema,
    };
  }

  // Add stop sequences
  if (config.stop) {
    body.stop = config.stop;
  }

  return body;
}

// ============================================
// MAIN CLIENT FUNCTION
// ============================================

/**
 * Make a request to the active AI provider with retry logic and response format handling.
 * Routes to xAI Direct or OpenRouter based on AI_PROVIDER env var and model type.
 * Non-xAI models (Google, Anthropic, OpenAI) always fall back to OpenRouter.
 */
export async function callOpenRouter<T = string>(
  messages: Message[],
  config: OpenRouterConfig
): Promise<OpenRouterResponse<T>> {
  const maxRetries = config.retries ?? 3;
  const baseDelay = config.retryDelay ?? 1000;

  // Determine which provider handles this model
  const modelId = config.model || DEFAULT_MODEL;
  const effectiveProvider = getProviderForModel(modelId);
  const apiUrl = getChatUrl(effectiveProvider);

  let lastError: string | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const headers = getHeaders(effectiveProvider);
      const body = buildRequestBody(messages, config, effectiveProvider);

      const fetchOptions: RequestInit = {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      };

      // Apply per-request timeout if configured
      if (config.fetchTimeout) {
        fetchOptions.signal = AbortSignal.timeout(config.fetchTimeout);
      }

      const providerLabel = effectiveProvider === "xai" ? "xAI" : "OpenRouter";
      const response = await fetch(apiUrl, fetchOptions);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`${providerLabel} API error (attempt ${attempt + 1}):`, response.status, errorText);

        if (isRetryableError(response.status) && attempt < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, attempt);
          console.log(`Retrying in ${delay}ms...`);
          await sleep(delay);
          lastError = `API error: ${response.status}`;
          continue;
        }

        return {
          success: false,
          error: `API error: ${response.status} - ${errorText}`,
        };
      }

      const data: OpenRouterAPIResponse = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        return {
          success: false,
          error: "No content in response",
        };
      }

      // Parse response based on format
      if (config.responseFormat === "json" || config.responseFormat === "json_schema") {
        try {
          // With response_format, content should be valid JSON
          const parsed = JSON.parse(content) as T;
          return {
            success: true,
            data: parsed,
            rawContent: content,
            usage: data.usage,
          };
        } catch (parseError) {
          // Fallback: try to extract JSON from response (for models that don't fully support response_format)
          // First try to find a complete JSON object
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              const parsed = JSON.parse(jsonMatch[0]) as T;
              return {
                success: true,
                data: parsed,
                rawContent: content,
                usage: data.usage,
              };
            } catch {
              // Try cleaning up common issues
              let cleaned = jsonMatch[0]
                .replace(/[\x00-\x1F\x7F]/g, ' ')  // Remove control characters
                .replace(/,\s*}/g, '}')  // Remove trailing commas
                .replace(/,\s*]/g, ']'); // Remove trailing commas in arrays
              
              try {
                const parsed = JSON.parse(cleaned) as T;
                return {
                  success: true,
                  data: parsed,
                  rawContent: content,
                  usage: data.usage,
                };
              } catch {
                console.error("Failed to parse JSON even after cleanup:", cleaned.substring(0, 500));
                return {
                  success: false,
                  error: "Failed to parse JSON from response",
                  rawContent: content,
                };
              }
            }
          }
          console.error("No JSON found in response. Raw content:", content.substring(0, 500));
          return {
            success: false,
            error: "No valid JSON in response",
            rawContent: content,
          };
        }
      }

      // Plain text response
      return {
        success: true,
        data: content.trim() as T,
        rawContent: content,
        usage: data.usage,
      };
    } catch (error) {
      console.error(`OpenRouter request failed (attempt ${attempt + 1}):`, error);
      lastError = error instanceof Error ? error.message : "Unknown error";

      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        await sleep(delay);
        continue;
      }
    }
  }

  return {
    success: false,
    error: lastError || "Request failed after retries",
  };
}

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

/**
 * Call OpenRouter expecting a JSON response
 * Uses json_object response format for reliability
 */
export async function callOpenRouterJSON<T>(
  messages: Message[],
  config: Omit<OpenRouterConfig, "responseFormat">
): Promise<OpenRouterResponse<T>> {
  return callOpenRouter<T>(messages, {
    ...config,
    responseFormat: "json",
    // Lower temperature for JSON responses for consistency
    temperature: Math.min(config.temperature, 0.3),
  });
}

/**
 * Call OpenRouter with strict JSON schema validation
 * Uses json_schema response format for guaranteed structure
 */
export async function callOpenRouterWithSchema<T>(
  messages: Message[],
  schema: JsonSchema,
  config: Omit<OpenRouterConfig, "responseFormat" | "jsonSchema">
): Promise<OpenRouterResponse<T>> {
  return callOpenRouter<T>(messages, {
    ...config,
    responseFormat: "json_schema",
    jsonSchema: schema,
    // Very low temperature for schema-validated responses
    temperature: Math.min(config.temperature, 0.2),
  });
}

/**
 * Call OpenRouter for plain text response (probes, questions, etc.)
 */
export async function callOpenRouterText(
  messages: Message[],
  config: Omit<OpenRouterConfig, "responseFormat">
): Promise<OpenRouterResponse<string>> {
  return callOpenRouter<string>(messages, config);
}

// ============================================
// EMBEDDINGS
// ============================================

export interface EmbeddingResponse {
  success: boolean;
  embeddings?: number[][];
  error?: string;
  usage?: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

/**
 * Generate embeddings. Always uses OpenRouter regardless of AI_PROVIDER setting
 * because xAI does not offer embedding models.
 */
export async function generateEmbeddings(
  texts: string[],
  model: string = EMBEDDING_MODEL
): Promise<EmbeddingResponse> {
  try {
    const headers = getEmbeddingHeaders();

    const response = await fetch(getEmbeddingUrl(), {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        input: texts,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Embeddings API error:", response.status, errorText);
      return {
        success: false,
        error: `API error: ${response.status}`,
      };
    }

    const data = await response.json();
    const embeddings = data.data?.map((item: { embedding: number[] }) => item.embedding);

    if (!embeddings || embeddings.length === 0) {
      return {
        success: false,
        error: "No embeddings in response",
      };
    }

    return {
      success: true,
      embeddings,
      usage: data.usage,
    };
  } catch (error) {
    console.error("Embeddings request failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Generate a single embedding (convenience wrapper)
 * Returns null on failure for backward compatibility
 */
export async function generateEmbedding(
  text: string,
  model: string = EMBEDDING_MODEL
): Promise<number[] | null> {
  const result = await generateEmbeddings([text], model);
  if (!result.success || !result.embeddings || result.embeddings.length === 0) {
    return null;
  }
  return result.embeddings[0];
}

// ============================================
// PREDEFINED JSON SCHEMAS
// ============================================

export const SCHEMAS = {
  gapAnalysis: {
    name: "gap_analysis",
    strict: true,
    schema: {
      type: "object" as const,
      properties: {
        gap_score: { type: "number", description: "Score from 0.0 to 1.0" },
        signals: { type: "array", items: { type: "string" }, description: "Detected gap signals" },
        transcript: { type: "string", description: "Brief summary of what the student said" },
      },
      required: ["gap_score", "signals"],
      additionalProperties: false,
    },
  },

  sessionEndCheck: {
    name: "session_end_check",
    strict: true,
    schema: {
      type: "object" as const,
      properties: {
        should_end: { type: "boolean", description: "Whether the session should end" },
        reason: { type: "string", description: "Brief reason for the decision" },
      },
      required: ["should_end", "reason"],
      additionalProperties: false,
    },
  },

  feedbackAndQuestion: {
    name: "feedback_and_question",
    strict: true,
    schema: {
      type: "object" as const,
      properties: {
        feedback: { type: "string", description: "Brief feedback on student's thinking" },
        question: { type: "string", description: "New guiding question" },
      },
      required: ["feedback", "question"],
      additionalProperties: false,
    },
  },

  sessionPlan: {
    name: "session_plan",
    strict: true,
    schema: {
      type: "object" as const,
      properties: {
        goal: { type: "string", description: "Learning goal for the session" },
        strategy: { type: "string", description: "Approach for guiding the student" },
        steps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["question", "task", "suggestion", "checkpoint"] },
              description: { type: "string" },
              order: { type: "number" },
            },
            required: ["type", "description", "order"],
          },
        },
      },
      required: ["goal", "strategy", "steps"],
      additionalProperties: false,
    },
  },

  sessionPlanUpdate: {
    name: "session_plan_update",
    strict: true,
    schema: {
      type: "object" as const,
      properties: {
        plan_changed: { type: "boolean" },
        updated_steps: { type: "array", items: { type: "object" } },
        current_step_index: { type: "number" },
        next_request: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["question", "task", "suggestion", "checkpoint"] },
            text: { type: "string" },
          },
          required: ["type", "text"],
        },
        reasoning: { type: "string" },
      },
      required: ["plan_changed", "current_step_index", "next_request", "reasoning"],
      additionalProperties: false,
    },
  },

  learningPlanNodes: {
    name: "learning_plan_nodes",
    strict: true,
    schema: {
      type: "object" as const,
      properties: {
        nodes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              title: { type: "string" },
              description: { type: "string" },
              is_start: { type: "boolean" },
              next: { type: "array", items: { type: "string" } },
            },
            required: ["id", "title", "description", "is_start"],
          },
        },
      },
      required: ["nodes"],
      additionalProperties: false,
    },
  },
} as const;

// ============================================
// TEMPERATURE RECOMMENDATIONS
// ============================================

export const RECOMMENDED_TEMPS = {
  // JSON/structured outputs - low temperature for consistency
  json: 0.1,
  jsonSchema: 0.0,

  // Analysis/detection - low temperature for accuracy
  gapDetection: 0.1,
  sessionEndCheck: 0.2,

  // Creative/generative - moderate temperature
  probeGeneration: 0.7,
  openingProbe: 0.7,
  freshQuestion: 0.7, // Lowered from 0.9

  // Conversational - moderate temperature
  chat: 0.7,
  askQuestion: 0.7,

  // Reports/summaries - moderate temperature
  report: 0.6,

  // Transcription - very low for accuracy
  transcription: 0.1,
} as const;

// ============================================
// MULTIMODAL SUPPORT
// ============================================

export interface AudioInput {
  /** Base64-encoded audio data */
  data: string;
  /** Audio format: "wav", "mp3", "ogg", "m4a", etc. */
  format: string;
}

export interface ImageInput {
  /** Base64-encoded image data */
  data: string;
  /** Image MIME type, defaults to "image/png" */
  mimeType?: string;
}

export interface FileInput {
  /** Base64-encoded file data */
  data: string;
  /** Filename with extension */
  filename: string;
  /** MIME type for the file */
  mimeType: string;
}

/**
 * Build multimodal message content with text and audio
 */
export function buildAudioContent(text: string, audio: AudioInput): MessageContent[] {
  return [
    { type: "text", text },
    {
      type: "input_audio",
      input_audio: {
        data: audio.data,
        format: audio.format,
      },
    },
  ];
}

/**
 * Build multimodal message content with text and image
 */
export function buildImageContent(text: string, image: ImageInput): MessageContent[] {
  const mimeType = image.mimeType || "image/png";
  return [
    { type: "text", text },
    {
      type: "image_url",
      image_url: {
        url: `data:${mimeType};base64,${image.data}`,
      },
    },
  ];
}

/**
 * Build multimodal message content with text and file attachment
 */
export function buildFileContent(text: string, file: FileInput): MessageContent[] {
  return [
    { type: "text", text },
    {
      type: "file",
      file: {
        filename: file.filename,
        file_data: `data:${file.mimeType};base64,${file.data}`,
      },
    },
  ];
}

/**
 * Call OpenRouter with audio input (for transcription, gap analysis, etc.)
 * Returns JSON response parsed according to type T
 */
export async function callOpenRouterWithAudio<T>(
  prompt: string,
  audio: AudioInput,
  config: Omit<OpenRouterConfig, "responseFormat"> & { responseFormat?: "json" | "json_schema" | "text" }
): Promise<OpenRouterResponse<T>> {
  const content = buildAudioContent(prompt, audio);
  const messages: Message[] = [{ role: "user", content }];

  if (config.responseFormat === "text" || !config.responseFormat) {
    return callOpenRouter<T>(messages, {
      ...config,
      responseFormat: undefined,
    });
  }

  return callOpenRouter<T>(messages, {
    ...config,
    responseFormat: config.responseFormat as "json" | "json_schema",
    // Lower temperature for audio analysis
    temperature: Math.min(config.temperature, 0.2),
  });
}

/**
 * Call OpenRouter with image input (for whiteboard analysis, etc.)
 * Returns JSON response parsed according to type T
 */
export async function callOpenRouterWithImage<T>(
  prompt: string,
  image: ImageInput,
  config: Omit<OpenRouterConfig, "responseFormat"> & { responseFormat?: "json" | "json_schema" | "text" }
): Promise<OpenRouterResponse<T>> {
  const content = buildImageContent(prompt, image);
  const messages: Message[] = [{ role: "user", content }];

  if (config.responseFormat === "text" || !config.responseFormat) {
    return callOpenRouter<T>(messages, {
      ...config,
      responseFormat: undefined,
    });
  }

  return callOpenRouter<T>(messages, {
    ...config,
    responseFormat: config.responseFormat as "json" | "json_schema",
    // Lower temperature for image analysis
    temperature: Math.min(config.temperature, 0.2),
  });
}

/**
 * Call OpenRouter with file attachment (for audio transcription via file, etc.)
 * Returns text response
 */
export async function callOpenRouterWithFile(
  prompt: string,
  file: FileInput,
  config: Omit<OpenRouterConfig, "responseFormat">
): Promise<OpenRouterResponse<string>> {
  const content = buildFileContent(prompt, file);
  const messages: Message[] = [{ role: "user", content }];

  return callOpenRouter<string>(messages, config);
}

/**
 * Call OpenRouter with optional audio context
 * Useful for probe generation where audio may or may not be present
 */
export async function callOpenRouterWithOptionalAudio(
  prompt: string,
  audio: AudioInput | undefined,
  config: Omit<OpenRouterConfig, "responseFormat">
): Promise<OpenRouterResponse<string>> {
  if (audio) {
    const content = buildAudioContent(prompt, audio);
    const messages: Message[] = [{ role: "user", content }];
    return callOpenRouter<string>(messages, config);
  }

  // No audio, just text
  const messages: Message[] = [{ role: "user", content: prompt }];
  return callOpenRouter<string>(messages, config);
}

/**
 * Build multimodal message content with text and YouTube video URL
 * OpenRouter requires the video_url content type for video processing
 */
export function buildYouTubeContent(prompt: string, youtubeUrl: string): MessageContent[] {
  return [
    {
      type: "video_url",
      video_url: { url: youtubeUrl },
    },
    { type: "text", text: prompt },
  ];
}

/**
 * Call OpenRouter with a YouTube video URL
 * Uses the video_url content type which OpenRouter routes to Gemini for native
 * YouTube video processing (frames + audio).
 * 
 * Note: Google Gemini on AI Studio only supports YouTube links for video_url.
 */
export async function callOpenRouterWithYouTube<T>(
  prompt: string,
  youtubeUrl: string,
  config: Omit<OpenRouterConfig, "responseFormat"> & { responseFormat?: "json" | "json_schema" | "text" }
): Promise<OpenRouterResponse<T>> {
  // Build multimodal content with video_url type
  const content = buildYouTubeContent(prompt, youtubeUrl);
  const messages: Message[] = [{ role: "user", content }];

  if (config.responseFormat === "text" || !config.responseFormat) {
    return callOpenRouter<T>(messages, {
      ...config,
      model: config.model || VIDEO_MODEL,
      responseFormat: undefined,
    });
  }

  return callOpenRouter<T>(messages, {
    ...config,
    model: config.model || VIDEO_MODEL,
    responseFormat: config.responseFormat as "json" | "json_schema",
    // Lower temperature for video analysis to ensure consistent structure
    temperature: Math.min(config.temperature, 0.3),
  });
}

// ============================================
// ADDITIONAL SCHEMAS FOR MULTIMODAL RESPONSES
// ============================================

// Add to SCHEMAS object
export const MULTIMODAL_SCHEMAS = {
  whiteboardAnalysis: {
    name: "whiteboard_analysis",
    strict: true,
    schema: {
      type: "object" as const,
      properties: {
        should_probe: { type: "boolean", description: "Whether to trigger a probe" },
        gap_score: { type: "number", description: "Score from 0.0 to 1.0" },
        signals: { type: "array", items: { type: "string" }, description: "Detected signals" },
        observation: { type: "string", description: "Brief description of what was observed" },
      },
      required: ["should_probe", "gap_score", "signals", "observation"],
      additionalProperties: false,
    },
  },

  notebookAnalysis: {
    name: "notebook_analysis",
    strict: true,
    schema: {
      type: "object" as const,
      properties: {
        should_probe: { type: "boolean", description: "Whether to trigger a probe" },
        gap_score: { type: "number", description: "Score from 0.0 to 1.0" },
        signals: { type: "array", items: { type: "string" }, description: "Detected signals" },
        observation: { type: "string", description: "Brief description of what was observed" },
      },
      required: ["should_probe", "gap_score", "signals", "observation"],
      additionalProperties: false,
    },
  },

  objectives: {
    name: "learning_objectives",
    strict: true,
    schema: {
      type: "object" as const,
      properties: {
        objectives: {
          type: "array",
          items: { type: "string" },
          description: "List of 3 learning objectives",
        },
      },
      required: ["objectives"],
      additionalProperties: false,
    },
  },

  planChatResponse: {
    name: "plan_chat_response",
    strict: true,
    schema: {
      type: "object" as const,
      properties: {
        explanation: { type: "string", description: "Conversational response to the user" },
        planModified: { type: "boolean", description: "Whether the plan was modified" },
        questions: { type: "array", items: { type: "string" }, description: "Clarification questions" },
        sessions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              title: { type: "string" },
              description: { type: "string" },
              order: { type: "number" },
            },
            required: ["title"],
          },
        },
      },
      required: ["explanation"],
      additionalProperties: false,
    },
  },

  planDescription: {
    name: "plan_description",
    strict: true,
    schema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Short descriptive title" },
        overview: { type: "string", description: "2-3 sentences explaining the plan" },
        highlights: { type: "array", items: { type: "string" }, description: "Key points" },
        suggestions: { type: "string", description: "Suggestions for approaching the plan" },
      },
      required: ["overview", "highlights"],
      additionalProperties: false,
    },
  },
} as const;

// ============================================
// SIMPLE MESSAGE BUILDERS
// ============================================

/**
 * Create a simple user message
 */
export function userMessage(content: string): Message {
  return { role: "user", content };
}

/**
 * Create a system message
 */
export function systemMessage(content: string): Message {
  return { role: "system", content };
}

/**
 * Create an assistant message
 */
export function assistantMessage(content: string): Message {
  return { role: "assistant", content };
}

/**
 * Build a conversation from system prompt and user messages
 */
export function buildConversation(
  systemPrompt: string,
  ...userMessages: string[]
): Message[] {
  return [
    systemMessage(systemPrompt),
    ...userMessages.map(userMessage),
  ];
}

/**
 * Build messages from a prompt with optional system prompt
 */
export function buildMessages(prompt: string, systemPrompt?: string): Message[] {
  if (systemPrompt) {
    return [systemMessage(systemPrompt), userMessage(prompt)];
  }
  return [userMessage(prompt)];
}
