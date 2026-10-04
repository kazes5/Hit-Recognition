import { Fragment, useEffect, useRef } from 'react';
import { sortTimeline } from '../game/rules';
import type { Song } from '../game/types';
import { useI18n } from '../i18n/I18nProvider';
import { SongCard } from './SongCard';

/** A taken spot during betting: the current player's pick (pink) or a bet (gold). */
export interface SlotMarker {
  slotIndex: number;
  kind: 'pick' | 'bet';
  /** One letter, or two when players share an initial (see `playerInitials`). */
  initials: string;
  name: string;
}

interface TimelineProps {
  cards: readonly Song[];
  /** Show selectable slots between / around the cards. */
  selectable?: boolean;
  selectedSlot?: number | null;
  onSelectSlot?: (index: number) => void;
  /**
   * Taken spots. With markers, the slots are always shown: taken ones carry
   * the player's initial, are `aria-disabled` and cannot be selected; free ones
   * are selectable only with `selectable`.
   */
  markers?: readonly SlotMarker[];
  highlightSongId?: number;
  /** `stolen`: the card was won by a bettor (gold outline). */
  highlightVariant?: 'new' | 'stolen';
  /** Index of the player who owns this timeline (`data-owner`). */
  owner?: number;
  testId?: string;
  cardTestId?: string;
  label?: string;
}

export function Timeline({
  cards,
  selectable = false,
  selectedSlot = null,
  onSelectSlot,
  markers,
  highlightSongId,
  highlightVariant = 'new',
  owner,
  testId = 'timeline',
  cardTestId = 'timeline-card',
  label,
}: TimelineProps) {
  const { t } = useI18n();
  const sorted = sortTimeline(cards);
  const selectedRef = useRef<HTMLButtonElement | null>(null);
  const showSlots = selectable || markers !== undefined;

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
    const marker = markers?.find((m) => m.slotIndex === i);
    if (marker) {
      return (
        <button
          type="button"
          key={`slot-${i}`}
          className={`timeline-slot timeline-slot--taken timeline-slot--${marker.kind}`}
          data-testid="timeline-slot"
          data-index={i}
          data-marker={marker.kind}
          data-initials={marker.initials}
          aria-disabled="true"
          aria-label={t(marker.kind === 'pick' ? 'slotPickOf' : 'slotBetOf', { slot: slotLabel(i), name: marker.name })}
        />
      );
    }
    const selected = selectedSlot === i;
    return (
      <button
        type="button"
        key={`slot-${i}`}
        ref={selected ? selectedRef : undefined}
        className={`timeline-slot${selected ? ' timeline-slot--selected' : ''}`}
        data-testid="timeline-slot"
        data-index={i}
        aria-pressed={selectable ? selected : undefined}
        aria-label={slotLabel(i)}
        disabled={!selectable}
        onClick={() => onSelectSlot?.(i)}
      />
    );
  };

  const highlightClass = highlightVariant === 'stolen' ? 'song-card--stolen' : undefined;

  return (
    <div className="timeline" dir="ltr" data-testid={testId} data-owner={owner} role="group" aria-label={label}>
      {showSlots && slot(0)}
      {sorted.map((song, i) => (
        <Fragment key={song.id}>
          <SongCard
            song={song}
            small
            testId={cardTestId}
            highlight={song.id === highlightSongId}
            className={song.id === highlightSongId ? highlightClass : undefined}
          />
          {showSlots && slot(i + 1)}
        </Fragment>
      ))}
    </div>
  );
}
