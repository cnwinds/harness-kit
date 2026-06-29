import type { FileBucket, FileRecord, FileVisibility, SessionFileContext } from '@skillchat/harness-protocol';

export type MultipartFileLike = {
  filename: string;
  mimetype: string;
  toBuffer(): Promise<Buffer>;
};

/** File operations required by harness tools and image service */
export interface FileServiceLike {
  getById(userId: string, fileId: string): FileRecord;
  list(
    userId: string,
    filters?: { sessionId?: string; bucket?: FileBucket; type?: string; visibility?: FileVisibility | 'all' },
  ): FileRecord[];
  saveUpload(userId: string, sessionId: string, file: MultipartFileLike): Promise<FileRecord>;
  recordGeneratedFile(args: {
    userId: string;
    sessionId: string;
    displayName: string;
    absolutePath: string;
    mimeType?: string | null;
    visibility?: FileVisibility;
  }): Promise<FileRecord>;
  saveGeneratedBinary(args: {
    userId: string;
    sessionId: string;
    displayName: string;
    buffer: Buffer;
    mimeType?: string | null;
    visibility?: FileVisibility;
  }): Promise<FileRecord>;
  getFileContext(userId: string, sessionId: string): SessionFileContext[];
  resolveDownloadPath(userId: string, fileId: string): Promise<{ absolutePath: string; file: FileRecord }>;
  resolveThumbnailPath?(userId: string, fileId: string): Promise<{ absolutePath: string; file: FileRecord } | null>;
}

export type { SkillDescriptor } from './skill-descriptor.js';
