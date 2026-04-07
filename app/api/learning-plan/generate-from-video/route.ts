import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callOpenRouterWithYouTube, VIDEO_MODEL } from "@/lib/openrouter-client";
import { isValidYouTubeUrl, normalizeYouTubeUrl } from "@/lib/youtube";
import { generateAndStorePlanCover } from "@/lib/plan-image";

interface NodeData {
  id: string;
  title: string;
  description: string;
  is_start: boolean;
  next?: string[];
}

interface VideoPlanData {
  title: string;
  video_title: string;
  video_summary: string;
  nodes: NodeData[];
}

const DAYS_TO_NODES: Record<number, { min: number; max: number }> = {
  7: { min: 3, max: 5 },
  14: { min: 4, max: 7 },
  30: { min: 5, max: 10 },
  60: { min: 8, max: 14 },
  90: { min: 10, max: 18 },
  180: { min: 15, max: 25 },
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { youtubeUrl, days } = await req.json();
    
    if (!youtubeUrl || typeof youtubeUrl !== "string") {
      return NextResponse.json({ error: "YouTube URL is required" }, { status: 400 });
    }

    // Validate and normalize the YouTube URL
    if (!isValidYouTubeUrl(youtubeUrl)) {
      return NextResponse.json({ error: "Invalid YouTube URL format" }, { status: 400 });
    }

    const normalizedUrl = normalizeYouTubeUrl(youtubeUrl);
    if (!normalizedUrl) {
      return NextResponse.json({ error: "Could not process YouTube URL" }, { status: 400 });
    }

    const daysNum = typeof days === "number" ? days : 30;
    const nodeConstraints = DAYS_TO_NODES[daysNum] || DAYS_TO_NODES[30];

    const prompt = `Analyze this YouTube video and create a structured learning plan based on its educational content.

Return ONLY valid JSON (no markdown, no code blocks) with this exact structure:
{
  "title": "A short, catchy, social-media-friendly title for this learning plan (max 6 words, creative and engaging — NOT just the video title)",
  "video_title": "The title or topic of the video",
  "video_summary": "A 2-3 paragraph summary of the key concepts covered in the video. This should be detailed enough for a tutor to reference when helping a student learn this material. Include main topics, key insights, and any prerequisites that would be helpful.",
  "nodes": [
    { "id": "a", "title": "Session Title", "description": "What the learner will understand after this session", "is_start": true, "next": ["b", "c"] }
  ]
}

IMPORTANT: The learning plan should span approximately ${daysNum} days.
- Include ${nodeConstraints.min} to ${nodeConstraints.max} learning sessions (nodes)
- Each node represents one focused learning session

Rules for nodes:
- Each node is a distinct learning session that builds on previous knowledge
- Use single-letter or short IDs (a, b, c, etc.)
- is_start: true for the foundational node(s) that begin the learning path
- next: array of node IDs that logically follow this node (can be empty for terminal nodes, or have 1-3 entries)
- Create branching paths where topics can be explored in different orders
- Titles should be concise (3-8 words) and action-oriented
- Descriptions should explain the learning outcome, not just summarize content`;

    const response = await callOpenRouterWithYouTube<VideoPlanData>(
      prompt,
      normalizedUrl,
      {
        model: VIDEO_MODEL,
        maxTokens: 4000,
        temperature: 0.3,
        responseFormat: "json",
      }
    );

    if (!response.success || !response.data) {
      console.error("OpenRouter error:", response.error);
      return NextResponse.json({ 
        error: response.error || "Failed to analyze video and generate plan" 
      }, { status: 500 });
    }

    const planData = response.data;

    // Validate response structure
    if (!planData.nodes || !Array.isArray(planData.nodes)) {
      console.error("Invalid plan data format:", planData);
      return NextResponse.json({ error: "Invalid plan data format from AI" }, { status: 500 });
    }

    if (!planData.video_title) {
      planData.video_title = "YouTube Video Learning Plan";
    }

    if (!planData.video_summary) {
      planData.video_summary = "";
    }

    const catchyTitle = planData.title || planData.video_title;

    // Create the learning plan with YouTube source metadata
    const { data: plan, error: planError } = await supabase
      .from("learning_plans")
      .insert({
        user_id: user.id,
        title: catchyTitle,
        root_topic: planData.video_title,
        status: "active",
        source_type: "youtube",
        source_url: normalizedUrl,
        source_summary: planData.video_summary,
      })
      .select()
      .single();

    if (planError || !plan) {
      console.error("Failed to create plan:", planError);
      return NextResponse.json({ error: "Failed to create plan" }, { status: 500 });
    }

    // Create a map to track node IDs
    const nodeIdMap = new Map<string, string>();
    const nodeRefs = planData.nodes;

    // First pass: create all nodes
    for (const nodeData of nodeRefs) {
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
        console.error("Failed to create node:", nodeError);
        continue;
      }

      nodeIdMap.set(nodeData.id, node.id);
    }

    // Second pass: update next_node_ids with actual UUIDs
    for (const nodeData of nodeRefs) {
      const currentNodeId = nodeIdMap.get(nodeData.id);
      if (!currentNodeId) continue;

      const nextIds: string[] = [];
      if (nodeData.next && Array.isArray(nodeData.next)) {
        for (const nextId of nodeData.next) {
          const targetId = nodeIdMap.get(nextId);
          if (targetId) {
            nextIds.push(targetId);
          }
        }
      }

      await supabase
        .from("plan_nodes")
        .update({ next_node_ids: nextIds })
        .eq("id", currentNodeId);
    }

    // Fire-and-forget: generate cover image asynchronously
    generateAndStorePlanCover(
      supabase as any,
      user.id,
      plan.id,
      planData.video_title
    ).catch((err) => console.error("Async cover generation failed:", err));

    return NextResponse.json({ 
      planId: plan.id,
      title: catchyTitle,
      videoTitle: planData.video_title,
    });

  } catch (error) {
    console.error("Generate plan from video error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
