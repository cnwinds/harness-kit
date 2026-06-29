import { describe, expect, it } from 'vitest';
import { formatUserAttachmentReferences } from './attachment-references.js';

describe('formatUserAttachmentReferences', () => {
  it('formats non-image attachment metadata for the model', () => {
    const note = formatUserAttachmentReferences([
      {
        id: 'file_abc',
        userId: 'u1',
        sessionId: 's1',
        displayName: 'network.har',
        relativePath: 'sessions/s1/uploads/network.har',
        mimeType: 'application/json',
        size: 2048,
        bucket: 'uploads',
        createdAt: '2026-06-28T00:00:00.000Z',
      },
    ]);

    expect(note).toContain('[用户附件]');
    expect(note).toContain('network.har');
    expect(note).toContain('file_abc');
    expect(note).toContain('uploads/network.har');
  });
});
