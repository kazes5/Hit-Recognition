import type { SongLanguageSetting } from '../game/types';
import { useI18n } from '../i18n/I18nProvider';

interface SettingsScreenProps {
  songLanguages: SongLanguageSetting;
  onSongLanguagesChange: (value: SongLanguageSetting) => void;
  onBack: () => void;
}

export function SettingsScreen({ songLanguages, onSongLanguagesChange, onBack }: SettingsScreenProps) {
  const { t, lang, setLang } = useI18n();

  const chip = (active: boolean) => `chip${active ? ' chip--active' : ''}`;

  return (
    <main className="screen screen--settings" data-testid="screen-settings">
      <header className="screen__header">
        <button type="button" className="btn btn--ghost btn--icon" data-testid="btn-back" onClick={onBack} aria-label={t('back')}>
          <span className="flip-rtl" aria-hidden="true">
            ←
          </span>
        </button>
        <h1 className="neon-title">{t('settingsTitle')}</h1>
      </header>

      <div className="screen__body">
        <section className="field" aria-labelledby="settings-lang">
          <h2 id="settings-lang" className="field__label">{t('language')}</h2>
          <div className="chip-group" role="group" aria-labelledby="settings-lang">
            <button
              type="button"
              className={chip(lang === 'he')}
              data-testid="btn-lang-he"
              aria-pressed={lang === 'he'}
              lang="he"
              onClick={() => setLang('he')}
            >
              עברית
            </button>
            <button
              type="button"
              className={chip(lang === 'en')}
              data-testid="btn-lang-en"
              aria-pressed={lang === 'en'}
              lang="en"
              onClick={() => setLang('en')}
            >
              English
            </button>
          </div>
        </section>

        <section className="field" aria-labelledby="settings-songs">
          <h2 id="settings-songs" className="field__label">{t('songLanguages')}</h2>
          <div className="chip-group" role="group" aria-labelledby="settings-songs">
            {(
              [
                ['he', 'btn-songs-he', 'songsHe'],
                ['en', 'btn-songs-en', 'songsEn'],
                ['both', 'btn-songs-both', 'songsBoth'],
              ] as const
            ).map(([value, testId, key]) => (
              <button
                key={value}
                type="button"
                className={chip(songLanguages === value)}
                data-testid={testId}
                aria-pressed={songLanguages === value}
                onClick={() => onSongLanguagesChange(value)}
              >
                {t(key)}
              </button>
            ))}
          </div>
        </section>

        <section className="field" aria-labelledby="settings-source">
          <h2 id="settings-source" className="field__label">{t('musicSource')}</h2>
          <div className="chip-group" role="group" aria-labelledby="settings-source">
            <button type="button" className={chip(true)} aria-pressed="true">
              {t('sourcePreviews')}
            </button>
            <button type="button" className={chip(false)} disabled aria-pressed="false">
              {t('sourceSpotify')} · {t('comingSoon')}
            </button>
            <button type="button" className={chip(false)} disabled aria-pressed="false">
              {t('sourceApple')} · {t('comingSoon')}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
