import type { PreviewProvider } from './types.js';

export const MOCK_AUDIO_PATH = '/api/mock-audio';

export const MOCK_COVER_PATH = '/api/mock-cover';

export class MockPreviewProvider implements PreviewProvider {
  async getPreviewUrl(): Promise<string | null> {
    return MOCK_AUDIO_PATH;
  }

  async getCoverUrl(): Promise<string | null> {
    return MOCK_COVER_PATH;
  }
}
