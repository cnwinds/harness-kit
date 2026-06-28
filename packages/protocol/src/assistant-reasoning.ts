import { sanitizeAssistantVisibleText } from './sanitize-assistant-text.js';

const COMPLETE_REASONING_BLOCK =
  /<(?:think(?:ing)?|redacted_thinking)>([\s\S]*?)<\/(?:think(?:ing)?|redacted_thinking)>/gi;

const OPEN_REASONING_TAIL =
  /<(?:think(?:ing)?|redacted_thinking)>([\s\S]*)$/i;

/**
 * Extract model reasoning embedded in assistant output_text (e.g. Qwen / DashScope).
 * Supports complete blocks and a trailing unclosed block while streaming.
 */
export const extractAssistantReasoningContent = (text: string): string => {
  if (!text) {
    return '';
  }

  const chunks: string[] = [];

  for (const match of text.matchAll(COMPLETE_REASONING_BLOCK)) {
    const body = match[1]?.trim();
    if (body) {
      chunks.push(body);
    }
  }

  const openMatch = text.match(OPEN_REASONING_TAIL);
  if (openMatch) {
    const tail = openMatch[1] ?? '';
    if (!/<\/(?:think(?:ing)?|redacted_thinking)>/i.test(tail)) {
      const partial = tail.trim();
      if (partial) {
        chunks.push(partial);
      }
    }
  }

  return chunks.join('\n\n');
};

export type AssistantTextStreamSplitState = {
  rawText: string;
  publishedVisibleLength: number;
  publishedTagReasoningLength: number;
};

export const createAssistantTextStreamSplitState = (): AssistantTextStreamSplitState => ({
  rawText: '',
  publishedVisibleLength: 0,
  publishedTagReasoningLength: 0,
});

export const pushAssistantTextStreamDelta = (
  state: AssistantTextStreamSplitState,
  delta: string,
): {
  state: AssistantTextStreamSplitState;
  visibleDelta: string;
  tagReasoningDelta: string;
} => {
  const rawText = `${state.rawText}${delta}`;
  const visible = sanitizeAssistantVisibleText(rawText);
  const tagReasoning = extractAssistantReasoningContent(rawText);
  const visibleDelta = visible.slice(state.publishedVisibleLength);
  const tagReasoningDelta = tagReasoning.slice(state.publishedTagReasoningLength);

  return {
    state: {
      rawText,
      publishedVisibleLength: visible.length,
      publishedTagReasoningLength: tagReasoning.length,
    },
    visibleDelta,
    tagReasoningDelta,
  };
};
