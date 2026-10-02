import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import type { GameState } from '../game/types';
import { I18nProvider } from '../i18n/I18nProvider';
import type { Lang } from '../i18n/dictionaries';
import { GameProvider } from '../store/GameProvider';

export function renderWithProviders(
  ui: ReactElement,
  { lang = 'en', state }: { lang?: Lang; state?: GameState } = {},
) {
  return render(
    <I18nProvider initialLang={lang}>
      <GameProvider initialState={state}>{ui}</GameProvider>
    </I18nProvider>,
  );
}
