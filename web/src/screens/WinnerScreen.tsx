import { Fragment } from 'react';
import { Timeline } from '../components/Timeline';
import { findWinners, score } from '../game/rules';
import type { Player } from '../game/types';
import { useI18n } from '../i18n/I18nProvider';

interface WinnerScreenProps {
  players: readonly Player[];
  targetScore: number;
  onPlayAgain: () => void;
  onHome: () => void;
}

export function WinnerScreen({ players, targetScore, onPlayAgain, onHome }: WinnerScreenProps) {
  const { t } = useI18n();
  const winners = findWinners(players, targetScore);
  const winnerNames = winners.map((w) => w.name).join(' & ');
  const ranked = [...players].sort((a, b) => score(b) - score(a));

  return (
    <main className="screen screen--winner" data-testid="screen-winner">
      <header className="screen__header stack center">
        <p className="neon-subtitle">{winners.length > 1 ? t('winnersTitle') : t('winnerTitle')}</p>
        <h1 className="neon-title">
          <span aria-hidden="true">★ </span>
          <span data-testid="winner-name">
            {winners.map((w, i) => (
              <Fragment key={w.name}>
                {i > 0 && ' & '}
                <bdi>{w.name}</bdi>
              </Fragment>
            ))}
          </span>
        </h1>
        <p className="visually-hidden">{t('wins', { name: winnerNames })}</p>
      </header>

      <div className="screen__body stack">
        <h2 className="field__label">{t('finalTimelines')}</h2>
        {ranked.map((p) => (
          <section key={p.name} className="stack final-timeline" aria-label={p.name}>
            <div className="player-badge">
              <bdi>{p.name}</bdi>
              <span className="player-badge__score">{score(p)}</span>
            </div>
            <Timeline cards={p.timeline} testId="final-timeline" cardTestId="final-timeline-card" label={p.name} />
          </section>
        ))}
      </div>

      <footer className="screen__footer stack">
        <button type="button" className="btn btn--primary btn--block" data-testid="btn-play-again" onClick={onPlayAgain}>
          {t('playAgain')}
        </button>
        <button type="button" className="btn btn--ghost btn--block" data-testid="btn-home" onClick={onHome}>
          {t('home')}
        </button>
      </footer>
    </main>
  );
}
