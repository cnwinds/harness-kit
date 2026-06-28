import type { HarnessConfig } from '@harnesskit/core';
import type { FileServiceLike } from '@harnesskit/core';
import { ProviderPrefsStore, RunnerManager } from '@harnesskit/core';
import { ImageGenerationOrchestrator } from './image/image-orchestrator.js';
import { AssistantToolService, OpenAIHarness, OpenAIImageService } from './index.js';

export const createOpenAIHarnessStack = (config: HarnessConfig, fileService: FileServiceLike) => {
  const prefsStore = new ProviderPrefsStore(config.DATA_ROOT);
  const runnerManager = new RunnerManager(config, fileService);
  const openAIImageService = new OpenAIImageService(config, fileService);
  const imageOrchestrator = new ImageGenerationOrchestrator(config, prefsStore, openAIImageService);
  const assistantToolService = new AssistantToolService(
    config,
    fileService,
    prefsStore,
    imageOrchestrator,
  );
  const openAIHarness = new OpenAIHarness(
    config,
    assistantToolService,
    runnerManager,
    openAIImageService,
    imageOrchestrator,
  );
  return {
    runnerManager,
    assistantToolService,
    openAIImageService,
    imageOrchestrator,
    prefsStore,
    openAIHarness,
  };
};
