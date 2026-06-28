import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useFilePreviewUrl } from '../../hooks/useFilePreviewUrl.js';
import { useImagePreview, useImagePreviewActions } from '../../hooks/useImagePreview.js';
import { cn } from '../../lib/cn.js';

export const ImagePreviewLightbox = () => {
  const target = useImagePreview();
  const { close } = useImagePreviewActions();
  const { previewUrl, loading, error } = useFilePreviewUrl(
    target?.file ?? null,
    Boolean(target?.file),
    'original',
  );
  const displayUrl = target?.src ?? previewUrl;

  useEffect(() => {
    if (!target) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [close, target]);

  if (!target) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={target.label ?? '图片预览'}
      onClick={close}
    >
      <button
        type="button"
        onClick={close}
        className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white hover:bg-black/60"
        aria-label="关闭预览"
      >
        <X className="h-4 w-4" />
      </button>

      <div
        className="flex max-h-[90vh] max-w-[min(96vw,72rem)] flex-col items-center gap-3"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex max-h-[calc(90vh-4rem)] w-full items-center justify-center overflow-hidden rounded-lg">
          {loading ? (
            <div className="px-6 py-10 text-sm text-white/80">大图加载中…</div>
          ) : displayUrl ? (
            <img
              src={displayUrl}
              alt={target.label ?? target.caption ?? '预览图片'}
              className="max-h-[calc(90vh-4rem)] max-w-full object-contain"
              draggable={false}
            />
          ) : (
            <div className="px-6 py-10 text-sm text-white/80">
              {error ?? '无法加载图片'}
            </div>
          )}
        </div>

        {(target.label || target.caption) ? (
          <div className={cn('max-w-full text-center text-sm text-white/85')}>
            {target.label ? <div className="font-medium">{target.label}</div> : null}
            {target.caption && target.caption !== target.label ? (
              <div className="mt-1 text-xs text-white/70">{target.caption}</div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
};
