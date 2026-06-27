export { HarnessChatProvider, useHarnessChatContext } from './provider.js';
export type { HarnessChatProviderProps, HarnessChatContextValue } from './provider.js';

export { useHarnessChat } from './hooks/use-harness-chat.js';
export type { UseHarnessChatReturn, UseHarnessChatOptions, SendOptions } from './hooks/use-harness-chat.js';

export { HarnessChat } from './components/HarnessChat.js';
export type { HarnessChatProps } from './components/HarnessChat.js';

export { useStreamStore, applySSEEvent } from './store/stream-store.js';
export type { StreamStatus, SessionStreamState } from './store/stream-store.js';
