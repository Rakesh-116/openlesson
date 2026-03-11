// ============================================
// OPENROUTER CLIENT FOR OPENLESSON
// Guided questioning + probe generation
// Now uses shared client for consistency and retry logic
// ============================================

import {
  callOpenRouterText,
  callOpenRouterJSON,
  callOpenRouterWithAudio,
  callOpenRouterWithImage,
  callOpenRouterWithFile,
  callOpenRouterWithOptionalAudio,
  generateEmbeddings as clientGenerateEmbeddings,
  userMessage,
  buildMessages,
  DEFAULT_MODEL,
  AUDIO_MODEL,
  RECOMMENDED_TEMPS,
  type OpenRouterResponse,
} from "./openrouter-client";

const MODEL = DEFAULT_MODEL;
const MULTIMODAL_MODEL = AUDIO_MODEL; // For audio/image input (Grok doesn't support these)

// ============================================
// DEFAULT PROMPTS (exported for user customization)
// ============================================

export const DEFAULT_PROMPTS = {
  gap_detection: `Analyze this audio for gaps in reasoning while the student works through a problem.

Problem being worked on: {problem}

Listen for gaps such as:
- Hesitations, long pauses, trailing off mid-thought
- Unexamined assumptions taken for granted
- Contradictions or inconsistencies in reasoning
- Circular thinking or going in loops
- Skipping steps or jumping to conclusions
- Confusion markers ("I don't know", "wait", "hmm", going in circles)

Rate the gap level from 0.0 to 1.0 where:
- 0.0-0.3: Confident, flowing reasoning process
- 0.4-0.6: Some hesitation, minor gaps in reasoning
- 0.7-1.0: Clear gaps, contradictions, or stuck thinking

Return ONLY valid JSON with this structure:
{"gap_score": <float 0.0-1.0>, "signals": ["signal1", "signal2"], "transcript": "brief summary of what the student said"}

Be concise with signals - max 3 items. Use categories like: "hesitation", "unexamined assumption", "contradiction", "circular reasoning", "skipped step", "confusion".`,

  opening_probe: `You are an expert tutor who guides learners through questions, not answers. You don't ask surface-level questions. You find the single most important assumption, distinction, or contradiction hiding inside a topic and crack it open with one precise question.

The student is working towards solving: {problem}
{objectives}

Your task: generate ONE opening question that forces genuine thinking about this specific problem. Follow these principles:

GUIDED QUESTIONING — what it actually is:
- Find the concept the student THINKS they understand but probably can't clearly define or defend in the context of solving THIS problem.
- Expose a hidden tension, paradox, or unstated assumption within this specific problem.
- Force them to make a distinction they haven't considered that's relevant to reaching a solution.
- Ask something where the obvious answer is wrong, or where two plausible answers contradict each other.

GOOD question patterns (use these as inspiration, don't copy literally):
- "If [concept A] is true for this problem, then how do you explain [contradicting observation B]?"
- "What's the difference between [thing most people confuse] and [what's actually needed to solve this]?"
- "Can you solve [aspect of problem] without [other aspect]? Why or why not?"
- "When solving this problem, what exactly are you trying to achieve?"
- "What would have to be true for [this approach] to NOT work?"

BAD questions (never do these):
- Generic icebreakers: "What do you already know about X?"
- Meta questions: "How would you approach this?" or "What assumptions do you have?"
- Anything a search engine could answer directly.
- Leading questions that hint at the answer.

Rules:
- The question must be directly about solving THIS specific problem.
- It should feel slightly uncomfortable — the kind of question that makes someone pause and realize they're less sure than they thought.
- Max 25 words. Warm but intellectually rigorous.
- ONLY output the question. No preamble, no quotes, no formatting.`,

  probe_generation: `You are an attentive tutor watching someone work through a problem.

Problem they're working to solve: {problem}
{objectives}

A gap in their reasoning was detected (gap score: {score}, signals: {signals}).

{rag_context}

Previous probes already asked (don't repeat these):
{previous_probes}

Generate ONE probing question to help them make progress toward SOLVING this specific problem. Rules:
- ONLY ask a question. Never give answers, hints, or suggestions.
- Target the specific gap detected (assumption, contradiction, etc.) that's blocking progress.
- Keep it short (1 sentence, max 20 words).
- Make it feel like a natural thought the student might have themselves.
- Be genuinely curious, not leading or rhetorical.
- Focus on helping them make progress toward a solution, not just understanding the topic.

Return ONLY the question text, no JSON or formatting.`,

  session_end_check: `Based on this tutoring session so far:
- Duration: {elapsed}
- Probes triggered: {count}
- Recent gap scores: {recent_scores}
- Problem: {problem}

Should this session end? Return ONLY valid JSON:
{"should_end": true/false, "reason": "brief reason"}

End the session if:
- The student has been stuck for a long time with no improvement (gap scores not decreasing)
- The session has been very long (>30 min) and gaps are increasing
- The student seems to have resolved the problem (consistently low gap scores for several checks)

Otherwise, keep going.`,

  report_generation: `You are reviewing a tutoring session.

Problem: {problem}
Duration: {duration}
Number of probes triggered: {count}
Average gap score: {avg_gap}
Probes and their gap signals:
{probes_summary}

{eeg_context}

Generate a structured report (markdown) covering:
1. **Session Overview** - brief summary of what happened
2. **Key Gaps Identified** - the main reasoning gaps detected
3. **Progress Arc** - how the student's thinking evolved (did gaps decrease over time?)
4. **Strengths** - what the student did well
5. **Areas to Improve** - specific recommendations for next session
6. **Suggested Next Steps** - 2-3 concrete things to practice

Keep it encouraging but honest. 300-500 words.`,

  expand_probe: `The student engaged with this guiding question while working on a problem:

Problem: {problem}
Original question: "{probe}"

They clicked on the question wanting to go deeper. Generate 2-3 follow-up probing questions that dig into the same reasoning gap.

Rules:
- ONLY ask questions. Never give answers, hints, or suggestions.
- Each question should probe a different angle of the same gap.
- Keep each question to 1 sentence.
- Make them progressively deeper.

Return the questions as a numbered list, nothing else.`,

  ask_question: `You are a knowledgeable tutor helping a student who is working through a problem using guided questioning.

Problem they're working on: {problem}
The current guiding question being explored: "{probe}"

The student has asked you a direct question:
"{question}"

Answer their question clearly and helpfully. Rules:
- Be concise but thorough (2-4 paragraphs max).
- If the question is about the problem or the guiding question, give a substantive answer.
- If the question is off-topic, gently redirect to the problem at hand.
- Use examples when helpful.
- Be encouraging and supportive.`,

  generate_objectives: `You are designing learning objectives for a tutoring session.

Problem topic: {problem}

Generate exactly 3 learning objectives that the student should achieve by the end of this session. Rules:
- Each objective should be specific and measurable
- They should represent genuine understanding, not just surface-level knowledge
- Focus on conceptual understanding, critical thinking, and ability to apply concepts
- Format as a JSON array of strings, nothing else
- Each objective should be 5-15 words
- Make them challenging but achievable in a single session`,

  feedback_and_question: `You are a tutor providing feedback and generating a follow-up question.

Problem being worked on: {problem}

Session so far:
- Previous probes asked: {previous_probes}
- Student's recent responses context: {recent_context}

Provide:
1. Brief feedback (1-2 sentences) on the student's thinking so far
2. Then generate ONE new guiding question that builds on their response

Format as JSON:
{"feedback": "your feedback here", "question": "your new question here"}

Rules for feedback:
- Be specific to what they said, not generic
- Acknowledge their reasoning before pushing deeper
- Be encouraging but honest about gaps

Rules for the new question:
- Only ask a question, never give answers
- Build on their last response, don't repeat previous questions
- Keep it short (max 20 words)
- Make it feel like a natural thought they should consider`,

  fresh_question: `You are a tutor using guided questioning. The student is stuck and needs a completely fresh perspective.

Problem they're working on: {problem}

Previous questions already asked that didn't help:
{previous_probes}

Generate a brand new guiding question from a completely different angle. Rules:
- Try a different concept, assumption, or approach than previous questions
- Only ask a question, never give answers or hints
- Keep it short (max 20 words)
- Make it feel like a new insight they haven't considered
- Focus on a different aspect of the problem

Return ONLY the question text, no JSON or formatting.`,

  // ============================================
  // SESSION PLANNER PROMPTS
  // ============================================

  session_plan_create: `You are a learning session planner. Your job is to create a strategic plan to guide a student through understanding a topic using Socratic questioning and active learning techniques.

Problem/Topic: {problem}
Session Objectives: {objectives}
Student Background (if available): {calibration}

Create a session plan with:
1. A clear learning GOAL (1-2 sentences describing what the student should understand by the end)
2. A STRATEGY for achieving it (your approach to guiding them - be specific about techniques you'll use)
3. A brief DESCRIPTION (1-2 sentences summarizing what this session covers, for display purposes)
4. An ordered list of 5-8 STEPS that mix different types of interactions

Each step should have:
- type: one of "question" | "task" | "suggestion" | "checkpoint"
  - question: Socratic probing questions to expose gaps or deepen understanding
  - task: Direct activities like "Try solving...", "Write down...", "Draw a diagram of..."
  - suggestion: Soft guidance like "Consider looking at...", "Think about..."
  - checkpoint: Review moments like "Let's summarize...", "What have you understood so far?"
- description: What to present to the student (keep it concise, 1-2 sentences max)
- order: Sequential number starting from 1

Make the plan adaptive - start with foundational understanding, then build complexity. Include at least one checkpoint in the middle and one near the end.

Return ONLY valid JSON (no markdown, no explanation):
{
  "goal": "...",
  "strategy": "...",
  "description": "...",
  "steps": [
    {"type": "question", "description": "...", "order": 1},
    {"type": "task", "description": "...", "order": 2},
    {"type": "checkpoint", "description": "...", "order": 3},
    ...
  ]
}`,

  session_plan_update: `You are monitoring an active learning session and deciding whether the plan needs adjustment based on the student's progress.

CURRENT PLAN:
- Goal: {goal}
- Strategy: {strategy}
- Steps: {steps}
- Current Step Index: {current_step} (0-indexed)

RECENT OBSERVATIONS:
- Gap Score: {gap_score} (0.0-1.0, higher = more confusion/gaps detected)
- Signals: {signals}
- Recent Transcript: {transcript}
- Traffic Light Status: {traffic_light} (red=struggling, yellow=some difficulty, green=progressing well)
- Requests/Probes Already Presented: {previous_probes}

PROBE MANAGEMENT:
- Current Open Probes (not archived): {open_probe_count} / 5 maximum
- Focused Probes (user is actively working on these): {focused_probes}

AVAILABLE ILE TOOLS (for tool suggestions):
- chat: Teaching Assistant - Get Socratic guidance from the AI tutor
- canvas: Canvas - Draw diagrams, visualizations, or work through problems visually
- notebook: Notebook - Write down thoughts, insights, and notes
- grokipedia: Grokipedia - Search external knowledge sources

IMPORTANT CONSTRAINT: There can be a maximum of 5 open (non-archived) probes at any time. If open_probe_count is already 5:
- You MUST NOT generate a new probe unless you can archive at least one existing probe
- Evaluate the focused probes and any probes that seem addressed based on the transcript/context
- If you determine a probe has been adequately addressed, include its ID in "probes_to_archive"

Based on these observations, decide:
1. Should the plan change? Consider:
   - Is the student stuck on a concept? (might need to add a simpler step or suggestion)
   - Is the student progressing faster than expected? (might skip ahead)
   - Are there unexpected gaps that the plan doesn't address?
   - Is the current step completed or should we stay on it?

2. Should the session PAUSE for a break?
   - Is the student overwhelmed, frustrated, or showing signs of fatigue?
   - Would stepping away help them process what they've learned?
   - Are they spinning in circles without making progress?

3. What is the NEXT REQUEST to give the student?
   - This could be the next step in the plan, a modified version, or something adaptive
   - Match the type (question/task/suggestion/checkpoint/feedback) to what the student needs right now
   - Use "feedback" type when giving encouragement, acknowledging progress, or suggesting a break
   - If at probe cap (5) and cannot archive any, set next_request to null
   - For "task" type requests, consider which ILE tools would help and include 1-2 suggested_tools

4. Should any probes be auto-archived?
   - Check if focused probes have been addressed (evidence in transcript, whiteboard, or actions)
   - Check if any non-focused probes are clearly resolved
   - Only archive if there's clear evidence the student has engaged with and addressed the probe

Return ONLY valid JSON:
{
  "plan_changed": true/false,
  "should_pause": true/false,
  "pause_reason": "Brief explanation if should_pause is true",
  "updated_steps": [...],
  "current_step_index": <number>,
  "next_request": {
    "type": "question" | "task" | "suggestion" | "checkpoint" | "feedback",
    "text": "The actual text to show the student",
    "suggested_tools": ["canvas", "notebook"]
  } | null,
  "probes_to_archive": ["probe_id_1", "probe_id_2"],
  "can_generate_probe": true/false,
  "reasoning": "Brief 1-sentence explanation of your decision"
}

If plan_changed is false, updated_steps can be omitted or be the same as current steps.
If should_pause is false, pause_reason can be omitted.
If no probes should be archived, probes_to_archive should be an empty array.
Set can_generate_probe to false if at probe cap (5) and cannot archive any.
The next_request should be ready to display directly to the student - make it engaging and clear.
suggested_tools is optional - only include it for "task" or "suggestion" types where specific tools would help. Use tool IDs from the list above (chat, canvas, notebook, grokipedia).`,

  // ============================================
  // PROBE ARCHIVE CHECK
  // ============================================

  check_probe_archive: `You are evaluating whether a probe (guiding question) has been adequately addressed by the student and can be archived.

PROBE TO EVALUATE:
"{probe_text}"

SESSION CONTEXT:
- Goal: {session_goal}
- Recent Transcript: {transcript}
- Whiteboard/Visual Data: {whiteboard_data}
- Activity Data: {activity_data}

A probe should be ARCHIVED if:
1. The student has verbally addressed the question (even partially) showing they've engaged with the underlying concept
2. Evidence in whiteboard/code shows they've worked through the issue the probe was targeting
3. The student has moved past this concept to more advanced thinking
4. The probe is no longer relevant to their current line of inquiry

A probe should NOT be archived if:
1. There's no evidence the student has engaged with it
2. The underlying gap the probe was targeting is still present
3. The student explicitly expressed confusion about this topic recently
4. Archiving it would leave a critical gap unaddressed

Return ONLY valid JSON:
{
  "can_archive": true/false,
  "reason": "Brief explanation (1-2 sentences) of why this probe can or cannot be archived"
}`,

} as const;

export type PromptKey = keyof typeof DEFAULT_PROMPTS;

export type UserPrompts = Partial<Record<PromptKey, string>>;

/** Get the effective prompt: user override if set, otherwise default */
function getPrompt(key: PromptKey, overrides?: UserPrompts): string {
  return overrides?.[key] || DEFAULT_PROMPTS[key];
}

// ============================================
// Prompt metadata (labels + descriptions for the UI)
// ============================================

export const PROMPT_META: Record<PromptKey, { label: string; description: string }> = {
  gap_detection: {
    label: "Gap Detection",
    description: "Analyzes audio to detect reasoning gaps. Variables: {problem}",
  },
  opening_probe: {
    label: "Opening Question",
    description: "First guiding question when a session starts. Variables: {problem}",
  },
  probe_generation: {
    label: "Probe Generation",
    description: "Generates probes during the session. Variables: {problem}, {score}, {signals}, {rag_context}, {previous_probes}",
  },
  session_end_check: {
    label: "Session End Check",
    description: "Decides if the session should end. Variables: {elapsed}, {count}, {recent_scores}, {problem}",
  },
  report_generation: {
    label: "Session Report",
    description: "Generates the post-session report. Variables: {problem}, {duration}, {count}, {avg_gap}, {probes_summary}, {eeg_context}",
  },
  expand_probe: {
    label: "Expand Probe",
    description: "Generates follow-up questions when user clicks 'Go deeper'. Variables: {problem}, {probe}",
  },
  ask_question: {
    label: "Ask Question",
    description: "Answers a direct question from the student. Variables: {problem}, {probe}, {question}",
  },
  generate_objectives: {
    label: "Generate Objectives",
    description: "Generates session objectives at start. Variables: {problem}",
  },
  feedback_and_question: {
    label: "Feedback + Question",
    description: "Provides feedback and generates follow-up. Variables: {problem}, {previous_probes}, {recent_context}",
  },
  fresh_question: {
    label: "Fresh Question",
    description: "Generates new question from different angle. Variables: {problem}, {previous_probes}",
  },
  session_plan_create: {
    label: "Session Plan Creation",
    description: "Creates the initial learning plan for a session. Variables: {problem}, {objectives}, {calibration}",
  },
  session_plan_update: {
    label: "Session Plan Update",
    description: "Updates the plan during the session based on observations. Variables: {goal}, {strategy}, {steps}, {current_step}, {gap_score}, {signals}, {transcript}, {traffic_light}, {previous_probes}",
  },
  check_probe_archive: {
    label: "Probe Archive Check",
    description: "Evaluates if a probe can be archived based on student progress. Variables: {probe_text}, {session_goal}, {transcript}, {whiteboard_data}, {activity_data}",
  },
};

// ============================================
// GAP DETECTION
// ============================================

export interface GapAnalysisResult {
  gap_score: number;
  signals: string[];
  transcript?: string;
}

export interface AnalyzeGapOptions {
  audioBase64: string;
  audioFormat: string;
  problem: string;
  promptOverrides?: UserPrompts;
}

export async function analyzeGap(
  options: AnalyzeGapOptions
): Promise<{ success: boolean; result?: GapAnalysisResult; error?: string }> {
  const prompt = getPrompt("gap_detection", options.promptOverrides)
    .replace("{problem}", options.problem);

  const response = await callOpenRouterWithAudio<GapAnalysisResult>(
    prompt,
    { data: options.audioBase64, format: options.audioFormat },
    {
      model: MULTIMODAL_MODEL, // Must use audio-capable model
      maxTokens: 300,
      temperature: RECOMMENDED_TEMPS.gapDetection,
      responseFormat: "json",
    }
  );

  if (!response.success || !response.data) {
    console.error("analyzeGap failed:", response.error, "rawContent:", response.rawContent?.substring(0, 300));
    return { success: false, error: response.error || "No response" };
  }

  // Normalize the result
  const result = response.data;
  result.gap_score = Math.max(0, Math.min(1, result.gap_score || 0));
  result.signals = result.signals || [];
  result.transcript = result.transcript || "";

  return { success: true, result };
}

// ============================================
// OPENING PROBE (Session Kickoff Question)
// ============================================

export async function generateOpeningProbe(
  problem: string,
  promptOverrides?: UserPrompts,
  objectives?: string[]
): Promise<{ success: boolean; probe?: string; error?: string }> {
  const prompt = getPrompt("opening_probe", promptOverrides)
    .replace("{problem}", problem)
    .replace(
      "{objectives}",
      objectives && objectives.length > 0
        ? `Session goals to work towards:\n${objectives.map((o, i) => `${i + 1}. ${o}`).join("\n")}`
        : ""
    );

  const response = await callOpenRouterText(
    [userMessage(prompt)],
    {
      model: MODEL,
      maxTokens: 100,
      temperature: RECOMMENDED_TEMPS.openingProbe,
    }
  );

  if (!response.success || !response.data) {
    return { success: false, error: response.error || "No opening probe generated" };
  }

  return { success: true, probe: response.data };
}

// ============================================
// PROBE GENERATION (Guiding Questions)
// ============================================

export interface GenerateProbeOptions {
  problem: string;
  gapScore: number;
  signals: string[];
  previousProbes: string[];
  ragContext?: string;
  audioBase64?: string;
  audioFormat?: string;
  promptOverrides?: UserPrompts;
  objectives?: string[];
}

export async function generateProbe(
  options: GenerateProbeOptions
): Promise<{ success: boolean; probe?: string; error?: string }> {
  const prompt = getPrompt("probe_generation", options.promptOverrides)
    .replace("{problem}", options.problem)
    .replace(
      "{objectives}",
      options.objectives && options.objectives.length > 0
        ? `Session goals to work towards:\n${options.objectives.map((o, i) => `${i + 1}. ${o}`).join("\n")}`
        : "No specific session goals defined yet."
    )
    .replace("{score}", options.gapScore.toFixed(2))
    .replace("{signals}", options.signals.join(", ") || "general hesitation")
    .replace(
      "{previous_probes}",
      options.previousProbes.length > 0
        ? options.previousProbes.map((p, i) => `${i + 1}. ${p}`).join("\n")
        : "None yet"
    )
    .replace(
      "{rag_context}",
      options.ragContext
        ? `Context from this student's past think-aloud sessions:\n---\n${options.ragContext}\n---\n`
        : ""
    );

  // Use optional audio if provided
  const audio = options.audioBase64 && options.audioFormat
    ? { data: options.audioBase64, format: options.audioFormat }
    : undefined;

  const response = await callOpenRouterWithOptionalAudio(
    prompt,
    audio,
    {
      model: MODEL,
      maxTokens: 150,
      temperature: RECOMMENDED_TEMPS.probeGeneration,
    }
  );

  if (!response.success || !response.data) {
    return { success: false, error: response.error || "No probe generated" };
  }

  return { success: true, probe: response.data };
}

// ============================================
// SESSION END CHECK (Tutor-Initiated)
// ============================================

export interface SessionEndCheckResult {
  should_end: boolean;
  reason: string;
}

export async function checkSessionEnd(options: {
  elapsed: string;
  probeCount: number;
  recentScores: number[];
  problem: string;
  promptOverrides?: UserPrompts;
}): Promise<{ success: boolean; result?: SessionEndCheckResult; error?: string }> {
  const prompt = getPrompt("session_end_check", options.promptOverrides)
    .replace("{elapsed}", options.elapsed)
    .replace("{count}", options.probeCount.toString())
    .replace("{recent_scores}", options.recentScores.map(s => s.toFixed(2)).join(", ") || "none yet")
    .replace("{problem}", options.problem);

  const response = await callOpenRouterJSON<SessionEndCheckResult>(
    [userMessage(prompt)],
    {
      model: MODEL,
      maxTokens: 100,
      temperature: RECOMMENDED_TEMPS.sessionEndCheck,
    }
  );

  if (!response.success || !response.data) {
    return { success: false, error: response.error || "No response" };
  }

  return { success: true, result: response.data };
}

// ============================================
// REPORT GENERATION
// ============================================

export async function generateReport(options: {
  problem: string;
  duration: string;
  probeCount: number;
  avgGapScore: number;
  probesSummary: string;
  eegContext?: string;
  promptOverrides?: UserPrompts;
}): Promise<{ success: boolean; report?: string; error?: string }> {
  const prompt = getPrompt("report_generation", options.promptOverrides)
    .replace("{problem}", options.problem)
    .replace("{duration}", options.duration)
    .replace("{count}", options.probeCount.toString())
    .replace("{avg_gap}", options.avgGapScore.toFixed(2))
    .replace("{probes_summary}", options.probesSummary || "No probes triggered")
    .replace(
      "{eeg_context}",
      options.eegContext
        ? `EEG Data Summary:\n${options.eegContext}\n\nInclude observations about the student's brain state patterns and how they correlated with reasoning gaps.`
        : ""
    );

  const response = await callOpenRouterText(
    [userMessage(prompt)],
    {
      model: MODEL,
      maxTokens: 1500,
      temperature: RECOMMENDED_TEMPS.report,
    }
  );

  if (!response.success || !response.data) {
    return { success: false, error: response.error || "No report generated" };
  }

  return { success: true, report: response.data };
}

// ============================================
// TRANSCRIPT GENERATION (Full session audio → text)
// ============================================

export async function transcribeAudio(options: {
  audioBase64: string;
  audioFormat: string;
  problem: string;
}): Promise<{ success: boolean; transcript?: string; error?: string }> {
  if (!options.audioBase64 || options.audioBase64.trim().length === 0) {
    return { success: false, error: "Empty audio data" };
  }

  const prompt = `Transcribe this audio recording of a student thinking aloud while working through a problem.

Problem being worked on: ${options.problem}

Produce a faithful, verbatim transcript of everything the student says. Include:
- All words spoken, including filler words (um, uh, like, you know)
- Indicate notable pauses with [pause]
- Indicate long silences with [long silence]
- Indicate unclear speech with [inaudible]
- Use natural paragraph breaks when the student shifts topics or takes a significant pause

Do NOT summarize. Do NOT add commentary or analysis. Do NOT include timestamps.
Output ONLY the transcript text, nothing else.`;

  const response = await callOpenRouterWithFile(
    prompt,
    {
      data: options.audioBase64,
      filename: `session.${options.audioFormat}`,
      mimeType: `audio/${options.audioFormat}`,
    },
    {
      model: MULTIMODAL_MODEL, // Must use audio-capable model
      maxTokens: 8000,
      temperature: RECOMMENDED_TEMPS.transcription,
    }
  );

  if (!response.success || !response.data) {
    return { success: false, error: response.error || "No transcript generated" };
  }

  return { success: true, transcript: response.data };
}

// ============================================
// WHITEBOARD ANALYSIS (Image-based gap detection)
// ============================================

export interface WhiteboardAnalysisResult {
  should_probe: boolean;
  gap_score: number;
  signals: string[];
  observation: string;
}

export interface AnalyzeWhiteboardOptions {
  imageBase64: string;
  problem: string;
  promptOverrides?: UserPrompts;
}

export async function analyzeWhiteboard(
  options: AnalyzeWhiteboardOptions
): Promise<{ success: boolean; result?: WhiteboardAnalysisResult; error?: string }> {
  const prompt = `You are analyzing a student's whiteboard/drawing during a tutoring session.

Problem being worked on: ${options.problem}

Look at this drawing and analyze what the student is thinking. Look for:
- Confusion or uncertainty (messy, crossed-out areas, question marks)
- Assumptions being made (diagrams with unstated premises)
- Gaps in reasoning (incomplete equations, missing steps)
- Conceptual misunderstandings (incorrect relationships shown)
- Progress or breakthroughs (organized, clear solutions)

Rate the gap level from 0.0 to 1.0:
- 0.0-0.3: Clear, confident work
- 0.4-0.6: Some confusion or incomplete thinking
- 0.7-1.0: Significant gaps, misconceptions, or stuck thinking

Return ONLY valid JSON:
{"should_probe": true/false, "gap_score": <0.0-1.0>, "signals": ["signal1", "signal2"], "observation": "brief description of what you see"}

Max 3 signals. Use categories like: "incomplete_diagram", "misconception", "confusion", "assumption", "contradiction", "missing_step".`;

  const response = await callOpenRouterWithImage<WhiteboardAnalysisResult>(
    prompt,
    { data: options.imageBase64, mimeType: "image/png" },
    {
      model: MULTIMODAL_MODEL, // Must use image-capable model
      maxTokens: 300,
      temperature: 0.2,
      responseFormat: "json",
    }
  );

  if (!response.success || !response.data) {
    return { success: false, error: response.error || "No response" };
  }

  // Normalize the result
  const result = response.data;
  result.gap_score = Math.max(0, Math.min(1, result.gap_score || 0));
  result.should_probe = result.should_probe ?? result.gap_score >= 0.5;
  result.signals = result.signals || [];
  result.observation = result.observation || "";

  return { success: true, result };
}

// ============================================
// NOTEBOOK ANALYSIS (Text-based gap detection)
// ============================================

export interface NotebookAnalysisResult {
  should_probe: boolean;
  gap_score: number;
  signals: string[];
  observation: string;
}

export interface AnalyzeNotebookOptions {
  content: string;
  problem: string;
  promptOverrides?: UserPrompts;
}

export async function analyzeNotebook(
  options: AnalyzeNotebookOptions
): Promise<{ success: boolean; result?: NotebookAnalysisResult; error?: string }> {
  const prompt = `You are analyzing a student's written notes during a tutoring session.

Problem being worked on: ${options.problem}

Analyze these notes and look for gaps in the student's thinking:
- Confusion or uncertainty (questions, doubt, "I don't know")
- Unclear reasoning (incomplete explanations, missing connections)
- Assumptions taken for granted without examination
- Contradictions or inconsistencies
- Circular thinking or looping back
- Skipped steps in problem-solving
- Misconceptions or incorrect understanding

Rate the gap level from 0.0 to 1.0:
- 0.0-0.3: Clear, confident reasoning in notes
- 0.4-0.6: Some confusion or incomplete thinking shown
- 0.7-1.0: Significant gaps, misconceptions, or stuck thinking

Return ONLY valid JSON:
{"should_probe": true/false, "gap_score": <0.0-1.0>, "signals": ["signal1", "signal2"], "observation": "brief description of what you observe in the notes"}

Max 3 signals. Use categories like: "unclear_reasoning", "confusion", "assumption", "contradiction", "missing_step", "misconception".

Here are the student's notes:

${options.content}`;

  const response = await callOpenRouterJSON<NotebookAnalysisResult>(
    [userMessage(prompt)],
    {
      model: MODEL,
      maxTokens: 300,
      temperature: 0.2,
    }
  );

  if (!response.success || !response.data) {
    return { success: false, error: response.error || "No response" };
  }

  // Normalize the result
  const result = response.data;
  result.gap_score = Math.max(0, Math.min(1, result.gap_score || 0));
  result.should_probe = result.should_probe ?? result.gap_score >= 0.5;
  result.signals = result.signals || [];
  result.observation = result.observation || "";

  return { success: true, result };
}

// ============================================
// AVAILABLE MODELS (for user selection in Dashboard)
// ============================================

export const AVAILABLE_MODELS = [
  { id: "x-ai/grok-4", label: "Grok 4", description: "Most capable xAI model" },
  { id: "x-ai/grok-4-fast", label: "Grok 4 Fast", description: "Fast xAI model" },
  { id: "anthropic/claude-sonnet-4", label: "Claude Sonnet 4", description: "Balanced Anthropic model" },
  { id: "openai/gpt-4o", label: "GPT-4o", description: "OpenAI flagship" },
] as const;

export type ModelId = (typeof AVAILABLE_MODELS)[number]["id"] | string;

// ============================================
// EXPAND PROBE
// ============================================

export async function expandProbe(options: {
  problem: string;
  probe: string;
  promptOverrides?: UserPrompts;
}): Promise<{ success: boolean; expanded?: string; error?: string }> {
  const prompt = getPrompt("expand_probe", options.promptOverrides)
    .replace("{problem}", options.problem)
    .replace("{probe}", options.probe);

  const response = await callOpenRouterText(
    [userMessage(prompt)],
    {
      model: MODEL,
      maxTokens: 300,
      temperature: RECOMMENDED_TEMPS.probeGeneration,
    }
  );

  if (!response.success || !response.data) {
    return { success: false, error: response.error || "No expansion generated" };
  }

  return { success: true, expanded: response.data };
}

// ============================================
// ASK QUESTION (Direct question from student)
// ============================================

export async function askQuestion(options: {
  problem: string;
  probe: string;
  question: string;
  model?: string;
  promptOverrides?: UserPrompts;
}): Promise<{ success: boolean; answer?: string; error?: string }> {
  const prompt = getPrompt("ask_question", options.promptOverrides)
    .replace("{problem}", options.problem)
    .replace("{probe}", options.probe)
    .replace("{question}", options.question);

  const response = await callOpenRouterText(
    [userMessage(prompt)],
    {
      model: options.model || MODEL,
      maxTokens: 800,
      temperature: RECOMMENDED_TEMPS.askQuestion,
    }
  );

  if (!response.success || !response.data) {
    return { success: false, error: response.error || "No answer generated" };
  }

  return { success: true, answer: response.data };
}

// ============================================
// EMBEDDINGS GENERATION (for RAG)
// Re-export from shared client for backward compatibility
// ============================================

export async function generateEmbeddings(
  texts: string[]
): Promise<{ success: boolean; embedding?: number[][]; error?: string }> {
  if (!texts || texts.length === 0) {
    return { success: true, embedding: [] };
  }

  const response = await clientGenerateEmbeddings(texts);

  if (!response.success) {
    return { success: false, error: response.error };
  }

  return { success: true, embedding: response.embeddings };
}

// ============================================
// GENERATE OBJECTIVES (Session start)
// ============================================

export async function generateObjectives(
  problem: string,
  promptOverrides?: UserPrompts
): Promise<{ success: boolean; objectives?: string[]; error?: string }> {
  const prompt = getPrompt("generate_objectives", promptOverrides)
    .replace("{problem}", problem);

  const response = await callOpenRouterJSON<{ objectives?: string[] } | string[]>(
    [userMessage(prompt)],
    {
      model: MODEL,
      maxTokens: 300,
      temperature: 0.3,
    }
  );

  if (!response.success || !response.data) {
    return { success: false, error: response.error || "No objectives generated" };
  }

  // Handle both array format and object with objectives key
  let objectives: string[];
  if (Array.isArray(response.data)) {
    objectives = response.data;
  } else {
    objectives = response.data.objectives || [];
  }

  if (!Array.isArray(objectives)) {
    return { success: false, error: "Invalid objectives format" };
  }

  // Clean up objectives
  objectives = objectives.map((obj: string) => {
    let cleaned = obj.trim();
    if (cleaned.endsWith(".")) {
      cleaned = cleaned.slice(0, -1);
    }
    cleaned = cleaned.replace(/^```json|```$/g, "").trim();
    return cleaned;
  });

  // Filter and limit
  objectives = objectives.filter((obj: string) => {
    const wordCount = obj.split(/\s+/).length;
    return wordCount >= 3 && wordCount <= 30;
  });

  if (objectives.length > 3) {
    objectives = objectives.slice(0, 3);
  }

  return { success: true, objectives };
}

// ============================================
// FEEDBACK + QUESTION (Get Feedback button)
// ============================================

export interface FeedbackAndQuestionOptions {
  problem: string;
  previousProbes: string[];
  recentContext?: string;
  promptOverrides?: UserPrompts;
}

export async function feedbackAndQuestion(
  options: FeedbackAndQuestionOptions
): Promise<{ success: boolean; feedback?: string; question?: string; error?: string }> {
  const prompt = getPrompt("feedback_and_question", options.promptOverrides)
    .replace("{problem}", options.problem)
    .replace("{previous_probes}", options.previousProbes.length > 0 
      ? options.previousProbes.map((p, i) => `${i + 1}. ${p}`).join("\n")
      : "None yet")
    .replace("{recent_context}", options.recentContext || "No recent context available");

  const response = await callOpenRouterJSON<{ feedback?: string; question?: string }>(
    [userMessage(prompt)],
    {
      model: MODEL,
      maxTokens: 400,
      temperature: 0.3,
    }
  );

  if (!response.success || !response.data) {
    return { success: false, error: response.error || "No feedback generated" };
  }

  return {
    success: true,
    feedback: response.data.feedback,
    question: response.data.question,
  };
}

// ============================================
// FRESH QUESTION (I'm stuck button)
// ============================================

export async function freshQuestion(
  problem: string,
  previousProbes: string[],
  promptOverrides?: UserPrompts
): Promise<{ success: boolean; question?: string; error?: string }> {
  const prompt = getPrompt("fresh_question", promptOverrides)
    .replace("{problem}", problem)
    .replace("{previous_probes}", previousProbes.length > 0 
      ? previousProbes.map((p, i) => `${i + 1}. ${p}`).join("\n")
      : "None asked yet");

  const response = await callOpenRouterText(
    [userMessage(prompt)],
    {
      model: MODEL,
      maxTokens: 150,
      temperature: RECOMMENDED_TEMPS.freshQuestion,
    }
  );

  if (!response.success || !response.data) {
    return { success: false, error: response.error || "No question generated" };
  }

  return { success: true, question: response.data };
}

// ============================================
// SESSION PLAN CREATION
// ============================================

export interface SessionPlanStep {
  id?: string;
  type: "question" | "task" | "suggestion" | "checkpoint" | "feedback";
  description: string;
  order: number;
  status?: "pending" | "in_progress" | "completed" | "skipped";
}

export interface CreateSessionPlanResult {
  goal: string;
  strategy: string;
  description?: string; // Brief summary for display purposes
  steps: SessionPlanStep[];
}

export async function createSessionPlanLLM(options: {
  problem: string;
  objectives?: string[];
  calibration?: string;
  promptOverrides?: UserPrompts;
  planningPrompt?: string; // Custom instructions for plan generation
}): Promise<{ success: boolean; plan?: CreateSessionPlanResult; error?: string }> {
  let prompt = getPrompt("session_plan_create", options.promptOverrides)
    .replace("{problem}", options.problem)
    .replace("{objectives}", options.objectives?.length 
      ? options.objectives.map((o, i) => `${i + 1}. ${o}`).join("\n")
      : "No specific objectives defined")
    .replace("{calibration}", options.calibration || "No prior learning data available");

  // Append custom planning prompt if provided
  if (options.planningPrompt) {
    prompt = prompt.replace(
      'Return ONLY valid JSON',
      `Additional Planning Instructions from User:\n${options.planningPrompt}\n\nReturn ONLY valid JSON`
    );
  }

  const response = await callOpenRouterJSON<CreateSessionPlanResult>(
    [userMessage(prompt)],
    {
      model: MODEL,
      maxTokens: 1500,
      temperature: 0.3,
    }
  );

  if (!response.success || !response.data) {
    return { success: false, error: response.error || "No plan generated" };
  }

  // Normalize the plan
  const plan: CreateSessionPlanResult = {
    goal: response.data.goal || "Understand the topic deeply",
    strategy: response.data.strategy || "Guide through Socratic questioning",
    description: response.data.description,
    steps: (response.data.steps || []).map((step: SessionPlanStep, idx: number) => ({
      id: `step_${idx + 1}_${Date.now()}`,
      type: step.type || "question",
      description: step.description || "",
      order: step.order || idx + 1,
      status: "pending" as const,
    })),
  };

  return { success: true, plan };
}

// ============================================
// SESSION PLAN UPDATE
// ============================================

export interface SessionPlanUpdateRequest {
  type: "question" | "task" | "suggestion" | "checkpoint" | "feedback";
  text: string;
}

export interface SessionPlanUpdateResult {
  planChanged: boolean;
  shouldPause: boolean;
  pauseReason?: string;
  updatedSteps?: SessionPlanStep[];
  currentStepIndex: number;
  nextRequest: SessionPlanUpdateRequest | null;
  probesToArchive: string[];
  canGenerateProbe: boolean;
  reasoning: string;
}

export interface FocusedProbeInfo {
  id: string;
  text: string;
}

export async function updateSessionPlanLLM(options: {
  goal: string;
  strategy: string;
  steps: SessionPlanStep[];
  currentStepIndex: number;
  gapScore: number;
  signals: string[];
  transcript?: string;
  trafficLight: "red" | "yellow" | "green";
  previousProbes: string[];
  focusedProbes?: FocusedProbeInfo[];
  openProbeCount?: number;
  promptOverrides?: UserPrompts;
}): Promise<{ success: boolean; result?: SessionPlanUpdateResult; error?: string }> {
  const stepsText = options.steps.map((s, i) => 
    `${i + 1}. [${s.type}] ${s.description} (status: ${s.status || "pending"})`
  ).join("\n");

  // Format focused probes for the prompt
  const focusedProbesText = options.focusedProbes && options.focusedProbes.length > 0
    ? options.focusedProbes.map(p => `- [${p.id}]: "${p.text}"`).join("\n")
    : "None";

  const prompt = getPrompt("session_plan_update", options.promptOverrides)
    .replace("{goal}", options.goal)
    .replace("{strategy}", options.strategy)
    .replace("{steps}", stepsText)
    .replace("{current_step}", options.currentStepIndex.toString())
    .replace("{gap_score}", options.gapScore.toFixed(2))
    .replace("{signals}", options.signals.join(", ") || "none detected")
    .replace("{transcript}", options.transcript || "No recent transcript available")
    .replace("{traffic_light}", options.trafficLight)
    .replace("{previous_probes}", options.previousProbes.length > 0
      ? options.previousProbes.map((p, i) => `${i + 1}. ${p}`).join("\n")
      : "None yet")
    .replace("{open_probe_count}", (options.openProbeCount ?? 0).toString())
    .replace("{focused_probes}", focusedProbesText);

  interface RawPlanUpdate {
    plan_changed?: boolean;
    should_pause?: boolean;
    pause_reason?: string;
    updated_steps?: SessionPlanStep[];
    current_step_index?: number;
    next_request?: { type?: string; text?: string } | null;
    probes_to_archive?: string[];
    can_generate_probe?: boolean;
    reasoning?: string;
  }

  const response = await callOpenRouterJSON<RawPlanUpdate>(
    [userMessage(prompt)],
    {
      model: MODEL,
      maxTokens: 1200,
      temperature: 0.3,
    }
  );

  if (!response.success || !response.data) {
    return { success: false, error: response.error || "No update generated" };
  }

  const parsed = response.data;
  const result: SessionPlanUpdateResult = {
    planChanged: parsed.plan_changed || false,
    shouldPause: parsed.should_pause || false,
    pauseReason: parsed.pause_reason,
    updatedSteps: parsed.updated_steps?.map((step: SessionPlanStep, idx: number) => ({
      id: step.id || `step_${idx + 1}_${Date.now()}`,
      type: step.type || "question",
      description: step.description || "",
      order: step.order || idx + 1,
      status: step.status || "pending",
    })),
    currentStepIndex: parsed.current_step_index ?? options.currentStepIndex,
    nextRequest: parsed.next_request === null ? null : {
      type: (parsed.next_request?.type as SessionPlanUpdateRequest["type"]) || "question",
      text: parsed.next_request?.text || "What are you thinking about right now?",
    },
    probesToArchive: parsed.probes_to_archive || [],
    canGenerateProbe: parsed.can_generate_probe ?? true,
    reasoning: parsed.reasoning || "",
  };

  return { success: true, result };
}

// ============================================
// PROBE ARCHIVE CHECK
// ============================================

export interface ProbeArchiveCheckResult {
  canArchive: boolean;
  reason: string;
}

export async function checkProbeArchivable(options: {
  probeText: string;
  sessionGoal: string;
  transcript?: string;
  whiteboardData?: string;
  activityData?: string;
  promptOverrides?: UserPrompts;
}): Promise<{ success: boolean; result?: ProbeArchiveCheckResult; error?: string }> {
  const prompt = getPrompt("check_probe_archive", options.promptOverrides)
    .replace("{probe_text}", options.probeText)
    .replace("{session_goal}", options.sessionGoal || "Not specified")
    .replace("{transcript}", options.transcript || "No recent transcript available")
    .replace("{whiteboard_data}", options.whiteboardData || "No whiteboard data")
    .replace("{activity_data}", options.activityData || "No activity data");

  interface RawArchiveCheck {
    can_archive?: boolean;
    reason?: string;
  }

  const response = await callOpenRouterJSON<RawArchiveCheck>(
    [userMessage(prompt)],
    {
      model: MODEL,
      maxTokens: 300,
      temperature: 0.2,
    }
  );

  if (!response.success || !response.data) {
    return { success: false, error: response.error || "Archive check failed" };
  }

  const parsed = response.data;
  return {
    success: true,
    result: {
      canArchive: parsed.can_archive ?? false,
      reason: parsed.reason || "Unable to determine",
    },
  };
}
