import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setAudioFactory } from '../audio/useAudioPlayer';
import { initialGameState } from '../game/reducer';
import type { Bet, GameState, NameGuess } from '../game/types';
import { FakeAudio } from '../test/fakeAudio';
import { song } from '../test/fixtures';
import { renderWithProviders } from '../test/render';
import { GameScreen } from './GameScreen';

/**
 * Tokens, naming and bets on the game screen (docs/TOKENS_AND_BETS.md §3, §6).
 * Ann (current, 3 tokens) has 1965 · 2003; the song is from 1997, so slot 1 is right.
 */

let restoreAudio: () => void;
beforeEach(() => {
  FakeAudio.reset();
  restoreAudio = setAudioFactory(() => new FakeAudio());
});
afterEach(() => {
  restoreAudio();
  vi.unstubAllGlobals();
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const SONG = song(1997, { id: 50, artist: 'Ivri Lider', title: 'Leonardo' });

function tokenState(overrides: Partial<GameState> = {}): GameState {
  return {
    ...initialGameState,
    phase: 'turn',
    tokensAndBets: true,
    players: [
      { name: 'Ann', timeline: [song(1965, { id: 1 }), song(2003, { id: 2 })], tokens: 3 },
      { name: 'Bob', timeline: [song(1976, { id: 3 }), song(1992, { id: 4 })], tokens: 2 },
      { name: 'Carol', timeline: [song(1971, { id: 5 })], tokens: 1 },
      { name: 'Dana', timeline: [song(2013, { id: 6 })], tokens: 0 },
    ],
    targetScore: 10,
    dealtCount: 4,
    currentSong: SONG,
    currentPreviewUrl: '/api/mock-audio',
    usedIds: [1, 2, 3, 4, 5, 6, 50],
    ...overrides,
  };
}

/** In the betting round: Ann picked after 2003 (wrong). */
const bettingState = (overrides: Partial<GameState> = {}) =>
  tokenState({ phase: 'betting', selectedSlot: 2, ...overrides });

const guess = (artistCorrect: boolean, titleCorrect: boolean): NameGuess => ({
  artist: 'Ivri Lider',
  title: 'Leonardo X',
  artistCorrect,
  titleCorrect,
});

type GuessReply = { artistCorrect: boolean; titleCorrect: boolean } | 'fail';

/** Fake server. `/guess` answers from `replies` in order; every request is recorded. */
function stubServer(replies: GuessReply[] = []) {
  const calls: Array<{ url: string; body: unknown }> = [];
  const fn = vi.fn((url: string, init?: RequestInit) => {
    calls.push({ url, body: init?.body ? JSON.parse(init.body as string) : undefined });
    if (url.endsWith('/guess')) {
      const r = replies.shift() ?? { artistCorrect: false, titleCorrect: false };
      return r === 'fail' ? Promise.reject(new TypeError('Failed to fetch')) : Promise.resolve(json(r));
    }
    if (url.endsWith('/next')) return Promise.resolve(json({ song: song(1980, { id: 77 }) }));
    if (url.endsWith('/preview')) return Promise.resolve(json({ previewUrl: '/ok.mp3' }));
    return Promise.resolve(json({}));
  });
  vi.stubGlobal('fetch', fn);
  return { fn, guessCalls: () => calls.filter((c) => c.url.endsWith('/guess')) };
}

const slots = () => screen.getAllByTestId('timeline-slot');
const bettor = (index: number) =>
  screen.getAllByTestId('btn-bettor').find((b) => b.getAttribute('data-player') === String(index))!;

async function openScoreboardTokens(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId('btn-scoreboard'));
  const rows = screen.getAllByTestId('score-row').map((r) => [r.getAttribute('data-player'), r.getAttribute('data-tokens')]);
  await user.click(screen.getByTestId('btn-close-scoreboard'));
  return rows;
}

describe('GameScreen with tokens and bets: the turn', () => {
  it('shows the token chip, Skip · 3, a collapsed "Name artist + title" and Lock in instead of Reveal', async () => {
    stubServer();
    const user = userEvent.setup();
    renderWithProviders(<GameScreen />, { state: tokenState() });
    const chip = screen.getByTestId('current-player-tokens');
    expect(chip).toHaveTextContent('3');
    expect(chip).toHaveAccessibleName('3 of 5 tokens');
    expect(screen.getByTestId('btn-skip-song')).toHaveTextContent('Skip · 3');
    expect(screen.getByTestId('btn-skip-song')).toHaveClass('btn--token-outline');
    const nameIt = screen.getByTestId('btn-name-it');
    expect(nameIt).toHaveTextContent('Name artist + title');
    expect(nameIt).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('input-guess-artist')).toBeNull();
    const who = document.querySelector('.name-it__who');
    expect(who).toHaveTextContent('Bob, Carol can bet on your card. Name both to stop them.');
    expect([...who!.querySelectorAll('bdi')].map((b) => b.textContent)).toEqual(['Bob', 'Carol']);
    expect(screen.queryByTestId('btn-reveal')).toBeNull();
    // Lock in shows from the start, and waits for a spot
    expect(screen.getByTestId('btn-lock-in')).toBeDisabled();
    await user.click(slots()[1]!);
    expect(screen.getByTestId('btn-lock-in')).toBeEnabled();
    expect(screen.getByTestId('btn-lock-in')).toHaveClass('btn--primary');
  });

  it('with the switch off: no tokens, no skip, no naming, Reveal as before', () => {
    renderWithProviders(<GameScreen />, { state: tokenState({ tokensAndBets: false }) });
    expect(screen.queryByTestId('current-player-tokens')).toBeNull();
    expect(screen.queryByTestId('btn-skip-song')).toBeNull();
    expect(screen.queryByTestId('btn-name-it')).toBeNull();
    expect(screen.queryByTestId('btn-lock-in')).toBeNull();
    expect(screen.getByTestId('btn-reveal')).toBeDisabled();
  });

  it('when nobody could bet: Reveal, no naming, but Skip still works (e.g. a 1-player game)', async () => {
    const solo = tokenState({ players: [{ name: 'Solo', timeline: [song(1965, { id: 1 })], tokens: 3 }] });
    const user = userEvent.setup();
    renderWithProviders(<GameScreen />, { state: solo });
    expect(screen.queryByTestId('btn-name-it')).toBeNull();
    expect(screen.queryByTestId('btn-lock-in')).toBeNull();
    expect(screen.getByTestId('btn-skip-song')).toBeInTheDocument();
    await user.click(slots()[1]!);
    await user.click(screen.getByTestId('btn-reveal'));
    expect(screen.getByTestId('result-correct')).toBeInTheDocument();
    expect(screen.getByTestId('current-player-tokens')).toHaveTextContent('4');
  });

  it('hides Skip with fewer than 3 tokens', () => {
    const s = tokenState();
    s.players[0] = { ...s.players[0]!, tokens: 2 };
    renderWithProviders(<GameScreen />, { state: s });
    expect(screen.queryByTestId('btn-skip-song')).toBeNull();
  });

  it('skip asks first: "Keep listening" changes nothing, Skip pays 3 tokens and loads a new song', async () => {
    const server = stubServer();
    const user = userEvent.setup();
    renderWithProviders(<GameScreen />, { state: tokenState() });
    await user.click(slots()[1]!);
    await user.click(screen.getByTestId('btn-skip-song'));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAccessibleName('Skip this song for 3 tokens?');
    // Tokens now → after skipping
    expect(within(dialog).getAllByRole('img').map((m) => m.getAttribute('aria-label'))).toEqual([
      '3 of 5 tokens',
      '0 of 5 tokens',
    ]);
    expect(screen.getByTestId('btn-confirm-skip')).toHaveClass('btn--token');
    await user.click(screen.getByRole('button', { name: 'Keep listening' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('current-player-tokens')).toHaveTextContent('3');
    expect(server.fn).not.toHaveBeenCalled();

    await user.click(screen.getByTestId('btn-skip-song'));
    await user.click(screen.getByTestId('btn-confirm-skip'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('current-player-tokens')).toHaveTextContent('0');
    expect(screen.queryByTestId('btn-skip-song')).toBeNull();
    await waitFor(() => expect(screen.getByTestId('btn-play')).toBeEnabled());
    const next = server.fn.mock.calls.find(([u]) => String(u).endsWith('/next'));
    expect(JSON.parse((next![1] as RequestInit).body as string).excludeIds).toContain(50);
    // The spot was cleared
    expect(slots().some((s) => s.classList.contains('timeline-slot--selected'))).toBe(false);
  });

  it('Lock in with nothing typed sends no guess and opens the bets', async () => {
    const server = stubServer();
    const user = userEvent.setup();
    renderWithProviders(<GameScreen />, { state: tokenState() });
    await user.click(slots()[2]!);
    await user.click(screen.getByTestId('btn-lock-in'));
    expect(server.guessCalls()).toHaveLength(0);
    expect(screen.getByTestId('bet-panel')).toHaveTextContent('Bets are open!');
    expect(screen.getByTestId('bet-panel')).toHaveTextContent('Think Ann is wrong? Grab the phone and tap your name.');
    expect(screen.getByTestId('bet-announce')).toHaveTextContent('Bets are open!');
  });

  it('naming fields: labelled, dir=auto, no autocomplete/autocorrect/spellcheck; Lock in checks them once', async () => {
    const server = stubServer([{ artistCorrect: true, titleCorrect: false }]);
    const user = userEvent.setup();
    renderWithProviders(<GameScreen />, { state: tokenState() });
    await user.click(screen.getByTestId('btn-name-it'));
    expect(screen.getByTestId('btn-name-it')).toHaveAttribute('aria-expanded', 'true');
    const artist = screen.getByLabelText('Artist');
    const title = screen.getByLabelText('Song title');
    expect(artist).toBe(screen.getByTestId('input-guess-artist'));
    expect(title).toBe(screen.getByTestId('input-guess-title'));
    for (const input of [artist, title]) {
      expect(input).toHaveAttribute('dir', 'auto');
      expect(input).toHaveAttribute('autocomplete', 'off');
      expect(input).toHaveAttribute('autocorrect', 'off');
      expect(input).toHaveAttribute('spellcheck', 'false');
      expect(input).not.toHaveAttribute('list');
      expect(input).toHaveClass('input');
    }
    expect(screen.getByRole('group', { name: 'Name both to block bets (optional)' })).toBeInTheDocument();
    await user.type(artist, '  Ivri Lider ');
    await user.type(title, 'Leonardo X');
    // Typing never calls the server
    expect(server.guessCalls()).toHaveLength(0);
    expect(screen.getByText('Pick a spot on the timeline first')).toBeInTheDocument();
    await user.click(slots()[2]!);
    await user.click(screen.getByTestId('btn-lock-in'));
    expect(await screen.findByTestId('bet-panel')).toBeInTheDocument();
    expect(server.guessCalls()).toEqual([{ url: '/api/songs/50/guess', body: { artist: 'Ivri Lider', title: 'Leonardo X' } }]);
    // Before Reveal the screen never says which part was right
    expect(screen.queryByTestId('guess-artist-result')).toBeNull();
    expect(screen.getByTestId('bet-panel')).not.toHaveTextContent('✓');
    expect(screen.getByTestId('bet-panel')).not.toHaveTextContent('Ivri Lider');
  });

  it('closing "Name artist + title" forgets what was typed', async () => {
    const server = stubServer();
    const user = userEvent.setup();
    renderWithProviders(<GameScreen />, { state: tokenState() });
    await user.click(screen.getByTestId('btn-name-it'));
    await user.type(screen.getByTestId('input-guess-artist'), 'Someone');
    await user.click(screen.getByTestId('btn-name-it'));
    await user.click(screen.getByTestId('btn-name-it'));
    expect(screen.getByTestId('input-guess-artist')).toHaveValue('');
    await user.click(screen.getByTestId('btn-name-it'));
    await user.click(slots()[2]!);
    await user.click(screen.getByTestId('btn-lock-in'));
    expect(server.guessCalls()).toHaveLength(0);
  });

  it('names both right and the spot right: "Named it! No bets allowed." with ✓/✓, no bets', async () => {
    stubServer([{ artistCorrect: true, titleCorrect: true }]);
    const user = userEvent.setup();
    renderWithProviders(<GameScreen />, { state: tokenState() });
    await user.click(slots()[1]!);
    await user.click(screen.getByTestId('btn-name-it'));
    await user.type(screen.getByTestId('input-guess-artist'), 'Ivri Lider');
    await user.type(screen.getByTestId('input-guess-title'), 'Leonardo');
    await user.click(screen.getByTestId('btn-lock-in'));
    expect(await screen.findByTestId('result-correct')).toBeInTheDocument();
    expect(screen.queryByTestId('bet-panel')).toBeNull();
    expect(screen.getByTestId('result-named')).toHaveTextContent('Named it! No bets allowed.');
    expect(screen.getByTestId('guess-artist-result')).toHaveTextContent('Ivri Lider✓');
    expect(screen.getByTestId('guess-title-result')).toHaveTextContent('Leonardo✓');
    const rows = screen.getAllByTestId('outcome-row');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveAttribute('data-player', '0');
    expect(rows[0]).toHaveTextContent('Ann+1 card · +1 token');
    expect(screen.queryByTestId('btn-accept-guess')).toBeNull();
    expect(screen.getByTestId('current-player-tokens')).toHaveTextContent('4');
  });

  it('a failed check offers Try again', async () => {
    const server = stubServer(['fail', { artistCorrect: false, titleCorrect: false }]);
    const user = userEvent.setup();
    renderWithProviders(<GameScreen />, { state: tokenState() });
    await user.click(slots()[2]!);
    await user.click(screen.getByTestId('btn-name-it'));
    await user.type(screen.getByTestId('input-guess-title'), 'Leonardo');
    await user.click(screen.getByTestId('btn-lock-in'));
    expect(await screen.findByTestId('error-banner')).toHaveTextContent("Couldn't check the names.");
    expect(screen.queryByTestId('bet-panel')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByTestId('bet-panel')).toBeInTheDocument();
    expect(server.guessCalls()).toHaveLength(2);
  });

  it('a failed check offers "Continue without naming": bets open, no second request', async () => {
    const server = stubServer(['fail']);
    const user = userEvent.setup();
    renderWithProviders(<GameScreen />, { state: tokenState() });
    await user.click(slots()[1]!);
    await user.click(screen.getByTestId('btn-name-it'));
    await user.type(screen.getByTestId('input-guess-artist'), 'Ivri');
    await user.click(screen.getByTestId('btn-lock-in'));
    await user.click(await screen.findByTestId('btn-continue-without-naming'));
    expect(screen.getByTestId('bet-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('error-banner')).toBeNull();
    expect(server.guessCalls()).toHaveLength(1);
  });
});

describe('GameScreen with tokens and bets: the betting round', () => {
  it('"Who\'s betting?": every other player, with token meters and the reason when they cannot bet', async () => {
    stubServer();
    const user = userEvent.setup();
    renderWithProviders(<GameScreen />, {
      state: bettingState({ bets: [{ playerIndex: 2, slotIndex: 0 }], triedThisTurn: [2] }),
    });
    const panel = screen.getByTestId('bet-panel');
    expect(panel).toHaveTextContent("Who's betting?");
    const buttons = screen.getAllByTestId('btn-bettor');
    expect(buttons.map((b) => b.getAttribute('data-player'))).toEqual(['1', '2', '3']);
    expect(bettor(1)).not.toHaveAttribute('aria-disabled');
    expect(within(bettor(1)).getByTestId('token-meter')).toHaveAccessibleName('2 of 5 tokens');
    expect(bettor(2)).toHaveAttribute('aria-disabled', 'true');
    expect(bettor(2)).toHaveTextContent('1st bet');
    expect(bettor(3)).toHaveAttribute('aria-disabled', 'true');
    expect(bettor(3)).toHaveTextContent('no tokens');
    // A greyed-out player cannot start
    await user.click(bettor(3));
    expect(screen.queryByTestId('input-guess-artist')).toBeNull();
    // The current player's timeline with the taken spots
    expect(screen.getByTestId('timeline')).toHaveAttribute('data-owner', '0');
    const s = slots();
    expect(s.map((x) => x.getAttribute('data-marker'))).toEqual(['bet', null, 'pick']);
    expect(s[0]).toHaveAttribute('aria-disabled', 'true');
    expect(s[0]).toHaveAttribute('data-initials', 'C');
    expect(s[0]).toHaveAccessibleName("Place before 1965: Carol's bet");
    expect(s[2]).toHaveAttribute('data-initials', 'A');
    expect(s[2]).toHaveAccessibleName("Place after 2003: Ann's pick");
    expect(s[1]).toBeDisabled(); // free, but nobody holds the phone
    const legend = screen.getByTestId('bet-legend');
    expect(legend).toHaveTextContent('Ann · pick');
    expect(legend).toHaveTextContent('Carol · 1st bet');
    expect(legend).toHaveTextContent('free spot');
    // The hidden card and Play stay available; Reveal ends the round
    expect(screen.getByTestId('hidden-card')).toBeInTheDocument();
    expect(screen.getByTestId('btn-play')).toBeEnabled();
    expect(screen.getByTestId('btn-reveal')).toBeEnabled();
  });

  it('a bettor names one part right, picks a free spot and bets 1 token', async () => {
    const server = stubServer([{ artistCorrect: false, titleCorrect: true }]);
    const user = userEvent.setup();
    renderWithProviders(<GameScreen />, { state: bettingState() });
    await user.click(bettor(1));
    expect(screen.getByRole('heading', { name: 'Bob, name the artist or the title' })).toHaveFocus();
    expect(screen.getByTestId('bet-announce')).toHaveTextContent('Bob, name the artist or the title');
    expect(screen.getByTestId('btn-check-guess')).toBeDisabled();
    await user.type(screen.getByTestId('input-guess-title'), 'Leonardo');
    await user.click(screen.getByTestId('btn-check-guess'));
    const allowed = await screen.findByTestId('bet-allowed');
    expect(allowed).toHaveTextContent('You can bet!');
    expect(screen.getByTestId('bet-announce')).toHaveTextContent('You can bet!');
    expect(server.guessCalls()[0]!.body).toEqual({ artist: '', title: 'Leonardo' });
    // The typed text is gone
    expect(screen.queryByTestId('input-guess-title')).toBeNull();
    expect(screen.queryByDisplayValue('Leonardo')).toBeNull();

    const place = screen.getByTestId('btn-place-bet');
    expect(place).toHaveTextContent('Bet 1 token');
    expect(place).toHaveClass('btn--token');
    expect(place).toBeDisabled();
    // A taken spot cannot be picked
    await user.click(slots()[2]!);
    expect(place).toBeDisabled();
    await user.click(slots()[1]!);
    expect(slots()[1]).toHaveClass('timeline-slot--selected');
    expect(screen.getByTestId('bet-legend')).toHaveTextContent('Bob · your bet');
    await user.click(place);

    // Back to the list: Bob's bet is on the timeline; tokens move only at Reveal
    expect(screen.getByTestId('bet-panel')).toHaveTextContent("Who's betting?");
    expect(slots()[1]).toHaveAttribute('data-marker', 'bet');
    expect(slots()[1]).toHaveAttribute('data-initials', 'B');
    expect(bettor(1)).toHaveTextContent('1st bet');
    expect(screen.getByTestId('bet-legend')).toHaveTextContent('Bob · 1st bet');
    expect(await openScoreboardTokens(user)).toEqual([
      ['Ann', '3'],
      ['Bob', '2'],
      ['Carol', '1'],
      ['Dana', '0'],
    ]);
  });

  it('naming neither: "Not this time", the token is kept and the try is used', async () => {
    stubServer([{ artistCorrect: false, titleCorrect: false }]);
    const user = userEvent.setup();
    renderWithProviders(<GameScreen />, { state: bettingState() });
    await user.click(bettor(2));
    await user.type(screen.getByTestId('input-guess-artist'), 'Nobody');
    await user.click(screen.getByTestId('btn-check-guess'));
    const denied = await screen.findByTestId('bet-denied');
    expect(denied).toHaveTextContent('Not this time. Pass the phone on.');
    expect(denied).toHaveTextContent('No token lost');
    expect(denied).not.toHaveTextContent(/artist|title/i);
    expect(screen.getByTestId('bet-announce')).toHaveTextContent('Not this time');
    await user.click(screen.getByRole('button', { name: 'OK' }));
    expect(bettor(2)).toHaveAttribute('aria-disabled', 'true');
    expect(bettor(2)).toHaveTextContent('tried');
  });

  it('Cancel before checking gives the phone back without using the try', async () => {
    const server = stubServer();
    const user = userEvent.setup();
    renderWithProviders(<GameScreen />, { state: bettingState() });
    await user.click(bettor(1));
    await user.type(screen.getByTestId('input-guess-artist'), 'abc');
    await user.click(screen.getByTestId('btn-cancel-bet'));
    expect(server.guessCalls()).toHaveLength(0);
    expect(bettor(1)).not.toHaveAttribute('aria-disabled');
    // Fields start empty for the next bettor
    await user.click(bettor(1));
    expect(screen.getByTestId('input-guess-artist')).toHaveValue('');
  });

  it('Cancel after "You can bet!" places no bet; the try is used', async () => {
    stubServer([{ artistCorrect: true, titleCorrect: false }]);
    const user = userEvent.setup();
    renderWithProviders(<GameScreen />, { state: bettingState() });
    await user.click(bettor(1));
    await user.type(screen.getByTestId('input-guess-artist'), 'Ivri');
    await user.click(screen.getByTestId('btn-check-guess'));
    await screen.findByTestId('bet-allowed');
    await user.click(slots()[0]!);
    await user.click(screen.getByTestId('btn-cancel-bet'));
    expect(slots().filter((s) => s.getAttribute('data-marker') === 'bet')).toHaveLength(0);
    expect(bettor(1)).toHaveTextContent('tried');
  });

  it("a bettor's failed check offers Try again; Cancel keeps the try", async () => {
    const server = stubServer(['fail', { artistCorrect: true, titleCorrect: true }]);
    const user = userEvent.setup();
    renderWithProviders(<GameScreen />, { state: bettingState() });
    await user.click(bettor(1));
    await user.type(screen.getByTestId('input-guess-artist'), 'Ivri');
    await user.click(screen.getByTestId('btn-check-guess'));
    expect(await screen.findByTestId('error-banner')).toHaveTextContent("Couldn't check the names.");
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByTestId('bet-allowed')).toBeInTheDocument();
    expect(server.guessCalls()).toHaveLength(2);
  });

  it('when nobody may try any more: "All bets are in!" with Reveal', () => {
    renderWithProviders(<GameScreen />, {
      state: bettingState({
        bets: [
          { playerIndex: 2, slotIndex: 0 },
          { playerIndex: 1, slotIndex: 1 },
        ],
        triedThisTurn: [2, 1],
      }),
    });
    expect(screen.getByTestId('bet-panel')).toHaveTextContent('All bets are in!');
    expect(screen.getByTestId('bet-panel')).toHaveTextContent('No free spots left');
    expect(screen.getAllByTestId('btn-bettor').every((b) => b.getAttribute('aria-disabled') === 'true')).toBe(true);
    expect(bettor(1)).toHaveTextContent('2nd bet');
    expect(screen.getByTestId('btn-reveal')).toBeEnabled();
  });

  it('two players with the same initial get two letters', () => {
    const s = bettingState({ bets: [{ playerIndex: 1, slotIndex: 0 }], triedThisTurn: [1] });
    s.players[1] = { ...s.players[1]!, name: 'Avi' };
    renderWithProviders(<GameScreen />, { state: s });
    expect(slots()[0]).toHaveAttribute('data-initials', 'Av');
    expect(slots()[2]).toHaveAttribute('data-initials', 'An');
  });
});

describe('GameScreen with tokens and bets: the result', () => {
  async function reveal(state: GameState) {
    stubServer();
    const user = userEvent.setup();
    renderWithProviders(<GameScreen />, { state });
    await user.click(screen.getByTestId('btn-reveal'));
    return user;
  }
  const rows = () =>
    screen.getAllByTestId('outcome-row').map((r) => [r.getAttribute('data-outcome'), r.getAttribute('data-player'), r.textContent]);

  it("a bettor on the right spot wins the card into their own timeline; We accept it undoes it", async () => {
    const bets: Bet[] = [
      { playerIndex: 2, slotIndex: 0 },
      { playerIndex: 1, slotIndex: 1 },
    ];
    const user = await reveal(bettingState({ bets, triedThisTurn: [2, 1], guess: guess(true, false) }));
    expect(screen.getByTestId('result-wrong')).toHaveTextContent('Wrong, it was 1997');
    expect(screen.getByTestId('result-stolen')).toHaveTextContent('Bob wins the card!');
    expect(screen.getByTestId('result-stolen').querySelector('bdi')).toHaveTextContent('Bob');
    expect(rows()).toEqual([
      ['won', '1', 'BBob+1 card · +1 token'],
      ['lost', '2', 'C−1 token: Carol'],
    ]);
    // The current player's typed names, with ✓/✗
    expect(screen.getByTestId('guess-artist-result')).toHaveAttribute('data-correct', 'true');
    expect(screen.getByTestId('guess-title-result')).toHaveAttribute('data-correct', 'false');
    expect(screen.getByTestId('guess-title-result')).toHaveTextContent('Leonardo X✗');
    // The bettor's timeline, with the new card outlined in gold
    const tl = screen.getByTestId('timeline');
    expect(tl).toHaveAttribute('data-owner', '1');
    expect(screen.getByText(/Added to/)).toHaveTextContent("Added to Bob's timeline");
    const cards = screen.getAllByTestId('timeline-card');
    expect(cards.map((c) => c.getAttribute('data-year'))).toEqual(['1976', '1992', '1997']);
    expect(cards[2]).toHaveClass('song-card--stolen');
    expect(screen.getByTestId('current-player-tokens')).toHaveTextContent('3');
    expect(await openScoreboardTokens(user)).toEqual([
      ['Ann', '3'],
      ['Bob', '3'],
      ['Carol', '0'],
      ['Dana', '0'],
    ]);

    await user.click(screen.getByTestId('btn-accept-guess'));
    expect(screen.queryByTestId('btn-accept-guess')).toBeNull();
    expect(screen.queryByTestId('result-stolen')).toBeNull();
    expect(screen.getByText('Accepted: the bets are cancelled.')).toBeInTheDocument();
    expect(rows()).toEqual([['refunded', '2,1', 'CBCarol, Bobbet cancelled, token back']]);
    expect(screen.getByTestId('timeline')).toHaveAttribute('data-owner', '0');
    expect(await openScoreboardTokens(user)).toEqual([
      ['Ann', '3'],
      ['Bob', '2'],
      ['Carol', '1'],
      ['Dana', '0'],
    ]);
  });

  it('right spot with bets: +1 card · +1 token for the current player, losers grouped in one row', async () => {
    await reveal(
      bettingState({
        selectedSlot: 1,
        bets: [
          { playerIndex: 1, slotIndex: 0 },
          { playerIndex: 2, slotIndex: 2 },
        ],
        triedThisTurn: [1, 2],
      }),
    );
    expect(screen.getByTestId('result-correct')).toBeInTheDocument();
    expect(rows()).toEqual([
      ['won', '0', 'AAnn+1 card · +1 token'],
      ['lost', '1,2', 'BC−1 token: Bob, Carol'],
    ]);
    // No names typed: nothing to accept
    expect(screen.queryByTestId('btn-accept-guess')).toBeNull();
    expect(screen.getByTestId('timeline')).toHaveAttribute('data-owner', '0');
    expect(screen.getByText(/'s timeline/)).toHaveTextContent("Ann's timeline");
    expect(screen.getByTestId('current-player-tokens')).toHaveTextContent('4');
  });

  it('two right bets: the earlier one wins, the later one keeps the token', async () => {
    const s = bettingState({
      currentSong: song(2003, { id: 60 }),
      selectedSlot: 0,
      bets: [
        { playerIndex: 1, slotIndex: 1 },
        { playerIndex: 2, slotIndex: 2 },
      ],
      triedThisTurn: [1, 2],
    });
    await reveal(s);
    expect(screen.getByTestId('result-stolen')).toHaveTextContent('Bob wins the card!');
    expect(rows()).toEqual([
      ['won', '1', 'BBob+1 card · +1 token'],
      ['right', '2', 'CCarolCorrect bet, but Bob bet first'],
    ]);
  });

  it('nobody right: the card is out; We accept it returns the bet tokens', async () => {
    const user = await reveal(
      bettingState({ bets: [{ playerIndex: 1, slotIndex: 0 }], triedThisTurn: [1], guess: guess(false, false) }),
    );
    expect(screen.getByText('Nobody got it. The card is out.')).toBeInTheDocument();
    expect(rows()).toEqual([['lost', '1', 'B−1 token: Bob']]);
    expect(screen.getByRole('heading', { name: "Were Ann's names right?" })).toBeInTheDocument();
    await user.click(screen.getByTestId('btn-accept-guess'));
    expect(rows()).toEqual([['refunded', '1', 'BBobbet cancelled, token back']]);
    expect((await openScoreboardTokens(user))[1]).toEqual(['Bob', '2']);
  });

  it('no "We accept it" without bets', async () => {
    await reveal(bettingState({ guess: guess(true, false) }));
    expect(screen.getByTestId('result-wrong')).toBeInTheDocument();
    expect(screen.queryByTestId('btn-accept-guess')).toBeNull();
    expect(screen.queryAllByTestId('outcome-row')).toHaveLength(0);
  });

  it('tokens full: "+1 card (tokens full)"', async () => {
    const s = bettingState({ selectedSlot: 1 });
    s.players[0] = { ...s.players[0]!, tokens: 5 };
    await reveal(s);
    expect(rows()).toEqual([['won', '0', 'AAnn+1 card (tokens full)']]);
    expect(screen.getByTestId('current-player-tokens')).toHaveTextContent('5');
  });

  it('"See the winner" when a bettor reaches the target on someone else\'s turn', async () => {
    await reveal(bettingState({ targetScore: 3, bets: [{ playerIndex: 1, slotIndex: 1 }], triedThisTurn: [1] }));
    expect(screen.getByTestId('result-stolen')).toBeInTheDocument();
    expect(screen.getByTestId('btn-next')).toHaveTextContent('See the winner');
  });

  it('with the switch off the result looks as before', async () => {
    const user = userEvent.setup();
    renderWithProviders(<GameScreen />, { state: tokenState({ tokensAndBets: false }) });
    await user.click(slots()[1]!);
    await user.click(screen.getByTestId('btn-reveal'));
    expect(screen.getByTestId('result-correct')).toBeInTheDocument();
    expect(screen.queryByTestId('turn-outcome')).toBeNull();
    expect(screen.queryAllByTestId('outcome-row')).toHaveLength(0);
    expect(screen.queryByTestId('current-player-tokens')).toBeNull();
  });
});

describe('GameScreen with tokens and bets: Hebrew', () => {
  it('isolates names with <bdi> and keeps "+1"/"−1" left-to-right', async () => {
    stubServer();
    const user = userEvent.setup();
    const s = bettingState({
      bets: [
        { playerIndex: 2, slotIndex: 0 },
        { playerIndex: 1, slotIndex: 1 },
      ],
      triedThisTurn: [2, 1],
    });
    s.players = s.players.map((p, i) => ({ ...p, name: ['נועה', 'Mike', 'דני', 'דנה'][i]! }));
    renderWithProviders(<GameScreen />, { state: s, lang: 'he' });
    expect(screen.getByTestId('bet-panel')).toHaveTextContent('ההימורים נסגרו!');
    expect(screen.getByTestId('btn-reveal')).toHaveTextContent('חשיפה');
    // Same initial ד: two letters
    expect(slots()[0]).toHaveAttribute('data-initials', 'דנ');
    await user.click(screen.getByTestId('btn-reveal'));
    const stolen = screen.getByTestId('result-stolen');
    expect(stolen).toHaveTextContent('הקלף עובר ל-Mike!');
    expect(stolen.querySelector('bdi')).toHaveTextContent('Mike');
    const [won, lost] = screen.getAllByTestId('outcome-row');
    expect(won!.querySelectorAll('[dir="ltr"]')).toHaveLength(2);
    expect(won!.querySelector('[dir="ltr"]')).toHaveTextContent('+1');
    expect(lost!.querySelector('[dir="ltr"]')).toHaveTextContent('−1');
    expect(lost!.querySelector('bdi')).toHaveTextContent('דני');
    expect(screen.getByText(/נוסף לציר הזמן של/).querySelector('bdi')).toHaveTextContent('Mike');
  });
});
