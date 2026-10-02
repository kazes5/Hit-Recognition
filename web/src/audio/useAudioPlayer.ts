import { useCallback, useEffect, useRef, useState } from 'react';
import { CLIP_SECONDS } from '../game/types';

/** Minimal surface of HTMLAudioElement we rely on, so tests can supply a fake. */
export interface AudioLike {
  src: string;
  currentTime: number;
  preload: string;
  play(): Promise<void> | void;
  pause(): void;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

export type AudioFactory = () => AudioLike;

let factory: AudioFactory = () => new Audio();

/** Test hook: replace how audio elements are created. Returns a restore function. */
export function setAudioFactory(next: AudioFactory): () => void {
  const prev = factory;
  factory = next;
  return () => {
    factory = prev;
  };
}

export interface AudioPlayer {
  isPlaying: boolean;
  /** Start (or restart) the clip from 0. Must be called from a user gesture. */
  play(url: string): void;
  stop(): void;
}

export interface AudioPlayerOptions {
  /** Called when the source cannot be loaded or played. */
  onError?: () => void;
  maxSeconds?: number;
}

export function useAudioPlayer({ onError, maxSeconds = CLIP_SECONDS }: AudioPlayerOptions = {}): AudioPlayer {
  const audioRef = useRef<AudioLike | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const [isPlaying, setIsPlaying] = useState(false);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const stop = useCallback(() => {
    clearTimer();
    const a = audioRef.current;
    if (a) {
      a.pause();
    }
    setIsPlaying(false);
  }, []);

  const getAudio = useCallback((): AudioLike => {
    if (audioRef.current) return audioRef.current;
    const a = factory();
    a.preload = 'auto';
    a.addEventListener('ended', () => {
      clearTimer();
      setIsPlaying(false);
    });
    a.addEventListener('playing', () => {
      // Arm (or re-arm after buffering) the cutoff for the time still left.
      clearTimer();
      const remaining = Math.max(0, maxSeconds - (a.currentTime || 0));
      timerRef.current = setTimeout(() => {
        a.pause();
        setIsPlaying(false);
        timerRef.current = null;
      }, remaining * 1000);
    });
    a.addEventListener('waiting', () => {
      // Stalled: pause the countdown; `playing` re-arms it.
      clearTimer();
    });
    a.addEventListener('timeupdate', () => {
      if (a.currentTime >= maxSeconds) {
        clearTimer();
        a.pause();
        setIsPlaying(false);
      }
    });
    a.addEventListener('error', () => {
      clearTimer();
      setIsPlaying(false);
      // Ignore errors from an emptied source (stop/unmount).
      if (a.src) onErrorRef.current?.();
    });
    audioRef.current = a;
    return a;
  }, [maxSeconds]);

  const play = useCallback(
    (url: string) => {
      const a = getAudio();
      clearTimer();
      const absolute = new URL(url, window.location.href).href;
      if (a.src !== absolute && a.src !== url) a.src = url;
      try {
        a.currentTime = 0;
      } catch {
        /* some browsers throw before metadata loads */
      }
      // The 30 s cutoff timer is armed on the `playing` event (see getAudio),
      // so buffering on a slow connection does not eat into the clip.
      setIsPlaying(true);
      try {
        const result = a.play();
        if (result && typeof result.catch === 'function') {
          result.catch((err: unknown) => {
            clearTimer();
            setIsPlaying(false);
            // NotAllowedError = autoplay blocked, AbortError = interrupted by
            // pause/stop: neither means the preview itself is broken.
            const name = (err as { name?: string } | null)?.name;
            if (name !== 'NotAllowedError' && name !== 'AbortError') {
              onErrorRef.current?.();
            }
          });
        }
      } catch {
        clearTimer();
        setIsPlaying(false);
        onErrorRef.current?.();
      }
    },
    [getAudio, maxSeconds],
  );

  useEffect(
    () => () => {
      clearTimer();
      const a = audioRef.current;
      if (a) {
        a.pause();
      }
      audioRef.current = null;
    },
    [],
  );

  return { isPlaying, play, stop };
}
