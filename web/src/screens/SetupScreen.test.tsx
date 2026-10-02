import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n/I18nProvider';
import { SetupScreen } from './SetupScreen';

function setup(props: Partial<Parameters<typeof SetupScreen>[0]> = {}) {
  const onStart = vi.fn();
  render(
    <I18nProvider initialLang="en">
      <SetupScreen onStart={onStart} onBack={() => {}} {...props} />
    </I18nProvider>,
  );
  return { onStart, user: userEvent.setup() };
}

describe('SetupScreen', () => {
  it('start is disabled until a player is added', async () => {
    const { user, onStart } = setup();
    expect(screen.getByTestId('btn-start-game')).toBeDisabled();
    await user.type(screen.getByTestId('input-player-name'), 'Dana');
    await user.click(screen.getByTestId('btn-add-player'));
    expect(screen.getAllByTestId('player-item')).toHaveLength(1);
    expect(screen.getByTestId('player-item')).toHaveTextContent('Dana');
    expect(screen.getByTestId('input-player-name')).toHaveValue('');
    expect(screen.getByTestId('btn-start-game')).toBeEnabled();
    await user.click(screen.getByTestId('btn-start-game'));
    expect(onStart).toHaveBeenCalledWith(['Dana'], 10);
  });

  it('adds players with Enter and trims names', async () => {
    const { user } = setup();
    await user.type(screen.getByTestId('input-player-name'), '  Noa  {Enter}');
    expect(screen.getByTestId('player-item')).toHaveTextContent('Noa');
  });

  it('rejects empty and duplicate names', async () => {
    const { user } = setup();
    await user.click(screen.getByTestId('btn-add-player'));
    expect(screen.getByRole('alert')).toHaveTextContent('Please enter a name.');
    await user.type(screen.getByTestId('input-player-name'), 'Dana{Enter}');
    await user.type(screen.getByTestId('input-player-name'), 'dana{Enter}');
    expect(screen.getByRole('alert')).toHaveTextContent('already taken');
    expect(screen.getAllByTestId('player-item')).toHaveLength(1);
  });

  it('removes players', async () => {
    const { user } = setup({ initialNames: ['A', 'B'] });
    const removeButtons = screen.getAllByTestId('btn-remove-player');
    await user.click(removeButtons[0]!);
    expect(screen.getAllByTestId('player-item').map((p) => p.textContent)).toEqual(['B']);
  });

  it('allows at most 10 players', async () => {
    const names = Array.from({ length: 10 }, (_, i) => `P${i}`);
    setup({ initialNames: names });
    expect(screen.getByTestId('btn-add-player')).toBeDisabled();
    expect(screen.getByTestId('input-player-name')).toBeDisabled();
  });

  it('validates the target score (3–20)', async () => {
    const { user, onStart } = setup({ initialNames: ['A'] });
    const input = screen.getByTestId('input-target-score');
    expect(input).toHaveValue(10);
    await user.clear(input);
    await user.type(input, '2');
    expect(screen.getByTestId('btn-start-game')).toBeDisabled();
    await user.clear(input);
    await user.type(input, '21');
    expect(screen.getByTestId('btn-start-game')).toBeDisabled();
    await user.clear(input);
    await user.type(input, '5');
    expect(screen.getByTestId('btn-start-game')).toBeEnabled();
    await user.click(screen.getByTestId('btn-start-game'));
    expect(onStart).toHaveBeenCalledWith(['A'], 5);
  });
});
