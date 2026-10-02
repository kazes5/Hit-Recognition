import type { AudioLike } from '../audio/useAudioPlayer';

/** Controllable stand-in for HTMLAudioElement. */
export class FakeAudio implements AudioLike {
  static instances: FakeAudio[] = [];
  src = '';
  currentTime = 0;
  preload = '';
  paused = true;
  playCalls = 0;
  playResult: () => Promise<void> = () => Promise.resolve();
  private listeners = new Map<string, Set<() => void>>();

  constructor() {
    FakeAudio.instances.push(this);
  }

  play(): Promise<void> {
    this.playCalls++;
    this.paused = false;
    return this.playResult();
  }

  pause(): void {
    this.paused = true;
  }

  addEventListener(type: string, listener: () => void): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)?.add(listener);
  }

  removeEventListener(type: string, listener: () => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type: string): void {
    this.listeners.get(type)?.forEach((l) => l());
  }

  static reset(): void {
    FakeAudio.instances = [];
  }

  static last(): FakeAudio {
    const a = FakeAudio.instances[FakeAudio.instances.length - 1];
    if (!a) throw new Error('No FakeAudio created');
    return a;
  }
}
