import type { CSSProperties } from 'react';
import { decadeOf } from '../game/rules';
import { DECK_CODE, type Song } from '../game/types';
import { useI18n } from '../i18n/I18nProvider';

export function decadeClass(year: number): string {
  return `song-card--d${decadeOf(year)}`;
}

interface SongCardProps {
  song: Song;
  small?: boolean;
  /** Adds the result-screen testids (card-artist, card-year, …). */
  withTestIds?: boolean;
  testId?: string;
  highlight?: boolean;
  /** Extra modifier classes, e.g. song-card--correct. */
  className?: string;
  style?: CSSProperties;
}

export function SongCard({ song, small = false, withTestIds = false, testId, highlight = false, className, style }: SongCardProps) {
  const { t } = useI18n();
  const tid = (id: string) => (withTestIds ? id : undefined);
  const classes = ['song-card', decadeClass(song.year), small ? 'song-card--small' : '', highlight ? 'song-card--new' : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  return (
    <article
      className={classes}
      style={style}
      data-testid={testId}
      data-year={song.year}
      data-song-id={song.id}
      aria-label={t('cardLabel', { artist: song.artist, title: song.title, year: song.year })}
    >
      <div className="song-card__artist" dir="auto" lang={song.language} data-testid={tid('card-artist')}>
        {song.artist}
      </div>
      <div className="song-card__year" dir="ltr" data-testid={tid('card-year')}>
        {song.year}
      </div>
      <div className="song-card__title" dir="auto" lang={song.language} data-testid={tid('card-title')}>
        {song.title}
      </div>
      <span className="song-card__deck" dir="ltr" aria-hidden="true">
        {DECK_CODE}
      </span>
      <span className="song-card__number" dir="ltr" data-testid={tid('card-number')}>
        {song.id}
      </span>
    </article>
  );
}

export function HiddenCard({ playing = false, style }: { playing?: boolean; style?: CSSProperties }) {
  const { t } = useI18n();
  // The "?" is drawn by CSS; never put the answer in the DOM before reveal.
  return (
    <div className="song-card song-card--hidden" style={style} data-testid="hidden-card" role="img" aria-label={t('hiddenCard')}>
      <span className={`equalizer${playing ? ' equalizer--playing' : ''}`} aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </span>
    </div>
  );
}
