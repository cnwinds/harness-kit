import type { FileRecord } from '@skillchat/harness-protocol';

export type FileApiLike = {
  fetchFileBlob: (fileId: string) => Promise<Blob>;
  fetchFilePreviewBlob: (file: FileRecord) => Promise<Blob>;
  uploadFile?: (sessionId: string, file: File) => Promise<FileRecord>;
};
