import { useI18n } from '../i18n/I18nProvider';

export interface AudioControls {
  playing: boolean;
  canPlay: boolean;
  hasPlayed: boolean;
  onPlay: () => void;
}

/** "▶ Play" / "▶ Replay" (`btn-play`). */
export function PlayButton({ audio, small = false }: { audio: AudioControls; small?: boolean }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      className={`btn btn--outline${small ? ' btn--sm' : ''}`}
      data-testid="btn-play"
      disabled={!audio.canPlay}
      onClick={audio.onPlay}
    >
      <span aria-hidden="true">▶ </span>
      {audio.hasPlayed ? t('replay') : t('play')}
    </button>
  );
}
