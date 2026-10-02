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
        <img src={logoUrl} alt="HITSTER — היטסטר" className="logo" />
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
