import { useCallback } from 'react';
import type { FileRecord } from '@harnesskit/protocol';
import type { FileApiLike } from '../file-api-types.js';
import {
  createComposerAttachmentId,
  getComposerAttachmentsState,
  revokeComposerAttachmentPreview,
  useComposerAttachments,
  type ComposerAttachment,
} from './useComposerAttachments.js';

const createPreviewUrl = (file: File) =>
  (file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined);

export const useComposerFileUpload = (args: {
  sessionId: string | null;
  filesApi: FileApiLike;
  ensureSessionId: () => Promise<string>;
  disabled?: boolean;
}) => {
  const { attachments, update, clear } = useComposerAttachments(args.sessionId);

  const uploadFiles = useCallback(async (files: File[]) => {
    if (args.disabled) {
      return;
    }

    const uploadableFiles = files.filter((file) => file.size > 0);
    if (uploadableFiles.length === 0) {
      return;
    }

    if (!args.filesApi.uploadFile) {
      throw new Error('当前环境未配置文件上传');
    }

    const targetSessionId = await args.ensureSessionId();

    for (const file of uploadableFiles) {
      const localId = createComposerAttachmentId();
      const previewUrl = createPreviewUrl(file);
      const pending: ComposerAttachment = {
        localId,
        displayName: file.name,
        mimeType: file.type || null,
        size: file.size,
        status: 'uploading',
        previewUrl,
      };

      update(targetSessionId, (current) => [...current, pending]);

      try {
        const record: FileRecord = await args.filesApi.uploadFile!(targetSessionId, file);
        update(targetSessionId, (current) =>
          current.map((item) =>
            item.localId === localId
              ? {
                  ...item,
                  fileId: record.id,
                  file: record,
                  displayName: record.displayName,
                  mimeType: record.mimeType,
                  size: record.size,
                  status: 'uploaded',
                }
              : item,
          ),
        );
      } catch (error) {
        if (previewUrl) {
          revokeComposerAttachmentPreview(pending);
        }
        update(targetSessionId, (current) => current.filter((item) => item.localId !== localId));
        throw error;
      }
    }
  }, [args]);

  const removeAttachment = useCallback((localId: string) => {
    const bySession = getComposerAttachmentsState().bySession;
    for (const [sessionKey, items] of Object.entries(bySession)) {
      const target = items.find((item) => item.localId === localId);
      if (!target) {
        continue;
      }
      revokeComposerAttachmentPreview(target);
      update(sessionKey, (current) => current.filter((item) => item.localId !== localId));
      return;
    }
  }, [update]);

  const uploadedAttachmentIds = attachments
    .filter((item) => item.status === 'uploaded' && item.fileId)
    .map((item) => item.fileId!);

  const hasUploadingAttachments = attachments.some((item) => item.status === 'uploading');

  return {
    attachments,
    uploadFiles,
    removeAttachment,
    clearAttachments: clear,
    uploadedAttachmentIds,
    hasUploadingAttachments,
    hasAttachments: attachments.length > 0,
  };
};
