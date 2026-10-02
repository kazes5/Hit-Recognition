// Use the designer's logo if it exists; fall back to neon text otherwise.
const logoModules = import.meta.glob<string>('../styles/logo.svg', {
  eager: true,
  query: '?url',
  import: 'default',
});
const logoUrl: string | undefined = Object.values(logoModules)[0];

export function Logo() {
  if (logoUrl) {
    return (
      <h1 className="logo-heading">
        <img src={logoUrl} alt="HITSTER" className="logo" />
        {/* HTML text, not SVG, so every browser lays the Hebrew out right-to-left. */}
        <span className="neon-title logo-hebrew" dir="rtl" lang="he">
          היטסטר
        </span>
      </h1>
    );
  }
  return (
    <h1 className="neon-title center">
      <span dir="ltr" lang="en">
        HITSTER
      </span>{' '}
      <span dir="rtl" lang="he">
        היטסטר
      </span>
    </h1>
  );
}
