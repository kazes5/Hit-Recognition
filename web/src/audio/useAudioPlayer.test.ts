import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeAudio } from '../test/fakeAudio';
import { setAudioFactory, useAudioPlayer } from './useAudioPlayer';

let restore: () => void;

beforeEach(() => {
  FakeAudio.reset();
  restore = setAudioFactory(() => new FakeAudio());
});

afterEach(() => {
  restore();
  vi.useRealTimers();
});

describe('useAudioPlayer', () => {
  it('does not create or play audio until play() is called', () => {
    const { result } = renderHook(() => useAudioPlayer());
    expect(FakeAudio.instances).toHaveLength(0);
    expect(result.current.isPlaying).toBe(false);
  });

  it('plays from the start and replays', () => {
    const { result } = renderHook(() => useAudioPlayer());
    act(() => result.current.play('/clip.mp3'));
    const a = FakeAudio.last();
    expect(a.src).toBe('/clip.mp3');
    expect(a.playCalls).toBe(1);
    expect(result.current.isPlaying).toBe(true);
    a.currentTime = 12;
    act(() => result.current.play('/clip.mp3'));
    expect(a.currentTime).toBe(0);
    expect(a.playCalls).toBe(2);
    expect(FakeAudio.instances).toHaveLength(1);
  });

  it('stops 30 seconds after playback actually starts, not after the tap', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useAudioPlayer());
    act(() => result.current.play('/clip.mp3'));
    const a = FakeAudio.last();
    // Slow load: 10 s of buffering before audio starts must not count.
    act(() => vi.advanceTimersByTime(10_000));
    expect(a.paused).toBe(false);
    act(() => a.emit('playing'));
    act(() => vi.advanceTimersByTime(29_000));
    expect(a.paused).toBe(false);
    act(() => vi.advanceTimersByTime(1_000));
    expect(a.paused).toBe(true);
    expect(result.current.isPlaying).toBe(false);
  });

  it('does not count stalls (waiting) against the clip', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useAudioPlayer());
    act(() => result.current.play('/clip.mp3'));
    const a = FakeAudio.last();
    act(() => a.emit('playing'));
    act(() => vi.advanceTimersByTime(10_000));
    a.currentTime = 10;
    act(() => a.emit('waiting'));
    act(() => vi.advanceTimersByTime(60_000));
    expect(a.paused).toBe(false);
    act(() => a.emit('playing'));
    act(() => vi.advanceTimersByTime(19_900));
    expect(a.paused).toBe(false);
    act(() => vi.advanceTimersByTime(200));
    expect(a.paused).toBe(true);
  });

  it('stops when timeupdate passes the clip length', () => {
    const { result } = renderHook(() => useAudioPlayer({ maxSeconds: 30 }));
    act(() => result.current.play('/clip.mp3'));
    const a = FakeAudio.last();
    a.currentTime = 30.1;
    act(() => a.emit('timeupdate'));
    expect(a.paused).toBe(true);
    expect(result.current.isPlaying).toBe(false);
  });

  it('stop() pauses', () => {
    const { result } = renderHook(() => useAudioPlayer());
    act(() => result.current.play('/clip.mp3'));
    act(() => result.current.stop());
    expect(FakeAudio.last().paused).toBe(true);
    expect(result.current.isPlaying).toBe(false);
  });

  it('calls onError when the source fails to load', () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useAudioPlayer({ onError }));
    act(() => result.current.play('/broken.mp3'));
    act(() => FakeAudio.last().emit('error'));
    expect(onError).toHaveBeenCalledTimes(1);
    expect(result.current.isPlaying).toBe(false);
  });

  it('calls onError when play() rejects with a media error', async () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useAudioPlayer({ onError }));
    setAudioFactory(() => {
      const a = new FakeAudio();
      a.playResult = () => Promise.reject(Object.assign(new Error('bad'), { name: 'NotSupportedError' }));
      return a;
    });
    await act(async () => result.current.play('/x.mp3'));
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('does not treat autoplay blocking / interruption as a broken preview', async () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useAudioPlayer({ onError }));
    setAudioFactory(() => {
      const a = new FakeAudio();
      a.playResult = () => Promise.reject(Object.assign(new Error('blocked'), { name: 'NotAllowedError' }));
      return a;
    });
    await act(async () => result.current.play('/x.mp3'));
    expect(onError).not.toHaveBeenCalled();
    expect(result.current.isPlaying).toBe(false);
  });

  it('pauses on unmount', () => {
    const { result, unmount } = renderHook(() => useAudioPlayer());
    act(() => result.current.play('/clip.mp3'));
    unmount();
    expect(FakeAudio.last().paused).toBe(true);
  });
});
