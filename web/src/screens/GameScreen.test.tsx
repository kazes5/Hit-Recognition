import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setAudioFactory } from '../audio/useAudioPlayer';
import { initialGameState } from '../game/reducer';
import type { GameState, Song } from '../game/types';
import { FakeAudio } from '../test/fakeAudio';
import { song } from '../test/fixtures';
import { renderWithProviders } from '../test/render';
import { GameScreen } from './GameScreen';

let restoreAudio: () => void;
beforeEach(() => {
  FakeAudio.reset();
  restoreAudio = setAudioFactory(() => new FakeAudio());
});
afterEach(() => {
  restoreAudio();
  vi.unstubAllGlobals();
});

function turnState(current: Song | null, overrides: Partial<GameState> = {}): GameState {
  return {
    ...initialGameState,
    phase: 'turn',
    players: [
      { name: 'Ann', timeline: [song(1965, { id: 1 }), song(2010, { id: 2 })] },
      { name: 'Ben', timeline: [song(1990, { id: 3 })] },
    ],
    targetScore: 10,
    dealtCount: 2,
    currentSong: current,
    currentPreviewUrl: current ? '/api/mock-audio' : null,
    usedIds: [1, 2, 3],
    ...overrides,
  };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('GameScreen (turn)', () => {
  it('shows the current player, hidden card and slots; reveal disabled until a slot is chosen', async () => {
    const user = userEvent.setup();
    renderWithProviders(<GameScreen />, { state: turnState(song(2003, { id: 9, artist: 'O-Zone' })) });
    expect(screen.getByTestId('screen-turn')).toBeInTheDocument();
    expect(screen.getByTestId('current-player-name')).toHaveTextContent('Ann');
    expect(screen.getByTestId('hidden-card')).toBeInTheDocument();
    expect(screen.queryByText('O-Zone')).toBeNull(); // answer not in the DOM
    expect(screen.getAllByTestId('timeline-card')).toHaveLength(2);
    expect(screen.getAllByTestId('timeline-slot')).toHaveLength(3);
    expect(screen.getByTestId('btn-reveal')).toBeDisabled();
    // Compact layout (QA #2): stage row holds hidden card, speaker and play; timeline in its own section
    const stage = document.querySelector('.turn-stage');
    expect(stage).toContainElement(screen.getByTestId('hidden-card'));
    expect(stage).toContainElement(screen.getByTestId('speaker'));
    expect(stage).toContainElement(screen.getByTestId('btn-play'));
    expect(screen.getByTestId('speaker')).toHaveClass('speaker--small');
    expect(document.querySelector('section.turn-timeline')).toContainElement(screen.getByTestId('timeline'));
    expect(screen.getByTestId('current-player-name').tagName).toBe('BDI');
    await user.click(screen.getAllByTestId('timeline-slot')[1]!);
    expect(screen.getAllByTestId('timeline-slot')[1]).toHaveClass('timeline-slot--selected');
    expect(screen.getByTestId('btn-reveal')).toBeEnabled();
  });

  it('allows Reveal without playing the clip (product decision, QA #9)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<GameScreen />, { state: turnState(song(2003)) });
    await user.click(screen.getAllByTestId('timeline-slot')[0]!);
    expect(screen.getByTestId('btn-reveal')).toBeEnabled();
  });

  it('plays the clip only on tap and replays', async () => {
    const user = userEvent.setup();
    renderWithProviders(<GameScreen />, { state: turnState(song(2003)) });
    expect(FakeAudio.instances).toHaveLength(0);
    expect(screen.getByTestId('btn-play')).toHaveTextContent('Play');
    await user.click(screen.getByTestId('btn-play'));
    expect(FakeAudio.last().playCalls).toBe(1);
    expect(FakeAudio.last().src).toBe('/api/mock-audio');
    expect(screen.getByTestId('speaker')).toHaveClass('speaker--playing');
    expect(screen.getByTestId('btn-play')).toHaveTextContent('Replay');
    await user.click(screen.getByTestId('btn-play'));
    expect(FakeAudio.last().playCalls).toBe(2);
  });

  it('correct placement: reveals details, shows ✓ result and adds the card', async () => {
    const user = userEvent.setup();
    renderWithProviders(<GameScreen />, {
      state: turnState(song(2003, { id: 215, artist: 'O-Zone', title: 'Dragostea Din Tei' })),
    });
    await user.click(screen.getAllByTestId('timeline-slot')[1]!);
    await user.click(screen.getByTestId('btn-reveal'));
    expect(screen.getByTestId('revealed-card')).toBeInTheDocument();
    expect(document.querySelector('.turn-stage')).toContainElement(screen.getByTestId('result-correct'));
    expect(screen.getByTestId('card-artist')).toHaveTextContent('O-Zone');
    expect(screen.getByTestId('card-year')).toHaveTextContent('2003');
    expect(screen.getByTestId('card-title')).toHaveTextContent('Dragostea Din Tei');
    expect(screen.getByTestId('card-number')).toHaveTextContent('215');
    expect(screen.getByTestId('result-correct')).toHaveTextContent('Correct!');
    expect(screen.queryByTestId('result-wrong')).toBeNull();
    expect(screen.getAllByTestId('timeline-card').map((c) => c.getAttribute('data-year'))).toEqual([
      '1965',
      '2003',
      '2010',
    ]);
    expect(screen.queryAllByTestId('timeline-slot')).toHaveLength(0);
    expect(screen.queryByTestId('btn-reveal')).toBeNull();
    expect(screen.getByTestId('btn-next')).toHaveTextContent('Next player');
  });

  it('wrong placement: shows ✗ "it was <year>" and discards the card', async () => {
    const user = userEvent.setup();
    renderWithProviders(<GameScreen />, { state: turnState(song(2003)) });
    await user.click(screen.getAllByTestId('timeline-slot')[0]!);
    await user.click(screen.getByTestId('btn-reveal'));
    expect(screen.getByTestId('result-wrong')).toHaveTextContent('Wrong, it was 2003');
    expect(screen.getByTestId('result-wrong')).toHaveClass('result--wrong');
    expect(screen.getAllByTestId('timeline-card')).toHaveLength(2);
  });

  it('next passes the turn to the next player and loads a new song', async () => {
    const fetchMock = vi.fn((url: string) =>
      Promise.resolve(
        url.endsWith('/next') ? json({ song: song(1999, { id: 42 }) }) : json({ previewUrl: '/api/mock-audio' }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderWithProviders(<GameScreen />, { state: turnState(song(2003, { id: 9 })) });
    await user.click(screen.getAllByTestId('timeline-slot')[0]!);
    await user.click(screen.getByTestId('btn-reveal'));
    await user.click(screen.getByTestId('btn-next'));
    expect(screen.getByTestId('current-player-name')).toHaveTextContent('Ben');
    await waitFor(() => expect(screen.getByTestId('btn-play')).toBeEnabled());
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.excludeIds).toEqual(expect.arrayContaining([1, 2, 3, 9]));
    expect(body.languages).toEqual(['he', 'en']);
  });

  it('skips songs without a preview, marking them used', async () => {
    let n = 0;
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.endsWith('/next')) {
        n++;
        return Promise.resolve(json({ song: song(1980 + n, { id: 100 + n, artist: `A${n}` }) }));
      }
      void init;
      return Promise.resolve(json({ previewUrl: url.includes('/101/') ? null : '/ok.mp3' }));
    });
    vi.stubGlobal('fetch', fetchMock);
    renderWithProviders(<GameScreen />, { state: turnState(null) });
    expect(screen.getByTestId('btn-play')).toBeDisabled();
    await waitFor(() => expect(screen.getByTestId('btn-play')).toBeEnabled());
    const nextCalls = fetchMock.mock.calls.filter(([u]) => u.endsWith('/next'));
    expect(nextCalls).toHaveLength(2);
    const secondBody = JSON.parse(nextCalls[1]![1]!.body as string);
    expect(secondBody.excludeIds).toContain(101);
    expect(secondBody.excludeArtists).toContain('A1');
  });

  it('fetches another song when the audio fails to load', async () => {
    let n = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        Promise.resolve(
          url.endsWith('/next') ? json({ song: song(1990, { id: 200 + ++n }) }) : json({ previewUrl: `/p${n}.mp3` }),
        ),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<GameScreen />, { state: turnState(null) });
    await waitFor(() => expect(screen.getByTestId('btn-play')).toBeEnabled());
    await user.click(screen.getByTestId('btn-play'));
    act(() => FakeAudio.last().emit('error'));
    await waitFor(() => expect(n).toBe(2));
    await waitFor(() => expect(screen.getByTestId('btn-play')).toBeEnabled());
  });

  it('shows the error banner when the server is unreachable and retries', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderWithProviders(<GameScreen />, { state: turnState(null) });
    expect(await screen.findByTestId('error-banner')).toHaveTextContent("Can't reach the server");
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(url.endsWith('/next') ? json({ song: song(1990, { id: 300 }) }) : json({ previewUrl: '/x.mp3' })),
    );
    await user.click(screen.getByTestId('btn-retry'));
    await waitFor(() => expect(screen.queryByTestId('error-banner')).toBeNull());
    await waitFor(() => expect(screen.getByTestId('btn-play')).toBeEnabled());
  });

  it('shows "no songs left" and lets players end the game', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ error: 'NO_SONGS_LEFT' }, 404)));
    renderWithProviders(<GameScreen />, { state: turnState(null) });
    expect(await screen.findByTestId('error-banner')).toHaveTextContent('No songs left');
    expect(screen.queryByTestId('btn-retry')).toBeNull();
    expect(screen.getByTestId('btn-error-end-game')).toBeInTheDocument();
  });

  it('opens and closes the scoreboard', async () => {
    const user = userEvent.setup();
    renderWithProviders(<GameScreen />, { state: turnState(song(2003)) });
    await user.click(screen.getByTestId('btn-scoreboard'));
    const rows = screen.getAllByTestId('score-row');
    expect(rows.map((r) => r.getAttribute('data-score'))).toEqual(['2', '1']);
    await user.click(screen.getByTestId('btn-close-scoreboard'));
    expect(screen.queryByTestId('scoreboard')).toBeNull();
  });

  it('shows "See the winner" when the target is reached', async () => {
    const user = userEvent.setup();
    renderWithProviders(<GameScreen />, { state: turnState(song(2003), { targetScore: 3 }) });
    await user.click(screen.getAllByTestId('timeline-slot')[1]!);
    await user.click(screen.getByTestId('btn-reveal'));
    expect(screen.getByTestId('btn-next')).toHaveTextContent('See the winner');
  });
});
