/** A small square vinyl-record SVG in the neon theme (pink / cyan on dark), used as the mock cover. */
export function createMockCoverSvg(): string {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="300" height="300" role="img" aria-label="Record">',
    '<rect width="300" height="300" fill="#12081f"/>',
    '<circle cx="150" cy="150" r="140" fill="#1b1030" stroke="#00e5ff" stroke-width="4"/>',
    '<circle cx="150" cy="150" r="115" fill="none" stroke="#2c1d4a" stroke-width="3"/>',
    '<circle cx="150" cy="150" r="95" fill="none" stroke="#2c1d4a" stroke-width="3"/>',
    '<circle cx="150" cy="150" r="75" fill="none" stroke="#2c1d4a" stroke-width="3"/>',
    '<circle cx="150" cy="150" r="48" fill="#ff2d95"/>',
    '<circle cx="150" cy="150" r="48" fill="none" stroke="#00e5ff" stroke-width="3"/>',
    '<circle cx="150" cy="150" r="8" fill="#12081f"/>',
    '</svg>',
  ].join('');
}
