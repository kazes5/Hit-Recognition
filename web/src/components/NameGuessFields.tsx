import { useEffect, useRef, type ReactNode } from 'react';
import { useI18n } from '../i18n/I18nProvider';

/** The server rejects longer fields (docs/TOKENS_AND_BETS.md §4.1). */
export const GUESS_MAX_LENGTH = 200;

interface NameGuessFieldsProps {
  /** Prefix for the input ids, so labels stay unique. */
  idPrefix: string;
  legend: string;
  artist: string;
  title: string;
  onArtistChange: (value: string) => void;
  onTitleChange: (value: string) => void;
  disabled?: boolean;
  /** Focus the first field when the fields appear. */
  autoFocus?: boolean;
  /** A bettor only sees the parts the current player did not get right. */
  showArtist?: boolean;
  showTitle?: boolean;
  children?: ReactNode;
}

/**
 * Artist + title fields for naming the song. No suggestions (they would give
 * the answer away), no autocorrect, 16px so iOS does not zoom, `dir="auto"`
 * so Hebrew and English both type correctly.
 */
export function NameGuessFields({
  idPrefix,
  legend,
  artist,
  title,
  onArtistChange,
  onTitleChange,
  disabled = false,
  autoFocus = false,
  showArtist = true,
  showTitle = true,
  children,
}: NameGuessFieldsProps) {
  const { t } = useI18n();
  const artistRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) (showArtist ? artistRef : titleRef).current?.focus();
  }, [autoFocus, showArtist]);

  const common = {
    type: 'text',
    className: 'input',
    dir: 'auto',
    autoComplete: 'off',
    autoCorrect: 'off',
    autoCapitalize: 'off',
    spellCheck: false,
    maxLength: GUESS_MAX_LENGTH,
    disabled,
  } as const;

  return (
    <fieldset className="guess-fields">
      <legend>{legend}</legend>
      {showArtist && (
        <div className="field">
          <label htmlFor={`${idPrefix}-artist`}>{t('guessArtist')}</label>
          <input
            {...common}
            ref={artistRef}
            id={`${idPrefix}-artist`}
            name={`${idPrefix}-artist`}
            data-testid="input-guess-artist"
            placeholder={t('guessArtistPlaceholder')}
            value={artist}
            onChange={(e) => onArtistChange(e.target.value)}
          />
        </div>
      )}
      {showTitle && (
        <div className="field">
          <label htmlFor={`${idPrefix}-title`}>{t('guessTitle')}</label>
          <input
            {...common}
            ref={titleRef}
            id={`${idPrefix}-title`}
            name={`${idPrefix}-title`}
            data-testid="input-guess-title"
            placeholder={t('guessTitlePlaceholder')}
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
          />
        </div>
      )}
      {children}
    </fieldset>
  );
}
