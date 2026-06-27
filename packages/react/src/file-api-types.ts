import type { FileRecord } from '@harnesskit/protocol';

export type FileApiLike = {
  fetchFileBlob: (fileId: string) => Promise<Blob>;
  fetchFilePreviewBlob: (file: FileRecord) => Promise<Blob>;
};
