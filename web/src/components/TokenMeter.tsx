import { MAX_TOKENS } from '../game/types';
import { useI18n } from '../i18n/I18nProvider';

/** The gold token disc with a note (decorative). */
export function TokenIcon() {
  return (
    <span className="token-icon" aria-hidden="true">
      ♪
    </span>
  );
}

interface TokenMeterProps {
  tokens: number;
  /** Show the number after the pips (the scoreboard and Winner screen). "Max" is always shown at 5. */
  showCount?: boolean;
  /** `null`: no test id (e.g. the before/after meters in the skip sheet). */
  testId?: string | null;
}

/** 5 pips, filled for each token held. Screen readers hear "3 of 5 tokens". */
export function TokenMeter({ tokens, showCount = false, testId = 'token-meter' }: TokenMeterProps) {
  const { t } = useI18n();
  const held = Math.max(0, Math.min(MAX_TOKENS, tokens));
  const full = held >= MAX_TOKENS;
  return (
    <span
      className={`token-meter${full ? ' token-meter--full' : ''}`}
      role="img"
      aria-label={t('tokensCount', { count: held, max: MAX_TOKENS })}
      data-testid={testId ?? undefined}
      data-tokens={held}
    >
      {Array.from({ length: MAX_TOKENS }, (_, i) => (
        <span key={i} className={`token-meter__pip${i < held ? ' token-meter__pip--on' : ''}`} />
      ))}
      {full ? (
        <span className="token-meter__max">{t('tokensMax')}</span>
      ) : (
        showCount && <span className="token-meter__count">{held}</span>
      )}
    </span>
  );
}

/** "◉ 3" next to the card count in the turn header. */
export function TokenChip({ tokens }: { tokens: number }) {
  const { t } = useI18n();
  return (
    <span
      className="token-chip"
      role="img"
      data-testid="current-player-tokens"
      data-tokens={tokens}
      aria-label={t('tokensCount', { count: tokens, max: MAX_TOKENS })}
    >
      <TokenIcon />
      {tokens}
    </span>
  );
}
