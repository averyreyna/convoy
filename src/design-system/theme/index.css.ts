import { createGlobalTheme, globalStyle } from '@vanilla-extract/css';
import { colors } from './colors';
import { spacing } from './spacing';
import { fontFamily, fontSize, fontWeight, letterSpacing } from './typography';
import { radii } from './radii';
import { shadows } from './shadows';

export const vars = createGlobalTheme(':root', {
  color: colors,
  space: spacing,
  fontFamily,
  fontSize,
  fontWeight,
  letterSpacing,
  radii,
  shadows,
});

globalStyle('body', {
  fontFamily: vars.fontFamily.sans,
});
