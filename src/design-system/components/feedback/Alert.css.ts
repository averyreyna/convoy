import { style, styleVariants } from '@vanilla-extract/css';
import { vars } from '../../theme/index.css';

const base = style({
  padding: `${vars.space[1.5]} ${vars.space[2]}`,
  marginBottom: vars.space[2],
  borderRadius: vars.radii.md,
  fontSize: vars.fontSize.xs,
  fontFamily: vars.fontFamily.sans,
});

export const alertVariants = styleVariants({
  error: {
    background: vars.color.red[50],
    color: vars.color.red[700],
  },
  warning: {
    background: vars.color.amber[50],
    color: vars.color.amber[600],
  },
});

export const alert = style([base, alertVariants.error]);

export const alertWarning = style([base, alertVariants.warning]);
