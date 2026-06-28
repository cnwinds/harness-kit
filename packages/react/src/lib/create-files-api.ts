import type { FileRecord } from '@harnesskit/protocol';
import type { FileApiLike } from '../file-api-types.js';

export const createHarnessFilesApi = (args: {
  apiBase: string;
  credentials?: RequestCredentials;
  fetchOptions?: RequestInit;
}): FileApiLike => {
  const fetchBlob = async (url: string) => {
    const response = await fetch(url, {
      credentials: args.credentials ?? 'include',
      ...args.fetchOptions,
    });
    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || `HTTP ${response.status}`);
    }
    return response.blob();
  };

  return {
    fetchFileBlob: (fileId: string) => fetchBlob(`${args.apiBase}/files/${fileId}/download`),
    fetchFilePreviewBlob: (file: FileRecord) => fetchBlob(`${args.apiBase}/files/${file.id}/preview`),
  };
};
