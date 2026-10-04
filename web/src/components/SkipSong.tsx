import { useEffect, useRef } from 'react';
import { SKIP_COST } from '../game/types';
import { useI18n } from '../i18n/I18nProvider';
import { TokenIcon, TokenMeter } from './TokenMeter';

/** "♪ Skip · 3", the small gold button next to Replay. */
export function SkipSongButton({ onClick }: { onClick: () => void }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      className="btn btn--sm btn--token-outline"
      data-testid="btn-skip-song"
      aria-label={t('skipSongAria', { cost: SKIP_COST })}
      onClick={onClick}
    >
      <TokenIcon />
      {t('skipYes')} · {SKIP_COST}
    </button>
  );
}

interface SkipConfirmSheetProps {
  tokens: number;
  onConfirm: () => void;
  onCancel: () => void;
}

/** "Skip this song for 3 tokens?" with Skip (gold) and Keep listening. */
export function SkipConfirmSheet({ tokens, onConfirm, onCancel }: SkipConfirmSheetProps) {
  const { t } = useI18n();
  const keepRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;

  useEffect(() => {
    keepRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="overlay" role="presentation" onClick={onCancel}>
      <div
        className="overlay__panel overlay__panel--token stack skip-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="skip-title"
        aria-describedby="skip-hint"
        data-testid="skip-confirm"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="skip-title">{t('skipConfirm')}</h2>
        <p id="skip-hint">{t('skipHint')}</p>
        <div className="token-change">
          <TokenMeter tokens={tokens} testId={null} />
          <span className="flip-rtl" aria-hidden="true">
            →
          </span>
          <TokenMeter tokens={tokens - SKIP_COST} testId={null} />
        </div>
        <button type="button" className="btn btn--token btn--block" data-testid="btn-confirm-skip" onClick={onConfirm}>
          <TokenIcon />
          {t('skipYes')} · {SKIP_COST}
        </button>
        <button
          ref={keepRef}
          type="button"
          className="btn btn--ghost btn--block"
          data-testid="btn-keep-listening"
          onClick={onCancel}
        >
          {t('keepListening')}
        </button>
      </div>
    </div>
  );
}
