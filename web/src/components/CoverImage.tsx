import { useEffect, useState } from 'react';
import { fetchCoverUrl } from '../api/client';
import { useI18n } from '../i18n/I18nProvider';

/**
 * Decorative, best-effort cover picture for the revealed song. Mount it only on the
 * result screen: it requests the cover on mount, preloads the image and renders
 * nothing unless the image actually loaded. Errors are ignored silently.
 */
export function CoverImage({ songId, title }: { songId: number; title: string }) {
  const { t } = useI18n();
  const [loaded, setLoaded] = useState<{ songId: number; url: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let img: HTMLImageElement | null = null;
    setLoaded(null);
    fetchCoverUrl(songId)
      .then((url) => {
        if (cancelled || !url) return;
        img = new Image();
        img.onload = () => {
          if (!cancelled) setLoaded({ songId, url });
        };
        img.onerror = () => undefined;
        img.referrerPolicy = 'no-referrer';
        img.src = url;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (img) {
        img.onload = null;
        img.onerror = null;
      }
    };
  }, [songId]);

  if (!loaded || loaded.songId !== songId) return null;
  return (
    <figure className="cover" data-testid="cover-wrap">
      <img
        className="cover__img"
        data-testid="cover-image"
        src={loaded.url}
        alt={t('coverAlt', { title })}
        referrerPolicy="no-referrer"
      />
    </figure>
  );
}
