import { style, styleVariants } from '@vanilla-extract/css';
import { vars } from '../../theme/index.css';

const base = style({
  width: '100%',
  padding: `${vars.space[1.5]} ${vars.space[2]}`,
  fontFamily: vars.fontFamily.sans,
  fontSize: vars.fontSize.xs,
  color: vars.color.gray[700],
  background: vars.color.gray[50],
  border: `1px solid ${vars.color.gray[200]}`,
  borderRadius: vars.radii.md,
  outline: 'none',
  transition: 'border-color 0.15s, box-shadow 0.15s',
  selectors: {
    '&::placeholder': { color: vars.color.gray[400] },
    '&:focus': {
      borderColor: vars.color.blue[300],
      boxShadow: `0 0 0 1px ${vars.color.blue[100]}`,
    },
  },
});

export const inputVariants = styleVariants({
  default: {},
  error: {
    borderColor: vars.color.red[400],
    selectors: {
      '&:focus': {
        borderColor: vars.color.red[400],
        boxShadow: `0 0 0 1px ${vars.color.red[100]}`,
      },
    },
  },
});

const defaultInput = style([base, inputVariants.default]);

export const input = {
  base,
  default: defaultInput,
  variants: inputVariants,
};
