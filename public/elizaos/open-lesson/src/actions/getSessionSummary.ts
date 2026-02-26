import {
  type Action,
  type IAgentRuntime,
  type Memory,
  type State,
  type HandlerCallback,
  logger,
} from '@elizaos/core';
import type { GetSessionSummaryParams, SessionSummaryResponse } from '../types';

const getSessionSummaryAction: Action = {
  name: 'GET_SESSION_SUMMARY',
  description: 'Retrieve the summary report of a completed tutoring session',

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

    const parsedParams = params as GetSessionSummaryParams;
    const { session_id } = parsedParams;

    if (!session_id) {
      throw new Error('Session ID is required to retrieve the summary.');
    }

    logger.info(`Getting summary for session: ${session_id}`);

    try {
      const response = await fetch(`${baseUrl}/api/agent/session/summary?session_id=${session_id}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = (await response.json()) as SessionSummaryResponse;

      if (!data.ready) {
        return {
          success: true,
          text: data.message || 'Session report not ready yet. Please call end_session first to generate the report.',
          values: {
            session_id: data.sessionId,
            ready: false,
            status: data.status,
          },
          data: {
            ready: false,
            sessionId: data.sessionId,
            status: data.status,
            message: data.message,
          },
        };
      }

      return {
        success: true,
        text: `Session summary ready for session ${session_id}.`,
        values: {
          session_id: data.sessionId,
          ready: true,
          created_at: data.createdAt,
        },
        data: {
          ready: true,
          sessionId: data.sessionId,
          report: data.report,
          createdAt: data.createdAt,
          status: data.status,
        },
      };
    } catch (error) {
      logger.error('Failed to get session summary:', String(error));
      throw new Error(`Failed to get session summary: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  examples: [
    [
      {
        name: 'user',
        content: {
          text: 'Show me the session report',
        },
      },
      {
        name: 'assistant',
        content: {
          text: 'I will retrieve your session summary report.',
        },
      },
    ],
    [
      {
        name: 'user',
        content: {
          text: 'What did we cover in this session?',
        },
      },
      {
        name: 'assistant',
        content: {
          text: 'Let me get the summary of what was covered in this tutoring session.',
        },
      },
    ],
  ],
};

export { getSessionSummaryAction };
export default getSessionSummaryAction;