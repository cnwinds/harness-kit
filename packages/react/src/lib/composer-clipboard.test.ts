import { describe, expect, it } from 'vitest';
import { extractClipboardImageFiles, normalizeClipboardImageFile } from './composer-clipboard.js';

describe('composer clipboard helpers', () => {
  it('normalizes clipboard image filenames', () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'image.png', { type: 'image/png' });
    const normalized = normalizeClipboardImageFile(file, 0);
    expect(normalized.name).toMatch(/^pasted-image-\d+-1\.png$/);
    expect(normalized.type).toBe('image/png');
  });

  it('extracts image files from clipboard items', () => {
    const image = new File([new Uint8Array([1, 2, 3])], 'shot.png', { type: 'image/png' });
    const text = new File(['hello'], 'note.txt', { type: 'text/plain' });

    const event = {
      clipboardData: {
        items: [
          { kind: 'file', type: 'image/png', getAsFile: () => image },
          { kind: 'file', type: 'text/plain', getAsFile: () => text },
        ],
        files: [image, text],
      },
    } as unknown as ClipboardEvent;

    expect(extractClipboardImageFiles(event)).toHaveLength(1);
    expect(extractClipboardImageFiles(event)[0]?.type).toBe('image/png');
  });

  it('dedupes the same image exposed via items and files', () => {
    const fromItems = new File([new Uint8Array([9, 9, 9])], 'image.png', {
      type: 'image/png',
      lastModified: 1_700_000_000_000,
    });
    const fromFiles = new File([new Uint8Array([9, 9, 9])], 'image.png', {
      type: 'image/png',
      lastModified: 1_700_000_000_000,
    });

    const event = {
      clipboardData: {
        items: [{ kind: 'file', type: 'image/png', getAsFile: () => fromItems }],
        files: [fromFiles],
      },
    } as unknown as { clipboardData: DataTransfer };

    expect(extractClipboardImageFiles(event)).toHaveLength(1);
  });
});
