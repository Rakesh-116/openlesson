import {
  type Action,
  type IAgentRuntime,
  type Memory,
  type State,
  type HandlerCallback,
  logger,
} from '@elizaos/core';
import type { GenerateLearningPlanParams, LearningPlanResponse } from '../types';

const generateLearningPlanAction: Action = {
  name: 'GENERATE_LEARNING_PLAN',
  description: 'Generate a personalized learning plan as a directed graph of Socratic tutoring sessions for a given topic',

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

    const parsedParams = params as GenerateLearningPlanParams;
    const { topic, days = 30 } = parsedParams;

    if (!topic) {
      throw new Error('Topic is required for generating a learning plan.');
    }

    logger.info(`Generating learning plan for topic: ${topic}, days: ${days}`);

    try {
      const response = await fetch(`${baseUrl}/api/agent/plan`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ topic, days }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = (await response.json()) as LearningPlanResponse;

      const startNode = data.nodes.find((n) => n.is_start);

      return {
        success: true,
        text: `Learning plan generated for "${data.topic}" spanning ${data.days} days with ${data.nodes.length} tutoring nodes. The first session is "${startNode?.title}".`,
        values: {
          plan_id: data.planId,
          topic: data.topic,
          days: data.days,
          node_count: data.nodes.length,
          first_session_node_id: startNode?.id,
        },
        data: {
          planId: data.planId,
          topic: data.topic,
          days: data.days,
          nodes: data.nodes.map((n) => ({
            id: n.id,
            title: n.title,
            description: n.description,
            is_start: n.is_start,
            next_node_ids: n.next_node_ids,
            status: n.status,
          })),
        },
      };
    } catch (error) {
      logger.error('Failed to generate learning plan:', String(error));
      throw new Error(`Failed to generate learning plan: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  examples: [
    [
      {
        name: 'user',
        content: {
          text: 'Create a learning plan for Machine Learning',
        },
      },
      {
        name: 'assistant',
        content: {
          text: 'I will generate a learning plan for Machine Learning using openLesson.',
        },
      },
      {
        name: 'user',
        content: {
          text: 'Yes, I want a 14-day learning plan for Python programming',
        },
      },
    ],
  ],
};

export { generateLearningPlanAction };
export default generateLearningPlanAction;