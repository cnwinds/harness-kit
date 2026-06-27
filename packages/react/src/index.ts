export { HarnessChatProvider, useHarnessChatContext, useHarnessTheme } from './provider.js';
export type { HarnessChatProviderProps, HarnessChatContextValue, HarnessAuthState, FileApiLike } from './provider.js';

export { useHarnessChat } from './hooks/use-harness-chat.js';
export type { UseHarnessChatReturn, UseHarnessChatOptions, SendOptions } from './hooks/use-harness-chat.js';

export { useSessionStream } from './hooks/useSessionStream.js';
export { useStreamUiStore } from './store/stream-ui-store.js';
export type { StreamStatus, SessionStreamState } from './store/stream-ui-store.js';

export { useFilePreviewUrl } from './hooks/useFilePreviewUrl.js';
export {
  useImagePreview,
  useImagePreviewActions,
  imagePreviewActions,
} from './hooks/useImagePreview.js';
export type { ImagePreviewTarget } from './hooks/useImagePreview.js';

export {
  useComposerAttachments,
  composerAttachmentsActions,
  createComposerAttachmentId,
} from './hooks/useComposerAttachments.js';
export type { ComposerAttachment } from './hooks/useComposerAttachments.js';

export { useIsDesktop, useMediaQuery } from './hooks/useMediaQuery.js';
export { useKeyboardInset } from './hooks/useKeyboardInset.js';
export { useAutoScrollToBottom } from './hooks/useAutoScrollToBottom.js';

export { HarnessChat } from './components/HarnessChat.js';
export type { HarnessChatProps } from './components/HarnessChat.js';
export { MessageItem } from './components/MessageItem.js';
export { Composer } from './components/chat/Composer.js';
export type { ComposerProps } from './components/chat/Composer.js';
export { FollowUpQueue } from './components/chat/FollowUpQueue.js';
export type { FollowUpQueueProps } from './components/chat/FollowUpQueue.js';
export { AttachmentChips } from './components/chat/AttachmentChips.js';
export { MessageAttachments } from './components/chat/MessageAttachments.js';
export { QuestionTimelineControl } from './components/chat/QuestionTimelineControl.js';
export type { QuestionTimelineEntry } from './components/chat/QuestionTimelineControl.js';

export {
  buildRenderableTimeline,
  buildTimelineItems,
} from './lib/timeline.js';
export type {
  TimelineItem,
  RenderableTimeline,
  ToolTraceDisplayEvent,
  ToolTraceGroupDisplayEvent,
} from './lib/timeline.js';
export { cn } from './lib/cn.js';
export { formatBytes } from './lib/utils.js';

export { useStreamStore, applySSEEvent } from './store/stream-store.js';
export type { SessionStreamState as SimpleSessionStreamState } from './store/stream-store.js';

export type {
  HarnessChatTheme,
  HarnessChatThemeInput,
  HarnessChatColors,
  HarnessChatRadius,
  CssVariableMap,
} from './theme/types.js';
export { DEFAULT_CSS_VAR_MAP } from './theme/types.js';
export {
  lightTheme,
  darkTheme,
  resolveTheme,
  resolveThemeWithInheritance,
  themeFromCssVariables,
  themeToCssProperties,
  HK_CSS_VARS,
} from './theme/resolve-theme.js';
export type { ThemePreset } from './theme/presets.js';
export { resolvePreset } from './theme/presets.js';

export {
  setHarnessChatTestContext,
  clearHarnessChatTestContext,
  defaultHarnessChatTestContext,
} from './test-context.js';