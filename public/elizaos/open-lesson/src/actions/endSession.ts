import {
  type Action,
  type IAgentRuntime,
  type Memory,
  type State,
  type HandlerCallback,
  logger,
} from '@elizaos/core';
import type { EndSessionParams, SessionEndResponse } from '../types';

const endSessionAction: Action = {
  name: 'END_SESSION',
  description: 'End an active tutoring session and generate a summary report',

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

    const parsedParams = params as EndSessionParams;
    const { session_id } = parsedParams;

    if (!session_id) {
      throw new Error('Session ID is required to end a session.');
    }

    logger.info(`Ending session: ${session_id}`);

    try {
      const response = await fetch(`${baseUrl}/api/agent/session/end`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ session_id }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = (await response.json()) as SessionEndResponse;

      return {
        success: true,
        text: `Session ended successfully. ${data.message} Analyzed ${data.chunkCount} audio chunks with ${data.wordCount} words. The summary report is now available.`,
        values: {
          session_id: data.sessionId,
          chunk_count: data.chunkCount,
          word_count: data.wordCount,
          summary_available: true,
        },
        data: {
          success: data.success,
          sessionId: data.sessionId,
          message: data.message,
          chunkCount: data.chunkCount,
          wordCount: data.wordCount,
          summary_available: true,
          summary_endpoint: `/api/agent/session/summary?session_id=${session_id}`,
        },
      };
    } catch (error) {
      logger.error('Failed to end session:', String(error));
      throw new Error(`Failed to end session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  examples: [
    [
      {
        name: 'user',
        content: {
          text: "I'm done with this session",
        },
      },
      {
        name: 'assistant',
        content: {
          text: 'I will end the tutoring session and generate your summary report.',
        },
      },
    ],
    [
      {
        name: 'user',
        content: {
          text: 'End this learning session',
        },
      },
      {
        name: 'assistant',
        content: {
          text: 'Ending your session now. You can retrieve the summary report afterwards.',
        },
      },
    ],
  ],
};

export { endSessionAction };
export default endSessionAction;