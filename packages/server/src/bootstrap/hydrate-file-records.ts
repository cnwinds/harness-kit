import fs from 'node:fs/promises';
import path from 'node:path';
import type { FileRecord } from '@harnesskit/protocol';
import type { LocalFileService } from './local-file-service.js';

const FILE_EVENT_KINDS = new Set(['image', 'file']);

const readFileFromEvent = (event: { kind: string; file?: FileRecord }): FileRecord | null => {
  if (!FILE_EVENT_KINDS.has(event.kind) || !event.file?.id) {
    return null;
  }
  return event.file;
};

export const hydrateFileRecordById = async (args: {
  dataRoot: string;
  userId: string;
  fileId: string;
  fileService: LocalFileService;
}): Promise<boolean> => {
  const sessionsRoot = path.join(args.dataRoot, 'users', args.userId, 'sessions');
  let sessionDirs: string[];
  try {
    sessionDirs = await fs.readdir(sessionsRoot);
  } catch {
    return false;
  }

  for (const sessionId of sessionDirs) {
    const messagesPath = path.join(sessionsRoot, sessionId, 'messages.jsonl');
    let content: string;
    try {
      content = await fs.readFile(messagesPath, 'utf8');
    } catch {
      continue;
    }

    for (const line of content.split('\n')) {
      if (!line.trim()) {
        continue;
      }

      try {
        const event = JSON.parse(line) as { kind: string; file?: FileRecord };
        const file = readFileFromEvent(event);
        if (!file || file.id !== args.fileId) {
          continue;
        }
        args.fileService.registerRecord(file);
        return true;
      } catch {
        continue;
      }
    }
  }

  return false;
};
