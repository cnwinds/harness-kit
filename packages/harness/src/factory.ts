import type { HarnessConfig } from '@harnesskit/core';
import type { FileServiceLike } from '@harnesskit/core';
import { RunnerManager } from '@harnesskit/core';
import { AssistantToolService, OpenAIHarness, OpenAIImageService } from './index.js';

export const createOpenAIHarnessStack = (config: HarnessConfig, fileService: FileServiceLike) => {
  const runnerManager = new RunnerManager(config, fileService);
  const assistantToolService = new AssistantToolService(config, fileService);
  const openAIImageService = new OpenAIImageService(config, fileService);
  const openAIHarness = new OpenAIHarness(config, assistantToolService, runnerManager, openAIImageService);
  return { runnerManager, assistantToolService, openAIImageService, openAIHarness };
};
