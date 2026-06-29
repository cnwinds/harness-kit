import type { FileRecord } from '@skillchat/harness-protocol';
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
    uploadFile: async (sessionId: string, file: File) => {
      const form = new FormData();
      form.append('file', file, file.name);
      const response = await fetch(`${args.apiBase}/sessions/${sessionId}/files`, {
        method: 'POST',
        credentials: args.credentials ?? 'include',
        ...args.fetchOptions,
        body: form,
        headers: {
          ...args.fetchOptions?.headers,
        },
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `HTTP ${response.status}`);
      }
      const data = await response.json() as { file: FileRecord };
      return data.file;
    },
  };
};
