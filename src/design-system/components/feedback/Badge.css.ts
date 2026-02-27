import { style, styleVariants } from '@vanilla-extract/css';
import { vars } from '../../theme/index.css';

const base = style({
  display: 'inline-block',
  padding: `${vars.space[0.5]} ${vars.space[2]}`,
  borderRadius: vars.radii.full,
  fontSize: vars.fontSize['10px'],
  fontFamily: vars.fontFamily.sans,
  fontWeight: vars.fontWeight.medium,
});

export const badgeVariants = styleVariants({
  proposed: {
    background: vars.color.amber[50],
    color: vars.color.amber[600],
  },
  error: {
    background: vars.color.red[50],
    color: vars.color.red[600],
  },
  success: {
    background: vars.color.emerald[50],
    color: vars.color.emerald[600],
  },
  neutral: {
    background: vars.color.gray[100],
    color: vars.color.gray[600],
  },
});

export const badge = {
  base,
  variants: badgeVariants,
};
