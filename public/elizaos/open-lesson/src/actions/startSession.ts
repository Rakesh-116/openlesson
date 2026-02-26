import {
  type Action,
  type IAgentRuntime,
  type Memory,
  type State,
  type HandlerCallback,
  logger,
} from '@elizaos/core';
import type { StartSessionParams, SessionStartResponse } from '../types';

const startSessionAction: Action = {
  name: 'START_SESSION',
  description: 'Start a new Socratic tutoring session. Returns session ID and audio submission instructions.',

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

    const parsedParams = params as StartSessionParams;
    const { problem, plan_node_id } = parsedParams;

    if (!problem) {
      throw new Error('Problem/topic is required to start a session.');
    }

    logger.info(`Starting session for problem: ${problem}`);

    try {
      const body: Record<string, string> = { problem };
      if (plan_node_id) {
        body.plan_node_id = plan_node_id;
      }

      const response = await fetch(`${baseUrl}/api/agent/session/start`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = (await response.json()) as SessionStartResponse;

      return {
        success: true,
        text: `Tutoring session started for "${data.problem}". Session ID: ${data.sessionId}. Please record your audio response to begin the Socratic dialogue.`,
        values: {
          session_id: data.sessionId,
          problem: data.problem,
        },
        data: {
          sessionId: data.sessionId,
          problem: data.problem,
          nodeTitle: data.nodeTitle,
          planId: data.planId,
          status: data.status,
          audio_format: data.instructions?.audioFormat || 'webm',
          max_chunk_duration_ms: data.instructions?.maxChunkDuration || 60000,
        },
      };
    } catch (error) {
      logger.error('Failed to start session:', String(error));
      throw new Error(`Failed to start session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  examples: [
    [
      {
        name: 'user',
        content: {
          text: 'Start a tutoring session about gradient descent',
        },
      },
      {
        name: 'assistant',
        content: {
          text: 'I will start a Socratic tutoring session about gradient descent.',
        },
      },
    ],
    [
      {
        name: 'user',
        content: {
          text: 'Let\'s study for the first node in my learning plan',
        },
      },
      {
        name: 'assistant',
        content: {
          text: 'I will start the first tutoring session from your learning plan.',
        },
      },
    ],
  ],
};

export { startSessionAction };
export default startSessionAction;