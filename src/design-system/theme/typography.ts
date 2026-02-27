/**
 * Design system typography tokens.
 */
export const fontFamily = {
  sans: "'ABC Diatype', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  mono: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
} as const;

export const fontSize = {
  '9px': '9px',
  '10px': '10px',
  xs: '0.75rem',
  sm: '0.875rem',
  base: '1rem',
  lg: '1.125rem',
  xl: '1.25rem',
} as const;

export const fontWeight = {
  light: '300',
  normal: '400',
  medium: '500',
  bold: '700',
} as const;

export const letterSpacing = {
  normal: '0',
  wide: '0.025em',
} as const;
