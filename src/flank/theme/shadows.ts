/**
 * Flank design system shadow tokens.
 */
// Flat, prototype-y depth: a hairline border-ring instead of soft drop shadows.
const hairline = '0 0 0 1px rgb(0 0 0 / 0.08)';

export const shadows = {
  sm: hairline,
  md: hairline,
  lg: hairline,
  red100: '0 0 0 1px rgb(254 226 226 / 0.8)',
  blue100: '0 0 0 1px rgb(219 234 254 / 0.8)',
  amber100: '0 0 0 1px rgb(253 230 138 / 0.9)',
  // Stronger ring used to highlight the linked node/cell on hover.
  blueRing: '0 0 0 2px rgb(96 165 250 / 0.9)',
} as const;
