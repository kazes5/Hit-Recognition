import type { PreviewProvider } from './types.js';

export const MOCK_AUDIO_PATH = '/api/mock-audio';

export class MockPreviewProvider implements PreviewProvider {
  async getPreviewUrl(): Promise<string | null> {
    return MOCK_AUDIO_PATH;
  }
}
