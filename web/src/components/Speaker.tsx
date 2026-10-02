/** CSS-only loudspeaker (drawn by theme.css); decorative. */
export function Speaker({ playing, small = false }: { playing: boolean; small?: boolean }) {
  const classes = ['speaker', small ? 'speaker--small' : '', playing ? 'speaker--playing' : ''].filter(Boolean).join(' ');
  return <div className={classes} data-testid="speaker" aria-hidden="true" />;
}
