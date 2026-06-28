import { describe, expect, it } from 'vitest';
import { sanitizeAssistantVisibleText } from './sanitize-assistant-text.js';

const think = (body: string) => ``
  .replace('BODY', body);

describe('sanitizeAssistantVisibleText', () => {
  it('removes orphan closing redacted_thinking tags from Qwen output', () => {
    expect(sanitizeAssistantVisibleText('\n\n\n你好')).toBe('你好');
    expect(sanitizeAssistantVisibleText('\n\n\n关于分数线')).toBe('关于分数线');
  });

  it('removes full think blocks and orphan tags', () => {
    expect(sanitizeAssistantVisibleText(`${think('hidden')}visible`)).toBe('visible');
    expect(sanitizeAssistantVisibleText(`before${think('x')}after`)).toBe('beforeafter');
  });

  it('leaves normal markdown untouched', () => {
    const md = '**上海公安** 分数线见 [官网](https://example.com)';
    expect(sanitizeAssistantVisibleText(md)).toBe(md);
  });
});
