import { useState } from 'react';
import { loadSavedGame } from './game/persistence';
import { DEFAULT_TARGET, type GameState } from './game/types';
import { I18nProvider } from './i18n/I18nProvider';
import { GameScreen } from './screens/GameScreen';
import { HomeScreen } from './screens/HomeScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { SetupScreen } from './screens/SetupScreen';
import { WinnerScreen } from './screens/WinnerScreen';
import { GameProvider, useGame } from './store/GameProvider';

type View = 'home' | 'setup' | 'settings' | 'game';

function Screens() {
  const { state, dispatch, songLanguages, setSongLanguages } = useGame();
  const [view, setView] = useState<View>('home');
  const [saved, setSaved] = useState<GameState | null>(() => loadSavedGame());
  const [setupNames, setSetupNames] = useState<string[]>([]);
  const [setupTarget, setSetupTarget] = useState(DEFAULT_TARGET);

  const goHome = () => {
    setSaved(loadSavedGame());
    setView('home');
  };

  switch (view) {
    case 'home':
      return (
        <HomeScreen
          canResume={saved !== null}
          onNewGame={() => {
            setSetupNames([]);
            setSetupTarget(DEFAULT_TARGET);
            setView('setup');
          }}
          onResume={() => {
            if (!saved) return;
            dispatch({ type: 'RESTORE', state: saved });
            setView('game');
          }}
          onSettings={() => setView('settings')}
        />
      );
    case 'setup':
      return (
        <SetupScreen
          initialNames={setupNames}
          initialTarget={setupTarget}
          onBack={goHome}
          onStart={(names, targetScore) => {
            dispatch({ type: 'START_GAME', names, targetScore });
            setView('game');
          }}
        />
      );
    case 'settings':
      return (
        <SettingsScreen songLanguages={songLanguages} onSongLanguagesChange={setSongLanguages} onBack={goHome} />
      );
    case 'game':
      if (state.phase === 'winner') {
        return (
          <WinnerScreen
            players={state.players}
            targetScore={state.targetScore}
            onPlayAgain={() => {
              setSetupNames(state.players.map((p) => p.name));
              setSetupTarget(state.targetScore);
              dispatch({ type: 'RESET' });
              setView('setup');
            }}
            onHome={() => {
              dispatch({ type: 'RESET' });
              goHome();
            }}
          />
        );
      }
      if (state.phase === 'setup') {
        return null;
      }
      return <GameScreen />;
  }
}

export function App() {
  return (
    <I18nProvider>
      <GameProvider>
        <div className="app-shell">
          <Screens />
        </div>
      </GameProvider>
    </I18nProvider>
  );
}
