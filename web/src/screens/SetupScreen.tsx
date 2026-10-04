import { useState, type FormEvent } from 'react';
import { canStartGame, isValidTarget, normalizeName, validateNewPlayerName, type NameError } from '../game/rules';
import { TokenIcon } from '../components/TokenMeter';
import { DEFAULT_TARGET, MAX_PLAYERS, MAX_TARGET, MAX_TOKENS, MIN_TARGET } from '../game/types';
import { useI18n } from '../i18n/I18nProvider';
import type { MessageKey } from '../i18n/dictionaries';
import { loadTokensAndBets, saveTokensAndBets } from '../store/settings';

interface SetupScreenProps {
  initialNames?: string[];
  initialTarget?: number;
  /** The "Tokens & bets" switch; defaults to what this phone last chose (on the first time). */
  initialTokensAndBets?: boolean;
  onStart: (names: string[], targetScore: number, tokensAndBets: boolean) => void;
  onBack: () => void;
}

const NAME_ERRORS: Record<NameError, MessageKey> = {
  empty: 'errorNameEmpty',
  duplicate: 'errorNameDuplicate',
  tooMany: 'errorNameTooMany',
};

export function SetupScreen({
  initialNames = [],
  initialTarget = DEFAULT_TARGET,
  initialTokensAndBets,
  onStart,
  onBack,
}: SetupScreenProps) {
  const { t } = useI18n();
  const [names, setNames] = useState<string[]>(initialNames);
  const [draft, setDraft] = useState('');
  const [nameError, setNameError] = useState<NameError | null>(null);
  const [targetText, setTargetText] = useState(String(initialTarget));
  const [tokensAndBets, setTokensAndBets] = useState(() => initialTokensAndBets ?? loadTokensAndBets());

  const toggleTokens = () => {
    const next = !tokensAndBets;
    setTokensAndBets(next);
    saveTokensAndBets(next);
  };

  const target = Number(targetText);
  const targetValid = targetText.trim() !== '' && isValidTarget(target);
  const full = names.length >= MAX_PLAYERS;
  const canStart = canStartGame(names, target);

  const addPlayer = (e?: FormEvent) => {
    e?.preventDefault();
    const err = validateNewPlayerName(draft, names);
    if (err) {
      setNameError(err);
      return;
    }
    setNames([...names, normalizeName(draft)]);
    setDraft('');
    setNameError(null);
  };

  const removePlayer = (index: number) => {
    setNames(names.filter((_, i) => i !== index));
    setNameError(null);
  };

  return (
    <main className="screen screen--setup" data-testid="screen-setup">
      <header className="screen__header">
        <button type="button" className="btn btn--ghost btn--icon" data-testid="btn-back" onClick={onBack} aria-label={t('back')}>
          <span className="flip-rtl" aria-hidden="true">
            ←
          </span>
        </button>
        <h1 className="neon-title">{t('setupTitle')}</h1>
      </header>

      <div className="screen__body">
        <form className="field" onSubmit={addPlayer} noValidate>
          <label htmlFor="player-name">{t('playerNameLabel')}</label>
          <div className="field__row">
            <input
              id="player-name"
              className="input"
              data-testid="input-player-name"
              value={draft}
              placeholder={t('playerNamePlaceholder')}
              maxLength={24}
              autoComplete="off"
              dir="auto"
              disabled={full}
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? 'player-name-error' : undefined}
              onChange={(e) => {
                setDraft(e.target.value);
                if (nameError) setNameError(null);
              }}
            />
            <button type="submit" className="btn btn--outline" data-testid="btn-add-player" disabled={full}>
              {t('addPlayer')}
            </button>
          </div>
          {nameError && (
            <p id="player-name-error" className="field__error" role="alert">
              {t(NAME_ERRORS[nameError], { max: MAX_PLAYERS })}
            </p>
          )}
        </form>

        <p className="field__hint">{t('playersCount', { count: names.length, max: MAX_PLAYERS })}</p>
        {names.length === 0 ? (
          <p className="field__hint">{t('noPlayers')}</p>
        ) : (
          <ul className="player-list">
            {names.map((name, i) => (
              <li key={name} className="player-item row" data-testid="player-item">
                <bdi className="player-item__name">{name}</bdi>
                <button
                  type="button"
                  className="btn btn--ghost btn--icon"
                  data-testid="btn-remove-player"
                  aria-label={t('removePlayer', { name })}
                  onClick={() => removePlayer(i)}
                >
                  {/* SVG icon (no text) so the item's text content is exactly the name */}
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
                    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="field">
          <label htmlFor="target-score">{t('targetScoreLabel')}</label>
          <input
            id="target-score"
            className="input"
            data-testid="input-target-score"
            type="number"
            inputMode="numeric"
            min={MIN_TARGET}
            max={MAX_TARGET}
            step={1}
            value={targetText}
            dir="ltr"
            aria-invalid={targetValid ? undefined : true}
            aria-describedby="target-score-hint"
            onChange={(e) => setTargetText(e.target.value)}
          />
          <p id="target-score-hint" className={targetValid ? 'field__hint' : 'field__error'}>
            {targetValid
              ? t('targetScoreHint', { min: MIN_TARGET, max: MAX_TARGET })
              : t('errorTargetRange', { min: MIN_TARGET, max: MAX_TARGET })}
          </p>
        </div>

        <section className={`rule-box${tokensAndBets ? '' : ' rule-box--off'}`}>
          <div className="rule-box__top">
            <span className="rule-box__title" id="tokens-bets-label">
              <TokenIcon />
              {t('tokensAndBets')}
            </span>
            <button
              type="button"
              role="switch"
              className="switch"
              data-testid="toggle-tokens-bets"
              aria-checked={tokensAndBets}
              aria-labelledby="tokens-bets-label"
              aria-describedby="tokens-bets-rule"
              onClick={toggleTokens}
            >
              <span className="switch__knob" aria-hidden="true" />
            </button>
          </div>
          <p id="tokens-bets-rule" className="rule-box__text">
            {t('tokenRule', { max: MAX_TOKENS })}
          </p>
        </section>
      </div>

      <footer className="screen__footer">
        <button
          type="button"
          className="btn btn--primary"
          data-testid="btn-start-game"
          disabled={!canStart}
          onClick={() => onStart(names, target, tokensAndBets)}
        >
          {t('startGame')}
        </button>
      </footer>
    </main>
  );
}
