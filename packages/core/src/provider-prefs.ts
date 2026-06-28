import fs from 'node:fs/promises';
import path from 'node:path';
import type { ImageProviderId, ProviderPrefsFile, WebSearchProviderId } from './provider-types.js';

const PREFS_FILENAME = '.provider-prefs.json';

export class ProviderPrefsStore {
  private cache: ProviderPrefsFile | null = null;

  constructor(private readonly dataRoot: string) {}

  private prefsPath() {
    return path.join(this.dataRoot, PREFS_FILENAME);
  }

  private async readPrefs(): Promise<ProviderPrefsFile> {
    if (this.cache) {
      return this.cache;
    }

    try {
      const raw = await fs.readFile(this.prefsPath(), 'utf8');
      const parsed = JSON.parse(raw) as ProviderPrefsFile;
      this.cache = parsed && typeof parsed === 'object' ? parsed : {};
      return this.cache;
    } catch {
      this.cache = {};
      return this.cache;
    }
  }

  private async writePrefs(prefs: ProviderPrefsFile) {
    this.cache = prefs;
    await fs.mkdir(this.dataRoot, { recursive: true });
    await fs.writeFile(this.prefsPath(), `${JSON.stringify(prefs, null, 2)}\n`, 'utf8');
  }

  async getPreferredWebSearchProvider(): Promise<WebSearchProviderId | null> {
    const prefs = await this.readPrefs();
    return prefs.webSearch?.preferredProviderId ?? null;
  }

  async setPreferredWebSearchProvider(providerId: WebSearchProviderId) {
    const prefs = await this.readPrefs();
    await this.writePrefs({
      ...prefs,
      webSearch: {
        preferredProviderId: providerId,
        lastSuccessAt: new Date().toISOString(),
      },
    });
  }

  async getPreferredImageProvider(): Promise<ImageProviderId | null> {
    const prefs = await this.readPrefs();
    return prefs.imageGeneration?.preferredProviderId ?? null;
  }

  async setPreferredImageProvider(providerId: ImageProviderId) {
    const prefs = await this.readPrefs();
    await this.writePrefs({
      ...prefs,
      imageGeneration: {
        preferredProviderId: providerId,
        lastSuccessAt: new Date().toISOString(),
      },
    });
  }
}
