import { useEffect, useRef } from 'react';
import { leaders, score } from '../game/rules';
import { MAX_TOKENS, type Player } from '../game/types';
import { useI18n } from '../i18n/I18nProvider';
import { TokenIcon, TokenMeter } from './TokenMeter';

interface ScoreboardProps {
  players: readonly Player[];
  currentPlayerIndex: number;
  targetScore: number;
  /** Adds the Tokens column; off, the board looks exactly as before. */
  tokensAndBets?: boolean;
  onClose: () => void;
  onEndGame?: () => void;
}

export function Scoreboard({
  players,
  currentPlayerIndex,
  targetScore,
  tokensAndBets = false,
  onClose,
  onEndGame,
}: ScoreboardProps) {
  const { t } = useI18n();
  const closeRef = useRef<HTMLButtonElement>(null);
  const top = new Set(leaders(players).map((p) => p.name));
  const showLeader = players.some((p) => score(p) > 0) && top.size < players.length;

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="overlay" role="presentation" onClick={onClose}>
      <div
        className="overlay__panel stack"
        role="dialog"
        aria-modal="true"
        aria-labelledby="scoreboard-title"
        data-testid="scoreboard"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="scoreboard-title" className="neon-title">
          {t('scoreboardTitle')}
        </h2>
        <p className="text-muted">{t('target', { target: targetScore })}</p>
        <table className={`score-table${tokensAndBets ? ' score-table--tokens' : ''}`}>
          {tokensAndBets && (
            <thead>
              <tr>
                <th scope="col">{t('colPlayer')}</th>
                <th scope="col">{t('tokens')}</th>
                <th scope="col">{t('colCards')}</th>
              </tr>
            </thead>
          )}
          <tbody>
            {players.map((p, i) => (
              <tr
                key={p.name}
                className={[showLeader && top.has(p.name) ? 'is-leader' : '', i === currentPlayerIndex ? 'is-current' : '']
                  .filter(Boolean)
                  .join(' ') || undefined}
                data-testid="score-row"
                data-player={p.name}
                data-score={score(p)}
                data-tokens={tokensAndBets ? p.tokens : undefined}
                aria-current={i === currentPlayerIndex ? 'true' : undefined}
              >
                <td className="score-table__name">
                  <bdi>{p.name}</bdi>
                </td>
                {tokensAndBets && (
                  <td className="score-table__tokens">
                    <TokenMeter tokens={p.tokens} showCount />
                  </td>
                )}
                <td className="score-table__score">{score(p)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {tokensAndBets && (
          <p className="score-table__rule">
            <TokenIcon />
            {t('tokenRule', { max: MAX_TOKENS })}
          </p>
        )}
        <div className="stack">
          {onEndGame && (
            <button type="button" className="btn btn--outline btn--block" data-testid="btn-end-game" onClick={onEndGame}>
              {t('endGame')}
            </button>
          )}
          <button
            ref={closeRef}
            type="button"
            className="btn btn--ghost btn--block"
            data-testid="btn-close-scoreboard"
            onClick={onClose}
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
}
