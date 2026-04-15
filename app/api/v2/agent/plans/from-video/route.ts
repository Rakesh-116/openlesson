// ============================================
// OpenLesson Agentic API v2 - Create Plan from YouTube Video
// POST /api/v2/agent/plans/from-video
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/agent-v2/auth";
import { createProof, serializeProof } from "@/lib/agent-v2/proofs";
import {
  callOpenRouterWithYouTube,
  VIDEO_MODEL,
} from "@/lib/openrouter-client";
import {
  isValidYouTubeUrl,
  normalizeYouTubeUrl,
  getYouTubeThumbnail,
} from "@/lib/youtube";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DAYS_TO_NODES: Record<number, { min: number; max: number }> = {
  7: { min: 3, max: 5 },
  14: { min: 4, max: 7 },
  30: { min: 5, max: 10 },
  60: { min: 8, max: 14 },
  90: { min: 10, max: 18 },
  180: { min: 15, max: 25 },
};

const DEFAULT_DAYS = 30;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GeneratedNode {
  id: string;
  title: string;
  description: string;
  is_start: boolean;
  next?: string[];
}

interface VideoPlanData {
  title: string;
  summary: string;
  nodes: GeneratedNode[];
}

// ---------------------------------------------------------------------------
// POST /api/v2/agent/plans/from-video
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const result = await authenticateRequest(req, "plans:write");
    if (result instanceof NextResponse) return result;
    const { auth, supabase } = result;

    // Parse & validate body
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, "validation_error", "Invalid JSON body");
    }

    const youtubeUrl = body.youtube_url as string | undefined;
    if (!youtubeUrl || typeof youtubeUrl !== "string") {
      return errorResponse(
        400,
        "validation_error",
        "Field 'youtube_url' is required and must be a string"
      );
    }

    if (!isValidYouTubeUrl(youtubeUrl)) {
      return errorResponse(
        400,
        "validation_error",
        "Invalid YouTube URL. Supported formats: youtube.com/watch?v=..., youtu.be/..., youtube.com/embed/..."
      );
    }

    const normalizedUrl = normalizeYouTubeUrl(youtubeUrl);
    if (!normalizedUrl) {
      return errorResponse(400, "validation_error", "Could not normalize YouTube URL");
    }

    const focusAreas = body.focus_areas as string | undefined;
    const userContext = body.user_context as string | undefined;

    // Resolve duration & node constraints
    const durationDays =
      typeof body.duration_days === "number" && body.duration_days > 0
        ? (body.duration_days as number)
        : DEFAULT_DAYS;

    const closestDays = Object.keys(DAYS_TO_NODES)
      .map(Number)
      .reduce((prev, curr) =>
        Math.abs(curr - durationDays) < Math.abs(prev - durationDays)
          ? curr
          : prev
      );
    const nodeConstraints = DAYS_TO_NODES[closestDays];

    // Build prompt
    const contextParts: string[] = [];
    if (focusAreas) contextParts.push(`Focus areas: ${focusAreas}`);
    if (userContext) contextParts.push(`User context: ${userContext}`);
    const contextBlock =
      contextParts.length > 0
        ? `\nAdditional context:\n${contextParts.join("\n")}\n`
        : "";

    const prompt = `Watch this YouTube video and generate a structured learning plan based on its content.
${contextBlock}
Return ONLY valid JSON with this structure:
{
  "title": "A concise, descriptive title for the learning plan",
  "summary": "A 2-3 sentence summary of the video content",
  "nodes": [
    { "id": "a", "title": "Node Title", "description": "Why this matters and what to learn", "is_start": true, "next": ["b", "c"] }
  ]
}

IMPORTANT CONSTRAINT: The plan should span approximately ${durationDays} days.
- Include ${nodeConstraints.min} to ${nodeConstraints.max} nodes total
- Each node represents one learning session based on the video content

Rules:
- Each node is a distinct learning session derived from the video's topics
- Use single-letter or short IDs for referencing
- is_start: true for nodes that can begin a learning path (typically 1-2)
- next: array of node IDs that follow this node (can be empty for leaf nodes, or have 1-3 entries)
- Create branching paths where appropriate (1 to many connections allowed)
- Keep titles concise (3-8 words)
- Descriptions: 1-2 sentences explaining the concept and relevance
- The summary should capture the main topic and key themes of the video`;

    // Call AI with YouTube video
    const aiResponse = await callOpenRouterWithYouTube<VideoPlanData>(
      prompt,
      normalizedUrl,
      {
        model: VIDEO_MODEL,
        maxTokens: 3000,
        temperature: 0.3,
        responseFormat: "json",
        retries: 2,
        fetchTimeout: 120000,
      }
    );

    if (!aiResponse.success || !aiResponse.data) {
      console.error("[plans:from-video] AI generation failed:", aiResponse.error);
      return errorResponse(
        500,
        "internal_error",
        "Failed to generate learning plan from video"
      );
    }

    const planData = aiResponse.data;

    if (
      !planData.nodes ||
      !Array.isArray(planData.nodes) ||
      planData.nodes.length === 0
    ) {
      console.error("[plans:from-video] Invalid plan data from AI");
      return errorResponse(
        500,
        "internal_error",
        "AI returned invalid plan structure"
      );
    }

    // Get thumbnail
    const thumbnailUrl = getYouTubeThumbnail(normalizedUrl, "high");

    // Create the learning plan record
    const planTitle = planData.title || "Learning Plan from Video";

    const { data: plan, error: planError } = await supabase
      .from("learning_plans")
      .insert({
        user_id: auth.user_id,
        title: planTitle,
        root_topic: planTitle,
        status: "active",
        source_type: "youtube",
        source_url: normalizedUrl,
        source_summary: planData.summary || null,
        cover_image_url: thumbnailUrl,
        is_agent_session: true,
      })
      .select()
      .single();

    if (planError || !plan) {
      console.error("[plans:from-video] Failed to insert plan:", planError);
      return errorResponse(500, "internal_error", "Failed to create plan record");
    }

    // --- Two-pass node creation ---
    // Pass 1: Create nodes, build AI-ID -> DB-UUID map
    const nodeIdMap = new Map<string, string>();

    for (const nodeData of planData.nodes) {
      const { data: node, error: nodeError } = await supabase
        .from("plan_nodes")
        .insert({
          plan_id: plan.id,
          title: nodeData.title,
          description: nodeData.description || "",
          is_start: nodeData.is_start || false,
          next_node_ids: [],
          status: "available",
        })
        .select()
        .single();

      if (nodeError || !node) {
        console.error("[plans:from-video] Failed to insert node:", nodeError);
        continue;
      }
      nodeIdMap.set(nodeData.id, node.id);
    }

    // Pass 2: Resolve next_node_ids
    for (const nodeData of planData.nodes) {
      const dbId = nodeIdMap.get(nodeData.id);
      if (!dbId) continue;

      const resolvedNext: string[] = [];
      if (nodeData.next && Array.isArray(nodeData.next)) {
        for (const nextRef of nodeData.next) {
          const targetId = nodeIdMap.get(nextRef);
          if (targetId) resolvedNext.push(targetId);
        }
      }

      if (resolvedNext.length > 0) {
        await supabase
          .from("plan_nodes")
          .update({ next_node_ids: resolvedNext })
          .eq("id", dbId);
      }
    }

    // Fetch final nodes
    const { data: nodes } = await supabase
      .from("plan_nodes")
      .select(
        "id, title, description, is_start, next_node_ids, status, created_at"
      )
      .eq("plan_id", plan.id)
      .order("created_at", { ascending: true });

    // Generate proof
    const proof = await createProof(supabase, {
      type: "plan_created",
      user_id: auth.user_id,
      plan_id: plan.id,
      event_data: {
        source: "youtube",
        youtube_url: normalizedUrl,
        duration_days: durationDays,
        node_count: nodes?.length ?? 0,
      },
    });

    return NextResponse.json(
      {
        plan: {
          id: plan.id,
          title: plan.title,
          root_topic: plan.root_topic,
          status: plan.status,
          source_type: plan.source_type,
          source_url: plan.source_url,
          source_summary: plan.source_summary,
          cover_image_url: plan.cover_image_url,
          is_agent_session: plan.is_agent_session,
          created_at: plan.created_at,
          updated_at: plan.updated_at,
        },
        nodes: nodes ?? [],
        node_count: nodes?.length ?? 0,
        proof: proof ? serializeProof(proof) : null,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[plans:from-video] Unexpected error:", err);
    return errorResponse(500, "internal_error", "Internal server error");
  }
}
