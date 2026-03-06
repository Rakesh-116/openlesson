// ============================================
// OPENROUTER CLIENT FOR SOCRATES
// Socratic gap analysis + probe generation
// ============================================

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash"; // Fast model with audio support

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

  opening_probe: `You are Socrates — the real one. You don't ask surface-level questions. You find the single most important assumption, distinction, or contradiction hiding inside a topic and crack it open with one precise question.

The student is working towards solving: {problem}
{objectives}

Your task: generate ONE opening question that forces genuine thinking about this specific problem. Follow these principles:

THE SOCRATIC METHOD — what it actually is:
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

  probe_generation: `You are a Socratic observer watching someone work through a problem.

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

  session_end_check: `Based on this Socratic tutoring session so far:
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

  report_generation: `You are reviewing a Socratic tutoring session.

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

  expand_probe: `The student engaged with this Socratic question while working on a problem:

Problem: {problem}
Original question: "{probe}"

They clicked on the question wanting to go deeper. Generate 2-3 follow-up probing questions that dig into the same reasoning gap.

Rules:
- ONLY ask questions. Never give answers, hints, or suggestions.
- Each question should probe a different angle of the same gap.
- Keep each question to 1 sentence.
- Make them progressively deeper.

Return the questions as a numbered list, nothing else.`,

  ask_question: `You are a knowledgeable tutor helping a student who is working through a problem using the Socratic method.

Problem they're working on: {problem}
The current Socratic question being explored: "{probe}"

The student has asked you a direct question:
"{question}"

Answer their question clearly and helpfully. Rules:
- Be concise but thorough (2-4 paragraphs max).
- If the question is about the problem or the Socratic probe, give a substantive answer.
- If the question is off-topic, gently redirect to the problem at hand.
- Use examples when helpful.
- Be encouraging and supportive.`,

  generate_objectives: `You are designing learning objectives for a Socratic tutoring session.

Problem topic: {problem}

Generate exactly 3 learning objectives that the student should achieve by the end of this session. Rules:
- Each objective should be specific and measurable
- They should represent genuine understanding, not just surface-level knowledge
- Focus on conceptual understanding, critical thinking, and ability to apply concepts
- Format as a JSON array of strings, nothing else
- Each objective should be 5-15 words
- Make them challenging but achievable in a single session`,

  feedback_and_question: `You are a Socratic tutor providing feedback and generating a follow-up question.

Problem being worked on: {problem}

Session so far:
- Previous probes asked: {previous_probes}
- Student's recent responses context: {recent_context}

Provide:
1. Brief feedback (1-2 sentences) on the student's thinking so far
2. Then generate ONE new Socratic question that builds on their response

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

  fresh_question: `You are a Socratic tutor. The student is stuck and needs a completely fresh perspective.

Problem they're working on: {problem}

Previous questions already asked that didn't help:
{previous_probes}

Generate a brand new Socratic question from a completely different angle. Rules:
- Try a different concept, assumption, or approach than previous questions
- Only ask a question, never give answers or hints
- Keep it short (max 20 words)
- Make it feel like a new insight they haven't considered
- Focus on a different aspect of the problem

Return ONLY the question text, no JSON or formatting.`,
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
    description: "First Socratic question when a session starts. Variables: {problem}",
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
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return { success: false, error: "OPENROUTER_API_KEY not configured" };
  }

  const prompt = getPrompt("gap_detection", options.promptOverrides)
    .replace("{problem}", options.problem);

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "openLesson",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "input_audio",
                input_audio: {
                  data: options.audioBase64,
                  format: options.audioFormat,
                },
              },
            ],
          },
        ],
        max_tokens: 200,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter API error:", response.status, errorText);
      return { success: false, error: `API error: ${response.status}` };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return { success: false, error: "No content in response" };
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { success: false, error: "No JSON in response" };
    }

    const result = JSON.parse(jsonMatch[0]) as GapAnalysisResult;
    result.gap_score = Math.max(0, Math.min(1, result.gap_score || 0));
    result.signals = result.signals || [];
    result.transcript = result.transcript || "";

    return { success: true, result };
  } catch (error) {
    console.error("Gap analysis failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================
// OPENING PROBE (Session Kickoff Question)
// ============================================

export async function generateOpeningProbe(
  problem: string,
  promptOverrides?: UserPrompts,
  objectives?: string[]
): Promise<{ success: boolean; probe?: string; error?: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return { success: false, error: "OPENROUTER_API_KEY not configured" };
  }

  const prompt = getPrompt("opening_probe", promptOverrides)
    .replace("{problem}", problem)
    .replace(
      "{objectives}",
      objectives && objectives.length > 0
        ? `Session goals to work towards:\n${objectives.map((o, i) => `${i + 1}. ${o}`).join("\n")}`
        : ""
    );

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "openLesson",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 100,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter API error:", response.status, errorText);
      return { success: false, error: `API error: ${response.status}` };
    }

    const data = await response.json();
    const probe = data.choices?.[0]?.message?.content?.trim();

    if (!probe) {
      return { success: false, error: "No opening probe generated" };
    }

    return { success: true, probe };
  } catch (error) {
    console.error("Opening probe generation failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================
// PROBE GENERATION (Socratic Questions Only)
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
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return { success: false, error: "OPENROUTER_API_KEY not configured" };
  }

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

  try {
    const content: Array<{ type: string; text?: string; file?: { filename: string; file_data: string } }> = [
      { type: "text", text: prompt },
    ];

    if (options.audioBase64 && options.audioFormat) {
      content.push({
        type: "file",
        file: {
          filename: `context.${options.audioFormat}`,
          file_data: `data:audio/${options.audioFormat};base64,${options.audioBase64}`,
        },
      });
    }

    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "openLesson",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content }],
        max_tokens: 150,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter API error:", response.status, errorText);
      return { success: false, error: `API error: ${response.status}` };
    }

    const data = await response.json();
    const probe = data.choices?.[0]?.message?.content?.trim();

    if (!probe) {
      return { success: false, error: "No probe generated" };
    }

    return { success: true, probe };
  } catch (error) {
    console.error("Probe generation failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
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
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return { success: false, error: "OPENROUTER_API_KEY not configured" };
  }

  const prompt = getPrompt("session_end_check", options.promptOverrides)
    .replace("{elapsed}", options.elapsed)
    .replace("{count}", options.probeCount.toString())
    .replace("{recent_scores}", options.recentScores.map(s => s.toFixed(2)).join(", ") || "none yet")
    .replace("{problem}", options.problem);

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "openLesson",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 100,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      return { success: false, error: `API error: ${response.status}` };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return { success: false, error: "No content" };

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { success: false, error: "No JSON" };

    const result = JSON.parse(jsonMatch[0]) as SessionEndCheckResult;
    return { success: true, result };
  } catch (error) {
    console.error("Session end check failed:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
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
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return { success: false, error: "OPENROUTER_API_KEY not configured" };
  }

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

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "openLesson",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      return { success: false, error: `API error: ${response.status}` };
    }

    const data = await response.json();
    const report = data.choices?.[0]?.message?.content?.trim();

    if (!report) {
      return { success: false, error: "No report generated" };
    }

    return { success: true, report };
  } catch (error) {
    console.error("Report generation failed:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// ============================================
// TRANSCRIPT GENERATION (Full session audio → text)
// ============================================

export async function transcribeAudio(options: {
  audioBase64: string;
  audioFormat: string;
  problem: string;
}): Promise<{ success: boolean; transcript?: string; error?: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return { success: false, error: "OPENROUTER_API_KEY not configured" };
  }

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

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "openLesson",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "file",
                file: {
                  filename: `session.${options.audioFormat}`,
                  file_data: `data:audio/${options.audioFormat};base64,${options.audioBase64}`,
                },
              },
            ],
          },
        ],
        max_tokens: 8000,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter API error:", response.status, errorText);
      return { success: false, error: `API error: ${response.status}` };
    }

    const data = await response.json();
    const transcript = data.choices?.[0]?.message?.content?.trim();

    if (!transcript) {
      return { success: false, error: "No transcript generated" };
    }

    return { success: true, transcript };
  } catch (error) {
    console.error("Transcription failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
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
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return { success: false, error: "OPENROUTER_API_KEY not configured" };
  }

  const prompt = `You are analyzing a student's whiteboard/drawing during a Socratic tutoring session.

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

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "openLesson",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/png;base64,${options.imageBase64}`,
                },
              },
            ],
          },
        ],
        max_tokens: 300,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter API error:", response.status, errorText);
      return { success: false, error: `API error: ${response.status}` };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return { success: false, error: "No content in response" };
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { success: false, error: "No JSON in response" };
    }

    const result = JSON.parse(jsonMatch[0]) as WhiteboardAnalysisResult;
    result.gap_score = Math.max(0, Math.min(1, result.gap_score || 0));
    result.should_probe = result.should_probe ?? result.gap_score >= 0.5;
    result.signals = result.signals || [];
    result.observation = result.observation || "";

    return { success: true, result };
  } catch (error) {
    console.error("Whiteboard analysis failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
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
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return { success: false, error: "OPENROUTER_API_KEY not configured" };
  }

  const prompt = `You are analyzing a student's written notes during a Socratic tutoring session.

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

Max 3 signals. Use categories like: "unclear_reasoning", "confusion", "assumption", "contradiction", "missing_step", "misconception".`;

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "openLesson",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "text", text: `Here are the student's notes:\n\n${options.content}` },
            ],
          },
        ],
        max_tokens: 300,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter API error:", response.status, errorText);
      return { success: false, error: `API error: ${response.status}` };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return { success: false, error: "No content in response" };
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { success: false, error: "No JSON in response" };
    }

    const result = JSON.parse(jsonMatch[0]) as NotebookAnalysisResult;
    result.gap_score = Math.max(0, Math.min(1, result.gap_score || 0));
    result.should_probe = result.should_probe ?? result.gap_score >= 0.5;
    result.signals = result.signals || [];
    result.observation = result.observation || "";

    return { success: true, result };
  } catch (error) {
    console.error("Notebook analysis failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================
// AVAILABLE MODELS (for user selection in Dashboard)
// ============================================

export const AVAILABLE_MODELS = [
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", description: "Fast & capable" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", description: "Most capable Google model" },
  { id: "anthropic/claude-sonnet-4", label: "Claude Sonnet 4", description: "Balanced Anthropic model" },
  { id: "openai/gpt-4o", label: "GPT-4o", description: "OpenAI flagship" },
  { id: "meta-llama/llama-3.1-70b-instruct", label: "Llama 3.1 70B", description: "Open-source, fast" },
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
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return { success: false, error: "OPENROUTER_API_KEY not configured" };
  }

  const prompt = getPrompt("expand_probe", options.promptOverrides)
    .replace("{problem}", options.problem)
    .replace("{probe}", options.probe);

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "openLesson",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      return { success: false, error: `API error: ${response.status}` };
    }

    const data = await response.json();
    const expanded = data.choices?.[0]?.message?.content?.trim();

    if (!expanded) {
      return { success: false, error: "No expansion generated" };
    }

    return { success: true, expanded };
  } catch (error) {
    console.error("Expand probe failed:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
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
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return { success: false, error: "OPENROUTER_API_KEY not configured" };
  }

  const prompt = getPrompt("ask_question", options.promptOverrides)
    .replace("{problem}", options.problem)
    .replace("{probe}", options.probe)
    .replace("{question}", options.question);

  const selectedModel = options.model || MODEL;

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "openLesson",
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 800,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      return { success: false, error: `API error: ${response.status}` };
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content?.trim();

    if (!answer) {
      return { success: false, error: "No answer generated" };
    }

    return { success: true, answer };
  } catch (error) {
    console.error("Ask question failed:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// ============================================
// EMBEDDINGS GENERATION (for RAG)
// ============================================

const EMBEDDING_URL = "https://openrouter.ai/api/v1/embeddings";
const EMBEDDING_MODEL = "google/gemini-embedding-001";

export async function generateEmbeddings(
  texts: string[]
): Promise<{ success: boolean; embedding?: number[][]; error?: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return { success: false, error: "OPENROUTER_API_KEY not configured" };
  }

  if (!texts || texts.length === 0) {
    return { success: true, embedding: [] };
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
        input: texts,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter API error:", response.status, errorText);
      return { success: false, error: `API error: ${response.status} - ${errorText}` };
    }

    const data = await response.json();
    const embeddings = data.data?.map((item: { embedding: number[] }) => item.embedding) || [];

    if (embeddings.length === 0) {
      return { success: false, error: "No embeddings returned" };
    }

    return { success: true, embedding: embeddings };
  } catch (error) {
    console.error("[generateEmbeddings] Failed:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// ============================================
// GENERATE OBJECTIVES (Session start)
// ============================================

export async function generateObjectives(
  problem: string,
  promptOverrides?: UserPrompts
): Promise<{ success: boolean; objectives?: string[]; error?: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return { success: false, error: "OPENROUTER_API_KEY not configured" };
  }

  const prompt = getPrompt("generate_objectives", promptOverrides)
    .replace("{problem}", problem);

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "openLesson",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter API error:", response.status, errorText);
      return { success: false, error: `API error: ${response.status}` };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      return { success: false, error: "No objectives generated" };
    }

    let objectives: string[];
    try {
      objectives = JSON.parse(content);
      if (!Array.isArray(objectives)) {
        throw new Error("Not an array");
      }
    } catch {
      const lines = content.split("\n").filter((line: string) => line.trim().length > 0);
      objectives = lines.slice(0, 3);
    }

    // Clean up objectives - remove trailing periods and extra whitespace
    objectives = objectives.map((obj: string) => {
      let cleaned = obj.trim();
      // Remove trailing period if present
      if (cleaned.endsWith(".")) {
        cleaned = cleaned.slice(0, -1);
      }
      // Remove any markdown formatting
      cleaned = cleaned.replace(/^```json|```$/g, "").trim();
      return cleaned;
    });

    // Filter out objectives that are too long (likely not proper objectives)
    objectives = objectives.filter((obj: string) => {
      const wordCount = obj.split(/\s+/).length;
      return wordCount >= 3 && wordCount <= 30;
    });

    // Ensure we have exactly 3 objectives
    if (objectives.length > 3) {
      objectives = objectives.slice(0, 3);
    }

    return { success: true, objectives };
  } catch (error) {
    console.error("Generate objectives failed:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
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
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return { success: false, error: "OPENROUTER_API_KEY not configured" };
  }

  const prompt = getPrompt("feedback_and_question", options.promptOverrides)
    .replace("{problem}", options.problem)
    .replace("{previous_probes}", options.previousProbes.length > 0 
      ? options.previousProbes.map((p, i) => `${i + 1}. ${p}`).join("\n")
      : "None yet")
    .replace("{recent_context}", options.recentContext || "No recent context available");

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "openLesson",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 400,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter API error:", response.status, errorText);
      return { success: false, error: `API error: ${response.status}` };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      return { success: false, error: "No feedback generated" };
    }

    let feedback: string | undefined;
    let question: string | undefined;

    try {
      const parsed = JSON.parse(content);
      feedback = parsed.feedback;
      question = parsed.question;
    } catch {
      const parts = content.split(/\n/);
      for (const part of parts) {
        if (part.toLowerCase().includes("feedback")) {
          feedback = part.replace(/^[^:]+:\s*/i, "").trim();
        } else if (part.toLowerCase().includes("question")) {
          question = part.replace(/^[^:]+:\s*/i, "").trim();
        }
      }
      if (!feedback && !question) {
        return { success: false, error: "Could not parse response" };
      }
    }

    return { success: true, feedback, question };
  } catch (error) {
    console.error("Feedback and question failed:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// ============================================
// FRESH QUESTION (I'm stuck button)
// ============================================

export async function freshQuestion(
  problem: string,
  previousProbes: string[],
  promptOverrides?: UserPrompts
): Promise<{ success: boolean; question?: string; error?: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return { success: false, error: "OPENROUTER_API_KEY not configured" };
  }

  const prompt = getPrompt("fresh_question", promptOverrides)
    .replace("{problem}", problem)
    .replace("{previous_probes}", previousProbes.length > 0 
      ? previousProbes.map((p, i) => `${i + 1}. ${p}`).join("\n")
      : "None asked yet");

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "openLesson",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 150,
        temperature: 0.9,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter API error:", response.status, errorText);
      return { success: false, error: `API error: ${response.status}` };
    }

    const data = await response.json();
    const question = data.choices?.[0]?.message?.content?.trim();

    if (!question) {
      return { success: false, error: "No question generated" };
    }

    return { success: true, question };
  } catch (error) {
    console.error("Fresh question failed:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}
