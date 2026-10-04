import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { song } from '../test/fixtures';
import { I18nProvider } from '../i18n/I18nProvider';
import { Logo } from './Logo';
import { Scoreboard } from './Scoreboard';
import { decadeClass, HiddenCard, SongCard } from './SongCard';
import { Timeline } from './Timeline';
import type { ReactElement } from 'react';

const wrap = (ui: ReactElement) => render(<I18nProvider initialLang="en">{ui}</I18nProvider>);

describe('SongCard', () => {
  it('renders artist, year, title, deck code and card number with decade class', () => {
    const s = song(1965, { id: 227, artist: 'James Brown', title: 'I Got You (I Feel Good)' });
    wrap(<SongCard song={s} withTestIds />);
    expect(screen.getByTestId('card-artist')).toHaveTextContent('James Brown');
    expect(screen.getByTestId('card-year')).toHaveTextContent('1965');
    expect(screen.getByTestId('card-title')).toHaveTextContent('I Got You (I Feel Good)');
    expect(screen.getByTestId('card-number')).toHaveTextContent('227');
    expect(screen.getByText('IL01')).toBeInTheDocument();
    const card = screen.getByRole('article');
    expect(card).toHaveClass('song-card', 'song-card--d1960');
  });

  it('omits result testids unless requested and supports the small size', () => {
    wrap(<SongCard song={song(2003)} small />);
    expect(screen.queryByTestId('card-year')).toBeNull();
    expect(screen.getByRole('article')).toHaveClass('song-card--small');
  });

  it('marks Hebrew text so it renders RTL', () => {
    wrap(<SongCard song={song(2010, { artist: 'אייל גולן', title: 'מי שמאמין', language: 'he' })} withTestIds />);
    expect(screen.getByTestId('card-artist')).toHaveAttribute('dir', 'auto');
    expect(screen.getByTestId('card-year')).toHaveAttribute('dir', 'ltr');
  });

  it('decadeClass clamps', () => {
    expect(decadeClass(1949)).toBe('song-card--d1950');
    expect(decadeClass(2025)).toBe('song-card--d2020');
  });

  it('hidden card shows no song text', () => {
    wrap(<HiddenCard />);
    const card = screen.getByTestId('hidden-card');
    expect(card).toHaveClass('song-card--hidden');
    expect(card).toHaveTextContent('');
    expect(card).toHaveAccessibleName('Hidden song');
  });
});

describe('Timeline', () => {
  const cards = [song(2010, { id: 3 }), song(1965, { id: 1 }), song(2003, { id: 2 })];

  it('renders cards sorted ascending with year/id attributes, always LTR', () => {
    wrap(<Timeline cards={cards} />);
    const tl = screen.getByTestId('timeline');
    expect(tl).toHaveAttribute('dir', 'ltr');
    const rendered = screen.getAllByTestId('timeline-card');
    expect(rendered.map((c) => c.getAttribute('data-year'))).toEqual(['1965', '2003', '2010']);
    expect(rendered.map((c) => c.getAttribute('data-song-id'))).toEqual(['1', '2', '3']);
    expect(screen.queryAllByTestId('timeline-slot')).toHaveLength(0);
  });

  it('renders n+1 slots around the cards and reports the selected index', async () => {
    const onSelect = vi.fn();
    wrap(<Timeline cards={cards} selectable selectedSlot={2} onSelectSlot={onSelect} />);
    const slots = screen.getAllByTestId('timeline-slot');
    expect(slots.map((s) => s.getAttribute('data-index'))).toEqual(['0', '1', '2', '3']);
    expect(slots[2]).toHaveClass('timeline-slot--selected');
    expect(slots[2]).toHaveAttribute('aria-pressed', 'true');
    expect(slots[0]).toHaveAccessibleName('Place before 1965');
    expect(slots[1]).toHaveAccessibleName('Place between 1965 and 2003');
    expect(slots[3]).toHaveAccessibleName('Place after 2010');
    await userEvent.click(slots[3]!);
    expect(onSelect).toHaveBeenCalledWith(3);
  });

  it('an empty timeline has a single slot', () => {
    wrap(<Timeline cards={[]} selectable />);
    expect(screen.getAllByTestId('timeline-slot')).toHaveLength(1);
  });
});

describe('Scoreboard', () => {
  it('lists every player with score attributes and closes', async () => {
    const onClose = vi.fn();
    const onEnd = vi.fn();
    wrap(
      <Scoreboard
        players={[
          { name: 'Ann', timeline: [song(1990), song(2000)], tokens: 1 },
          { name: 'Ben', timeline: [song(1980)], tokens: 1 },
        ]}
        currentPlayerIndex={0}
        targetScore={10}
        onClose={onClose}
        onEndGame={onEnd}
      />,
    );
    const rows = screen.getAllByTestId('score-row');
    expect(rows.map((r) => [r.getAttribute('data-player'), r.getAttribute('data-score')])).toEqual([
      ['Ann', '2'],
      ['Ben', '1'],
    ]);
    expect(rows[0]).toHaveClass('is-leader');
    // Name isolated in <bdi>, score in its own cell (QA #3)
    expect(rows[0]!.querySelector('bdi')).toHaveTextContent('Ann');
    const cells = rows[0]!.querySelectorAll('td');
    expect(cells).toHaveLength(2);
    expect(cells[1]).toHaveTextContent(/^2$/);
    expect(within(screen.getByTestId('scoreboard')).getByRole('heading')).toHaveTextContent('Scoreboard');
    await userEvent.click(screen.getByTestId('btn-close-scoreboard'));
    expect(onClose).toHaveBeenCalled();
    await userEvent.click(screen.getByTestId('btn-end-game'));
    expect(onEnd).toHaveBeenCalled();
  });
});

describe('Logo', () => {
  it('renders the Hebrew name as right-to-left HTML text, not inside the SVG', () => {
    render(<Logo />);
    const hebrew = screen.getByText('היטסטר');
    expect(hebrew.tagName).toBe('SPAN');
    expect(hebrew).toHaveAttribute('dir', 'rtl');
    expect(hebrew).toHaveAttribute('lang', 'he');
  });
});
