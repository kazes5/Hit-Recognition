import { Fragment, useEffect, useRef } from 'react';
import { sortTimeline } from '../game/rules';
import type { Song } from '../game/types';
import { useI18n } from '../i18n/I18nProvider';
import { SongCard } from './SongCard';

interface TimelineProps {
  cards: readonly Song[];
  /** Show selectable slots between / around the cards. */
  selectable?: boolean;
  selectedSlot?: number | null;
  onSelectSlot?: (index: number) => void;
  highlightSongId?: number;
  testId?: string;
  cardTestId?: string;
  label?: string;
}

export function Timeline({
  cards,
  selectable = false,
  selectedSlot = null,
  onSelectSlot,
  highlightSongId,
  testId = 'timeline',
  cardTestId = 'timeline-card',
  label,
}: TimelineProps) {
  const { t } = useI18n();
  const sorted = sortTimeline(cards);
  const selectedRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const el = selectedRef.current;
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [selectedSlot]);

  const slotLabel = (i: number): string => {
    const prev = sorted[i - 1];
    const next = sorted[i];
    if (prev && next) return t('slotBetween', { a: prev.year, b: next.year });
    if (next) return t('slotBefore', { year: next.year });
    if (prev) return t('slotAfter', { year: prev.year });
    return t('slotOnly');
  };

  const slot = (i: number) => {
    const selected = selectedSlot === i;
    return (
      <button
        type="button"
        key={`slot-${i}`}
        ref={selected ? selectedRef : undefined}
        className={`timeline-slot${selected ? ' timeline-slot--selected' : ''}`}
        data-testid="timeline-slot"
        data-index={i}
        aria-pressed={selected}
        aria-label={slotLabel(i)}
        onClick={() => onSelectSlot?.(i)}
      />
    );
  };

  return (
    <div className="timeline" dir="ltr" data-testid={testId} role="group" aria-label={label}>
      {selectable && slot(0)}
      {sorted.map((song, i) => (
        <Fragment key={song.id}>
          <SongCard song={song} small testId={cardTestId} highlight={song.id === highlightSongId} />
          {selectable && slot(i + 1)}
        </Fragment>
      ))}
    </div>
  );
}
