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

  it('rejects empty create message content', () => {
    expect(() => createMessageSchema.parse({ content: '' })).toThrow();
    expect(createMessageSchema.parse({ content: 'hi' })).toMatchObject({ content: 'hi' });
  });

  it('parses steer message and list query bounds', () => {
    expect(steerMessageSchema.parse({ content: 'follow up' })).toEqual({ content: 'follow up' });
    expect(listMessagesQuerySchema.parse({ limit: '50' })).toEqual({ limit: 50 });
    expect(() => listMessagesQuerySchema.parse({ limit: '0' })).toThrow();
  });
});
