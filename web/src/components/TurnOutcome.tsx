import type { ReactNode } from 'react';
import { namedAny, namesCorrect } from '../game/tokens';
import { MAX_TOKENS, type BetOutcome, type Player, type TurnResult } from '../game/types';
import { nameList } from '../i18n/formatNode';
import { useI18n } from '../i18n/I18nProvider';
import { ShieldIcon } from './icons';
import { playerInitials } from './initials';
import { TokenIcon } from './TokenMeter';

/** Who gets the card in a settled turn: a bettor, the current player, or nobody. */
export function cardWinnerOf(result: TurnResult, currentPlayerIndex: number): number | null {
  if (result.cardWinnerIndex !== undefined) return result.cardWinnerIndex;
  return result.correct ? currentPlayerIndex : null;
}

/** "We accept it" is offered when the turn had bets and the current player's typed names were not both right. */
export function canAcceptGuess(result: TurnResult): boolean {
  return !!result.bets?.length && !result.accepted && !!result.guess && !namesCorrect(result.guess);
}

interface TurnOutcomeProps {
  result: TurnResult;
  players: readonly Player[];
  currentPlayerIndex: number;
  onAccept: () => void;
}

interface Row {
  players: number[];
  kind: 'won' | 'named' | BetOutcome;
  text: ReactNode;
}

/**
 * The tokens-and-bets part of the result screen (docs/TOKENS_AND_BETS.md §6.4):
 * "Named it!", "Bob wins the card!", the current player's names with ✓/✗,
 * up to 3 short rows of who won and lost what, and "We accept it".
 */
export function TurnOutcome({ result, players, currentPlayerIndex, onAccept }: TurnOutcomeProps) {
  const { t, tNode } = useI18n();
  const initials = playerInitials(players.map((p) => p.name));
  const current = players[currentPlayerIndex];
  const bets = result.bets ?? [];
  const winner = cardWinnerOf(result, currentPlayerIndex);
  const stolen = winner !== null && winner !== currentPlayerIndex;
  const guess = result.guess ?? null;
  const named = namesCorrect(guess);
  const before = result.playersBefore ?? players;

  const names = (indices: number[]) => nameList(indices.map((i) => players[i]?.name ?? ''));
  const group = (outcome: BetOutcome) => bets.filter((b) => b.outcome === outcome).map((b) => b.playerIndex);

  // Tokens come only from naming: the current player's artist or title (or names accepted by the table).
  const namedToken = !!guess && (!!result.accepted || namedAny(guess));
  const currentFull = (before[currentPlayerIndex]?.tokens ?? 0) >= MAX_TOKENS;

  const rows: Row[] = [];
  if (winner !== null) {
    const withToken = winner === currentPlayerIndex && namedToken;
    rows.push({
      players: [winner],
      kind: 'won',
      text: tNode(withToken ? (currentFull ? 'outcomeCardOnly' : 'outcomeCardToken') : 'outcomeCard'),
    });
  }
  if (namedToken && winner !== currentPlayerIndex) {
    rows.push({
      players: [currentPlayerIndex],
      kind: 'named',
      text: tNode(currentFull ? 'outcomeNamedFull' : 'outcomeNamedToken'),
    });
  }
  const right = group('right');
  if (right.length > 0) {
    rows.push({
      players: right,
      kind: 'right',
      text: tNode('outcomeKeptToken', { name: players[winner ?? currentPlayerIndex]?.name ?? '' }),
    });
  }
  const lost = group('lost');
  if (lost.length > 0) rows.push({ players: lost, kind: 'lost', text: tNode('outcomeLostToken', { names: names(lost) }) });
  const refunded = group('refunded');
  if (refunded.length > 0) rows.push({ players: refunded, kind: 'refunded', text: t('outcomeRefunded') });

  const mark = (ok: boolean, testId: string, text: string) => (
    <span className="guess-result__part" data-testid={testId} data-correct={ok}>
      <bdi>{text.trim() || '—'}</bdi>
      <span className={ok ? 'guess-result__yes' : 'guess-result__no'} role="img" aria-label={t(ok ? 'guessRight' : 'guessWrong')}>
        {ok ? '✓' : '✗'}
      </span>
    </span>
  );

  return (
    <div className="turn-outcome" data-testid="turn-outcome">
      {named && (
        <p className="result-badge result-badge--named" data-testid="result-named">
          <ShieldIcon />
          {t('namedBlocked')}
        </p>
      )}
      {guess && (
        <p className="guess-result">
          {tNode('guessWas', {
            artist: mark(guess.artistCorrect, 'guess-artist-result', guess.artist),
            title: mark(guess.titleCorrect, 'guess-title-result', guess.title),
          })}
        </p>
      )}
      {stolen && (
        <p className="result-badge result-badge--stolen" data-testid="result-stolen">
          <TokenIcon />
          <span>{tNode('stolenBy', { name: players[winner]?.name ?? '' })}</span>
        </p>
      )}
      {winner === null && bets.length > 0 && <p className="turn-outcome__plain">{t('cardDiscarded')}</p>}
      {result.accepted && <p className="turn-outcome__plain">{t('acceptedNote')}</p>}

      {rows.length > 0 && (
        <ul className="outcome-list">
          {rows.slice(0, 4).map((row) => (
            <li
              key={row.kind}
              className={`outcome-row outcome-row--${row.kind}`}
              data-testid="outcome-row"
              data-player={row.players.join(',')}
              data-outcome={row.kind}
            >
              <span className="outcome-row__avatars" aria-hidden="true">
                {row.players.map((i) => (
                  <span
                    key={i}
                    className={`avatar${row.kind === 'won' || row.kind === 'named' ? (i === currentPlayerIndex ? ' avatar--pick' : ' avatar--bet') : ''}`}
                  >
                    {initials[i]}
                  </span>
                ))}
              </span>
              {row.kind === 'won' || row.kind === 'named' || row.kind === 'refunded' || row.kind === 'right' ? (
                <>
                  <span className="outcome-row__who">{names(row.players)}</span>
                  <span className="outcome-row__what">{row.text}</span>
                </>
              ) : (
                <span className="outcome-row__what">{row.text}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {canAcceptGuess(result) && current && (
        <section className="accept-box" aria-labelledby="accept-title">
          <h3 id="accept-title">{tNode('acceptQuestion', { name: current.name })}</h3>
          <p>{t('acceptHint')}</p>
          <button type="button" className="btn btn--outline btn--block" data-testid="btn-accept-guess" onClick={onAccept}>
            {t('acceptGuess')}
          </button>
        </section>
      )}
    </div>
  );
}
