const clipboardImageExtension = (mimeType: string) => {
  const subtype = mimeType.split('/')[1]?.toLowerCase() ?? 'png';
  if (subtype === 'jpeg') {
    return 'jpg';
  }
  return subtype.replace(/[^a-z0-9]+/g, '') || 'png';
};

export const normalizeClipboardImageFile = (file: File, index: number): File => {
  if (!file.type.startsWith('image/')) {
    return file;
  }

  const hasUsableName = file.name.trim().length > 0 && file.name !== 'image.png' && file.name !== 'blob';
  if (hasUsableName) {
    return file;
  }

  const extension = clipboardImageExtension(file.type);
  return new File([file], `pasted-image-${Date.now()}-${index + 1}.${extension}`, {
    type: file.type,
    lastModified: file.lastModified,
  });
};

/** Extract image files from a textarea paste event (Ctrl+V). */
export const extractClipboardImageFiles = (event: {
  clipboardData: DataTransfer | null;
}): File[] => {
  const clipboard = event.clipboardData;
  if (!clipboard) {
    return [];
  }

  const files: File[] = [];
  const seenKeys = new Set<string>();

  const fingerprint = (file: File) =>
    `${file.type}:${file.size}:${file.lastModified}`;

  const pushFile = (file: File | null) => {
    if (!file || !file.type.startsWith('image/')) {
      return;
    }
    const key = fingerprint(file);
    if (seenKeys.has(key)) {
      return;
    }
    seenKeys.add(key);
    files.push(normalizeClipboardImageFile(file, files.length));
  };

  for (const item of Array.from(clipboard.items)) {
    if (item.kind === 'file') {
      pushFile(item.getAsFile());
    }
  }

  // items 为空时回退（部分浏览器）；避免与 items 重复枚举 files
  if (files.length === 0) {
    for (const file of Array.from(clipboard.files)) {
      pushFile(file);
    }
  }

  return files;
};
