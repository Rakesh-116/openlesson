import {
  type Action,
  type IAgentRuntime,
  type Memory,
  type State,
  type HandlerCallback,
  logger,
} from '@elizaos/core';
import type { AnalyzeAudioParams, AudioAnalysisResponse } from '../types';

function interpretGapScore(score: number): string {
  if (score < 0.3) {
    return 'Strong understanding - user demonstrates solid reasoning';
  } else if (score < 0.6) {
    return 'Moderate understanding - some reasoning gaps identified';
  } else {
    return 'Significant reasoning gaps - follow-up recommended';
  }
}

const analyzeAudioAction: Action = {
  name: 'ANALYZE_AUDIO',
  description: 'Submit an audio chunk for analysis. Returns reasoning gap score and follow-up questions. IMPORTANT: This endpoint only accepts audio input, NOT text.',

  validate: async (runtime: IAgentRuntime, message: Memory, _state?: State): Promise<boolean> => {
    const apiKey = runtime.getSetting('OPENLESSON_API_KEY');
    return !!apiKey;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    params?: unknown,
    _callback?: HandlerCallback
  ) => {
    const apiKey = runtime.getSetting('OPENLESSON_API_KEY') as string | undefined;
    const baseUrl = (runtime.getSetting('OPENLESSON_BASE_URL') as string | undefined) || 'https://www.openlesson.academy';

    if (!apiKey) {
      throw new Error('OPENLESSON_API_KEY not configured. Please set it in your character settings.');
    }

    const parsedParams = params as AnalyzeAudioParams;
    const { session_id, audio_base64, audio_format = 'webm' } = parsedParams;

    if (!session_id) {
      throw new Error('Session ID is required for audio analysis.');
    }

    if (!audio_base64) {
      throw new Error('Audio data (base64) is required for analysis. This endpoint only accepts audio, not text.');
    }

    logger.info(`Analyzing audio for session: ${session_id}`);

    try {
      const response = await fetch(`${baseUrl}/api/agent/session/analyze`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id,
          audio_base64,
          audio_format,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = (await response.json()) as AudioAnalysisResponse;

      const interpretation = interpretGapScore(data.gapScore);

      let responseText = `Analysis complete. ${interpretation}`;
      if (data.requiresFollowUp && data.followUpQuestion) {
        responseText += `\n\nFollow-up question: ${data.followUpQuestion}`;
      }

      return {
        success: true,
        text: responseText,
        values: {
          session_id: data.sessionId,
          gap_score: data.gapScore,
          requires_follow_up: data.requiresFollowUp,
          interpretation,
        },
        data: {
          sessionId: data.sessionId,
          gapScore: data.gapScore,
          signals: data.signals,
          transcript: data.transcript,
          followUpQuestion: data.followUpQuestion,
          requiresFollowUp: data.requiresFollowUp,
          interpretation,
        },
      };
    } catch (error) {
      logger.error('Failed to analyze audio:', String(error));
      throw new Error(`Failed to analyze audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  examples: [
    [
      {
        name: 'user',
        content: {
          text: 'Here is my audio response for analysis',
        },
      },
      {
        name: 'assistant',
        content: {
          text: 'I will analyze your audio response using guided questioning.',
        },
      },
    ],
  ],
};

export { analyzeAudioAction };
export default analyzeAudioAction;