// ============================================
// AI PROVIDER CONFIGURATION
// Supports switching between OpenRouter and xAI Direct API
// Set AI_PROVIDER env var to "openrouter" (default) or "xai"
// ============================================

export type AIProvider = "openrouter" | "xai";

// ============================================
// PROVIDER DETECTION
// ============================================

export function getProvider(): AIProvider {
  const provider = (process.env.AI_PROVIDER || "openrouter").toLowerCase().trim();
  if (provider === "xai") return "xai";
  return "openrouter";
}

export function isXAIProvider(): boolean {
  return getProvider() === "xai";
}

// ============================================
// PROVIDER URLs
// ============================================

const PROVIDER_URLS = {
  openrouter: {
    chat: "https://openrouter.ai/api/v1/chat/completions",
    embeddings: "https://openrouter.ai/api/v1/embeddings",
  },
  xai: {
    chat: "https://api.x.ai/v1/chat/completions",
    // xAI does not offer embeddings — always fallback to OpenRouter
    embeddings: "https://openrouter.ai/api/v1/embeddings",
  },
} as const;

export function getChatUrl(provider?: AIProvider): string {
  return PROVIDER_URLS[provider ?? getProvider()].chat;
}

export function getEmbeddingUrl(): string {
  // Embeddings always go through OpenRouter (xAI has no embedding models)
  return PROVIDER_URLS.openrouter.embeddings;
}

// ============================================
// API KEY RESOLUTION
// ============================================

export function getChatApiKey(provider?: AIProvider): string {
  const p = provider ?? getProvider();
  if (p === "xai") {
    const key = process.env.XAI_API_KEY;
    if (!key) throw new Error("XAI_API_KEY not configured. Set it in your .env.local file.");
    return key;
  }
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY not configured. Set it in your .env.local file.");
  return key;
}

export function getEmbeddingApiKey(): string {
  // Embeddings always use OpenRouter
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    throw new Error(
      "OPENROUTER_API_KEY not configured. Embeddings require OpenRouter even when using xAI provider."
    );
  }
  return key;
}

// ============================================
// HEADERS
// ============================================

export function getChatHeaders(provider?: AIProvider): Record<string, string> {
  const p = provider ?? getProvider();
  const apiKey = getChatApiKey(p);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  // OpenRouter requires additional headers
  if (p === "openrouter") {
    headers["HTTP-Referer"] = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    headers["X-Title"] = "openLesson";
  }

  return headers;
}

export function getEmbeddingHeaders(): Record<string, string> {
  // Embeddings always use OpenRouter headers
  const apiKey = getEmbeddingApiKey();
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    "X-Title": "openLesson",
  };
}

// ============================================
// MODEL ID MAPPING
// OpenRouter uses "x-ai/grok-4" format
// xAI Direct uses "grok-4-0709" format
// ============================================

// OpenRouter model ID -> xAI Direct model ID
const MODEL_MAP_TO_XAI: Record<string, string> = {
  "x-ai/grok-4": "grok-4-0709",
  "x-ai/grok-4-fast": "grok-4-fast-reasoning",
  // Grok 4.20 Beta models (same ID on both providers for xAI-native IDs)
  "grok-4.20-beta-0309-reasoning": "grok-4.20-beta-0309-reasoning",
  "grok-4.20-beta-0309-non-reasoning": "grok-4.20-beta-0309-non-reasoning",
  "grok-4.20-multi-agent-beta-0309": "grok-4.20-multi-agent-beta-0309",
  // Older Grok models
  "x-ai/grok-3": "grok-3",
  "x-ai/grok-3-mini": "grok-3-mini",
};

// xAI Direct model ID -> OpenRouter model ID (reverse mapping)
const MODEL_MAP_TO_OPENROUTER: Record<string, string> = {
  "grok-4-0709": "x-ai/grok-4",
  "grok-4-fast-reasoning": "x-ai/grok-4-fast",
  "grok-4-fast-non-reasoning": "x-ai/grok-4-fast",
  "grok-3": "x-ai/grok-3",
  "grok-3-mini": "x-ai/grok-3-mini",
};

/**
 * Translate a model ID from OpenRouter format to xAI Direct format.
 * If no mapping exists, returns the ID as-is (pass-through for non-xAI models).
 */
export function toXAIModelId(openRouterModelId: string): string {
  return MODEL_MAP_TO_XAI[openRouterModelId] || openRouterModelId;
}

/**
 * Translate a model ID from xAI Direct format to OpenRouter format.
 * If no mapping exists, returns the ID as-is.
 */
export function toOpenRouterModelId(xaiModelId: string): string {
  return MODEL_MAP_TO_OPENROUTER[xaiModelId] || xaiModelId;
}

/**
 * Given a model ID (in any format), resolve the correct model ID for the active provider.
 */
export function resolveModelId(modelId: string, provider?: AIProvider): string {
  const p = provider ?? getProvider();
  if (p === "xai") {
    return toXAIModelId(modelId);
  }
  return toOpenRouterModelId(modelId);
}

/**
 * Check if a model is an xAI model (Grok family) that can be served by xAI Direct.
 * Non-xAI models (Google, Anthropic, OpenAI) must always go through OpenRouter.
 */
export function isXAIModel(modelId: string): boolean {
  // Check if it's in our mapping
  if (MODEL_MAP_TO_XAI[modelId] || MODEL_MAP_TO_OPENROUTER[modelId]) return true;
  // Check by prefix
  if (modelId.startsWith("x-ai/") || modelId.startsWith("grok-")) return true;
  return false;
}

/**
 * Determine which provider should actually handle a given model.
 * Even when AI_PROVIDER=xai, non-xAI models (Google Gemini, Anthropic, OpenAI)
 * fall back to OpenRouter.
 */
export function getProviderForModel(modelId: string): AIProvider {
  const configuredProvider = getProvider();
  if (configuredProvider === "xai" && isXAIModel(modelId)) {
    return "xai";
  }
  // Non-xAI models or OpenRouter provider -> always OpenRouter
  return "openrouter";
}

// ============================================
// DEFAULT MODELS PER PROVIDER
// ============================================

export function getDefaultModel(): string {
  if (getProvider() === "xai") {
    return "grok-4.20-beta-0309-reasoning";
  }
  return "x-ai/grok-4";
}

export function getDefaultAudioModel(): string {
  // Audio model is always Google Gemini via OpenRouter
  return "google/gemini-2.5-flash";
}

export function getDefaultVideoModel(): string {
  // Video model is always Google Gemini via OpenRouter
  return "google/gemini-2.5-flash";
}

export function getDefaultEmbeddingModel(): string {
  // Embedding model is always Google Gemini via OpenRouter
  return "google/gemini-embedding-001";
}

// ============================================
// AVAILABLE MODELS LIST (for UI selectors)
// ============================================

export interface ModelOption {
  id: string;
  label: string;
  description: string;
  provider: "xai" | "openrouter" | "both";
}

export const ALL_AVAILABLE_MODELS: ModelOption[] = [
  // xAI models -- available on both providers
  { id: "x-ai/grok-4", label: "Grok 4", description: "Most capable xAI model (stable)", provider: "both" },
  { id: "x-ai/grok-4-fast", label: "Grok 4 Fast", description: "Fast xAI model", provider: "both" },
  // Grok 4.20 Beta -- xAI Direct only (not yet on OpenRouter)
  { id: "grok-4.20-beta-0309-reasoning", label: "Grok 4.20 Beta (Reasoning)", description: "Newest flagship with reasoning. xAI Direct only.", provider: "xai" },
  { id: "grok-4.20-beta-0309-non-reasoning", label: "Grok 4.20 Beta (Fast)", description: "Newest flagship, no reasoning. xAI Direct only.", provider: "xai" },
  // Non-xAI models -- OpenRouter only
  { id: "anthropic/claude-sonnet-4", label: "Claude Sonnet 4", description: "Balanced Anthropic model. OpenRouter only.", provider: "openrouter" },
  { id: "openai/gpt-4o", label: "GPT-4o", description: "OpenAI flagship. OpenRouter only.", provider: "openrouter" },
];

/**
 * Get models available for the current provider configuration.
 */
export function getAvailableModels(): ModelOption[] {
  const provider = getProvider();
  return ALL_AVAILABLE_MODELS.filter(
    (m) => m.provider === "both" || m.provider === provider || provider === "openrouter"
  );
}

// ============================================
// PROVIDER INFO (for admin display)
// ============================================

export interface ProviderInfo {
  provider: AIProvider;
  label: string;
  defaultModel: string;
  chatUrl: string;
  hasXAIKey: boolean;
  hasOpenRouterKey: boolean;
}

export function getProviderInfo(): ProviderInfo {
  const provider = getProvider();
  return {
    provider,
    label: provider === "xai" ? "xAI Direct" : "OpenRouter",
    defaultModel: getDefaultModel(),
    chatUrl: getChatUrl(provider),
    hasXAIKey: !!process.env.XAI_API_KEY,
    hasOpenRouterKey: !!process.env.OPENROUTER_API_KEY,
  };
}
