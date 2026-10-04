import { useEffect, useRef, useState, type ReactNode } from 'react';
import { checkGuess } from '../api/client';
import { betBlock, eligibleBettors, freeBetSlots, type BetBlock } from '../game/tokens';
import type { GameState } from '../game/types';
import { ordinal, type MessageKey } from '../i18n/dictionaries';
import { useI18n } from '../i18n/I18nProvider';
import { useGame } from '../store/GameProvider';
import { ErrorBanner } from './ErrorBanner';
import { ChevronIcon, CrossIcon } from './icons';
import { playerInitials } from './initials';
import { NameGuessFields } from './NameGuessFields';
import { PlayButton, type AudioControls } from './PlayButton';
import { HiddenCard } from './SongCard';
import { Timeline, type SlotMarker } from './Timeline';
import { TokenIcon, TokenMeter } from './TokenMeter';

const BLOCK_REASONS: Record<BetBlock, MessageKey> = {
  current: 'reasonTried',
  noTokens: 'reasonNoTokens',
  tried: 'reasonTried',
  noFreeSlots: 'reasonNoSpots',
};

interface StepProps {
  audio: AudioControls;
  /** The screen's error banner (song loading), shown at the top of the body. */
  errorBanner: ReactNode;
}

/** Taken spots of the current player's timeline: their pick, then the bets in the order they were placed. */
export function betMarkers(state: GameState, initials: readonly string[]): SlotMarker[] {
  const markers: SlotMarker[] = [];
  const current = state.players[state.currentPlayerIndex];
  if (current && state.selectedSlot !== null) {
    markers.push({
      slotIndex: state.selectedSlot,
      kind: 'pick',
      initials: initials[state.currentPlayerIndex] ?? '?',
      name: current.name,
    });
  }
  for (const bet of state.bets) {
    const bettor = state.players[bet.playerIndex];
    if (bettor) {
      markers.push({ slotIndex: bet.slotIndex, kind: 'bet', initials: initials[bet.playerIndex] ?? '?', name: bettor.name });
    }
  }
  return markers;
}

/** What the screen's live region says during the betting round (empty outside it). */
export function useBetAnnouncement(): string {
  const { t } = useI18n();
  const { state } = useGame();
  if (state.phase !== 'betting') return '';
  const active = state.activeBettor;
  if (!active) {
    const current = state.players[state.currentPlayerIndex]?.name ?? '';
    return eligibleBettors(state).length > 0
      ? `${t('bettingOpen')} ${t('betHint', { player: current })}`
      : `${t('betsAllIn')} ${t('betsAllInHint', { player: current })}`;
  }
  const name = state.players[active.playerIndex]?.name ?? '';
  if (active.allowed === null) return t('bettorNameIt', { name });
  return active.allowed ? `${t('canBet')} ${t('pickFreeSpot', { name })}` : t('cannotBet');
}

/** Moves focus to the step's heading when the step appears (the button that was tapped is gone). */
function useFocusOnMount<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return ref;
}

function useMountedRef() {
  const ref = useRef(true);
  useEffect(() => {
    ref.current = true;
    return () => {
      ref.current = false;
    };
  }, []);
  return ref;
}

/** The current player's timeline with the taken spots, and a legend with the full names. */
function BetTimeline({
  markers,
  selectable = false,
  selectedSlot = null,
  onSelect,
  bettorName,
}: {
  markers: readonly SlotMarker[];
  selectable?: boolean;
  selectedSlot?: number | null;
  onSelect?: (index: number) => void;
  bettorName?: string;
}) {
  const { t, tNode, lang } = useI18n();
  const { state } = useGame();
  const current = state.players[state.currentPlayerIndex]!;
  const free =
    state.selectedSlot === null ? [] : freeBetSlots(current.timeline.length, state.selectedSlot, state.bets);
  const betMarkersOnly = markers.filter((m) => m.kind === 'bet');
  const label = t('timelineOf', { name: current.name });

  return (
    <section className="turn-timeline" aria-label={label}>
      <p className="text-muted turn-timeline__hint">{tNode('timelineOf', { name: current.name })}</p>
      <Timeline
        cards={current.timeline}
        selectable={selectable}
        selectedSlot={selectedSlot}
        onSelectSlot={onSelect}
        markers={markers}
        owner={state.currentPlayerIndex}
        label={label}
      />
      <ul className="bet-legend" data-testid="bet-legend">
        {markers.map((m) => (
          <li key={`${m.kind}-${m.slotIndex}`} data-marker={m.kind}>
            <span className={`marker marker--${m.kind}`} aria-hidden="true">
              {m.initials}
            </span>
            <span>
              <b>
                <bdi>{m.name}</bdi>
              </b>{' '}
              ·{' '}
              {m.kind === 'pick'
                ? t('legendPick')
                : t('betOrder', { nth: ordinal(lang, betMarkersOnly.indexOf(m) + 1) })}
            </span>
          </li>
        ))}
        {bettorName && selectedSlot !== null && (
          <li data-marker="mine">
            <span className="marker marker--mine" aria-hidden="true">
              ✓
            </span>
            <span>
              <b>
                <bdi>{bettorName}</bdi>
              </b>{' '}
              · {t('legendYourBet')}
            </span>
          </li>
        )}
        {free.some((i) => i !== selectedSlot) && (
          <li data-marker="free">
            <span className="marker marker--free" aria-hidden="true">
              +
            </span>
            <span>{t('legendFree')}</span>
          </li>
        )}
      </ul>
    </section>
  );
}

/** No active bettor: "Bets are open!" and the "Who's betting?" list. */
function WhoIsBetting({ audio, errorBanner }: StepProps) {
  const { t, tNode, lang } = useI18n();
  const { state, dispatch } = useGame();
  const current = state.players[state.currentPlayerIndex]!;
  const initials = playerInitials(state.players.map((p) => p.name));
  const eligible = eligibleBettors(state);
  const open = eligible.length > 0;
  const count = state.players.length;
  // Seat order, starting with the player after the current one.
  const others = Array.from({ length: count - 1 }, (_, k) => (state.currentPlayerIndex + 1 + k) % count);
  const noFreeSlots =
    state.selectedSlot !== null && freeBetSlots(current.timeline.length, state.selectedSlot, state.bets).length === 0;
  const headingRef = useFocusOnMount<HTMLSpanElement>();

  return (
    <>
      <div className="screen__body bet-stage" data-testid="bet-panel">
        {errorBanner}
        <section className="bet-box">
          <div className="bet-box__top">
            <span className="bet-box__kicker" ref={headingRef} tabIndex={-1}>
              {open ? t('bettingOpen') : t('betsAllIn')}
            </span>
            <div className="bet-box__mini">
              <HiddenCard playing={audio.playing} />
              <PlayButton audio={audio} small />
            </div>
          </div>
          {open ? (
            <>
              <p className="bet-box__lead">{tNode('betHint', { player: current.name })}</p>
              <p className="bet-box__sub">{t('betNeedsName')}</p>
            </>
          ) : (
            <p className="bet-box__lead">
              {noFreeSlots && <>{t('noFreeSlots')}. </>}
              {tNode('betsAllInHint', { player: current.name })}
            </p>
          )}
        </section>

        <BetTimeline markers={betMarkers(state, initials)} />

        <h2 className="bet-list-title" id="bettor-list-title">
          {t('whoIsBetting')}
        </h2>
        <ul className="bettor-list" aria-labelledby="bettor-list-title">
          {others.map((i) => {
            const p = state.players[i]!;
            const betIndex = state.bets.findIndex((b) => b.playerIndex === i);
            const can = eligible.includes(i);
            return (
              <li key={i}>
                <button
                  type="button"
                  className="bettor-btn"
                  data-testid="btn-bettor"
                  data-player={i}
                  aria-disabled={can ? undefined : 'true'}
                  onClick={() => {
                    if (can) dispatch({ type: 'BETTOR_START', playerIndex: i });
                  }}
                >
                  <span className={`avatar${betIndex >= 0 ? ' avatar--bet' : ''}`} aria-hidden="true">
                    {initials[i]}
                  </span>
                  <bdi className="bettor-btn__name">{p.name}</bdi>
                  {can ? (
                    <>
                      <TokenMeter tokens={p.tokens} />
                      <span className="bettor-btn__go" aria-hidden="true">
                        {t('betGo')}
                        <span className="flip-rtl">
                          <ChevronIcon />
                        </span>
                      </span>
                    </>
                  ) : betIndex >= 0 ? (
                    <span className="bettor-btn__reason bettor-btn__reason--bet" data-reason="bet">
                      {t('betOrder', { nth: ordinal(lang, betIndex + 1) })}
                    </span>
                  ) : (
                    <span className="bettor-btn__reason" data-reason={betBlock(state, i) ?? 'tried'}>
                      {t(BLOCK_REASONS[betBlock(state, i) ?? 'tried'])}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <footer className="screen__footer">
        <button
          type="button"
          className="btn btn--primary btn--block"
          data-testid="btn-reveal"
          onClick={() => dispatch({ type: 'REVEAL' })}
        >
          {t('reveal')}
        </button>
      </footer>
    </>
  );
}

/** The bettor names the artist or the title; the app only answers "You can bet!" or "Not this time". */
function BettorNameStep({ audio, errorBanner, playerIndex }: StepProps & { playerIndex: number }) {
  const { t, tNode } = useI18n();
  const { state, dispatch } = useGame();
  const bettor = state.players[playerIndex]!;
  const initials = playerInitials(state.players.map((p) => p.name));
  const [artist, setArtist] = useState('');
  const [title, setTitle] = useState('');
  const [checking, setChecking] = useState(false);
  const [failed, setFailed] = useState(false);
  const mounted = useMountedRef();
  const songId = state.currentSong?.id;
  const typed = artist.trim() !== '' || title.trim() !== '';
  const headingRef = useFocusOnMount<HTMLHeadingElement>();

  const check = async () => {
    if (songId === undefined || !typed || checking) return;
    setChecking(true);
    setFailed(false);
    try {
      const judged = await checkGuess(songId, { artist: artist.trim(), title: title.trim() });
      if (!mounted.current) return;
      // Cleared so the next player cannot read them.
      setArtist('');
      setTitle('');
      dispatch({ type: 'BETTOR_JUDGED', artistCorrect: judged.artistCorrect, titleCorrect: judged.titleCorrect });
    } catch {
      if (mounted.current) setFailed(true);
    } finally {
      if (mounted.current) setChecking(false);
    }
  };

  return (
    <>
      <div className="screen__body bet-stage" data-testid="bet-panel">
        {errorBanner}
        {failed && (
          <ErrorBanner
            message={t('guessFailed')}
            actions={
              <button type="button" className="btn btn--outline" data-testid="btn-guess-retry" onClick={() => void check()}>
                {t('tryAgain')}
              </button>
            }
          />
        )}
        <section className="bet-box">
          <div className="bet-box__who">
            <span className="avatar avatar--lg" aria-hidden="true">
              {initials[playerIndex]}
            </span>
            <h2 ref={headingRef} tabIndex={-1}>
              {tNode('bettorNameIt', { name: bettor.name })}
            </h2>
          </div>
          <p className="bet-box__sub">
            <TokenMeter tokens={bettor.tokens} />
            {t('bettorOneTry')}
          </p>
        </section>
        <div className="turn-stage turn-stage--compact">
          <HiddenCard playing={audio.playing} />
          <PlayButton audio={audio} />
        </div>
        <NameGuessFields
          idPrefix="bettor-guess"
          legend={t('bettorNameLegend')}
          artist={artist}
          title={title}
          onArtistChange={setArtist}
          onTitleChange={setTitle}
          disabled={checking}
        />
      </div>
      <footer className="screen__footer screen__footer--row">
        <button
          type="button"
          className="btn btn--outline"
          data-testid="btn-cancel-bet"
          onClick={() => dispatch({ type: 'BETTOR_DONE' })}
        >
          {t('cancel')}
        </button>
        <button
          type="button"
          className="btn btn--primary"
          data-testid="btn-check-guess"
          disabled={!typed || checking}
          onClick={() => void check()}
        >
          {checking ? t('checking') : t('checkGuess')}
        </button>
      </footer>
    </>
  );
}

/** "Not this time. Pass the phone on." The app never says which part was wrong. */
function BetDenied({ audio, errorBanner, playerIndex }: StepProps & { playerIndex: number }) {
  const { t } = useI18n();
  const { state, dispatch } = useGame();
  const bettor = state.players[playerIndex]!;
  const headingRef = useFocusOnMount<HTMLHeadingElement>();
  return (
    <>
      <div className="screen__body bet-stage" data-testid="bet-panel">
        {errorBanner}
        <div className="turn-stage turn-stage--compact">
          <HiddenCard playing={audio.playing} />
        </div>
        <section className="bet-box bet-box--denied" data-testid="bet-denied">
          <span className="bet-box__icon" aria-hidden="true">
            <CrossIcon />
          </span>
          <p className="bet-box__name">
            <bdi>{bettor.name}</bdi>
          </p>
          <h2 ref={headingRef} tabIndex={-1}>
            {t('cannotBet')}
          </h2>
          <p className="bet-box__keep">
            <TokenMeter tokens={bettor.tokens} />
            {t('noTokenLost')}
          </p>
          <p className="bet-box__sub">{t('cannotBetSub')}</p>
        </section>
      </div>
      <footer className="screen__footer">
        <button
          type="button"
          className="btn btn--primary btn--block"
          data-testid="btn-bet-ok"
          onClick={() => dispatch({ type: 'BETTOR_DONE' })}
        >
          {t('ok')}
        </button>
      </footer>
    </>
  );
}

/** "You can bet!": the bettor picks a free spot and pays 1 token. */
function BetAllowed({ audio, errorBanner, playerIndex }: StepProps & { playerIndex: number }) {
  const { t, tNode } = useI18n();
  const { state, dispatch } = useGame();
  const [slot, setSlot] = useState<number | null>(null);
  const current = state.players[state.currentPlayerIndex]!;
  const bettor = state.players[playerIndex]!;
  const initials = playerInitials(state.players.map((p) => p.name));
  const free =
    state.selectedSlot === null ? [] : freeBetSlots(current.timeline.length, state.selectedSlot, state.bets);
  const headingRef = useFocusOnMount<HTMLHeadingElement>();

  return (
    <>
      <div className="screen__body bet-stage" data-testid="bet-panel">
        {errorBanner}
        <section className="bet-box bet-box--ok" data-testid="bet-allowed">
          <span className="bet-box__kicker">
            <span aria-hidden="true">✓ </span>
            {t('canBet')}
          </span>
          <div className="bet-box__who">
            <h2 ref={headingRef} tabIndex={-1}>
              {tNode('pickFreeSpot', { name: bettor.name })}
            </h2>
            <TokenMeter tokens={bettor.tokens} />
          </div>
          <p className="bet-box__sub">{tNode('betCostHint', { player: current.name })}</p>
        </section>
        <div className="turn-stage turn-stage--compact">
          <HiddenCard playing={audio.playing} />
          <PlayButton audio={audio} />
        </div>
        <BetTimeline
          markers={betMarkers(state, initials)}
          selectable
          selectedSlot={slot}
          onSelect={(i) => {
            if (free.includes(i)) setSlot(i);
          }}
          bettorName={bettor.name}
        />
      </div>
      <footer className="screen__footer screen__footer--row">
        <button
          type="button"
          className="btn btn--outline"
          data-testid="btn-cancel-bet"
          onClick={() => dispatch({ type: 'BETTOR_DONE' })}
        >
          {t('cancel')}
        </button>
        <button
          type="button"
          className="btn btn--token"
          data-testid="btn-place-bet"
          disabled={slot === null}
          onClick={() => {
            if (slot !== null) dispatch({ type: 'PLACE_BET', slotIndex: slot });
          }}
        >
          <TokenIcon />
          {t('placeBet')}
        </button>
      </footer>
    </>
  );
}

/**
 * The betting round (phase `betting`): the screen body and footer. First come,
 * first served: whoever grabs the phone taps their name, names the song, and bets.
 */
export function BetPanel({ audio, errorBanner }: StepProps) {
  const { state } = useGame();
  const active = state.activeBettor;
  if (!active) return <WhoIsBetting audio={audio} errorBanner={errorBanner} />;
  const props = { audio, errorBanner, playerIndex: active.playerIndex };
  const key = active.playerIndex;
  if (active.allowed === null) return <BettorNameStep key={key} {...props} />;
  if (active.allowed === false) return <BetDenied key={key} {...props} />;
  return <BetAllowed key={key} {...props} />;
}
