import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { useAudioPlayer } from '../audio/useAudioPlayer';
import { ErrorBanner } from '../components/ErrorBanner';
import { Scoreboard } from '../components/Scoreboard';
import { HiddenCard, SongCard } from '../components/SongCard';
import { Speaker } from '../components/Speaker';
import { Timeline } from '../components/Timeline';
import { hasReachedTarget, score } from '../game/rules';
import { useI18n } from '../i18n/I18nProvider';
import type { MessageKey } from '../i18n/dictionaries';
import { useGame, type GameErrorKind } from '../store/GameProvider';

const ERROR_MESSAGES: Record<GameErrorKind, MessageKey> = {
  network: 'errorNetwork',
  noSongs: 'errorNoSongs',
  generic: 'errorGeneric',
};

export function GameScreen() {
  const { t } = useI18n();
  const { state, dispatch, error, retry } = useGame();
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);

  const onAudioError = useCallback(() => dispatch({ type: 'SONG_FAILED' }), [dispatch]);
  const audio = useAudioPlayer({ onError: onAudioError });
  const { stop } = audio;

  const songId = state.currentSong?.id;
  useEffect(() => {
    stop();
    setHasPlayed(false);
  }, [songId, stop]);

  const player = state.players[state.currentPlayerIndex];
  const endGame = () => {
    stop();
    setShowScoreboard(false);
    dispatch({ type: 'END_GAME' });
  };

  const errorBanner = error && (
    <ErrorBanner
      message={t(ERROR_MESSAGES[error])}
      actions={
        <>
          {error !== 'noSongs' && (
            <button type="button" className="btn btn--outline" data-testid="btn-retry" onClick={retry}>
              {t('retry')}
            </button>
          )}
          {state.phase !== 'dealing' && (
            <button type="button" className="btn btn--ghost" data-testid="btn-error-end-game" onClick={endGame}>
              {t('endGame')}
            </button>
          )}
        </>
      }
    />
  );

  if (state.phase === 'dealing' || !player) {
    return (
      <main className="screen screen--dealing" data-testid="screen-dealing">
        <div className="screen__body center stack">
          {errorBanner}
          {!error && <p className="neon-subtitle" aria-live="polite">{t('dealing')}</p>}
        </div>
      </main>
    );
  }

  const isResult = state.phase === 'result' && state.lastResult !== null;
  const result = state.lastResult;
  const reachedTarget = hasReachedTarget(player, state.targetScore);
  const canPlay = !isResult && !!state.currentPreviewUrl;
  const canReveal = state.phase === 'turn' && state.selectedSlot !== null && !!state.currentSong;

  const onPlay = () => {
    if (!state.currentPreviewUrl) return;
    audio.play(state.currentPreviewUrl);
    setHasPlayed(true);
  };

  const onNext = () => {
    stop();
    dispatch({ type: 'NEXT' });
  };

  return (
    <main className="screen screen--turn" data-testid="screen-turn">
      <header className="screen__header row">
        <div className="player-badge">
          <span className="visually-hidden">{t('currentPlayer')}: </span>
          <bdi data-testid="current-player-name">{player.name}</bdi>
          <span className="player-badge__score" aria-label={t('cardsCount', { count: score(player) })}>
            {score(player)}
          </span>
        </div>
        <button
          type="button"
          className="btn btn--icon btn--outline"
          data-testid="btn-scoreboard"
          aria-label={t('scoreboard')}
          title={t('scoreboard')}
          onClick={() => setShowScoreboard(true)}
        >
          <span aria-hidden="true">☰</span>
        </button>
      </header>

      <div className="screen__body">
        {errorBanner}

        {isResult && result ? (
          <div className="turn-stage turn-stage--result">
            <div data-testid="revealed-card">
              <SongCard
                song={result.song}
                withTestIds
                style={{ '--card-size': '150px' } as CSSProperties}
                className={`song-card--reveal ${result.correct ? 'song-card--correct' : 'song-card--wrong'}`}
              />
            </div>
            {result.correct ? (
              <p className="result--correct" data-testid="result-correct" role="status">
                {t('correct')}
              </p>
            ) : (
              <p className="result--wrong" data-testid="result-wrong" role="status">
                {t('wrong', { year: result.song.year })}
              </p>
            )}
          </div>
        ) : (
          <div className="turn-stage">
            <HiddenCard playing={audio.isPlaying} style={{ '--card-size': '120px' } as CSSProperties} />
            <div className="turn-stage__controls">
              <Speaker playing={audio.isPlaying} small />
              <button
                type="button"
                className="btn btn--outline"
                data-testid="btn-play"
                disabled={!canPlay}
                onClick={onPlay}
              >
                <span aria-hidden="true">▶ </span>
                {hasPlayed ? t('replay') : t('play')}
              </button>
            </div>
          </div>
        )}

        <section className="turn-timeline" aria-label={t('turnOf', { name: player.name })}>
          {!isResult && (
            <p className="text-muted turn-timeline__hint" aria-live="polite">
              {!state.currentSong ? t('loadingSong') : audio.isPlaying ? t('playing') : t('chooseSlot')}
            </p>
          )}
          <Timeline
            cards={player.timeline}
            selectable={!isResult}
            selectedSlot={state.selectedSlot}
            onSelectSlot={(index) => dispatch({ type: 'SELECT_SLOT', index })}
            highlightSongId={isResult && result?.correct ? result.song.id : undefined}
            label={t('turnOf', { name: player.name })}
          />
        </section>
      </div>

      <footer className="screen__footer">
        {isResult ? (
          <button type="button" className="btn btn--primary btn--block" data-testid="btn-next" onClick={onNext}>
            {reachedTarget ? t('seeWinner') : t('nextPlayer')}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn--primary btn--block"
            data-testid="btn-reveal"
            disabled={!canReveal}
            onClick={() => dispatch({ type: 'REVEAL' })}
          >
            {t('reveal')}
          </button>
        )}
      </footer>

      {showScoreboard && (
        <Scoreboard
          players={state.players}
          currentPlayerIndex={state.currentPlayerIndex}
          targetScore={state.targetScore}
          onClose={() => setShowScoreboard(false)}
          onEndGame={endGame}
        />
      )}
    </main>
  );
}
