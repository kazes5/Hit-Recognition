import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { dictionaries, ordinal } from './dictionaries';
import { formatNode, nameList } from './formatNode';
import { I18nProvider, useI18n } from './I18nProvider';
import type { MessageKey } from './dictionaries';

/** Every key of docs/TOKENS_AND_BETS.md §6.7. */
const SPEC_KEYS: MessageKey[] = [
  'tokens', 'tokensCount', 'tokensMax', 'tokensAndBets', 'tokenRule', 'skipSong', 'skipConfirm', 'skipYes',
  'keepListening', 'nameItToggle', 'nameItLegend', 'guessArtist', 'guessArtistPlaceholder', 'guessTitle',
  'guessTitlePlaceholder', 'lockIn', 'pickSlotFirst', 'guessFailed', 'tryAgain', 'continueWithoutNaming',
  'bettingOpen', 'betHint', 'betNeedsName', 'bettorNameIt', 'checkGuess', 'canBet', 'cannotBet', 'ok', 'cancel',
  'placeBet', 'reasonNoTokens', 'reasonTried', 'noFreeSlots', 'slotPickOf', 'slotBetOf', 'namedBlocked', 'guessWas',
  'acceptGuess', 'outcomeCardToken', 'outcomeCardOnly', 'outcomeLostToken', 'outcomeKeptToken', 'stolenBy',
  'landedIn', 'cardDiscarded', 'wonOnTokens', 'colPlayer', 'colCards',
];

describe('tokens and bets texts', () => {
  it('has every §6.7 key in English and Hebrew, with the same {params}', () => {
    const params = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const key of SPEC_KEYS) {
      expect(dictionaries.en[key], key).toBeTruthy();
      expect(dictionaries.he[key], key).toBeTruthy();
      expect(params(dictionaries.he[key]), key).toEqual(params(dictionaries.en[key]));
    }
    expect(dictionaries.en.placeBet).toBe('Bet 1 token');
    expect(dictionaries.he.placeBet).toBe('להמר באסימון');
    expect(dictionaries.en.cannotBet).toBe('Not this time. Pass the phone on.');
    expect(dictionaries.he.acceptGuess).toBe('מקבלים את התשובה');
  });

  it('ordinals', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22].map((n) => ordinal('en', n))).toEqual([
      '1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd',
    ]);
    expect(ordinal('he', 1)).toBe('ראשון');
    expect(ordinal('he', 2)).toBe('שני');
  });
});

describe('formatNode / tNode', () => {
  it('wraps string params in <bdi>, inserts numbers as text and keeps unknown params', () => {
    const { container } = render(<p>{formatNode('{name} has {count} of {max}', { name: 'Ann', count: 3 })}</p>);
    expect(container.textContent).toBe('Ann has 3 of {max}');
    expect(container.querySelectorAll('bdi')).toHaveLength(1);
    expect(container.querySelector('bdi')).toHaveTextContent('Ann');
  });

  it('puts "+1" and "−1" in dir="ltr"', () => {
    const { container } = render(<p>{formatNode('‎+1 קלף · ‎−1 אסימון: {names}', { names: nameList(['דני', 'Mike']) })}</p>);
    const ltr = [...container.querySelectorAll('[dir="ltr"]')].map((e) => e.textContent);
    expect(ltr).toEqual(['+1', '−1']);
    expect([...container.querySelectorAll('bdi')].map((b) => b.textContent)).toEqual(['דני', 'Mike']);
    expect(container.textContent).toContain('דני, Mike');
  });

  it('tNode renders an English name inside a Hebrew sentence in <bdi>', () => {
    function Probe() {
      const { tNode } = useI18n();
      return <p data-testid="p">{tNode('betHint', { player: 'Ann' })}</p>;
    }
    render(
      <I18nProvider initialLang="he">
        <Probe />
      </I18nProvider>,
    );
    const p = screen.getByTestId('p');
    expect(p).toHaveTextContent('חושבים ש-Ann טועה? קחו את הטלפון והקישו על השם שלכם.');
    expect(p.querySelector('bdi')).toHaveTextContent('Ann');
  });
});
