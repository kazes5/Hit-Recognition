import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n/I18nProvider';
import { song } from '../test/fixtures';
import { playerInitials } from './initials';
import { Scoreboard } from './Scoreboard';
import { Timeline, type SlotMarker } from './Timeline';
import { TokenChip, TokenMeter } from './TokenMeter';

const wrap = (ui: ReactElement, lang: 'en' | 'he' = 'en') => render(<I18nProvider initialLang={lang}>{ui}</I18nProvider>);

describe('TokenMeter', () => {
  it('shows 5 pips, filled for each token, and reads "3 of 5 tokens"', () => {
    wrap(<TokenMeter tokens={3} showCount />);
    const meter = screen.getByTestId('token-meter');
    expect(meter).toHaveAccessibleName('3 of 5 tokens');
    expect(meter).toHaveAttribute('data-tokens', '3');
    expect(meter.querySelectorAll('.token-meter__pip')).toHaveLength(5);
    expect(meter.querySelectorAll('.token-meter__pip--on')).toHaveLength(3);
    expect(meter).toHaveTextContent(/^3$/);
  });

  it('says "Max" at 5 and clamps out-of-range values', () => {
    wrap(
      <>
        <TokenMeter tokens={5} />
        <TokenMeter tokens={-2} />
      </>,
    );
    const [full, empty] = screen.getAllByTestId('token-meter');
    expect(full).toHaveTextContent('Max');
    expect(full).toHaveClass('token-meter--full');
    expect(full).toHaveAccessibleName('5 of 5 tokens');
    expect(empty).toHaveAccessibleName('0 of 5 tokens');
    expect(empty!.querySelectorAll('.token-meter__pip--on')).toHaveLength(0);
  });

  it('the header chip shows the count with an accessible name (Hebrew)', () => {
    wrap(<TokenChip tokens={2} />, 'he');
    expect(screen.getByTestId('current-player-tokens')).toHaveTextContent('2');
    expect(screen.getByTestId('current-player-tokens')).toHaveAccessibleName('2 מתוך 5 אסימונים');
  });
});

describe('Timeline markers', () => {
  const cards = [song(1965, { id: 1 }), song(2003, { id: 2 })];
  const markers: SlotMarker[] = [
    { slotIndex: 2, kind: 'pick', initials: 'A', name: 'Ann' },
    { slotIndex: 0, kind: 'bet', initials: 'C', name: 'Carol' },
  ];

  it('marks taken spots with initials, aria-disabled, and never selects them', async () => {
    const onSelect = vi.fn();
    wrap(<Timeline cards={cards} markers={markers} selectable onSelectSlot={onSelect} owner={0} />);
    expect(screen.getByTestId('timeline')).toHaveAttribute('data-owner', '0');
    const slots = screen.getAllByTestId('timeline-slot');
    expect(slots.map((s) => s.getAttribute('data-marker'))).toEqual(['bet', null, 'pick']);
    expect(slots[0]).toHaveClass('timeline-slot--taken', 'timeline-slot--bet');
    expect(slots[2]).toHaveClass('timeline-slot--taken', 'timeline-slot--pick');
    expect(slots[0]).toHaveAttribute('aria-disabled', 'true');
    expect(slots[0]).toHaveAttribute('data-initials', 'C');
    expect(slots[0]).toHaveAccessibleName("Place before 1965: Carol's bet");
    expect(slots[2]).toHaveAccessibleName("Place after 2003: Ann's pick");
    await userEvent.click(slots[0]!);
    await userEvent.click(slots[2]!);
    expect(onSelect).not.toHaveBeenCalled();
    await userEvent.click(slots[1]!);
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it('read-only with markers: free spots are shown but disabled', () => {
    wrap(<Timeline cards={cards} markers={markers} />);
    const slots = screen.getAllByTestId('timeline-slot');
    expect(slots).toHaveLength(3);
    expect(slots[1]).toBeDisabled();
    expect(slots[1]).not.toHaveAttribute('aria-pressed');
  });

  it('a card won by a bettor gets the gold outline', () => {
    wrap(<Timeline cards={cards} highlightSongId={2} highlightVariant="stolen" />);
    expect(screen.getAllByTestId('timeline-card')[1]).toHaveClass('song-card--new', 'song-card--stolen');
  });
});

describe('playerInitials', () => {
  it('one letter, or two when players share an initial', () => {
    expect(playerInitials(['Ann', 'bob', 'Avi', 'דני', 'דנה', 'Mike'])).toEqual(['An', 'B', 'Av', 'דנ', 'דנ', 'M']);
    expect(playerInitials(['A', 'Al'])).toEqual(['A', 'Al']);
  });
});

describe('Scoreboard with tokens', () => {
  it('adds a Tokens column with a meter and data-tokens', () => {
    wrap(
      <Scoreboard
        players={[
          { name: 'Ann', timeline: [song(1990), song(2000)], tokens: 2 },
          { name: 'Bob', timeline: [song(1980)], tokens: 5 },
          { name: 'Carol', timeline: [song(1985)], tokens: 0 },
        ]}
        currentPlayerIndex={0}
        targetScore={10}
        tokensAndBets
        onClose={() => {}}
      />,
    );
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Player', 'Tokens', 'Cards']);
    const rows = screen.getAllByTestId('score-row');
    expect(rows.map((r) => r.getAttribute('data-tokens'))).toEqual(['2', '5', '0']);
    const cells = rows[0]!.querySelectorAll('td');
    expect(cells).toHaveLength(3);
    expect(cells[2]).toHaveTextContent(/^2$/);
    expect(within(rows[0]!).getByTestId('token-meter')).toHaveAccessibleName('2 of 5 tokens');
    expect(within(rows[1]!).getByTestId('token-meter')).toHaveTextContent('Max');
    expect(screen.getByTestId('scoreboard')).toHaveTextContent(
      'Start with 1 token. Place the card right and name the artist or the title for +1 (max 5).',
    );
  });

  it('without the switch: two cells, no tokens, as before', () => {
    wrap(
      <Scoreboard
        players={[{ name: 'Ann', timeline: [song(1990)], tokens: 3 }]}
        currentPlayerIndex={0}
        targetScore={10}
        onClose={() => {}}
      />,
    );
    const row = screen.getByTestId('score-row');
    expect(row).not.toHaveAttribute('data-tokens');
    expect(row.querySelectorAll('td')).toHaveLength(2);
    expect(screen.queryByTestId('token-meter')).toBeNull();
    expect(screen.queryByRole('columnheader')).toBeNull();
  });
});
