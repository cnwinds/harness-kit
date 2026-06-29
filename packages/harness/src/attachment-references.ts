import type { FileRecord } from '@skillchat/harness-protocol';

const toSessionRelativePath = (relativePath: string) => {
  const normalized = relativePath.replace(/\\/g, '/');
  const sessionMatch = normalized.match(/^sessions\/[^/]+\/(.+)$/);
  return sessionMatch?.[1] ?? normalized;
};

export const formatUserAttachmentReferences = (files: FileRecord[]) => {
  if (files.length === 0) {
    return '';
  }

  const lines = files.map((file) => {
    const path = toSessionRelativePath(file.relativePath);
    const mime = file.mimeType ?? 'application/octet-stream';
    return `- ${file.displayName} (id: ${file.id}, mime: ${mime}, size: ${file.size} bytes, path: ${path})`;
  });

  return [
    '[用户附件]',
    ...lines,
    '这些文件已保存到当前会话 uploads 目录，可通过文件/工作区工具读取。',
  ].join('\n');
};
