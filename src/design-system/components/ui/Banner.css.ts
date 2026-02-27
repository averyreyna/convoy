import { style, styleVariants } from '@vanilla-extract/css';
import { vars } from '../../theme/index.css';

const base = style({
  borderWidth: '1px',
  borderStyle: 'solid',
  background: vars.color.white,
  borderRadius: vars.radii.xl,
  padding: `${vars.space[2.5]} ${vars.space[4]}`,
  boxShadow: vars.shadows.lg,
});

export const bannerVariants = styleVariants({
  info: {
    borderColor: vars.color.blue[200],
  },
  warning: {
    borderColor: vars.color.amber[200],
  },
  success: {
    borderColor: vars.color.emerald[200],
  },
});

export const banner = style([base, bannerVariants.info]);
export const bannerWarning = style([base, bannerVariants.warning]);
export const bannerSuccess = style([base, bannerVariants.success]);
