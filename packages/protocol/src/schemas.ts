import { z } from 'zod';
import { DISPATCH_MODES, TURN_KINDS, TURN_PHASES } from './constants.js';

export const turnKindSchema = z.enum(TURN_KINDS);
export const turnPhaseSchema = z.enum(TURN_PHASES);

export const createSessionSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  activeSkills: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const createMessageSchema = z.object({
  content: z.string().min(1),
  attachmentIds: z.array(z.string()).optional(),
  dispatch: z.enum(DISPATCH_MODES).optional(),
  turnId: z.string().optional(),
  kind: z.enum(TURN_KINDS).optional(),
  turnConfig: z
    .object({
      model: z.string().optional(),
      reasoningEffort: z.enum(['minimal', 'low', 'medium', 'high', 'xhigh']).optional(),
      maxOutputTokens: z.number().int().positive().optional(),
      webSearchMode: z.enum(['disabled', 'cached', 'live']).optional(),
    })
    .optional(),
});

export const steerMessageSchema = z.object({
  content: z.string().min(1),
  attachmentIds: z.array(z.string()).optional(),
});

export const listMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional(),
  after: z.string().optional(),
  before: z.string().optional(),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type CreateMessageInput = z.infer<typeof createMessageSchema>;
export type SteerMessageInput = z.infer<typeof steerMessageSchema>;
export type ListMessagesQuery = z.infer<typeof listMessagesQuerySchema>;
