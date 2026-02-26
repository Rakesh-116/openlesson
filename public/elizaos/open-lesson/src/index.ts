import type { Plugin } from '@elizaos/core';
import { generateLearningPlanAction } from './actions/generateLearningPlan';
import { startSessionAction } from './actions/startSession';
import { analyzeAudioAction } from './actions/analyzeAudio';
import { endSessionAction } from './actions/endSession';
import { getSessionSummaryAction } from './actions/getSessionSummary';

export const openLessonPlugin: Plugin = {
  name: 'open-lesson',
  description: 'openLesson tutoring platform integration - generate learning plans, start Socratic sessions, and analyze audio for reasoning gaps',
  actions: [
    generateLearningPlanAction,
    startSessionAction,
    analyzeAudioAction,
    endSessionAction,
    getSessionSummaryAction,
  ],
  providers: [],
  services: [],
  evaluators: [],
};

export default openLessonPlugin;

export { generateLearningPlanAction } from './actions/generateLearningPlan';
export { startSessionAction } from './actions/startSession';
export { analyzeAudioAction } from './actions/analyzeAudio';
export { endSessionAction } from './actions/endSession';
export { getSessionSummaryAction } from './actions/getSessionSummary';
