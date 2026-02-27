import { style } from '@vanilla-extract/css';
import { vars } from '../../theme/index.css';

export const headingSm = style({
  fontFamily: vars.fontFamily.sans,
  fontSize: vars.fontSize.sm,
  fontWeight: vars.fontWeight.bold,
  color: vars.color.gray[900],
});

export const headingBase = style({
  fontFamily: vars.fontFamily.sans,
  fontSize: vars.fontSize.base,
  fontWeight: vars.fontWeight.bold,
  color: vars.color.gray[900],
});

export const headingLg = style({
  fontFamily: vars.fontFamily.sans,
  fontSize: vars.fontSize.lg,
  fontWeight: vars.fontWeight.bold,
  color: vars.color.gray[800],
});

export const caption = style({
  fontFamily: vars.fontFamily.sans,
  fontSize: vars.fontSize.xs,
  fontWeight: vars.fontWeight.normal,
  color: vars.color.gray[500],
});

export const captionMuted = style({
  fontFamily: vars.fontFamily.sans,
  fontSize: vars.fontSize['10px'],
  fontWeight: vars.fontWeight.normal,
  color: vars.color.gray[400],
});

export const captionMedium = style({
  fontFamily: vars.fontFamily.sans,
  fontSize: vars.fontSize.xs,
  fontWeight: vars.fontWeight.medium,
  color: vars.color.gray[700],
});
