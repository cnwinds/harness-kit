import { useEffect, useState } from 'react';
import type { FileRecord } from '@harnesskit/protocol';
import { useHarnessChatContext } from '../provider.js';

export const useFilePreviewUrl = (
  file: FileRecord | null,
  enabled = true,
  variant: 'thumbnail' | 'original' = 'thumbnail',
) => {
  const { filesApi } = useHarnessChatContext();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !file || !filesApi) {
      setPreviewUrl(null);
      setLoading(false);
      setError(null);
      return;
    }

    let revokedUrl: string | null = null;
    let disposed = false;

    setLoading(true);
    setError(null);

    const loadBlob = variant === 'original'
      ? filesApi.fetchFileBlob(file.id)
      : filesApi.fetchFilePreviewBlob(file);

    void loadBlob
      .then((blob) => {
        if (disposed) {
          return;
        }
        revokedUrl = URL.createObjectURL(blob);
        setPreviewUrl(revokedUrl);
      })
      .catch((fetchError) => {
        if (disposed) {
          return;
        }
        setError(fetchError instanceof Error ? fetchError.message : '图片预览失败');
      })
      .finally(() => {
        if (!disposed) {
          setLoading(false);
        }
      });

    return () => {
      disposed = true;
      if (revokedUrl) {
        URL.revokeObjectURL(revokedUrl);
      }
    };
  }, [enabled, file, filesApi, variant]);

  return {
    previewUrl,
    loading,
    error,
  };
};
