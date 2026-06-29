import fs from 'node:fs/promises';
import path from 'node:path';
import { nanoid } from 'nanoid';
import type { FileBucket, FileRecord, FileVisibility, SessionFileContext } from '@skillchat/harness-protocol';
import type { HarnessConfig } from '@skillchat/harness-core';
import type { FileServiceLike, MultipartFileLike } from '@skillchat/harness-core';
import { assertPathInside, sanitizeFilename, uniqueFileName } from '@skillchat/harness-core';
import { getSessionOutputsRoot, getSessionUploadsRoot } from '@skillchat/harness-core';

export class LocalFileService implements FileServiceLike {
  private readonly records = new Map<string, FileRecord>();

  constructor(private readonly config: HarnessConfig) {}

  private key(userId: string, fileId: string) {
    return `${userId}:${fileId}`;
  }

  registerRecord(record: FileRecord): void {
    this.records.set(this.key(record.userId, record.id), record);
  }

  getById(userId: string, fileId: string): FileRecord {
    const record = this.records.get(this.key(userId, fileId));
    if (!record) {
      throw new Error(`文件不存在：${fileId}`);
    }
    return record;
  }

  list(
    userId: string,
    filters?: { sessionId?: string; bucket?: FileBucket; type?: string; visibility?: FileVisibility | 'all' },
  ): FileRecord[] {
    return [...this.records.values()].filter((record) => {
      if (record.userId !== userId) {
        return false;
      }
      if (filters?.sessionId && record.sessionId !== filters.sessionId) {
        return false;
      }
      if (filters?.bucket && record.bucket !== filters.bucket) {
        return false;
      }
      if (filters?.visibility && filters.visibility !== 'all' && record.visibility !== filters.visibility) {
        return false;
      }
      return true;
    });
  }

  async saveUpload(userId: string, sessionId: string, file: MultipartFileLike): Promise<FileRecord> {
    const uploadsRoot = getSessionUploadsRoot(this.config, userId, sessionId);
    await fs.mkdir(uploadsRoot, { recursive: true });
    const safeName = uniqueFileName(file.filename);
    const absolutePath = path.join(uploadsRoot, safeName);
    const buffer = await file.toBuffer();
    await fs.writeFile(absolutePath, buffer);

    const record: FileRecord = {
      id: `file_${nanoid()}`,
      userId,
      sessionId,
      displayName: sanitizeFilename(file.filename),
      mimeType: file.mimetype,
      size: buffer.byteLength,
      bucket: 'uploads',
      relativePath: path.relative(this.config.DATA_ROOT, absolutePath).replace(/\\/g, '/'),
      visibility: 'visible',
      createdAt: new Date().toISOString(),
    };

    this.records.set(this.key(userId, record.id), record);
    return record;
  }

  async recordGeneratedFile(args: {
    userId: string;
    sessionId: string;
    displayName: string;
    absolutePath: string;
    mimeType?: string | null;
    visibility?: FileVisibility;
  }): Promise<FileRecord> {
    assertPathInside(this.config.DATA_ROOT, args.absolutePath);
    const record: FileRecord = {
      id: `file_${nanoid()}`,
      userId: args.userId,
      sessionId: args.sessionId,
      displayName: sanitizeFilename(args.displayName),
      mimeType: args.mimeType ?? 'application/octet-stream',
      size: (await fs.stat(args.absolutePath)).size,
      bucket: 'outputs',
      relativePath: path.relative(this.config.DATA_ROOT, args.absolutePath).replace(/\\/g, '/'),
      visibility: args.visibility ?? 'visible',
      createdAt: new Date().toISOString(),
    };
    this.records.set(this.key(args.userId, record.id), record);
    return record;
  }

  async saveGeneratedBinary(args: {
    userId: string;
    sessionId: string;
    displayName: string;
    buffer: Buffer;
    mimeType?: string | null;
    visibility?: FileVisibility;
  }): Promise<FileRecord> {
    const outputsRoot = getSessionOutputsRoot(this.config, args.userId, args.sessionId);
    await fs.mkdir(outputsRoot, { recursive: true });
    const absolutePath = path.join(outputsRoot, uniqueFileName(args.displayName));
    await fs.writeFile(absolutePath, args.buffer);
    return this.recordGeneratedFile({
      userId: args.userId,
      sessionId: args.sessionId,
      displayName: args.displayName,
      absolutePath,
      mimeType: args.mimeType,
      visibility: args.visibility,
    });
  }

  getFileContext(userId: string, sessionId: string): SessionFileContext[] {
    return this.list(userId, { sessionId }).map((file) => ({
      id: file.id,
      name: file.displayName,
      mimeType: file.mimeType,
      size: file.size,
      bucket: file.bucket,
      relativePath: file.relativePath,
    }));
  }

  async resolveDownloadPath(userId: string, fileId: string): Promise<{ absolutePath: string; file: FileRecord }> {
    const file = this.getById(userId, fileId);
    const absolutePath = path.join(this.config.DATA_ROOT, file.relativePath);
    return { absolutePath, file };
  }
}
