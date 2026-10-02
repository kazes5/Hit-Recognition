import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { dictionaries, format, translate } from './dictionaries';
import { applyDocumentLang, directionOf, I18nProvider, LANG_STORAGE_KEY, loadLang, useI18n } from './I18nProvider';

function Probe() {
  const { t, lang, dir, setLang } = useI18n();
  return (
    <div>
      <span data-testid="text">{t('newGame')}</span>
      <span data-testid="lang">{lang}</span>
      <span data-testid="dir">{dir}</span>
      <button onClick={() => setLang(lang === 'he' ? 'en' : 'he')}>toggle</button>
    </div>
  );
}

describe('i18n', () => {
  it('both dictionaries have the same non-empty keys', () => {
    const en = Object.keys(dictionaries.en).sort();
    const he = Object.keys(dictionaries.he).sort();
    expect(he).toEqual(en);
    for (const v of Object.values(dictionaries.he)) expect(v.trim()).not.toBe('');
  });

  it('formats parameters', () => {
    expect(format('Wrong, it was {year}', { year: 2003 })).toBe('Wrong, it was 2003');
    expect(format('{missing}', {})).toBe('{missing}');
    expect(translate('he', 'wrong', { year: 2003 })).toContain('2003');
  });

  it('maps languages to directions', () => {
    expect(directionOf('he')).toBe('rtl');
    expect(directionOf('en')).toBe('ltr');
  });

  it('defaults to English and reads the stored language', () => {
    expect(loadLang()).toBe('en');
    localStorage.setItem(LANG_STORAGE_KEY, 'he');
    expect(loadLang()).toBe('he');
    localStorage.setItem(LANG_STORAGE_KEY, 'fr');
    expect(loadLang()).toBe('en');
  });

  it('applyDocumentLang sets <html lang dir>', () => {
    applyDocumentLang('he');
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
    expect(document.documentElement.getAttribute('lang')).toBe('he');
    applyDocumentLang('en');
    expect(document.documentElement.getAttribute('dir')).toBe('ltr');
  });

  it('switching language updates text, <html dir> and localStorage', () => {
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );
    expect(screen.getByTestId('text')).toHaveTextContent('New game');
    expect(document.documentElement.dir).toBe('ltr');
    act(() => screen.getByText('toggle').click());
    expect(screen.getByTestId('lang')).toHaveTextContent('he');
    expect(screen.getByTestId('dir')).toHaveTextContent('rtl');
    expect(screen.getByTestId('text')).toHaveTextContent('משחק חדש');
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('he');
    expect(localStorage.getItem(LANG_STORAGE_KEY)).toBe('he');
  });

  it('starts in the persisted language', () => {
    localStorage.setItem(LANG_STORAGE_KEY, 'he');
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );
    expect(screen.getByTestId('dir')).toHaveTextContent('rtl');
    expect(document.documentElement.dir).toBe('rtl');
  });
});
