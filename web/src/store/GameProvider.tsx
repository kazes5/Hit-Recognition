import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
} from 'react';
import { ApiError, fetchNextSong, fetchPreviewUrl } from '../api/client';
import { gameReducer, initialGameState, type GameAction } from '../game/reducer';
import { clearSavedGame, saveGame } from '../game/persistence';
import type { DifficultySetting, GameState, SongLanguageSetting } from '../game/types';
import {
  loadDifficulty,
  loadSongLanguages,
  saveDifficulty,
  saveSongLanguages,
  toLanguages,
  toMaxDifficulty,
} from './settings';

export type GameErrorKind = 'network' | 'noSongs' | 'generic';

/** Songs without a playable preview are skipped; give up after this many in a row. */
export const MAX_SONG_ATTEMPTS = 8;

interface GameContextValue {
  state: GameState;
  dispatch: Dispatch<GameAction>;
  error: GameErrorKind | null;
  loadingSong: boolean;
  retry: () => void;
  dismissError: () => void;
  songLanguages: SongLanguageSetting;
  setSongLanguages: (value: SongLanguageSetting) => void;
  difficulty: DifficultySetting;
  setDifficulty: (value: DifficultySetting) => void;
}

const GameContext = createContext<GameContextValue | null>(null);

function errorKind(err: unknown): GameErrorKind {
  if (err instanceof ApiError) {
    if (err.code === 'NO_SONGS_LEFT') return 'noSongs';
    if (err.code === 'NETWORK') return 'network';
  }
  return 'generic';
}

export function GameProvider({
  children,
  initialState = initialGameState,
}: {
  children: ReactNode;
  initialState?: GameState;
}) {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const [error, setError] = useState<GameErrorKind | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const [songLanguages, setSongLangState] = useState<SongLanguageSetting>(loadSongLanguages);
  const [difficulty, setDifficultyState] = useState<DifficultySetting>(loadDifficulty);
  const [loadingSong, setLoadingSong] = useState(false);

  const stateRef = useRef(state);
  stateRef.current = state;
  const langsRef = useRef(songLanguages);
  langsRef.current = songLanguages;
  const difficultyRef = useRef(difficulty);
  difficultyRef.current = difficulty;

  // Persist an in-progress game; forget it once finished.
  useEffect(() => {
    if (state.phase === 'setup') return;
    if (state.phase === 'winner') clearSavedGame();
    else saveGame(state);
  }, [state]);

  // Clear errors whenever a new game starts / is reset.
  useEffect(() => {
    if (state.phase === 'setup' || state.phase === 'winner') setError(null);
  }, [state.phase]);

  // Deal one starting card per player.
  const dealing = state.phase === 'dealing';
  useEffect(() => {
    if (!dealing || error) return;
    let cancelled = false;
    (async () => {
      const s = stateRef.current;
      const excludeIds = [...s.usedIds];
      // One entry per dealt song (duplicates are meaningful: the server counts them per artist).
      const excludeArtists = [...s.usedArtists];
      try {
        for (let i = s.dealtCount; i < s.players.length; i++) {
          const song = await fetchNextSong({
            excludeIds,
            excludeArtists,
            languages: toLanguages(langsRef.current),
            maxDifficulty: toMaxDifficulty(difficultyRef.current),
          });
          if (cancelled) return;
          excludeIds.push(song.id);
          excludeArtists.push(song.artist);
          dispatch({ type: 'DEAL_CARD', song });
        }
      } catch (err) {
        if (!cancelled) setError(errorKind(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dealing, error, retryToken]);

  // Fetch the next playable song for the current turn.
  const needsSong = state.phase === 'turn' && state.currentSong === null;
  useEffect(() => {
    if (!needsSong || error) return;
    let cancelled = false;
    setLoadingSong(true);
    (async () => {
      const s = stateRef.current;
      const excludeIds = [...s.usedIds];
      // One entry per drawn song, including ones skipped for a missing preview; the server counts them.
      const excludeArtists = [...s.usedArtists];
      try {
        for (let attempt = 0; attempt < MAX_SONG_ATTEMPTS; attempt++) {
          const song = await fetchNextSong({
            excludeIds,
            excludeArtists,
            languages: toLanguages(langsRef.current),
            maxDifficulty: toMaxDifficulty(difficultyRef.current),
          });
          if (cancelled) return;
          excludeIds.push(song.id);
          excludeArtists.push(song.artist);
          dispatch({ type: 'MARK_USED', song });
          const previewUrl = await fetchPreviewUrl(song.id);
          if (cancelled) return;
          if (previewUrl) {
            dispatch({ type: 'SONG_READY', song, previewUrl });
            return;
          }
        }
        setError('generic');
      } catch (err) {
        if (!cancelled) setError(errorKind(err));
      } finally {
        if (!cancelled) setLoadingSong(false);
      }
    })();
    return () => {
      cancelled = true;
      setLoadingSong(false);
    };
  }, [needsSong, error, retryToken, state.currentPlayerIndex]);

  const retry = useCallback(() => {
    setError(null);
    setRetryToken((n) => n + 1);
  }, []);

  const dismissError = useCallback(() => setError(null), []);

  const setSongLanguages = useCallback((value: SongLanguageSetting) => {
    setSongLangState(value);
    saveSongLanguages(value);
  }, []);

  const setDifficulty = useCallback((value: DifficultySetting) => {
    setDifficultyState(value);
    saveDifficulty(value);
  }, []);

  const value = useMemo<GameContextValue>(
    () => ({
      state,
      dispatch,
      error,
      loadingSong,
      retry,
      dismissError,
      songLanguages,
      setSongLanguages,
      difficulty,
      setDifficulty,
    }),
    [state, error, loadingSong, retry, dismissError, songLanguages, setSongLanguages, difficulty, setDifficulty],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used inside <GameProvider>');
  return ctx;
}
