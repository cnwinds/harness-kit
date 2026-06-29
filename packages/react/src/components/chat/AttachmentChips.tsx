import { Loader2, X } from 'lucide-react';
import type { ComposerAttachment } from '../../hooks/useComposerAttachments.js';
import { useFilePreviewUrl } from '../../hooks/useFilePreviewUrl.js';
import { imagePreviewActions } from '../../hooks/useImagePreview.js';
import { formatBytes } from '../../lib/utils.js';
import { cn } from '../../lib/cn.js';

export interface AttachmentChipsProps {
  attachments: ComposerAttachment[];
  onRemove?: (localId: string) => void;
}

const ComposerImageThumb = ({
  attachment,
  onRemove,
}: {
  attachment: ComposerAttachment;
  onRemove?: (localId: string) => void;
}) => {
  const isUploading = attachment.status === 'uploading';
  const { previewUrl: remotePreviewUrl, loading, error } = useFilePreviewUrl(
    attachment.file ?? null,
    Boolean(attachment.file) && !attachment.previewUrl,
    'thumbnail',
  );
  const thumbUrl = attachment.previewUrl ?? remotePreviewUrl;

  const openPreview = () => {
    if (!thumbUrl && !attachment.file) {
      return;
    }

    imagePreviewActions.open({
      id: attachment.fileId ?? attachment.localId,
      file: attachment.file,
      src: attachment.previewUrl ?? undefined,
      label: attachment.displayName,
      mimeType: attachment.mimeType,
    });
  };

  return (
    <div className="group/thumb relative shrink-0">
      <button
        type="button"
        onClick={openPreview}
        disabled={!thumbUrl && !attachment.file}
        className={cn(
          'relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-hover transition-colors',
          'hover:border-accent focus-visible:border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent',
          isUploading && 'opacity-80',
        )}
        aria-label={`预览图片：${attachment.displayName}`}
        title={attachment.displayName}
      >
        {thumbUrl ? (
          <img
            src={thumbUrl}
            alt={attachment.displayName}
            draggable={false}
            className="h-full w-full object-cover transition-transform group-hover/thumb:scale-[1.03]"
          />
        ) : (
          <span className="px-1 text-center text-2xs text-foreground-muted">
            {loading ? '加载中' : error ? '预览失败' : '图片'}
          </span>
        )}

        {isUploading ? (
          <span className="absolute inset-0 flex items-center justify-center bg-black/35">
            <Loader2 className="h-4 w-4 animate-spin text-white" aria-hidden />
            <span className="sr-only">上传中</span>
          </span>
        ) : null}
      </button>

      {onRemove ? (
        <button
          type="button"
          onClick={() => onRemove(attachment.localId)}
          className="absolute -right-1.5 -top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-border bg-surface text-foreground-muted shadow-sm hover:bg-surface-hover hover:text-foreground"
          aria-label={`移除附件：${attachment.displayName}`}
          title="移除附件"
        >
          <X className="h-3 w-3" />
        </button>
      ) : null}
    </div>
  );
};

const ComposerFileChip = ({
  attachment,
  onRemove,
}: {
  attachment: ComposerAttachment;
  onRemove?: (localId: string) => void;
}) => {
  const isUploading = attachment.status === 'uploading';

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-md border border-border bg-surface-hover px-2 py-1 text-2xs',
        isUploading && 'animate-pulse',
      )}
    >
      <span className="max-w-[10rem] truncate font-medium text-foreground">
        {attachment.displayName}
      </span>
      <span className="text-foreground-muted">
        {isUploading ? '上传中...' : `已附加 · ${formatBytes(attachment.size)}`}
      </span>
      {onRemove ? (
        <button
          type="button"
          onClick={() => onRemove(attachment.localId)}
          className="rounded p-0.5 text-foreground-muted hover:bg-surface hover:text-foreground"
          aria-label={`移除附件：${attachment.displayName}`}
          title="移除附件"
        >
          <X className="h-3 w-3" />
        </button>
      ) : null}
    </div>
  );
};

export const AttachmentChips = ({ attachments, onRemove }: AttachmentChipsProps) => {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <div
      className="flex flex-wrap gap-2 overflow-x-auto pb-2"
      aria-live="polite"
    >
      {attachments.map((attachment) =>
        attachment.mimeType?.startsWith('image/') ? (
          <ComposerImageThumb
            key={attachment.localId}
            attachment={attachment}
            onRemove={onRemove}
          />
        ) : (
          <ComposerFileChip
            key={attachment.localId}
            attachment={attachment}
            onRemove={onRemove}
          />
        ),
      )}
    </div>
  );
};

export default AttachmentChips;
