import { describe, expect, it } from 'vitest';
import { normalizeUploadMimeType, validateComposerUpload } from './upload-policy.js';

describe('upload-policy', () => {
  it('accepts common attachment types', () => {
    expect(validateComposerUpload('data.csv')).toEqual({ ok: true, filename: 'data.csv' });
    expect(validateComposerUpload('archive.zip')).toEqual({ ok: true, filename: 'archive.zip' });
    expect(validateComposerUpload('network.har')).toEqual({ ok: true, filename: 'network.har' });
  });

  it('rejects executable uploads', () => {
    expect(validateComposerUpload('virus.exe').ok).toBe(false);
  });

  it('infers mime types from extension when browser sends octet-stream', () => {
    expect(normalizeUploadMimeType('data.csv', 'application/octet-stream')).toBe('text/csv');
    expect(normalizeUploadMimeType('network.har', '')).toBe('application/json');
    expect(normalizeUploadMimeType('archive.zip', 'application/octet-stream')).toBe('application/zip');
  });
});
