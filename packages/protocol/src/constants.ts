/** SSE event names — stable public contract. Breaking changes require major version bump. */
export const SSE_EVENT_NAMES = [
  'text_delta',
  'reasoning_delta',
  'token_count',
  'thinking',
  'tool_start',
  'tool_progress',
  'tool_result',
  'file_ready',
  'turn_started',
  'turn_status',
  'assistant_message_committed',
  'user_message_committed',
  'turn_completed',
  'done',
  'error',
] as const;

export const MESSAGE_KINDS = [
  'message',
  'thinking',
  'tool_call',
  'tool_progress',
  'tool_result',
  'image',
  'file',
  'error',
] as const;

export const FILE_BUCKETS = ['uploads', 'outputs', 'shared'] as const;

export const FILE_SOURCES = ['upload', 'generated', 'shared'] as const;

export const FILE_VISIBILITIES = ['visible', 'hidden'] as const;

export const DISPATCH_MODES = ['auto', 'new_turn', 'steer', 'queue_next'] as const;

export const DISPATCH_RESULTS = ['turn_started', 'steer_accepted', 'queued'] as const;

export const TURN_KINDS = ['regular', 'review', 'compact', 'maintenance'] as const;

export const TURN_STATUSES = ['running', 'interrupting', 'completed', 'failed', 'interrupted'] as const;

export const TURN_PHASES = [
  'sampling',
  'tool_call',
  'waiting_tool_result',
  'streaming_assistant',
  'finalizing',
  'non_steerable',
] as const;

export const LIBRARY_NAME = 'HarnessKit';
