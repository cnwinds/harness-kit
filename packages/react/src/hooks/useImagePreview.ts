import { create } from 'zustand';
import type { FileRecord } from '@harnesskit/protocol';

export interface ImagePreviewTarget {
  id: string;
  file?: FileRecord;
  src?: string;
  label?: string;
  caption?: string;
  mimeType?: string | null;
}

interface ImagePreviewState {
  target: ImagePreviewTarget | null;
  open: (target: ImagePreviewTarget) => void;
  close: () => void;
}

const useImagePreviewStore = create<ImagePreviewState>((set) => ({
  target: null,
  open: (target) => set({ target }),
  close: () => set({ target: null }),
}));

export const useImagePreview = () => useImagePreviewStore((state) => state.target);
export const useImagePreviewActions = () => ({
  open: useImagePreviewStore((state) => state.open),
  close: useImagePreviewStore((state) => state.close),
});

export const imagePreviewActions = {
  open: (target: ImagePreviewTarget) => useImagePreviewStore.getState().open(target),
  close: () => useImagePreviewStore.getState().close(),
};
