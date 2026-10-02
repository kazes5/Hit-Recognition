import { Logo } from '../components/Logo';
import { Speaker } from '../components/Speaker';
import { useI18n } from '../i18n/I18nProvider';

interface HomeScreenProps {
  canResume: boolean;
  onNewGame: () => void;
  onResume: () => void;
  onSettings: () => void;
}

export function HomeScreen({ canResume, onNewGame, onResume, onSettings }: HomeScreenProps) {
  const { t } = useI18n();
  return (
    <main className="screen screen--home" data-testid="screen-home">
      <header className="screen__header">
        <Logo />
        <p className="neon-frame neon-subtitle center">{t('tagline')}</p>
      </header>
      <div className="screen__body center">
        <Speaker playing={false} />
      </div>
      <footer className="screen__footer stack">
        {canResume && (
          <button type="button" className="btn btn--primary btn--block" data-testid="btn-resume" onClick={onResume}>
            {t('resume')}
          </button>
        )}
        <button
          type="button"
          className={canResume ? 'btn btn--outline btn--block' : 'btn btn--primary btn--block'}
          data-testid="btn-new-game"
          onClick={onNewGame}
        >
          {t('newGame')}
        </button>
        <button type="button" className="btn btn--outline btn--block" data-testid="btn-settings" onClick={onSettings}>
          {t('settings')}
        </button>
      </footer>
    </main>
  );
}
