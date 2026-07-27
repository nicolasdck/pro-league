/** Picks readable foreground text color (black or white) for a given hex background. */
export function getContrastColor(hex: string): '#ffffff' | '#000000' {
  const normalized = hex.replace('#', '');
  const bytes =
    normalized.length === 3
      ? normalized.split('').map((c) => parseInt(c + c, 16))
      : [
          parseInt(normalized.slice(0, 2), 16),
          parseInt(normalized.slice(2, 4), 16),
          parseInt(normalized.slice(4, 6), 16),
        ];

  const [r, g, b] = bytes;
  if ([r, g, b].some((value) => Number.isNaN(value))) return '#ffffff';

  // Relative luminance (per WCAG).
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#000000' : '#ffffff';
}
