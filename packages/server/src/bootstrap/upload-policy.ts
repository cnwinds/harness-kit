import path from 'node:path';

const BLOCKED_EXTENSIONS = new Set([
  '.exe',
  '.bat',
  '.cmd',
  '.com',
  '.msi',
  '.dll',
  '.scr',
  '.ps1',
  '.vbs',
  '.js',
  '.mjs',
  '.cjs',
  '.jar',
  '.app',
]);

const MIME_BY_EXTENSION: Record<string, string> = {
  '.csv': 'text/csv',
  '.har': 'application/json',
  '.json': 'application/json',
  '.jsonl': 'application/jsonl',
  '.zip': 'application/zip',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.pdf': 'application/pdf',
  '.xml': 'application/xml',
  '.yaml': 'application/yaml',
  '.yml': 'application/yaml',
};

export const normalizeUploadMimeType = (filename: string, mimetype: string) => {
  const trimmed = mimetype.trim().toLowerCase();
  if (trimmed && trimmed !== 'application/octet-stream') {
    return trimmed;
  }

  const extension = path.extname(filename).toLowerCase();
  return MIME_BY_EXTENSION[extension] ?? (trimmed || 'application/octet-stream');
};

export const validateComposerUpload = (filename: string) => {
  const safeName = path.basename(filename).trim();
  if (!safeName || safeName === '.' || safeName === '..') {
    return { ok: false as const, error: '文件名无效' };
  }

  const extension = path.extname(safeName).toLowerCase();
  if (BLOCKED_EXTENSIONS.has(extension)) {
    return { ok: false as const, error: `不支持上传 ${extension || '该类型'} 文件` };
  }

  return { ok: true as const, filename: safeName };
};
