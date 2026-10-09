import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DIFFICULTY_STORAGE_KEY,
  loadDifficulty,
  saveDifficulty,
  toMaxDifficulty,
} from './settings';

afterEach(() => vi.restoreAllMocks());

describe('difficulty setting', () => {
  it('defaults to easy', () => {
    expect(loadDifficulty()).toBe('easy');
  });

  it('saves and loads the choice under hitster.difficulty', () => {
    saveDifficulty('medium');
    expect(localStorage.getItem(DIFFICULTY_STORAGE_KEY)).toBe('medium');
    expect(DIFFICULTY_STORAGE_KEY).toBe('hitster.difficulty');
    expect(loadDifficulty()).toBe('medium');
  });

  it('ignores an unknown stored value', () => {
    localStorage.setItem(DIFFICULTY_STORAGE_KEY, 'insane');
    expect(loadDifficulty()).toBe('easy');
  });

  it('survives blocked storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(loadDifficulty()).toBe('easy');
    expect(() => saveDifficulty('hard')).not.toThrow();
  });

  it('maps to maxDifficulty 1 / 2 / 3', () => {
    expect(toMaxDifficulty('easy')).toBe(1);
    expect(toMaxDifficulty('medium')).toBe(2);
    expect(toMaxDifficulty('hard')).toBe(3);
  });
});
