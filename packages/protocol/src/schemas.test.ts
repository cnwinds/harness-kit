import { describe, expect, it } from 'vitest';
import {
  createMessageSchema,
  createSessionSchema,
  listMessagesQuerySchema,
  steerMessageSchema,
} from './schemas.js';

describe('protocol schemas', () => {
  it('accepts minimal create session input', () => {
    expect(createSessionSchema.parse({})).toEqual({});
    expect(createSessionSchema.parse({ title: 'Hello' })).toMatchObject({ title: 'Hello' });
  });

  it('validates create message content and attachments', () => {
    expect(() => createMessageSchema.parse({ content: '' })).toThrow();
    expect(createMessageSchema.parse({ content: 'hi' })).toMatchObject({ content: 'hi' });
    expect(createMessageSchema.parse({
      content: '',
      attachmentIds: ['file_abc'],
    })).toMatchObject({ attachmentIds: ['file_abc'] });
  });

  it('parses steer message and list query bounds', () => {
    expect(steerMessageSchema.parse({ content: 'follow up' })).toEqual({ content: 'follow up' });
    expect(listMessagesQuerySchema.parse({ limit: '50' })).toEqual({ limit: 50 });
    expect(() => listMessagesQuerySchema.parse({ limit: '0' })).toThrow();
  });
});
