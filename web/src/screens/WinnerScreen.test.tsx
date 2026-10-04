import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Player } from '../game/types';
import { I18nProvider } from '../i18n/I18nProvider';
import { player } from '../test/fixtures';
import { WinnerScreen } from './WinnerScreen';

function renderWinner(players: Player[], tokensAndBets: boolean, targetScore = 10) {
  render(
    <I18nProvider initialLang="en">
      <WinnerScreen players={players} targetScore={targetScore} tokensAndBets={tokensAndBets} onPlayAgain={() => {}} onHome={() => {}} />
    </I18nProvider>,
  );
}

describe('WinnerScreen with tokens', () => {
  it('ended early, tied on cards: more tokens wins, and a line says so', () => {
    renderWinner([player('Ann', [1990, 2000], 1), player('Bob', [1980, 1995], 4), player('Carol', [1970], 5)], true);
    expect(screen.getByTestId('winner-name')).toHaveTextContent('Bob');
    expect(screen.getByTestId('won-on-tokens')).toHaveTextContent('Tied on cards; more tokens wins.');
    // Ranked by cards, then tokens; a meter beside each score
    const sections = screen.getAllByRole('region');
    expect(sections.map((s) => s.getAttribute('aria-label'))).toEqual(['Bob', 'Ann', 'Carol']);
    expect(within(sections[0]!).getByTestId('token-meter')).toHaveAccessibleName('4 of 5 tokens');
    expect(within(sections[2]!).getByTestId('token-meter')).toHaveTextContent('Max');
  });

  it('no tokens line when a player reached the target, or when tokens are tied too', () => {
    renderWinner([player('Ann', [1990, 2000, 2010], 1), player('Bob', [1980], 4)], true, 3);
    expect(screen.getByTestId('winner-name')).toHaveTextContent('Ann');
    expect(screen.queryByTestId('won-on-tokens')).toBeNull();
    document.body.innerHTML = '';
    renderWinner([player('Ann', [1990], 2), player('Bob', [1980], 2)], true);
    expect(screen.getByText("It's a tie!")).toBeInTheDocument();
    expect(screen.queryByTestId('won-on-tokens')).toBeNull();
  });

  it('with the switch off: no meters and no tokens line', () => {
    renderWinner([player('Ann', [1990], 1), player('Bob', [1980], 1)], false);
    expect(screen.queryByTestId('token-meter')).toBeNull();
    expect(screen.queryByTestId('won-on-tokens')).toBeNull();
  });
});
