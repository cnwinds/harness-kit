import { describe, expect, it } from 'vitest';
import {
  createAssistantTextStreamSplitState,
  extractAssistantReasoningContent,
  pushAssistantTextStreamDelta,
} from './assistant-reasoning.js';

const reasoningBlock = (body: string) => `<think>${body}</think>`;

describe('extractAssistantReasoningContent', () => {
  it('extracts complete reasoning blocks', () => {
    expect(extractAssistantReasoningContent(`${reasoningBlock('步骤一')}回答`)).toBe('步骤一');
    expect(extractAssistantReasoningContent(`前文${reasoningBlock('a')}后文${reasoningBlock('b')}`)).toBe('a\n\nb');
  });

  it('extracts streaming tail before closing tag arrives', () => {
    expect(extractAssistantReasoningContent('<think>正在思考')).toBe('正在思考');
    expect(extractAssistantReasoningContent(`${reasoningBlock('done')}可见`)).toBe('done');
  });

  it('returns empty when no reasoning markers exist', () => {
    expect(extractAssistantReasoningContent('普通回答')).toBe('');
  });
});

describe('pushAssistantTextStreamDelta', () => {
  it('splits visible and reasoning deltas incrementally', () => {
    let state = createAssistantTextStreamSplitState();

    const first = pushAssistantTextStreamDelta(state, '<think>a');
    expect(first.visibleDelta).toBe('');
    expect(first.tagReasoningDelta).toBe('a');
    state = first.state;

    const second = pushAssistantTextStreamDelta(state, 'b</think>');
    expect(second.visibleDelta).toBe('');
    expect(second.tagReasoningDelta).toBe('b');

    const third = pushAssistantTextStreamDelta(second.state, '答案');
    expect(third.visibleDelta).toBe('答案');
    expect(third.tagReasoningDelta).toBe('');
  });
});
