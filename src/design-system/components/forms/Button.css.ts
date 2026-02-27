import { style, styleVariants } from '@vanilla-extract/css';
import { vars } from '../../theme/index.css';

const base = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: vars.space[2],
  fontFamily: vars.fontFamily.sans,
  fontWeight: vars.fontWeight.medium,
  transition: 'color 0.15s, background-color 0.15s, border-color 0.15s',
  outline: 'none',
  border: '2px solid transparent',
  cursor: 'pointer',
  borderRadius: vars.radii.md,
});

export const buttonVariants = styleVariants({
  primary: {
    background: vars.color.blue[500],
    color: vars.color.white,
    borderColor: 'transparent',
    selectors: {
      '&:hover': { background: vars.color.blue[600] },
      '&:active': { background: vars.color.blue[700] },
    },
  },
  secondary: {
    background: vars.color.white,
    color: vars.color.gray[700],
    borderColor: vars.color.gray[200],
    selectors: {
      '&:hover': { background: vars.color.gray[50], borderColor: vars.color.gray[300] },
    },
  },
  ghost: {
    background: 'transparent',
    color: vars.color.gray[500],
    borderColor: 'transparent',
    selectors: {
      '&:hover': { color: vars.color.gray[700] },
    },
  },
  danger: {
    background: vars.color.red[500],
    color: vars.color.white,
    borderColor: 'transparent',
    selectors: {
      '&:hover': { background: vars.color.red[600] },
    },
  },
});

export const buttonSizes = styleVariants({
  sm: {
    padding: `${vars.space[1]} ${vars.space[2]}`,
    fontSize: vars.fontSize['10px'],
  },
  md: {
    padding: `${vars.space[1.5]} ${vars.space[3]}`,
    fontSize: vars.fontSize.sm,
  },
});

const fullWidth = style({ width: '100%' });

export const button = {
  base,
  variants: buttonVariants,
  sizes: buttonSizes,
  fullWidth,
};

export { fullWidth as buttonFullWidth };
