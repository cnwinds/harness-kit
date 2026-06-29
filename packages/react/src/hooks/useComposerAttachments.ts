import { useCallback } from 'react';
import { create } from 'zustand';
import type { FileRecord } from '@skillchat/harness-protocol';

export interface ComposerAttachment {
  localId: string;
  fileId?: string;
  file?: FileRecord;
  displayName: string;
  mimeType: string | null;
  size: number;
  status: 'uploading' | 'uploaded';
  /** Local blob URL for instant thumbnail preview before / without server fetch */
  previewUrl?: string;
}

interface ComposerAttachmentsState {
  bySession: Record<string, ComposerAttachment[]>;
  setForSession: (
    sessionId: string,
    updater: (current: ComposerAttachment[]) => ComposerAttachment[],
  ) => void;
  clearSession: (sessionId: string) => void;
  clearAll: () => void;
  addFromFileRecord: (sessionId: string, file: FileRecord) => void;
}

export const createComposerAttachmentId = () =>
  `attachment_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const revokeComposerAttachmentPreview = (attachment: ComposerAttachment) => {
  if (attachment.previewUrl?.startsWith('blob:')) {
    URL.revokeObjectURL(attachment.previewUrl);
  }
};

const revokeComposerAttachments = (attachments: ComposerAttachment[]) => {
  for (const attachment of attachments) {
    revokeComposerAttachmentPreview(attachment);
  }
};

const useComposerAttachmentsStore = create<ComposerAttachmentsState>((set) => ({
  bySession: {},
  setForSession: (sessionId, updater) =>
    set((state) => {
      const previous = state.bySession[sessionId] ?? [];
      const next = updater(previous);
      if (next.length === 0) {
        revokeComposerAttachments(previous);
        const { [sessionId]: _removed, ...rest } = state.bySession;
        return { bySession: rest };
      }
      const nextIds = new Set(next.map((item) => item.localId));
      for (const item of previous) {
        if (!nextIds.has(item.localId)) {
          revokeComposerAttachmentPreview(item);
        }
      }
      return { bySession: { ...state.bySession, [sessionId]: next } };
    }),
  clearSession: (sessionId) =>
    set((state) => {
      if (!(sessionId in state.bySession)) {
        return state;
      }
      revokeComposerAttachments(state.bySession[sessionId] ?? []);
      const { [sessionId]: _removed, ...rest } = state.bySession;
      return { bySession: rest };
    }),
  clearAll: () => set({ bySession: {} }),
  addFromFileRecord: (sessionId, file) =>
    set((state) => {
      const current = state.bySession[sessionId] ?? [];
      if (current.some((item) => item.fileId === file.id)) {
        return state;
      }
      const next: ComposerAttachment = {
        localId: createComposerAttachmentId(),
        fileId: file.id,
        displayName: file.displayName,
        mimeType: file.mimeType,
        size: file.size,
        status: 'uploaded',
      };
      return { bySession: { ...state.bySession, [sessionId]: [...current, next] } };
    }),
}));

export const getComposerAttachmentsState = () => useComposerAttachmentsStore.getState();

/**
 * Hook returning the composer attachments scoped to the active session,
 * along with mutators that auto-target the same session.
 */
export const useComposerAttachments = (sessionId: string | null) => {
  const bySession = useComposerAttachmentsStore((state) => state.bySession);
  const setForSession = useComposerAttachmentsStore((state) => state.setForSession);
  const clearSession = useComposerAttachmentsStore((state) => state.clearSession);

  const attachments = sessionId ? bySession[sessionId] ?? [] : [];

  const update = useCallback((
    targetId: string,
    updater: (current: ComposerAttachment[]) => ComposerAttachment[],
  ) => {
    setForSession(targetId, updater);
  }, [setForSession]);

  const clear = useCallback((targetId?: string) => {
    const id = targetId ?? sessionId;
    if (id) {
      clearSession(id);
    }
  }, [clearSession, sessionId]);

  return {
    attachments,
    update,
    clear,
  };
};

export const composerAttachmentsActions = {
  addFromFileRecord: (sessionId: string, file: FileRecord) =>
    useComposerAttachmentsStore.getState().addFromFileRecord(sessionId, file),
  clearAll: () => useComposerAttachmentsStore.getState().clearAll(),
};
