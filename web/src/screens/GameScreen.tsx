import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { checkGuess } from '../api/client';
import { useAudioPlayer } from '../audio/useAudioPlayer';
import { BetPanel, useBetAnnouncement } from '../components/BetPanel';
import { CoverImage } from '../components/CoverImage';
import { ErrorBanner } from '../components/ErrorBanner';
import { NameGuessFields } from '../components/NameGuessFields';
import { PlayButton, type AudioControls } from '../components/PlayButton';
import { Scoreboard } from '../components/Scoreboard';
import { SkipConfirmSheet, SkipSongButton } from '../components/SkipSong';
import { LockIcon, PencilIcon } from '../components/icons';
import { HiddenCard, SongCard } from '../components/SongCard';
import { Speaker } from '../components/Speaker';
import { Timeline } from '../components/Timeline';
import { TokenChip } from '../components/TokenMeter';
import { cardWinnerOf, TurnOutcome } from '../components/TurnOutcome';
import { anyReachedTarget, score } from '../game/rules';
import { anyoneCouldBet, canSkip, eligibleBettors } from '../game/tokens';
import { nameList } from '../i18n/formatNode';
import { useI18n } from '../i18n/I18nProvider';
import type { MessageKey } from '../i18n/dictionaries';
import { useGame, type GameErrorKind } from '../store/GameProvider';

const ERROR_MESSAGES: Record<GameErrorKind, MessageKey> = {
  network: 'errorNetwork',
  noSongs: 'errorNoSongs',
  generic: 'errorGeneric',
};

export function GameScreen() {
  const { t, tNode } = useI18n();
  const { state, dispatch, error, retry } = useGame();
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [showSkip, setShowSkip] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  // The current player's optional names (only sent when Lock in is tapped with something typed).
  const [nameOpen, setNameOpen] = useState(false);
  const [guessArtist, setGuessArtist] = useState('');
  const [guessTitle, setGuessTitle] = useState('');
  const [locking, setLocking] = useState(false);
  const [lockFailed, setLockFailed] = useState(false);
  const mounted = useRef(true);
  const nameFieldsId = useId();
  const announcement = useBetAnnouncement();

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const onAudioError = useCallback(() => dispatch({ type: 'SONG_FAILED' }), [dispatch]);
  const audio = useAudioPlayer({ onError: onAudioError });
  const { stop } = audio;

  const songId = state.currentSong?.id;
  useEffect(() => {
    stop();
    setHasPlayed(false);
    setNameOpen(false);
    setGuessArtist('');
    setGuessTitle('');
    setLockFailed(false);
    setShowSkip(false);
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

  const tokensOn = state.tokensAndBets;
  const isResult = state.phase === 'result' && state.lastResult !== null;
  const isBetting = state.phase === 'betting';
  const result = state.lastResult;
  const isTurn = state.phase === 'turn';
  const hasSlot = state.selectedSlot !== null && !!state.currentSong;
  const canReveal = isTurn && hasSlot;
  // Lock in replaces Reveal whenever someone could bet on this card.
  const betsPossible = isTurn && tokensOn && anyoneCouldBet(state);
  const skipAllowed = isTurn && canSkip(state);
  const typed = guessArtist.trim() !== '' || guessTitle.trim() !== '';

  const audioControls: AudioControls = {
    playing: audio.isPlaying,
    canPlay: !isResult && !!state.currentPreviewUrl,
    hasPlayed,
    onPlay: () => {
      if (!state.currentPreviewUrl) return;
      audio.play(state.currentPreviewUrl);
      setHasPlayed(true);
    },
  };

  const onNext = () => {
    stop();
    dispatch({ type: 'NEXT' });
  };

  const lockIn = async (withNames: boolean) => {
    if (!canReveal || locking || !state.currentSong) return;
    setLockFailed(false);
    if (!withNames || !nameOpen || !typed) {
      dispatch({ type: 'LOCK_IN' });
      return;
    }
    const artist = guessArtist.trim();
    const title = guessTitle.trim();
    setLocking(true);
    try {
      const judged = await checkGuess(state.currentSong.id, { artist, title });
      if (!mounted.current) return;
      dispatch({ type: 'LOCK_IN', guess: { artist, title, ...judged } });
    } catch {
      if (mounted.current) setLockFailed(true);
    } finally {
      if (mounted.current) setLocking(false);
    }
  };

  const toggleNames = () => {
    if (nameOpen) {
      // Closing means "not naming": what is sent is what is on screen.
      setGuessArtist('');
      setGuessTitle('');
      setLockFailed(false);
    }
    setNameOpen(!nameOpen);
  };

  const confirmSkip = () => {
    stop();
    setShowSkip(false);
    dispatch({ type: 'SKIP_SONG' });
  };

  const lockErrorBanner = lockFailed && (
    <ErrorBanner
      message={t('guessFailed')}
      actions={
        <>
          <button type="button" className="btn btn--outline" data-testid="btn-guess-retry" onClick={() => void lockIn(true)}>
            {t('tryAgain')}
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            data-testid="btn-continue-without-naming"
            onClick={() => void lockIn(false)}
          >
            {t('continueWithoutNaming')}
          </button>
        </>
      }
    />
  );

  // Before Lock in: the players who could bet on this card (seat order, the current player excluded).
  const possibleBettors = betsPossible
    ? eligibleBettors({ ...state, guess: null, bets: [], triedThisTurn: [], selectedSlot: state.selectedSlot ?? 0 })
    : [];

  const winner = result ? cardWinnerOf(result, state.currentPlayerIndex) : null;
  const stolenBy = isResult && winner !== null && winner !== state.currentPlayerIndex ? winner : null;
  const shownOwner = stolenBy ?? state.currentPlayerIndex;
  const shownPlayer = state.players[shownOwner] ?? player;

  return (
    <main className={`screen screen--turn${isBetting ? ' screen--betting' : ''}`} data-testid="screen-turn">
      <header className="screen__header row">
        <div className="player-badge">
          <span className="visually-hidden">{t('currentPlayer')}: </span>
          <bdi data-testid="current-player-name">{player.name}</bdi>
          <span className="player-badge__score" aria-label={t('cardsCount', { count: score(player) })}>
            {score(player)}
          </span>
          {tokensOn && <TokenChip tokens={player.tokens} />}
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

      <p className="visually-hidden" aria-live="polite" data-testid="bet-announce">
        {announcement}
      </p>

      {isBetting ? (
        <BetPanel audio={audioControls} errorBanner={errorBanner} />
      ) : (
        <>
          <div className="screen__body">
            {errorBanner}
            {lockErrorBanner}

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
                <CoverImage songId={result.song.id} title={result.song.title} />
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
                  <PlayButton audio={audioControls} />
                  {skipAllowed && <SkipSongButton onClick={() => setShowSkip(true)} />}
                </div>
              </div>
            )}

            {isResult && result && tokensOn && (
              <TurnOutcome
                result={result}
                players={state.players}
                currentPlayerIndex={state.currentPlayerIndex}
                onAccept={() => dispatch({ type: 'ACCEPT_GUESS' })}
              />
            )}

            <section
              className="turn-timeline"
              aria-label={stolenBy !== null ? t('timelineOf', { name: shownPlayer.name }) : t('turnOf', { name: player.name })}
            >
              {!isResult && (
                <p className="text-muted turn-timeline__hint" aria-live="polite">
                  {!state.currentSong ? t('loadingSong') : audio.isPlaying ? t('playing') : t('chooseSlot')}
                </p>
              )}
              {isResult && stolenBy !== null && (
                <p className="turn-timeline__hint turn-timeline__hint--stolen">{tNode('landedIn', { name: shownPlayer.name })}</p>
              )}
              {isResult && tokensOn && stolenBy === null && (
                <p className="text-muted turn-timeline__hint">{tNode('timelineOf', { name: player.name })}</p>
              )}
              <Timeline
                cards={shownPlayer.timeline}
                selectable={!isResult}
                selectedSlot={state.selectedSlot}
                onSelectSlot={(index) => dispatch({ type: 'SELECT_SLOT', index })}
                highlightSongId={isResult && result && winner !== null ? result.song.id : undefined}
                highlightVariant={stolenBy !== null ? 'stolen' : 'new'}
                owner={shownOwner}
                label={stolenBy !== null ? t('timelineOf', { name: shownPlayer.name }) : t('turnOf', { name: player.name })}
              />
            </section>

            {betsPossible && (
              <div className="name-it">
                <button
                  type="button"
                  className={`name-it__toggle${nameOpen ? ' name-it__toggle--open' : ''}`}
                  data-testid="btn-name-it"
                  aria-expanded={nameOpen}
                  aria-controls={nameFieldsId}
                  onClick={toggleNames}
                >
                  <PencilIcon />
                  {t('nameItToggle')}
                </button>
                <div id={nameFieldsId} hidden={!nameOpen} className="name-it__body">
                  {nameOpen && (
                    <NameGuessFields
                      idPrefix="guess"
                      legend={t('nameItLegend')}
                      artist={guessArtist}
                      title={guessTitle}
                      onArtistChange={setGuessArtist}
                      onTitleChange={setGuessTitle}
                      disabled={locking}
                      autoFocus
                    >
                      <p className="guess-fields__note">
                        <LockIcon />
                        {t('nameItNote')}
                      </p>
                    </NameGuessFields>
                  )}
                </div>
                {!nameOpen && possibleBettors.length > 0 && (
                  <p className="name-it__who">
                    {tNode('whoCanBet', { names: nameList(possibleBettors.map((i) => state.players[i]!.name)) })}
                  </p>
                )}
              </div>
            )}
          </div>

          <footer className="screen__footer">
            {isResult ? (
              <button type="button" className="btn btn--primary btn--block" data-testid="btn-next" onClick={onNext}>
                {anyReachedTarget(state.players, state.targetScore) ? t('seeWinner') : t('nextPlayer')}
              </button>
            ) : betsPossible ? (
              <>
                {nameOpen && !hasSlot && (
                  <p className="screen__footer-hint" id="lock-in-hint">
                    {t('pickSlotFirst')}
                  </p>
                )}
                <button
                  type="button"
                  className="btn btn--primary btn--block"
                  data-testid="btn-lock-in"
                  disabled={!canReveal || locking}
                  aria-describedby={nameOpen && !hasSlot ? 'lock-in-hint' : undefined}
                  onClick={() => void lockIn(true)}
                >
                  {locking ? t('checking') : t('lockIn')}
                </button>
              </>
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
        </>
      )}

      {showSkip && skipAllowed && (
        <SkipConfirmSheet tokens={player.tokens} onConfirm={confirmSkip} onCancel={() => setShowSkip(false)} />
      )}

      {showScoreboard && (
        <Scoreboard
          players={state.players}
          currentPlayerIndex={state.currentPlayerIndex}
          targetScore={state.targetScore}
          tokensAndBets={tokensOn}
          onClose={() => setShowScoreboard(false)}
          onEndGame={endGame}
        />
      )}
    </main>
  );
}
