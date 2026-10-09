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
  const { state, dispatch, songLanguages, setSongLanguages, difficulty, setDifficulty } = useGame();
  const [view, setView] = useState<View>('home');
  const [saved, setSaved] = useState<GameState | null>(() => loadSavedGame());
  const [setupNames, setSetupNames] = useState<string[]>([]);
  const [setupTarget, setSetupTarget] = useState(DEFAULT_TARGET);
  // "Play again" keeps the last game's switch; a new game uses what this phone remembers.
  const [setupTokens, setSetupTokens] = useState<boolean | undefined>(undefined);

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
            setSetupTokens(undefined);
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
          initialTokensAndBets={setupTokens}
          onBack={goHome}
          onStart={(names, targetScore, tokensAndBets) => {
            dispatch({ type: 'START_GAME', names, targetScore, tokensAndBets });
            setView('game');
          }}
        />
      );
    case 'settings':
      return (
        <SettingsScreen
          songLanguages={songLanguages}
          onSongLanguagesChange={setSongLanguages}
          difficulty={difficulty}
          onDifficultyChange={setDifficulty}
          onBack={goHome}
        />
      );
    case 'game':
      if (state.phase === 'winner') {
        return (
          <WinnerScreen
            players={state.players}
            targetScore={state.targetScore}
            tokensAndBets={state.tokensAndBets}
            onPlayAgain={() => {
              setSetupNames(state.players.map((p) => p.name));
              setSetupTarget(state.targetScore);
              setSetupTokens(state.tokensAndBets);
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
